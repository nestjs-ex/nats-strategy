import { IncomingEvent, IncomingRequest } from '@nestjs/microservices/interfaces';
import { IncomingRequestDeserializer } from '@nestjs/microservices/deserializers/incoming-request.deserializer';
import * as nats from 'nats';

/**
 * @publicApi
 */
export class NatsRequestJSONDeserializer extends IncomingRequestDeserializer {
  private readonly jsonCodec: nats.Codec<unknown>;

  constructor() {
    super();

    this.jsonCodec = nats.JSONCodec();
  }

  deserialize(
    value: Uint8Array,
    options?: Record<string, any>,
  ): IncomingRequest | IncomingEvent {
    const decodedRequest = this.jsonCodec.decode(value);
    return super.deserialize(decodedRequest, options);
  }
}
