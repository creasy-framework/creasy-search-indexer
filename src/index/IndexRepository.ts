import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class IndexRepository {
  private esClient;
  private readonly DEFAULT_RESOLVE_IDS_BATCH_SIZE = 200;

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

  private async searchByDependent(
    indexName: string,
    dependentEntityId: any,
    dependentPaths: string[],
    size = 200,
    from = 0,
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
      size,
      from,
      _source: false,
      query,
    });
    const {
      hits: { hits = [], total },
    } = response;
    return {
      from,
      size,
      ids: hits.map(({ _id }) => _id),
      total: total?.value || 0,
    };
  }

  async getIdsByDependency(
    indexName: string,
    dependentEntityId: any,
    dependentPaths: string[],
  ) {
    const { ids = [], total } = await this.searchByDependent(
      indexName,
      dependentEntityId,
      dependentPaths,
      this.DEFAULT_RESOLVE_IDS_BATCH_SIZE,
      0,
    );

    const remains = total - this.DEFAULT_RESOLVE_IDS_BATCH_SIZE;

    const chunks =
      Math.floor(remains / this.DEFAULT_RESOLVE_IDS_BATCH_SIZE) +
      Math.min(1, remains % this.DEFAULT_RESOLVE_IDS_BATCH_SIZE);

    if (chunks > 0) {
      const results = Array(chunks)
        .fill(0)
        .reduce(async (promise, _, offset) => {
          const allIds = await promise;
          const { ids: idsForChunk = [] } = await this.searchByDependent(
            indexName,
            dependentEntityId,
            dependentPaths,
            this.DEFAULT_RESOLVE_IDS_BATCH_SIZE,
            (offset + 1) * this.DEFAULT_RESOLVE_IDS_BATCH_SIZE,
          );
          return [...allIds, ...idsForChunk];
        }, Promise.resolve(ids));

      return results;
    }
    return ids;
  }
}
