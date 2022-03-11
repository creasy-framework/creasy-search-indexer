import { Module } from '@nestjs/common';
import { EntityReactor } from './EntityReactor';
import { EntityModule } from '../entity/EntityModule';

@Module({
  imports: [EntityModule],
  providers: [EntityReactor],
  exports: [EntityReactor],
})
export class ReactorModule {}
