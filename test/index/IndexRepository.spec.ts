import { IndexRepository } from '../../src/index/IndexRepository';
import { Client } from '@elastic/elasticsearch';
jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn(),
}));
describe('IndexRepository', () => {
  let indexRepository;
  const createMockSearchResponse = (offset = 0) => ({
    hits: {
      hits: Array(200)
        .fill(0)
        .map((_, i) => ({ _id: offset + i })),
      total: {
        value: 499,
      },
    },
  });
  const mockEntity = {
    id: '1',
    name: 'Foo',
  };
  let mockEsClient;
  const configService: any = {
    get: jest.fn().mockReturnValue('localhost'),
  };

  const setUpMock = () => {
    mockEsClient = {
      index: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      search: jest
        .fn()
        .mockImplementation(({ from }) =>
          Promise.resolve(createMockSearchResponse(from)),
        ),
    };
    (Client as any).mockReturnValue(mockEsClient);
    indexRepository = new IndexRepository(configService);
    indexRepository.onModuleInit();
  };

  describe('getIdsByDependency', () => {
    beforeEach(setUpMock);
    it('index', async () => {
      await indexRepository.index('User', '1', mockEntity);
      expect(mockEsClient.index).toBeCalledWith({
        index: 'user',
        id: '1',
        document: mockEntity,
      });
    });

    it('getIdsByDependency', async () => {
      await indexRepository.getIdsByDependency('user', '1', [
        'parentOrg',
        'childOrg',
      ]);
      expect(mockEsClient.search).toBeCalledTimes(3);
      [0, 200, 400].forEach((offset) =>
        expect(mockEsClient.search).toBeCalledWith({
          index: 'user',
          size: 200,
          from: offset,
          _source: false,
          query: {
            multi_match: {
              query: '1',
              fields: ['parentOrg.id.keyword', 'childOrg.id.keyword'],
            },
          },
        }),
      );
    });
  });

  describe('delete', () => {
    beforeEach(setUpMock);
    it('call delete if entity exists', async () => {
      mockEsClient.exists.mockImplementation(() => true);
      await indexRepository.delete('User', '1');
      expect(mockEsClient.exists).toBeCalledWith({
        index: 'user',
        id: '1',
      });
      expect(mockEsClient.delete).toBeCalledWith({
        index: 'user',
        id: '1',
      });
    });
    it('not call delete if entity exists', async () => {
      mockEsClient.exists.mockImplementation(() => false);
      await indexRepository.delete('User', '1');
      expect(mockEsClient.exists).toBeCalledWith({
        index: 'user',
        id: '1',
      });
      expect(mockEsClient.delete).not.toHaveBeenCalled();
    });
  });
});
