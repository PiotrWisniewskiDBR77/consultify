/**
 * Uspójnienie F1.1/F1.2 — kanoniczny lejek tworzenia inicjatyw.
 * Walidacja Zod (single gate), lineage, status→DRAFT, name+title, org-scope.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRun, auditLog } = vi.hoisted(() => ({
  queryRun: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...a: unknown[]) => queryRun(...a),
}));
vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: (...a: unknown[]) => auditLog(...a) },
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { createInitiative } from '../../../server/src/services/initiative/createInitiativeService';

const ORG = 'org-1';

// Pull the SQL + params from the most recent INSERT call (the funnel also runs a
// post-insert title-sync UPDATE, so the last call is not the insert).
const lastInsert = () => {
  const inserts = queryRun.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO initiatives'));
  const call = inserts[inserts.length - 1];
  return { sql: String(call[0]), params: call[1] as unknown[] };
};

beforeEach(() => {
  vi.clearAllMocks();
  queryRun.mockResolvedValue(undefined);
  auditLog.mockResolvedValue(undefined);
});

describe('createInitiativeService — single funnel', () => {
  it('creates with status DRAFT by default and writes BOTH name and title', async () => {
    const res = await createInitiative(ORG, { title: 'Migracja ERP' });
    expect(res.id).toBeTruthy();
    expect(res.status).toBe('DRAFT');
    expect(res.name).toBe('Migracja ERP');
    expect(res.title).toBe('Migracja ERP');
    const { sql, params } = lastInsert();
    expect(sql).toContain('INSERT INTO initiatives');
    expect(sql).toContain('name, title'); // both columns present in modern insert
    // org id is the 2nd param; title appears twice (name + title positions)
    expect(params[1]).toBe(ORG);
    expect(params.filter((p) => p === 'Migracja ERP').length).toBe(2);
    expect(params).toContain('DRAFT');
  });

  it('accepts the legacy `name` alias as the title', async () => {
    const res = await createInitiative(ORG, { name: 'Z legacy name' });
    expect(res.title).toBe('Z legacy name');
    expect(res.status).toBe('DRAFT');
  });

  it('preserves an explicitly provided status', async () => {
    const res = await createInitiative(ORG, { title: 'X', status: 'PLANNING' });
    expect(res.status).toBe('PLANNING');
  });

  it('enforces lineage: non-manual sourceType requires sourceId', async () => {
    await expect(
      createInitiative(ORG, { title: 'X', sourceType: 'assessment' })
    ).rejects.toThrow(/sourceId is required/i);
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('accepts non-manual source when sourceId is present + persists lineage', async () => {
    const res = await createInitiative(ORG, {
      title: 'Z wywiadu',
      sourceType: 'assessment',
      sourceId: 'assess-42',
    });
    expect(res.sourceType).toBe('assessment');
    expect(res.sourceId).toBe('assess-42');
    const { params } = lastInsert();
    expect(params).toContain('assessment');
    expect(params).toContain('assess-42');
  });

  it('rejects missing title', async () => {
    await expect(createInitiative(ORG, {})).rejects.toThrow();
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('requires organizationId', async () => {
    await expect(createInitiative('', { title: 'X' })).rejects.toThrow(/organizationId/i);
  });

  it('emits the initiative.created audit event', async () => {
    await createInitiative(ORG, { title: 'X' }, { actor: { id: 'u1' } });
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(auditLog.mock.calls[0][0]).toMatchObject({
      action: 'initiative.created',
      organizationId: ORG,
    });
  });

  it('falls back to legacy schema when modern insert throws', async () => {
    queryRun.mockRejectedValueOnce(new Error('column "program_id" does not exist'));
    queryRun.mockResolvedValueOnce(undefined);
    const res = await createInitiative(ORG, { title: 'Drift' });
    expect(res.id).toBeTruthy();
    // modern insert (fail) + legacy insert + title-sync UPDATE = 3 calls; 2 are INSERTs.
    const insertCalls = queryRun.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO initiatives')
    );
    expect(insertCalls.length).toBe(2);
  });
});
