import logger from '../../utils/Logger.js';
import { redisClient } from './RedisClient.js';

export class CacheService {
    private prefix: string = 'cache:';

    constructor(prefix: string = 'app:') {
        this.prefix = prefix;
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redisClient.get(`${this.prefix}${key}`);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            logger.warn(`[Cache] Get failed`, { key, error });
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
        try {
            const serialized = JSON.stringify(value);
            await redisClient.set(`${this.prefix}${key}`, serialized, ttlSeconds);
            return true;
        } catch (error) {
            logger.warn(`[Cache] Set failed`, { key, error });
            return false;
        }
    }

    async del(key: string): Promise<boolean> {
        try {
            await redisClient.del(`${this.prefix}${key}`);
            return true;
        } catch (error) {
            logger.warn(`[Cache] Del failed`, { key, error });
            return false;
        }
    }

    async publish(channel: string, message: string): Promise<number> {
        return redisClient.publish(channel, message);
    }

    async delPattern(pattern: string): Promise<number> {
        return redisClient.delPattern(pattern);
    }

    async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
        return redisClient.subscribe(channel, callback);
    }

    static generateKey(base: string, ...args: any[]): string {
        return `${base}:${args.map((a) => String(a)).join(':')}`;
    }
}

export const appCache = new CacheService('consultinity:');
export const sessionCache = new CacheService('session:');
