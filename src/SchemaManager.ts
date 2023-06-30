import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { config } from './utils';
import temp from 'temp';

export class SchemaManager {
  private version: string;
  private storageDirectory: string;

  constructor(
    private repoDirectory = config.SCHEMA_REPO_FOLDER,
    private repoUrl = config.SCHEMA_REPO_URL
  ) {
    temp.track();
    this.storageDirectory = temp.mkdirSync('schemas');
  }

  async ensureRepo() {
    if (!fs.existsSync(path.join(this.repoDirectory, '.git'))) {
      return util.promisify(exec)(`git clone ${this.repoUrl} "${this.repoDirectory}"`);
    }
  }

  async useVersion(version: string): Promise<boolean> {
    if (this.version === version) {
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
      this.version = version;
      return true;
    } else {
      // we didn't find your tag. maybe you mistyped it, so show the available ones.
      console.log(
        `Could not find a schema version named "${version}". Available versions are:\n${tags.join(
          '\n'
        )}`
      );
      return false;
    }
  }

  async useSchema(schemaName: string, strict = false): Promise<string> {
    const schemaPath = path.join(
      this.storageDirectory,
      `${schemaName}-${this.version}-${strict ? 'strict' : 'loose'}.json`
    );
    if (fs.existsSync(schemaPath)) {
      return schemaPath;
    }
    let schemaContents = fs.readFileSync(
      path.join(this.repoDirectory, 'schemas', schemaName, `${schemaName}.json`),
      'utf-8'
    );
    if (strict) {
      const modifiedSchema = JSON.parse(schemaContents);
      makeSchemaStrict(modifiedSchema);
      schemaContents = JSON.stringify(modifiedSchema);
    }

    fs.writeFileSync(schemaPath, schemaContents, { encoding: 'utf-8' });
    return schemaPath;
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
