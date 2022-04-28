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
      expect(runContainerSpy).toHaveBeenCalledTimes(1);
    });

    afterAll(() => {
      useRepoSpy.mockRestore();
      runContainerSpy.mockRestore();
    });
  });
});
