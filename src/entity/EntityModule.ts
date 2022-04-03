import { Module } from '@nestjs/common';
import { EntityRepository } from './EntityRepository';
import { SchemaService } from './SchemaService';
import { SchemaRepository } from './SchemaRepository';
import { IndexFieldToGraphQLMapper } from './IndexFieldToGraphQLMapper';

@Module({
  imports: [],
  providers: [
    EntityRepository,
    SchemaService,
    SchemaRepository,
    IndexFieldToGraphQLMapper,
  ],
  exports: [SchemaService, EntityRepository],
})
export class EntityModule {}
