import { Module } from '@nestjs/common';
import { IndexRepository } from './IndexRepository';
import { EntityModule } from '../entity';

@Module({
  imports: [EntityModule],
  providers: [IndexRepository],
  exports: [IndexRepository],
})
export class IndexModule {}
