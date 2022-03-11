import { ConfigObject } from '@nestjs/config';

export interface FieldIndexOption {
  name: string;
}

export interface IndexerConfiguration extends ConfigObject {
  brokers: string;
  entity: {
    type: string;
    store: string;
  };
  index: {
    type: 'elasticsearch';
    brokers: string[];
    fields: FieldIndexOption[];
  };
}
