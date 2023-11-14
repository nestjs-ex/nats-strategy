import { isObject } from '@nestjs/common/utils/shared.utils';
import { ReadPacket, Serializer } from '@nestjs/microservices/interfaces';
import { NatsRecord, NatsRecordBuilder } from './nats.record-builder';
import * as nats from 'nats';

export class NatsRecordSerializer
  implements Serializer<ReadPacket, NatsRecord>
{
  private readonly jsonCodec: nats.Codec<unknown>;

  constructor() {
    this.jsonCodec = nats.JSONCodec();
  }

  serialize(packet: ReadPacket | any): NatsRecord {
    const natsMessage =
      packet?.data && isObject(packet.data) && packet.data instanceof NatsRecord
        ? (packet.data as NatsRecord)
        : new NatsRecordBuilder(packet?.data).build();

    return {
      data: this.jsonCodec.encode({ ...packet, data: natsMessage.data }),
      headers: natsMessage.headers,
    };
  }
}
