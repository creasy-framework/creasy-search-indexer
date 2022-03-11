import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
@Injectable()
export class IndexRepository {
  private esClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const brokers: string[] = this.configService.get<string[]>('index.brokers');
    this.esClient = new Client({
      nodes: brokers,
    });
  }

  async index(entity: any) {
    await this.esClient.index({
      index: 'game-of-thrones',
      document: entity,
    });
  }
}
