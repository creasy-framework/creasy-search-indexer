import { MessageExtractor } from '../../src/reactor/MessageExtractor';
import { ENTITY_PUBLISHED_EVENT } from '../../src/reactor/Constants';

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
      .mockImplementation((indexName, dependentId, dependentPaths) => {
        if (dependentId === 'dirtyId') throw Error('fake error');
        return ['1', '2'];
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
    const actual = await extractor.extract('User', {
      correlationId: 'fake',
      data: {
        id: '1',
        entityType: 'User',
      },
    });
    expect(actual).toEqual([
      {
        key: '1',
        value: {
          correlationId: 'fake',
          id: '1',
          rootEntityType: 'User',
          entityType: 'User',
        },
      },
    ]);
  });

  it('should extract messages for dependent entity ', async () => {
    const actual = await extractor.extract('User', {
      correlationId: 'fake',
      data: {
        id: '1',
        entityType: 'Organization',
      },
    });
    expect(indexRepository.getIdsByDependency).toBeCalledWith('User', '1', [
      'organization',
    ]);
    expect(actual).toEqual([
      {
        key: '1',
        value: {
          correlationId: 'fake',
          id: '1',
          rootEntityType: 'User',
          entityType: 'Organization',
        },
      },
      {
        key: '2',
        value: {
          correlationId: 'fake',
          id: '2',
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
      },
    });
    expect(retryQueue.push).toBeCalledWith(
      ENTITY_PUBLISHED_EVENT,
      {
        correlationId: 'fake',
        data: {
          id: 'dirtyId',
          entityType: 'Organization',
        },
      },
      new Error('fake error'),
    );
  });
});
