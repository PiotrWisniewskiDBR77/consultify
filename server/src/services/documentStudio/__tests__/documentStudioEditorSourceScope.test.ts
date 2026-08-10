/**
 * Document Studio — Editor source scope tests (Epic E3, Slice 4.2).
 *
 * Verifies:
 *   - source proposal targets only blocks whose `block.sourceRef` is set
 *     (other blocks remain untouched);
 *   - on approval the deterministic marker ONLY appears in the
 *     source-anchored blocks;
 *   - audit trail records `scope: 'source'` plus affected counts;
 *   - empty instruction is rejected;
 *   - artifact with no source-anchored blocks rejects with
 *     `no_source_anchored_blocks`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-src-1',
  artifactId: 'artifact-src-1',
  title: 'Source Scope Test Document',
  // 'analysis_report' is not a member of DocumentTypeKey; this suite never
  // branches on the document type, so the neutral valid member is used.
  documentType: 'generic_document',
  language: 'en',
  audience: ['Steering Committee'],
  goal: 'inform',
  communicationRegister: 'executive',
  density: 'detailed',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
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
      sectionId: 'sec-findings',
      orderIndex: 0,
      level: 1,
      title: 'Findings',
      blocks: [
        {
          blockId: 'blk-cited-1',
          type: 'paragraph',
          content: { text: 'Adoption hit 12% [Source: McKinsey 2026].' } as unknown,
          sourceRef: { sourceType: 'report', sourceId: 'mck-2026', sourceTitle: 'McKinsey 2026' },
        },
        {
          blockId: 'blk-uncited-1',
          type: 'paragraph',
          content: { text: 'Original opinion paragraph without source.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-context',
      orderIndex: 1,
      level: 1,
      title: 'Market Context',
      blocks: [
        {
          blockId: 'blk-cited-2',
          type: 'paragraph',
          content: {
            text: 'Market grew 7% in Q1 2026 [Ref: 12].',
          } as unknown,
          sourceRef: { sourceType: 'database', sourceId: 'gartner-2026' },
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-summary',
      orderIndex: 2,
      level: 1,
      title: 'Summary',
      blocks: [
        {
          blockId: 'blk-uncited-2',
          type: 'paragraph',
          content: { text: 'High-level summary paragraph without anchor.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const noSourceSchema: DocumentSchema = {
  ...baseSchema,
  artifactId: 'artifact-no-src',
  documentId: 'doc-no-src',
  sections: [
    {
      sectionId: 'sec-only',
      orderIndex: 0,
      level: 1,
      title: 'Findings',
      blocks: [
        {
          blockId: 'blk-only',
          type: 'paragraph',
          content: { text: 'No anchored blocks here.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
  ],
};

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (organizationId !== 'org-A') return null;
    if (artifactId === 'artifact-src-1') {
      return {
        artifact_id: artifactId,
        organization_id: organizationId,
        title: 'Source Scope Test Document',
        content: 'markdown',
        content_json: baseSchema,
        metadata_json: { documentStudioSchema: baseSchema },
      };
    }
    return null;
  }),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import { getWave5Artifact } from '../../wave5ArtifactRuntimeService.js';
import {
  approveEditProposal,
  createSourceEditProposal,
  listDocumentAuditEntries,
} from '../documentStudioService.js';

const mockedGet = vi.mocked(getWave5Artifact);

describe('Document Studio editor — source scope', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('rejects empty source instructions', async () => {
    await expect(
      createSourceEditProposal({
        artifactId: 'artifact-src-1',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: '   ',
      })
    ).rejects.toThrow();
  });

  it('rejects when no block has a sourceRef', async () => {
    mockedGet.mockResolvedValueOnce({
      artifact_id: 'artifact-no-src',
      organization_id: 'org-A',
      title: 'No Source Document',
      content: 'markdown',
      content_json: noSourceSchema,
      metadata_json: { documentStudioSchema: noSourceSchema },
    } as unknown as Awaited<ReturnType<typeof getWave5Artifact>>);
    await expect(
      createSourceEditProposal({
        artifactId: 'artifact-no-src',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: 'Polish citations.',
      })
    ).rejects.toThrow('no_source_anchored_blocks');
  });

  it('targets only the two source-anchored blocks (cross-section)', async () => {
    const proposal = await createSourceEditProposal({
      artifactId: 'artifact-src-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Polish source-anchored prose.',
    });
    expect(proposal.scope).toBe('source');
    // Cited blocks live in sec-findings + sec-context.
    expect(proposal.affectedSectionIds.sort()).toEqual(['sec-context', 'sec-findings'].sort());
    expect(proposal.affectedSectionIds).not.toContain('sec-summary');
  });

  it('on approval rewrites only the source-anchored blocks; uncited blocks stay verbatim', async () => {
    const proposal = await createSourceEditProposal({
      artifactId: 'artifact-src-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Polish source-anchored prose.',
    });
    const approved = await approveEditProposal({
      artifactId: 'artifact-src-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    expect(approved.proposal.status).toBe('executed');

    const findings = approved.schema.sections.find((s) => s.sectionId === 'sec-findings');
    const context = approved.schema.sections.find((s) => s.sectionId === 'sec-context');
    const summary = approved.schema.sections.find((s) => s.sectionId === 'sec-summary');
    if (!findings || !context || !summary) throw new Error('expected three sections');

    // Cited blocks → marker present.
    const cited1 = findings.blocks.find((b) => b.blockId === 'blk-cited-1');
    if (!cited1) throw new Error('expected cited-1');
    expect((cited1.content as { text: string }).text).toContain('Edited with instruction');

    const cited2 = context.blocks.find((b) => b.blockId === 'blk-cited-2');
    if (!cited2) throw new Error('expected cited-2');
    expect((cited2.content as { text: string }).text).toContain('Edited with instruction');

    // Uncited blocks → verbatim.
    const uncited1 = findings.blocks.find((b) => b.blockId === 'blk-uncited-1');
    if (!uncited1) throw new Error('expected uncited-1');
    expect((uncited1.content as { text: string }).text).toBe(
      'Original opinion paragraph without source.'
    );

    const uncited2 = summary.blocks.find((b) => b.blockId === 'blk-uncited-2');
    if (!uncited2) throw new Error('expected uncited-2');
    expect((uncited2.content as { text: string }).text).toBe(
      'High-level summary paragraph without anchor.'
    );
  });

  it('records source scope, affected section count and block count in the audit trail', async () => {
    const proposal = await createSourceEditProposal({
      artifactId: 'artifact-src-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Polish source-anchored prose.',
    });
    const audit = listDocumentAuditEntries('artifact-src-1', 'org-A');
    const created = audit.find(
      (entry) => entry.action === 'proposal_created' && entry.proposalId === proposal.proposalId
    );
    expect(created?.details).toMatchObject({
      scope: 'source',
      affectedSectionCount: 2,
      affectedBlockCount: 2,
    });
  });
});
