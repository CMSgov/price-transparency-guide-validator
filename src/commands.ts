import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { OptionValues } from 'commander';

import {
  config,
  downloadDataFile,
  checkDataUrl,
  chooseJsonFile,
  getEntryFromZip,
  assessTocContents,
  assessReferencedProviders
} from './utils';
import temp from 'temp';
import { SchemaManager } from './SchemaManager';
import { DockerManager } from './DockerManager';
import { logger } from './logger';

export async function validate(dataFile: string, options: OptionValues) {
  // check to see if supplied json file exists
  if (!fs.existsSync(dataFile)) {
    logger.error(`Could not find data file: ${dataFile}`);
    process.exitCode = 1;
    return;
  }
  const schemaManager = new SchemaManager();
  await schemaManager.ensureRepo();
  schemaManager.strict = options.strict;
  schemaManager.shouldDetectVersion = options.schemaVersion == null;
  let versionToUse: string;
  try {
    const detectedVersion = await schemaManager.determineVersion(dataFile);
    if (!schemaManager.shouldDetectVersion && detectedVersion != options.schemaVersion) {
      logger.warn(
        `Schema version ${options.schemaVersion} was provided, but file indicates it conforms to schema version ${detectedVersion}. ${options.schemaVersion} will be used.`
      );
    }
    versionToUse = schemaManager.shouldDetectVersion ? detectedVersion : options.schemaVersion;
  } catch (err) {
    if (!schemaManager.shouldDetectVersion) {
      versionToUse = options.schemaVersion;
    } else {
      // or maybe use the minimum.
      logger.error(
        'Data file does not contain version information. Please run again using the --schema-version option to specify a version.'
      );
      process.exitCode = 1;
      return;
    }
  }
  return schemaManager
    .useVersion(versionToUse)
    .then(versionIsAvailable => {
      if (versionIsAvailable) {
        return schemaManager.useSchema(options.target);
      }
    })
    .then(async schemaPath => {
      temp.track();
      if (schemaPath != null) {
        const dockerManager = new DockerManager();
        const containerResult = await dockerManager.runContainer(
          schemaPath,
          options.target,
          dataFile,
          options.out
        );
        if (containerResult.pass) {
          if (options.target === 'table-of-contents') {
            const providerReferences = await assessTocContents(
              containerResult.locations,
              schemaManager,
              dockerManager,
              options.out
            );
            await assessReferencedProviders(
              providerReferences,
              schemaManager,
              dockerManager,
              options.out
            );
          } else if (
            options.target === 'in-network-rates' &&
            containerResult.locations?.providerReference?.length > 0
          ) {
            await assessReferencedProviders(
              containerResult.locations.providerReference,
              schemaManager,
              dockerManager,
              options.out
            );
          }
        }
      } else {
        logger.error('No schema available - not validating.');
        process.exitCode = 1;
      }
      temp.cleanupSync();
    });
}

export async function validateFromUrl(dataUrl: string, options: OptionValues) {
  temp.track();
  if (await checkDataUrl(dataUrl)) {
    const schemaManager = new SchemaManager();
    await schemaManager.ensureRepo();
    schemaManager.strict = options.strict;
    return schemaManager
      .useVersion(options.schemaVersion)
      .then(versionIsAvailable => {
        if (versionIsAvailable) {
          return schemaManager.useSchema(options.target);
        }
      })
      .then(async schemaPath => {
        if (schemaPath != null) {
          const dockerManager = new DockerManager();
          const dataFile = await downloadDataFile(dataUrl, temp.mkdirSync());
          if (typeof dataFile === 'string') {
            const containerResult = await dockerManager.runContainer(
              schemaPath,
              options.target,
              dataFile,
              options.out
            );
            if (containerResult.pass) {
              if (options.target === 'table-of-contents') {
                const providerReferences = await assessTocContents(
                  containerResult.locations,
                  schemaManager,
                  dockerManager,
                  options.out
                );
                await assessReferencedProviders(
                  providerReferences,
                  schemaManager,
                  dockerManager,
                  options.out
                );
              } else if (
                options.target === 'in-network-rates' &&
                containerResult.locations?.providerReference?.length > 0
              ) {
                await assessReferencedProviders(
                  containerResult.locations.providerReference,
                  schemaManager,
                  dockerManager,
                  options.out
                );
              }
            }
            return containerResult;
          } else {
            let continuation = true;
            // we have multiple files, so let's choose as many as we want
            while (continuation === true) {
              const chosenEntry = chooseJsonFile(dataFile.jsonEntries);
              await getEntryFromZip(dataFile.zipFile, chosenEntry, dataFile.dataPath);
              await dockerManager.runContainer(
                schemaPath,
                options.target,
                dataFile.dataPath,
                options.out
              );
              continuation = readlineSync.keyInYNStrict(
                'Would you like to validate another file in the ZIP?'
              );
            }
            dataFile.zipFile.close();
          }
        } else {
          logger.error('No schema available - not validating.');
          process.exitCode = 1;
        }
      });
  } else {
    logger.info('Exiting.');
    process.exitCode = 1;
  }
}

export async function update() {
  try {
    // check if the repo exists. if not, clone it. if it exists, fetch updates.
    if (!fs.existsSync(path.join(config.SCHEMA_REPO_FOLDER, '.git'))) {
      await util.promisify(exec)(
        `git clone ${config.SCHEMA_REPO_URL} "${config.SCHEMA_REPO_FOLDER}"`
      );
      logger.info('Retrieved schemas.');
    } else {
      await util.promisify(exec)(
        `git -C "${config.SCHEMA_REPO_FOLDER}" checkout master && git -C "${config.SCHEMA_REPO_FOLDER}" pull --no-rebase -t`
      );
      logger.info('Updated schemas.');
    }
  } catch (error) {
    logger.error(`Error when updating available schemas: ${error}`);
    process.exitCode = 1;
  }
}
