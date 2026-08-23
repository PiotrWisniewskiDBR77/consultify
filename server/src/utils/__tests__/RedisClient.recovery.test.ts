import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisHarness = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const client = {
    isOpen: false,
    isReady: false,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
      return client;
    }),
    connect: vi.fn(() => new Promise<void>(() => {})),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    expire: vi.fn(),
    duplicate: vi.fn(),
    quit: vi.fn(),
  };

  return {
    client,
    handlers,
    options: undefined as any,
  };
});

const loggerHarness = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: vi.fn((options: any) => {
    redisHarness.options = options;
    return redisHarness.client;
  }),
}));

vi.mock('../Logger.js', () => ({
  default: loggerHarness,
}));

describe('RedisClient transient-outage recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
    redisHarness.handlers.clear();
    redisHarness.options = undefined;
    redisHarness.client.isOpen = false;
    redisHarness.client.isReady = false;
    process.env.REDIS_URL = 'redis://user:secret@redis.internal:6379';
    delete process.env.MOCK_REDIS;
    process.env.REDIS_CONNECT_TIMEOUT = '25';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_CONNECT_TIMEOUT;
    delete process.env.MOCK_REDIS;
  });

  it('keeps retrying beyond the previous ten-attempt cutoff', async () => {
    await import('../RedisClient.js');

    const retry = redisHarness.options.socket.reconnectStrategy;
    expect(retry(0)).toBe(1000);
    expect(retry(11)).toBe(30000);
    expect(retry(100)).toBe(30000);
  });

  it('redacts credentials from connection and error logs', async () => {
    await import('../RedisClient.js');
    redisHarness.handlers.get('error')?.(
      new Error('connection failed for redis://user:secret@redis.internal:6379')
    );

    expect(JSON.stringify(loggerHarness.info.mock.calls)).not.toContain('user:secret');
    expect(JSON.stringify(loggerHarness.error.mock.calls)).not.toContain('user:secret');
  });

  it('retains the real client after the initial wait times out and can report recovery', async () => {
    const modulePromise = import('../RedisClient.js');
    const module = await modulePromise;
    const exportedClient = module.default as any;

    await vi.advanceTimersByTimeAsync(25);
    expect(exportedClient).toBe(redisHarness.client);
    expect(module.isRedisReady()).toBe(false);

    redisHarness.client.isOpen = true;
    redisHarness.client.isReady = true;
    redisHarness.handlers.get('ready')?.();

    expect(module.isRedisReady()).toBe(true);
  });

  it('uses the mock only when explicitly configured', async () => {
    process.env.MOCK_REDIS = 'true';
    const { default: client, isRedisReady } = await import('../RedisClient.js');

    expect(client).not.toBe(redisHarness.client);
    expect(client.isOpen).toBe(true);
    expect(isRedisReady()).toBe(false);
    expect(redisHarness.client.connect).not.toHaveBeenCalled();
  });
});
