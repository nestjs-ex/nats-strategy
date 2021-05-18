import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { Msg } from 'nats';

type NatsContextArgs = [Msg];

export class NatsContext extends BaseRpcContext<NatsContextArgs> {
  constructor(args: NatsContextArgs) {
    super(args);
  }

  /**
   * Returns the reference to the original message.
   */
  getMessage() {
    return this.args[0];
  }
}
