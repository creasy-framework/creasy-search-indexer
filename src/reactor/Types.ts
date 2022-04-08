export enum MUTATION_TYPE {
  UPSERT = 'upsert',
  REMOVE = 'remove',
}

export interface EntityPublishedMessage {
  correlationId: string;
  data: {
    id: any;
    entityType: string;
    mutationType: MUTATION_TYPE;
  };
}
