import readlineSync from 'readline-sync';
import path from 'path';
import fs from 'fs-extra';
import temp from 'temp';
import yauzl from 'yauzl';
import { EOL } from 'os';
import { DockerManager } from './DockerManager';
import { SchemaManager } from './SchemaManager';
import { logger } from './logger';
import { DownloadManager } from './DownloadManager';

export type ZipContents = {
  zipFile: yauzl.ZipFile;
  jsonEntries: yauzl.Entry[];
  dataPath: string;
};

export const config = {
  AVAILABLE_SCHEMAS: [
    'allowed-amounts',
    'in-network-rates',
    'provider-reference',
    'table-of-contents'
  ],
  SCHEMA_REPO_URL: 'https://github.com/CMSgov/price-transparency-guide.git',
  SCHEMA_REPO_FOLDER: path.normalize(path.join(__dirname, '..', 'schema-repo'))
};

type ContainerResult = {
  pass: boolean;
  locations?: {
    inNetwork?: string[];
    allowedAmount?: string[];
    providerReference?: string[];
  };
};

export async function getEntryFromZip(
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
  dataPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (err, readStream) => {
      if (err) {
        reject(err);
      } else {
        const outputStream = fs.createWriteStream(dataPath);
        outputStream.on('finish', () => {
          // keep the zipFile open for now, in case we want more entries
          resolve();
        });
        outputStream.on('error', () => {
          zipFile.close();
          reject('Error writing chosen file.');
        });
        readStream.pipe(outputStream);
      }
    });
  });
}

export function isGzip(contentType: string, url: string): boolean {
  return (
    contentType === 'application/gzip' ||
    contentType === 'application/x-gzip' ||
    (contentType === 'application/octet-stream' && /\.gz(\?|$)/.test(url))
  );
}

export function isZip(contentType: string, url: string): boolean {
  return (
    contentType === 'application/zip' || /\.zip(\?|$)/.test(url)
  );
}

export function chooseJsonFile(entries: yauzl.Entry[]): yauzl.Entry {
  // there might be a lot of entries. show ten per page of results
  logger.info(`${entries.length} JSON files found within ZIP archive.`);
  const maxPage = Math.floor((entries.length - 1) / 10);
  let currentPage = 0;
  let chosenIndex: number;

  showMenuOptions(
    currentPage,
    maxPage,
    entries.slice(currentPage * 10, currentPage * 10 + 10).map(ent => ent.fileName)
  );
  readlineSync.promptCLLoop((command, ...extraArgs) => {
    if (/^n(ext)?$/i.test(command)) {
      if (currentPage < maxPage) {
        currentPage++;
      } else {
        logger.menu('Already at last page.');
      }
    } else if (/^p(revious)?$/i.test(command)) {
      if (currentPage > 0) {
        currentPage--;
      } else {
        logger.menu('Already at first page.');
      }
    } else if (/^go?$/i.test(command)) {
      const targetPage = parseInt(extraArgs[0]);
      if (targetPage > 0 && targetPage <= maxPage + 1) {
        currentPage = targetPage - 1;
      } else {
        logger.menu("Can't go to that page.");
      }
    } else if (/^\d$/.test(command)) {
      chosenIndex = currentPage * 10 + parseInt(command);
      logger.menu(`You selected: ${entries[chosenIndex].fileName}`);
      return true;
    } else {
      logger.menu('Unrecognized command.');
    }
    showMenuOptions(
      currentPage,
      maxPage,
      entries.slice(currentPage * 10, (currentPage + 1) * 10).map(ent => ent.fileName)
    );
  });
  return entries[chosenIndex];
}

function showMenuOptions(currentPage: number, maxPage: number, items: string[]) {
  logger.menu(`Showing page ${currentPage + 1} of ${maxPage + 1}`);
  items.forEach((item, idx) => {
    logger.menu(`(${idx}): ${item}`);
  });
  const commandsToShow: string[] = [];
  if (currentPage > 0) {
    commandsToShow.push('(p)revious page');
  }
  if (currentPage < maxPage) {
    commandsToShow.push('(n)ext page');
  }
  if (maxPage > 0) {
    commandsToShow.push('"(g)o X" to jump to a page');
  }
  logger.menu(commandsToShow.join(' | '));
}

export function appendResults(source: string, destination: string, prefixData: string = '') {
  try {
    const sourceData = fs.readFileSync(source);
    fs.appendFileSync(destination, `${prefixData}${sourceData}`);
  } catch (err) {
    logger.error('Problem copying results to output file', err);
  }
}

export async function assessTocContents(
  locations: ContainerResult['locations'],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager
): Promise<string[]> {
  const totalFileCount =
    (locations?.inNetwork?.length ?? 0) + (locations?.allowedAmount?.length ?? 0);
  const fileText = totalFileCount === 1 ? 'this file' : 'these files';
  if (totalFileCount > 0) {
    logger.info(`Table of contents refers to ${fileText}:`);
    if (locations.inNetwork?.length > 0) {
      logger.info('== In-Network Rates ==');
      locations.inNetwork.forEach(inf => logger.info(`* ${inf}`));
    }
    if (locations.allowedAmount?.length > 0) {
      logger.info('== Allowed Amounts ==');
      locations.allowedAmount.forEach(aaf => logger.info(`* ${aaf}`));
    }
    const wantToValidateContents =
      downloadManager.alwaysYes ||
      readlineSync.keyInYNStrict(`Would you like to validate ${fileText}?`);
    if (wantToValidateContents) {
      const providerReferences = await validateTocContents(
        locations.inNetwork ?? [],
        locations.allowedAmount ?? [],
        schemaManager,
        dockerManager,
        downloadManager
      );
      return providerReferences;
    }
  }
  return [];
}

export async function validateTocContents(
  inNetwork: string[],
  allowedAmount: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager
): Promise<string[]> {
  temp.track();
  let tempOutput = '';
  if (dockerManager.outputPath?.length > 0) {
    tempOutput = path.join(temp.mkdirSync('contents'), 'contained-result');
  }
  let providerReferences: Set<string>;
  if (inNetwork.length > 0) {
    if (schemaManager.shouldDetectVersion) {
      providerReferences = await validateInNetworkDetectedVersion(
        inNetwork,
        schemaManager,
        dockerManager,
        downloadManager,
        tempOutput
      );
    } else {
      providerReferences = await validateInNetworkFixedVersion(
        inNetwork,
        schemaManager,
        dockerManager,
        downloadManager,
        tempOutput
      );
    }
  }
  if (allowedAmount.length > 0) {
    if (schemaManager.shouldDetectVersion) {
      await validateAllowedAmountsDetectedVersion(
        allowedAmount,
        schemaManager,
        dockerManager,
        downloadManager,
        tempOutput
      );
    } else {
      await validateAllowedAmountsFixedVersion(
        allowedAmount,
        schemaManager,
        dockerManager,
        downloadManager,
        tempOutput
      );
    }
  }
  return [...providerReferences.values()];
}

async function validateInNetworkFixedVersion(
  inNetwork: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager,
  tempOutput: string
) {
  const providerReferences: Set<string> = new Set<string>();
  await schemaManager.useSchema('in-network-rates').then(async schemaPath => {
    if (schemaPath != null) {
      for (const dataUrl of inNetwork) {
        try {
          if (await downloadManager.checkDataUrl(dataUrl)) {
            logger.info(`File: ${dataUrl}`);
            const dataPath = await downloadManager.downloadDataFile(dataUrl);
            if (typeof dataPath === 'string') {
              // check if detected version matches the provided version
              // if there's no version property, that's ok
              await schemaManager
                .determineVersion(dataPath)
                .then(detectedVersion => {
                  if (detectedVersion != schemaManager.version) {
                    logger.warn(
                      `Schema version ${schemaManager.version} was provided, but file indicates it conforms to schema version ${detectedVersion}. ${schemaManager.version} will be used.`
                    );
                  }
                })
                .catch(() => {});
              const containedResult = await dockerManager.runContainer(
                schemaPath,
                'in-network-rates',
                dataPath,
                tempOutput
              );
              if (
                containedResult.pass &&
                containedResult.locations?.providerReference?.length > 0
              ) {
                containedResult.locations.providerReference.forEach(prf =>
                  providerReferences.add(prf)
                );
              }
              if (tempOutput.length > 0) {
                appendResults(
                  tempOutput,
                  dockerManager.outputPath,
                  `${dataUrl} - in-network${EOL}`
                );
              }
            }
          } else {
            logger.error(`Could not download file: ${dataUrl}`);
          }
        } catch (err) {
          logger.error('Problem validating referenced in-network file', err);
        }
      }
    } else {
      logger.error('No schema available - not validating.');
    }
  });
  return providerReferences;
}

async function validateInNetworkDetectedVersion(
  inNetwork: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager,
  tempOutput: string
) {
  const providerReferences: Set<string> = new Set<string>();
  for (const dataUrl of inNetwork) {
    try {
      if (await downloadManager.checkDataUrl(dataUrl)) {
        logger.info(`File: ${dataUrl}`);
        const dataPath = await downloadManager.downloadDataFile(dataUrl);
        if (typeof dataPath === 'string') {
          const versionToUse = await schemaManager.determineVersion(dataPath);
          await schemaManager
            .useVersion(versionToUse)
            .then(versionIsAvailable => {
              if (versionIsAvailable) {
                return schemaManager.useSchema('in-network-rates');
              } else {
                return null;
              }
            })
            .then(schemaPath => {
              if (schemaPath != null) {
                return dockerManager.runContainer(
                  schemaPath,
                  'in-network-rates',
                  dataPath,
                  tempOutput
                );
              }
            })
            .then(containedResult => {
              if (
                containedResult.pass &&
                containedResult.locations?.providerReference?.length > 0
              ) {
                containedResult.locations.providerReference.forEach(prf =>
                  providerReferences.add(prf)
                );
              }
              if (tempOutput.length > 0) {
                appendResults(
                  tempOutput,
                  dockerManager.outputPath,
                  `${dataUrl} - in-network${EOL}`
                );
              }
            });
        }
      }
    } catch (err) {
      logger.error('Problem validating referenced in-network file', err);
    }
  }
  return providerReferences;
}

async function validateAllowedAmountsFixedVersion(
  allowedAmount: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager,
  tempOutput: string
) {
  await schemaManager.useSchema('allowed-amounts').then(async schemaPath => {
    if (schemaPath != null) {
      for (const dataUrl of allowedAmount) {
        try {
          if (await downloadManager.checkDataUrl(dataUrl)) {
            logger.info(`File: ${dataUrl}`);
            const dataPath = await downloadManager.downloadDataFile(dataUrl);
            if (typeof dataPath === 'string') {
              // check if detected version matches the provided version
              // if there's no version property, that's ok
              await schemaManager
                .determineVersion(dataPath)
                .then(detectedVersion => {
                  if (detectedVersion != schemaManager.version) {
                    logger.warn(
                      `Schema version ${schemaManager.version} was provided, but file indicates it conforms to schema version ${detectedVersion}. ${schemaManager.version} will be used.`
                    );
                  }
                })
                .catch(() => {});
              await dockerManager.runContainer(schemaPath, 'allowed-amounts', dataPath, tempOutput);
              if (tempOutput.length > 0) {
                appendResults(
                  tempOutput,
                  dockerManager.outputPath,
                  `${dataUrl} - allowed-amounts${EOL}`
                );
              }
            }
          } else {
            logger.error(`Could not download file: ${dataUrl}`);
          }
        } catch (err) {
          logger.error('Problem validating referenced allowed-amounts file', err);
        }
      }
    } else {
      logger.error('No schema available - not validating.');
    }
  });
}

async function validateAllowedAmountsDetectedVersion(
  allowedAmount: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager,
  tempOutput: string
) {
  for (const dataUrl of allowedAmount) {
    try {
      if (await downloadManager.checkDataUrl(dataUrl)) {
        logger.info(`File: ${dataUrl}`);
        const dataPath = await downloadManager.downloadDataFile(dataUrl);
        if (typeof dataPath === 'string') {
          const versionToUse = await schemaManager.determineVersion(dataPath);
          await schemaManager
            .useVersion(versionToUse)
            .then(versionIsAvailable => {
              if (versionIsAvailable) {
                return schemaManager.useSchema('allowed-amounts');
              } else {
                return null;
              }
            })
            .then(schemaPath => {
              if (schemaPath != null) {
                return dockerManager.runContainer(
                  schemaPath,
                  'allowed-amounts',
                  dataPath,
                  tempOutput
                );
              }
            })
            .then(_containedResult => {
              if (tempOutput.length > 0) {
                appendResults(
                  tempOutput,
                  dockerManager.outputPath,
                  `${dataUrl} - allowed-amounts${EOL}`
                );
              }
            });
        }
      }
    } catch (err) {
      logger.error('Problem validating referenced allowed-amounts file', err);
    }
  }
}

export async function assessReferencedProviders(
  providerReferences: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager
) {
  if (providerReferences.length > 0) {
    const fileText = providerReferences.length === 1 ? 'this file' : 'these files';
    if (providerReferences.length === 1) {
      logger.info(`In-network file(s) refer to ${fileText}:`);
      logger.info('== Provider Reference ==');
      providerReferences.forEach(prf => logger.info(`* ${prf}`));
      const wantToValidateProviders =
        downloadManager.alwaysYes ||
        readlineSync.keyInYNStrict(`Would you like to validate ${fileText}?`);
      if (wantToValidateProviders) {
        await validateReferencedProviders(
          providerReferences,
          schemaManager,
          dockerManager,
          downloadManager
        );
      }
    }
  }
}

export async function validateReferencedProviders(
  providerReferences: string[],
  schemaManager: SchemaManager,
  dockerManager: DockerManager,
  downloadManager: DownloadManager
) {
  temp.track();
  let tempOutput = '';
  if (dockerManager.outputPath?.length > 0) {
    tempOutput = path.join(temp.mkdirSync('providers'), 'contained-result');
  }
  if (providerReferences.length > 0) {
    schemaManager.useSchema('provider-reference').then(async schemaPath => {
      if (schemaPath != null) {
        for (const dataUrl of providerReferences) {
          try {
            if (await downloadManager.checkDataUrl(dataUrl)) {
              logger.info(`File: ${dataUrl}`);
              const dataPath = await downloadManager.downloadDataFile(dataUrl);
              if (typeof dataPath === 'string') {
                const containedResult = await dockerManager.runContainer(
                  schemaPath,
                  'provider-reference',
                  dataPath,
                  tempOutput
                );
                if (tempOutput.length > 0) {
                  appendResults(
                    tempOutput,
                    dockerManager.outputPath,
                    `${dataUrl} - provider-reference${EOL}`
                  );
                }
              }
            } else {
              logger.error(`Could not download file: ${dataUrl}`);
            }
          } catch (err) {
            logger.error('Problem validating referenced provider-reference file', err);
          }
        }
      } else {
        logger.error('No schema available - not validating.');
      }
    });
  }
}
