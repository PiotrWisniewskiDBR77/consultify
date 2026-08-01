/**
 * C2 hardening — Document Studio editor-state DAO persistence outcomes.
 *
 * `persistProposal` is the durable write behind
 * `documentStudioService.persistProposalWriteThrough`, which used to be
 * fire-and-forget (`void daoPersistProposal(proposal)`). These tests pin
 * down the DAO's `PersistOutcome` contract that the service now AWAITS:
 *
 *   (a) a confirmed INSERT/UPSERT resolves `{ ok: true }`
 *   (b) a live DB failure (table exists, write rejected) resolves
 *       `{ ok: false, degraded: 'db_error' }` — never throws, but the
 *       outcome is distinguishable from a tolerated degradation
 *   (c) a missing table (pre-migration environment) resolves
 *       `{ ok: false, degraded: 'schema_missing' }` — the explicit
 *       fallback signal the task requires instead of a silent "ok"
 *
 * `run` is mocked directly (matching the DAO's own dependency,
 * `../../../../utils/DbPromise.js`) so each scenario is deterministic
 * and does not require a live database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => runMock(...args),
  all: vi.fn(async () => []),
  get: vi.fn(async () => null),
}));

vi.mock('../../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  persistProposal,
  persistSchemaOverlay,
} from '../../../../../server/src/services/documentStudio/documentEditorStateRegistryDao.js';
import type {
  DocumentEditorProposal,
  DocumentSchema,
} from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

function makeProposal(overrides: Partial<DocumentEditorProposal> = {}): DocumentEditorProposal {
  return {
    proposalId: 'doc-proposal-1',
    artifactId: 'artifact-1',
    organizationId: 'org-1',
    scope: 'local',
    instruction: 'tighten the prose',
    affectedSectionIds: ['sec-1'],
    status: 'proposed',
    diff: { before: 'before text', after: 'after text' },
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('documentEditorStateRegistryDao.persistProposal', () => {
  beforeEach(() => {
    runMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('(a) resolves { ok: true } when the durable write is confirmed', async () => {
    runMock.mockResolvedValueOnce({ success: true, changes: 1 });
    const outcome = await persistProposal(makeProposal());
    expect(outcome).toEqual({ ok: true });
  });

  it('(b) a live DB failure resolves { ok: false, degraded: "db_error" } — never throws, never claims false success', async () => {
    runMock.mockResolvedValueOnce({
      success: false,
      error: 'connection terminated unexpectedly',
    });
    const outcome = await persistProposal(makeProposal());
    expect(outcome.ok).toBe(false);
    expect(outcome.degraded).toBe('db_error');
    expect(outcome.reason).toContain('connection terminated');
  });

  it('(b2) a thrown DB exception is caught and resolves { ok: false, degraded: "db_error" }', async () => {
    runMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const outcome = await persistProposal(makeProposal());
    expect(outcome.ok).toBe(false);
    expect(outcome.degraded).toBe('db_error');
  });

  it('(c) a missing table resolves { ok: false, degraded: "schema_missing" } — explicit fallback signal, not a silent ok', async () => {
    runMock.mockResolvedValueOnce({
      success: false,
      error: 'relation "document_studio_editor_proposals" does not exist',
    });
    const outcome = await persistProposal(makeProposal());
    expect(outcome.ok).toBe(false);
    expect(outcome.degraded).toBe('schema_missing');
  });

  it('(c2) "no such table" (sqlite dialect) is also classified as schema_missing', async () => {
    runMock.mockRejectedValueOnce(new Error('SQLITE_ERROR: no such table: document_studio_editor_proposals'));
    const outcome = await persistProposal(makeProposal());
    expect(outcome.ok).toBe(false);
    expect(outcome.degraded).toBe('schema_missing');
  });

  it('rejects invalid input up front without touching the DB', async () => {
    const outcome = await persistProposal(
      makeProposal({ proposalId: '' as unknown as string })
    );
    expect(outcome.ok).toBe(false);
    expect(runMock).not.toHaveBeenCalled();
  });
});

describe('documentEditorStateRegistryDao.persistSchemaOverlay optimistic lock', () => {
  const schema = {
    artifactId: 'artifact-1',
    updatedAt: '2026-08-01T20:00:01.000Z',
  } as DocumentSchema;

  beforeEach(() => runMock.mockReset());

  it('performs the version comparison atomically inside the UPSERT', async () => {
    runMock.mockResolvedValueOnce({ success: true, changes: 1 });

    await expect(
      persistSchemaOverlay('artifact-1', 'org-1', schema, '2026-08-01T20:00:00.000Z')
    ).resolves.toEqual({ ok: true });

    expect(runMock).toHaveBeenCalledWith(
      expect.stringContaining("schema_json->>'updatedAt' = $5"),
      expect.arrayContaining(['2026-08-01T20:00:00.000Z'])
    );
  });

  it('reports a conflict when the conditional UPSERT changes no row', async () => {
    runMock.mockResolvedValueOnce({ success: true, changes: 0 });

    await expect(
      persistSchemaOverlay('artifact-1', 'org-1', schema, 'stale-version')
    ).resolves.toEqual({ ok: false, conflict: true });
  });
});
