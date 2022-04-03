import { Injectable, Logger } from '@nestjs/common';
import camelCase from 'camelcase';
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
    const { id, correlationId } = message;
    try {
      this.logger.log({
        msg: 'Received entity index event',
        correlationId,
        payload: message,
      });
      const { data } = await this.entityRepository.getEntityById(
        rootEntityType,
        id,
      );
      await this.indexRepository.index(
        rootEntityType,
        id,
        data[camelCase(rootEntityType)],
      );
    } catch (error) {
      this.logger.error({
        msg: `Failed to index entity ${rootEntityType}(${id})`,
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
