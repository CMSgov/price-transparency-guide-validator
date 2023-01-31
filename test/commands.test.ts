import 'jest-extended';
import path from 'path';
import * as validatorUtils from '../src/utils';
import { validate, validateFromUrl } from '../src/commands';

describe('commands', () => {
  describe('#validate', () => {
    let useRepoSpy: jest.SpyInstance;
    let runContainerSpy: jest.SpyInstance;

    beforeAll(() => {
      useRepoSpy = jest.spyOn(validatorUtils, 'useRepoVersion').mockResolvedValue(undefined);
      runContainerSpy = jest.spyOn(validatorUtils, 'runContainer').mockResolvedValue(undefined);
    });

    beforeEach(() => {
      useRepoSpy.mockClear();
      runContainerSpy.mockClear();
    });

    it('should continue processing when the data file exists', async () => {
      await validate(
        path.join(__dirname, '..', 'test-files', 'allowed-amounts.json'),
        'schema version 278',
        { target: null }
      );
      expect(useRepoSpy).toHaveBeenCalledTimes(1);
    });

    it('should not continue processing when the data file does not exist', async () => {
      await validate(
        path.join(__dirname, '..', 'test-files', 'not-real.json'),
        'schema version 8',
        { target: null }
      );
      expect(useRepoSpy).toHaveBeenCalledTimes(0);
    });

    it('should run the container when the requested schema is available', async () => {
      useRepoSpy.mockResolvedValueOnce('good.json');
      await validate(
        path.join(__dirname, '..', 'test-files', 'allowed-amounts.json'),
        'schema version 278',
        { target: null }
      );
      expect(runContainerSpy).toHaveBeenCalledTimes(1);
    });

    it('should not run the container when the requested schema is not available', async () => {
      await validate(
        path.join(__dirname, '..', 'test-files', 'not-real.json'),
        'schema version 278',
        { target: null }
      );
      expect(runContainerSpy).toHaveBeenCalledTimes(0);
    });

    afterAll(() => {
      useRepoSpy.mockRestore();
      runContainerSpy.mockRestore();
    });
  });

  describe('#validateFromUrl', () => {
    let checkDataUrlSpy: jest.SpyInstance;
    let useRepoSpy: jest.SpyInstance;
    let downloadDataSpy: jest.SpyInstance;
    let runContainerSpy: jest.SpyInstance;

    beforeAll(() => {
      checkDataUrlSpy = jest.spyOn(validatorUtils, 'checkDataUrl');
      useRepoSpy = jest.spyOn(validatorUtils, 'useRepoVersion').mockResolvedValue(undefined);
      downloadDataSpy = jest
        .spyOn(validatorUtils, 'downloadDataFile')
        .mockResolvedValue('data.json');
      runContainerSpy = jest.spyOn(validatorUtils, 'runContainer').mockResolvedValue(undefined);
    });

    beforeEach(() => {
      checkDataUrlSpy.mockClear();
      useRepoSpy.mockClear();
      downloadDataSpy.mockClear();
      runContainerSpy.mockClear();
    });

    it('should continue processing when the data url is valid and content length is less than or equal to the size limit', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(true);
      await validateFromUrl('http://example.org/data.json', 'v1.0.0', {});
      expect(useRepoSpy).toHaveBeenCalledTimes(1);
    });

    it('should not continue processing when the data url is invalid', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(false);
      await validateFromUrl('http://example.org/data.json', 'v1.0.0', {});
      expect(useRepoSpy).toHaveBeenCalledTimes(0);
    });

    it('should download the data file when the data url is valid and the requested schema is available', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(true);
      useRepoSpy.mockResolvedValueOnce('schemapath.json');
      downloadDataSpy.mockResolvedValueOnce('data.json');
      await validateFromUrl('http://example.org/data.json', 'v1.0.0', {});
      expect(downloadDataSpy).toHaveBeenCalledTimes(1);
      expect(downloadDataSpy).toHaveBeenCalledWith(
        'http://example.org/data.json',
        expect.any(String)
      );
      expect(runContainerSpy).toHaveBeenCalledTimes(1);
      expect(runContainerSpy).toHaveBeenCalledWith('schemapath.json', 'data.json', undefined);
    });

    it('should not download the data file when the requested schema is not available', async () => {
      checkDataUrlSpy.mockResolvedValueOnce(true);
      await validateFromUrl('http://example.org/data.json', 'v1.0.0', {});
      expect(downloadDataSpy).toHaveBeenCalledTimes(0);
    });

    afterAll(() => {
      checkDataUrlSpy.mockRestore();
      useRepoSpy.mockRestore();
      downloadDataSpy.mockRestore();
      runContainerSpy.mockRestore();
    });
  });
});
