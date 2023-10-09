import 'jest-extended';
import path from 'path';
import { validate, validateFromUrl } from '../src/commands';
import { SchemaManager } from '../src/SchemaManager';
import { DockerManager } from '../src/DockerManager';
import { DownloadManager } from '../src/DownloadManager';

describe('commands', () => {
  let checkDataUrlSpy: jest.SpyInstance;
  let ensureRepoSpy: jest.SpyInstance;
  let useVersionSpy: jest.SpyInstance;
  let useSchemaSpy: jest.SpyInstance;
  let downloadDataSpy: jest.SpyInstance;
  let runContainerSpy: jest.SpyInstance;

  beforeAll(() => {
    checkDataUrlSpy = jest.spyOn(DownloadManager.prototype, 'checkDataUrl');
    ensureRepoSpy = jest
      .spyOn(SchemaManager.prototype, 'ensureRepo')
      .mockResolvedValue({ stdout: '', stderr: '' });
    useVersionSpy = jest.spyOn(SchemaManager.prototype, 'useVersion').mockResolvedValue(true);
    useSchemaSpy = jest.spyOn(SchemaManager.prototype, 'useSchema').mockResolvedValue('schemaPath');
    downloadDataSpy = jest
      .spyOn(DownloadManager.prototype, 'downloadDataFile')
      .mockResolvedValue('data.json');
    runContainerSpy = jest
      .spyOn(DockerManager.prototype, 'runContainer')
      .mockResolvedValue({ pass: false });
  });

  beforeEach(() => {
    checkDataUrlSpy.mockClear();
    ensureRepoSpy.mockClear();
    useVersionSpy.mockClear();
    useSchemaSpy.mockClear();
    downloadDataSpy.mockClear();
    runContainerSpy.mockClear();
  });

  afterAll(() => {
    checkDataUrlSpy.mockRestore();
    ensureRepoSpy.mockRestore();
    useVersionSpy.mockRestore();
    useSchemaSpy.mockRestore();
    downloadDataSpy.mockRestore();
    runContainerSpy.mockRestore();
  });

  describe('#validate', () => {
    it('should continue processing when the data file exists', async () => {
      await validate(path.join(__dirname, '..', 'test-files', 'allowed-amounts.json'), {
        target: null
      });
      expect(useVersionSpy).toHaveBeenCalledTimes(1);
    });

    it('should not continue processing when the data file does not exist', async () => {
      await validate(path.join(__dirname, '..', 'test-files', 'not-real.json'), { target: null });
      expect(useVersionSpy).toHaveBeenCalledTimes(0);
    });

    it('should run the container when the requested schema is available', async () => {
      useSchemaSpy.mockResolvedValueOnce('good.json');
      await validate(path.join(__dirname, '..', 'test-files', 'allowed-amounts.json'), {
        target: null
      });
      expect(runContainerSpy).toHaveBeenCalledTimes(1);
    });

    it('should not run the container when the requested schema is not available', async () => {
      await validate(path.join(__dirname, '..', 'test-files', 'not-real.json'), { target: null });
      expect(runContainerSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('#validateFromUrl', () => {
    it('should continue processing when the data url is valid and content length is less than or equal to the size limit', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(true);
      await validateFromUrl('http://example.org/data.json', { schemaVersion: 'v1.0.0' });
      expect(useSchemaSpy).toHaveBeenCalledTimes(1);
    });

    it('should not continue processing when the data url is invalid', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(false);
      await validateFromUrl('http://example.org/data.json', { schemaVersion: 'v1.0.0' });
      expect(useSchemaSpy).toHaveBeenCalledTimes(0);
    });

    it('should download the data file when the data url is valid and the requested schema is available', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(true);
      useSchemaSpy.mockResolvedValueOnce('schemapath.json');
      downloadDataSpy.mockResolvedValueOnce('data.json');
      await validateFromUrl('http://example.org/data.json', {
        target: 'in-network-rates',
        schemaVersion: 'v1.0.0'
      });
      expect(downloadDataSpy).toHaveBeenCalledTimes(1);
      expect(downloadDataSpy).toHaveBeenCalledWith('http://example.org/data.json');
      expect(runContainerSpy).toHaveBeenCalledTimes(1);
      expect(runContainerSpy).toHaveBeenCalledWith(
        'schemapath.json',
        'in-network-rates',
        'data.json'
      );
    });

    it('should not download the data file when the requested schema is not available', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(true);
      useSchemaSpy.mockResolvedValueOnce(null);
      await validateFromUrl('http://example.org/data.json', { schemaVersion: 'v1.0.0' });
      expect(downloadDataSpy).toHaveBeenCalledTimes(0);
    });
  });
});
