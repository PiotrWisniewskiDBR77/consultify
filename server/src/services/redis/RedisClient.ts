import { Redis } from 'ioredis';
import logger from '../../utils/Logger.js';

class RedisClient {
    private client: Redis | null = null;
    private subscriber: Redis | null = null;
    private isConnected: boolean = false;

    constructor() {
        // Lazy connection or init
    }

    public connect(url?: string): Redis {
        if (this.client) return this.client;

        const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

        try {
            this.client = new Redis(redisUrl, {
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableOfflineQueue: false // Fail fast if Redis is down
            });

            this.client.on('connect', () => {
                this.isConnected = true;
                logger.info('[Redis] Connected successfully');
            });

            this.client.on('error', (err: Error) => {
                this.isConnected = false;
                logger.warn('[Redis] Connection error:', { error: err.message });
            });

            return this.client;
        } catch (error: any) {
            logger.error('[Redis] Initialization failed:', error);
            throw error;
        }
    }

    public getSubscriber(): Redis {
        if (this.subscriber) return this.subscriber;

        // Create a duplicate connection for subscription
        if (!this.client) this.connect();

        this.subscriber = this.client!.duplicate();
        this.subscriber.on('connect', () => {
            logger.info('[Redis] Subscriber connected');
        });

        return this.subscriber;
    }

    public getClient(): Redis | null {
        return this.client;
    }

    public async get(key: string): Promise<string | null> {
        if (!this.client) return null;
        return this.client.get(key);
    }

    public async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
        if (!this.client) return null;
        if (ttlSeconds) {
            return this.client.set(key, value, 'EX', ttlSeconds);
        }
        return this.client.set(key, value);
    }

    public async del(key: string): Promise<number | null> {
        if (!this.client) return null;
        return this.client.del(key);
    }

    public async publish(channel: string, message: string): Promise<number> {
        if (!this.client) await this.connect();
        return this.client!.publish(channel, message);
    }

    public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
        const sub = this.getSubscriber();
        await sub.subscribe(channel);
        sub.on('message', (chan, msg) => {
            if (chan === channel) callback(msg);
        });
    }

    public async delPattern(pattern: string): Promise<number> {
        if (!this.client) await this.connect();
        const client = this.client!;
        let keys: string[] = [];
        let cursor = '0';

        try {
            do {
                const [nextCursor, matchedKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = nextCursor;
                if (matchedKeys.length > 0) {
                    keys = keys.concat(matchedKeys);
                }
            } while (cursor !== '0');

            if (keys.length > 0) {
                // Delete in chunks to avoid blocking
                const res = await client.del(...keys);
                return res;
            }
            return 0;
        } catch (error) {
            logger.error('[Redis] Failed to delete pattern', error);
            return 0;
        }
    }
}

export const redisClient = new RedisClient();
export default redisClient;
