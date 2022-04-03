import { Module } from '@nestjs/common';
import { EntityIndexRetryer } from './EntityIndexRetryer';
import { EntityIndexRetryQueue } from './EntityIndexRetryQueue';

@Module({
  imports: [],
  providers: [EntityIndexRetryer, EntityIndexRetryQueue],
  exports: [EntityIndexRetryQueue],
})
export class RetryerModule {}
