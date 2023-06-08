import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { OptionValues } from 'commander';
import { EOL } from 'os';

import {
  config,
  runContainer,
  useRepoVersion,
  downloadDataFile,
  checkDataUrl,
  chooseJsonFile,
  getEntryFromZip,
  appendResults,
  validateSingleFileFromUrl
} from './utils';
import temp from 'temp';
import crypto from 'crypto';

crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION;

export async function validate(dataFile: string, schemaVersion: string, options: OptionValues) {
  // check to see if supplied json file exists
  if (!fs.existsSync(dataFile)) {
    console.log(`Could not find data file: ${dataFile}`);
    process.exitCode = 1;
    return;
  }
  // get the schema that matches the chosen version and target name. then, use it to validate.
  return useRepoVersion(schemaVersion, options.target, options.strict).then(async schemaPath => {
    if (schemaPath != null) {
      const pass = await runContainer(schemaPath, dataFile, options.out);
      if (options.target === 'table-of-contents' && pass) {
        // try to get the contained files out of a valid table of contents file
        // naive assumption: the file is small enough to just load up
        try {
          const tocData = fs.readJsonSync(dataFile);
          const inNetworkFiles: string[] = [];
          const allowedAmountFiles: string[] = [];
          tocData.reporting_structure.forEach((rs: any) => {
            rs.in_network_files?.forEach((inf: any) => {
              inNetworkFiles.push(inf.location);
            });
            if (rs.allowed_amount_file != null) {
              allowedAmountFiles.push(rs.allowed_amount_file.location);
            }
          });
          const totalFileCount = inNetworkFiles.length + allowedAmountFiles.length;
          const fileText = totalFileCount === 1 ? 'this file' : 'these files';
          if (totalFileCount > 0) {
            console.log(`Table of contents refers to ${fileText}:`);
            if (inNetworkFiles.length > 0) {
              console.log('== In-Network Rates ==');
              inNetworkFiles.forEach(inf => console.log(`* ${inf}`));
            }
            if (allowedAmountFiles.length > 0) {
              console.log('== Allowed Amounts ==');
              allowedAmountFiles.forEach(aaf => console.log(`* ${aaf}`));
            }
            const wantToValidateContents = readlineSync.keyInYNStrict(
              `Would you like to validate ${fileText}?`
            );
            if (wantToValidateContents) {
              // here's where the good stuff can happen
              // if an output file is specified, write to a temp file, then copy to the actual file we're using
              let tempOutput = '';
              if (options.out?.length > 0) {
                tempOutput = path.join(temp.mkdirSync('referenced'), 'contained-result');
              }
              temp.track();
              for (const dataUrl of inNetworkFiles) {
                await validateSingleFileFromUrl(
                  dataUrl,
                  schemaVersion,
                  'in-network-rates',
                  options.strict,
                  tempOutput
                );
                if (tempOutput.length > 0) {
                  appendResults(tempOutput, options.out, `${dataUrl} - in-network${EOL}`);
                }
              }
              for (const dataUrl of allowedAmountFiles) {
                await validateSingleFileFromUrl(
                  dataUrl,
                  schemaVersion,
                  'allowed-amounts',
                  options.strict,
                  tempOutput
                );
                if (tempOutput.length > 0) {
                  appendResults(tempOutput, options.out, `${dataUrl} - allowed amounts${EOL}`);
                }
              }
              temp.cleanupSync();
            }
          }
        } catch (err) {
          console.log('Could not check table of contents file for additional files to validate.');
        }
      }
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
      return useRepoVersion(schemaVersion, options.target, options.strict).then(
        async schemaPath => {
          if (schemaPath != null) {
            const dataFile = await downloadDataFile(dataUrl, temp.mkdirSync());
            if (typeof dataFile === 'string') {
              return await runContainer(schemaPath, dataFile, options.out);
            } else {
              let continuation = true;
              // we have multiple files, so let's choose as many as we want
              while (continuation === true) {
                const chosenEntry = chooseJsonFile(dataFile.jsonEntries);
                await getEntryFromZip(dataFile.zipFile, chosenEntry, dataFile.dataPath);
                await runContainer(schemaPath, dataFile.dataPath, options.out);
                continuation = readlineSync.keyInYNStrict(
                  'Would you like to validate another file in the ZIP?'
                );
              }
              dataFile.zipFile.close();
            }
          } else {
            console.log('No schema available - not validating.');
            process.exitCode = 1;
          }
        }
      );
    } else {
      console.log('Exiting.');
      process.exitCode = 1;
    }
  } finally {
    temp.cleanupSync();
  }
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
