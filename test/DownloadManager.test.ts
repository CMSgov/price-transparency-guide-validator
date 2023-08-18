import 'jest-extended';
import path from 'path';
import temp from 'temp';
import nock from 'nock';
import readlineSync from 'readline-sync';
import fs from 'fs-extra';
import yauzl from 'yauzl';
import { DownloadManager } from '../src/DownloadManager';
import { ZipContents } from '../src/utils';

describe('DownloadManager', () => {
  let downloadManager: DownloadManager;

  beforeAll(() => {
    temp.track();
    downloadManager = new DownloadManager();
  });

  beforeEach(() => {
    downloadManager.alwaysYes = false;
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
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return true when the url is valid and the user approves a content length greater than one GB', async () => {
      nock('http://example.org')
        .head('/data.json')
        .reply(200, '', { 'content-length': (Math.pow(1024, 3) * 2).toString() });
      keyInYNStrictSpy.mockReturnValueOnce(true);
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return true when the url is valid and and alwaysYes is true with a content length greater than one GB', async () => {
      nock('http://example.org')
        .head('/data.json')
        .reply(200, '', { 'content-length': (Math.pow(1024, 3) * 2).toString() });
      downloadManager.alwaysYes = true;
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return false when the url is valid and the user rejects a content length greater than one GB', async () => {
      nock('http://example.org')
        .head('/data.json')
        .reply(200, '', { 'content-length': (Math.pow(1024, 3) * 2).toString() });
      keyInYNStrictSpy.mockReturnValueOnce(false);
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeFalse();
    });

    it('should return true when the url is valid and the user approves an unknown content length', async () => {
      nock('http://example.org').head('/data.json').reply(200);
      keyInYNStrictSpy.mockReturnValueOnce(true);
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return true when the url is valid and alwaysYes is true with an unknown content length', async () => {
      nock('http://example.org').head('/data.json').reply(200);
      downloadManager.alwaysYes = true;
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeTrue();
    });

    it('should return false when the url is valid and the user rejects an unknown content length', async () => {
      nock('http://example.org').head('/data.json').reply(200);
      keyInYNStrictSpy.mockReturnValueOnce(false);
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeFalse();
    });

    it('should return false when the url is not valid', async () => {
      nock('http://example.org').head('/data.json').reply(404);
      const result = await downloadManager.checkDataUrl('http://example.org/data.json');
      expect(result).toBeFalse();
    });
  });

  describe('#downloadDataFile', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('should write a file to the default folder', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      nock('http://example.org').get('/data.json').reply(200, simpleData);
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.json'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should write a file to the specified folder', async () => {
      const simpleData = fs.readJsonSync(
        path.join(__dirname, 'fixtures', 'simpleData.json'),
        'utf-8'
      );
      nock('http://example.org').get('/data.json').reply(200, simpleData);
      const outputDir = temp.mkdirSync();
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.json',
        outputDir
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
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
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.gz'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
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
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.gz'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
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
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.gz?Expires=123456&mode=true'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
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
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.zip'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
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
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.zip'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
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
      const dataPath = (await downloadManager.downloadDataFile(
        'http://example.org/data.zip?mode=on&rate=7'
      )) as string;
      expect(dataPath).toBeString();
      expect(fs.existsSync(dataPath));
      const downloadedData = fs.readJsonSync(dataPath, 'utf-8');
      expect(downloadedData).toEqual(simpleData);
    });

    it('should return information about the zip contents when the zip has more than one json file', async () => {
      const multiZip = fs.readFileSync(path.join(__dirname, 'fixtures', 'multiZip.zip'));
      nock('http://example.org')
        .get('/multi.zip')
        .query(true)
        .reply(200, multiZip, { 'content-type': 'application/zip' });
      const zipInfo = (await downloadManager.downloadDataFile(
        'http://example.org/multi.zip?mode=more'
      )) as ZipContents;
      expect(zipInfo).toBeObject();
      expect(zipInfo.zipFile).toBeInstanceOf(yauzl.ZipFile);
      expect(zipInfo.jsonEntries).toHaveLength(2);
      expect(zipInfo.jsonEntries[0].fileName).toBe('moreData.json');
      expect(zipInfo.jsonEntries[1].fileName).toBe('simpleData.json');
    });

    it('should reject when a zip contains no json files', async () => {
      const wrongZip = fs.readFileSync(path.join(__dirname, 'fixtures', 'allWrong.zip'));
      nock('http://example.org')
        .get('/data.zip')
        .reply(200, wrongZip, { 'content-type': 'application/zip' });
      const outputDir = temp.mkdirSync();
      await expect(
        downloadManager.downloadDataFile('http://example.org/data.zip', outputDir)
      ).toReject();
    });

    it('should reject when the url is not valid', async () => {
      nock('http://example.org').get('/data.json').reply(500);
      const outputDir = temp.mkdirSync();
      await expect(
        downloadManager.downloadDataFile('http://example.org/data.json', outputDir)
      ).toReject();
    });
  });
});
