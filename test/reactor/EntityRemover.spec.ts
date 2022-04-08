import { EntityRemover } from '../../src/reactor/EntityRemover';
import { MUTATION_TYPE } from '../../src/reactor/Types';
import { ENTITY_CHANGED_EVENT } from '../../src/reactor/Constants';

describe('EntityRemover', () => {
  let indexRepository: any;
  const retryQueue: any = {
    push: jest.fn(),
  };
  let remover;

  beforeEach(() => {
    indexRepository = {
      delete: jest.fn().mockImplementation((indexName, entityId) => {
        if (entityId === 'dirtyId') throw Error('fake error');
      }),
    };
    remover = new EntityRemover(indexRepository, retryQueue);
  });

  it('should call delete for root entity', async () => {
    await remover.remove(
      'User',
      {
        correlationId: 'fake',
        data: {
          id: '1',
          entityType: 'User',
          mutationType: MUTATION_TYPE.REMOVE,
        },
      },
      2,
    );
    expect(indexRepository.delete).toBeCalledWith('User', '1');
  });

  it('should ignore for other entities', async () => {
    await remover.remove(
      'User',
      {
        correlationId: 'fake',
        data: {
          id: '1',
          entityType: 'Organization',
          mutationType: MUTATION_TYPE.REMOVE,
        },
      },
      2,
    );
    expect(indexRepository.delete).not.toHaveBeenCalled();
  });

  it('should retry when proceed failed', async () => {
    await remover.remove('User', {
      correlationId: 'fake',
      data: {
        id: 'dirtyId',
        entityType: 'User',
        mutationType: MUTATION_TYPE.REMOVE,
      },
    });
    expect(retryQueue.push).toBeCalledWith(
      ENTITY_CHANGED_EVENT,
      {
        correlationId: 'fake',
        data: {
          id: 'dirtyId',
          entityType: 'User',
          mutationType: MUTATION_TYPE.REMOVE,
        },
      },
      new Error('fake error'),
    );
  });
});
