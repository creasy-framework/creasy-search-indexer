import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import {
  ENTITY_CHANGED_EVENT, ENTITY_DELETED_EVENT_SUFFIX,
  ENTITY_INDEXING_EVENT_SUFFIX,
} from './Constants';
import { MessageExtractor } from './MessageExtractor';
import { EntityPublishedMessage, MUTATION_TYPE } from './Types';
import { streamConfigurationFactory } from '../configuration';
import { getJsonValueFromMessage } from '../common';
import { EntityRemover } from './EntityRemover';

@Injectable()
export class EntityReactor {
  private readonly logger = new Logger(EntityReactor.name);
  private readonly entities;
  private readonly brokers;

  constructor(
    private configService: ConfigService,
    private extractor: MessageExtractor,
    private remover: EntityRemover,
  ) {
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
    this.brokers = this.configService.get<string>('event.brokers');
  }

  private getMutationType(message) {
    const json = getJsonValueFromMessage(message) as EntityPublishedMessage;
    return json?.data?.mutationType;
  }

  private async createStream(rootEntityType: string) {
    const indexBatchSize = this.entities[rootEntityType]?.indexBatchSize || 1;
    const kafkaStreams = new KafkaStreams(
      streamConfigurationFactory(
        this.brokers,
        `${rootEntityType.toUpperCase()}_REACTOR`,
      ),
    );
    const entityStream = kafkaStreams.getKStream(ENTITY_CHANGED_EVENT);
    (kafkaStreams as any).on('error', (error) =>
      this.logger.error({
        msg: 'Unexpected error in reactor stream',
        error: error.message,
        stack: error.stack,
      }),
    );
    const [updateStream, removeStream] = entityStream.branch([
      (message) => this.getMutationType(message) === MUTATION_TYPE.UPSERT,
      (message) => this.getMutationType(message) === MUTATION_TYPE.REMOVE,
    ]);
    await updateStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .asyncMap(
        async (message: EntityPublishedMessage) =>
          await this.extractor.extract(rootEntityType, message, indexBatchSize),
      )
      .concatMap((messages) => {
        if (messages.length > 0) {
          this.logger.log({
            msg: `Resolved (${messages.length}) messages`,
          });
        }
        return entityStream.getNewMostFrom(messages);
      })
      .to(`${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`, 'auto', 'buffer');

    await removeStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .asyncMap((message: EntityPublishedMessage) =>
        this.remover.remove(rootEntityType, message),
      )
      .concatMap((messages) => {
        this.logger.log({
          msg: 'Entities have been deleted.',
          entityType: rootEntityType,
        });
        return entityStream.getNewMostFrom(messages);
      })
      .to(`${rootEntityType}${ENTITY_DELETED_EVENT_SUFFIX}`, 'auto', 'buffer');

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
