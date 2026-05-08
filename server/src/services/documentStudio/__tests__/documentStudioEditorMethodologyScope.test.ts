/**
 * Document Studio — Editor methodology scope tests (Epic E3, Slice 4.1).
 *
 * Verifies:
 *   - methodology proposal targets only sections whose title matches the
 *     methodology lexicon (Methodology / Approach / Scope / Założenia /
 *     Scenarios / Sensitivity / Risks);
 *   - other sections (Executive Summary, Findings) are untouched on
 *     approval;
 *   - audit trail records `scope: 'methodology'`;
 *   - empty instruction is rejected;
 *   - artifact with no methodology-aligned sections rejects with
 *     `no_methodology_sections`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-meth-1',
  artifactId: 'artifact-meth-1',
  title: 'Methodology Scope Test Document',
  documentType: 'business_case',
  language: 'en',
  audience: ['Board'],
  goal: 'decide',
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
      sectionId: 'sec-exec',
      orderIndex: 0,
      level: 1,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-exec',
          type: 'paragraph',
          content: { text: 'Original executive summary content.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-method',
      orderIndex: 1,
      level: 1,
      title: 'Methodology',
      blocks: [
        {
          blockId: 'blk-m1',
          type: 'paragraph',
          content: { text: 'Three-phase approach: discovery, design, delivery.' } as unknown,
        },
        {
          blockId: 'blk-m2',
          type: 'paragraph',
          content: { text: 'Each phase has explicit assumptions.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-assump',
      orderIndex: 2,
      level: 1,
      title: 'Założenia',
      blocks: [
        {
          blockId: 'blk-a1',
          type: 'paragraph',
          content: { text: 'Założenie bazowe dotyczące stałego rynku.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-findings',
      orderIndex: 3,
      level: 1,
      title: 'Findings',
      blocks: [
        {
          blockId: 'blk-f1',
          type: 'paragraph',
          content: { text: 'Finding A — adoption is on track.' } as unknown,
        },
      ],
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
    if (artifactId !== 'artifact-meth-1' || organizationId !== 'org-A') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Methodology Scope Test Document',
      content: 'markdown',
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

const noMethodologySchema: DocumentSchema = {
  ...baseSchema,
  artifactId: 'artifact-no-meth',
  documentId: 'doc-no-meth',
  sections: [
    {
      sectionId: 'sec-only-exec',
      orderIndex: 0,
      level: 1,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-only',
          type: 'paragraph',
          content: { text: 'Just an exec section.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
  ],
};

// Add an additional artifact via a second mock layer for the "no methodology
// sections" case. We piggy-back on the same getWave5Artifact mock by
// extending its branching at runtime via vi.mocked.
import { getWave5Artifact } from '../../wave5ArtifactRuntimeService.js';
import {
  approveEditProposal,
  createMethodologyEditProposal,
  listDocumentAuditEntries,
} from '../documentStudioService.js';
const mockedGet = vi.mocked(getWave5Artifact);

describe('Document Studio editor — methodology scope', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('rejects empty methodology instructions', async () => {
    await expect(
      createMethodologyEditProposal({
        artifactId: 'artifact-meth-1',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: '   ',
      })
    ).rejects.toThrow();
  });

  it('rejects when the document has no methodology-aligned sections', async () => {
    mockedGet.mockResolvedValueOnce({
      artifact_id: 'artifact-no-meth',
      organization_id: 'org-A',
      title: 'No Methodology Document',
      content: 'markdown',
      content_json: noMethodologySchema,
      metadata_json: { documentStudioSchema: noMethodologySchema },
    } as unknown as Awaited<ReturnType<typeof getWave5Artifact>>);
    await expect(
      createMethodologyEditProposal({
        artifactId: 'artifact-no-meth',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: 'Tighten methodology.',
      })
    ).rejects.toThrow('no_methodology_sections');
  });

  it('targets only Methodology + Założenia sections (PL+EN heuristics)', async () => {
    const proposal = await createMethodologyEditProposal({
      artifactId: 'artifact-meth-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Refine methodology language for executive register.',
    });
    expect(proposal.scope).toBe('methodology');
    expect(proposal.affectedSectionIds.sort()).toEqual(['sec-assump', 'sec-method'].sort());
    expect(proposal.affectedSectionIds).not.toContain('sec-exec');
    expect(proposal.affectedSectionIds).not.toContain('sec-findings');
  });

  it('on approval rewrites methodology blocks but leaves Executive Summary + Findings untouched', async () => {
    const proposal = await createMethodologyEditProposal({
      artifactId: 'artifact-meth-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Refine methodology language for executive register.',
    });
    const approved = await approveEditProposal({
      artifactId: 'artifact-meth-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    expect(approved.proposal.status).toBe('executed');

    const exec = approved.schema.sections.find((s) => s.sectionId === 'sec-exec');
    const findings = approved.schema.sections.find((s) => s.sectionId === 'sec-findings');
    const method = approved.schema.sections.find((s) => s.sectionId === 'sec-method');
    const assump = approved.schema.sections.find((s) => s.sectionId === 'sec-assump');
    if (!exec || !findings || !method || !assump) {
      throw new Error('expected all four sections to survive approval');
    }

    // Unchanged: exec + findings.
    expect((exec.blocks[0].content as { text: string }).text).toBe(
      'Original executive summary content.'
    );
    expect((findings.blocks[0].content as { text: string }).text).toBe(
      'Finding A — adoption is on track.'
    );

    // Rewritten: methodology + assumptions blocks contain the deterministic
    // marker (LLM not active in this test → fallback path).
    method.blocks.forEach((block) => {
      const text = (block.content as { text: string }).text;
      expect(text).toContain('Edited with instruction');
    });
    assump.blocks.forEach((block) => {
      const text = (block.content as { text: string }).text;
      expect(text).toContain('Edited with instruction');
    });
  });

  it('records the methodology scope and affected section count in the audit trail', async () => {
    const proposal = await createMethodologyEditProposal({
      artifactId: 'artifact-meth-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Tighten methodology assumptions list.',
    });
    const audit = listDocumentAuditEntries('artifact-meth-1', 'org-A');
    const created = audit.find(
      (entry) => entry.action === 'proposal_created' && entry.proposalId === proposal.proposalId
    );
    expect(created?.details).toMatchObject({
      scope: 'methodology',
      affectedSectionCount: 2,
    });
  });
});
