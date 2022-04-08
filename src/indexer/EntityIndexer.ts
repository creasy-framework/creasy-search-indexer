import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import {
  ENTITY_INDEXING_EVENT_SUFFIX,
  ENTITY_INDEX_COMPLETED_EVENT_SUFFIX,
} from './Constants';
import { IndexMessage } from './Types';
import { streamConfigurationFactory } from '../configuration';
import { IndexExecutor } from './IndexExecutor';

@Injectable()
export class EntityIndexer {
  private readonly logger = new Logger(EntityIndexer.name);
  private readonly entities;

  constructor(
    private configService: ConfigService,
    private executor: IndexExecutor,
  ) {
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
  }

  private async createStream(rootEntityType: string) {
    const brokers = this.configService.get<string>('event.brokers');
    const kafkaStreams = new KafkaStreams(
      streamConfigurationFactory(
        brokers,
        `${rootEntityType.toUpperCase()}_INDEXER`,
      ),
    );
    (kafkaStreams as any).on('error', (error) =>
      this.logger.error({
        msg: 'Unexpected error in index stream',
        error: error.message,
        stack: error.stack,
      }),
    );
    const stream = kafkaStreams.getKStream(
      `${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
    );
    await stream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .asyncMap(
        async (message: IndexMessage) =>
          await this.executor.execute(rootEntityType, message),
      )
      .concatMap((messages) => {
        this.logger.log({
          msg: 'Entities have been indexed.',
          entityType: rootEntityType,
        });
        return stream.getNewMostFrom(messages);
      })
      .to(
        `${rootEntityType}${ENTITY_INDEX_COMPLETED_EVENT_SUFFIX}`,
        'auto',
        'buffer',
      );
    await stream.start();
    this.logger.log({ msg: `${rootEntityType} entity indexer started` });
  }

  async onModuleInit() {
    const promises = Object.keys(this.entities).map((entityType) =>
      this.createStream(entityType),
    );
    await Promise.all(promises);
  }
}
