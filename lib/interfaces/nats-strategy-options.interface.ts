import type { Deserializer, Serializer } from '@nestjs/microservices/interfaces';
import type { ConnectionOptions } from 'nats';

export interface NatsOptions extends ConnectionOptions {
  headers?: Record<string, string>;
  queue?: string;
  serializer?: Serializer;
  deserializer?: Deserializer;
}
