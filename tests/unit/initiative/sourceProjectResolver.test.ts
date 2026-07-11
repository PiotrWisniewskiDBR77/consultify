/**
 * Zwornik project inheritance — sourceProjectResolver.ts.
 * Pure logic with an injected mock DB (no real query helpers needed).
 */
import { describe, expect, it, vi } from 'vitest';

import { resolveProjectIdFromSource } from '../../../server/src/services/initiative/sourceProjectResolver';

const ORG = 'org-1';

function makeDb(row: any) {
  const calls: any[][] = [];
  return {
    calls,
    queryOne: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push([sql, params]);
      return row;
    }),
  };
}

describe('resolveProjectIdFromSource', () => {
  it('returns null without orgId or sourceId (guard)', async () => {
    const db = makeDb({ project_id: 'p-1' });
    expect(await resolveProjectIdFromSource(undefined, 'assessment', 'a-1', db as any)).toBeNull();
    expect(await resolveProjectIdFromSource(ORG, 'assessment', undefined, db as any)).toBeNull();
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('resolves project_id for an assessment source', async () => {
    const db = makeDb({ project_id: 'proj-42' });
    const result = await resolveProjectIdFromSource(ORG, 'assessment', 'assess-1', db as any);
    expect(result).toBe('proj-42');
    const [sql, params] = db.calls[0];
    expect(sql).toContain('FROM assessments');
    expect(params).toEqual(['assess-1', ORG]);
  });

  it('resolves project_id for an audit source', async () => {
    const db = makeDb({ project_id: 'proj-7' });
    const result = await resolveProjectIdFromSource(ORG, 'audit', 'audit-1', db as any);
    expect(result).toBe('proj-7');
    const [sql] = db.calls[0];
    expect(sql).toContain('FROM audits');
  });

  it('returns null for interview_insight — no project concept to inherit (correct, not a bug)', async () => {
    const db = makeDb({ project_id: 'should-never-be-read' });
    const result = await resolveProjectIdFromSource(ORG, 'interview_insight', 'ins-1', db as any);
    expect(result).toBeNull();
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('returns null for manual/unknown source types', async () => {
    const db = makeDb({ project_id: 'x' });
    expect(await resolveProjectIdFromSource(ORG, 'manual', 'm-1', db as any)).toBeNull();
    expect(await resolveProjectIdFromSource(ORG, 'teresa_chat', 't-1', db as any)).toBeNull();
    expect(await resolveProjectIdFromSource(ORG, undefined, 'x-1', db as any)).toBeNull();
  });

  it('returns null when the source row has no project_id (null column)', async () => {
    const db = makeDb({ project_id: null });
    expect(await resolveProjectIdFromSource(ORG, 'assessment', 'assess-2', db as any)).toBeNull();
  });

  it('returns null when the source row is not found', async () => {
    const db = makeDb(null);
    expect(await resolveProjectIdFromSource(ORG, 'audit', 'nope', db as any)).toBeNull();
  });

  it('fail-soft: a DB error resolves to null, never throws', async () => {
    const db = {
      queryOne: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    await expect(
      resolveProjectIdFromSource(ORG, 'assessment', 'assess-3', db as any)
    ).resolves.toBeNull();
  });
});
