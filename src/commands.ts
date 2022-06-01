import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import { OptionValues } from 'commander';
import { config, runContainer, useRepoVersion } from './utils';

export async function validate(dataFile: string, schemaVersion: string, options: OptionValues) {
  // check to see if supplied data file exists
  if (!fs.existsSync(dataFile)) {
    console.log(`Could not find data file: ${dataFile}`);
    return;
  }

  const datatype = options.format ?? path.extname(dataFile).substring(1);
  let schemaExtension: string;
  if (datatype === 'xml') {
    schemaExtension = 'xsd';
  } else if (datatype === 'json') {
    schemaExtension = 'json';
  } else {
    console.log('Unrecognized file extension for data file - not validating');
    return;
  }
  // get the schema that matches the chosen version and target name. then, use it to validate.
  await useRepoVersion(schemaVersion, options.target, schemaExtension).then(async schemaPath => {
    if (schemaPath != null) {
      await runContainer(schemaPath, dataFile, options.out, datatype);
    } else {
      console.log('No schema available - not validating.');
    }
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
  }
}
