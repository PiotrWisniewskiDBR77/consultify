// WebSocket client service for real-time collaboration
type Callback = (...args: unknown[]) => void;
type MessageData = Record<string, unknown>;
class RealtimeClient {
    private ws: WebSocket | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private callbacks: Map<string, Set<Callback>> = new Map();
    private isConnected: boolean = false;
    connect(token: string) {
        if (this.ws) {
            this.disconnect();
        }
        const wsUrl = `ws://localhost:3005/ws?token=${token}`;
        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = () => {
                console.log('[Realtime] Connected');
                this.isConnected = true;
                this.emit('connected', {});
                // Start heartbeat
                this.startHeartbeat();
            };
            this.ws.onmessage = (event) => {
                try {
                    const data: MessageData = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('[Realtime] Parse error:', e);
                }
            };
            this.ws.onclose = () => {
                console.log('[Realtime] Disconnected');
                this.isConnected = false;
                this.emit('disconnected', {});
                this.scheduleReconnect(token);
            };
            this.ws.onerror = (error) => {
                console.error('[Realtime] Error:', error);
            };
        } catch (error) {
            console.error('[Realtime] Connection failed:', error);
            this.scheduleReconnect(token);
        }
    }
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
    private scheduleReconnect(token: string) {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log('[Realtime] Reconnecting...');
            this.connect(token);
        }, 3000); // Retry after 3 seconds
    }
    private startHeartbeat() {
        setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping' });
            }
        }, 30000); // Ping every 30 seconds
    }
    private handleMessage(data: MessageData) {
        const { type } = data;
        this.emit(type as string, data);
    }
    send(data: MessageData) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    on(event: string, callback: Callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event)!.add(callback);
    }
    off(event: string, callback: Callback) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event)!.delete(callback);
        }
    }
    private emit(event: string, data: MessageData) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event)!.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error('[Realtime] Callback error:', e);
                }
            });
        }
    }
    // High-level methods
    notifyInitiativeUpdate(initiative: MessageData) {
        this.send({
            type: 'initiative_update',
            payload: initiative
        });
    }
    notifyTaskUpdate(task: MessageData) {
        this.send({
            type: 'task_update',
            payload: task
        });
    }
    getConnectionStatus(): boolean {
        return this.isConnected;
    }
}
// Singleton instance
export const realtimeClient = new RealtimeClient();
// Helper hook for React components
export const useRealtime = () => {
    return realtimeClient;
};