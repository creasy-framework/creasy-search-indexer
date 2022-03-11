import { Module } from '@nestjs/common';
import { EntityModule } from '../entity/EntityModule';
import { EntityIndexer } from './EntityIndexer';

@Module({
  imports: [EntityModule],
  providers: [EntityIndexer],
  exports: [EntityIndexer],
})
export class IndexerModule {}
