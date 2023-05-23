import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  ClientProxy,
  // PacketId,
  ReadPacket,
  WritePacket,
} from '@nestjs/microservices';
// import { ERROR_EVENT, MESSAGE_EVENT } from '@nestjs/microservices/constants';
// import { share, tap } from 'rxjs/operators';
import * as nats from 'nats';

import {
  NATS_CLIENT_MODULE_OPTIONS,
  // NATS_DEFAULT_URL,
} from './nats-client.constants';
import { isObject } from '@nestjs/common/utils/shared.utils';
// import { NatsClientModuleOptions } from './interfaces';

@Injectable()
export class NatsClient extends ClientProxy implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(NatsClient.name);
  protected readonly url: string;
  protected natsClient: nats.NatsConnection;

  private readonly _jc = nats.JSONCodec();

  constructor(
    @Inject(NATS_CLIENT_MODULE_OPTIONS)
    protected readonly options: nats.ConnectionOptions,
  ) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  get instance() {
    return this.natsClient;
  }

  public async close() {
    await this.natsClient?.close();
    this.natsClient = null;
  }

  public async connect(): Promise<any> {
    if (this.natsClient) {
      return this.natsClient;
    }
    this.natsClient = await this.createClient();
    this.handleStatusUpdates(this.natsClient);
    return this.natsClient;
  }

  public async createClient(): Promise<nats.NatsConnection> {
    const options: any = this.options || ({} as nats.ConnectionOptions);
    return await nats.connect({
      ...options,
    });
  }

  public async handleStatusUpdates(client: nats.NatsConnection) {
    for await (const status of client.status()) {
      const data =
        status.data && isObject(status.data)
          ? JSON.stringify(status.data)
          : status.data;

      switch (status.type) {
        case 'error':
        case 'disconnect':
          this.logger.error(
            `NatsError: type: "${status.type}", data: "${data}".`,
          );
          break;

        case 'pingTimer':
          if (this.options.debug) {
            this.logger.debug(
              `NatsStatus: type: "${status.type}", data: "${data}".`,
            );
          }
          break;

        default:
          this.logger.log(
            `NatsStatus: type: "${status.type}", data: "${data}".`,
          );
          break;
      }
    }
  }

  protected publish(
    partialPacket: ReadPacket,
    callback: (packet: WritePacket) => any,
  ): () => void {
    // const packet = this.assignPacketId(partialPacket);
    const channel = this.normalizePattern(partialPacket.pattern);
    const serializedPacket = this.serializer.serialize(partialPacket);

    this.natsClient
      .request(channel, this._jc.encode(serializedPacket), { timeout: 3000 }) // 30s timeout
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
