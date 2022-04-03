import { IndexExecutor } from '../../src/indexer/IndexExecutor';
import { ENTITY_INDEXING_EVENT_SUFFIX } from '../../src/indexer/Constants';

describe('IndexExecutor', () => {
  const mockEntity = {
    id: '1',
    name: 'alex',
  };
  const entityRepository: any = {
    getEntityById: jest
      .fn()
      .mockImplementation((entityType: string, id: string) => {
        if (id === 'dirtyId') throw new Error('fake error');
        return {
          data: {
            user: mockEntity,
          },
        };
      }),
  };
  const indexRepository: any = {
    index: jest.fn(),
    getIdsByDependency: jest.fn(),
  };
  const retryQueue: any = {
    push: jest.fn(),
  };
  it('execute should fetch entity and index entity', async () => {
    await new IndexExecutor(
      entityRepository,
      indexRepository,
      retryQueue,
    ).execute('User', { id: '1', correlationId: 'bar' });

    expect(entityRepository.getEntityById).toBeCalledWith('User', '1');
    expect(indexRepository.index).toBeCalledWith('User', '1', mockEntity);
  });

  it('should retry when proceed failed', async () => {
    await new IndexExecutor(
      entityRepository,
      indexRepository,
      retryQueue,
    ).execute('User', { id: 'dirtyId', correlationId: 'bar' });
    expect(retryQueue.push).toBeCalledWith(
      `User${ENTITY_INDEXING_EVENT_SUFFIX}`,
      { id: 'dirtyId', correlationId: 'bar' },
      new Error('fake error'),
    );
  });
});
