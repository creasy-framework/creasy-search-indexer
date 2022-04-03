import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams, KStream } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import { INDEX_RETRY_QUEUE } from './Constants';
import { streamConfigurationFactory } from '../configuration';

@Injectable()
export class EntityIndexRetryQueue {
  private retryQueue: KStream;
  private readonly logger = new Logger(EntityIndexRetryQueue.name);
  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const brokers = this.configService.get<string>('event.brokers');
    const streams = new KafkaStreams(
      streamConfigurationFactory(brokers, 'INDEX_RETRY_QUEUE'),
    );
    (streams as any).on('error', (error) =>
      this.logger.error({
        msg: 'Unexpected error in retry queue',
        error,
      }),
    );
    this.retryQueue = streams.getKStream(null);
    await this.retryQueue.to(INDEX_RETRY_QUEUE, 'auto', 'buffer');
    await this.retryQueue.start();
    this.logger.log('Index retry queue is ready');
  }

  push(targetQueue, originalMessage, error) {
    this.retryQueue.wrapAsKafkaValue(INDEX_RETRY_QUEUE).writeToStream({
      key: targetQueue,
      value: { targetQueue, originalMessage, error: error.message },
    });
  }
}
