/**
 * Idea Map Auto-Snapshot Job — unit tests (M06 F0.5)
 *
 * Covers:
 * - env config parsing (interval, retention, cron expression)
 * - change-detection policy (shouldSnapshot)
 * - retention policy (selectSnapshotsToPrune — auto-only via `auto:` label prefix)
 * - runner orchestration with mocked queryHelpers (select → insert → prune,
 *   per-map error isolation, test-env / env-flag / missing-table guards)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryFirst: vi.fn(),
  queryRun: vi.fn(),
  query: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(),
  hasColumn: vi.fn(),
  clearSchemaCache: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  AUTO_SNAPSHOT_LABEL,
  autoSnapshotCronExpression,
  getAutoSnapshotIntervalMinutes,
  getAutoSnapshotRetention,
  runIdeaMapAutoSnapshots,
  selectSnapshotsToPrune,
  shouldSnapshot,
} from '../../../server/src/jobs/ideaMapAutoSnapshotJob';
import { isAutoSnapshotLabel } from '../../../server/src/services/ideaMapSnapshotService';
import { getTableColumns } from '../../../server/src/utils/dbSchema.js';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';

const mockedGetTableColumns = vi.mocked(getTableColumns);
const mockedQueryAll = vi.mocked(queryHelpers.queryAll);
const mockedQueryRun = vi.mocked(queryHelpers.queryRun);
const mockedRun = vi.mocked(queryHelpers.run);

const REAL_COLUMNS = new Set([
  'id',
  'idea_id',
  'user_id',
  'organization_id',
  'label',
  'node_count',
  'edge_count',
  'data_json',
  'created_at',
]);

describe('ideaMapAutoSnapshotJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('config', () => {
    it('defaults interval to 15 minutes', () => {
      expect(getAutoSnapshotIntervalMinutes({} as NodeJS.ProcessEnv)).toBe(15);
    });

    it('reads interval from env and clamps to sane bounds', () => {
      expect(
        getAutoSnapshotIntervalMinutes({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: '5',
        } as NodeJS.ProcessEnv)
      ).toBe(5);
      expect(
        getAutoSnapshotIntervalMinutes({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: '0',
        } as NodeJS.ProcessEnv)
      ).toBe(1);
      expect(
        getAutoSnapshotIntervalMinutes({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: '999999',
        } as NodeJS.ProcessEnv)
      ).toBe(24 * 60);
      expect(
        getAutoSnapshotIntervalMinutes({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: 'garbage',
        } as NodeJS.ProcessEnv)
      ).toBe(15);
    });

    it('defaults retention to 20 and clamps', () => {
      expect(getAutoSnapshotRetention({} as NodeJS.ProcessEnv)).toBe(20);
      expect(
        getAutoSnapshotRetention({ IDEA_MAP_AUTO_SNAPSHOT_RETENTION: '5' } as NodeJS.ProcessEnv)
      ).toBe(5);
      expect(
        getAutoSnapshotRetention({ IDEA_MAP_AUTO_SNAPSHOT_RETENTION: '0' } as NodeJS.ProcessEnv)
      ).toBe(1);
      expect(
        getAutoSnapshotRetention({ IDEA_MAP_AUTO_SNAPSHOT_RETENTION: 'nope' } as NodeJS.ProcessEnv)
      ).toBe(20);
    });

    it('builds a minute-level cron expression for sub-hour intervals', () => {
      expect(autoSnapshotCronExpression({} as NodeJS.ProcessEnv)).toBe('*/15 * * * *');
      expect(
        autoSnapshotCronExpression({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: '5',
        } as NodeJS.ProcessEnv)
      ).toBe('*/5 * * * *');
    });

    it('converts >= 60 minute intervals to hourly cron expressions', () => {
      expect(
        autoSnapshotCronExpression({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: '120',
        } as NodeJS.ProcessEnv)
      ).toBe('0 */2 * * *');
      expect(
        autoSnapshotCronExpression({
          IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN: '60',
        } as NodeJS.ProcessEnv)
      ).toBe('0 */1 * * *');
    });
  });

  describe('shouldSnapshot (change detection)', () => {
    it('skips empty maps', () => {
      expect(
        shouldSnapshot({ updatedAt: '2026-07-04T10:00:00Z', lastSnapshotAt: null, nodeCount: 0, edgeCount: 0 })
      ).toBe(false);
    });

    it('snapshots a non-empty map with no prior snapshot', () => {
      expect(
        shouldSnapshot({ updatedAt: '2026-07-04T10:00:00Z', lastSnapshotAt: null, nodeCount: 3, edgeCount: 2 })
      ).toBe(true);
    });

    it('snapshots when the map changed after the latest snapshot', () => {
      expect(
        shouldSnapshot({
          updatedAt: '2026-07-04T10:00:00.000Z',
          lastSnapshotAt: '2026-07-04T09:00:00.000Z',
          nodeCount: 3,
          edgeCount: 2,
        })
      ).toBe(true);
    });

    it('skips when the map did not change since the latest snapshot', () => {
      expect(
        shouldSnapshot({
          updatedAt: '2026-07-04T08:00:00.000Z',
          lastSnapshotAt: '2026-07-04T09:00:00.000Z',
          nodeCount: 3,
          edgeCount: 2,
        })
      ).toBe(false);
      // Equal timestamps → no change.
      expect(
        shouldSnapshot({
          updatedAt: '2026-07-04T09:00:00.000Z',
          lastSnapshotAt: '2026-07-04T09:00:00.000Z',
          nodeCount: 3,
          edgeCount: 2,
        })
      ).toBe(false);
    });

    it('handles node-pg Date objects', () => {
      expect(
        shouldSnapshot({
          updatedAt: new Date('2026-07-04T10:00:00Z'),
          lastSnapshotAt: new Date('2026-07-04T09:00:00Z'),
          nodeCount: 1,
          edgeCount: 0,
        })
      ).toBe(true);
    });

    it("handles SQLite 'YYYY-MM-DD HH:MM:SS' timestamps", () => {
      expect(
        shouldSnapshot({
          updatedAt: '2026-07-04 10:00:00',
          lastSnapshotAt: '2026-07-04 09:00:00',
          nodeCount: 1,
          edgeCount: 0,
        })
      ).toBe(true);
    });

    it('fails towards preserving data when the last-snapshot time is unparseable', () => {
      expect(
        shouldSnapshot({
          updatedAt: '2026-07-04T10:00:00Z',
          lastSnapshotAt: 'not-a-date',
          nodeCount: 1,
          edgeCount: 0,
        })
      ).toBe(true);
    });

    it('skips when the map updated_at is unparseable (change cannot be proven)', () => {
      expect(
        shouldSnapshot({
          updatedAt: 'not-a-date',
          lastSnapshotAt: '2026-07-04T09:00:00Z',
          nodeCount: 1,
          edgeCount: 0,
        })
      ).toBe(false);
    });
  });

  describe('selectSnapshotsToPrune (retention)', () => {
    const auto = (id: string, createdAt: string) => ({
      id,
      label: AUTO_SNAPSHOT_LABEL,
      createdAt,
    });
    const manual = (id: string, createdAt: string) => ({
      id,
      label: 'Before big refactor',
      createdAt,
    });

    it('marks auto snapshots by label prefix', () => {
      expect(isAutoSnapshotLabel(AUTO_SNAPSHOT_LABEL)).toBe(true);
      expect(isAutoSnapshotLabel('auto: 2026-07-04')).toBe(true);
      expect(isAutoSnapshotLabel('AUTO:SNAPSHOT')).toBe(true);
      expect(isAutoSnapshotLabel('Manual save')).toBe(false);
      expect(isAutoSnapshotLabel(null)).toBe(false);
      expect(isAutoSnapshotLabel(undefined)).toBe(false);
    });

    it('returns nothing when auto snapshots are within the limit', () => {
      const rows = [auto('a1', '2026-07-04T10:00:00Z'), auto('a2', '2026-07-04T09:00:00Z')];
      expect(selectSnapshotsToPrune(rows, 20)).toEqual([]);
    });

    it('prunes the OLDEST auto snapshots beyond the keep limit', () => {
      const rows = [
        auto('a-new', '2026-07-04T10:00:00Z'),
        auto('a-mid', '2026-07-04T09:00:00Z'),
        auto('a-old', '2026-07-04T08:00:00Z'),
        auto('a-oldest', '2026-07-04T07:00:00Z'),
      ];
      expect(selectSnapshotsToPrune(rows, 2)).toEqual(['a-old', 'a-oldest']);
    });

    it('never prunes manual snapshots, even when they are the oldest', () => {
      const rows = [
        manual('m-oldest', '2026-07-01T00:00:00Z'),
        auto('a1', '2026-07-04T10:00:00Z'),
        auto('a2', '2026-07-04T09:00:00Z'),
        auto('a3', '2026-07-04T08:00:00Z'),
        manual('m2', '2026-07-02T00:00:00Z'),
      ];
      const pruned = selectSnapshotsToPrune(rows, 1);
      expect(pruned).toEqual(['a2', 'a3']);
      expect(pruned).not.toContain('m-oldest');
      expect(pruned).not.toContain('m2');
    });

    it('sorts by created_at regardless of input order (node-pg Dates included)', () => {
      const rows = [
        { id: 'a-old', label: 'auto:snapshot', createdAt: new Date('2026-07-04T08:00:00Z') },
        { id: 'a-new', label: 'auto:snapshot', createdAt: new Date('2026-07-04T10:00:00Z') },
      ];
      expect(selectSnapshotsToPrune(rows, 1)).toEqual(['a-old']);
    });

    it('keeps at least one auto snapshot even for keep=0 (clamped)', () => {
      const rows = [auto('a1', '2026-07-04T10:00:00Z'), auto('a2', '2026-07-04T09:00:00Z')];
      expect(selectSnapshotsToPrune(rows, 0)).toEqual(['a2']);
    });
  });

  describe('runIdeaMapAutoSnapshots (runner)', () => {
    const mapRow = (over: Record<string, unknown> = {}) => ({
      id: 'map-1',
      ideaId: 'idea-1',
      userId: 'user-1',
      organizationId: 'org-1',
      nodesJson: JSON.stringify([{ id: 'n1' }, { id: 'n2' }]),
      edgesJson: JSON.stringify([{ id: 'e1' }]),
      updatedAt: '2026-07-04T10:00:00.000Z',
      lastSnapshotAt: '2026-07-04T09:00:00.000Z',
      ...over,
    });

    beforeEach(() => {
      mockedGetTableColumns.mockResolvedValue(REAL_COLUMNS);
      mockedQueryRun.mockResolvedValue({ changes: 1 } as any);
      mockedRun.mockResolvedValue({ changes: 1 } as any);
    });

    it('refuses to run in test env without force', async () => {
      const result = await runIdeaMapAutoSnapshots();
      expect(result.disabledReason).toBe('test_env');
      expect(mockedQueryAll).not.toHaveBeenCalled();
    });

    it('respects DISABLE_IDEA_MAP_AUTO_SNAPSHOTS=true', async () => {
      vi.stubEnv('DISABLE_IDEA_MAP_AUTO_SNAPSHOTS', 'true');
      const result = await runIdeaMapAutoSnapshots({ force: true });
      expect(result.disabledReason).toBe('env_disabled');
      expect(mockedQueryAll).not.toHaveBeenCalled();
    });

    it('degrades honestly when tables are missing', async () => {
      mockedGetTableColumns.mockResolvedValue(new Set());
      const result = await runIdeaMapAutoSnapshots({ force: true });
      expect(result.disabledReason).toBe('missing_tables');
      expect(mockedQueryAll).not.toHaveBeenCalled();
    });

    it('snapshots changed maps and skips unchanged / empty ones', async () => {
      mockedQueryAll
        .mockResolvedValueOnce([
          mapRow(), // changed → snapshot
          mapRow({
            id: 'map-2',
            ideaId: 'idea-2',
            updatedAt: '2026-07-04T08:00:00.000Z', // older than last snapshot → skip
          }),
          mapRow({
            id: 'map-3',
            ideaId: 'idea-3',
            nodesJson: '[]',
            edgesJson: '[]',
            lastSnapshotAt: null, // empty → skip
          }),
        ])
        .mockResolvedValueOnce([]); // retention read for map-1

      const result = await runIdeaMapAutoSnapshots({ force: true });

      expect(result.scanned).toBe(3);
      expect(result.snapshotted).toBe(1);
      expect(result.skippedUnchanged).toBe(1);
      expect(result.skippedEmpty).toBe(1);
      expect(result.errors).toBe(0);

      // INSERT went through the shared service (queryHelpers.run) with the auto label.
      expect(mockedRun).toHaveBeenCalledTimes(1);
      const [insertSql, insertParams] = mockedRun.mock.calls[0];
      expect(String(insertSql)).toContain('INSERT INTO my_idea_map_snapshots');
      expect(insertParams).toEqual(
        expect.arrayContaining(['idea-1', 'user-1', 'org-1', AUTO_SNAPSHOT_LABEL, 2, 1])
      );
      // No prune needed.
      expect(mockedQueryRun).not.toHaveBeenCalled();
    });

    it('accepts JSONB payloads already parsed to objects (node-pg)', async () => {
      mockedQueryAll
        .mockResolvedValueOnce([
          mapRow({ nodesJson: [{ id: 'n1' }], edgesJson: [], lastSnapshotAt: null }),
        ])
        .mockResolvedValueOnce([]);

      const result = await runIdeaMapAutoSnapshots({ force: true });
      expect(result.snapshotted).toBe(1);
      const [, insertParams] = mockedRun.mock.calls[0];
      expect(insertParams).toEqual(expect.arrayContaining([1, 0]));
    });

    it('prunes oldest auto snapshots beyond retention, scoped to the map', async () => {
      const retentionRows = [
        // 3 autos (newest→oldest) + 1 manual older than all of them
        { id: 'a1', label: 'auto:snapshot', createdAt: '2026-07-04T10:00:00Z' },
        { id: 'a2', label: 'auto:snapshot', createdAt: '2026-07-04T09:00:00Z' },
        { id: 'a3', label: 'auto:snapshot', createdAt: '2026-07-04T08:00:00Z' },
        { id: 'manual-1', label: 'My checkpoint', createdAt: '2026-07-01T00:00:00Z' },
      ];
      mockedQueryAll.mockResolvedValueOnce([mapRow()]).mockResolvedValueOnce(retentionRows);

      const result = await runIdeaMapAutoSnapshots({ force: true, retention: 2 });

      expect(result.snapshotted).toBe(1);
      expect(result.pruned).toBe(1);
      expect(mockedQueryRun).toHaveBeenCalledTimes(1);
      const [deleteSql, deleteParams] = mockedQueryRun.mock.calls[0];
      expect(String(deleteSql)).toContain('DELETE FROM my_idea_map_snapshots');
      expect(String(deleteSql)).toContain('idea_id = ? AND user_id = ? AND organization_id = ?');
      expect(deleteParams).toEqual(['idea-1', 'user-1', 'org-1', 'a3']);
      expect(deleteParams).not.toContain('manual-1');
    });

    it('isolates per-map errors and keeps processing the batch', async () => {
      mockedQueryAll
        .mockResolvedValueOnce([
          mapRow(),
          mapRow({ id: 'map-2', ideaId: 'idea-2', lastSnapshotAt: null }),
        ])
        // retention read only happens for the successful second map
        .mockResolvedValueOnce([]);
      mockedRun
        .mockRejectedValueOnce(new Error('insert exploded'))
        .mockResolvedValueOnce({ changes: 1 } as any);

      const result = await runIdeaMapAutoSnapshots({ force: true });

      expect(result.errors).toBe(1);
      expect(result.snapshotted).toBe(1);
    });
  });
});
