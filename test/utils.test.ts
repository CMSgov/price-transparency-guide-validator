import 'jest-extended';
import path from 'path';
import temp from 'temp';
import util from 'util';
import { exec } from 'child_process';

import * as validatorUtils from '../src/utils';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';

const SEP = path.sep;
const PROJECT_DIR = path.resolve(path.join(__dirname, '..'));
const execP = util.promisify(exec);

describe('utils', () => {
  describe('#buildRunCommand', () => {
    it('should build the command to run the validation container without an output path', () => {
      const result = validatorUtils.buildRunCommand(
        SEP + path.join('some', 'useful', 'schema.json'), // this is an absolute path
        path.join('my', 'data.json'), // this is a relative path
        '',
        'bad1dea'
      );
      // since the container is running linux, it should always use / as its path separator.
      // but, the paths on the host system should be built by path
      const expectedCommand = `docker run --rm -v "${path.join(
        path.resolve(SEP),
        'some',
        'useful'
      )}":/schema/ -v "${path.join(
        PROJECT_DIR,
        'my'
      )}":/data/ bad1dea "schema/schema.json" "data/data.json"`;
      expect(result).toBe(expectedCommand);
    });

    it('should build the command to run the validation container with an output path', () => {
      const result = validatorUtils.buildRunCommand(
        path.join('some', 'useful', 'schema.json'), // this is a relative path
        SEP + path.join('other', 'data', 'data.json'), // this is an absolute path
        path.join('results', 'output.txt'), // this is a relative path
        'dadb0d'
      );
      const expectedCommand = `docker run --rm -v "${path.join(
        PROJECT_DIR,
        'some',
        'useful'
      )}":/schema/ -v "${path.join(path.resolve(SEP), 'other', 'data')}":/data/ -v "${path.join(
        PROJECT_DIR,
        'results'
      )}":/output/ dadb0d "schema/schema.json" "data/data.json" -o "output/output.txt"`;
      expect(result).toBe(expectedCommand);
    });
  });

  describe('#useRepoVersion', () => {
    let oldRepoFolder: string;
    beforeAll(async () => {
      // set up our test repo with a sample schema
      const repoDirectory = temp.mkdirSync();
      const sampleSchema = JSON.parse(
        readFileSync(path.join(__dirname, 'fixtures', 'sampleSchema.json'), 'utf-8')
      );
      ensureDirSync(path.join(repoDirectory, 'schemas', 'something-good'));
      oldRepoFolder = validatorUtils.config.SCHEMA_REPO_FOLDER;
      validatorUtils.config.SCHEMA_REPO_FOLDER = repoDirectory;
      await execP(`git init "${repoDirectory}"`);
      await execP(`git -C "${repoDirectory}" config user.name "test-user"`);
      await execP(`git -C "${repoDirectory}" config user.email "test-user@example.org"`);
      // create a few commits and tag them
      const schemaPath = path.join('schemas', 'something-good', 'something-good.json');
      sampleSchema.version = '0.3';
      writeFileSync(path.join(repoDirectory, schemaPath), JSON.stringify(sampleSchema));
      await execP(`git -C "${repoDirectory}" add -A`);
      await execP(`git -C "${repoDirectory}" commit -m "first commit"`);
      await execP(`git -C "${repoDirectory}" tag -a "v0.3" -m ""`);
      sampleSchema.version = '0.7';
      writeFileSync(path.join(repoDirectory, schemaPath), JSON.stringify(sampleSchema));
      await execP(`git -C "${repoDirectory}" commit -am "second commit"`);
      await execP(`git -C "${repoDirectory}" tag -a "v0.7" -m ""`);
      sampleSchema.version = '1.0';
      writeFileSync(path.join(repoDirectory, schemaPath), JSON.stringify(sampleSchema));
      await execP(`git -C "${repoDirectory}" commit -am "third commit"`);
      await execP(`git -C "${repoDirectory}" tag -a "v1.0" -m ""`);
    });

    afterAll(() => {
      validatorUtils.config.SCHEMA_REPO_FOLDER = oldRepoFolder;
      temp.cleanupSync();
    });

    it('should return a file path to the schema contents at the specified version', async () => {
      const result = await validatorUtils.useRepoVersion('v0.7', 'something-good');
      expect(result).toBeDefined();
      const contents = JSON.parse(readFileSync(<string>result, { encoding: 'utf-8' }));
      expect(contents.version).toBe('0.7');
    });

    it('should return undefined when the given tag is not available', async () => {
      const result = await validatorUtils.useRepoVersion('v0.6', 'something-good');
      expect(result).toBeUndefined();
    });

    it('should return undefined when the given schema is not available', async () => {
      const result = await validatorUtils.useRepoVersion('v0.3', 'something-bad');
      expect(result).toBeUndefined();
    });

    it('should set additionalProperties to false on all definitions when strict is true', async () => {
      const result = await validatorUtils.useRepoVersion('v1.0', 'something-good', true);
      expect(result).toBeDefined();
      const contents = JSON.parse(readFileSync(<string>result, { encoding: 'utf-8' }));
      expect(contents.version).toBe('1.0');
      expect(contents.additionalProperties).toBeFalse();
      expect(contents.definitions.food.additionalProperties).toBeFalse();
      expect(contents.definitions.garment.additionalProperties).toBeFalse();
    });
  });
});
