import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import { OptionValues } from 'commander';

import { config, runContainer, useRepoVersion, downloadDataFile, checkDataUrl } from './utils';
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
      return useRepoVersion(schemaVersion, options.target).then(async schemaPath => {
        if (schemaPath != null) {
          const dataFile = await downloadDataFile(dataUrl, temp.mkdirSync());
          return await runContainer(schemaPath, dataFile, options.out);
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
