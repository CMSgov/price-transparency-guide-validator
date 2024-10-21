import axios from 'axios';
import readlineSync from 'readline-sync';
import fs from 'fs-extra';
import temp from 'temp';
import path from 'path';
import yauzl from 'yauzl';
import { createGunzip } from 'zlib';
import { ZipContents, isGzip, isZip } from './utils';
import { logger } from './logger';

import { pipeline } from 'stream/promises';

const ONE_MEGABYTE = 1024 * 1024;
const DATA_SIZE_WARNING_THRESHOLD = ONE_MEGABYTE * 1024; // 1 gigabyte

export class DownloadManager {
  folder: string;

  constructor(public alwaysYes = false) {
    temp.track();
    this.folder = temp.mkdirSync();
  }

  async checkDataUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url);
      if (response.status === 200) {
        let proceedToDownload: boolean;
        const contentLength = parseInt(response.headers['content-length']);
        if (this.alwaysYes) {
          proceedToDownload = true;
        } else if (isNaN(contentLength)) {
          proceedToDownload = readlineSync.keyInYNStrict(
            'Data file size is unknown. Download this file?'
          );
        } else if (contentLength > DATA_SIZE_WARNING_THRESHOLD) {
          proceedToDownload = readlineSync.keyInYNStrict(
            `Data file is ${(contentLength / ONE_MEGABYTE).toFixed(
              2
            )} MB in size. Download this file?`
          );
        } else {
          proceedToDownload = true;
        }
        return proceedToDownload;
      } else {
        logger.error(
          `Received unsuccessful status code ${response.status} when checking data file URL: ${url}`
        );
        return false;
      }
    } catch (e) {
      logger.error(`Request failed when checking data file URL: ${url}`);
      logger.error(e.message);
      return false;
    }
  }

  async downloadDataFile(url: string, folder = this.folder): Promise<string | ZipContents> {
    const filenameGuess = 'data.json';
    const dataPath = path.join(folder, filenameGuess);
    return new Promise((resolve, reject) => {
      logger.info('Beginning download...\n');
      axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        onDownloadProgress: progressEvent => {
          if (process.stdout.isTTY) {
            let progressText: string;
            if (progressEvent.progress != null) {
              progressText = `Downloaded ${Math.floor(progressEvent.progress * 100)}% of file (${
                progressEvent.loaded
              } bytes)`;
            } else {
              progressText = `Downloaded ${progressEvent.loaded} bytes`;
            }
            process.stdout.clearLine(0, () => {
              process.stdout.cursorTo(0, () => {
                process.stdout.moveCursor(0, -1, () => {
                  logger.info(progressText);
                });
              });
            });
          }
        }
      })
        .then(response => {
          const contentType = response.headers['content-type'] ?? 'application/octet-stream';
          const finalUrl = response.request.path;
          if (isZip(contentType, finalUrl)) {
            // zips require additional work to find a JSON file inside
            const zipPath = path.join(folder, 'data.zip');
            const zipOutputStream = fs.createWriteStream(zipPath);
            pipeline(response.data, zipOutputStream).then(() => {
              yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (err, zipFile) => {
                if (err != null) {
                  reject(err);
                }
                const jsonEntries: yauzl.Entry[] = [];

                zipFile.on('entry', (entry: yauzl.Entry) => {
                  if (entry.fileName.endsWith('.json')) {
                    jsonEntries.push(entry);
                  }
                  zipFile.readEntry();
                });

                zipFile.on('end', () => {
                  logger.info('Download complete.');
                  if (jsonEntries.length === 0) {
                    reject('No JSON file present in zip.');
                  } else {
                    let chosenEntry: yauzl.Entry;
                    if (jsonEntries.length === 1) {
                      chosenEntry = jsonEntries[0];
                      zipFile.openReadStream(chosenEntry, (err, readStream) => {
                        const outputStream = fs.createWriteStream(dataPath);
                        outputStream.on('finish', () => {
                          zipFile.close();
                          resolve(dataPath);
                        });
                        outputStream.on('error', () => {
                          zipFile.close();
                          reject('Error writing downloaded file.');
                        });
                        readStream.pipe(outputStream);
                      });
                    } else {
                      jsonEntries.sort((a, b) => {
                        return a.fileName.localeCompare(b.fileName);
                      });
                      resolve({ zipFile, jsonEntries, dataPath });
                    }
                  }
                });
                zipFile.readEntry();
              });
            });
          } else {
            const outputStream = fs.createWriteStream(dataPath);
            outputStream.on('finish', () => {
              logger.info('Download complete.');
              resolve(dataPath);
            });
            outputStream.on('error', () => {
              reject('Error writing downloaded file.');
            });

            if (isGzip(contentType, finalUrl)) {
              pipeline(response.data, createGunzip(), outputStream);
            } else {
              response.data.pipe(outputStream);
            }
          }
        })
        .catch(() => {
          reject('Error downloading data file.');
        });
    });
  }
}
