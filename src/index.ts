#!/usr/bin/env node

import util from 'util';
import path from 'path';
import { execFile } from 'child_process';
import { program } from 'commander';

program
  .name('mr-validator')
  .usage('<schema-file> <data-file> [options]')
  .argument('<schema-file>', 'path to schema file')
  .argument('<data-file>', 'path to data file to validate')
  .option('-o, --out <out>', 'output path')
  .parse(process.argv);

const options = program.opts();
const validatorArgs = program.args;
if (options.out) {
  validatorArgs.push(options.out);
}

util
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
