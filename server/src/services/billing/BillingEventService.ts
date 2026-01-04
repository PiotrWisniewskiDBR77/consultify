import { EventEmitter } from 'events';

import { eventBus } from '../event/EventBus.js';

export class BillingEventService {
    readonly emitter = new EventEmitter();

    emitEvent(eventType: string, payload: Record<string, unknown>) {
        // Publish to global EventBus
        eventBus.publish(eventType, payload);

        // Keep local emitter for backward compatibility if needed
        this.emitter.emit(eventType, payload);
    }

    async handleWebhook(event: Record<string, unknown>) {
        const payload = { ...event, source: 'webhook' };

        // Publish to global EventBus
        eventBus.publish('billing.webhook.received', payload);

        this.emitter.emit('webhook', event);
        return { success: true, received: true, event };
    }
}
