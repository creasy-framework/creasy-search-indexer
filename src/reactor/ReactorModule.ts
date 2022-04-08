import { Module } from '@nestjs/common';
import { EntityReactor } from './EntityReactor';
import { EntityModule } from '../entity/EntityModule';
import { IndexModule } from '../index';
import { RetryerModule } from '../retryer';
import { MessageExtractor } from './MessageExtractor';
import { EntityRemover } from './EntityRemover';

@Module({
  imports: [EntityModule, IndexModule, RetryerModule],
  providers: [EntityReactor, MessageExtractor, EntityRemover],
  exports: [EntityReactor],
})
export class ReactorModule {}
