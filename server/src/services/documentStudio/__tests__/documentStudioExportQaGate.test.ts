/**
 * Document Studio — Export QA gate tests (MVP-3 hardening).
 *
 * Verifies the soft-block contract from MVP-3 hardening slice 6.3.3:
 *
 *   - For approval-gated document types (e.g. `board_report`,
 *     `decision_memo`), `exportDocumentArtifact` runs `runDocumentQa` and
 *     throws `QaBlockingError` when any category goes blocking. The error
 *     carries the full report.
 *   - The gate is enforced for every format (markdown / docx / pdf).
 *   - For approval-gated types with a clean QA, the export proceeds and
 *     the manifest carries `qaReportSummary`.
 *   - For non-approval-gated types (e.g. `executive_memo`,
 *     `generic_document`), the gate is a no-op even with terrible QA.
 *   - When `qaOverride: true` is passed alongside a blocking report, the
 *     export proceeds, the manifest stamps `qaOverride: true`, and a
 *     `qa_override_export` audit entry is recorded.
 *   - Without an override, a blocking report records a `qa_blocked_export`
 *     audit entry before throwing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-export-qa-1',
  artifactId: 'artifact-export-qa-1',
  title: 'Export QA Test Document',
  // Default: NOT approval-gated. Individual tests override via cloneSchema.
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
    toc: false,
    coverPage: false,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 'sec-summary',
      orderIndex: 0,
      level: 1,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-1',
          type: 'paragraph',
          // Lots of banned phrases → Brand QA score collapses below 70.
          content: {
            text: 'As an AI assistant, this placeholder TBD memo leverages cutting-edge synergy and amazing world-class outcomes through utilize best-of-breed frameworks.',
          },
        },
        {
          blockId: 'blk-2',
          type: 'paragraph',
          // Another banned-phrase-heavy block plus enough content to trip
          // doc-level no-sources (3+ editable blocks total) and section-level
          // no-sources (>= 12 words, no section sourceRefs).
          content: {
            text: 'The incredible game-changing initiative will utilize world-class synergy across the platform to deliver amazing outcomes.',
          },
        },
        {
          blockId: 'blk-3',
          type: 'paragraph',
          content: {
            text: 'Final placeholder paragraph to ensure the document has at least three editable blocks for the doc-level Source QA check.',
          },
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let schemaToReturn: DocumentSchema = baseSchema;

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== 'artifact-export-qa-1' || organizationId !== 'org-A') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Export QA Test Document',
      content: 'markdown body',
      content_json: schemaToReturn,
      metadata_json: { documentStudioSchema: schemaToReturn },
    };
  }),
  buildWave5ExportManifest: vi.fn(async () => ({})),
  markWave5ArtifactExported: vi.fn(),
}));

vi.mock('../documentDocxRenderer.js', () => ({
  renderDocumentSchemaToDocxBuffer: vi.fn(async () => Buffer.from('docx-bytes')),
}));

vi.mock('../documentPdfRenderer.js', () => ({
  renderDocumentSchemaToPdfBuffer: vi.fn(async () => Buffer.from('pdf-bytes')),
}));

import { QaBlockingError, QaOverrideUnauthorizedError } from '../documentQaService.js';
import { exportDocumentArtifact, listDocumentAuditEntries } from '../documentStudioService.js';

function setSchema(overrides: Partial<DocumentSchema>): void {
  schemaToReturn = { ...baseSchema, ...overrides };
}

describe('Export QA gate — non-approval-gated types', () => {
  beforeEach(() => {
    setSchema({});
  });

  it('skips QA gate for executive_memo even with blocking content', async () => {
    setSchema({ documentType: 'executive_memo' });
    const result = await exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'markdown');
    expect(result.format).toBe('markdown');
    expect(result.contentText).toBe('markdown body');
  });

  it('skips QA gate for generic_document', async () => {
    setSchema({ documentType: 'generic_document' });
    const result = await exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'pdf');
    expect(result.format).toBe('pdf');
    expect(result.contentBase64).toBeDefined();
  });
});

describe('Export QA gate — approval-gated types', () => {
  beforeEach(() => {
    setSchema({});
  });

  it('allows an explicitly requested draft export and marks its filename and manifest', async () => {
    setSchema({ documentType: 'board_report' });
    const result = await exportDocumentArtifact(
      'artifact-export-qa-1',
      'org-A',
      'markdown',
      { userId: 'user-draft-1', mode: 'draft' }
    );

    expect(result.filename).toContain('_DRAFT.markdown');
    expect(result.manifest).toMatchObject({
      exportMode: 'draft',
      draftMarkingRequired: true,
    });
    expect(listDocumentAuditEntries('artifact-export-qa-1', 'org-A')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'qa_blocked_export' })])
    );
  });

  it('throws QaBlockingError for board_report with blocking findings (markdown)', async () => {
    setSchema({ documentType: 'board_report' });
    await expect(
      exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'markdown', {
        userId: 'user-export-1',
      })
    ).rejects.toBeInstanceOf(QaBlockingError);
  });

  it('throws QaBlockingError for decision_memo (docx) and the error carries the report', async () => {
    setSchema({ documentType: 'decision_memo' });
    try {
      await exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'docx', {
        userId: 'user-export-2',
      });
      throw new Error('expected QaBlockingError');
    } catch (err) {
      if (!(err instanceof QaBlockingError)) throw err;
      expect(err.code).toBe('qa_blocking');
      expect(err.report.anyBlocking).toBe(true);
      expect(err.report.categories.some((c) => c.blocking && c.findings.length > 0)).toBe(true);
    }
  });

  it('records a qa_blocked_export audit entry on every block', async () => {
    setSchema({ documentType: 'business_case', artifactId: 'artifact-export-qa-1' });
    await expect(
      exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'pdf', {
        userId: 'user-block-1',
      })
    ).rejects.toBeInstanceOf(QaBlockingError);
    const audit = listDocumentAuditEntries('artifact-export-qa-1', 'org-A');
    const blocked = audit.find(
      (e) => e.action === 'qa_blocked_export' && e.actorId === 'user-block-1'
    );
    expect(blocked).toBeDefined();
    expect(blocked?.details).toMatchObject({ format: 'pdf', documentType: 'business_case' });
  });

  it('proceeds when qaOverride: true is set by an authorized role, stamps manifest, records qa_override_export audit entry with QA snapshot', async () => {
    setSchema({ documentType: 'client_final_report' });
    const result = await exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'docx', {
      userId: 'user-override-1',
      userRole: 'PROJECT_MANAGER',
      qaOverride: true,
    });
    expect(result.format).toBe('docx');
    const manifest = result.manifest as Record<string, unknown>;
    expect(manifest.qaOverride).toBe(true);
    expect(manifest.qaReportSummary).toBeDefined();
    const audit = listDocumentAuditEntries('artifact-export-qa-1', 'org-A');
    const override = audit.find(
      (e) => e.action === 'qa_override_export' && e.actorId === 'user-override-1'
    );
    expect(override).toBeDefined();
    const details = override?.details as Record<string, unknown> | undefined;
    expect(details?.actorRole).toBe('PROJECT_MANAGER');
    const snapshot = details?.qaReport as
      | { anyBlocking?: boolean; categories?: unknown[]; blockingFindings?: unknown[] }
      | undefined;
    expect(snapshot?.anyBlocking).toBe(true);
    expect(Array.isArray(snapshot?.categories)).toBe(true);
    expect(Array.isArray(snapshot?.blockingFindings)).toBe(true);
    expect((snapshot?.blockingFindings ?? []).length).toBeGreaterThan(0);
  });

  it('rejects qaOverride for a non-privileged role with QaOverrideUnauthorizedError and audits the denial', async () => {
    setSchema({ documentType: 'board_report' });
    await expect(
      exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'pdf', {
        userId: 'user-noobody-1',
        userRole: 'TEAM_MEMBER',
        qaOverride: true,
      })
    ).rejects.toBeInstanceOf(QaOverrideUnauthorizedError);
    const audit = listDocumentAuditEntries('artifact-export-qa-1', 'org-A');
    const denied = audit.find(
      (e) => e.action === 'qa_override_denied' && e.actorId === 'user-noobody-1'
    );
    expect(denied).toBeDefined();
    expect((denied?.details as Record<string, unknown>)?.attemptedRole).toBe('TEAM_MEMBER');
  });

  it('rejects qaOverride when role is missing entirely (deny-by-default)', async () => {
    setSchema({ documentType: 'business_case' });
    await expect(
      exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'docx', {
        userId: 'user-noroleat-all',
        qaOverride: true,
      })
    ).rejects.toBeInstanceOf(QaOverrideUnauthorizedError);
  });

  it('records the QA report snapshot in qa_blocked_export audit details', async () => {
    setSchema({ documentType: 'decision_memo' });
    await expect(
      exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'pdf', {
        userId: 'user-snapshot-1',
      })
    ).rejects.toBeInstanceOf(QaBlockingError);
    const audit = listDocumentAuditEntries('artifact-export-qa-1', 'org-A');
    const blocked = audit.find(
      (e) => e.action === 'qa_blocked_export' && e.actorId === 'user-snapshot-1'
    );
    expect(blocked).toBeDefined();
    const details = blocked?.details as Record<string, unknown> | undefined;
    const snapshot = details?.qaReport as
      | { categories?: Array<{ category: string; score: number; blocking: boolean }> }
      | undefined;
    expect(Array.isArray(snapshot?.categories)).toBe(true);
    // Must include every canonical QA category for forensic replay.
    // Slice E5.6.qa added `source_drift` as the 11th category twinned
    // with `sources`; it is non-blocking and tracks NFR-17 advisory
    // findings (unpinned source refs).
    expect(snapshot?.categories?.map((c) => c.category)).toEqual([
      'brand',
      'language',
      'completeness',
      'sources',
      'source_drift',
      'methodology',
      'executive',
      'risk',
      'data',
      'format',
      'export',
    ]);
    // At least one category must be marked blocking.
    expect(snapshot?.categories?.some((c) => c.blocking)).toBe(true);
  });

  it('proceeds when QA passes for an approval-gated type and stamps qaReportSummary', async () => {
    setSchema({
      documentType: 'board_report',
      sourceRefs: [{ sourceType: 'doc', sourceId: 'src-1', sourceTitle: 'Top-level' }],
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Executive Summary',
          blocks: [
            {
              blockId: 'blk-1',
              type: 'paragraph',
              content: {
                text: 'The proposed roadmap consolidates three workstreams under a single accountable owner. Phase one closes the data foundation in nine weeks. Phase two delivers measurable adoption gains within the following quarter; the board can review the milestones at the next checkpoint.',
              },
            },
          ],
          sourceRefs: [{ sourceType: 'doc', sourceId: 'src-2', sourceTitle: 'Section src' }],
        },
      ],
    });
    const result = await exportDocumentArtifact('artifact-export-qa-1', 'org-A', 'pdf', {
      userId: 'user-clean-1',
    });
    expect(result.format).toBe('pdf');
    const manifest = result.manifest as Record<string, unknown>;
    const summary = manifest.qaReportSummary as { anyBlocking: boolean };
    expect(summary.anyBlocking).toBe(false);
  });
});
