import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams, KafkaStreamsConfig, KStream } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import { INDEX_DLQ, INDEX_RETRY_QUEUE } from './Constants';
import { ENTITY_PUBLISHED_EVENT } from '../reactor/Constants';
import { ENTITY_INDEXING_EVENT_SUFFIX } from '../indexer/Constants';

@Injectable()
export class EntityIndexRetryer {
  private retryQueue: KStream;
  private readonly logger = new Logger(EntityIndexRetryer.name);
  private streams: KafkaStreams;
  private readonly maxRetries: number;
  private readonly retryInterval: number;
  constructor(private configService: ConfigService) {
    this.streams = new KafkaStreams(this.getStreamConfig());
    this.maxRetries = this.configService.get<number>(
      'index.retryPolicy.maxRetries',
      5,
    );
    this.retryInterval = this.configService.get<number>(
      'index.retryPolicy.retryInterval',
      1000,
    );
    (this.streams as any).on('error', (error) =>
      this.logger.error({
        message: 'Unexpected error in retry queue',
        error,
      }),
    );
  }

  private getStreamConfig(): KafkaStreamsConfig {
    const brokers = this.configService.get<string>('event.brokers');
    return {
      noptions: {
        'metadata.broker.list': brokers,
        'group.id': 'INDEX_RETRYER',
        'client.id': 'INDEX_RETRYER',
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

  async onModuleInit() {
    await this.initRetryQueue();
    await this.initRetryStream();
    this.logger.log({ message: 'Index retryer started' });
  }

  private async initRetryQueue() {
    this.retryQueue = this.streams.getKStream(null);
    await this.retryQueue.to(INDEX_RETRY_QUEUE, 'auto', 'buffer');
    await this.retryQueue.start();
  }

  private getJsonValueFromMessage(message) {
    try {
      const value = message?.value?.toString();
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  private shouldForwardToDLQ(messageValue) {
    const { originalMessage } = messageValue;
    const { tried = 1 } = originalMessage;
    return tried > this.maxRetries;
  }

  private shouldForwardToStream(streamName: string, message) {
    try {
      const value = this.getJsonValueFromMessage(message);
      const { targetQueue } = value;
      return targetQueue === streamName && !this.shouldForwardToDLQ(value);
    } catch {}
    return false;
  }

  private async initRetryStream() {
    const entityType = this.configService.get<string>('entity.type');
    const retryStream = this.streams.getKStream(INDEX_RETRY_QUEUE);
    const [reactStream, indexStream, dlqStream] = retryStream.branch([
      (message) => this.shouldForwardToStream(ENTITY_PUBLISHED_EVENT, message),
      (message) =>
        this.shouldForwardToStream(
          `${entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
          message,
        ),
      (message) =>
        this.shouldForwardToDLQ(this.getJsonValueFromMessage(message)),
    ]);

    await reactStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .asyncMap(({ originalMessage }) => this.waitAndTry(originalMessage))
      .to(ENTITY_PUBLISHED_EVENT, 1, 'buffer');

    await indexStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .asyncMap(({ originalMessage }) => this.waitAndTry(originalMessage))
      .to(`${entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`, 1, 'buffer');

    await dlqStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .tap((message) =>
        this.logger.log({ message: 'Moving to DLQ..', event: message }),
      )
      .to(INDEX_DLQ, 1, 'buffer');

    await retryStream.start();
  }

  private async waitAndTry(originalMessage) {
    return new Promise<any>((resolve) =>
      setTimeout(() => {
        const { tried = 1 } = originalMessage;
        this.logger.log({
          message: `Retrying ${JSON.stringify(originalMessage)}`,
        });
        resolve({
          ...originalMessage,
          tried: tried + 1,
        });
      }, this.retryInterval),
    );
  }

  retry(targetQueue, originalMessage, error) {
    this.retryQueue
      .wrapAsKafkaValue(INDEX_RETRY_QUEUE)
      .writeToStream({ targetQueue, originalMessage, error: error.message });
  }
}
