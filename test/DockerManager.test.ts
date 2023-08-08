import 'jest-extended';
import path from 'path';
import { DockerManager } from '../src/DockerManager';

const SEP = path.sep;
const PROJECT_DIR = path.resolve(path.join(__dirname, '..'));

describe('DockerManager', () => {
  describe('#buildRunCommand', () => {
    it('should build the command to run the validation container', () => {
      const dockerManager = new DockerManager();
      dockerManager.containerId = 'dadb0d';
      const result = dockerManager.buildRunCommand(
        path.join('some', 'useful', 'schema.json'), // this is a relative path
        SEP + path.join('other', 'data', 'data.json'), // this is an absolute path
        path.join('results', 'output'), // this is a relative path
        'table-of-contents'
      );
      const expectedCommand = `docker run --rm -v "${path.join(
        PROJECT_DIR,
        'some',
        'useful'
      )}":/schema/ -v "${path.join(path.resolve(SEP), 'other', 'data')}":/data/ -v "${path.join(
        PROJECT_DIR,
        'results',
        'output'
      )}":/output/ dadb0d "schema/schema.json" "data/data.json" -o "output/" -s table-of-contents`;
      expect(result).toBe(expectedCommand);
    });
  });
});
