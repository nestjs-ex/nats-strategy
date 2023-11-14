import { NatsCodec } from './interfaces/nats-client.interface';
import { IncomingResponse } from '@nestjs/microservices/interfaces';
import { IncomingResponseDeserializer } from '@nestjs/microservices/deserializers/incoming-response.deserializer';
import * as nats from 'nats';

/**
 * @publicApi
 */
export class NatsResponseJSONDeserializer extends IncomingResponseDeserializer {
  private readonly jsonCodec: NatsCodec<unknown>;

  constructor() {
    super();

    this.jsonCodec = nats.JSONCodec();
  }

  deserialize(
    value: Uint8Array,
    options?: Record<string, any>,
  ): IncomingResponse {
    const decodedRequest = this.jsonCodec.decode(value);
    return super.deserialize(decodedRequest, options);
  }
}
