#!/usr/bin/env node

import util from 'util';
import path from 'path';
import { exec } from 'child_process';
import { program } from 'commander';
import NodeGit from 'nodegit';
import fs from 'fs-extra';
import temp from 'temp';

const SCHEMA_REPO_URL = 'https://github.com/CMSgov/price-transparency-guide.git';
const SCHEMA_REPO_FOLDER = path.normalize(path.join(__dirname, '..', 'schema-repo'));

program
  .name('mr-validator')
  .usage('data-file> <schema-version> [options]')
  .argument('<data-file>', 'path to data file to validate')
  .argument('<schema-version>', 'version of schema to use for validation')
  .option('-o, --out <out>', 'output path')
  .parse(process.argv);

temp.track();

useRepoVersion(program.args[1]).then(schemaPath => {
  if (schemaPath != null) {
    runContainer(schemaPath, program.args[0]);
  } else {
    console.log('No schema available - not validating.');
  }
});

async function runContainer(schemaPath: string, dataPath: string) {
  // figure out mount for schema file
  const absoluteSchemaPath = path.resolve(schemaPath);
  const schemaDir = path.dirname(absoluteSchemaPath);
  const schemaFile = path.basename(absoluteSchemaPath);
  // figure out mount for data file
  const absoluteDataPath = path.resolve(dataPath);
  const dataDir = path.dirname(absoluteDataPath);
  const dataFile = path.basename(absoluteDataPath);
  const newContainerId = await util
    .promisify(exec)('docker images validator:latest --format "{{.ID}}"')
    .then(result => result.stdout.trim())
    .catch(reason => {
      console.log(reason.stderr);
      return '';
    });
  if (newContainerId.length > 0) {
    // incredibly unsafe but temporarily useful, do not merge to main
    return util
      .promisify(exec)(
        `docker run -v "${schemaDir}":/schema/ -v "${dataDir}":/data/ ${newContainerId} "schema/${schemaFile}" "data/${dataFile}"`
      )
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
  } catch (badtime) {
    console.log(badtime);
  }
}
