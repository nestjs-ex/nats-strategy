import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  NatsContext,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import * as nats from 'nats';
import { from, lastValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, scan } from 'rxjs/operators';
import { NatsClient, NatsRecordBuilder } from '../lib'

@Controller()
export class AppController {
  static IS_NOTIFIED = false;
  static IS_NOTIFIED2 = false;

  constructor(private readonly client: NatsClient) {}

  @Post()
  @HttpCode(200)
  async call(
    @Query('command') cmd,
    @Body() data: number[],
  ): Promise<Observable<number>> {
    await this.client.connect();
    return this.client.send<number>(cmd, data);
  }

  @Post('stream')
  @HttpCode(200)
  stream(@Body() data: number[]): Observable<number> {
    return this.client
      .send<number>('streaming.sum', data)
      .pipe(scan((a, b) => a + b));
  }

  @Post('concurrent')
  @HttpCode(200)
  concurrent(@Body() data: number[][]): Promise<boolean> {
    const send = async (tab: number[]) => {
      const expected = tab.reduce((a, b) => a + b);
      const result = await lastValueFrom(
        this.client.send<number>('math.sum', tab),
      );

      return result === expected;
    };
    return data
      .map(async (tab) => send(tab))
      .reduce(async (a, b) => (await a) && b);
  }

  @Post('record-builder-duplex')
  @HttpCode(200)
  useRecordBuilderDuplex(@Body() data: Record<string, any>) {
    const headers = nats.headers();
    headers.set('x-version', '1.0.0');
    const record = new NatsRecordBuilder(data).setHeaders(headers).build();
    return this.client.send('record-builder-duplex', record);
  }

  @MessagePattern('record-builder-duplex')
  handleRecordBuilderDuplex(
    @Payload() data: Record<string, any>,
    @Ctx() context: NatsContext,
  ) {
    return {
      data,
      headers: {
        ['x-version']: context.getHeaders().get('x-version'),
      },
    };
  }

  @MessagePattern('math.*')
  sum(@Payload() data: number[], @Ctx() context: NatsContext): number {
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern('async.*')
  async asyncSum(data: number[]): Promise<number> {
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern('stream.*')
  streamSum(data: number[]): Observable<number> {
    return of((data || []).reduce((a, b) => a + b));
  }

  @MessagePattern('streaming.*')
  streaming(data: number[]): Observable<number> {
    return from(data);
  }

  @Get('exception')
  async getError() {
    return this.client
      .send<number>('exception', {})
      .pipe(catchError((err) => of(err)));
  }

  @MessagePattern('exception')
  throwError(): Observable<number> {
    return throwError(() => new RpcException('test'));
  }

  @Post('notify')
  async sendNotification(): Promise<any> {
    return this.client.emit<number>('notification', true);
  }

  @EventPattern('notification')
  eventHandler(@Payload() data: boolean) {
    AppController.IS_NOTIFIED = data;
  }

  @EventPattern('notification')
  eventHandler2(@Payload() data: boolean) {
    AppController.IS_NOTIFIED2 = data;
  }
}
