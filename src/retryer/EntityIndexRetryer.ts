import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import { INDEX_DLQ, INDEX_RETRY_QUEUE } from './Constants';
import { ENTITY_CHANGED_EVENT } from '../reactor/Constants';
import { ENTITY_INDEXING_EVENT_SUFFIX } from '../indexer/Constants';
import { streamConfigurationFactory } from '../configuration';
import { getJsonValueFromMessage } from '../common';

@Injectable()
export class EntityIndexRetryer {
  private readonly logger = new Logger(EntityIndexRetryer.name);
  private streams: KafkaStreams;
  private readonly maxRetries: number;
  private readonly retryInterval: number;
  private readonly entities;
  constructor(private configService: ConfigService) {
    const brokers = this.configService.get<string>('event.brokers');
    this.streams = new KafkaStreams(
      streamConfigurationFactory(brokers, 'INDEX_RETRYER'),
    );
    this.maxRetries = this.configService.get<number>(
      'index.retryPolicy.maxRetries',
      5,
    );
    this.retryInterval = this.configService.get<number>(
      'index.retryPolicy.retryInterval',
      1000,
    );
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
    (this.streams as any).on('error', (error) =>
      this.logger.error({
        msg: 'Unexpected error in retry queue',
        error: error.message,
        stack: error.stack,
      }),
    );
  }

  async onModuleInit() {
    await this.initRetryStream();
    this.logger.log('Index retryer started.');
  }

  private shouldForwardToDLQ(messageValue) {
    const { originalMessage } = messageValue;
    const { tried = 1 } = originalMessage;
    return tried > this.maxRetries;
  }

  private shouldForwardToStream(streamName: string, message) {
    try {
      const value = getJsonValueFromMessage(message);
      const { targetQueue } = value;
      return targetQueue === streamName && !this.shouldForwardToDLQ(value);
    } catch {}
    return false;
  }

  private shouldSkip(messageA, messageB) {
    return (
      JSON.stringify(messageA?.originalMessage) ===
      JSON.stringify(messageB?.originalMessage)
    );
  }

  private async initRetryStream() {
    const retryStream = this.streams.getKStream(INDEX_RETRY_QUEUE);
    const [dlqStream, reactStream, ...indexStreams] = retryStream.branch([
      (message) => this.shouldForwardToDLQ(getJsonValueFromMessage(message)),
      (message) => this.shouldForwardToStream(ENTITY_CHANGED_EVENT, message),
      ...Object.keys(this.entities).map(
        (entityType) => (message) =>
          this.shouldForwardToStream(
            `${entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
            message,
          ),
      ),
    ]);

    await dlqStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .skipRepeatsWith(this.shouldSkip)
      .tap((message) =>
        this.logger.log({ msg: 'Moving to DLQ..', event: message }),
      )
      .to(INDEX_DLQ, 'auto', 'buffer');

    await reactStream
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .skipRepeatsWith(this.shouldSkip)
      .asyncMap(({ originalMessage }) => this.waitAndTry(originalMessage))
      .to(ENTITY_CHANGED_EVENT, 'auto', 'buffer');

    const promises = Object.keys(this.entities).map((entityType, i) => {
      return indexStreams[i]
        .mapJSONConvenience()
        .mapWrapKafkaValue()
        .asyncMap(({ originalMessage }) => this.waitAndTry(originalMessage))
        .to(`${entityType}${ENTITY_INDEXING_EVENT_SUFFIX}`, 'auto', 'buffer');
    });

    await Promise.all(promises);
    await retryStream.start();
  }

  private async waitAndTry(originalMessage) {
    return new Promise<any>((resolve) =>
      setTimeout(() => {
        const { tried = 1 } = originalMessage;
        this.logger.log({
          msg: `Retrying ${JSON.stringify(originalMessage)}`,
        });
        resolve({
          ...originalMessage,
          tried: tried + 1,
        });
      }, this.retryInterval),
    );
  }
}
