import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { OptionValues } from 'commander';
import { EOL } from 'os';

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
import crypto from 'crypto';
import { SchemaManager } from './SchemaManager';
import { DockerManager } from './DockerManager';

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
  schemaManager.strict = options.strict;
  return schemaManager
    .useVersion(schemaVersion)
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
        console.log('No schema available - not validating.');
        process.exitCode = 1;
      }
      temp.cleanupSync();
    });
}

export async function validateFromUrl(
  dataUrl: string,
  schemaVersion: string,
  options: OptionValues
) {
  temp.track();
  if (await checkDataUrl(dataUrl)) {
    const schemaManager = new SchemaManager();
    await schemaManager.ensureRepo();
    schemaManager.strict = options.strict;
    return schemaManager
      .useVersion(schemaVersion)
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
          console.log('No schema available - not validating.');
          process.exitCode = 1;
        }
      });
  } else {
    console.log('Exiting.');
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
