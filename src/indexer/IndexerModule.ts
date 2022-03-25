import { Module } from '@nestjs/common';
import { EntityModule } from '../entity/EntityModule';
import { EntityIndexer } from './EntityIndexer';
import { IndexModule } from '../index';
import { RetryerModule } from '../retryer';

@Module({
  imports: [EntityModule, IndexModule, RetryerModule],
  providers: [EntityIndexer],
  exports: [EntityIndexer],
})
export class IndexerModule {}
