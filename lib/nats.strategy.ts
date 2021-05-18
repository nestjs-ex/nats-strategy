import {
  Server,
  CustomTransportStrategy,
  IncomingRequest,
  ReadPacket,
  PacketId,
  Transport,
} from '@nestjs/microservices';
import {
  CONNECT_EVENT,
  MESSAGE_EVENT,
  ERROR_EVENT,
  NO_MESSAGE_HANDLER,
} from '@nestjs/microservices/constants';
import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { Observable } from 'rxjs';
import * as nats from 'nats';

import { NatsClientOptions } from './interfaces';
import { NATS_DEFAULT_URL } from './nats-client.constants';
import { NatsContext } from './nats.context';

// Strategy region
export class NatsStrategy extends Server implements CustomTransportStrategy {
  public readonly transportId = Transport.NATS;

  private readonly url: string;
  private natsClient: nats.NatsConnection;

  private readonly _jc = nats.JSONCodec();

  constructor(private readonly options: nats.ConnectionOptions) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public listen(callback: () => void) {
    const options = this.options || ({} as nats.ConnectionOptions);
    nats
      .connect({
        ...options,
      })
      .then((conn) => {
        this.natsClient = conn;
        this.start(callback);
      })
      .catch((err) => this.logger.error(err));
  }

  public start(callback?: () => void) {
    this.bindEvents(this.natsClient);
    callback();
  }

  public bindEvents(client: nats.NatsConnection) {
    // const queue = this.getOptionsProp(this.options, 'queue');
    // const subscribe = queue
    //   ? (channel: string) =>
    //       client.subscribe(
    //         channel,
    //         { queue },
    //         this.getMessageHandler(channel, client).bind(this),
    //       )
    //   : (channel: string) =>
    //       client.subscribe(
    //         channel,
    //         this.getMessageHandler(channel, client).bind(this),
    //       );
    const that = this;
    const subscribe = async (channel: string) => {
      const sub = client.subscribe(channel) as any;

      for await (const msg of sub) {
        await that.handleMessage(
          channel,
          that._jc.decode(msg.data),
          client,
          msg.reply,
          msg,
        );
      }
    };

    const registeredPatterns = [...this.messageHandlers.keys()];
    registeredPatterns.forEach((channel) => subscribe(channel));
  }

  public close() {
    this.natsClient && this.natsClient.close();
    this.natsClient = null;
  }

  public async handleMessage(
    channel: string,
    rawMessage: any,
    client: nats.NatsConnection,
    replyTo: string,
    callerSubject: nats.Msg,
  ) {
    const natsCtx = new NatsContext([callerSubject]);
    const message = this.deserializer.deserialize(rawMessage, {
      channel,
      replyTo,
    });
    // if (isUndefined((message as IncomingRequest).id)) {
    //   return this.handleEvent(channel, message, natsCtx);
    // }
    if (isUndefined(callerSubject.reply)) {
      return this.handleEvent(channel, message, natsCtx);
    }

    const publish = this.getPublisher(
      callerSubject,
      (message as IncomingRequest).id,
    );
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
    ) as Observable<any>;
    response$ && this.send(response$, publish);
  }

  public getPublisher(msg: nats.Msg, id: string) {
    if (msg.reply) {
      return (response: any) => {
        Object.assign(response, { id });
        const outgoingResponse = this.serializer.serialize(response);
        // return publisher.publish(replyTo, outgoingResponse);
        return msg.respond(this._jc.encode(outgoingResponse));
      };
    }

    // In case "replyTo" topic is not provided, there's no need for a reply.
    // Method returns a noop function instead
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }
}
