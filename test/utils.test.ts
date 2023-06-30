import 'jest-extended';
import path from 'path';
import temp from 'temp';
import util from 'util';
import { exec } from 'child_process';
import nock from 'nock';
import readlineSync from 'readline-sync';
import fs from 'fs-extra';

import * as validatorUtils from '../src/utils';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';

const SEP = path.sep;
const PROJECT_DIR = path.resolve(path.join(__dirname, '..'));
const execP = util.promisify(exec);

describe('utils', () => {
  beforeAll(() => {
    temp.track();
  });

  describe('#buildRunCommand', () => {
    it('should build the command to run the validation container with an output path', () => {
      const result = validatorUtils.buildRunCommand(
        path.join('some', 'useful', 'schema.json'), // this is a relative path
        SEP + path.join('other', 'data', 'data.json'), // this is an absolute path
        path.join('results', 'output'), // this is a relative path
        'dadb0d',
        'table-of-contents'
      );
      const expectedCommand = `docker run --rm -v "${path.join(
        PROJECT_DIR,
        'some',
        'useful'
      )}":/schema/ -v "${path.join(path.resolve(SEP), 'other', 'data')}":/data/ -v "${path.join(
        PROJECT_DIR,
        'results',
        'output'
      )}":/output/ dadb0d "schema/schema.json" "data/data.json" -o "output/" -s table-of-contents`;
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

  describe('#checkDataUrl', () => {
    let keyInYNStrictSpy: jest.SpyInstance;

    beforeAll(() => {
      keyInYNStrictSpy = jest.spyOn(readlineSync, 'keyInYNStrict');
    });

    afterEach(() => {
      nock.cleanAll();
    });

    afterAll(() => {
      keyInYNStrictSpy.mockRestore();
    });

    it('should return true when the url is valid and the content length is less than one GB', async () => {
      nock('http://example.org').head('/data.json').reply(200, '', { 'content-length': '500' });
      const result = await validatorUtils.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return true when the url is valid and the user approves a content length greater than one GB', async () => {
      nock('http://example.org')
        .head('/data.json')
        .reply(200, '', { 'content-length': (Math.pow(1024, 3) * 2).toString() });
      keyInYNStrictSpy.mockReturnValueOnce(true);
      const result = await validatorUtils.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return false when the url is valid and the user rejects a content length greater than one GB', async () => {
      nock('http://example.org')
        .head('/data.json')
        .reply(200, '', { 'content-length': (Math.pow(1024, 3) * 2).toString() });
      keyInYNStrictSpy.mockReturnValueOnce(false);
      const result = await validatorUtils.checkDataUrl('http://example.org/data.json');
      expect(result).toBeFalse();
    });

    it('should return true when the url is valid and the user approves an unknown content length', async () => {
      nock('http://example.org').head('/data.json').reply(200);
      keyInYNStrictSpy.mockReturnValueOnce(true);
      const result = await validatorUtils.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return false when the url is valid and the user rejects an unknown content length', async () => {
      nock('http://example.org').head('/data.json').reply(200);
      keyInYNStrictSpy.mockReturnValueOnce(false);
      const result = await validatorUtils.checkDataUrl('http://example.org/data.json');
      expect(result).toBeFalse();
    });

    it('should return false when the url is not valid', async () => {
      nock('http://example.org').head('/data.json').reply(404);
      const result = await validatorUtils.checkDataUrl('http://example.org/data.json');
      expect(result).toBeFalse();
    });
  });

  describe('#downloadDataFile', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('should write a file to the specified folder', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      nock('http://example.org').get('/data.json').reply(200, simpleData);
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile('http://example.org/data.json', outputDir);
      expect(fs.existsSync(path.join(outputDir, 'data.json')));
      const downloadedData = fs.readJsonSync(path.join(outputDir, 'data.json'), 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should write a decompressed gz file when the response has content type application/gzip', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      const simpleGz = fs.readFileSync(path.join(__dirname, 'fixtures', 'simpleData.gz'));
      nock('http://example.org')
        .get('/data.gz')
        .reply(200, simpleGz, { 'content-type': 'application/gzip' });
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile('http://example.org/data.gz', outputDir);
      expect(fs.existsSync(path.join(outputDir, 'data.json')));
      const downloadedData = fs.readJsonSync(path.join(outputDir, 'data.json'), 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should write a decompressed gz file when the response has content type application/octet-stream and the url ends with .gz', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      const simpleGz = fs.readFileSync(path.join(__dirname, 'fixtures', 'simpleData.gz'));
      nock('http://example.org')
        .get('/data.gz')
        .reply(200, simpleGz, { 'content-type': 'application/octet-stream' });
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile('http://example.org/data.gz', outputDir);
      expect(fs.existsSync(path.join(outputDir, 'data.json')));
      const downloadedData = fs.readJsonSync(path.join(outputDir, 'data.json'), 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should write a json file within a zip to the specified folder', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      const simpleZip = fs.readFileSync(path.join(__dirname, 'fixtures', 'simpleZip.zip'));
      nock('http://example.org')
        .get('/data.zip')
        .reply(200, simpleZip, { 'content-type': 'application/zip' });
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile('http://example.org/data.zip', outputDir);
      expect(fs.existsSync(path.join(outputDir, 'data.json')));
      const downloadedData = fs.readJsonSync(path.join(outputDir, 'data.json'), 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should write a json file within a zip when the response has content type application/octet-stream and the url ends with .zip', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      const simpleZip = fs.readFileSync(path.join(__dirname, 'fixtures', 'simpleZip.zip'));
      nock('http://example.org')
        .get('/data.zip')
        .reply(200, simpleZip, { 'content-type': 'application/octet-stream' });
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile('http://example.org/data.zip', outputDir);
      expect(fs.existsSync(path.join(outputDir, 'data.json')));
      const downloadedData = fs.readJsonSync(path.join(outputDir, 'data.json'), 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should reject when a zip contains no json files', async () => {
      const wrongZip = fs.readFileSync(path.join(__dirname, 'fixtures', 'allWrong.zip'));
      nock('http://example.org')
        .get('/data.zip')
        .reply(200, wrongZip, { 'content-type': 'application/zip' });
      const outputDir = temp.mkdirSync();
      await expect(
        validatorUtils.downloadDataFile('http://example.org/data.zip', outputDir)
      ).toReject();
    });

    it('should reject when the url is not valid', async () => {
      nock('http://example.org').get('/data.json').reply(500);
      const outputDir = temp.mkdirSync();
      await expect(
        validatorUtils.downloadDataFile('http://example.org/data.json', outputDir)
      ).toReject();
    });
  });
});
