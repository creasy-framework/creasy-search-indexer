import { Module } from '@nestjs/common';
import { EntityRepository } from './EntityRepository';
import { SchemaService } from './SchemaService';
import { SchemaRepository } from './SchemaRepository';
import { IndexFieldToGraphQLMapper } from './IndexFieldToGraphQLMapper';
import { EntityService } from './EntityService';

@Module({
  imports: [],
  providers: [
    EntityService,
    EntityRepository,
    SchemaService,
    SchemaRepository,
    IndexFieldToGraphQLMapper,
  ],
  exports: [SchemaService, EntityService],
})
export class EntityModule {}
