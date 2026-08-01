// @vitest-environment node
/**
 * P0 data-loss fix — manual (non-AI) TipTap editor content autosave.
 *
 * Before this slice, a manual edit typed directly into
 * `DocumentTipTapEditor` only ever updated the React component's local
 * `schema` state (`DocumentStudioView.tsx`: `onSchemaUpdated={setSchema}`).
 * Nothing reached the server, so a reload silently discarded the edit
 * (or reverted to whatever an AI proposal had last approved).
 *
 * `updateDocumentManualContent` reuses the SAME durable write-through
 * layer the AI-proposal / rollback / content-block-insert paths already
 * use (`document_studio_schema_overlay` via `persistSchemaOverlayWriteThrough`
 * → `documentEditorStateRegistryDao.persistSchemaOverlay`), so
 * `getDocumentArtifact` sees the manually-edited sections on the very
 * next read — proving "reload → text trusts" without a separate read path.
 *
 * This test pins down:
 *   (a) a successful save persists through the overlay DAO and a
 *       subsequent `getDocumentArtifact` read-back reflects the new
 *       sections (the reload-survives-edit contract).
 *   (b) an optimistic-lock version mismatch (`expectedVersion` stale)
 *       is rejected with `DocumentManualSaveConflictError` — never a
 *       silent overwrite — mirroring
 *       `PUT /api/v8/notebook/pages/:noteId/content`'s 409 contract.
 *   (c) a successful save does NOT touch the proposal store — proving
 *       manual-edit autosave cannot race / clobber the approve-flow's
 *       own bookkeeping.
 *   (d) an unknown artifact throws `DocumentManualSaveNotFoundError`.
 *
 * Same mocking harness as
 * `documentStudioService.proposalPersistence.test.ts` (wave5ArtifactRuntimeService +
 * documentEditorStateRegistryDao mocked, no live DB needed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

const BASE_SCHEMA: DocumentSchema = {
  documentId: 'doc-manual-1',
  artifactId: 'artifact-manual-1',
  title: 'Manual Autosave Test Document',
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
      sectionId: 'sec-manual-1',
      orderIndex: 0,
      level: 1 as const,
      title: 'Analiza',
      blocks: [
        {
          blockId: 'blk-manual-a',
          type: 'paragraph',
          content: { text: 'Original AI-generated text.' } as any,
        },
      ],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
};

const ARTIFACT = BASE_SCHEMA.artifactId;
const ORG = 'org-manual';

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
  async (
    artifactId: string,
    organizationId: string,
    schema: DocumentSchema,
    expectedVersion?: string
  ) => {
    const previous = overlayTable.get(`${artifactId}::${organizationId}`);
    if (expectedVersion && previous && previous.updatedAt !== expectedVersion) {
      return { ok: false, conflict: true };
    }
    overlayTable.set(`${artifactId}::${organizationId}`, schema);
    return { ok: true };
  }
);
const persistProposalMock = vi.fn(async () => ({ ok: true }));

vi.mock('../../../../../server/src/services/documentStudio/documentEditorStateRegistryDao.js', () => ({
  persistProposal: (...args: unknown[]) => persistProposalMock(...(args as [])),
  persistAuditEntry: vi.fn(async () => ({ ok: true })),
  persistSchemaOverlay: (...args: unknown[]) =>
    persistSchemaOverlayMock(...(args as [string, string, DocumentSchema, string?])),
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
  updateDocumentManualContent,
  getDocumentArtifact,
  listDocumentAuditEntries,
  DocumentManualSaveConflictError,
  DocumentManualSaveNotFoundError,
  __resetEditorStateCachesForTests,
} = await import('../../../../../server/src/services/documentStudio/documentStudioService.js');

describe('P0 fix — manual content autosave persists through the schema-overlay DAO', () => {
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

  it('(a) a successful save persists via the overlay DAO, and a subsequent read reflects the manually-edited text (reload survives edit)', async () => {
    const editedSections = [
      {
        ...BASE_SCHEMA.sections[0],
        blocks: [
          {
            blockId: 'blk-manual-a',
            type: 'paragraph' as const,
            content: { text: 'Manually typed replacement text.' } as any,
          },
        ],
      },
    ];

    const result = await updateDocumentManualContent({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-manual',
      sections: editedSections,
      expectedVersion: BASE_SCHEMA.updatedAt,
    });

    expect((result.schema.sections[0].blocks[0].content as any).text).toBe(
      'Manually typed replacement text.'
    );
    expect(persistSchemaOverlayMock).toHaveBeenCalledTimes(1);

    // Reload contract: a fresh read (as a page reload would trigger) must
    // see the manually-typed text, not the original AI-generated text.
    const reread = await getDocumentArtifact(ARTIFACT, ORG);
    expect(reread).not.toBeNull();
    expect((reread!.sections[0].blocks[0].content as any).text).toBe(
      'Manually typed replacement text.'
    );

    // Audited under its own distinct action — never conflated with a
    // proposal action.
    const audit = listDocumentAuditEntries(ARTIFACT, ORG);
    expect(audit.some((entry) => entry.action === 'manual_content_saved')).toBe(true);
  });

  it('(b) a stale expectedVersion is rejected with a conflict error — never a silent overwrite', async () => {
    await expect(
      updateDocumentManualContent({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-manual',
        sections: BASE_SCHEMA.sections,
        expectedVersion: '2020-01-01T00:00:00.000Z', // stale on purpose
      })
    ).rejects.toBeInstanceOf(DocumentManualSaveConflictError);

    // The overlay must NOT have been written on a rejected save.
    expect(persistSchemaOverlayMock).not.toHaveBeenCalled();
  });

  it('(b2) the conflict error carries the current server version so the client can re-sync', async () => {
    try {
      await updateDocumentManualContent({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-manual',
        sections: BASE_SCHEMA.sections,
        expectedVersion: 'not-the-real-version',
      });
      throw new Error('expected updateDocumentManualContent to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(DocumentManualSaveConflictError);
      expect((err as InstanceType<typeof DocumentManualSaveConflictError>).serverVersion).toBe(
        BASE_SCHEMA.updatedAt
      );
    }
  });

  it('(c) a manual save never touches the proposal store — no race with approve-flow', async () => {
    await updateDocumentManualContent({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-manual',
      sections: BASE_SCHEMA.sections,
      expectedVersion: BASE_SCHEMA.updatedAt,
    });

    expect(persistProposalMock).not.toHaveBeenCalled();
  });

  it('(d) an unknown artifact throws DocumentManualSaveNotFoundError', async () => {
    await expect(
      updateDocumentManualContent({
        artifactId: 'artifact-does-not-exist',
        organizationId: ORG,
        userId: 'user-manual',
        sections: BASE_SCHEMA.sections,
        expectedVersion: BASE_SCHEMA.updatedAt,
      })
    ).rejects.toBeInstanceOf(DocumentManualSaveNotFoundError);
  });

  it('(e) does not acknowledge or cache a save when durable persistence fails', async () => {
    persistSchemaOverlayMock.mockResolvedValueOnce({ ok: false });

    await expect(
      updateDocumentManualContent({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-manual',
        sections: BASE_SCHEMA.sections,
        expectedVersion: BASE_SCHEMA.updatedAt,
      })
    ).rejects.toThrow('manual_save_persistence_failed');

    const reread = await getDocumentArtifact(ARTIFACT, ORG);
    expect(reread?.updatedAt).toBe(BASE_SCHEMA.updatedAt);
  });
});
