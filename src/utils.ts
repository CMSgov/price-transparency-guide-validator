import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs-extra';
import temp from 'temp';

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

export async function ensureRepo(repoDirectory: string) {
  // check if the repo exists, and if not, try to clone it
  if (!fs.existsSync(path.join(repoDirectory, '.git'))) {
    return util.promisify(exec)(`git clone ${config.SCHEMA_REPO_URL} "${repoDirectory}"`);
  }
}

export async function useRepoVersion(schemaVersion: string, schemaName: string) {
  try {
    await ensureRepo(config.SCHEMA_REPO_FOLDER);
    const tagResult = await util.promisify(exec)(
      `git -C "${config.SCHEMA_REPO_FOLDER}" tag --list --sort=taggerdate`
    );
    const tags = tagResult.stdout
      .split('\n')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    if (tags.includes(schemaVersion)) {
      await util.promisify(exec)(`git -C "${config.SCHEMA_REPO_FOLDER}" checkout ${schemaVersion}`);
      const schemaContents = fs.readFileSync(
        path.join(config.SCHEMA_REPO_FOLDER, 'schemas', schemaName, `${schemaName}.json`)
      );
      // write this version of the schema to a temporary file
      temp.track();
      const schemaDir = temp.mkdirSync('schemas');
      const schemaFilePath = path.join(schemaDir, 'schema.json');
      fs.writeFileSync(schemaFilePath, schemaContents, { encoding: 'utf-8' });
      return schemaFilePath;
    } else {
      // we didn't find your tag. maybe you mistyped it, so show the available ones.
      console.log(
        `Could not find a schema version named "${schemaVersion}". Available versions are:\n${tags.join(
          '\n'
        )}`
      );
    }
  } catch (error) {
    console.log(`Error when accessing schema: ${error}`);
  }
}

export function buildRunCommand(
  schemaPath: string,
  dataPath: string,
  outputPath: string,
  containerId: string
): string {
  // figure out mount for schema file
  const absoluteSchemaPath = path.resolve(schemaPath);
  const schemaDir = path.dirname(absoluteSchemaPath);
  const schemaFile = path.basename(absoluteSchemaPath);
  // figure out mount for data file
  const absoluteDataPath = path.resolve(dataPath);
  const dataDir = path.dirname(absoluteDataPath);
  const dataFile = path.basename(absoluteDataPath);
  // figure out mount for output file, if provided
  let outputDir, outputFile;
  if (outputPath?.length > 0) {
    const absoluteOutputPath = path.resolve(outputPath);
    outputDir = path.dirname(absoluteOutputPath);
    outputFile = path.basename(absoluteOutputPath);
  }
  if (outputDir && outputFile) {
    return `docker run -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ -v "${outputDir}":/output/ ${containerId} "schema/${schemaFile}" "data/${dataFile}" -o "output/${outputFile}"`;
  } else {
    return `docker run -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ ${containerId} "schema/${schemaFile}" "data/${dataFile}"`;
  }
}

export async function runContainer(schemaPath: string, dataPath: string, outputPath: string) {
  try {
    const containerId = await util
      .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
      .then(result => result.stdout.trim())
      .catch(reason => {
        console.log(reason.stderr);
        return '';
      });
    if (containerId.length > 0) {
      const runCommand = buildRunCommand(schemaPath, dataPath, outputPath, containerId);
      return util
        .promisify(exec)(runCommand)
        .then(result => {
          console.log(result.stdout);
        })
        .catch(reason => {
          console.log(reason.stdout);
          console.log(reason.stderr);
        });
    } else {
      console.log('Could not find a validator docker container.');
    }
  } catch (error) {
    console.log(`Error when running validator container: ${error}`);
  }
}
