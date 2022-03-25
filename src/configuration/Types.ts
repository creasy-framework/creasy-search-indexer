import { ConfigObject } from '@nestjs/config';

export interface FieldIndexOption {
  name: string;
}

export interface RetryPolicy {
  maxRetries: number;
  retryInterval: number;
}

export interface IndexerConfiguration extends ConfigObject {
  entity: {
    type: string;
    store: string;
  };
  index: {
    provider: 'elasticsearch';
    brokers: string[];
    fields: FieldIndexOption[];
  };
  event: {
    provider: 'kafka';
    brokers: string;
    tryPolicy: RetryPolicy;
  };
}
