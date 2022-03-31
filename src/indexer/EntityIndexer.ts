import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams, KafkaStreamsConfig } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import camelCase from 'camelcase';
import { ENTITY_INDEXING_EVENT_SUFFIX } from './Constants';
import { EntityService } from '../entity/EntityService';
import { IndexRepository } from '../index/IndexRepository';
import { IndexMessage } from './Types';
import { EntityIndexRetryer } from '../retryer/EntityIndexRetryer';

@Injectable()
export class EntityIndexer {
  private readonly logger = new Logger(EntityIndexer.name);
  private readonly entities;

  constructor(
    private configService: ConfigService,
    private entityService: EntityService,
    private indexRepository: IndexRepository,
    private retryer: EntityIndexRetryer,
  ) {
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
  }

  private getStreamConfig(rootEntityType: string): KafkaStreamsConfig {
    const brokers = this.configService.get<string>('event.brokers');
    return {
      noptions: {
        'metadata.broker.list': brokers,
        'group.id': `${rootEntityType.toUpperCase()}_INDEXER`,
        'client.id': `${rootEntityType.toUpperCase()}_INDEXER`,
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

  private async execute(rootEntityType: string, id: any) {
    const { data } = await this.entityService.getEntityById(rootEntityType, id);
    await this.indexRepository.index(
      rootEntityType,
      id,
      data[camelCase(rootEntityType)],
    );
  }

  private async createStream(rootEntityType: string) {
    const kafkaStreams = new KafkaStreams(this.getStreamConfig(rootEntityType));
    const stream = kafkaStreams.getKStream();
    stream
      .from(`${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`)
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .forEach((message: IndexMessage) => {
        const { id, correlationId } = message;
        this.logger.log({
          msg: 'Received entity index event',
          correlationId,
          payload: message,
        });
        this.execute(rootEntityType, id).catch((error) => {
          this.logger.error({
            msg: `Failed to index entity ${rootEntityType}(${id})`,
            correlationId,
            error: error.message,
          });
          this.retryer.retry(
            `${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
            message,
            error,
          );
        });
      })
      .catch((error) =>
        this.logger.error({
          msg: 'Unexpected error in index stream',
          error,
        }),
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
