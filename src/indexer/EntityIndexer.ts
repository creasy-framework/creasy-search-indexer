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
  private readonly entityType;

  constructor(
    private configService: ConfigService,
    private entityService: EntityService,
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
        'group.id': `${this.entityType.toUpperCase()}_INDEXER`,
        'client.id': `${this.entityType.toUpperCase()}_INDEXER`,
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

  private async execute(id: any) {
    const { data } = await this.entityService.getEntityById(id);
    await this.indexRepository.index(
      this.entityType,
      id,
      data[camelCase(this.entityType)],
    );
  }

  private async createStream(entityType: string) {
    const kafkaStreams = new KafkaStreams(this.getStreamConfig());
    const stream = kafkaStreams.getKStream();
    stream
      .from(`${this.entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`)
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .forEach((message: IndexMessage) => {
        this.logger.log({
          message: 'Received entity index event',
          payload: message,
        });
        const { id } = message;
        this.execute(id).catch((error) => {
          this.logger.error({
            message: `Failed to index entity ${this.entityType}(${id})`,
            error: error,
          });
          this.retryer.retry(
            `${this.entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
            message,
            error,
          );
        });
      })
      .catch((error) =>
        this.logger.error({
          message: 'Unexpected error in index stream',
          error,
        }),
      );
    await stream.start();
    this.logger.log({ message: `${entityType} entity indexer started` });
  }

  async onModuleInit() {
    await this.createStream(this.entityType);
  }
}
