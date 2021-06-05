import { NatsClient } from '@nestjs-ex/nats-strategy';
import { Injectable, Logger } from '@nestjs/common';
import { IEvent, IEventPublisher } from '@nestjs/cqrs';
import { Subject } from 'rxjs';

/**
 * @class EventStore
 * @description The EventStore.org bridge. By design, the domain category
 * (i.e. user) events are being subscribed to. Upon events being received,
 * internal event handlers are responsible for the handling of events.
 */
@Injectable()
export class EventStore implements IEventPublisher {
  private readonly logger = new Logger();
  constructor(
    public subject$: Subject<IEvent>,
    public natsService: NatsClient,
  ) {}

  async publish<T extends IEvent>(event: T) {
 
    // nat send
    try {
      if (event)
        await this.natsService.send('aggr.activity.create', event).toPromise();
    } catch (e) {
      this.logger.error(e.message);
    }

    this.subject$.next(event);
  }

  // setEventHandlers(eventHandlers) {
  //   this.eventHandlers = eventHandlers;
  // }
}
