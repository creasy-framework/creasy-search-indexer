import { Module } from '@nestjs/common';
import { ReactorModule } from './reactor';
import { IndexerModule } from './indexer';
import { ConfigModule } from '@nestjs/config';
import { appConfigurationFactory } from './configuration';
import { RetryerModule } from './retryer';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        quietReqLogger: true,
        autoLogging: false,
      },
    }),
    ConfigModule.forRoot({ load: [appConfigurationFactory], isGlobal: true }),
    RetryerModule,
    ReactorModule,
    IndexerModule,
  ],
})
export class AppModule {}
