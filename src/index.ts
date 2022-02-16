#!/usr/bin/env node

import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import { program, OptionValues } from 'commander';
import NodeGit from 'nodegit';
import fs from 'fs-extra';
import temp from 'temp';

const SCHEMA_REPO_URL = 'https://github.com/CMSgov/price-transparency-guide.git';
const SCHEMA_REPO_FOLDER = path.normalize(path.join(__dirname, '..', 'schema-repo'));

main().catch(error => {
  console.log(`Encountered an unexpected error: ${error}`);
});

async function main() {
  program
    .name('mr-validator')
    .description('Tool for validating health coverage machine-readable files.')
    .command('validate', { isDefault: true })
    .description('Validate a file against a specific published version of the schema.')
    .usage('<data-file> <schema-version> [options]')
    .argument('<data-file>', 'path to data file to validate')
    .argument('<schema-version>', 'version of schema to use for validation')
    .option('-o, --out <out>', 'output path')
    .action(validate);

  program
    .command('update')
    .description('Update the available schemas from the CMS repository.')
    .action(update);

  program.parseAsync(process.argv);
}

async function validate(dataFile: string, schemaVersion: string, options: OptionValues) {
  temp.track();

  useRepoVersion(schemaVersion).then(schemaPath => {
    if (schemaPath != null) {
      runContainer(schemaPath, dataFile, options.out);
    } else {
      console.log('No schema available - not validating.');
    }
  });
}

async function update() {
  try {
    // check if the repo exists. if not, clone it. if it exists, fetch updates.
    if (!fs.existsSync(path.join(SCHEMA_REPO_FOLDER, '.git'))) {
      await util.promisify(exec)(`git clone ${SCHEMA_REPO_URL} "${SCHEMA_REPO_FOLDER}"`);
      console.log('Retrieved schemas.');
    } else {
      await util.promisify(exec)(`git -C "${SCHEMA_REPO_FOLDER}" pull --no-rebase -t`);
      console.log('Updated schemas.');
    }
  } catch (error) {
    console.log(`Error when updating available schemas: ${error}`);
  }
}

async function runContainer(schemaPath: string, dataPath: string, outputPath: string) {
  try {
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
    const newContainerId = await util
      .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
      .then(result => result.stdout.trim())
      .catch(reason => {
        console.log(reason.stderr);
        return '';
      });
    if (newContainerId.length > 0) {
      let runCommand: string;
      if (outputDir && outputFile) {
        runCommand = `docker run -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ -v "${outputDir}":/output/ ${newContainerId} "schema/${schemaFile}" "data/${dataFile}" -o "output/${outputFile}"`;
      } else {
        runCommand = `docker run -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ ${newContainerId} "schema/${schemaFile}" "data/${dataFile}"`;
      }
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

async function useRepoVersion(schemaVersion: string) {
  try {
    // check if the repo exists, and if not, try to clone it
    if (!fs.existsSync(path.join(SCHEMA_REPO_FOLDER, '.git'))) {
      await util.promisify(exec)(`git clone ${SCHEMA_REPO_URL} "${SCHEMA_REPO_FOLDER}"`);
    }
    const repo = await NodeGit.Repository.open(SCHEMA_REPO_FOLDER);
    const tags = await NodeGit.Tag.list(repo);
    if (tags.includes(schemaVersion)) {
      // if the specified version is a valid tag, get the schema file at that tag's commit
      const versionTag = await repo.getTagByName(schemaVersion);
      const versionTarget = await versionTag.target();
      const versionCommit = await repo.getCommit(versionTarget.id());
      const versionEntry = await versionCommit.getEntry(
        path.join('schemas', 'in-network-rates', 'in-network-rates.json')
      );
      const blob = await versionEntry.getBlob();
      // write this version of the schema to a temporary file
      const schemaDir = temp.mkdirSync('schemas');
      const schemaFilePath = path.join(schemaDir, 'schema.json');
      fs.writeFileSync(schemaFilePath, blob.content());
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
