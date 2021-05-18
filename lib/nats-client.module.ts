import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  NatsClientModuleOptions,
  NatsClientModuleAsyncOptions,
  NatsClientOptionsFactory,
} from './interfaces';
import { NATS_CLIENT_MODULE_OPTIONS } from './nats-client.constants';
import { createNatsClientProvider } from './nats-client.providers';
import { NatsClient } from './nats-client.service';

@Module({
  providers: [NatsClient],
  exports: [NatsClient],
})
export class NatsClientModule {
  static register(options: NatsClientModuleOptions): DynamicModule {
    return {
      module: NatsClientModule,
      providers: createNatsClientProvider(options),
    };
  }

  static registerAsync(options: NatsClientModuleAsyncOptions): DynamicModule {
    return {
      module: NatsClientModule,
      imports: options.imports || [],
      providers: this.createAsyncProviders(options),
    };
  }

  private static createAsyncProviders(
    options: NatsClientModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: NatsClientModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: NATS_CLIENT_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: NATS_CLIENT_MODULE_OPTIONS,
      useFactory: async (optionsFactory: NatsClientOptionsFactory) =>
        await optionsFactory.createNatsClientOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
