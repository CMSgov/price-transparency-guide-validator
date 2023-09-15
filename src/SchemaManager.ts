import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { config } from './utils';
import temp from 'temp';
import { logger } from './logger';
import JSONStream from 'JSONStream';

export class SchemaManager {
  private _version: string;
  private storageDirectory: string;
  public strict: boolean;
  public shouldDetectVersion: boolean;

  constructor(
    private repoDirectory = config.SCHEMA_REPO_FOLDER,
    private repoUrl = config.SCHEMA_REPO_URL
  ) {
    temp.track();
    this.storageDirectory = temp.mkdirSync('schemas');
  }

  public get version() {
    return this._version;
  }

  async ensureRepo() {
    if (!fs.existsSync(path.join(this.repoDirectory, '.git'))) {
      return util.promisify(exec)(`git clone ${this.repoUrl} "${this.repoDirectory}"`);
    }
  }

  async useVersion(version: string): Promise<boolean> {
    if (this._version === version) {
      return true;
    }
    const tagResult = await util.promisify(exec)(
      `git -C "${this.repoDirectory}" tag --list --sort=taggerdate`
    );
    const tags = tagResult.stdout
      .split('\n')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    if (tags.includes(version)) {
      await util.promisify(exec)(`git -C "${this.repoDirectory}" checkout ${version}`);
      this._version = version;
      return true;
    } else {
      // we didn't find your tag. maybe you mistyped it, so show the available ones.
      throw new Error(
        `Could not find a schema version named "${version}". Available versions are:\n${tags.join(
          '\n'
        )}`
      );
    }
  }

  async useSchema(schemaName: string): Promise<string> {
    const schemaPath = path.join(
      this.storageDirectory,
      `${schemaName}-${this._version}-${this.strict ? 'strict' : 'loose'}.json`
    );
    if (fs.existsSync(schemaPath)) {
      logger.debug(`Using cached schema: ${schemaName} ${this._version}`);
      return schemaPath;
    }
    const contentPath = path.join(this.repoDirectory, 'schemas', schemaName, `${schemaName}.json`);
    if (!fs.existsSync(contentPath)) {
      return null;
    }
    let schemaContents = fs.readFileSync(contentPath, 'utf-8');
    if (this.strict) {
      const modifiedSchema = JSON.parse(schemaContents);
      makeSchemaStrict(modifiedSchema);
      schemaContents = JSON.stringify(modifiedSchema);
    }

    fs.writeFileSync(schemaPath, schemaContents, { encoding: 'utf-8' });
    return schemaPath;
  }

  async determineVersion(dataFile: string): Promise<string> {
    logger.debug(`Detecting version for ${dataFile}`);
    const parser = JSONStream.parse('version');
    const dataStream = fs.createReadStream(dataFile);
    let foundVersion = '';

    return new Promise((resolve, reject) => {
      parser.on('data', (data: any) => {
        if (typeof data === 'string') {
          foundVersion = data;
        }
        dataStream.unpipe();
        dataStream.destroy();
        parser.end();
      });
      parser.on('close', () => {
        if (foundVersion) {
          logger.debug(`Found version: ${foundVersion}`);
          resolve(foundVersion);
        } else {
          reject('No version property available.');
        }
      });
      parser.on('error', () => {
        reject('Parse error when detecting version.');
      });
      dataStream.pipe(parser);
    });
  }
}

// note that this only sets additionalProperties to false at the top level, and at the first level of definitions.
// if there are nested definitions, those will not be modified.
function makeSchemaStrict(schema: any): void {
  if (typeof schema === 'object') {
    schema.additionalProperties = false;
    if (schema.definitions != null && typeof schema.definitions === 'object') {
      for (const defKey of Object.keys(schema.definitions)) {
        schema.definitions[defKey].additionalProperties = false;
      }
    }
  }
}
