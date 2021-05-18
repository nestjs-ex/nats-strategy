import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { NatsClientOptions } from './nats-client-options.interface';

export type NatsClientModuleOptions = NatsClientOptions;

export interface NatsClientOptionsFactory {
  createNatsClientOptions():
    | Promise<NatsClientModuleOptions>
    | NatsClientModuleOptions;
}

export interface NatsClientModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<NatsClientOptionsFactory>;
  useClass?: Type<NatsClientOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<NatsClientModuleOptions> | NatsClientModuleOptions;
  inject?: any[];
}
