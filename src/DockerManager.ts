import util, { isArray } from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import temp from 'temp';
import { logger } from './logger';

export class DockerManager {
  containerId = '';
  processedUrls: { uri: string; schema: string; size: number }[] = [];

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
        const dataSize = fs.statSync(dataPath).size;
        // copy output files after it finishes
        const runCommand = this.buildRunCommand(schemaPath, dataPath, outputDir, schemaName);
        logger.info('Running validator container...');
        logger.debug(runCommand);
        return util
          .promisify(exec)(runCommand)
          .then(() => {
            this.processedUrls.push({ uri: dataUri, schema: schemaName, size: dataSize });
            const containerResult: ContainerResult = { pass: true, locations: {} };
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
            // look at all the json files in the output dir to get them organized
            this.moveReports(outputDir, schemaName, containerResult);
            return containerResult;
          })
          .catch((..._zagwo) => {
            this.processedUrls.push({ uri: dataUri, schema: schemaName, size: dataSize });
            const containerResult: ContainerResult = { pass: false, locations: {} };
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
            this.moveReports(outputDir, schemaName, containerResult);
            process.exitCode = 1;
            return containerResult;
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

  private moveReports(outputDir: string, schemaName: string, containerResult: ContainerResult) {
    fs.readdirSync(outputDir).forEach(reportFile => {
      if (reportFile.endsWith('.json') && reportFile != 'errors.json') {
        if (this.outputPath) {
          if (schemaName === 'in-network-rates' && reportFile === 'negotiatedType.json') {
            // convert to map
            this.convertToPopulationMap(
              path.join(outputDir, reportFile),
              path.join(this.outputPath, `${this.processedUrls.length}-${reportFile}`)
            );
          } else {
            fs.copySync(
              path.join(outputDir, reportFile),
              path.join(this.outputPath, `${this.processedUrls.length}-${reportFile}`)
            );
          }
        }
      }
      if (schemaName === 'table-of-contents') {
        if (reportFile === 'allowedAmountFiles.json') {
          const allowedAmountFiles = fs.readJsonSync(path.join(outputDir, reportFile));
          containerResult.locations.allowedAmount = [];
          Object.keys(allowedAmountFiles).forEach((key: string) => {
            if (typeof allowedAmountFiles[key].location === 'string') {
              containerResult.locations.allowedAmount.push(allowedAmountFiles[key].location);
            }
          });
        } else if (reportFile === 'inNetworkFiles.json') {
          const inNetworkFiles = fs.readJsonSync(path.join(outputDir, reportFile));
          containerResult.locations.inNetwork = [];
          Object.keys(inNetworkFiles).forEach((key: string) => {
            if (Array.isArray(inNetworkFiles[key])) {
              inNetworkFiles[key].forEach((entry: any) => {
                if (typeof entry.location === 'string') {
                  containerResult.locations.inNetwork.push(entry.location);
                }
              });
            }
          });
        }
      } else if (schemaName === 'in-network-rates' && reportFile === 'providerReferences.json') {
        const providerReferenceFiles = fs.readJsonSync(path.join(outputDir, reportFile));
        containerResult.locations.providerReference = [];
        Object.keys(providerReferenceFiles).forEach((key: string) => {
          if (typeof providerReferenceFiles[key] === 'string') {
            containerResult.locations.providerReference.push(providerReferenceFiles[key]);
          }
        });
      }
    });
  }

  private convertToPopulationMap(reportFile: string, outputFile: string) {
    const populationMap = new Map<string, number>();
    const reportContents = fs.readJsonSync(reportFile);
    Object.values(reportContents).forEach((v: any) => {
      if (typeof v === 'string') {
        populationMap.set(v, (populationMap.get(v) ?? 0) + 1);
      }
    });
    fs.writeJsonSync(outputFile, Object.fromEntries(populationMap.entries()));
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
