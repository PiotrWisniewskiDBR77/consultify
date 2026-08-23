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
  logger.warn('[Redis] REDIS_URL appears to contain an unexpanded variable reference');
  logger.warn('[Redis] Falling back to individual REDIS_* variables or mock client');
  redisUrl = null; // Force fallback
}

logger.info('[Redis] Initializing client...');

function redactRedisSecrets(value: string): string {
  return value.replace(/rediss?:\/\/[^@\s]+@/gi, (credentials) => {
    const schemeEnd = credentials.indexOf('://') + 3;
    return `${credentials.slice(0, schemeEnd)}****@`;
  });
}

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
let usingMockClient = false;

if (process.env.MOCK_REDIS === 'true' || !redisUrl) {
  if (!redisUrl) {
    logger.info('[Redis] No REDIS_URL configured, using Mock Client');
  } else {
    logger.info('[Redis] Using Mock Client');
  }
  usingMockClient = true;
  client = createMockClient();
} else {
  const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10); // 30 seconds default for Railway
  const commandTimeout = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '10000', 10); // 10 seconds for commands

  logger.info(`[Redis] Connecting to: ${redactRedisSecrets(redisUrl)}`);

  client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: connectTimeout,
      reconnectStrategy: (retries: number) => {
        // Never permanently give up after a transient Redis outage. Returning an
        // Error here makes node-redis stop reconnecting; the old implementation
        // did that after 10 attempts and the catch below then replaced this
        // client with an in-process mock for the lifetime of the application.
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        logger.info(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  }) as RedisClientType;

  client.on('error', (err: Error) =>
    logger.error('[Redis] Client Error', redactRedisSecrets(err.message))
  );
  client.on('connect', () => logger.info('[Redis] Connecting...'));
  client.on('ready', () => logger.info('[Redis] Connected and ready'));

  // Connect immediately with timeout
  (async () => {
    try {
      if (!(client as RedisClientType).isOpen) {
        // Add timeout to prevent hanging
        const connectPromise = (client as RedisClientType).connect();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), connectTimeout)
        );
        await Promise.race([connectPromise, timeoutPromise]);
        logger.info('[Redis] Successfully connected');
      }
    } catch (err: any) {
      // Keep the configured real client. node-redis continues reconnecting in
      // the background, while callers retain their existing fail-safe behavior
      // for commands issued while Redis is unavailable.
      logger.warn(
        '[Redis] Initial connection wait failed; recovery remains active:',
        redactRedisSecrets((err as Error).message)
      );
    }
  })();
}

/** Health contract: mocks are fail-safe substitutes, never connected Redis. */
export function isRedisReady(): boolean {
  return !usingMockClient && (client as RedisClientType).isReady === true;
}

export default client;
export type { MockRedisClient };
