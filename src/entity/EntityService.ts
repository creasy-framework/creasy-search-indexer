import { Injectable } from '@nestjs/common';
import { EntityRepository } from './EntityRepository';

@Injectable()
export class EntityService {
  constructor(private repository: EntityRepository) {}

  async getEntityById(id: any) {
    return await this.repository.getEntityById(id);
  }
}
