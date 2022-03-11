import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { FieldIndexOption } from '../configuration';
import { IndexFieldToGraphQLMapper } from './IndexFieldToGraphQLMapper';
import { EntityStoreHttpError } from './exceptions/EntityStoreHttpError';

@Injectable()
export class EntityRepository {
  private readonly logger = new Logger(EntityRepository.name);

  constructor(
    private configService: ConfigService,
    private mapper: IndexFieldToGraphQLMapper,
  ) {}

  async getEntityById(id: any) {
    const rootEntityType = this.configService.get<string>('entity.type');
    const entityStore = this.configService.get<string>('entity.store-address');
    const indexFields =
      this.configService.get<FieldIndexOption[]>('index.fields');
    const graphQLQuery = this.mapper.map(rootEntityType, id, indexFields);
    this.logger.log({
      message: 'Querying entity',
      query: graphQLQuery,
    });
    const response = await fetch(`${entityStore}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: graphQLQuery,
    });
    if (response.status === 200) {
      const results = await response.json();
      return results;
    } else {
      this.logger.error({
        message: 'Failed to fetching entity',
        status: response.status,
      });
      throw new EntityStoreHttpError();
    }
  }
}
