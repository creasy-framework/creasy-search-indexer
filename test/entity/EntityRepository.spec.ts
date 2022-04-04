import { EntityRepository } from '../../src/entity/EntityRepository';
import fetch from 'node-fetch';
import { EntityStoreHttpError } from '../../src/entity/exceptions/EntityStoreHttpError';
jest.mock('node-fetch', () => jest.fn());

describe('EntityRepository', () => {
  let entityRepository;
  const mockGraphql = '{user (id: "123") {displayName}';
  const mockEntityStoreUrl = 'https://foo';
  const mockData = {
    data: {
      userList: [{ id: 1 }, { id: 2 }],
    },
  };
  const mockResponse = {
    ok: true,
    status: 200,
    json: () => mockData,
  };
  const mockEntities = {
    User: {
      fields: [
        { name: 'id' },
        { name: 'displayName' },
        { name: 'organization.id' },
        { name: 'organization.displayName' },
      ],
    },
  };
  const configService: any = {
    get: jest
      .fn()
      .mockImplementation((path: string) =>
        path === 'index.entities' ? mockEntities : mockEntityStoreUrl,
      ),
  };
  let graphqlMapper;
  describe('getEntityByIds', () => {
    beforeEach(() => {
      graphqlMapper = {
        map: jest.fn().mockReturnValue(mockGraphql),
      };
      (fetch as any).mockImplementation(() => Promise.resolve(mockResponse));
      entityRepository = new EntityRepository(configService, graphqlMapper);
    });
    it('should map method call map method with correct params', async () => {
      await entityRepository.getEntityByIds('User', ['1', '2']);
      expect(graphqlMapper.map).toBeCalledWith(
        'User',
        ['1', '2'],
        mockEntities.User.fields,
      );
    });
    it('should call entity store endpoint correctly', async () => {
      await entityRepository.getEntityByIds('User', ['1', '2']);
      expect(fetch).toBeCalledWith(`${mockEntityStoreUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: mockGraphql,
      });
    });
    it('should throw exception when response code is not 200', async () => {
      (fetch as any).mockImplementation(() =>
        Promise.resolve({
          ...mockResponse,
          status: 500,
        }),
      );
      await expect(
        entityRepository.getEntityByIds('User', ['1', '2']),
      ).rejects.toMatchObject(new EntityStoreHttpError());
    });
  });
});
