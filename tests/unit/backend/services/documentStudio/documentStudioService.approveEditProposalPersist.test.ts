// @vitest-environment node
/**
 * P1 data-loss fix — `approveEditProposal` did not persist the approved
 * schema.
 *
 * Before this slice, `approveEditProposal` computed `nextSchema` (the
 * document schema with the AI-proposed edit applied) and returned it in
 * the HTTP response, but never wrote it through
 * `persistSchemaOverlayWriteThrough` — unlike `insertDocumentContentBlock`
 * and `rollbackDocumentToVersion`, which both call it. The in-process
 * `schemaOverlayStore` cache was never updated either, so a subsequent
 * read (page reload, export, any other caller of `getDocumentArtifact`)
 * resolved the PRE-approval schema (either the stale wave5 row, or an
 * older overlay entry from a prior rollback / content-block insert). An
 * approved AI edit — the entire point of the propose/approve workflow —
 * silently vanished on reload. Same class of bug as the manual-content
 * autosave fix (`documentStudioService.manualContentSave.test.ts`).
 *
 * This test pins down the fix:
 *   (a) approving a proposal writes the resulting schema through
 *       `persistSchemaOverlay` (the durable DAO), and a subsequent
 *       `getDocumentArtifact` read reflects the approved edit — proving
 *       "reload survives approve" the same way the manual-save test
 *       proves "reload survives manual edit".
 *   (b) the in-process overlay cache is updated synchronously — a read
 *       immediately after `approveEditProposal` resolves (before any
 *       DAO round trip could complete) already sees the new text.
 *   (c) the HTTP-facing return value (`result.schema`) is unaffected —
 *       still reflects the approved edit, so the persistence fix does
 *       not change the existing response contract.
 *
 * Same mocking harness as `documentStudioService.manualContentSave.test.ts`
 * / `documentStudioService.proposalPersistence.test.ts` (wave5ArtifactRuntimeService
 * + documentEditorStateRegistryDao mocked, no live DB needed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

const BASE_SCHEMA: DocumentSchema = {
  documentId: 'doc-approve-persist-1',
  artifactId: 'artifact-approve-persist-1',
  title: 'Approve-Persist Test Document',
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
      sectionId: 'sec-approve-1',
      orderIndex: 0,
      level: 1 as const,
      title: 'Analiza',
      blocks: [
        {
          blockId: 'blk-approve-a',
          type: 'paragraph',
          content: { text: 'Original AI-generated text before proposal.' } as any,
        },
      ],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
};

const ARTIFACT = BASE_SCHEMA.artifactId;
const ORG = 'org-approve-persist';

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

// In-memory stand-in for the `document_studio_schema_overlay` table so
// `persistSchemaOverlay` / `loadSchemaOverlay` behave like the real DAO
// without touching Postgres.
let overlayTable = new Map<string, DocumentSchema>();
const persistSchemaOverlayMock = vi.fn(
  async (artifactId: string, organizationId: string, schema: DocumentSchema) => {
    overlayTable.set(`${artifactId}::${organizationId}`, schema);
    return { ok: true };
  }
);
const persistProposalMock = vi.fn(async () => ({ ok: true }));

vi.mock('../../../../../server/src/services/documentStudio/documentEditorStateRegistryDao.js', () => ({
  persistProposal: (...args: unknown[]) => persistProposalMock(...(args as [])),
  persistAuditEntry: vi.fn(async () => ({ ok: true })),
  persistSchemaOverlay: (...args: unknown[]) =>
    persistSchemaOverlayMock(...(args as [string, string, DocumentSchema])),
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

const {
  createLocalEditProposal,
  approveEditProposal,
  getDocumentArtifact,
  __resetEditorStateCachesForTests,
} = await import('../../../../../server/src/services/documentStudio/documentStudioService.js');

// `createLocalEditProposal` (useLlm: false) deterministically derives
// `diff.after` as `${before}\n\n[Edited with instruction: ${instruction}]`
// (see `applyInstruction` in documentStudioService.ts) — there is no
// caller-supplied override, so tests assert against that exact shape.
const INSTRUCTION = 'Zamień tekst na wersję zatwierdzoną.';
const ORIGINAL_TEXT = (BASE_SCHEMA.sections[0].blocks[0].content as any).text as string;
const EXPECTED_APPROVED_TEXT = `${ORIGINAL_TEXT}\n\n[Edited with instruction: ${INSTRUCTION}]`;

function makeLocalProposal(instruction = INSTRUCTION) {
  return createLocalEditProposal({
    artifactId: ARTIFACT,
    organizationId: ORG,
    userId: 'user-approve-persist',
    input: {
      scope: 'local',
      sectionId: 'sec-approve-1',
      blockId: 'blk-approve-a',
      instruction,
    } as any,
    useLlm: false,
  });
}

describe('P1 fix — approveEditProposal persists the approved schema through the overlay DAO', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
    overlayTable = new Map();
    persistSchemaOverlayMock.mockClear();
    persistProposalMock.mockClear();
    loggerErrorMock.mockClear();
    loggerWarnMock.mockClear();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('(a) approving a local proposal writes through the overlay DAO, and a subsequent read reflects the approved text (reload survives approve)', async () => {
    const proposal = await makeLocalProposal();

    const { proposal: approved, schema } = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-approve-persist',
      proposalId: proposal.proposalId,
    });

    expect(approved.status).toBe('executed');
    expect((schema.sections[0].blocks[0].content as any).text).toBe(EXPECTED_APPROVED_TEXT);

    // The durable overlay DAO must have been called with the approved schema.
    expect(persistSchemaOverlayMock).toHaveBeenCalledTimes(1);
    expect(overlayTable.get(`${ARTIFACT}::${ORG}`)?.sections[0].blocks[0].content).toEqual({
      text: EXPECTED_APPROVED_TEXT,
    });

    // Reload contract: a fresh read (as a page reload / export / any other
    // getDocumentArtifact caller would trigger) must see the approved
    // text, not the pre-approval original.
    const reread = await getDocumentArtifact(ARTIFACT, ORG);
    expect(reread).not.toBeNull();
    expect((reread!.sections[0].blocks[0].content as any).text).toBe(EXPECTED_APPROVED_TEXT);
  });

  it('(b) the in-process overlay cache reflects the approved schema synchronously, before any DAO round trip resolves', async () => {
    // Make the DAO write hang so we can prove the read-back does not
    // depend on it having resolved.
    let resolveDao: (() => void) | undefined;
    persistSchemaOverlayMock.mockImplementationOnce(
      (artifactId: string, organizationId: string, schema: DocumentSchema) =>
        new Promise((resolve) => {
          resolveDao = () => {
            overlayTable.set(`${artifactId}::${organizationId}`, schema);
            resolve({ ok: true });
          };
        })
    );

    const proposal = await makeLocalProposal();
    await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-approve-persist',
      proposalId: proposal.proposalId,
    });

    // Overlay write-through is fire-and-forget (`void daoPersistSchemaOverlay`)
    // by design — the synchronous in-process cache is the source of truth
    // for immediate reads, same contract as insertDocumentContentBlock /
    // rollbackDocumentToVersion.
    const reread = await getDocumentArtifact(ARTIFACT, ORG);
    expect((reread!.sections[0].blocks[0].content as any).text).toBe(EXPECTED_APPROVED_TEXT);

    // Clean up the pending promise so it doesn't leak into other tests.
    resolveDao?.();
  });

  it('(c) the HTTP-facing return value already reflects the approved edit (existing response contract unchanged)', async () => {
    const proposal = await makeLocalProposal();

    const { schema } = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-approve-persist',
      proposalId: proposal.proposalId,
    });

    expect((schema.sections[0].blocks[0].content as any).text).toBe(EXPECTED_APPROVED_TEXT);
  });
});
