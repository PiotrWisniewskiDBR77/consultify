// @vitest-environment node
/**
 * Unit tests — unifiedDocEntityService (X5, W5 / Seria X)
 *
 * FT-1: ≥4 — read paths (draft-only / artifact-only / linked-draft-newer / linked-artifact-newer)
 * FT-2: ≥3 — commit (new artifact / update existing / no duplicate)
 * FT-8: ≥2 — org-scope guard; missing draft throws; DB error → ROLLBACK
 *
 * Mocks: utils/DbPromise.js (get/all/run)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function mkDraft(overrides: Partial<any> = {}): any {
  return {
    id: 'draft-1',
    organization_id: 'org-1',
    title: 'My doc',
    content_json: '{"text":"draft body"}',
    artifact_id: null,
    artifact_version: null,
    save_state: 'saved',
    dirty_state: 'clean',
    updated_at: '2026-06-21T10:00:00Z',
    ...overrides,
  };
}

function mkArtifact(overrides: Partial<any> = {}): any {
  return {
    artifact_id: 'art-1',
    organization_id: 'org-1',
    title: 'My doc',
    content: '"committed body"',
    current_version: 3,
    updated_at: '2026-06-21T09:00:00Z',
    committed_at: '2026-06-21T09:00:00Z',
    ...overrides,
  };
}

describe('unifiedDocEntityService (X5)', () => {
  let getUnifiedDoc: typeof import('../../../server/src/services/deliverables/unifiedDocEntityService.js').getUnifiedDoc;
  let commitDraftToArtifact: typeof import('../../../server/src/services/deliverables/unifiedDocEntityService.js').commitDraftToArtifact;
  let listDraftsForArtifact: typeof import('../../../server/src/services/deliverables/unifiedDocEntityService.js').listDraftsForArtifact;

  beforeEach(async () => {
    vi.resetModules();
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    dbRun.mockResolvedValue({ changes: 1, lastID: 0 });
    const mod = await import(
      '../../../server/src/services/deliverables/unifiedDocEntityService.js'
    );
    getUnifiedDoc = mod.getUnifiedDoc;
    commitDraftToArtifact = mod.commitDraftToArtifact;
    listDraftsForArtifact = mod.listDraftsForArtifact;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — read paths
  // ──────────────────────────────────────────────────────────────

  it('FT-1/1: draft only (no artifact link) → source="draft", content from draft', async () => {
    dbGet.mockResolvedValueOnce(mkDraft({ artifact_id: null }));

    const result = await getUnifiedDoc('org-1', { draftId: 'draft-1' });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('draft');
    expect(result!.draftId).toBe('draft-1');
    expect(result!.artifactId).toBeNull();
    expect(result!.content).toBe('{"text":"draft body"}');
  });

  it('FT-1/2: artifact only (no draft) → source="committed", content from artifact', async () => {
    dbGet
      .mockResolvedValueOnce(mkArtifact()) // findArtifact
      .mockResolvedValueOnce(null); // findDraftByArtifactId

    const result = await getUnifiedDoc('org-1', { artifactId: 'art-1' });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('committed');
    expect(result!.artifactId).toBe('art-1');
    expect(result!.draftId).toBeNull();
    expect(result!.content).toBe('"committed body"');
  });

  it('FT-1/3: linked + draft newer → source="linked", content from draft, hasUncommittedChanges=true', async () => {
    dbGet
      .mockResolvedValueOnce(
        mkDraft({
          artifact_id: 'art-1',
          updated_at: '2026-06-21T12:00:00Z', // newer
          dirty_state: 'dirty',
        })
      )
      .mockResolvedValueOnce(
        mkArtifact({ updated_at: '2026-06-21T09:00:00Z' }) // older
      );

    const result = await getUnifiedDoc('org-1', { draftId: 'draft-1' });

    expect(result!.source).toBe('linked');
    expect(result!.content).toBe('{"text":"draft body"}'); // newer wins
    expect(result!.hasUncommittedChanges).toBe(true);
    expect(result!.artifactId).toBe('art-1');
    expect(result!.draftId).toBe('draft-1');
  });

  it('FT-1/4: linked + artifact newer → source="linked", content from artifact, NO uncommitted changes', async () => {
    dbGet
      .mockResolvedValueOnce(
        mkDraft({
          artifact_id: 'art-1',
          updated_at: '2026-06-21T08:00:00Z', // older
          dirty_state: 'clean',
          save_state: 'saved',
        })
      )
      .mockResolvedValueOnce(
        mkArtifact({ updated_at: '2026-06-21T11:00:00Z' }) // newer
      );

    const result = await getUnifiedDoc('org-1', { draftId: 'draft-1' });

    expect(result!.source).toBe('linked');
    expect(result!.content).toBe('"committed body"'); // newer wins
    expect(result!.hasUncommittedChanges).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // FT-2 — commit (no duplicate)
  // ──────────────────────────────────────────────────────────────

  it('FT-2/5: draft without artifact_id → commit creates NEW wave5_artifacts (isNew=true, v=1)', async () => {
    // findDraft (initial lookup)
    dbGet.mockResolvedValueOnce(mkDraft({ artifact_id: null }));

    const result = await commitDraftToArtifact({
      organizationId: 'org-1',
      draftId: 'draft-1',
      committedBy: 'user-1',
    });

    expect(result.isNewArtifact).toBe(true);
    expect(result.version).toBe(1);
    expect(result.artifactId).toMatch(/^[0-9a-f-]{36}$/);

    // Tx envelope: BEGIN/INSERT(wave5)/UPDATE(draft)/COMMIT
    const sqlHeads = dbRun.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sqlHeads[0]).toBe('BEGIN');
    expect(sqlHeads.at(-1)).toBe('COMMIT');
    expect(sqlHeads).toContain('INSERT');
    expect(sqlHeads).toContain('UPDATE');
  });

  it('FT-2/6: draft WITH artifact_id (existing) → commit UPDATES wave5_artifacts (isNew=false, v=N+1)', async () => {
    // findDraft initial lookup
    dbGet.mockResolvedValueOnce(mkDraft({ artifact_id: 'art-1', artifact_version: 3 }));
    // findArtifact inside commit
    dbGet.mockResolvedValueOnce(mkArtifact({ current_version: 3 }));

    const result = await commitDraftToArtifact({
      organizationId: 'org-1',
      draftId: 'draft-1',
      committedBy: 'user-1',
    });

    expect(result.isNewArtifact).toBe(false);
    expect(result.version).toBe(4);
    expect(result.artifactId).toBe('art-1');

    // Sprawdź że UPDATE wave5_artifacts wystąpił (nie nowy INSERT do wave5)
    const inserts = dbRun.mock.calls.filter((c) =>
      String(c[0]).trim().toUpperCase().startsWith('INSERT')
    );
    const wave5Inserts = inserts.filter((c) =>
      String(c[0]).toUpperCase().includes('WAVE5_ARTIFACTS')
    );
    expect(wave5Inserts.length).toBe(0); // żadnego nowego wave5

    const updates = dbRun.mock.calls.filter((c) =>
      String(c[0]).trim().toUpperCase().startsWith('UPDATE')
    );
    const wave5Updates = updates.filter((c) =>
      String(c[0]).toUpperCase().includes('WAVE5_ARTIFACTS')
    );
    expect(wave5Updates.length).toBe(1);
  });

  it('FT-2/7: draft links to MISSING artifact_id → commit re-creates wave5 with that ID (isNew=true, no orphan)', async () => {
    dbGet.mockResolvedValueOnce(mkDraft({ artifact_id: 'stale-art' }));
    dbGet.mockResolvedValueOnce(null); // findArtifact returns null

    const result = await commitDraftToArtifact({
      organizationId: 'org-1',
      draftId: 'draft-1',
      committedBy: 'user-1',
    });

    expect(result.isNewArtifact).toBe(true);
    expect(result.artifactId).toBe('stale-art'); // keep id from draft link
    expect(result.version).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────
  // FT-8 — guards + fail-closed
  // ──────────────────────────────────────────────────────────────

  it('FT-8/8: getUnifiedDoc — missing organizationId → null without DB touch', async () => {
    const result = await getUnifiedDoc('', { draftId: 'draft-1' });
    expect(result).toBeNull();
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('FT-8/9: getUnifiedDoc — neither draftId nor artifactId → null', async () => {
    const result = await getUnifiedDoc('org-1', {});
    expect(result).toBeNull();
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('FT-8/10: commitDraftToArtifact — missing draft → throws (no orphan write)', async () => {
    dbGet.mockResolvedValueOnce(null); // findDraft empty

    await expect(
      commitDraftToArtifact({
        organizationId: 'org-1',
        draftId: 'missing',
        committedBy: 'user-1',
      })
    ).rejects.toThrow(/draft not found/);

    // BEGIN NIE wywołane — bo guard rzuca przed transakcją
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('FT-8/11: commit — INSERT throws → ROLLBACK + throw (no orphan in either table)', async () => {
    dbGet.mockResolvedValueOnce(mkDraft({ artifact_id: null }));

    dbRun.mockImplementation(async (sql: string) => {
      const head = String(sql).trim().toUpperCase();
      if (head.startsWith('INSERT INTO WAVE5_ARTIFACTS')) {
        throw new Error('FK violation');
      }
      return { changes: 1, lastID: 0 };
    });

    await expect(
      commitDraftToArtifact({
        organizationId: 'org-1',
        draftId: 'draft-1',
        committedBy: 'user-1',
      })
    ).rejects.toThrow(/FK violation/);

    const sqlHeads = dbRun.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sqlHeads).toContain('BEGIN');
    expect(sqlHeads).toContain('ROLLBACK');
    expect(sqlHeads).not.toContain('COMMIT');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 helper — listDraftsForArtifact
  // ──────────────────────────────────────────────────────────────

  it('FT-1/12: listDraftsForArtifact returns drafts ordered by updated_at desc', async () => {
    dbAll.mockResolvedValueOnce([
      mkDraft({ id: 'd-2', updated_at: '2026-06-21T12:00:00Z', dirty_state: 'dirty' }),
      mkDraft({ id: 'd-1', updated_at: '2026-06-21T10:00:00Z' }),
    ]);

    const list = await listDraftsForArtifact('org-1', 'art-1');
    expect(list).toHaveLength(2);
    expect(list[0].draftId).toBe('d-2');
    expect(list[0].dirty).toBe(true);
    expect(list[1].dirty).toBe(false);
  });
});
