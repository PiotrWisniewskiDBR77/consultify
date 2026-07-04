import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'snapshot-uuid-001'),
}));

import auditService from '../AuditService.js';

const ORG_A_BASE = 'base-org-a';
const ORG_B_BASE = 'base-org-b';

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logEvent — write an audit event', () => {
    it('inserts an audit event row with serialized before/after/metadata', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.logEvent(
        'update',
        'record',
        'rec-1',
        'user-1',
        { Name: 'Old' },
        { Name: 'New' },
        { table_id: 'tbl-1' }
      );

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tp_audit_events'), [
        'update',
        'record',
        'rec-1',
        'user-1',
        JSON.stringify({ Name: 'Old' }),
        JSON.stringify({ Name: 'New' }),
        JSON.stringify({ table_id: 'tbl-1' }),
      ]);
    });

    it('defaults metadata to "{}" and actor/before/after to null when omitted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.logEvent('create', 'record', 'rec-2');

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
        'create',
        'record',
        'rec-2',
        null,
        null,
        null,
        '{}',
      ]);
    });

    it('propagates db errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('insert failed'));
      await expect(auditService.logEvent('create', 'record', 'rec-1')).rejects.toThrow(
        'insert failed'
      );
    });
  });

  describe('getEventsForEntity / getEventsForActor — read the trail', () => {
    it('returns events scoped to the entity, most recent first', async () => {
      const rows = [
        { id: 'ev-2', event_type: 'update', created_at: '2024-01-02' },
        { id: 'ev-1', event_type: 'create', created_at: '2024-01-01' },
      ];
      mockQuery.mockResolvedValueOnce({ rows });
      const result = await auditService.getEventsForEntity('record', 'rec-1');
      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE entity_type = $1 AND entity_id = $2'), [
        'record',
        'rec-1',
        100,
      ]);
    });

    it('respects a custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.getEventsForEntity('record', 'rec-1', 5);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['record', 'rec-1', 5]);
    });

    it('getEventsForActor scopes by actor_id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ev-1' }] });
      const result = await auditService.getEventsForActor('user-1');
      expect(result).toEqual([{ id: 'ev-1' }]);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE actor_id = $1'), [
        'user-1',
        100,
      ]);
    });

    it('propagates db errors from getEventsForEntity', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      await expect(auditService.getEventsForEntity('record', 'rec-1')).rejects.toThrow('db down');
    });
  });

  describe('getRecordHistory', () => {
    it('maps event_type to a human action and extracts field changes', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ev-1',
            entity_id: 'rec-1',
            actor_id: 'user-1',
            event_type: 'update',
            before_data: JSON.stringify({ data: { Name: 'Old' } }),
            after_data: JSON.stringify({ data: { Name: 'New' } }),
            metadata: '{}',
            created_at: '2024-01-01T00:00:00Z',
            user_name: 'Alice',
          },
        ],
      });

      const result = await auditService.getRecordHistory('rec-1');
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('updated');
      expect(result[0].userName).toBe('Alice');
      expect(result[0].changes).toEqual([{ fieldId: 'Name', oldValue: 'Old', newValue: 'New' }]);
    });

    it('maps create/delete event types to created/deleted', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ev-1',
            entity_id: 'rec-1',
            actor_id: null,
            event_type: 'create',
            before_data: null,
            after_data: JSON.stringify({ data: { Name: 'New' } }),
            metadata: '{}',
            created_at: '2024-01-01T00:00:00Z',
            user_name: null,
          },
          {
            id: 'ev-2',
            entity_id: 'rec-1',
            actor_id: null,
            event_type: 'delete',
            before_data: JSON.stringify({ data: { Name: 'New' } }),
            after_data: null,
            metadata: '{}',
            created_at: '2024-01-02T00:00:00Z',
            user_name: null,
          },
        ],
      });

      const result = await auditService.getRecordHistory('rec-1');
      expect(result[0].action).toBe('created');
      expect(result[1].action).toBe('deleted');
    });

    it('applies default limit/offset and propagates custom values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.getRecordHistory('rec-1', { limit: 10, offset: 20 });
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['rec-1', 10, 20]);
    });

    it('propagates db errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      await expect(auditService.getRecordHistory('rec-1')).rejects.toThrow('db down');
    });
  });

  describe('getTableActivityFeed', () => {
    it('scopes to metadata->>table_id and assigns a time group', async () => {
      const nowIso = new Date().toISOString();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ev-1',
            event_type: 'update',
            entity_type: 'record',
            entity_id: 'rec-1',
            actor_id: 'user-1',
            before_data: null,
            after_data: null,
            metadata: JSON.stringify({ table_id: 'tbl-1' }),
            created_at: nowIso,
            actor_name: 'Alice',
          },
        ],
      });

      const result = await auditService.getTableActivityFeed('tbl-1');
      expect(result).toHaveLength(1);
      expect(result[0].timeGroup).toBe('last_hour');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ae.metadata->>'table_id' = $1"),
        ['tbl-1', 50]
      );
    });

    it('adds a since filter when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.getTableActivityFeed('tbl-1', { since: '2024-01-01', limit: 10 });
      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain('ae.created_at > $2');
      expect(params).toEqual(['tbl-1', '2024-01-01', 10]);
    });
  });

  describe('createSnapshot / listSnapshots — org scoping', () => {
    it('createSnapshot scopes tables/fields/views/records to the given baseId', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'tbl-1' }] }) // tables for base
        .mockResolvedValueOnce({ rows: [{ id: 'f-1' }] }) // fields
        .mockResolvedValueOnce({ rows: [{ id: 'v-1' }] }) // views
        .mockResolvedValueOnce({ rows: [{ id: 'r-1' }] }) // records
        .mockResolvedValueOnce({ rows: [] }); // insert audit event

      const snapshot = await auditService.createSnapshot(ORG_A_BASE, 'My Snapshot', 'user-1');

      expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining('tp_tables WHERE base_id = $1'), [
        ORG_A_BASE,
      ]);
      expect(snapshot).toEqual({
        id: 'snapshot-uuid-001',
        baseId: ORG_A_BASE,
        name: 'My Snapshot',
        createdBy: 'user-1',
        createdAt: expect.any(String),
        recordCount: 1,
      });
    });

    it('does not query fields/views/records tables when the base has no tables', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // tables for base → none
        .mockResolvedValueOnce({ rows: [] }); // insert audit event

      await auditService.createSnapshot(ORG_A_BASE);
      // Only 2 queries: SELECT tables, INSERT audit event (fields/views/records skipped)
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('listSnapshots only returns snapshots for the requested base (org scoping)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'snap-1',
            created_at: '2024-01-01',
            metadata: JSON.stringify({ snapshot_name: 'Snap A', record_count: 3 }),
          },
        ],
      });

      const result = await auditService.listSnapshots(ORG_A_BASE);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('entity_id = $1'), [ORG_A_BASE]);
      expect(result).toEqual([
        { id: 'snap-1', name: 'Snap A', createdAt: '2024-01-01', recordCount: 3 },
      ]);
    });

    it('listSnapshots for a different base does not see another base snapshots (separate call)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await auditService.listSnapshots(ORG_B_BASE);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [ORG_B_BASE]);
      expect(result).toEqual([]);
    });
  });

  describe('logCellChanges / getCellHistory / getRecordCellHistory', () => {
    it('logCellChanges is a no-op for an empty changes array', async () => {
      await auditService.logCellChanges('rec-1', 'tbl-1', [], 'user-1');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('logCellChanges inserts one row per change with serialized values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.logCellChanges(
        'rec-1',
        'tbl-1',
        [{ fieldId: 'f1', oldValue: 'a', newValue: 'b' }],
        'user-1'
      );
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tp_cell_history'), [
        'rec-1',
        'tbl-1',
        'f1',
        JSON.stringify('a'),
        JSON.stringify('b'),
        'user-1',
      ]);
    });

    it('logCellChanges swallows db errors (fail-soft, no throw)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      await expect(
        auditService.logCellChanges('rec-1', 'tbl-1', [{ fieldId: 'f1', oldValue: 1, newValue: 2 }], 'u1')
      ).resolves.toBeUndefined();
    });

    it('getCellHistory scopes to record+field with pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c-1' }] });
      const result = await auditService.getCellHistory('rec-1', 'f1', 10, 5);
      expect(result).toEqual([{ id: 'c-1' }]);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['rec-1', 'f1', 10, 5]);
    });

    it('getRecordCellHistory scopes to the record only', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await auditService.getRecordCellHistory('rec-1', 25);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE record_id = $1'), [
        'rec-1',
        25,
      ]);
    });
  });

  describe('restoreSnapshot', () => {
    it('throws when the snapshot id does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(auditService.restoreSnapshot('missing-snap')).rejects.toThrow(
        'Snapshot missing-snap not found'
      );
    });

    it('throws when snapshot after_data is empty', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ entity_id: ORG_A_BASE, after_data: null, actor_id: 'user-1' }],
      });
      await expect(auditService.restoreSnapshot('snap-1')).rejects.toThrow(
        'Snapshot data is empty'
      );
    });
  });
});
