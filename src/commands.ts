import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import { OptionValues } from 'commander';
import axios from 'axios';
import readlineSync from 'readline-sync';
import { config, runContainer, useRepoVersion } from './utils';
import temp from 'temp';
import crypto from 'crypto';
import https from 'https';

crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION;

const ONE_MEGABYTE = 1024 * 1024;
const DATA_SIZE_WARNING_THRESHOLD = ONE_MEGABYTE * 1024; // 1 gigabyte

export async function validate(dataFile: string, schemaVersion: string, options: OptionValues) {
  // check to see if supplied json file exists
  if (!fs.existsSync(dataFile)) {
    console.log(`Could not find data file: ${dataFile}`);
    process.exitCode = 1;
    return;
  }
  // get the schema that matches the chosen version and target name. then, use it to validate.
  useRepoVersion(schemaVersion, options.target, options.strict).then(schemaPath => {
    if (schemaPath != null) {
      runContainer(schemaPath, dataFile, options.out);
    } else {
      console.log('No schema available - not validating.');
      process.exitCode = 1;
    }
  });
}

export async function validateFromUrl(
  dataUrl: string,
  schemaVersion: string,
  options: OptionValues
) {
  temp.track();
  try {
    if (await checkDataUrl(dataUrl)) {
      useRepoVersion(schemaVersion, options.target).then(async schemaPath => {
        if (schemaPath != null) {
          const dataFile = await downloadDataFile(dataUrl, temp.mkdirSync());
          await runContainer(schemaPath, dataFile, options.out);
        } else {
          console.log('No schema available - not validating.');
          process.exitCode = 1;
        }
      });
    } else {
      console.log('Exiting.');
      process.exitCode = 1;
    }
  } finally {
    temp.cleanupSync();
  }
}

async function checkDataUrl(url: string) {
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

async function downloadDataFile(url: string, folder: string): Promise<string> {
  // TODO make a better guess
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
        response.data.pipe(outputStream);
      })
      .catch(reason => {
        reject('Error downloading data file.');
      });
  });
}

export async function update() {
  try {
    // check if the repo exists. if not, clone it. if it exists, fetch updates.
    if (!fs.existsSync(path.join(config.SCHEMA_REPO_FOLDER, '.git'))) {
      await util.promisify(exec)(
        `git clone ${config.SCHEMA_REPO_URL} "${config.SCHEMA_REPO_FOLDER}"`
      );
      console.log('Retrieved schemas.');
    } else {
      await util.promisify(exec)(
        `git -C "${config.SCHEMA_REPO_FOLDER}" checkout master && git -C "${config.SCHEMA_REPO_FOLDER}" pull --no-rebase -t`
      );
      console.log('Updated schemas.');
    }
  } catch (error) {
    console.log(`Error when updating available schemas: ${error}`);
    process.exitCode = 1;
  }
}
