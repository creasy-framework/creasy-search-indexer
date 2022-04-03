import { Module } from '@nestjs/common';
import { EntityModule } from '../entity/EntityModule';
import { EntityIndexer } from './EntityIndexer';
import { IndexModule } from '../index';
import { RetryerModule } from '../retryer';
import { IndexExecutor } from './IndexExecutor';

@Module({
  imports: [EntityModule, IndexModule, RetryerModule],
  providers: [EntityIndexer, IndexExecutor],
  exports: [EntityIndexer],
})
export class IndexerModule {}
