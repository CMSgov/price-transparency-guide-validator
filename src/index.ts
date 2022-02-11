#!/usr/bin/env node

import util from 'util';
import path from 'path';
import { execFile, exec } from 'child_process';
import { program } from 'commander';
import NodeGit from 'nodegit';
import fs from 'fs-extra';
import temp from 'temp';

const SCHEMA_REPO_URL = 'https://github.com/CMSgov/price-transparency-guide.git';
const SCHEMA_ZIP_URL =
  'https://github.com/CMSgov/price-transparency-guide/archive/refs/heads/master.zip';
const SCHEMA_REPO_FOLDER = path.normalize(path.join(__dirname, '..', 'schema-repo'));

temp.track();

program
  .name('mr-validator')
  .usage('<schema-file> <data-file> [options]')
  .argument('<schema-file>', 'path to schema file')
  .argument('<data-file>', 'path to data file to validate')
  .option('-s, --schema-version <version>', 'version of schema to use for validation')
  .option('-o, --out <out>', 'output path')
  .option('-d, --docker', 'try to call docker image', false)
  .parse(process.argv);

const options = program.opts();
const validatorArgs = program.args;
if (options.out) {
  validatorArgs.push(options.out);
}

if (options.schemaVersion) {
  useRepoVersion(options.schemaVersion).then(schemaFilePath => {
    if (schemaFilePath != null) {
      runContainer(schemaFilePath, validatorArgs[1]);
    }
  });
} else if (options.docker) {
  runContainer(validatorArgs[0], validatorArgs[1]);
} else {
  runValidator(validatorArgs);
}

async function runContainer(schemaPath: string, dataPath: string) {
  // figure out mount for schema file
  const absoluteSchemaPath = path.resolve(schemaPath);
  const schemaDir = path.dirname(absoluteSchemaPath);
  const schemaFile = path.basename(absoluteSchemaPath);
  // figure out mount for data file
  const absoluteDataPath = path.resolve(dataPath);
  const dataDir = path.dirname(absoluteDataPath);
  const dataFile = path.basename(absoluteDataPath);
  const containerId = 'ed20b5a3376d';
  // incredibly unsafe but temporarily useful, do not merge to main
  return util
    .promisify(exec)(
      `docker run -v ${schemaDir}:/schema/ -v ${dataDir}:/data/ ${containerId} schema/${schemaFile} data/${dataFile}`
    )
    .then(result => {
      console.log('regular result');
      console.log(result.stdout);
    })
    .catch(reason => {
      console.log(reason.stdout);
      console.log(reason.stderr);
    });
}

async function runValidator(validatorArgs: string[]) {
  return util
    .promisify(execFile)(path.join(__dirname, '..', 'validator'), validatorArgs, {
      cwd: path.join(__dirname, '..'),
      shell: false
    })
    .then(result => {
      console.log('validation success!');
      if (!options.out) {
        console.log(result.stdout);
      }
      console.log('thank you for using mr-validator!');
    })
    .catch(reason => {
      console.log('validation failure. validation mesage follows:');
      if (options.out) {
        console.log('see output file for details.');
      } else {
        console.log(reason.stdout);
        console.log(reason.stderr);
      }
    });
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
      // TODO once there is an update command, remind the user of it
    }
  } catch (badtime) {
    console.log(badtime);
  }
}
