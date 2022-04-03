import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { IndexFieldToGraphQLMapper } from './IndexFieldToGraphQLMapper';
import { EntityStoreHttpError } from './exceptions/EntityStoreHttpError';

@Injectable()
export class EntityRepository {
  private readonly logger = new Logger(EntityRepository.name);
  private readonly entities;
  private readonly entityStoreUrl;
  constructor(
    private configService: ConfigService,
    private mapper: IndexFieldToGraphQLMapper,
  ) {
    this.entities =
      this.configService.get<Record<string, any>>('index.entities');
    this.entityStoreUrl = this.configService.get<string>(
      'entity.store-address',
    );
  }

  async getEntityById(rootEntityType: string, id: any) {
    const indexFields = this.entities[rootEntityType]?.fields;
    const graphQLQuery = this.mapper.map(rootEntityType, id, indexFields);
    this.logger.log({
      msg: 'Querying entity',
      query: graphQLQuery,
    });
    const response = await fetch(`${this.entityStoreUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: graphQLQuery,
    });
    if (response.status === 200) {
      return await response.json();
    } else {
      this.logger.error({
        msg: 'Failed to fetching entity',
        status: response.status,
      });
      throw new EntityStoreHttpError();
    }
  }
}
