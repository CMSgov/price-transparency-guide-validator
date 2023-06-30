import util from 'util';
import axios from 'axios';
import readlineSync from 'readline-sync';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import temp from 'temp';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';

export type ZipContents = {
  zipFile: yauzl.ZipFile;
  jsonEntries: yauzl.Entry[];
  dataPath: string;
};

export const config = {
  AVAILABLE_SCHEMAS: [
    'allowed-amounts',
    'in-network-rates',
    'provider-reference',
    'table-of-contents'
  ],
  SCHEMA_REPO_URL: 'https://github.com/CMSgov/price-transparency-guide.git',
  SCHEMA_REPO_FOLDER: path.normalize(path.join(__dirname, '..', 'schema-repo'))
};

const ONE_MEGABYTE = 1024 * 1024;
const DATA_SIZE_WARNING_THRESHOLD = ONE_MEGABYTE * 1024; // 1 gigabyte

export async function ensureRepo(repoDirectory: string) {
  // check if the repo exists, and if not, try to clone it
  if (!fs.existsSync(path.join(repoDirectory, '.git'))) {
    return util.promisify(exec)(`git clone ${config.SCHEMA_REPO_URL} "${repoDirectory}"`);
  }
}

export async function useRepoVersion(schemaVersion: string, schemaName: string, strict = false) {
  try {
    await ensureRepo(config.SCHEMA_REPO_FOLDER);
    const tagResult = await util.promisify(exec)(
      `git -C "${config.SCHEMA_REPO_FOLDER}" tag --list --sort=taggerdate`
    );
    const tags = tagResult.stdout
      .split('\n')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    if (tags.includes(schemaVersion)) {
      await util.promisify(exec)(`git -C "${config.SCHEMA_REPO_FOLDER}" checkout ${schemaVersion}`);
      let schemaContents: string | Buffer = fs.readFileSync(
        path.join(config.SCHEMA_REPO_FOLDER, 'schemas', schemaName, `${schemaName}.json`)
      );
      if (strict) {
        const modifiedSchema = JSON.parse(schemaContents.toString('utf-8'));
        makeSchemaStrict(modifiedSchema);
        schemaContents = JSON.stringify(modifiedSchema);
      }
      // write this version of the schema to a temporary file
      temp.track();
      const schemaDir = temp.mkdirSync('schemas');
      const schemaFilePath = path.join(schemaDir, 'schema.json');
      fs.writeFileSync(schemaFilePath, schemaContents, { encoding: 'utf-8' });
      return schemaFilePath;
    } else {
      // we didn't find your tag. maybe you mistyped it, so show the available ones.
      console.log(
        `Could not find a schema version named "${schemaVersion}". Available versions are:\n${tags.join(
          '\n'
        )}`
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(`Error when accessing schema: ${error}`);
    process.exitCode = 1;
  }
}

// note that this only sets additionalProperties to false at the top level, and at the first level of definitions.
// if there are nested definitions, those will not be modified.
function makeSchemaStrict(schema: any) {
  if (typeof schema === 'object') {
    schema.additionalProperties = false;
    if (schema.definitions != null && typeof schema.definitions === 'object') {
      for (const defKey of Object.keys(schema.definitions)) {
        schema.definitions[defKey].additionalProperties = false;
      }
    }
  }
}

export function buildRunCommand(
  schemaPath: string,
  dataPath: string,
  outputDir: string,
  containerId: string,
  schemaName: string
): string {
  // figure out mount for schema file
  const absoluteSchemaPath = path.resolve(schemaPath);
  const schemaDir = path.dirname(absoluteSchemaPath);
  const schemaFile = path.basename(absoluteSchemaPath);
  // figure out mount for data file
  const absoluteDataPath = path.resolve(dataPath);
  const dataDir = path.dirname(absoluteDataPath);
  const dataFile = path.basename(absoluteDataPath);
  return `docker run --rm -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ -v "${path.resolve(
    outputDir
  )}":/output/ ${containerId} "schema/${schemaFile}" "data/${dataFile}" -o "output/" -s ${schemaName}`;
}

type ContainerResult = {
  pass: boolean;
  locations?: {
    inNetwork?: string[];
    allowedAmount?: string[];
    providerReference?: string[];
  };
};

export async function runContainer(
  schemaPath: string,
  schemaName: string,
  dataPath: string,
  outputPath: string
): Promise<ContainerResult> {
  try {
    const containerId = await util
      .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
      .then(result => result.stdout.trim())
      .catch(reason => {
        console.log(reason.stderr);
        return '';
      });
    if (containerId.length > 0) {
      // make temp dir for output
      const outputDir = temp.mkdirSync('output');
      // copy output files after it finishes
      const runCommand = buildRunCommand(schemaPath, dataPath, outputDir, containerId, schemaName);
      console.log('Running validator container...');
      return util
        .promisify(exec)(runCommand)
        .then(result => {
          const containerResult: ContainerResult = { pass: true };
          const containerOutputPath = path.join(outputDir, 'output.txt');
          const containerLocationPath = path.join(outputDir, 'locations.json');
          if (outputPath && fs.existsSync(containerOutputPath)) {
            fs.copySync(containerOutputPath, outputPath);
          }
          if (fs.existsSync(containerOutputPath)) {
            if (outputPath) {
              fs.copySync(containerOutputPath, outputPath);
            } else {
              const outputText = fs.readFileSync(containerOutputPath, 'utf-8');
              console.log(outputText);
            }
          }
          if (fs.existsSync(containerLocationPath)) {
            try {
              containerResult.locations = fs.readJsonSync(containerLocationPath);
            } catch (err) {
              // something went wrong when reading the location file that the validator produced
            }
          }
          return containerResult;
        })
        .catch(reason => {
          if (outputPath && fs.existsSync(path.join(outputDir, 'output.txt'))) {
            fs.copySync(path.join(outputDir, 'output.txt'), outputPath);
          }
          console.log(reason.stdout);
          console.log(reason.stderr);
          process.exitCode = 1;
          return { pass: false };
        });
    } else {
      console.log('Could not find a validator docker container.');
      process.exitCode = 1;
      return { pass: false };
    }
  } catch (error) {
    console.log(`Error when running validator container: ${error}`);
    process.exitCode = 1;
    return { pass: false };
  }
}

export async function checkDataUrl(url: string) {
  try {
    const response = await axios.head(url);
    if (response.status === 200) {
      let proceedToDownload: boolean;
      const contentLength = parseInt(response.headers['content-length']);
      if (isNaN(contentLength)) {
        proceedToDownload = readlineSync.keyInYNStrict(
          'Data file size is unknown. Download this file?'
        );
      } else if (contentLength > DATA_SIZE_WARNING_THRESHOLD) {
        proceedToDownload = readlineSync.keyInYNStrict(
          `Data file is ${(contentLength / ONE_MEGABYTE).toFixed(
            2
          )} MB in size. Download this file?`
        );
      } else {
        proceedToDownload = true;
      }
      return proceedToDownload;
    } else {
      console.log(
        `Received unsuccessful status code ${response.status} when checking data file URL: ${url}`
      );
      return false;
    }
  } catch (e) {
    console.log(`Request failed when checking data file URL: ${url}`);
    console.log(e.message);
    return false;
  }
}

export async function downloadDataFile(url: string, folder: string): Promise<string | ZipContents> {
  const filenameGuess = 'data.json';
  const dataPath = path.join(folder, filenameGuess);
  return new Promise((resolve, reject) => {
    console.log('Beginning download...\n');
    axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      onDownloadProgress: progressEvent => {
        if (process.stdout.isTTY) {
          let progressText: string;
          if (progressEvent.progress != null) {
            progressText = `Downloaded ${Math.floor(progressEvent.progress * 100)}% of file (${
              progressEvent.loaded
            } bytes)`;
          } else {
            progressText = `Downloaded ${progressEvent.loaded} bytes`;
          }
          process.stdout.clearLine(0, () => {
            process.stdout.cursorTo(0, () => {
              process.stdout.write(progressText);
            });
          });
        }
      }
    })
      .then(response => {
        const contentType = response.headers['content-type'] ?? 'application/octet-stream';
        if (isZip(contentType, url)) {
          // zips require additional work to find a JSON file inside
          const zipPath = path.join(folder, 'data.zip');
          const zipOutputStream = fs.createWriteStream(zipPath);
          pipeline(response.data, zipOutputStream).then(() => {
            yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (err, zipFile) => {
              if (err != null) {
                reject(err);
              }
              const jsonEntries: yauzl.Entry[] = [];

              zipFile.on('entry', (entry: yauzl.Entry) => {
                if (entry.fileName.endsWith('.json')) {
                  jsonEntries.push(entry);
                }
                zipFile.readEntry();
              });

              zipFile.on('end', () => {
                console.log('\nDownload complete.');
                if (jsonEntries.length === 0) {
                  reject('No JSON file present in zip.');
                } else {
                  let chosenEntry: yauzl.Entry;
                  if (jsonEntries.length === 1) {
                    chosenEntry = jsonEntries[0];
                    zipFile.openReadStream(chosenEntry, (err, readStream) => {
                      const outputStream = fs.createWriteStream(dataPath);
                      outputStream.on('finish', () => {
                        zipFile.close();
                        resolve(dataPath);
                      });
                      outputStream.on('error', () => {
                        zipFile.close();
                        reject('Error writing downloaded file.');
                      });
                      readStream.pipe(outputStream);
                    });
                  } else {
                    jsonEntries.sort((a, b) => {
                      return a.fileName.localeCompare(b.fileName);
                    });
                    resolve({ zipFile, jsonEntries, dataPath });
                  }
                }
              });
              zipFile.readEntry();
            });
          });
        } else {
          const outputStream = fs.createWriteStream(dataPath);
          outputStream.on('finish', () => {
            console.log('\nDownload complete.');
            resolve(dataPath);
          });
          outputStream.on('error', () => {
            reject('Error writing downloaded file.');
          });

          if (isGzip(contentType, url)) {
            pipeline(response.data, createGunzip(), outputStream);
          } else {
            response.data.pipe(outputStream);
          }
        }
      })
      .catch(reason => {
        reject('Error downloading data file.');
      });
  });
}

export async function getEntryFromZip(
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
  dataPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (err, readStream) => {
      if (err) {
        reject(err);
      } else {
        const outputStream = fs.createWriteStream(dataPath);
        outputStream.on('finish', () => {
          // keep the zipFile open for now, in case we want more entries
          resolve();
        });
        outputStream.on('error', () => {
          zipFile.close();
          reject('Error writing chosen file.');
        });
        readStream.pipe(outputStream);
      }
    });
  });
}

function isGzip(contentType: string, url: string): boolean {
  return (
    contentType === 'application/gzip' ||
    contentType === 'application/x-gzip' ||
    (contentType === 'application/octet-stream' && url.endsWith('.gz'))
  );
}

function isZip(contentType: string, url: string): boolean {
  return (
    contentType === 'application/zip' ||
    (contentType === 'application/octet-stream' && url.endsWith('.zip'))
  );
}

export function chooseJsonFile(entries: yauzl.Entry[]): yauzl.Entry {
  // there might be a lot of entries. show ten per page of results
  console.log(`${entries.length} JSON files found within ZIP archive.`);
  const maxPage = Math.floor((entries.length - 1) / 10);
  let currentPage = 0;
  let chosenIndex: number;

  showMenuOptions(
    currentPage,
    maxPage,
    entries.slice(currentPage * 10, currentPage * 10 + 10).map(ent => ent.fileName)
  );
  readlineSync.promptCLLoop((command, ...extraArgs) => {
    if (/^n(ext)?$/i.test(command)) {
      if (currentPage < maxPage) {
        currentPage++;
      } else {
        console.log('Already at last page.');
      }
    } else if (/^p(revious)?$/i.test(command)) {
      if (currentPage > 0) {
        currentPage--;
      } else {
        console.log('Already at first page.');
      }
    } else if (/^go?$/i.test(command)) {
      const targetPage = parseInt(extraArgs[0]);
      if (targetPage > 0 && targetPage <= maxPage + 1) {
        currentPage = targetPage - 1;
      } else {
        console.log("Can't go to that page.");
      }
    } else if (/^\d$/.test(command)) {
      chosenIndex = currentPage * 10 + parseInt(command);
      console.log(`You selected: ${entries[chosenIndex].fileName}`);
      return true;
    } else {
      console.log('Unrecognized command.');
    }
    showMenuOptions(
      currentPage,
      maxPage,
      entries.slice(currentPage * 10, (currentPage + 1) * 10).map(ent => ent.fileName)
    );
  });
  return entries[chosenIndex];
}

function showMenuOptions(currentPage: number, maxPage: number, items: string[]) {
  console.log(`Showing page ${currentPage + 1} of ${maxPage + 1}`);
  items.forEach((item, idx) => {
    console.log(`(${idx}): ${item}`);
  });
  const commandsToShow: string[] = [];
  if (currentPage > 0) {
    commandsToShow.push('(p)revious page');
  }
  if (currentPage < maxPage) {
    commandsToShow.push('(n)ext page');
  }
  if (maxPage > 0) {
    commandsToShow.push('"(g)o X" to jump to a page');
  }
  console.log(commandsToShow.join(' | '));
}

export function appendResults(source: string, destination: string, prefixData: string = '') {
  try {
    const sourceData = fs.readFileSync(source);
    fs.appendFileSync(destination, `${prefixData}${sourceData}`);
  } catch (err) {
    console.log('Problem copying results to output file', err);
  }
}

export async function validateSingleFileFromUrl(
  dataUrl: string,
  schemaVersion: string,
  schemaName: string,
  strict: boolean,
  outputPath: string
) {
  try {
    if (await checkDataUrl(dataUrl)) {
      await useRepoVersion(schemaVersion, schemaName, strict).then(async schemaPath => {
        if (schemaPath != null) {
          console.log(`File: ${dataUrl}`);
          const dataPath = await downloadDataFile(dataUrl, temp.mkdirSync());
          if (typeof dataPath === 'string') {
            const containedResult = await runContainer(
              schemaPath,
              schemaName,
              dataPath,
              outputPath
            );
            if (!containedResult) {
              process.exitCode = 1;
            }
          }
        } else {
          console.log('No schema available - not validating.');
        }
      });
    }
  } catch (err) {
    console.log('Problem validating single downloaded file', err);
  }
}
