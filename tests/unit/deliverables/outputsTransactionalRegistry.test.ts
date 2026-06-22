// @vitest-environment node
/**
 * Unit tests — outputsTransactionalRegistry (X6, W5 / Seria X)
 *
 * FT-1: ≥3 idempotencja + happy path + lineage shape
 * FT-2: ≥3 transakcyjność (BEGIN/COMMIT order; ROLLBACK on failure; race re-check)
 * FT-8: ≥2 fail-closed (insert throws → ROLLBACK + throw; validation throws)
 *
 * Mocks:
 *   - utils/DbPromise.js  → kontroluje get/run/all per test
 *   - utils/Logger.js     → silence
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterArtifactOriginParams } from '../../../server/src/types/artifactRegistry.js';

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

const VALID_PARAMS: RegisterArtifactOriginParams = {
  organizationId: 'org-1',
  outputType: 'report',
  artifactFamily: 'document',
  originRuntime: 'work_canvas',
  originRecordId: 'rec-42',
  createdBy: 'user-1',
};

describe('outputsTransactionalRegistry (X6)', () => {
  let registerOutputArtifactTransactional: typeof import('../../../server/src/services/v8/outputsTransactionalRegistry.js').registerOutputArtifactTransactional;
  let getArtifactLineage: typeof import('../../../server/src/services/v8/outputsTransactionalRegistry.js').getArtifactLineage;

  beforeEach(async () => {
    vi.resetModules();
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    dbRun.mockResolvedValue({ changes: 1, lastID: 0 });
    const mod = await import(
      '../../../server/src/services/v8/outputsTransactionalRegistry.js'
    );
    registerOutputArtifactTransactional = mod.registerOutputArtifactTransactional;
    getArtifactLineage = mod.getArtifactLineage;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — happy path + idempotency + lineage shape
  // ──────────────────────────────────────────────────────────────

  it('FT-1/1: new artifact → isNew=true, transactional path (BEGIN+2 INSERTs+COMMIT)', async () => {
    // No existing link (fast path) + no existing link (re-check inside tx).
    dbGet.mockResolvedValueOnce(null); // fast-path findExistingLink
    dbGet.mockResolvedValueOnce(null); // re-check inside tx

    const result = await registerOutputArtifactTransactional(VALID_PARAMS);

    expect(result.isNew).toBe(true);
    expect(result.artifactId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.lineage.outputType).toBe('report');
    expect(result.lineage.originRuntime).toBe('work_canvas');
    expect(result.lineage.originRecordId).toBe('rec-42');
    expect(result.lineage.isPrimaryOrigin).toBe(true);

    // Tx contract: BEGIN, 2 INSERTs, COMMIT (in this order).
    const sqlCalls = dbRun.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sqlCalls).toEqual(['BEGIN', 'INSERT', 'INSERT', 'COMMIT']);
  });

  it('FT-1/2: existing link (fast-path) → isNew=false, NO tx opened', async () => {
    dbGet
      .mockResolvedValueOnce({
        artifact_id: 'existing-art-1',
        organization_id: 'org-1',
        origin_runtime: 'work_canvas',
        origin_record_id: 'rec-42',
        is_primary_origin: 1,
      })
      // getOutputType lookup
      .mockResolvedValueOnce({
        artifact_id: 'existing-art-1',
        organization_id: 'org-1',
        output_type: 'report',
      });

    const result = await registerOutputArtifactTransactional(VALID_PARAMS);

    expect(result.isNew).toBe(false);
    expect(result.artifactId).toBe('existing-art-1');
    expect(result.lineage.isPrimaryOrigin).toBe(true);

    // No transaction opened on fast-path.
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('FT-1/3: lineage shape — full origin pointer returned on every call', async () => {
    dbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await registerOutputArtifactTransactional({
      ...VALID_PARAMS,
      outputType: 'presentation',
    });

    expect(result.lineage).toMatchObject({
      organizationId: 'org-1',
      outputType: 'presentation',
      originRuntime: 'work_canvas',
      originRecordId: 'rec-42',
      isPrimaryOrigin: true,
    });
    expect(result.lineage.artifactId).toBe(result.artifactId);
  });

  // ──────────────────────────────────────────────────────────────
  // FT-2 — transactional behaviour
  // ──────────────────────────────────────────────────────────────

  it('FT-2/4: race-recheck — fast-path empty but tx-recheck finds link → COMMIT + isNew=false (no INSERT)', async () => {
    dbGet
      // fast-path = empty
      .mockResolvedValueOnce(null)
      // re-check inside tx = found (race won by other caller)
      .mockResolvedValueOnce({
        artifact_id: 'race-winner-art',
        organization_id: 'org-1',
        origin_runtime: 'work_canvas',
        origin_record_id: 'rec-42',
        is_primary_origin: 1,
      })
      // getOutputType lookup
      .mockResolvedValueOnce({
        artifact_id: 'race-winner-art',
        organization_id: 'org-1',
        output_type: 'report',
      });

    const result = await registerOutputArtifactTransactional(VALID_PARAMS);

    expect(result.isNew).toBe(false);
    expect(result.artifactId).toBe('race-winner-art');

    // Tx opened then COMMIT (no rollback) — no INSERT issued.
    const sqlCalls = dbRun.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sqlCalls).toEqual(['BEGIN', 'COMMIT']);
  });

  it('FT-2/5: INSERT order — v8_output_artifacts BEFORE v8_artifact_origin_links (FK direction)', async () => {
    dbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await registerOutputArtifactTransactional(VALID_PARAMS);

    const insertTargets = dbRun.mock.calls
      .filter((c) => String(c[0]).trim().toUpperCase().startsWith('INSERT'))
      .map((c) => String(c[0]).match(/INTO\s+(\w+)/i)?.[1]);

    expect(insertTargets).toEqual(['v8_output_artifacts', 'v8_artifact_origin_links']);
  });

  it('FT-2/6: same artifactId shared across both INSERT-s (atomic linkage)', async () => {
    dbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await registerOutputArtifactTransactional(VALID_PARAMS);

    // Param at index 0 of artifacts INSERT = artifact_id;
    // Param at index 1 of origin_links INSERT = artifact_id.
    const inserts = dbRun.mock.calls.filter((c) =>
      String(c[0]).trim().toUpperCase().startsWith('INSERT')
    );
    const artifactIdFromArtifactsInsert = inserts[0][1][0];
    const artifactIdFromOriginInsert = inserts[1][1][1];

    expect(artifactIdFromArtifactsInsert).toBe(artifactIdFromOriginInsert);
  });

  // ──────────────────────────────────────────────────────────────
  // FT-8 — fail-closed behaviour
  // ──────────────────────────────────────────────────────────────

  it('FT-8/7: INSERT v8_output_artifacts throws → ROLLBACK + throw (no orphan)', async () => {
    dbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    dbRun.mockImplementation(async (sql: string) => {
      const head = String(sql).trim().toUpperCase();
      if (head.startsWith('INSERT INTO V8_OUTPUT_ARTIFACTS')) {
        throw new Error('UNIQUE constraint failed');
      }
      return { changes: 1, lastID: 0 };
    });

    await expect(registerOutputArtifactTransactional(VALID_PARAMS)).rejects.toThrow(
      /UNIQUE constraint failed/
    );

    const sqlCalls = dbRun.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sqlCalls).toContain('BEGIN');
    expect(sqlCalls).toContain('ROLLBACK');
    expect(sqlCalls).not.toContain('COMMIT');
  });

  it('FT-8/8: INSERT v8_artifact_origin_links throws → ROLLBACK (artifact INSERT undone, no orphan)', async () => {
    dbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    let insertCount = 0;
    dbRun.mockImplementation(async (sql: string) => {
      const head = String(sql).trim().toUpperCase();
      if (head.startsWith('INSERT')) {
        insertCount++;
        // Pierwszy INSERT (artifacts) sukces, drugi (origin_links) padnie.
        if (insertCount === 2) throw new Error('FK violation on origin_links');
      }
      return { changes: 1, lastID: 0 };
    });

    await expect(registerOutputArtifactTransactional(VALID_PARAMS)).rejects.toThrow(
      /FK violation/
    );

    const sqlCalls = dbRun.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sqlCalls).toContain('ROLLBACK');
    expect(sqlCalls).not.toContain('COMMIT');
  });

  it('FT-8/9: invalid params (missing organizationId) → zod throw BEFORE tx opens', async () => {
    await expect(
      registerOutputArtifactTransactional({
        ...VALID_PARAMS,
        // @ts-expect-error — intentionally invalid
        organizationId: '',
      })
    ).rejects.toThrow();

    // No DB touched.
    expect(dbRun).not.toHaveBeenCalled();
    expect(dbGet).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────
  // Lineage read-side helper
  // ──────────────────────────────────────────────────────────────

  it('FT-1/10: getArtifactLineage returns all origin links (read-only, no tx)', async () => {
    dbGet.mockResolvedValueOnce({
      artifact_id: 'art-1',
      organization_id: 'org-1',
      output_type: 'sheet',
    });
    dbAll.mockResolvedValueOnce([
      {
        artifact_id: 'art-1',
        organization_id: 'org-1',
        origin_runtime: 'work_canvas',
        origin_record_id: 'msg-1',
        is_primary_origin: 1,
      },
      {
        artifact_id: 'art-1',
        organization_id: 'org-1',
        origin_runtime: 'table_studio',
        origin_record_id: 'tbl-1',
        is_primary_origin: 0,
      },
    ]);

    const lineage = await getArtifactLineage('art-1', 'org-1');

    expect(lineage).toHaveLength(2);
    expect(lineage[0]).toMatchObject({
      artifactId: 'art-1',
      outputType: 'sheet',
      originRuntime: 'work_canvas',
      isPrimaryOrigin: true,
    });
    expect(lineage[1].isPrimaryOrigin).toBe(false);
    expect(dbRun).not.toHaveBeenCalled();
  });
});
