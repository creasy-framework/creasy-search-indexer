import { Module } from '@nestjs/common';
import { EntityReactor } from './EntityReactor';
import { EntityModule } from '../entity/EntityModule';
import { IndexModule } from '../index';
import { RetryerModule } from '../retryer';

@Module({
  imports: [EntityModule, IndexModule, RetryerModule],
  providers: [EntityReactor],
  exports: [EntityReactor],
})
export class ReactorModule {}
