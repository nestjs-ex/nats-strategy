import {
  Server,
  CustomTransportStrategy,
  IncomingRequest,
  Transport,
} from '@nestjs/microservices';
import { NO_MESSAGE_HANDLER } from '@nestjs/microservices/constants';
import { isUndefined, isObject } from '@nestjs/common/utils/shared.utils';
import * as nats from 'nats';
import { NatsContext } from './nats.context';
import { NatsOptions } from './interfaces/nats-strategy-options.interface';
import { NatsRecordSerializer } from './nats-record.serializer';
import { NatsRequestJSONDeserializer } from './nats-request-json.deserializer';
import { NatsRecord } from './nats.record-builder';

// Strategy region
export class NatsStrategy extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.NATS;

  private natsClient: nats.NatsConnection;

  private readonly _jc = nats.JSONCodec();

  constructor(private readonly options: NatsOptions) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public async listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    try {
      this.natsClient = await this.createNatsClient();
      this.handleStatusUpdates(this.natsClient);
      this.start(callback);
    } catch (err) {
      callback(err);
    }
  }

  public start(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ) {
    this.bindEvents(this.natsClient);
    callback();
  }

  public bindEvents(client: nats.NatsConnection) {
    const queue = this.getOptionsProp(this.options, 'queue');
    const subscribe = (channel: string) =>
      client.subscribe(channel, {
        queue,
        callback: this.getMessageHandler(channel).bind(this),
      });

    const registeredPatterns = [...this.messageHandlers.keys()];
    registeredPatterns.forEach((channel) => subscribe(channel));
  }

  public async close() {
    await this.natsClient?.close();
    this.natsClient = null;
  }

  public createNatsClient(): Promise<nats.NatsConnection> {
    const options = this.options || ({} as nats.ConnectionOptions);
    return nats.connect({
      ...options,
    });
  }

  public getMessageHandler(
    channel: string,
  ): (err?: unknown, ...optionalParams: unknown[]) => void {
    return async (error: object | undefined, message: nats.Msg) => {
      if (error) {
        return this.logger.error(error);
      }
      return this.handleMessage(channel, message);
    };
  }

  public async handleMessage(channel: string, natsMsg: nats.Msg) {
    const callerSubject = natsMsg.subject;
    const rawMessage = natsMsg.data;
    const replyTo = natsMsg.reply;

    const natsCtx = new NatsContext([callerSubject, natsMsg.headers]);
    const message = await this.deserializer.deserialize(rawMessage, {
      channel,
      replyTo,
    });
    if (isUndefined((message as IncomingRequest).id)) {
      return this.handleEvent(channel, message, natsCtx);
    }
    const publish = this.getPublisher(natsMsg, (message as IncomingRequest).id);
    const handler = this.getHandlerByPattern(channel);
    if (!handler) {
      const status = 'error';
      const noHandlerPacket = {
        id: (message as IncomingRequest).id,
        status,
        err: NO_MESSAGE_HANDLER,
      };
      return publish(noHandlerPacket);
    }
    const response$ = this.transformToObservable(
      await handler(message.data, natsCtx),
    );
    response$ && this.send(response$, publish);
  }

  public getPublisher(natsMsg: nats.Msg, id: string) {
    if (natsMsg.reply) {
      return (response: any) => {
        Object.assign(response, { id });
        const outgoingResponse: NatsRecord =
          this.serializer.serialize(response);
        return natsMsg.respond(outgoingResponse.data, {
          headers: outgoingResponse.headers,
        });
      };
    }

    // In case the "reply" topic is not provided, there's no need for a reply.
    // Method returns a noop function instead
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
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

  protected initializeSerializer(options: NatsOptions) {
    this.serializer = options?.serializer ?? new NatsRecordSerializer();
  }

  protected initializeDeserializer(options: NatsOptions) {
    this.deserializer =
      options?.deserializer ?? new NatsRequestJSONDeserializer();
  }
}
