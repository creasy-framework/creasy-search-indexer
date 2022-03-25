import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
@Injectable()
export class IndexRepository {
  private esClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const brokers: string[] = this.configService.get<string[]>('index.hosts');
    this.esClient = new Client({
      nodes: brokers,
    });
  }

  async index(indexName: string, docId: any, entity: any) {
    await this.esClient.index({
      index: indexName.toLowerCase(),
      id: docId,
      document: {
        ...entity,
      },
    });
  }

  async getIdsByDependency(
    indexName: string,
    dependentEntityType: string,
    dependentEntityId: any,
    dependentPaths: string[],
  ) {
    const fields = dependentPaths.map((path) => `${path}.id.keyword`);
    const query = {
      multi_match: {
        query: dependentEntityId,
        fields,
      },
    };
    const response = await this.esClient.search({
      index: indexName.toLowerCase(),
      _source: false,
      query,
    });
    const {
      hits: { hits },
    } = response;
    return hits.map(({ _id }) => _id);
  }
}
