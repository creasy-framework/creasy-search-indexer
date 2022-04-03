import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import {
  ENTITY_PUBLISHED_EVENT,
  ENTITY_INDEXING_EVENT_SUFFIX,
} from './Constants';
import { MessageExtractor } from './MessageExtractor';
import { EntityPublishedMessage } from './Types';
import { streamConfigurationFactory } from '../configuration';

@Injectable()
export class EntityReactor {
  private readonly logger = new Logger(EntityReactor.name);
  private readonly entities;

  constructor(
    private configService: ConfigService,
    private extractor: MessageExtractor,
  ) {
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
  }

  private async createStream(rootEntityType: string) {
    const brokers = this.configService.get<string>('event.brokers');
    const kafkaStreams = new KafkaStreams(
      streamConfigurationFactory(
        brokers,
        `${rootEntityType.toUpperCase()}_REACTOR`,
      ),
    );
    const entityStream = kafkaStreams.getKStream();
    (kafkaStreams as any).on('error', (error) =>
      this.logger.error({
        msg: 'Unexpected error in reactor stream',
        error,
      }),
    );
    await entityStream
      .from(ENTITY_PUBLISHED_EVENT)
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .asyncMap(
        async (message: EntityPublishedMessage) =>
          await this.extractor.extract(rootEntityType, message),
      )
      .concatMap((messages) => {
        if (messages.length > 0) {
          this.logger.log({
            msg: `Resolved (${messages.length}) entity ids`,
            indexingEntities: messages,
          });
        }
        return entityStream.getNewMostFrom(messages);
      })
      .to(`${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`, 'auto', 'buffer');

    await entityStream.start();

    this.logger.log({ msg: `${rootEntityType} entity reactor started` });
  }

  async onModuleInit() {
    const promises = Object.keys(this.entities).map((entityType) =>
      this.createStream(entityType),
    );
    await Promise.all(promises);
  }
}
