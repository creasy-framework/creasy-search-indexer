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
  const mockEsClient = {
    index: jest.fn(),
    search: jest
      .fn()
      .mockImplementation(({ from }) =>
        Promise.resolve(createMockSearchResponse(from)),
      ),
  };
  describe('getIdsByDependency', () => {
    const configService: any = {
      get: jest.fn().mockReturnValue('localhost'),
    };
    beforeEach(() => {
      (Client as any).mockReturnValue(mockEsClient);
      indexRepository = new IndexRepository(configService);
      indexRepository.onModuleInit();
    });
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
});
