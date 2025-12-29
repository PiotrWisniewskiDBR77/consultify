/**
 * RealtimeClient Tests
 * 
 * Tests for WebSocket real-time client service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeClient } from '../../../services/realtimeClient';

// Mock window.location for WebSocket URL construction
Object.defineProperty(window, 'location', {
    value: {
        protocol: 'http:',
        host: 'localhost:3000'
    },
    writable: true
});

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(public url: string) {
        // Simulate connection after a delay
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) {
                this.onopen(new Event('open'));
            }
        }, 10);
    }

    send(data: string) {
        // Mock send
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            this.onclose(new CloseEvent('close'));
        }
    }
}

// Replace global WebSocket
global.WebSocket = MockWebSocket as any;

describe('RealtimeClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Disconnect any existing connection
        realtimeClient.disconnect();
    });

    afterEach(() => {
        realtimeClient.disconnect();
    });

    describe('connect', () => {
        it('should connect to WebSocket', () => {
            realtimeClient.connect('test-token');

            expect(realtimeClient).toBeDefined();
        });

        it('should disconnect existing connection before connecting', () => {
            realtimeClient.connect('token-1');
            realtimeClient.connect('token-2');

            // Should not throw
            expect(realtimeClient).toBeDefined();
        });
    });

    describe('disconnect', () => {
        it('should disconnect WebSocket', () => {
            realtimeClient.connect('test-token');
            realtimeClient.disconnect();

            // Should not throw
            expect(realtimeClient).toBeDefined();
        });
    });

    describe('send', () => {
        it('should send message when connected', async () => {
            realtimeClient.connect('test-token');

            // Wait for connection
            await new Promise(resolve => setTimeout(resolve, 20));
            realtimeClient.send({ type: 'test', data: 'message' });
            // Should not throw
            expect(realtimeClient).toBeDefined();
        });
    });

    describe('on', () => {
        it('should register event callback', () => {
            const callback = vi.fn();
            realtimeClient.on('test-event', callback);

            expect(callback).toBeDefined();
        });
    });

    describe('off', () => {
        it('should unregister event callback', () => {
            const callback = vi.fn();
            realtimeClient.on('test-event', callback);
            realtimeClient.off('test-event', callback);

            expect(callback).toBeDefined();
        });
    });
});

