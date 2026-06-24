import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  rows: [] as Row[],
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  // captureBaseline strips dashes — give a dashed shape so the result is deterministic.
  return `baseline-${db.uuidCounter}-x-x-x`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Minimal in-memory DbPromise honouring org-scope on read and JSON storage.
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('INSERT INTO plan_baselines')) {
      const [id, organizationId, projectId, label, snapshot, reason, createdBy] = params;
      db.rows.push({
        id,
        organization_id: organizationId,
        project_id: projectId,
        label,
        snapshot, // stored as JSON string, exactly as the service stringified it
        reason,
        created_by: createdBy,
        created_at: `2026-06-23T00:00:0${db.rows.length}Z`,
      });
      return { changes: 1 };
    }
    return { changes: 0 };
  },
  all: async (_sql: string, params: any[] = []) => {
    const [organizationId, projectId] = params;
    return db.rows
      .filter((r) => r.organization_id === organizationId && r.project_id === projectId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },
  get: async (_sql: string, params: any[] = []) => {
    const [organizationId, projectId] = params;
    const matches = db.rows
      .filter((r) => r.organization_id === organizationId && r.project_id === projectId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return matches[0];
  },
}));

import {
  captureBaseline,
  getLatestBaseline,
  listBaselines,
  computeSlip,
} from '../../../server/src/services/rolloutBaselineService.js';

beforeEach(() => {
  db.rows = [];
  db.uuidCounter = 0;
});

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const PROJECT = 'proj-1';

describe('captureBaseline', () => {
  it('persists an org-scoped row, JSON-stringifies the snapshot, and returns the parsed object', async () => {
    const snapshot = { tasks: [{ id: 't1', start: '2026-01-01' }], version: 3 };

    const result = await captureBaseline(ORG, PROJECT, snapshot, {
      label: 'Approved kickoff',
      reason: 'initial baseline',
      createdBy: 'user-7',
    });

    expect(result.organizationId).toBe(ORG);
    expect(result.projectId).toBe(PROJECT);
    expect(result.label).toBe('Approved kickoff');
    expect(result.reason).toBe('initial baseline');
    expect(result.createdBy).toBe('user-7');
    // Returned snapshot is the object, not a string.
    expect(result.snapshot).toEqual(snapshot);

    // Stored row carries org + a JSON string, and re-parses to the original object.
    expect(db.rows).toHaveLength(1);
    const stored = db.rows[0];
    expect(stored.organization_id).toBe(ORG);
    expect(typeof stored.snapshot).toBe('string');
    expect(JSON.parse(stored.snapshot)).toEqual(snapshot);
  });

  it('defaults optional fields to null', async () => {
    const result = await captureBaseline(ORG, PROJECT, { a: 1 });
    expect(result.label).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.createdBy).toBeNull();
  });
});

describe('getLatestBaseline', () => {
  it('returns the most recent baseline for the org+project with a parsed snapshot', async () => {
    await captureBaseline(ORG, PROJECT, { v: 1 }, { label: 'first' });
    await captureBaseline(ORG, PROJECT, { v: 2 }, { label: 'second' });

    const latest = await getLatestBaseline(ORG, PROJECT);
    expect(latest).not.toBeNull();
    expect(latest!.label).toBe('second');
    expect(latest!.snapshot).toEqual({ v: 2 });
  });

  it('is org-scoped — a foreign org never sees the baseline', async () => {
    await captureBaseline(ORG, PROJECT, { v: 1 });

    expect(await getLatestBaseline(OTHER_ORG, PROJECT)).toBeNull();
    expect(await listBaselines(OTHER_ORG, PROJECT)).toEqual([]);
  });

  it('returns null when no baseline exists', async () => {
    expect(await getLatestBaseline(ORG, PROJECT)).toBeNull();
  });
});

describe('listBaselines', () => {
  it('returns all baselines newest-first, parsed, org-scoped', async () => {
    await captureBaseline(ORG, PROJECT, { v: 1 }, { label: 'first' });
    await captureBaseline(ORG, PROJECT, { v: 2 }, { label: 'second' });

    const list = await listBaselines(ORG, PROJECT);
    expect(list.map((b) => b.label)).toEqual(['second', 'first']);
    expect(list[0].snapshot).toEqual({ v: 2 });
  });
});

describe('computeSlip', () => {
  it('reports positive slip when actuals run late', () => {
    const slip = computeSlip(
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2026-01-04', end: '2026-02-10' }
    );
    expect(slip.startSlipDays).toBe(3);
    expect(slip.endSlipDays).toBe(10);
  });

  it('reports negative slip when actuals run early', () => {
    const slip = computeSlip(
      { start: '2026-01-10', end: '2026-02-10' },
      { start: '2026-01-05', end: '2026-02-01' }
    );
    expect(slip.startSlipDays).toBe(-5);
    expect(slip.endSlipDays).toBe(-9);
  });

  it('reports zero slip when actuals match baseline', () => {
    const slip = computeSlip(
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2026-01-01', end: '2026-01-31' }
    );
    expect(slip).toEqual({ startSlipDays: 0, endSlipDays: 0 });
  });

  it('is safe on unparseable dates (returns 0)', () => {
    const slip = computeSlip(
      { start: 'not-a-date', end: '2026-01-31' },
      { start: '2026-01-05', end: 'also-bad' }
    );
    expect(slip).toEqual({ startSlipDays: 0, endSlipDays: 0 });
  });
});
