import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { isObject } from '@nestjs/common/utils/shared.utils';
import {
  ClientProxy,
  PacketId,
  ReadPacket,
  WritePacket,
} from '@nestjs/microservices';
import { EmptyResponseException } from '@nestjs/microservices/errors/empty-response.exception';
import * as nats from 'nats';
import { NATS_CLIENT_MODULE_OPTIONS } from './nats-client.constants';
import { NatsClientOptions } from './interfaces/nats-client-options.interface';
import { NatsRecord } from './nats.record-builder';
import { NatsRecordSerializer } from './nats-record.serializer';
import { NatsResponseJSONDeserializer } from './nats-response-json.deserializer';

@Injectable()
export class NatsClient
  extends ClientProxy
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger = new Logger(NatsClient.name);
  protected natsClient: nats.NatsConnection;

  constructor(
    @Inject(NATS_CLIENT_MODULE_OPTIONS)
    protected readonly options: NatsClientOptions,
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
    const options: any = this.options || ({} as NatsClientOptions);
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

  public createSubscriptionHandler(
    packet: ReadPacket & PacketId,
    callback: (packet: WritePacket) => any,
  ) {
    return async (error: unknown | undefined, natsMsg: nats.Msg) => {
      if (error) {
        return callback({
          err: error,
        });
      }
      const rawPacket = natsMsg.data;
      if (rawPacket?.length === 0) {
        return callback({
          err: new EmptyResponseException(
            this.normalizePattern(packet.pattern),
          ),
          isDisposed: true,
        });
      }
      const message = await this.deserializer.deserialize(rawPacket);
      if (message.id && message.id !== packet.id) {
        return undefined;
      }
      const { err, response, isDisposed } = message;
      if (isDisposed || err) {
        return callback({
          err,
          response,
          isDisposed: true,
        });
      }
      callback({
        err,
        response,
      });
    };
  }

  protected publish(
    partialPacket: ReadPacket,
    callback: (packet: WritePacket) => any,
  ): () => void {
    try {
      const packet = this.assignPacketId(partialPacket);
      const channel = this.normalizePattern(partialPacket.pattern);
      const serializedPacket: NatsRecord = this.serializer.serialize(packet);
      const inbox = nats.createInbox();

      const subscriptionHandler = this.createSubscriptionHandler(
        packet,
        callback,
      );

      const subscription = this.natsClient.subscribe(inbox, {
        callback: subscriptionHandler,
      });

      const headers = this.mergeHeaders(serializedPacket.headers);
      this.natsClient.publish(channel, serializedPacket.data, {
        reply: inbox,
        headers,
      });

      return () => subscription.unsubscribe();
    } catch (err) {
      callback({ err });
    }
  }

  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket: NatsRecord = this.serializer.serialize(packet);
    const headers = this.mergeHeaders(serializedPacket.headers);

    return new Promise<void>((resolve, reject) => {
      try {
        this.natsClient.publish(pattern, serializedPacket.data, {
          headers,
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  protected initializeSerializer(options: NatsClientOptions) {
    this.serializer = options?.serializer ?? new NatsRecordSerializer();
  }

  protected initializeDeserializer(options: NatsClientOptions) {
    this.deserializer =
      options?.deserializer ?? new NatsResponseJSONDeserializer();
  }

  protected mergeHeaders<THeaders = any>(requestHeaders?: THeaders) {
    if (!requestHeaders && !this.options?.headers) {
      return undefined;
    }

    const headers = (requestHeaders as nats.MsgHdrs) ?? nats.headers();

    for (const [key, value] of Object.entries(this.options?.headers || {})) {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }

    return headers;
  }
}
