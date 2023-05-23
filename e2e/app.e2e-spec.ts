import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { NatsStrategy } from '../lib/nats.strategy';
import { AppModule } from './app.module';

describe('Stan Strategy (e2e)', () => {
  let app: INestMicroservice;
  let server: NatsStrategy;

  const bootstrap = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    server = new NatsStrategy({
      servers: 'nats://localhost:4222',
    });
    app = moduleFixture.createNestMicroservice({
      strategy: server,
    });
    await app.listen();
  };

  beforeEach(async () => {
    await bootstrap();
  });
  afterEach(async () => {
    await app.close();
  });
  describe('starting', () => {
    it('should have some subscriptions', () => {
      expect((server as any)._subscriptions.length).toBeGreaterThan(0);
    });
    it('should has "math.sum" subject in pattern map', () => {
      expect((server as any).patternMap.get('math.sum')).toBeDefined();
    });
    it('should has "math.sum1" subject in pattern map', () => {
      expect((server as any).patternMap.get('{"opts":{"durableName":"test"},"subject":"math.sum1"}')).toBeDefined();
    });
    // it('should has "math.sum2" subject in pattern map', () => {
    //   expect((server as any).patternMap.get('{"opts":undefined,"qGroup":undefined,"subject":"math.sum2"}')).toBeDefined();
    // });
  });
});
