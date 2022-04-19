#!/usr/bin/env node

import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import { program, OptionValues, Option } from 'commander';
import fs from 'fs-extra';

import { config, runContainer, useRepoVersion } from './utils';

main().catch(error => {
  console.log(`Encountered an unexpected error: ${error}`);
});

async function main() {
  program
    .name('cms-mrf-validator')
    .description('Tool for validating health coverage machine-readable files.')
    .command('validate')
    .description('Validate a file against a specific published version of a CMS schema.')
    .usage('<data-file> <schema-version> [options]')
    .argument('<data-file>', 'path to data file to validate')
    .argument('<schema-version>', 'version of schema to use for validation')
    .option('-o, --out <out>', 'output path')
    .addOption(
      new Option('-t, --target <schema>', 'name of schema to use')
        .choices(config.AVAILABLE_SCHEMAS)
        .default('in-network-rates')
    )
    .action(validate);

  program
    .command('update')
    .description('Update the available schemas from the CMS repository.')
    .action(update);

  program.parseAsync(process.argv);
}

async function validate(dataFile: string, schemaVersion: string, options: OptionValues) {
    // check to see if supplied json file exists
    if (!fs.existsSync(dataFile)) {
      console.log(`Could not find data file: ${dataFile}`);
      return;
    }
  // get the schema that matches the chosen version and target name. then, use it to validate.
  useRepoVersion(schemaVersion, options.target).then(schemaPath => {
    if (schemaPath != null) {
      runContainer(schemaPath, dataFile, options.out);
    } else {
      console.log('No schema available - not validating.');
    }
  });
}

async function update() {
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
