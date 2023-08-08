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
import { EOL } from 'os';
import { DockerManager } from './DockerManager';
import { SchemaManager } from './SchemaManager';
import { logger } from './logger';

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

type ContainerResult = {
  pass: boolean;
  locations?: {
    inNetwork?: string[];
    allowedAmount?: string[];
    providerReference?: string[];
  };
};

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
      logger.error(
        `Received unsuccessful status code ${response.status} when checking data file URL: ${url}`
      );
      return false;
    }
  } catch (e) {
    logger.error(`Request failed when checking data file URL: ${url}`);
    logger.error(e.message);
    return false;
  }
}

export async function downloadDataFile(url: string, folder: string): Promise<string | ZipContents> {
  const filenameGuess = 'data.json';
  const dataPath = path.join(folder, filenameGuess);
  return new Promise((resolve, reject) => {
    logger.info('Beginning download...\n');
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
              process.stdout.moveCursor(0, -1, () => {
                logger.info(progressText);
              });
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
                logger.info('Download complete.');
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
            logger.info('Download complete.');
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
    (contentType === 'application/octet-stream' && /\.gz(\?|$)/.test(url))
  );
}

function isZip(contentType: string, url: string): boolean {
  return (
    contentType === 'application/zip' ||
    (contentType === 'application/octet-stream' && /\.zip(\?|$)/.test(url))
  );
}

export function chooseJsonFile(entries: yauzl.Entry[]): yauzl.Entry {
  // there might be a lot of entries. show ten per page of results
  logger.info(`${entries.length} JSON files found within ZIP archive.`);
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
        logger.menu('Already at last page.');
      }
    } else if (/^p(revious)?$/i.test(command)) {
      if (currentPage > 0) {
        currentPage--;
      } else {
        logger.menu('Already at first page.');
      }
    } else if (/^go?$/i.test(command)) {
      const targetPage = parseInt(extraArgs[0]);
      if (targetPage > 0 && targetPage <= maxPage + 1) {
        currentPage = targetPage - 1;
      } else {
        logger.menu("Can't go to that page.");
      }
    } else if (/^\d$/.test(command)) {
      chosenIndex = currentPage * 10 + parseInt(command);
      logger.menu(`You selected: ${entries[chosenIndex].fileName}`);
      return true;
    } else {
      logger.menu('Unrecognized command.');
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
  logger.menu(`Showing page ${currentPage + 1} of ${maxPage + 1}`);
  items.forEach((item, idx) => {
    logger.menu(`(${idx}): ${item}`);
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
  logger.menu(commandsToShow.join(' | '));
}

export function appendResults(source: string, destination: string, prefixData: string = '') {
  try {
    const sourceData = fs.readFileSync(source);
    fs.appendFileSync(destination, `${prefixData}${sourceData}`);
  } catch (err) {
    logger.error('Problem copying results to output file', err);
  }
}

export async function assessTocContents(
  locations: ContainerResult['locations'],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  outputPath: string
): Promise<string[]> {
  const totalFileCount =
    (locations?.inNetwork?.length ?? 0) + (locations?.allowedAmount?.length ?? 0);
  const fileText = totalFileCount === 1 ? 'this file' : 'these files';
  if (totalFileCount > 0) {
    logger.info(`Table of contents refers to ${fileText}:`);
    if (locations.inNetwork?.length > 0) {
      logger.info('== In-Network Rates ==');
      locations.inNetwork.forEach(inf => logger.info(`* ${inf}`));
    }
    if (locations.allowedAmount?.length > 0) {
      logger.info('== Allowed Amounts ==');
      locations.allowedAmount.forEach(aaf => logger.info(`* ${aaf}`));
    }
    const wantToValidateContents = readlineSync.keyInYNStrict(
      `Would you like to validate ${fileText}?`
    );
    if (wantToValidateContents) {
      const providerReferences = await validateTocContents(
        locations.inNetwork ?? [],
        locations.allowedAmount ?? [],
        schemaManager,
        dockerManager,
        outputPath
      );
      return providerReferences;
    }
  }
  return [];
}

export async function validateTocContents(
  inNetwork: string[],
  allowedAmount: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  outputPath: string
): Promise<string[]> {
  temp.track();
  let tempOutput = '';
  if (outputPath?.length > 0) {
    tempOutput = path.join(temp.mkdirSync('contents'), 'contained-result');
  }
  const providerReferences: Set<string> = new Set<string>();
  if (inNetwork.length > 0) {
    await schemaManager.useSchema('in-network-rates').then(async schemaPath => {
      if (schemaPath != null) {
        for (const dataUrl of inNetwork) {
          try {
            if (await checkDataUrl(dataUrl)) {
              logger.info(`File: ${dataUrl}`);
              const dataPath = await downloadDataFile(dataUrl, temp.mkdirSync());
              if (typeof dataPath === 'string') {
                const containedResult = await dockerManager.runContainer(
                  schemaPath,
                  'in-network-rates',
                  dataPath,
                  tempOutput
                );
                if (
                  containedResult.pass &&
                  containedResult.locations?.providerReference?.length > 0
                ) {
                  containedResult.locations.providerReference.forEach(prf =>
                    providerReferences.add(prf)
                  );
                }
                if (tempOutput.length > 0) {
                  appendResults(tempOutput, outputPath, `${dataUrl} - in-network${EOL}`);
                }
              }
            } else {
              logger.error(`Could not download file: ${dataUrl}`);
            }
          } catch (err) {
            logger.error('Problem validating referenced in-network file', err);
          }
        }
      } else {
        logger.error('No schema available - not validating.');
      }
    });
  }
  if (allowedAmount.length > 0) {
    await schemaManager.useSchema('allowed-amounts').then(async schemaPath => {
      if (schemaPath != null) {
        for (const dataUrl of allowedAmount) {
          try {
            if (await checkDataUrl(dataUrl)) {
              logger.info(`File: ${dataUrl}`);
              const dataPath = await downloadDataFile(dataUrl, temp.mkdirSync());
              if (typeof dataPath === 'string') {
                const containedResult = await dockerManager.runContainer(
                  schemaPath,
                  'allowed-amounts',
                  dataPath,
                  tempOutput
                );
                if (tempOutput.length > 0) {
                  appendResults(tempOutput, outputPath, `${dataUrl} - allowed-amounts${EOL}`);
                }
              }
            } else {
              logger.error(`Could not download file: ${dataUrl}`);
            }
          } catch (err) {
            logger.error('Problem validating referenced allowed-amounts file', err);
          }
        }
      } else {
        logger.error('No schema available - not validating.');
      }
    });
  }
  return [...providerReferences.values()];
}

export async function assessReferencedProviders(
  providerReferences: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  outputPath: string
) {
  if (providerReferences.length > 0) {
    const fileText = providerReferences.length === 1 ? 'this file' : 'these files';
    if (providerReferences.length === 1) {
      logger.info(`In-network file(s) refer to ${fileText}:`);
      logger.info('== Provider Reference ==');
      providerReferences.forEach(prf => logger.info(`* ${prf}`));
      const wantToValidateProviders = readlineSync.keyInYNStrict(
        `Would you like to validate ${fileText}?`
      );
      if (wantToValidateProviders) {
        await validateReferencedProviders(
          providerReferences,
          schemaManager,
          dockerManager,
          outputPath
        );
      }
    }
  }
}

export async function validateReferencedProviders(
  providerReferences: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  outputPath: string
) {
  temp.track();
  let tempOutput = '';
  if (outputPath?.length > 0) {
    tempOutput = path.join(temp.mkdirSync('providers'), 'contained-result');
  }
  if (providerReferences.length > 0) {
    schemaManager.useSchema('provider-reference').then(async schemaPath => {
      if (schemaPath != null) {
        for (const dataUrl of providerReferences) {
          try {
            if (await checkDataUrl(dataUrl)) {
              logger.info(`File: ${dataUrl}`);
              const dataPath = await downloadDataFile(dataUrl, temp.mkdirSync());
              if (typeof dataPath === 'string') {
                const containedResult = await dockerManager.runContainer(
                  schemaPath,
                  'provider-reference',
                  dataPath,
                  tempOutput
                );
                if (tempOutput.length > 0) {
                  appendResults(tempOutput, outputPath, `${dataUrl} - provider-reference${EOL}`);
                }
              }
            } else {
              logger.error(`Could not download file: ${dataUrl}`);
            }
          } catch (err) {
            logger.error('Problem validating referenced provider-reference file', err);
          }
        }
      } else {
        logger.error('No schema available - not validating.');
      }
    });
  }
}
