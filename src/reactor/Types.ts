import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

export type EntityFieldItem = JSONSchema7Definition & {
  refType?: string;
};

export type EntityFieldProperty = JSONSchema7Definition & {
  refType?: string;
  items?: EntityFieldItem;
};

export type EntityJSONSchema = JSONSchema7 & {
  idField?: string;
  properties?: {
    [key: string]: EntityFieldProperty;
  };
};

export interface EntitySchemaDto {
  entityType: string;
  entitySchema: EntityJSONSchema;
  version: number;
  fingerprint: string;
}

export interface IndexNotification {
  id: any;
  paths?: string[];
}
