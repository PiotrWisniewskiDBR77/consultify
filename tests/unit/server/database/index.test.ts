import { describe, expect, it, vi } from 'vitest';

const poolInstances: any[] = [];
const monitorInstances: any[] = [];

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  createDatabase: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('../../../../server/src/database/DatabaseMetrics.js', () => ({
  getDatabaseMetrics: vi.fn(),
}));

vi.mock('../../../../server/src/database/SlowQueryLogger.js', () => ({
  getSlowQueryLogger: vi.fn(),
}));

vi.mock('../../../../server/src/database/ConnectionPool.js', () => ({
  ConnectionPool: class ConnectionPool {
    public initialize = vi.fn(async () => undefined);
    public shutdown = vi.fn(async () => undefined);
    public on = vi.fn();
    constructor(...args: any[]) {
      (this as any).__args = args;
      poolInstances.push(this);
    }
  },
}));

vi.mock('../../../../server/src/database/ConnectionHealthMonitor.js', () => ({
  ConnectionHealthMonitor: class ConnectionHealthMonitor {
    public start = vi.fn();
    public stop = vi.fn();
    public on = vi.fn();
    constructor(...args: any[]) {
      (this as any).__args = args;
      monitorInstances.push(this);
    }
  },
}));

async function importFresh() {
  vi.resetModules();
  poolInstances.length = 0;
  monitorInstances.length = 0;
  return await import('../../../../server/src/database/index.js');
}

describe('server database/index', () => {
  it('skips initialization when DISABLE_CONNECTION_POOL=true', async () => {
    process.env.DISABLE_CONNECTION_POOL = 'true';
    const mod = await importFresh();
    await mod.initializeConnectionPool();
    expect(poolInstances.length).toBe(0);
  });

  it('initializes pool and starts health monitor', async () => {
    delete process.env.DISABLE_CONNECTION_POOL;
    const mod = await importFresh();
    await mod.initializeConnectionPool();
    expect(poolInstances.length).toBe(1);
    expect(monitorInstances.length).toBe(1);
    expect(monitorInstances[0].start).toHaveBeenCalled();
    expect(mod.getConnectionPool()).toBe(poolInstances[0]);
    expect(mod.getHealthMonitor()).toBe(monitorInstances[0]);
  });

  it('second initialize warns and does not create a second pool', async () => {
    delete process.env.DISABLE_CONNECTION_POOL;
    const mod = await importFresh();
    await mod.initializeConnectionPool();
    await mod.initializeConnectionPool();
    expect(poolInstances.length).toBe(1);
  });

  it('shutdown stops monitor and shuts down pool', async () => {
    delete process.env.DISABLE_CONNECTION_POOL;
    const mod = await importFresh();
    await mod.initializeConnectionPool();
    await mod.shutdownConnectionPool();
    expect(monitorInstances[0].stop).toHaveBeenCalled();
    expect(poolInstances[0].shutdown).toHaveBeenCalled();
  });

  it('shutdown resets exported instances to null', async () => {
    delete process.env.DISABLE_CONNECTION_POOL;
    const mod = await importFresh();
    await mod.initializeConnectionPool();
    await mod.shutdownConnectionPool();
    expect(mod.getConnectionPool()).toBe(null);
    expect(mod.getHealthMonitor()).toBe(null);
  });
});
