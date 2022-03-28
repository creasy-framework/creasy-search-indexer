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
  private readonly entities;

  constructor(
    private configService: ConfigService,
    private schemaService: SchemaService,
    private indexRepository: IndexRepository,
    private retryer: EntityIndexRetryer,
  ) {
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
  }

  private getStreamConfig(entityType: string): KafkaStreamsConfig {
    const brokers = this.configService.get<string>('event.brokers');
    return {
      noptions: {
        'metadata.broker.list': brokers,
        'group.id': `${entityType.toUpperCase()}_REACTOR`,
        'client.id': `${entityType.toUpperCase()}_REACTOR`,
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

  private async extract(
    rootEntityType: string,
    publishedEntityType: string,
    id: any,
    correlationId: string,
  ) {
    if (publishedEntityType === rootEntityType) {
      this.logger.log({
        msg: 'Received entity published event',
        rootEntityType,
        id,
        correlationId,
      });
      return [
        { correlationId, id, rootEntityType, entityType: publishedEntityType },
      ];
    } else {
      const dependencies = await this.schemaService.getDependencies(
        rootEntityType,
      );
      if (
        dependencies[publishedEntityType] &&
        dependencies[publishedEntityType].length > 0
      ) {
        this.logger.log({
          msg: 'Received dependent entity published event',
          rootEntityType,
          publishedEntityType,
          id,
          correlationId,
          paths: dependencies[publishedEntityType],
        });
        const ids = await this.indexRepository.getIdsByDependency(
          rootEntityType,
          publishedEntityType,
          id,
          dependencies[publishedEntityType],
        );
        return ids.map((id) => ({
          correlationId,
          id,
          rootEntityType,
          entityType: publishedEntityType,
        }));
      }
    }
    return Promise.resolve([]);
  }

  private async createStream(rootEntityType: string) {
    const kafkaStreams = new KafkaStreams(this.getStreamConfig(rootEntityType));
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
          return await this.extract(
            rootEntityType,
            entityType,
            id,
            correlationId,
          );
        } catch (error) {
          this.logger.error({
            msg: `Failed to extract indexing request ${entityType}(${id})`,
            error: error.message,
            stack: error.stack,
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
