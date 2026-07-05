// @vitest-environment node
/**
 * C2 — Document Studio editor proposal: durable-persistence hardening.
 *
 * Before this slice, `documentStudioService.ts` cached every proposal
 * mutation (create / approve / reject) in the in-process Map and fired
 * the durable write with `void daoPersistProposal(proposal)` —
 * fire-and-forget. A process kill between the synchronous cache write
 * and the async DB flush silently lost the proposal, while the
 * request that created it had already received a 200 with `{ proposal }`.
 *
 * This test pins down the fix:
 *   (a) the request path now AWAITS the durable write — proven by
 *       resolving the mocked DAO only after a microtask tick and
 *       asserting the returned proposal already reflects the outcome.
 *   (b) a live DB failure (table exists, write rejected) does NOT
 *       report a false success — `proposal.persistence.persisted` is
 *       `false` and `degraded` is `'db_error'`, distinct from a
 *       tolerated schema-missing fallback.
 *   (c) a missing table degrades to the in-process cache (the
 *       proposal is still returned — UX is not broken) but the
 *       degradation is explicit: `persistence.degraded === 'schema_missing'`,
 *       never a silent, unqualified "ok".
 *
 * Same mocking harness as `tests/integration/deliverables/r2-inline-ai.test.ts`
 * (wave5ArtifactRuntimeService + documentEditorStateRegistryDao mocked,
 * no live DB needed), scoped down to a single fixture artifact.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

const BASE_SCHEMA: DocumentSchema = {
  documentId: 'doc-c2-1',
  artifactId: 'artifact-c2-1',
  title: 'C2 Persistence Test Document',
  documentType: 'executive_memo',
  language: 'pl',
  audience: ['Management'],
  goal: 'decide',
  communicationRegister: 'professional',
  density: 'standard',
  languageStyle: 'formal',
  confidentiality: 'internal',
  formattingSchema: {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: false,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 'sec-c2-1',
      orderIndex: 0,
      level: 1 as const,
      title: 'Analiza',
      blocks: [
        {
          blockId: 'blk-c2-a',
          type: 'paragraph',
          content: { text: 'Przychody wzrosły o 12% w Q1.' } as any,
        },
      ],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
};

const ARTIFACT = BASE_SCHEMA.artifactId;
const ORG = 'org-c2';

// ─── mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== ARTIFACT || organizationId !== ORG) return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: BASE_SCHEMA.title,
      content: 'markdown',
      content_json: BASE_SCHEMA,
      metadata_json: { documentStudioSchema: BASE_SCHEMA },
    };
  }),
  buildWave5ExportManifest: vi.fn(async () => ({})),
  markWave5ArtifactExported: vi.fn(async () => {}),
}));

// Controllable per-test: each test sets `persistProposalImpl` to decide
// what the durable write resolves to for that scenario.
let persistProposalImpl: () => Promise<{
  ok: boolean;
  degraded?: 'schema_missing' | 'db_error';
  reason?: string;
}> = async () => ({ ok: true });

vi.mock('../../../../../server/src/services/documentStudio/documentEditorStateRegistryDao.js', () => ({
  persistProposal: vi.fn(async (...args: unknown[]) => persistProposalImpl()),
  persistAuditEntry: vi.fn(async () => ({ ok: true })),
  persistSchemaOverlay: vi.fn(async () => ({ ok: true })),
  loadProposalsForArtifact: vi.fn(async () => []),
  loadAuditForArtifact: vi.fn(async () => []),
  loadSchemaOverlay: vi.fn(async () => null),
  __resetEditorStateRegistryDaoForTests: vi.fn(async () => undefined),
}));

const loggerErrorMock = vi.fn();
const loggerWarnMock = vi.fn();
vi.mock('../../../../../server/src/utils/Logger.js', () => ({
  default: { error: loggerErrorMock, info: vi.fn(), warn: loggerWarnMock, debug: vi.fn() },
}));

// ─── service imports (after mocks) ───────────────────────────────────────────

const { createLocalEditProposal, approveEditProposal, __resetEditorStateCachesForTests } =
  await import('../../../../../server/src/services/documentStudio/documentStudioService.js');

function makeLocalProposal(instruction = 'Popraw styl.') {
  return createLocalEditProposal({
    artifactId: ARTIFACT,
    organizationId: ORG,
    userId: 'user-c2',
    input: {
      scope: 'local',
      sectionId: 'sec-c2-1',
      blockId: 'blk-c2-a',
      instruction,
    },
    useLlm: false,
  });
}

describe('C2 — proposal durable-persistence outcome is awaited, not fire-and-forget', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
    persistProposalImpl = async () => ({ ok: true });
    loggerErrorMock.mockClear();
    loggerWarnMock.mockClear();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('(a) the create-proposal request path awaits the durable write: a delayed DAO resolution is reflected before the function returns', async () => {
    let daoResolved = false;
    persistProposalImpl = async () => {
      // Simulate a real async DB round trip. If the service were still
      // firing this off with `void` and not awaiting, the assertions
      // below (on the returned proposal) would run before this
      // resolves, and `daoResolved` would still be false at that point.
      await new Promise((resolve) => setTimeout(resolve, 10));
      daoResolved = true;
      return { ok: true };
    };

    const proposal = await makeLocalProposal();

    // If we got here, the awaited call already completed.
    expect(daoResolved).toBe(true);
    expect(proposal.persistence?.persisted).toBe(true);
    expect(proposal.persistence?.degraded).toBeUndefined();
  });

  it('(a2) success: proposal.persistence.persisted is true and no error is logged', async () => {
    const proposal = await makeLocalProposal();
    expect(proposal.persistence?.persisted).toBe(true);
    expect(proposal.persistence?.degraded).toBeUndefined();
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('(b) a live DB failure never reports a false success — persistence.persisted is false with degraded "db_error", and it is logged at error level', async () => {
    persistProposalImpl = async () => ({
      ok: false,
      degraded: 'db_error',
      reason: 'connection terminated unexpectedly',
    });

    const proposal = await makeLocalProposal();

    // The request still succeeds (proposal is created and usable from
    // the in-process cache) — but the caller can see it did NOT
    // durably persist.
    expect(proposal.status).toBe('proposed');
    expect(proposal.persistence?.persisted).toBe(false);
    expect(proposal.persistence?.degraded).toBe('db_error');
    expect(proposal.persistence?.reason).toContain('connection terminated');
    // A real DB failure is a production signal — must be visible at
    // error level, not swallowed as a debug/info line.
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('(c) a missing table degrades explicitly — persistence.degraded is "schema_missing" (not a silent ok), logged at warn (tolerated) not error', async () => {
    persistProposalImpl = async () => ({
      ok: false,
      degraded: 'schema_missing',
      reason: 'relation "document_studio_editor_proposals" does not exist',
    });

    const proposal = await makeLocalProposal();

    // UX is not broken: the proposal is still returned and usable.
    expect(proposal.status).toBe('proposed');
    expect(proposal.persistence?.persisted).toBe(false);
    expect(proposal.persistence?.degraded).toBe('schema_missing');
    // Tolerated degradation — warn, not error (distinguishes from (b)).
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('approve also awaits persistence and re-stamps the outcome on the executed proposal', async () => {
    const created = await makeLocalProposal();
    expect(created.persistence?.persisted).toBe(true);

    persistProposalImpl = async () => ({
      ok: false,
      degraded: 'db_error',
      reason: 'write timeout',
    });

    const { proposal: approved } = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-c2',
      proposalId: created.proposalId,
    });

    expect(approved.status).toBe('executed');
    expect(approved.persistence?.persisted).toBe(false);
    expect(approved.persistence?.degraded).toBe('db_error');
  });
});
