import { EntityRepository } from '../../src/entity/EntityRepository';
import fetch from 'node-fetch';
import { EntityStoreHttpError } from '../../src/entity/exceptions/EntityStoreHttpError';
jest.mock('node-fetch', () => jest.fn());

describe('EntityRepository', () => {
  let entityRepository;
  const mockGraphql = '{user (id: "123") {displayName}';
  const mockEntityStoreUrl = 'https://foo';
  const mockResponse = {
    ok: true,
    status: 200,
    json: () => ({}),
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
  describe('getEntityById', () => {
    beforeEach(() => {
      graphqlMapper = {
        map: jest.fn().mockReturnValue(mockGraphql),
      };
      (fetch as any).mockImplementation(() => Promise.resolve(mockResponse));
      entityRepository = new EntityRepository(configService, graphqlMapper);
    });
    it('should map method call map method with correct params', async () => {
      await entityRepository.getEntityById('User', '1');
      expect(graphqlMapper.map).toBeCalledWith(
        'User',
        '1',
        mockEntities.User.fields,
      );
    });
    it('should call entity store endpoint correctly', async () => {
      await entityRepository.getEntityById('User', '1');
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
        entityRepository.getEntityById('User', '1'),
      ).rejects.toMatchObject(new EntityStoreHttpError());
    });
  });
});
