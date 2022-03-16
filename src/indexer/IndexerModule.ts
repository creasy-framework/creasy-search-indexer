import { Module } from '@nestjs/common';
import { EntityModule } from '../entity/EntityModule';
import { EntityIndexer } from './EntityIndexer';
import { IndexModule } from '../index';

@Module({
  imports: [EntityModule, IndexModule],
  providers: [EntityIndexer],
  exports: [EntityIndexer],
})
export class IndexerModule {}
