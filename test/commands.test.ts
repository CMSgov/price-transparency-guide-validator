import 'jest-extended';
import path from 'path';
import * as validatorUtils from '../src/utils';
import { validate } from '../src/commands';

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

    it('should continue processing when the json data file exists', async () => {
      const options = { target: null };
      await validate(
        path.join(__dirname, '..', 'test-files', 'allowed-amounts.json'),
        'schema version 278',
        options
      );
      expect(useRepoSpy).toHaveBeenCalledTimes(1);
      expect(useRepoSpy).toHaveBeenLastCalledWith('schema version 278', null, 'json');
    });

    it('should continue processing when the xml data file exists', async () => {
      const options = { target: null };
      await validate(
        path.join(__dirname, '..', 'test-files', 'in-network-rates.xml'),
        'schema version 378',
        options
      );
      expect(useRepoSpy).toHaveBeenCalledTimes(1);
      expect(useRepoSpy).toHaveBeenLastCalledWith('schema version 378', null, 'xsd');
    });

    it('should not continue processing when the file exists, but has an unrecognized extension', async () => {
      await validate(
        path.join(__dirname, '..', 'test-files', 'some-other-file.txt'),
        'schema version 8',
        { target: null }
      );
      expect(useRepoSpy).toHaveBeenCalledTimes(0);
    });

    it('should continue processing when the file exists and a specific datatype is provided', async () => {
      const options = { target: null, format: 'xml' };
      await validate(
        path.join(__dirname, '..', 'test-files', 'some-other-file.txt'),
        'schema version 432',
        options
      );
      expect(useRepoSpy).toHaveBeenCalledTimes(1);
      expect(useRepoSpy).toHaveBeenLastCalledWith('schema version 432', null, 'xsd');
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
      const options = { target: null };
      const dataPath = path.join(__dirname, '..', 'test-files', 'allowed-amounts.json');
      useRepoSpy.mockResolvedValueOnce('good.json');
      await validate(dataPath, 'schema version 278', options);
      expect(runContainerSpy).toHaveBeenCalledTimes(1);
      expect(runContainerSpy).toHaveBeenLastCalledWith('good.json', dataPath, undefined, 'json');
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
});
