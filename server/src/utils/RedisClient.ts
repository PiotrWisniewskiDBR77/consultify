/**
 * Redis Client Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of redisClient.js
 * Provides Redis client with fallback to mock client
 * 
 * Uses LAZY initialization to ensure dotenv is loaded before checking env vars.
 */

import { createClient, type RedisClientType } from 'redis';

import logger from './Logger.js';

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

let client: RedisClientType | MockRedisClient | null = null;
let initialized = false;

/**
 * Lazy initialization - called on first use to ensure dotenv is loaded
 */
function initializeClient(): RedisClientType | MockRedisClient {
  if (client && initialized) {
    return client;
  }

  logger.info('[Redis] Initializing client (lazy)...');

  // Check MOCK_REDIS first - this is set in .env
  if (process.env.MOCK_REDIS === 'true') {
    logger.info('[Redis] MOCK_REDIS=true, using Mock Client');
    client = createMockClient();
    initialized = true;
    return client;
  }

  let redisUrl: string | null = process.env.REDIS_URL || 'redis://localhost:6379';

  // Check if Railway variable expansion didn't work (still contains ${{)
  if (redisUrl && redisUrl.includes('${{')) {
    logger.warn('[Redis] REDIS_URL appears to contain unexpanded Railway variable:', redisUrl);
    logger.warn('[Redis] Falling back to Mock Client');
    redisUrl = null;
  }

  if (!redisUrl) {
    logger.info('[Redis] No REDIS_URL configured, using Mock Client');
    client = createMockClient();
    initialized = true;
    return client;
  }

  const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10); // 5 seconds for dev

  logger.info(`[Redis] Connecting to: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);

  client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: connectTimeout,
      reconnectStrategy: (retries: number) => {
        if (retries > 3) {
          logger.warn('[Redis] Max reconnection attempts exceeded, using Mock Client');
          return new Error('Max reconnection attempts exceeded');
        }
        const delay = Math.min(1000 * Math.pow(2, retries), 5000);
        logger.info(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  }) as RedisClientType;

  client.on('error', (err: Error) => {
    logger.warn('[Redis] Client Error:', err.message);
    // On error, fallback to mock
    if (!initialized || !(client as MockRedisClient).isOpen) {
      logger.info('[Redis] Falling back to Mock Client due to error');
      client = createMockClient();
    }
  });
  client.on('connect', () => logger.info('[Redis] Connecting...'));
  client.on('ready', () => logger.info('[Redis] Connected and ready'));

  // Connect with short timeout
  (async () => {
    try {
      if (!(client as RedisClientType).isOpen) {
        const connectPromise = (client as RedisClientType).connect();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), connectTimeout)
        );
        await Promise.race([connectPromise, timeoutPromise]);
        logger.info('[Redis] Successfully connected');
      }
    } catch (err: any) {
      logger.warn('[Redis] Connection Failed:', (err as Error).message);
      logger.info('[Redis] Falling back to Mock Client');
      client = createMockClient();
    }
  })();

  initialized = true;
  return client;
}

// Export a proxy that lazily initializes on first use
const clientProxy = new Proxy({} as RedisClientType | MockRedisClient, {
  get(_, prop) {
    const realClient = initializeClient();
    return (realClient as any)[prop];
  },
});

export default clientProxy;
export type { MockRedisClient };
