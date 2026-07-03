import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

// In-memory store + recorder for the mocked DbPromise.
const db = vi.hoisted(() => ({
  rows: new Map<string, Row>(),
  runCalls: [] as { sql: string; params: any[] }[],
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `stage-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

// Minimal SQL-aware mock of DbPromise: enough to exercise the service logic.
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    db.runCalls.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('INSERT INTO rollout_stages')) {
      const [
        id,
        organization_id,
        project_id,
        name,
        wave_type,
        sequence,
        planned_start,
        planned_end,
        baseline_start,
        baseline_end,
        status,
        entry_criteria,
        exit_criteria,
        created_at,
        updated_at,
      ] = params;
      db.rows.set(id, {
        id,
        organization_id,
        project_id,
        name,
        wave_type,
        sequence,
        planned_start,
        planned_end,
        baseline_start,
        baseline_end,
        status,
        entry_criteria,
        exit_criteria,
        created_at,
        updated_at,
      });
      return { success: true, changes: 1 };
    }

    if (normalized.startsWith('UPDATE rollout_stages SET')) {
      // Last two params are org-scope WHERE binds (organization_id, id).
      const id = params[params.length - 1];
      const orgId = params[params.length - 2];
      const row = db.rows.get(id);
      if (row && row.organization_id === orgId) {
        // Re-derive SET column order from the SQL and apply.
        const setClause = normalized
          .substring(normalized.indexOf('SET ') + 4, normalized.indexOf(' WHERE '))
          .split(',')
          .map((s) => s.trim().split('=')[0].trim());
        setClause.forEach((col, i) => {
          row[col] = params[i];
        });
        db.rows.set(id, row);
      }
      return { success: true, changes: row ? 1 : 0 };
    }

    return { success: true, changes: 0 };
  },
  get: async (sql: string, params: any[] = []) => {
    // getStage: WHERE organization_id = ? AND id = ?
    const [orgId, id] = params;
    const row = db.rows.get(id);
    if (row && row.organization_id === orgId) return row;
    return null;
  },
  all: async (sql: string, params: any[] = []) => {
    const orgId = params[0];
    let rows = [...db.rows.values()].filter((r) => r.organization_id === orgId);
    if (params.length > 1) {
      const projectId = params[1];
      rows = rows.filter((r) => r.project_id === projectId);
    }
    return rows.sort((a, b) => a.sequence - b.sequence);
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  advanceStage,
  createStage,
  listStages,
  nextStatus,
  nextWave,
  updateStage,
  WAVE_ORDER,
} from '../../../server/src/services/rolloutStagesService.js';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

beforeEach(() => {
  db.rows.clear();
  db.runCalls = [];
  db.uuidCounter = 0;
});

describe('nextWave', () => {
  it('walks the canonical wave order pilot → limited → full → hypercare → closure', () => {
    expect(nextWave('pilot')).toBe('limited');
    expect(nextWave('limited')).toBe('full');
    expect(nextWave('full')).toBe('hypercare');
    expect(nextWave('hypercare')).toBe('closure');
  });

  it('returns null at the terminal wave (closure)', () => {
    expect(nextWave('closure')).toBeNull();
  });

  it('matches the exported WAVE_ORDER constant', () => {
    expect(WAVE_ORDER).toEqual(['pilot', 'limited', 'full', 'hypercare', 'closure']);
  });
});

describe('nextStatus', () => {
  it('walks not_started → active → gated → done', () => {
    expect(nextStatus('not_started')).toBe('active');
    expect(nextStatus('active')).toBe('gated');
    expect(nextStatus('gated')).toBe('done');
  });

  it('returns null at terminal status (done)', () => {
    expect(nextStatus('done')).toBeNull();
  });
});

describe('createStage', () => {
  it('inserts an org-scoped row with organization_id bound from the caller', async () => {
    const stage = await createStage(ORG, {
      name: 'Pilot wave',
      waveType: 'pilot',
      sequence: 1,
      projectId: 'proj-1',
    });

    expect(stage.id).toBe('stage-id-1');
    expect(stage.organizationId).toBe(ORG);
    expect(stage.status).toBe('not_started');

    // Verify the INSERT carried the org id in its params (org-scope in SQL).
    const insert = db.runCalls.find((c) => c.sql.includes('INSERT INTO rollout_stages'));
    expect(insert).toBeDefined();
    expect(insert!.params[1]).toBe(ORG);
    // Persisted row is org-scoped.
    expect(db.rows.get('stage-id-1')!.organization_id).toBe(ORG);
  });

  it('rejects an invalid waveType', async () => {
    await expect(
      createStage(ORG, { name: 'Bad', waveType: 'invalid' as any })
    ).rejects.toThrow(/invalid waveType/);
  });

  it('requires an organizationId', async () => {
    await expect(
      createStage('', { name: 'X', waveType: 'pilot' })
    ).rejects.toThrow(/organizationId is required/);
  });
});

describe('listStages', () => {
  it('returns only rows for the requesting org (org-scope isolation)', async () => {
    await createStage(ORG, { name: 'A', waveType: 'pilot', sequence: 2 });
    await createStage(ORG, { name: 'B', waveType: 'limited', sequence: 1 });
    await createStage(OTHER_ORG, { name: 'C', waveType: 'pilot', sequence: 0 });

    const mine = await listStages(ORG);
    expect(mine.map((s) => s.name)).toEqual(['B', 'A']); // ordered by sequence
    expect(mine.every((s) => s.organizationId === ORG)).toBe(true);
  });

  it('filters by projectId when provided', async () => {
    await createStage(ORG, { name: 'P1', waveType: 'pilot', projectId: 'proj-1' });
    await createStage(ORG, { name: 'P2', waveType: 'pilot', projectId: 'proj-2' });

    const scoped = await listStages(ORG, 'proj-1');
    expect(scoped.map((s) => s.name)).toEqual(['P1']);
  });
});

describe('advanceStage', () => {
  it('advances status through the full lifecycle then no-ops at done', async () => {
    const created = await createStage(ORG, { name: 'Wave', waveType: 'pilot' });
    expect(created.status).toBe('not_started');

    const s1 = await advanceStage(ORG, created.id);
    expect(s1!.status).toBe('active');

    const s2 = await advanceStage(ORG, created.id);
    expect(s2!.status).toBe('gated');

    const s3 = await advanceStage(ORG, created.id);
    expect(s3!.status).toBe('done');

    // Terminal — stays done.
    const s4 = await advanceStage(ORG, created.id);
    expect(s4!.status).toBe('done');
  });

  it('returns null for an unknown id', async () => {
    expect(await advanceStage(ORG, 'nope')).toBeNull();
  });

  it('will not advance a stage owned by another org', async () => {
    const created = await createStage(ORG, { name: 'Wave', waveType: 'pilot' });
    // Wrong org cannot see/advance it.
    expect(await advanceStage(OTHER_ORG, created.id)).toBeNull();
    // Original still untouched.
    const reread = await listStages(ORG);
    expect(reread[0].status).toBe('not_started');
  });
});

describe('updateStage', () => {
  it('patches mutable fields org-scoped and bumps updated_at', async () => {
    const created = await createStage(ORG, { name: 'Old', waveType: 'pilot' });
    const updated = await updateStage(ORG, created.id, {
      name: 'New',
      waveType: 'limited',
    });
    expect(updated!.name).toBe('New');
    expect(updated!.waveType).toBe('limited');

    // UPDATE SQL ends with the org-scope WHERE binds.
    const upd = db.runCalls.find((c) => c.sql.includes('UPDATE rollout_stages'));
    expect(upd).toBeDefined();
    expect(upd!.params[upd!.params.length - 2]).toBe(ORG);
    expect(upd!.params[upd!.params.length - 1]).toBe(created.id);
  });
});
