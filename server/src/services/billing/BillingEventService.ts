import { EventEmitter } from 'events';

export class BillingEventService {
    readonly emitter = new EventEmitter();

    emitEvent(eventType: string, payload: Record<string, unknown>) {
        this.emitter.emit(eventType, payload);
    }

    async handleWebhook(event: Record<string, unknown>) {
        this.emitter.emit('webhook', event);
        return { success: true, received: true, event };
    }
}
