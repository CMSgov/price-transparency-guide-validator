#!/usr/bin/env node

import util from 'util';
import path from 'path';
import { execFile, exec } from 'child_process';
import { program } from 'commander';

program
  .name('mr-validator')
  .usage('<schema-file> <data-file> [options]')
  .argument('<schema-file>', 'path to schema file')
  .argument('<data-file>', 'path to data file to validate')
  .option('-o, --out <out>', 'output path')
  .option('-d, --docker', 'try to call docker image', false)
  .parse(process.argv);

const options = program.opts();
const validatorArgs = program.args;
if (options.out) {
  validatorArgs.push(options.out);
}

if (options.docker) {
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

// util
//   .promisify(execFile)(path.join(__dirname, '..', 'validator'), validatorArgs, {
//     cwd: path.join(__dirname, '..'),
//     shell: false
//   })
//   .then(result => {
//     console.log('validation success!');
//     if (!options.out) {
//       console.log(result.stdout);
//     }
//     console.log('thank you for using mr-validator!');
//   })
//   .catch(reason => {
//     console.log('validation failure. validation mesage follows:');
//     if (options.out) {
//       console.log('see output file for details.');
//     } else {
//       console.log(reason.stdout);
//       console.log(reason.stderr);
//     }
//   });
