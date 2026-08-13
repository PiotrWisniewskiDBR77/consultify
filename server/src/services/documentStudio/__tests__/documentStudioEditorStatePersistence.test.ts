/**
 * Document Studio — Editor State Persistence (Module 10 hardening).
 *
 * Verifies that the three previously-ephemeral in-process stores in
 * `documentStudioService.ts` (`proposalStore`, `auditStore`,
 * `schemaOverlayStore`) are now write-through to
 * `documentEditorStateRegistryDao.ts` and hydrate on cold start:
 *
 *   1. Creating an editor proposal triggers a best-effort `persistProposal`
 *      write to the DAO, plus a `persistAuditEntry` for the
 *      `proposal_created` row.
 *   2. Approving a proposal persists the executed proposal + approve/execute
 *      audit rows.
 *   3. Rejecting a proposal (now async) persists the rejected proposal +
 *      a `proposal_rejected` audit row.
 *   4. Cold-start hydration: when the in-process caches are cleared but the
 *      DAO holds a persisted proposal, the next read (approve) re-loads it
 *      from the DAO instead of throwing `proposal_not_found`.
 *   5. Persistence failures degrade gracefully — the public API never
 *      throws and the in-process cache stays authoritative.
 *
 * The DAO is mocked at the module boundary so these specs run without a
 * live Postgres backing store.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentEditorProposal, DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-persist-1',
  artifactId: 'artifact-persist-1',
  title: 'Persistence Test Document',
  documentType: 'executive_memo',
  language: 'en',
  audience: ['Board'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'internal',
  formattingSchema: {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: true,
    coverPage: false,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Summary',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: [{ blockId: 'blk-1', type: 'paragraph', content: { text: 'Original.' } as any }],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== 'artifact-persist-1' || organizationId !== 'org-1') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Persistence Test Document',
      content: 'markdown',
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  buildWave5ExportManifest: vi.fn(async () => ({})),
}));

// The DAO stubs are invoked through the `vi.mock` factory below with the real
// DAO arguments; declare the rest signature so `mock.calls[n][0]` is typed as a
// captured argument rather than as an element of an empty tuple.
const persistProposalMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const persistAuditEntryMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const persistSchemaOverlayMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const loadProposalsForArtifactMock = vi.fn(
  async (_a: string, _o: string) => [] as DocumentEditorProposal[]
);
const loadAuditForArtifactMock = vi.fn(async (_a: string, _o: string) => [] as never[]);
const loadSchemaOverlayMock = vi.fn(
  async (_a: string, _o: string) => null as DocumentSchema | null
);

vi.mock('../documentEditorStateRegistryDao.js', () => ({
  persistProposal: (...args: unknown[]) => persistProposalMock(...(args as [never])),
  persistAuditEntry: (...args: unknown[]) => persistAuditEntryMock(...(args as [never])),
  persistSchemaOverlay: (...args: unknown[]) => persistSchemaOverlayMock(...(args as [never])),
  loadProposalsForArtifact: (...args: unknown[]) =>
    loadProposalsForArtifactMock(...(args as [string, string])),
  loadAuditForArtifact: (...args: unknown[]) =>
    loadAuditForArtifactMock(...(args as [string, string])) as never,
  loadSchemaOverlay: (...args: unknown[]) => loadSchemaOverlayMock(...(args as [string, string])),
  __resetEditorStateRegistryDaoForTests: async () => undefined,
}));

const {
  approveEditProposal,
  createLocalEditProposal,
  rejectEditProposal,
  listDocumentAuditEntriesAsync,
  __resetEditorStateCachesForTests,
} = await import('../documentStudioService.js');

const ARTIFACT = 'artifact-persist-1';
const ORG = 'org-1';

function makeLocalProposalInput() {
  return {
    artifactId: ARTIFACT,
    organizationId: ORG,
    userId: 'user-1',
    input: {
      scope: 'local' as const,
      sectionId: 'sec-1',
      blockId: 'blk-1',
      instruction: 'Make it concise.',
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('documentStudioService — editor state persistence write-through', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
    persistProposalMock.mockClear();
    persistAuditEntryMock.mockClear();
    persistSchemaOverlayMock.mockClear();
    loadProposalsForArtifactMock.mockClear();
    loadAuditForArtifactMock.mockClear();
    loadSchemaOverlayMock.mockClear();
    loadProposalsForArtifactMock.mockResolvedValue([]);
    loadAuditForArtifactMock.mockResolvedValue([] as never[]);
    loadSchemaOverlayMock.mockResolvedValue(null);
  });

  afterEach(() => {
    persistProposalMock.mockResolvedValue({ ok: true });
    persistAuditEntryMock.mockResolvedValue({ ok: true });
    persistSchemaOverlayMock.mockResolvedValue({ ok: true });
  });

  it('createLocalEditProposal persists the proposal and a proposal_created audit row', async () => {
    const proposal = await createLocalEditProposal(makeLocalProposalInput());
    await flushMicrotasks();

    expect(persistProposalMock).toHaveBeenCalled();
    const persisted = persistProposalMock.mock.calls[0]?.[0] as unknown as DocumentEditorProposal;
    expect(persisted.proposalId).toBe(proposal.proposalId);
    expect(persisted.artifactId).toBe(ARTIFACT);
    expect(persisted.status).toBe('proposed');

    const auditActions = persistAuditEntryMock.mock.calls.map(
      (c) => (c[0] as unknown as { action: string }).action
    );
    expect(auditActions).toContain('proposal_created');
  });

  it('approveEditProposal persists the executed proposal and approve/execute audit rows', async () => {
    const proposal = await createLocalEditProposal(makeLocalProposalInput());
    await flushMicrotasks();
    persistProposalMock.mockClear();
    persistAuditEntryMock.mockClear();

    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    await flushMicrotasks();

    expect(result.proposal.status).toBe('executed');
    const persisted = persistProposalMock.mock.calls.at(
      -1
    )?.[0] as unknown as DocumentEditorProposal;
    expect(persisted.status).toBe('executed');

    const auditActions = persistAuditEntryMock.mock.calls.map(
      (c) => (c[0] as unknown as { action: string }).action
    );
    expect(auditActions).toContain('proposal_approved');
    expect(auditActions).toContain('proposal_executed');
  });

  it('rejectEditProposal (async) persists the rejected proposal and a proposal_rejected audit row', async () => {
    const proposal = await createLocalEditProposal(makeLocalProposalInput());
    await flushMicrotasks();
    persistProposalMock.mockClear();
    persistAuditEntryMock.mockClear();

    const rejected = await rejectEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-3',
      proposalId: proposal.proposalId,
    });
    await flushMicrotasks();

    expect(rejected.status).toBe('rejected');
    const persisted = persistProposalMock.mock.calls.at(
      -1
    )?.[0] as unknown as DocumentEditorProposal;
    expect(persisted.status).toBe('rejected');

    const auditActions = persistAuditEntryMock.mock.calls.map(
      (c) => (c[0] as unknown as { action: string }).action
    );
    expect(auditActions).toContain('proposal_rejected');
  });

  it('cold-start hydration re-loads a persisted proposal so approve does not 404', async () => {
    // Author + capture a real proposal, then simulate a server restart by
    // clearing the in-process caches. The DAO returns the persisted row.
    const proposal = await createLocalEditProposal(makeLocalProposalInput());
    await flushMicrotasks();

    __resetEditorStateCachesForTests();
    loadProposalsForArtifactMock.mockResolvedValue([proposal]);

    // Approve must succeed by hydrating the proposal from the DAO.
    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    expect(result.proposal.status).toBe('executed');
    expect(loadProposalsForArtifactMock).toHaveBeenCalledWith(ARTIFACT, ORG);
  });

  it('cold-start hydration surfaces the persisted audit ledger via the async listing', async () => {
    loadAuditForArtifactMock.mockResolvedValue([
      {
        auditId: 'audit-restored-1',
        artifactId: ARTIFACT,
        organizationId: ORG,
        action: 'proposal_created',
        actorId: 'user-1',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never[]);

    const audit = await listDocumentAuditEntriesAsync(ARTIFACT, ORG);
    expect(audit.map((a) => a.auditId)).toContain('audit-restored-1');
    expect(loadAuditForArtifactMock).toHaveBeenCalledWith(ARTIFACT, ORG);
  });

  it('persistence failures do not throw — the cache stays authoritative', async () => {
    persistProposalMock.mockRejectedValueOnce(new Error('connection refused'));
    persistAuditEntryMock.mockRejectedValue(new Error('connection refused'));

    const proposal = await createLocalEditProposal(makeLocalProposalInput());
    await flushMicrotasks();
    expect(proposal.status).toBe('proposed');

    // The in-process cache still has the proposal so approve succeeds.
    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    expect(result.proposal.status).toBe('executed');
  });

  it('hydration only loads each (artifact, org) once', async () => {
    await listDocumentAuditEntriesAsync(ARTIFACT, ORG);
    await listDocumentAuditEntriesAsync(ARTIFACT, ORG);
    await listDocumentAuditEntriesAsync(ARTIFACT, ORG);
    const loads = loadProposalsForArtifactMock.mock.calls.filter(
      (c) => c[0] === ARTIFACT && c[1] === ORG
    );
    expect(loads).toHaveLength(1);
  });
});
