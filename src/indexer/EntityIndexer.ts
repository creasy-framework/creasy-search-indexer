import { Injectable, Logger } from '@nestjs/common';
import { KafkaStreams } from 'kafka-streams';
import { ConfigService } from '@nestjs/config';
import { ENTITY_INDEXING_EVENT_SUFFIX } from './Constants';
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
    const stream = kafkaStreams.getKStream();
    stream
      .from(`${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`)
      .mapJSONConvenience()
      .mapWrapKafkaValue()
      .forEach((message: IndexMessage) =>
        this.executor.execute(rootEntityType, message),
      )
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
