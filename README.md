## Description

NATS v2 strategy and client module for [Nest](https://github.com/nestjs/nest)

## Installation

```bash
$ npm i --save @nestjs-ex/nats-strategy
```

## Usage

To use the Nats transporter, pass the following options object to the `createMicroservice()` method:

```typescript
import { NestFactory } from '@nestjs/core';
import { NatsStrategy } from '@nestjs-ex/nats-strategy';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(
    AppModule,
    {
      strategy: new NatsStrategy({
        servers: '127.0.0.1:4222',
        user: 'jenny',
        pass: '867-5309',
      })
    },
  );
  app.listen(() => console.log('Microservice is listening'));
}
bootstrap();
```

### Client

To create a client instance with the `NatsClientModule`, import it and use the `register()` method to pass an options object with the same properties shown above in the `createMicroservice()` method.

```typescript
@Module({
  imports: [
    NatsClientModule.register({
      servers: '127.0.0.1:4222',
      user: 'jenny',
      pass: '867-5309',
      name: 'example-client'
    }),
  ]
  ...
})
```

Once the module has been imported, we can inject an instance of the `NatsClient` shown above

```typescript
constructor(
  private client: NatsClient
) {}
```

Quite often you might want to asynchronously pass your module options instead of passing them beforehand. In such case, use `registerAsync()` method, that provides a couple of various ways to deal with async data.

**1. Use factory**

```typescript
NatsClientModule.registerAsync({
  useFactory: () => ({
    servers: '127.0.0.1:4222',
    user: 'jenny',
    pass: '867-5309',
    name: 'example-client'
  })
});
```

Obviously, our factory behaves like every other one (might be `async` and is able to inject dependencies through `inject`).

```typescript
NatsClientModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    servers: configService.getString('NATS_SERVERS'),
    name: configService.getString('NATS_NAME')
  }),
  inject: [ConfigService],
}),
```

**2. Use class**

```typescript
NatsClientModule.registerAsync({
  useClass: NatsClientConfigService
});
```

Above construction will instantiate `NatsClientConfigService` inside `NatsClientModule` and will leverage it to create options object.

```typescript
class NatsClientConfigService implements NatsClientOptionsFactory {
  createNatsClientOptions(): NatsClientModuleOptions {
    return {
      servers: '127.0.0.1:4222',
      user: 'jenny',
      pass: '867-5309',
      name: 'example-client'
    };
  }
}
```

**3. Use existing**

```typescript
NatsClientModule.registerAsync({
  imports: [ConfigModule],
  useExisting: ConfigService,
}),
```

It works the same as `useClass` with one critical difference - `NatsClientModule` will lookup imported modules to reuse already created `ConfigService`, instead of instantiating it on its own.

## Stay in touch

- Author - [Thanh Pham](https://twitter.com/pnt239)

## License

Nest is [MIT licensed](LICENSE).
