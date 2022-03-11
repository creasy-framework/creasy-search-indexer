import { Module } from '@nestjs/common';
import { ReactorModule } from './reactor';
import { IndexerModule } from './indexer';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationFactory } from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [ConfigurationFactory], isGlobal: true }),
    ReactorModule,
    IndexerModule,
  ],
})
export class AppModule {}
