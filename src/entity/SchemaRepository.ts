import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { EntityStoreHttpError } from './exceptions/EntityStoreHttpError';
import { EntitySchemaDto } from './Types';

@Injectable()
export class SchemaRepository {
  private readonly logger = new Logger(SchemaRepository.name);
  private readonly entityStoreUrl;

  constructor(private configService: ConfigService) {
    this.entityStoreUrl = this.configService.get<string>(
      'entity.store-address',
    );
  }

  async getEntitySchemas(): Promise<EntitySchemaDto[]> {
    const response = await fetch(
      `${this.entityStoreUrl}/entity-schema-registry`,
    );
    if (response.status === 200) {
      const results = await response.json();
      return results as EntitySchemaDto[];
    } else {
      this.logger.error({
        msg: 'Failed to fetching schemas',
      });
      throw new EntityStoreHttpError();
    }
  }
}
