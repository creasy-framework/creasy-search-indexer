import { Injectable, Logger } from '@nestjs/common';
import { SchemaService } from '../entity/SchemaService';
import { IndexRepository } from '../index/IndexRepository';
import { EntityPublishedMessage } from './Types';
import { ENTITY_PUBLISHED_EVENT } from './Constants';
import { EntityIndexRetryQueue } from '../retryer/EntityIndexRetryQueue';

@Injectable()
export class MessageExtractor {
  private readonly logger = new Logger(MessageExtractor.name);

  constructor(
    private schemaService: SchemaService,
    private indexRepository: IndexRepository,
    private retryQueue: EntityIndexRetryQueue,
  ) {}

  async extract(rootEntityType: string, message: EntityPublishedMessage) {
    const { correlationId, data } = message;
    const { entityType } = data;
    try {
      const ids = await this.resolveIds(rootEntityType, message);
      return ids.map((id) => ({
        key: id,
        value: {
          correlationId,
          id,
          rootEntityType,
          entityType,
        },
      }));
    } catch (error) {
      this.logger.error({
        msg: `Failed to extract indexing request ${entityType}(${data?.id})`,
        error: error.message,
        stack: error.stack,
        correlationId,
      });
      this.retryQueue.push(ENTITY_PUBLISHED_EVENT, message, error);
      return [];
    }
  }

  private async resolveIds(
    rootEntityType: string,
    message: EntityPublishedMessage,
  ): Promise<any[]> {
    const { correlationId, data } = message;
    const { entityType: publishedEntityType, id } = data;
    if (publishedEntityType === rootEntityType) {
      this.logger.log({
        msg: 'Received entity published event',
        rootEntityType,
        id,
        correlationId,
      });
      return [id];
    } else {
      const dependencies = await this.schemaService.getDependencies(
        rootEntityType,
      );
      const paths = dependencies[publishedEntityType];
      if (paths && paths.length > 0) {
        this.logger.log({
          msg: 'Received dependent entity published event',
          rootEntityType,
          publishedEntityType,
          id,
          correlationId,
          paths,
        });
        return await this.indexRepository.getIdsByDependency(
          rootEntityType,
          id,
          paths,
        );
      }
    }
    return [];
  }
}
