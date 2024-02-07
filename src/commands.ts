import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { OptionValues } from 'commander';

import {
  config,
  chooseJsonFile,
  getEntryFromZip,
  assessTocContents,
  assessReferencedProviders
} from './utils';
import temp from 'temp';
import { SchemaManager } from './SchemaManager';
import { DockerManager } from './DockerManager';
import { logger } from './logger';
import { DownloadManager } from './DownloadManager';

export async function validate(dataFile: string, options: OptionValues) {
  // check to see if supplied json file exists
  if (!fs.existsSync(dataFile)) {
    logger.error(`Could not find data file: ${dataFile}`);
    process.exitCode = 1;
    return;
  }
  fs.ensureDirSync(options.out);
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
        const dockerManager = new DockerManager(options.out);
        const downloadManager = new DownloadManager(options.yesAll);
        const containerResult = await dockerManager.runContainer(
          schemaPath,
          options.target,
          dataFile,
          `file://${dataFile}`
        );
        if (containerResult.pass || true) {
          if (options.target === 'table-of-contents') {
            const providerReferences = await assessTocContents(
              containerResult.locations,
              schemaManager,
              dockerManager,
              downloadManager
            );
            await assessReferencedProviders(
              providerReferences,
              schemaManager,
              dockerManager,
              downloadManager
            );
          } else if (
            options.target === 'in-network-rates' &&
            containerResult.locations?.providerReference?.length > 0
          ) {
            await assessReferencedProviders(
              containerResult.locations.providerReference,
              schemaManager,
              dockerManager,
              downloadManager
            );
          }
          // make index file
          const indexContents = dockerManager.processedUrls
            .map(({ uri, schema }, index) => `${index + 1}\t\t${schema}\t\t${uri}`)
            .join(os.EOL);
          fs.writeFileSync(path.join(options.out, 'result-index.txt'), indexContents);
        }
      } else {
        logger.error('No schema available - not validating.');
        process.exitCode = 1;
      }
      temp.cleanupSync();
    })
    .catch(err => {
      logger.error(err.message);
      process.exitCode = 1;
    });
}

export async function validateFromUrl(dataUrl: string, options: OptionValues) {
  temp.track();
  fs.ensureDirSync(options.out);
  const downloadManager = new DownloadManager(options.yesAll);
  if (await downloadManager.checkDataUrl(dataUrl)) {
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
          const dockerManager = new DockerManager(options.out);
          const dataFile = await downloadManager.downloadDataFile(dataUrl);
          if (typeof dataFile === 'string') {
            const containerResult = await dockerManager.runContainer(
              schemaPath,
              options.target,
              dataFile,
              dataUrl
            );
            if (containerResult.pass || true) {
              if (options.target === 'table-of-contents') {
                const providerReferences = await assessTocContents(
                  containerResult.locations,
                  schemaManager,
                  dockerManager,
                  downloadManager
                );
                await assessReferencedProviders(
                  providerReferences,
                  schemaManager,
                  dockerManager,
                  downloadManager
                );
              } else if (
                options.target === 'in-network-rates' &&
                containerResult.locations?.providerReference?.length > 0
              ) {
                await assessReferencedProviders(
                  containerResult.locations.providerReference,
                  schemaManager,
                  dockerManager,
                  downloadManager
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
                `${dataUrl}:${chosenEntry.fileName}` // TODO see if this is actually useful
              );
              continuation = readlineSync.keyInYNStrict(
                'Would you like to validate another file in the ZIP?'
              );
            }
            dataFile.zipFile.close();
          }
          // make index file
          const indexContents = dockerManager.processedUrls
            .map(({ uri, schema }, index) => `${index + 1}\t\t${schema}\t\t${uri}`)
            .join(os.EOL);
          fs.writeFileSync(path.join(options.out, 'result-index.txt'), indexContents);
        } else {
          logger.error('No schema available - not validating.');
          process.exitCode = 1;
        }
      })
      .catch(err => {
        logger.error(err.message);
        process.exitCode = 1;
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
