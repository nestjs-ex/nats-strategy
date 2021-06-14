import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  PacketId,
  ReadPacket,
  WritePacket,
} from '@nestjs/microservices';
import { ERROR_EVENT, MESSAGE_EVENT } from '@nestjs/microservices/constants';
import { share, tap } from 'rxjs/operators';
import * as nats from 'nats';

import {
  NATS_CLIENT_MODULE_OPTIONS,
  NATS_DEFAULT_URL,
} from './nats-client.constants';
import { NatsClientModuleOptions } from './interfaces';

@Injectable()
export class NatsClient extends ClientProxy {
  protected readonly logger = new Logger(NatsClient.name);
  protected readonly url: string;
  protected natsClient: nats.NatsConnection;
  protected connection: Promise<nats.NatsConnection>;

  private readonly _jc = nats.JSONCodec();

  constructor(
    @Inject(NATS_CLIENT_MODULE_OPTIONS)
    protected readonly options: nats.ConnectionOptions,
  ) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  get instance() {
    return this.natsClient;
  }

  public close() {
    this.natsClient && this.natsClient.close();
    this.natsClient = null;
    this.connection = null;
  }

  public async connect(): Promise<any> {
    if (this.natsClient) {
      return this.connection;
    }

    try {
      this.natsClient = await this.createClient();
    } catch (err) {
      this.logger.error(err);
    }

    // this.connection = await this.connect$(this.natsClient)
    //   .pipe(share())
    //   .toPromise();

    this.connection = Promise.resolve(this.natsClient);

    return this.connection;
  }

  public async createClient(): Promise<nats.NatsConnection> {
    const options: any = this.options || ({} as nats.ConnectionOptions);
    return await nats.connect({
      ...options,
    });
  }

  protected publish(
    partialPacket: ReadPacket,
    callback: (packet: WritePacket) => any,
  ): Function {
    // const packet = this.assignPacketId(partialPacket);
    const channel = this.normalizePattern(partialPacket.pattern);
    const serializedPacket = this.serializer.serialize(partialPacket);

    this.natsClient
      .request(channel, this._jc.encode(serializedPacket), { timeout: 60000 }) // 60s timeout
      .then((msg) => {
        callback(this._jc.decode(msg.data));
      })
      .catch((err) => {
        callback({
          err,
          response: undefined,
          isDisposed: true,
        });
      });

    return () => undefined;
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket = this.serializer.serialize(packet);

    return this.natsClient.publish(pattern, this._jc.encode(serializedPacket));
  }
}
