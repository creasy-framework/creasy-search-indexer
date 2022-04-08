import { Injectable, Logger } from '@nestjs/common';
import { IndexRepository } from '../index/IndexRepository';
import { EntityPublishedMessage } from './Types';
import { ENTITY_CHANGED_EVENT } from './Constants';
import { EntityIndexRetryQueue } from '../retryer/EntityIndexRetryQueue';

@Injectable()
export class EntityRemover {
  private readonly logger = new Logger(EntityRemover.name);

  constructor(
    private indexRepository: IndexRepository,
    private retryQueue: EntityIndexRetryQueue,
  ) {}

  async remove(rootEntityType: string, message: EntityPublishedMessage) {
    const { correlationId, data } = message;
    const { entityType, id } = data;
    try {
      if (rootEntityType === entityType) {
        this.logger.error({
          msg: `Removing index for ${entityType}(${data?.id})`,
          correlationId,
        });
        await this.indexRepository.delete(entityType, id);
        return [
          {
            key: id.toString(),
            value: {
              id,
              correlationId,
              entityType: rootEntityType,
            },
          },
        ];
      }
    } catch (error) {
      this.logger.error({
        name: error.constructor.name,
        msg: `Failed to remove index for ${entityType}(${data?.id})`,
        error: error.message,
        stack: error.stack,
        correlationId,
      });
      this.retryQueue.push(ENTITY_CHANGED_EVENT, message, error);
    }
    return [];
  }
}
