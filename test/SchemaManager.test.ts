import 'jest-extended';
import path from 'path';
import temp from 'temp';
import util from 'util';
import child_process from 'child_process';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';
import { SchemaManager } from '../src/SchemaManager';

jest.mock('child_process');
const child_process_real = jest.requireActual('child_process');
const execP = util.promisify(child_process_real.exec);

describe('SchemaManager', () => {
  let repoDirectory: string;

  beforeAll(async () => {
    // set up our test repo with a sample schema
    temp.track();
    repoDirectory = temp.mkdirSync();
    const sampleSchema = JSON.parse(
      readFileSync(path.join(__dirname, 'fixtures', 'sampleSchema.json'), 'utf-8')
    );
    ensureDirSync(path.join(repoDirectory, 'schemas', 'something-good'));
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

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('#ensureRepo', () => {
    let mockedExec: jest.Mock;

    beforeAll(() => {
      mockedExec = child_process.exec as jest.Mocked<typeof child_process_real.mock>;
    });

    it('should not clone anything when the repo already exists', async () => {
      // basic callback mock, since we don't need anything more complex than that for testing
      mockedExec.mockImplementationOnce((_command: string, callback: any) => {
        if (callback) {
          callback(null, { stdout: 'ok' });
        }
      });
      const manager = new SchemaManager();
      await manager.ensureRepo();
      expect(mockedExec).toHaveBeenCalledTimes(0);
    });

    it('should clone the schema repo when it does not exist', async () => {
      // basic callback mock, since we don't need anything more complex than that for testing
      mockedExec.mockImplementationOnce((_command: string, callback: any) => {
        if (callback) {
          callback(null, { stdout: 'ok' });
        }
      });
      const differentFolder = temp.mkdirSync();
      const repoUrl = 'http://very.fake.url_goes_here';
      const manager = new SchemaManager(differentFolder, repoUrl);
      await manager.ensureRepo();
      expect(mockedExec).toHaveBeenCalledTimes(1);
      expect(mockedExec).toHaveBeenCalledWith(
        `git clone http://very.fake.url_goes_here "${differentFolder}"`,
        expect.anything()
      );
    });
  });

  describe('#useVersion', () => {
    beforeEach(() => {
      (child_process.exec as jest.Mocked<typeof child_process_real.exec>).mockImplementation(
        (command: string, callback: any) => {
          child_process_real.exec(
            command,
            (err: Error, stdout: string | Buffer, stderr: string | Buffer) => {
              if (callback) {
                callback(err, { stdout, stderr });
              }
            }
          );
        }
      );
    });

    afterEach(() => {
      (child_process.exec as jest.Mocked<typeof child_process_real.exec>).mockRestore();
    });

    it('should return true when the version exists in the repo', async () => {
      const schemaManager = new SchemaManager(repoDirectory);
      const result = await schemaManager.useVersion('v0.7');
      expect(result).toBeDefined();
    });

    it('should return false when the version does not exist in the repo', async () => {
      const schemaManager = new SchemaManager(repoDirectory);
      const result = await schemaManager.useVersion('v0.6');
      expect(result).toBeFalse();
    });
  });

  describe('#useSchema', () => {
    beforeEach(() => {
      (child_process.exec as jest.Mocked<typeof child_process_real.exec>).mockImplementation(
        (command: string, callback: any) => {
          child_process_real.exec(
            command,
            (err: Error, stdout: string | Buffer, stderr: string | Buffer) => {
              if (callback) {
                callback(err, { stdout, stderr });
              }
            }
          );
        }
      );
    });

    afterEach(() => {
      (child_process.exec as jest.Mocked<typeof child_process_real.exec>).mockRestore();
    });

    it('should return a path to the schema when the schema is available', async () => {
      const schemaManager = new SchemaManager(repoDirectory);
      await schemaManager.useVersion('v0.7');
      const result = await schemaManager.useSchema('something-good');
      const contents = JSON.parse(readFileSync(result, { encoding: 'utf-8' }));
      expect(contents.version).toBe('0.7');
    });

    it('should return a path to the schema in strict mode', async () => {
      const schemaManager = new SchemaManager(repoDirectory);
      schemaManager.strict = true;
      await schemaManager.useVersion('v1.0');
      const result = await schemaManager.useSchema('something-good');
      const contents = JSON.parse(readFileSync(result, { encoding: 'utf-8' }));
      expect(contents.version).toBe('1.0');
      expect(contents.additionalProperties).toBeFalse();
      expect(contents.definitions.food.additionalProperties).toBeFalse();
      expect(contents.definitions.garment.additionalProperties).toBeFalse();
    });

    it('should return null when the schema is not available', async () => {
      const schemaManager = new SchemaManager(repoDirectory);
      await schemaManager.useVersion('v0.7');
      const result = await schemaManager.useSchema('something-else');
      expect(result).toBeNull();
    });
  });
});
