import { Injectable, Logger } from '@nestjs/common';
import { ENTITY_INDEXING_EVENT_SUFFIX } from './Constants';
import { IndexRepository } from '../index/IndexRepository';
import { IndexMessage } from './Types';
import { EntityIndexRetryQueue } from '../retryer/EntityIndexRetryQueue';
import { EntityRepository } from '../entity/EntityRepository';

@Injectable()
export class IndexExecutor {
  private readonly logger = new Logger(IndexExecutor.name);

  constructor(
    private entityRepository: EntityRepository,
    private indexRepository: IndexRepository,
    private retryQueue: EntityIndexRetryQueue,
  ) {}

  async execute(rootEntityType: string, message: IndexMessage) {
    const { ids, correlationId } = message;
    try {
      this.logger.log({
        msg: 'Received entity index event',
        ids,
        correlationId,
        payload: message,
      });
      const entities = await this.entityRepository.getEntityByIds(
        rootEntityType,
        ids,
      );

      const promises = entities.map(
        async (entity) =>
          await this.indexRepository.index(rootEntityType, entity.id, entity),
      );

      await Promise.all(promises);
    } catch (error) {
      this.logger.error({
        msg: `Failed to index entity ${rootEntityType}(${ids})`,
        correlationId,
        error: error.message,
        stack: error.stack,
      });
      this.retryQueue.push(
        `${rootEntityType}${ENTITY_INDEXING_EVENT_SUFFIX}`,
        message,
        error,
      );
    }
  }
}
