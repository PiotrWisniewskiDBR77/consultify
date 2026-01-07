/**
 * Message Broker Tests
 * Tests for pub/sub and message queue patterns
 * 
 * @module tests/broker/message-broker.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Message broker implementation
const createMessageBroker = () => {
    const topics = new Map();
    const queues = new Map();
    const deadLetterQueue = [];
    const messageHistory = [];

    return {
        // Pub/Sub
        subscribe: (topic, handler, options = {}) => {
            const { group, filter } = options;

            if (!topics.has(topic)) {
                topics.set(topic, []);
            }

            const subscription = {
                id: crypto.randomUUID(),
                handler,
                group,
                filter,
                active: true,
            };

            topics.get(topic).push(subscription);

            return {
                unsubscribe: () => {
                    subscription.active = false;
                    const subs = topics.get(topic);
                    const index = subs.indexOf(subscription);
                    if (index !== -1) subs.splice(index, 1);
                },
                id: subscription.id,
            };
        },

        publish: async (topic, message, options = {}) => {
            const { delay = 0, priority = 0 } = options;

            const envelope = {
                id: crypto.randomUUID(),
                topic,
                message,
                timestamp: Date.now(),
                priority,
            };

            messageHistory.push(envelope);

            if (delay > 0) {
                await new Promise(r => setTimeout(r, delay));
            }

            const subscribers = topics.get(topic) || [];
            const groupHandled = new Set();

            const results = [];

            for (const sub of subscribers) {
                if (!sub.active) continue;

                // Consumer group - only one handler per group
                if (sub.group) {
                    if (groupHandled.has(sub.group)) continue;
                    groupHandled.add(sub.group);
                }

                // Filter
                if (sub.filter && !sub.filter(message)) continue;

                try {
                    await sub.handler(message, envelope);
                    results.push({ subscriberId: sub.id, success: true });
                } catch (error) {
                    results.push({ subscriberId: sub.id, success: false, error });
                }
            }

            return { messageId: envelope.id, delivered: results.length, results };
        },

        publishBatch: async (topic, messages) => {
            const results = [];
            for (const message of messages) {
                results.push(await this.publish(topic, message));
            }
            return results;
        },

        // Queue
        enqueue: (queueName, message, options = {}) => {
            const { priority = 0, ttl } = options;

            if (!queues.has(queueName)) {
                queues.set(queueName, []);
            }

            const item = {
                id: crypto.randomUUID(),
                message,
                priority,
                enqueued: Date.now(),
                expiresAt: ttl ? Date.now() + ttl : null,
            };

            const queue = queues.get(queueName);

            // Insert by priority
            const insertIndex = queue.findIndex(i => i.priority < priority);
            if (insertIndex === -1) {
                queue.push(item);
            } else {
                queue.splice(insertIndex, 0, item);
            }

            return item.id;
        },

        dequeue: (queueName) => {
            const queue = queues.get(queueName);
            if (!queue || queue.length === 0) return null;

            // Remove expired items
            const now = Date.now();
            while (queue.length > 0 && queue[0].expiresAt && queue[0].expiresAt < now) {
                deadLetterQueue.push({ ...queue.shift(), reason: 'expired' });
            }

            if (queue.length === 0) return null;

            const item = queue.shift();
            return { id: item.id, message: item.message };
        },

        peek: (queueName) => {
            const queue = queues.get(queueName);
            if (!queue || queue.length === 0) return null;

            const item = queue[0];
            return { id: item.id, message: item.message };
        },

        queueLength: (queueName) => {
            return queues.get(queueName)?.length || 0;
        },

        // Dead letter queue
        getDeadLetters: () => [...deadLetterQueue],

        sendToDeadLetter: (message, reason) => {
            deadLetterQueue.push({ message, reason, timestamp: Date.now() });
        },

        retryDeadLetters: async (queueName) => {
            const retried = [];
            while (deadLetterQueue.length > 0) {
                const item = deadLetterQueue.shift();
                this.enqueue(queueName, item.message);
                retried.push(item);
            }
            return retried;
        },

        // Utilities
        getTopics: () => [...topics.keys()],

        getQueues: () => [...queues.keys()],

        getSubscriberCount: (topic) => {
            return (topics.get(topic) || []).filter(s => s.active).length;
        },

        getMessageHistory: (limit = 100) => {
            return messageHistory.slice(-limit);
        },

        clear: () => {
            topics.clear();
            queues.clear();
            deadLetterQueue.length = 0;
            messageHistory.length = 0;
        },
    };
};

// Request/Response pattern
const createRequestReplyBroker = (broker) => {
    const pendingRequests = new Map();

    return {
        request: (topic, message, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const correlationId = crypto.randomUUID();
                const replyTopic = `${topic}.reply.${correlationId}`;

                const timer = setTimeout(() => {
                    subscription.unsubscribe();
                    pendingRequests.delete(correlationId);
                    reject(new Error('Request timeout'));
                }, timeout);

                const subscription = broker.subscribe(replyTopic, (response) => {
                    clearTimeout(timer);
                    subscription.unsubscribe();
                    pendingRequests.delete(correlationId);
                    resolve(response);
                });

                pendingRequests.set(correlationId, { timer, subscription });

                broker.publish(topic, {
                    ...message,
                    correlationId,
                    replyTo: replyTopic,
                });
            });
        },

        reply: (originalMessage, response) => {
            if (!originalMessage.replyTo) {
                throw new Error('No reply address');
            }
            return broker.publish(originalMessage.replyTo, response);
        },

        getPendingCount: () => pendingRequests.size,
    };
};

describe('Message Broker Tests', () => {
    let broker;

    beforeEach(() => {
        broker = createMessageBroker();
    });

    // ═══════════════════════════════════════════════════════════════════
    // PUB/SUB
    // ═══════════════════════════════════════════════════════════════════

    describe('Pub/Sub', () => {
        it('should subscribe and receive messages', async () => {
            const handler = vi.fn();
            broker.subscribe('test-topic', handler);

            await broker.publish('test-topic', { text: 'Hello' });

            expect(handler).toHaveBeenCalledWith({ text: 'Hello' }, expect.any(Object));
        });

        it('should deliver to multiple subscribers', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            broker.subscribe('topic', handler1);
            broker.subscribe('topic', handler2);

            await broker.publish('topic', 'message');

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should unsubscribe', async () => {
            const handler = vi.fn();
            const { unsubscribe } = broker.subscribe('topic', handler);

            unsubscribe();
            await broker.publish('topic', 'message');

            expect(handler).not.toHaveBeenCalled();
        });

        it('should support consumer groups', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            broker.subscribe('topic', handler1, { group: 'workers' });
            broker.subscribe('topic', handler2, { group: 'workers' });

            await broker.publish('topic', 'message');

            // Only one handler should be called
            expect(handler1.mock.calls.length + handler2.mock.calls.length).toBe(1);
        });

        it('should support message filters', async () => {
            const handler = vi.fn();
            broker.subscribe('orders', handler, {
                filter: (msg) => msg.status === 'completed',
            });

            await broker.publish('orders', { status: 'pending' });
            await broker.publish('orders', { status: 'completed' });

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should publish with delay', async () => {
            const handler = vi.fn();
            broker.subscribe('topic', handler);

            const start = Date.now();
            await broker.publish('topic', 'message', { delay: 50 });
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThanOrEqual(50);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // QUEUE
    // ═══════════════════════════════════════════════════════════════════

    describe('Queue', () => {
        it('should enqueue and dequeue', () => {
            broker.enqueue('tasks', { name: 'Task 1' });
            broker.enqueue('tasks', { name: 'Task 2' });

            const item1 = broker.dequeue('tasks');
            const item2 = broker.dequeue('tasks');

            expect(item1.message.name).toBe('Task 1');
            expect(item2.message.name).toBe('Task 2');
        });

        it('should return null for empty queue', () => {
            expect(broker.dequeue('empty')).toBeNull();
        });

        it('should peek without removing', () => {
            broker.enqueue('tasks', { name: 'Task 1' });

            const peeked = broker.peek('tasks');
            const dequeued = broker.dequeue('tasks');

            expect(peeked.id).toBe(dequeued.id);
        });

        it('should respect priority', () => {
            broker.enqueue('tasks', { name: 'Low' }, { priority: 1 });
            broker.enqueue('tasks', { name: 'High' }, { priority: 10 });
            broker.enqueue('tasks', { name: 'Medium' }, { priority: 5 });

            expect(broker.dequeue('tasks').message.name).toBe('High');
            expect(broker.dequeue('tasks').message.name).toBe('Medium');
            expect(broker.dequeue('tasks').message.name).toBe('Low');
        });

        it('should get queue length', () => {
            broker.enqueue('tasks', 'a');
            broker.enqueue('tasks', 'b');

            expect(broker.queueLength('tasks')).toBe(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAD LETTER QUEUE
    // ═══════════════════════════════════════════════════════════════════

    describe('Dead Letter Queue', () => {
        it('should send to dead letter queue', () => {
            broker.sendToDeadLetter({ id: 1 }, 'processing failed');

            const deadLetters = broker.getDeadLetters();
            expect(deadLetters.length).toBe(1);
            expect(deadLetters[0].reason).toBe('processing failed');
        });

        it('should retry dead letters', async () => {
            broker.sendToDeadLetter({ id: 1 }, 'failed');
            broker.sendToDeadLetter({ id: 2 }, 'failed');

            await broker.retryDeadLetters('retry-queue');

            expect(broker.queueLength('retry-queue')).toBe(2);
            expect(broker.getDeadLetters().length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════════

    describe('Utilities', () => {
        it('should get subscriber count', () => {
            broker.subscribe('topic', () => { });
            broker.subscribe('topic', () => { });

            expect(broker.getSubscriberCount('topic')).toBe(2);
        });

        it('should get message history', async () => {
            await broker.publish('topic1', 'msg1');
            await broker.publish('topic2', 'msg2');

            const history = broker.getMessageHistory();
            expect(history.length).toBe(2);
        });

        it('should clear all', async () => {
            broker.subscribe('topic', () => { });
            broker.enqueue('queue', 'msg');
            await broker.publish('topic', 'msg');

            broker.clear();

            expect(broker.getTopics().length).toBe(0);
            expect(broker.getQueues().length).toBe(0);
        });
    });
});

describe('Request/Reply Broker Tests', () => {
    let broker;
    let requestReply;

    beforeEach(() => {
        broker = createMessageBroker();
        requestReply = createRequestReplyBroker(broker);
    });

    it('should send request and receive reply', async () => {
        // Set up responder
        broker.subscribe('calculator', async (msg) => {
            const result = msg.a + msg.b;
            await requestReply.reply(msg, { result });
        });

        const response = await requestReply.request('calculator', { a: 2, b: 3 });

        expect(response.result).toBe(5);
    });

    it('should timeout if no reply', async () => {
        await expect(
            requestReply.request('no-responder', {}, 100)
        ).rejects.toThrow('timeout');
    });
});
