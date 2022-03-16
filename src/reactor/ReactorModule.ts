import { Module } from '@nestjs/common';
import { EntityReactor } from './EntityReactor';
import { EntityModule } from '../entity/EntityModule';
import { IndexModule } from '../index';

@Module({
  imports: [EntityModule, IndexModule],
  providers: [EntityReactor],
  exports: [EntityReactor],
})
export class ReactorModule {}
