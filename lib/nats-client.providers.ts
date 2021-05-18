import { NatsClientModuleOptions } from './interfaces';
import { NATS_CLIENT_MODULE_OPTIONS } from './nats-client.constants';

export function createNatsClientProvider(
  options: NatsClientModuleOptions,
): any[] {
  return [{ provide: NATS_CLIENT_MODULE_OPTIONS, useValue: options || {} }];
}
