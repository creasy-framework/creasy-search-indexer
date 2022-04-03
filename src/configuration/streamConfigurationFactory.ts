import { KafkaStreamsConfig } from 'kafka-streams';

const streamConfigurationFactory = (
  brokers: string,
  groupId: string,
  clientId = groupId,
): KafkaStreamsConfig => {
  return {
    noptions: {
      'metadata.broker.list': brokers,
      'group.id': groupId,
      'client.id': clientId,
      event_cb: true,
      'compression.codec': 'snappy',
      'api.version.request': true,
      'socket.keepalive.enable': true,
      'socket.blocking.max.ms': 100,
      'enable.auto.commit': false,
      'auto.commit.interval.ms': 100,
      'heartbeat.interval.ms': 250,
      'retry.backoff.ms': 250,
      'fetch.min.bytes': 100,
      'fetch.message.max.bytes': 2 * 1024 * 1024,
      'queued.min.messages': 100,
      'fetch.error.backoff.ms': 100,
      'queued.max.messages.kbytes': 50,
      'fetch.wait.max.ms': 1000,
      'queue.buffering.max.ms': 1000,
      'batch.num.messages': 10000,
    },
    tconf: {
      'auto.offset.reset': 'earliest',
      'request.required.acks': 1,
    },
    batchOptions: {
      batchSize: 1,
      commitEveryNBatch: 1,
      concurrency: 1,
      commitSync: false,
      noBatchCommits: false,
    },
  };
};

export default streamConfigurationFactory;
