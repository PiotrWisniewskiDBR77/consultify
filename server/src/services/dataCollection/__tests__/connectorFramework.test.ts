import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-run-id'),
}));

const mockBatchCreate = vi.fn();

vi.mock('../../tablePlatform/RecordsService.js', () => ({
  default: {
    batchCreate: (...args: unknown[]) => mockBatchCreate(...args),
  },
}));

import {
  connectorRegistry,
  connectorRunner,
  type IConnector,
  type ExternalRecord,
} from '../connectorFramework.js';
import { SyncScheduler } from '../syncScheduler.js';

describe('ConnectorRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register + get returns the connector', () => {
    const mockConnector: IConnector = {
      type: 'csv',
      testConnection: vi.fn(),
      fetchSchema: vi.fn(),
      fetchRecords: vi.fn(),
    };

    connectorRegistry.register('test-csv', mockConnector);
    const result = connectorRegistry.get('test-csv');
    expect(result).toBe(mockConnector);
  });

  it('get unknown type throws', () => {
    expect(() => connectorRegistry.get('nonexistent-type-xyz')).toThrow(
      /No connector registered for type/,
    );
  });

  it('listTypes returns registered types', () => {
    const mockConnector: IConnector = {
      type: 'sheets',
      testConnection: vi.fn(),
      fetchSchema: vi.fn(),
      fetchRecords: vi.fn(),
    };
    connectorRegistry.register('test-sheets', mockConnector);
    const types = connectorRegistry.listTypes();
    expect(types).toContain('test-sheets');
  });
});

describe('ConnectorRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('run with mock connector creates records and provenance', async () => {
    const externalRecords: ExternalRecord[] = [
      { externalId: 'ext-1', data: { name: 'Alice', email: 'alice@test.com' } },
      { externalId: 'ext-2', data: { name: 'Bob', email: 'bob@test.com' } },
    ];

    const mockConnector: IConnector = {
      type: 'mock',
      testConnection: vi.fn(),
      fetchSchema: vi.fn(),
      fetchRecords: vi.fn().mockResolvedValue(externalRecords),
    };
    connectorRegistry.register('mock-type', mockConnector);

    const connectorRow = {
      id: 'conn-1',
      workspace_id: 'ws-1',
      organization_id: 'org-1',
      name: 'Test Connector',
      connector_type: 'mock-type',
      config: {},
      target_table_id: 'tbl-1',
      field_mapping: [
        { sourceField: 'name', targetFieldId: 'fld-name' },
        { sourceField: 'email', targetFieldId: 'fld-email' },
      ],
      schedule: null,
      last_run_at: null,
      last_run_status: null,
      created_by: 'user-1',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [connectorRow] })  // SELECT connector
      .mockResolvedValueOnce({ rows: [] })               // INSERT run
      .mockResolvedValueOnce({ rows: [] })               // INSERT provenance 1
      .mockResolvedValueOnce({ rows: [] })               // INSERT provenance 2
      .mockResolvedValueOnce({ rows: [] })               // UPDATE run
      .mockResolvedValueOnce({ rows: [] });              // UPDATE connector

    mockBatchCreate.mockResolvedValue([{ id: 'rec-1' }, { id: 'rec-2' }]);

    const result = await connectorRunner.run('conn-1');
    expect(result.status).toBe('success');
    expect(result.recordsFetched).toBe(2);
    expect(result.recordsImported).toBe(2);
    expect(mockBatchCreate).toHaveBeenCalled();
  });

  it('run with failing connector logs failure', async () => {
    const mockConnector: IConnector = {
      type: 'fail',
      testConnection: vi.fn(),
      fetchSchema: vi.fn(),
      fetchRecords: vi.fn().mockRejectedValue(new Error('Connection refused')),
    };
    connectorRegistry.register('fail-type', mockConnector);

    const connectorRow = {
      id: 'conn-fail',
      connector_type: 'fail-type',
      config: {},
      target_table_id: 'tbl-1',
      field_mapping: [{ sourceField: 'x', targetFieldId: 'y' }],
      created_by: null,
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [connectorRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await connectorRunner.run('conn-fail');
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toContain('Connection refused');
  });
});

describe('SyncScheduler', () => {
  let scheduler: SyncScheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    scheduler = new SyncScheduler();
  });

  afterEach(async () => {
    await scheduler.stop();
    vi.useRealTimers();
  });

  it('start loads connectors from DB and schedules them', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'conn-1', schedule: { enabled: true, intervalMinutes: 60 } },
        { id: 'conn-2', schedule: { enabled: true, intervalMinutes: 30 } },
      ],
    });

    await scheduler.start();
    expect(scheduler.isScheduled('conn-1')).toBe(true);
    expect(scheduler.isScheduled('conn-2')).toBe(true);
    expect(scheduler.getScheduledConnectors()).toHaveLength(2);
  });

  it('scheduleConnector creates a timer entry', () => {
    scheduler.scheduleConnector('conn-x', 15);
    expect(scheduler.isScheduled('conn-x')).toBe(true);

    const scheduled = scheduler.getScheduledConnectors();
    const entry = scheduled.find((s) => s.connectorId === 'conn-x');
    expect(entry).toBeDefined();
    expect(entry!.intervalMinutes).toBe(15);
  });

  it('unscheduleConnector clears the timer', () => {
    scheduler.scheduleConnector('conn-y', 10);
    expect(scheduler.isScheduled('conn-y')).toBe(true);

    scheduler.unscheduleConnector('conn-y');
    expect(scheduler.isScheduled('conn-y')).toBe(false);
  });

  it('scheduleConnector throws for non-positive interval', () => {
    expect(() => scheduler.scheduleConnector('conn-z', 0)).toThrow(
      /intervalMinutes must be positive/,
    );
    expect(() => scheduler.scheduleConnector('conn-z', -5)).toThrow(
      /intervalMinutes must be positive/,
    );
  });

  it('stop clears all timers', async () => {
    scheduler.scheduleConnector('conn-a', 10);
    scheduler.scheduleConnector('conn-b', 20);
    expect(scheduler.getScheduledConnectors()).toHaveLength(2);

    await scheduler.stop();
    expect(scheduler.getScheduledConnectors()).toHaveLength(0);
  });
});
