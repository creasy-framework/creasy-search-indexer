import { Module } from '@nestjs/common';
import { EntityIndexRetryer } from './EntityIndexRetryer';

@Module({
  imports: [],
  providers: [EntityIndexRetryer],
  exports: [EntityIndexRetryer],
})
export class RetryerModule {}
