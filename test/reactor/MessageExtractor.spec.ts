import { MessageExtractor } from '../../src/reactor/MessageExtractor';
import { ENTITY_CHANGED_EVENT } from '../../src/reactor/Constants';
import { MUTATION_TYPE } from '../../src/reactor/Types';

describe('MessageExtractor', () => {
  const schemaServices: any = {
    getDependencies: jest.fn().mockReturnValue({
      Organization: ['organization'],
    }),
  };
  const indexRepository: any = {
    index: jest.fn(),
    getIdsByDependency: jest
      .fn()
      .mockImplementation((indexName, dependentId) => {
        if (dependentId === 'dirtyId') throw Error('fake error');
        return ['1', '2', '3'];
      }),
  };
  const retryQueue: any = {
    push: jest.fn(),
  };
  let extractor;

  beforeEach(() => {
    extractor = new MessageExtractor(
      schemaServices,
      indexRepository,
      retryQueue,
    );
  });

  it('should return single message for root entity ', async () => {
    const actual = await extractor.extract(
      'User',
      {
        correlationId: 'fake',
        data: {
          id: '1',
          entityType: 'User',
          mutationType: MUTATION_TYPE.UPSERT,
        },
      },
      2,
    );
    expect(actual).toEqual([
      {
        key: '1',
        value: {
          correlationId: 'fake',
          ids: ['1'],
          rootEntityType: 'User',
          entityType: 'User',
        },
      },
    ]);
  });

  it('should extract messages for dependent entity ', async () => {
    const actual = await extractor.extract(
      'User',
      {
        correlationId: 'fake',
        data: {
          id: '1',
          entityType: 'Organization',
          mutationType: MUTATION_TYPE.UPSERT,
        },
      },
      2,
    );
    expect(indexRepository.getIdsByDependency).toBeCalledWith('User', '1', [
      'organization',
    ]);
    expect(actual).toEqual([
      {
        key: '1,2',
        value: {
          correlationId: 'fake',
          ids: ['1', '2'],
          rootEntityType: 'User',
          entityType: 'Organization',
        },
      },
      {
        key: '3',
        value: {
          correlationId: 'fake',
          ids: ['3'],
          rootEntityType: 'User',
          entityType: 'Organization',
        },
      },
    ]);
  });

  it('should retry when proceed failed', async () => {
    await extractor.extract('User', {
      correlationId: 'fake',
      data: {
        id: 'dirtyId',
        entityType: 'Organization',
        mutationType: MUTATION_TYPE.UPSERT,
      },
    });
    expect(retryQueue.push).toBeCalledWith(
      ENTITY_CHANGED_EVENT,
      {
        correlationId: 'fake',
        data: {
          id: 'dirtyId',
          entityType: 'Organization',
          mutationType: MUTATION_TYPE.UPSERT,
        },
      },
      new Error('fake error'),
    );
  });
});
