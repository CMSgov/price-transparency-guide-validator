import 'jest-extended';
import path from 'path';
import temp from 'temp';
import NodeGit from 'nodegit';

import { buildRunCommand, config, useRepoVersion } from '../src/utils';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';

const SEP = path.sep;
const PROJECT_DIR = path.resolve(path.join(__dirname, '..'));

describe('utils', () => {
  describe('#buildRunCommand', () => {
    it('should build the command to run the validation container without an output path', () => {
      const result = buildRunCommand(
        SEP + path.join('some', 'useful', 'schema.json'), // this is an absolute path
        path.join('my', 'data.json'), // this is a relative path
        '',
        'bad1dea'
      );
      // since the container is running linux, it should always use / as its path separator.
      // but, the paths on the host system should be built by path
      const expectedCommand = `docker run -v "${path.join(
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
      const result = buildRunCommand(
        path.join('some', 'useful', 'schema.json'), // this is a relative path
        SEP + path.join('other', 'data', 'data.json'), // this is an absolute path
        path.join('results', 'output.txt'), // this is a relative path
        'dadb0d'
      );
      const expectedCommand = `docker run -v "${path.join(
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
      // set up our test repo
      const repoDirectory = temp.mkdirSync();
      ensureDirSync(path.join(repoDirectory, 'schemas', 'something-good'));
      oldRepoFolder = config.SCHEMA_REPO_FOLDER;
      config.SCHEMA_REPO_FOLDER = repoDirectory;
      const repo = await NodeGit.Repository.init(repoDirectory, 0);
      const author = NodeGit.Signature.now('test-user', 'test-user@example.org');
      // create a few commits and tag them
      const schemaPath = path.join('schemas', 'something-good', 'something-good.json');
      writeFileSync(path.join(repoDirectory, schemaPath), 'first schema info');
      let commit = await repo.createCommitOnHead([schemaPath], author, author, 'first commit');
      await repo.createTag(commit, 'v0.3', '');
      writeFileSync(path.join(repoDirectory, schemaPath), 'schema for version 0.7');
      commit = await repo.createCommitOnHead([schemaPath], author, author, 'second commit');
      await repo.createTag(commit, 'v0.7', '');
      writeFileSync(path.join(repoDirectory, schemaPath), 'this is the first published schema');
      commit = await repo.createCommitOnHead([schemaPath], author, author, 'third commit');
      await repo.createTag(commit, 'v1.0', '');
    });

    afterAll(() => {
      config.SCHEMA_REPO_FOLDER = oldRepoFolder;
      temp.cleanupSync();
    });

    it('should return a file path to the schema contents at the specified version', async () => {
      const result = await useRepoVersion('v0.7', 'something-good');
      expect(result).toBeDefined();
      const contents = readFileSync(<string>result, { encoding: 'utf-8' });
      expect(contents).toBe('schema for version 0.7');
    });

    it('should return undefined when the given tag is not available', async () => {
      const result = await useRepoVersion('v0.6', 'something-good');
      expect(result).toBeUndefined();
    });

    it('should return undefined when the given schema is not available', async () => {
      const result = await useRepoVersion('v0.3', 'something-bad');
      expect(result).toBeUndefined();
    });
  });
});
