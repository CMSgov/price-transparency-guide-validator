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
import { SchemaManager } from './SchemaManager';

crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION;

export async function validate(dataFile: string, schemaVersion: string, options: OptionValues) {
  // check to see if supplied json file exists
  if (!fs.existsSync(dataFile)) {
    console.log(`Could not find data file: ${dataFile}`);
    process.exitCode = 1;
    return;
  }
  const schemaManager = new SchemaManager();
  await schemaManager.ensureRepo();
  return schemaManager
    .useVersion(schemaVersion)
    .then(versionIsAvailable => {
      if (versionIsAvailable) {
        return schemaManager.useSchema(options.target, options.strict);
      }
    })
    .then(async schemaPath => {
      if (schemaPath != null) {
        const containerResult = await runContainer(
          schemaPath,
          options.target,
          dataFile,
          options.out
        );
        // change this implementation so that we can handle different referenced thigns
        if (containerResult.pass) {
          if (options.target === 'table-of-contents') {
            const totalFileCount =
              (containerResult.locations?.inNetwork?.length ?? 0) +
              (containerResult.locations?.allowedAmount?.length ?? 0);
            const fileText = totalFileCount === 1 ? 'this file' : 'these files';
            if (totalFileCount > 0) {
              console.log(`Table of contents refers to ${fileText}:`);
              if (containerResult.locations.inNetwork?.length > 0) {
                console.log('== In-Network Rates ==');
                containerResult.locations.inNetwork.forEach(inf => console.log(`* ${inf}`));
              }
              if (containerResult.locations.allowedAmount?.length > 0) {
                console.log('== Allowed Amounts ==');
                containerResult.locations.allowedAmount.forEach(aaf => console.log(`* ${aaf}`));
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
                for (const dataUrl of containerResult.locations.inNetwork ?? []) {
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
                for (const dataUrl of containerResult.locations.allowedAmount ?? []) {
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
          } else if (
            options.target === 'in-network-rates' &&
            containerResult.locations?.providerReference?.length > 0
          ) {
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
              return await runContainer(schemaPath, options.target, dataFile, options.out);
            } else {
              let continuation = true;
              // we have multiple files, so let's choose as many as we want
              while (continuation === true) {
                const chosenEntry = chooseJsonFile(dataFile.jsonEntries);
                await getEntryFromZip(dataFile.zipFile, chosenEntry, dataFile.dataPath);
                await runContainer(schemaPath, options.target, dataFile.dataPath, options.out);
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
