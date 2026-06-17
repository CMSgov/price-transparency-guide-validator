import 'jest-extended';
import { validateTocContents } from '../src/utils';
import { SchemaManager } from '../src/SchemaManager';
import { DockerManager } from '../src/DockerManager';
import { DownloadManager } from '../src/DownloadManager';

describe('utils', () => {
  let checkDataUrlSpy: jest.SpyInstance;
  let downloadDataFileSpy: jest.SpyInstance;
  let determineVersionSpy: jest.SpyInstance;
  let useVersionSpy: jest.SpyInstance;
  let useSchemaSpy: jest.SpyInstance;
  let runContainerSpy: jest.SpyInstance;

  beforeAll(() => {
    checkDataUrlSpy = jest.spyOn(DownloadManager.prototype, 'checkDataUrl').mockResolvedValue(true);
    downloadDataFileSpy = jest
      .spyOn(DownloadManager.prototype, 'downloadDataFile')
      .mockResolvedValue('data.json');
    determineVersionSpy = jest
      .spyOn(SchemaManager.prototype, 'determineVersion')
      .mockResolvedValue('v1.0.0');
    useVersionSpy = jest.spyOn(SchemaManager.prototype, 'useVersion').mockResolvedValue(true);
    useSchemaSpy = jest.spyOn(SchemaManager.prototype, 'useSchema').mockResolvedValue('schemaPath');
    runContainerSpy = jest
      .spyOn(DockerManager.prototype, 'runContainer')
      .mockResolvedValue({ pass: true, locations: { providerReference: [] } });
  });

  beforeEach(() => {
    checkDataUrlSpy.mockClear();
    downloadDataFileSpy.mockClear();
    determineVersionSpy.mockClear();
    useVersionSpy.mockClear();
    useSchemaSpy.mockClear();
    runContainerSpy.mockClear();
  });

  afterAll(() => {
    checkDataUrlSpy.mockRestore();
    downloadDataFileSpy.mockRestore();
    determineVersionSpy.mockRestore();
    useVersionSpy.mockRestore();
    useSchemaSpy.mockRestore();
    runContainerSpy.mockRestore();
  });

  it('uses v2.1.0 when referenced allowed-amounts file version is v2.0.0', async () => {
    determineVersionSpy.mockResolvedValueOnce('v1.0.0').mockResolvedValueOnce('v2.0.0');
    const schemaManager = new SchemaManager();
    schemaManager.shouldDetectVersion = true;
    const dockerManager = new DockerManager();
    const downloadManager = new DownloadManager(true);

    await validateTocContents(
      ['https://example.org/in-network-rates.json'],
      ['https://example.org/allowed-amounts.json'],
      schemaManager,
      dockerManager,
      downloadManager
    );

    expect(useVersionSpy).toHaveBeenNthCalledWith(1, 'v1.0.0');
    expect(useVersionSpy).toHaveBeenNthCalledWith(2, 'v2.1.0');
  });
});
