export interface EntityPublishedMessage {
  correlationId: string;
  data: {
    id: any;
    entityType: string;
  };
}
