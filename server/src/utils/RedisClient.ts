/**
 * Redis Client Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of redisClient.js
 * Provides Redis client with fallback to mock client
 */

import { createClient, type RedisClientType } from 'redis';
import logger from './Logger.js';

let redisUrl: string | null = process.env.REDIS_URL || 'redis://localhost:6379';

// Check if Railway variable expansion didn't work (still contains ${{)
if (redisUrl && redisUrl.includes('${{')) {
    logger.warn('[Redis] REDIS_URL appears to contain unexpanded Railway variable:', redisUrl);
    logger.warn('[Redis] Falling back to individual REDIS_* variables or mock client');
    redisUrl = null; // Force fallback
}

logger.info('[Redis] Initializing client...');

// Mock client interface
interface MockRedisClient {
    on: (event: string, callback?: () => void) => void;
    connect: () => Promise<void>;
    isOpen: boolean;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<string>;
    del: (key: string) => Promise<number>;
    incr: (key: string) => Promise<number>;
    decr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number>;
    duplicate: () => MockRedisClient | RedisClientType;
    quit: () => Promise<void>;
}

// Create mock client
function createMockClient(): MockRedisClient {
    const mockClient: MockRedisClient = {
        on: () => {},
        connect: async () => {},
        isOpen: true,
        get: async () => null,
        set: async () => 'OK',
        del: async () => 1,
        incr: async () => 1,
        decr: async () => 0,
        expire: async () => 1,
        duplicate: () => mockClient,
        quit: async () => {},
    };
    return mockClient;
}

let client: RedisClientType | MockRedisClient;

if (process.env.MOCK_REDIS === 'true' || !redisUrl) {
    if (!redisUrl) {
        logger.info('[Redis] No REDIS_URL configured, using Mock Client');
    } else {
        logger.info('[Redis] Using Mock Client');
    }
    client = createMockClient();
} else {
    const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10); // 30 seconds default for Railway
    const commandTimeout = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '10000', 10); // 10 seconds for commands

    logger.info(`[Redis] Connecting to: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs

    client = createClient({
        url: redisUrl,
        socket: {
            connectTimeout: connectTimeout,
            commandTimeout: commandTimeout,
            reconnectStrategy: (retries: number) => {
                if (retries > 10) {
                    logger.error('[Redis] Max reconnection attempts exceeded');
                    return new Error('Max reconnection attempts exceeded');
                }
                const delay = Math.min(1000 * Math.pow(2, retries), 30000);
                logger.info(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
                return delay;
            },
        },
    }) as RedisClientType;

    client.on('error', (err: Error) => logger.error('[Redis] Client Error', err.message));
    client.on('connect', () => logger.info('[Redis] Connecting...'));
    client.on('ready', () => logger.info('[Redis] Connected and ready'));

    // Connect immediately with timeout
    (async () => {
        try {
            if (!(client as RedisClientType).isOpen) {
                // Add timeout to prevent hanging
                const connectPromise = (client as RedisClientType).connect();
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Redis connection timeout')), connectTimeout),
                );
                await Promise.race([connectPromise, timeoutPromise]);
                logger.info('[Redis] Successfully connected');
            }
        } catch (err: unknown) {
            logger.error('[Redis] Connection Failed:', (err as Error).message);
            // Fallback to mock on connection failure
            logger.info('[Redis] Falling back to Mock Client');
            const mockClient = createMockClient();
            // Replace the broken client with mock
            client = mockClient;
        }
    })();
}

export default client;
export type { MockRedisClient };
