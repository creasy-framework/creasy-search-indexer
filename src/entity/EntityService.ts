import { Injectable } from '@nestjs/common';
import { EntityRepository } from './EntityRepository';

@Injectable()
export class EntityService {
  constructor(private repository: EntityRepository) {}

  async getEntityById(entityType: string, id: any) {
    return await this.repository.getEntityById(entityType, id);
  }
}
