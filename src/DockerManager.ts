import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import temp from 'temp';
import { logger } from './logger';

export class DockerManager {
  containerId = '';
  processedUrls: { uri: string; schema: string }[] = [];

  constructor(public outputPath = './') {}

  private async initContainerId(): Promise<void> {
    this.containerId = await util
      .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
      .then(result => result.stdout.trim())
      .catch(reason => {
        logger.error(reason.stderr);
        return '';
      });
  }

  async runContainer(
    schemaPath: string,
    schemaName: string,
    dataPath: string,
    dataUri: string
  ): Promise<ContainerResult> {
    try {
      if (this.containerId.length === 0) {
        await this.initContainerId();
      }
      if (this.containerId.length > 0) {
        // make temp dir for output
        temp.track();
        const outputDir = temp.mkdirSync('output');
        const containerOutputPath = path.join(outputDir, 'output.txt');
        const containerReportsPath = path.join(outputDir, 'reports.json');
        // copy output files after it finishes
        const runCommand = this.buildRunCommand(schemaPath, dataPath, outputDir, schemaName);
        logger.info('Running validator container...');
        logger.debug(runCommand);
        return util
          .promisify(exec)(runCommand)
          .then(() => {
            this.processedUrls.push({ uri: dataUri, schema: schemaName });
            const containerResult: ContainerResult = { pass: true };
            if (fs.existsSync(containerOutputPath)) {
              if (this.outputPath) {
                fs.copySync(
                  containerOutputPath,
                  path.join(this.outputPath, `output${this.processedUrls.length}.txt`)
                );
              } else {
                const outputText = fs.readFileSync(containerOutputPath, 'utf-8');
                logger.info(outputText);
              }
            }
            if (fs.existsSync(containerReportsPath)) {
              if (this.outputPath) {
                fs.copySync(
                  containerReportsPath,
                  path.join(this.outputPath, `reports${this.processedUrls.length}.json`)
                );
              }
              try {
                if (schemaName === 'table-of-contents') {
                  // if key ends with .allowed_amount_file: it's an object, grab .location
                  // if key ends with .in_network_files: it's an array, foreach grab .location
                  const reports = fs.readJsonSync(containerReportsPath);
                  containerResult.locations = { allowedAmount: [], inNetwork: [] };
                  Object.keys(reports).forEach((key: string) => {
                    if (key.endsWith('.allowed_amount_file') && reports[key].location != null) {
                      containerResult.locations.allowedAmount.push(reports[key].location);
                    } else if (key.endsWith('.in_network_files')) {
                      reports[key]?.forEach((inNetwork: any) => {
                        if (inNetwork?.location != null) {
                          containerResult.locations.inNetwork.push(inNetwork.location);
                        }
                      });
                    }
                  });
                } else if (schemaName === 'in-network-rates') {
                  // if key ends with .location: it's a string, grab it
                  const reports = fs.readJsonSync(containerReportsPath);
                  containerResult.locations = { providerReference: [] };
                  Object.keys(reports).forEach((key: string) => {
                    if (key.endsWith('.location')) {
                      containerResult.locations.providerReference.push(reports[key]);
                    }
                  });
                }
              } catch (err) {
                // don't know either
              }
            }
            return containerResult;
          })
          .catch((..._zagwo) => {
            this.processedUrls.push({ uri: dataUri, schema: schemaName });
            if (fs.existsSync(containerOutputPath)) {
              if (this.outputPath) {
                fs.copySync(
                  containerOutputPath,
                  path.join(this.outputPath, `output${this.processedUrls.length}.txt`)
                );
              } else {
                const outputText = fs.readFileSync(containerOutputPath, 'utf-8');
                logger.info(outputText);
              }
            }
            process.exitCode = 1;
            return { pass: false };
          });
      } else {
        logger.error('Could not find a validator docker container.');
        process.exitCode = 1;
        return { pass: false };
      }
    } catch (error) {
      logger.error(`Error when running validator container: ${error}`);
      process.exitCode = 1;
      return { pass: false };
    }
  }

  buildRunCommand(
    schemaPath: string,
    dataPath: string,
    outputDir: string,
    schemaName: string
  ): string {
    // figure out mount for schema file
    const absoluteSchemaPath = path.resolve(schemaPath);
    const schemaDir = path.dirname(absoluteSchemaPath);
    const schemaFile = path.basename(absoluteSchemaPath);
    // figure out mount for data file
    const absoluteDataPath = path.resolve(dataPath);
    const dataDir = path.dirname(absoluteDataPath);
    const dataFile = path.basename(absoluteDataPath);
    return `docker run --rm -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ -v "${path.resolve(
      outputDir
    )}":/output/ ${
      this.containerId
    } "schema/${schemaFile}" "data/${dataFile}" "output/" -s ${schemaName}`;
  }
}

export type ContainerResult = {
  pass: boolean;
  text?: string;
  locations?: {
    inNetwork?: string[];
    allowedAmount?: string[];
    providerReference?: string[];
  };
};
