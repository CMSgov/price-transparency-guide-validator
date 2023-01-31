import validatorUtils from 'util';
import axios from 'axios';
import readlineSync from 'readline-sync';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import temp from 'temp';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

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
    return validatorUtils.promisify(exec)(`git clone ${config.SCHEMA_REPO_URL} "${repoDirectory}"`);
  }
}

export async function useRepoVersion(schemaVersion: string, schemaName: string, strict = false) {
  try {
    await ensureRepo(config.SCHEMA_REPO_FOLDER);
    const tagResult = await validatorUtils.promisify(exec)(
      `git -C "${config.SCHEMA_REPO_FOLDER}" tag --list --sort=taggerdate`
    );
    const tags = tagResult.stdout
      .split('\n')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    if (tags.includes(schemaVersion)) {
      await validatorUtils.promisify(exec)(
        `git -C "${config.SCHEMA_REPO_FOLDER}" checkout ${schemaVersion}`
      );
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
  outputPath: string,
  containerId: string
): string {
  // figure out mount for schema file
  const absoluteSchemaPath = path.resolve(schemaPath);
  const schemaDir = path.dirname(absoluteSchemaPath);
  const schemaFile = path.basename(absoluteSchemaPath);
  // figure out mount for data file
  const absoluteDataPath = path.resolve(dataPath);
  const dataDir = path.dirname(absoluteDataPath);
  const dataFile = path.basename(absoluteDataPath);
  // figure out mount for output file, if provided
  let outputDir, outputFile;
  if (outputPath?.length > 0) {
    const absoluteOutputPath = path.resolve(outputPath);
    outputDir = path.dirname(absoluteOutputPath);
    outputFile = path.basename(absoluteOutputPath);
  }
  if (outputDir && outputFile) {
    return `docker run --rm -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ -v "${outputDir}":/output/ ${containerId} "schema/${schemaFile}" "data/${dataFile}" -o "output/${outputFile}"`;
  } else {
    return `docker run --rm -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ ${containerId} "schema/${schemaFile}" "data/${dataFile}"`;
  }
}

export async function runContainer(schemaPath: string, dataPath: string, outputPath: string) {
  try {
    const containerId = await validatorUtils
      .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
      .then(result => result.stdout.trim())
      .catch(reason => {
        console.log(reason.stderr);
        return '';
      });
    if (containerId.length > 0) {
      const runCommand = buildRunCommand(schemaPath, dataPath, outputPath, containerId);
      return validatorUtils
        .promisify(exec)(runCommand)
        .then(result => {
          console.log(result.stdout);
        })
        .catch(reason => {
          console.log(reason.stdout);
          console.log(reason.stderr);
          process.exitCode = 1;
        });
    } else {
      console.log('Could not find a validator docker container.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(`Error when running validator container: ${error}`);
    process.exitCode = 1;
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
        `Received unsuccessful status code ${response.status} when checking data file URL.`
      );
      return false;
    }
  } catch (e) {
    console.log('Request failed when checking data file URL.');
    console.log(e.message);
    return false;
  }
}

export async function downloadDataFile(url: string, folder: string): Promise<string> {
  const filenameGuess = 'data.json';
  const dataPath = path.join(folder, filenameGuess);
  return new Promise((resolve, reject) => {
    console.log('Beginning download...');
    axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    })
      .then(response => {
        const outputStream = fs.createWriteStream(dataPath);
        outputStream.on('finish', () => {
          console.log('Download complete.');
          resolve(dataPath);
        });
        outputStream.on('error', () => {
          reject('Error writing downloaded file.');
        });
        const contentType = response.headers['content-type'];
        console.log('content type', contentType);
        if (isGzip(contentType)) {
          pipeline(response.data, createGunzip(), outputStream);
        } else {
          response.data.pipe(outputStream);
        }
      })
      .catch(reason => {
        reject('Error downloading data file.');
      });
  });
}

function isGzip(contentType: string): boolean {
  return contentType === 'application/gzip' || contentType === 'application/x-gzip';
}
