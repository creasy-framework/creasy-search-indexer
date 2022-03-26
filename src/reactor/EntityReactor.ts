import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams, KafkaStreamsConfig } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import {
  ENTITY_PUBLISHED_EVENT,
  ENTITY_INDEXING_EVENT_SUFFIX,
} from './Constants';
import { SchemaService } from '../entity/SchemaService';
import { IndexRepository } from '../index/IndexRepository';
import { EntityIndexRetryer } from '../retryer/EntityIndexRetryer';

@Injectable()
export class EntityReactor {
  private readonly logger = new Logger(EntityReactor.name);
  private readonly entityType;

  constructor(
    private configService: ConfigService,
    private schemaService: SchemaService,
    private indexRepository: IndexRepository,
    private retryer: EntityIndexRetryer,
  ) {
    this.entityType = this.configService.get<string>('entity.type');
  }

  private getStreamConfig(): KafkaStreamsConfig {
    const brokers = this.configService.get<string>('event.brokers');
    return {
      noptions: {
        'metadata.broker.list': brokers,
        'group.id': `${this.entityType.toUpperCase()}_REACTOR`,
        'client.id': `${this.entityType.toUpperCase()}_REACTOR`,
        event_cb: true,
        'compression.codec': 'snappy',
        'api.version.request': true,
        'socket.keepalive.enable': true,
        'socket.blocking.max.ms': 100,
        'enable.auto.commit': false,
        'auto.commit.interval.ms': 100,
        'heartbeat.interval.ms': 250,
        'retry.backoff.ms': 250,
        'fetch.min.bytes': 100,
        'fetch.message.max.bytes': 2 * 1024 * 1024,
        'queued.min.messages': 100,
        'fetch.error.backoff.ms': 100,
        'queued.max.messages.kbytes': 50,
        'fetch.wait.max.ms': 1000,
        'queue.buffering.max.ms': 1000,
        'batch.num.messages': 10000,
      },
      tconf: {
        'auto.offset.reset': 'earliest',
        'request.required.acks': 1,
      },
      batchOptions: {
        batchSize: 1,
        commitEveryNBatch: 1,
        concurrency: 1,
        commitSync: false,
        noBatchCommits: false,
      },
    };
  }

  private async execute(entityType: string, id: any, correlationId: string) {
    if (entityType === this.entityType) {
      this.logger.log({
        msg: 'Received entity published event',
        entityType,
        id,
        correlationId,
      });
      return [{ correlationId, id }];
    } else {
      const dependencies = await this.schemaService.getDependencies();
      if (dependencies[entityType] && dependencies[entityType].length > 0) {
        this.logger.log({
          msg: 'Received dependent entity published event',
          entityType,
          id,
          correlationId,
          paths: dependencies[entityType],
        });
        const ids = await this.indexRepository.getIdsByDependency(
          this.entityType,
          entityType,
          id,
          dependencies[entityType],
        );
        return ids.map((id) => ({ correlationId, id }));
      }
    }
    return Promise.resolve([]);
  }

  private async createStream(entityType: string) {
    const kafkaStreams = new KafkaStreams(this.getStreamConfig());
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
      .asyncMap(async (message) => {
        const { correlationId, data } = message;
        const { entityType, id } = data;
        try {
          return await this.execute(entityType, id, correlationId);
        } catch (error) {
          this.logger.error({
            msg: `Failed to extract indexing request ${this.entityType}(${id})`,
            error: error.message,
            correlationId,
          });
          this.retryer.retry(ENTITY_PUBLISHED_EVENT, message, error);
          return Promise.resolve([]);
        }
      })
      .concatMap((messages) => {
        if (messages.length > 0) {
          this.logger.log({
            msg: `Resolved (${messages.length}) entity ids`,
            indexingEntities: messages,
          });
        }
        return entityStream.getNewMostFrom(messages);
      })
      .to(
        `${this.entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
        'auto',
        'buffer',
      );

    await entityStream.start();

    this.logger.log({ msg: `${entityType} entity reactor started` });
  }

  async onModuleInit() {
    await this.createStream(this.entityType);
  }
}
