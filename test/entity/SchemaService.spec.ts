import { SchemaService } from '../../src/entity/SchemaService';
import userSchema from '../__fixtures/entity-schemas/user-schema.json';
import organizationSchema from '../__fixtures/entity-schemas/organization-schema.json';
import groupSchema from '../__fixtures/entity-schemas/group-schema.json';
import unrelevantSchema from '../__fixtures/entity-schemas/unrelevant-schema.json';
import { EntitySchemaDto } from '../../src/entity/Types';

describe('SchemaService', () => {
  let schemaService: SchemaService;
  const schemas: EntitySchemaDto[] = [
    userSchema as EntitySchemaDto,
    organizationSchema as EntitySchemaDto,
    groupSchema as EntitySchemaDto,
    unrelevantSchema as EntitySchemaDto,
  ];
  let schemaRepository: any;
  beforeEach(() => {
    schemaRepository = {
      getEntitySchemas: jest.fn().mockResolvedValue(schemas),
    };
    schemaService = new SchemaService(schemaRepository);
  });
  it('getDependencies should return all dependencies field path', async () => {
    const actual = await schemaService.getDependencies('User');
    expect(actual).toEqual({
      Organization: ['organization'],
      Group: ['organization.group'],
      User: ['supervisor'],
    });
  });

  it('getSchemas should return all relevant schemas', async () => {
    const actual = await schemaService.getSchemas('User');
    expect(actual).toEqual([
      userSchema as EntitySchemaDto,
      organizationSchema as EntitySchemaDto,
      groupSchema as EntitySchemaDto,
    ]);
  });

  describe('isRelevant', () => {
    it('should return true if entity type is a dependency', async () => {
      const actual = await schemaService.isRelevant('User', 'Group');
      expect(actual).toEqual(true);
    });

    it('should return false if entity type is not a dependency', async () => {
      const actual = await schemaService.isRelevant('User', 'Misc');
      expect(actual).toEqual(false);
    });

    it('should return true if entity type is root entity', async () => {
      const actual = await schemaService.isRelevant('User', 'User');
      expect(actual).toEqual(true);
    });
  });
});
