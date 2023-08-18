#!/usr/bin/env node

import { program, Option } from 'commander';
import { validate, update, validateFromUrl } from './commands';
import { config } from './utils';
import { logger } from './logger';

main().catch(error => {
  logger.error(`Encountered an unexpected error: ${error}`);
});

async function main() {
  program
    .name('cms-mrf-validator')
    .description('Tool for validating health coverage machine-readable files.')
    .option('-d, --debug', 'show debug output')
    .hook('preAction', thisCommand => {
      if (thisCommand.opts().debug) {
        logger.level = 'debug';
        logger.debug(process.argv.join(' '));
      }
    })
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
    .option(
      '-s, --strict',
      'enable strict checking, which prohibits additional properties in data file'
    )
    .option('-y, --yes-all', 'automatically respond "yes" to download confirmation prompts')
    .action(validate);

  program
    .command('from-url')
    .description(
      'Validate the file retrieved from a URL against a specific published version of a CMS schema.'
    )
    .usage('<data-url> <schema-version> [options]')
    .argument('<data-url>', 'URL to data file to validate')
    .argument('<schema-version>', 'version of schema to use for validation')
    .option('-o, --out <out>', 'output path')
    .addOption(
      new Option('-t, --target <schema>', 'name of schema to use')
        .choices(config.AVAILABLE_SCHEMAS)
        .default('in-network-rates')
    )
    .option(
      '-s, --strict',
      'enable strict checking, which prohibits additional properties in data file'
    )
    .option('-y, --yes-all', 'automatically respond "yes" to download confirmation prompts')
    .action((dataUrl, schemaVersion, options) => {
      validateFromUrl(dataUrl, schemaVersion, options).then(result => {
        if (result) {
          process.exitCode = 0;
        } else {
          process.exitCode = 1;
        }
      });
    });

  program
    .command('update')
    .description('Update the available schemas from the CMS repository.')
    .action(update);

  program.parseAsync(process.argv);
}
