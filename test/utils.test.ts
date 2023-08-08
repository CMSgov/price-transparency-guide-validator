import 'jest-extended';
import path from 'path';
import temp from 'temp';
import nock from 'nock';
import readlineSync from 'readline-sync';
import fs from 'fs-extra';

import * as validatorUtils from '../src/utils';

describe('utils', () => {
  beforeAll(() => {
    temp.track();
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

    it('should write a decompressed gz file when the response has content type application/octet-stream and the url ends with .gz followed by a query string', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      const simpleGz = fs.readFileSync(path.join(__dirname, 'fixtures', 'simpleData.gz'));
      nock('http://example.org')
        .get('/data.gz')
        .query(true)
        .reply(200, simpleGz, { 'content-type': 'application/octet-stream' });
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile(
        'http://example.org/data.gz?Expires=123456&mode=true',
        outputDir
      );
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

    it('should write a json file within a zip when the response has content type application/octet-stream and the url ends with .zip followed by a query string', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      const simpleZip = fs.readFileSync(path.join(__dirname, 'fixtures', 'simpleZip.zip'));
      nock('http://example.org')
        .get('/data.zip')
        .query(true)
        .reply(200, simpleZip, { 'content-type': 'application/octet-stream' });
      const outputDir = temp.mkdirSync();
      await validatorUtils.downloadDataFile(
        'http://example.org/data.zip?mode=on&rate=7',
        outputDir
      );
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
