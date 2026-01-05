import { EventEmitter } from 'events';

import logger from '../../utils/Logger.js';

export interface IEvent {
    eventName: string;
    payload: any;
    occurredAt: Date;
}

export type EventHandler<TEvent extends IEvent = IEvent> = (event: TEvent) => Promise<void>;

export class EventBus {
    private static instance: EventBus;
    private emitter: EventEmitter;
    private handlers: Map<string, EventHandler[]>;

    private constructor() {
        this.emitter = new EventEmitter();
        this.handlers = new Map();

        // Increase limit for complex app
        this.emitter.setMaxListeners(20);
    }

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * Subscribe to an event
     */
    public subscribe<TEvent extends IEvent>(eventName: string, handler: EventHandler<TEvent>): void {
        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, []);

            // Register actual listener on emitter
            this.emitter.on(eventName, async (payload: any) => {
                const handlers = this.handlers.get(eventName) || [];
                const event: TEvent = {
                    eventName,
                    payload,
                    occurredAt: new Date(),
                } as TEvent;

                // Execute all handlers concurrently without blocking the main loop too much
                const promises = handlers.map((h) =>
                    h(event).catch((err: Error | null) => {
                        logger.error(`Error handling event ${eventName}:`, err);
                    }),
                );

                await Promise.all(promises);
            });
        }

        this.handlers.get(eventName)!.push(handler as EventHandler);
    }

    /**
     * Publish an event
     */
    public publish<T extends object>(eventName: string, payload: T): void {
        logger.debug(`[EventBus] Publishing ${eventName}`);
        // Process next tick to not block current stack
        process.nextTick(() => {
            this.emitter.emit(eventName, payload);
        });
    }

    /**
     * Clear all listeners (useful for testing)
     */
    public clear(): void {
        this.emitter.removeAllListeners();
        this.handlers.clear();
    }
}

// Export singleton
export const eventBus = EventBus.getInstance();
