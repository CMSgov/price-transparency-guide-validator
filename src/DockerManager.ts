import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import temp from 'temp';

export class DockerManager {
  async runContainer(
    schemaPath: string,
    schemaName: string,
    dataPath: string,
    outputPath: string
  ): Promise<ContainerResult> {
    try {
      const containerId = await util
        .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
        .then(result => result.stdout.trim())
        .catch(reason => {
          console.log(reason.stderr);
          return '';
        });
      if (containerId.length > 0) {
        // make temp dir for output
        temp.track();
        const outputDir = temp.mkdirSync('output');
        const containerOutputPath = path.join(outputDir, 'output.txt');
        const containerLocationPath = path.join(outputDir, 'locations.json');
        // copy output files after it finishes
        const runCommand = this.buildRunCommand(
          schemaPath,
          dataPath,
          outputDir,
          containerId,
          schemaName
        );
        console.log('Running validator container...');
        return util
          .promisify(exec)(runCommand)
          .then(result => {
            const containerResult: ContainerResult = { pass: true };
            if (outputPath && fs.existsSync(containerOutputPath)) {
              fs.copySync(containerOutputPath, outputPath);
            }
            if (fs.existsSync(containerOutputPath)) {
              if (outputPath) {
                fs.copySync(containerOutputPath, outputPath);
              } else {
                const outputText = fs.readFileSync(containerOutputPath, 'utf-8');
                console.log(outputText);
              }
            }
            if (fs.existsSync(containerLocationPath)) {
              try {
                containerResult.locations = fs.readJsonSync(containerLocationPath);
              } catch (err) {
                // something went wrong when reading the location file that the validator produced
              }
            }
            return containerResult;
          })
          .catch(reason => {
            if (outputPath && fs.existsSync(path.join(outputDir, 'output.txt'))) {
              fs.copySync(path.join(outputDir, 'output.txt'), outputPath);
            }
            if (fs.existsSync(containerOutputPath)) {
              if (outputPath) {
                fs.copySync(containerOutputPath, outputPath);
              } else {
                const outputText = fs.readFileSync(containerOutputPath, 'utf-8');
                console.log(outputText);
              }
            }
            process.exitCode = 1;
            return { pass: false };
          });
      } else {
        console.log('Could not find a validator docker container.');
        process.exitCode = 1;
        return { pass: false };
      }
    } catch (error) {
      console.log(`Error when running validator container: ${error}`);
      process.exitCode = 1;
      return { pass: false };
    }
  }

  buildRunCommand(
    schemaPath: string,
    dataPath: string,
    outputDir: string,
    containerId: string,
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
    )}":/output/ ${containerId} "schema/${schemaFile}" "data/${dataFile}" -o "output/" -s ${schemaName}`;
  }
}

export type ContainerResult = {
  pass: boolean;
  locations?: {
    inNetwork?: string[];
    allowedAmount?: string[];
    providerReference?: string[];
  };
};
