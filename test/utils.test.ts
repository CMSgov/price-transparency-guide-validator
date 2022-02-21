import 'jest-extended';
import path from 'path';

import { buildRunCommand } from '../src/utils';

const SEP = path.sep;
const PROJECT_DIR = path.resolve(path.join(__dirname, '..'));

describe('utils', () => {
  describe('#buildRunCommand', () => {
    it('should build the command to run the validation container without an output path', () => {
      const result = buildRunCommand(
        SEP + path.join('some', 'useful', 'schema.json'), // this is an absolute path
        path.join('my', 'data.json'), // this is a relative path
        '',
        'bad1dea'
      );
      // since the container is running linux, it should always use / as its path separator.
      // but, the paths on the host system should be built by path
      const expectedCommand = `docker run -v "${path.join(
        path.resolve(SEP),
        'some',
        'useful'
      )}":/schema/ -v "${path.join(
        PROJECT_DIR,
        'my'
      )}":/data/ bad1dea "schema/schema.json" "data/data.json"`;
      expect(result).toBe(expectedCommand);
    });

    it('should build the command to run the validation container with an output path', () => {
      const result = buildRunCommand(
        path.join('some', 'useful', 'schema.json'), // this is a relative path
        SEP + path.join('other', 'data', 'data.json'), // this is an absolute path
        path.join('results', 'output.txt'), // this is a relative path
        'dadb0d'
      );
      const expectedCommand = `docker run -v "${path.join(
        PROJECT_DIR,
        'some',
        'useful'
      )}":/schema/ -v "${path.join(path.resolve(SEP), 'other', 'data')}":/data/ -v "${path.join(
        PROJECT_DIR,
        'results'
      )}":/output/ dadb0d "schema/schema.json" "data/data.json" -o "output/output.txt"`;
      expect(result).toBe(expectedCommand);
    });
  });
});
