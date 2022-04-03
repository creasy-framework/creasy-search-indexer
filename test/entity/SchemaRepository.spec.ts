import { SchemaRepository } from '../../src/entity/SchemaRepository';
import fetch from 'node-fetch';
import { EntityStoreHttpError } from '../../src/entity/exceptions/EntityStoreHttpError';
jest.mock('node-fetch', () => jest.fn());

describe('SchemaRepository', () => {
  const mockEntityStoreUrl = 'https://foo';
  const mockResponse = {
    ok: true,
    status: 200,
    json: () => ({}),
  };
  const configService: any = {
    get: jest.fn().mockReturnValue(mockEntityStoreUrl),
  };
  let schemeRepository;
  describe('getEntitySchemas', () => {
    beforeEach(() => {
      (fetch as any).mockImplementation(() => Promise.resolve(mockResponse));
      schemeRepository = new SchemaRepository(configService);
    });
    it('should call entity store endpoint correctly', async () => {
      await schemeRepository.getEntitySchemas();
      expect(fetch).toBeCalledWith(
        `${mockEntityStoreUrl}/entity-schema-registry`,
      );
    });
    it('should throw exception when response code is not 200', async () => {
      (fetch as any).mockImplementation(() =>
        Promise.resolve({
          ...mockResponse,
          status: 500,
        }),
      );
      await expect(schemeRepository.getEntitySchemas()).rejects.toMatchObject(
        new EntityStoreHttpError(),
      );
    });
  });
});
