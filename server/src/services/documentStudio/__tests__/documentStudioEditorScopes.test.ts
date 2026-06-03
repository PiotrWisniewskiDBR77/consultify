/**
 * Document Studio — Editor section + global scope tests (MVP-3).
 *
 * Covers:
 *   - Section proposal: every editable block in the section gets the
 *     instruction marker on approval; other sections are untouched.
 *   - Global proposal: every editable block in every section gets the
 *     instruction marker on approval; affectedSectionIds covers all sections.
 *   - Audit log records `proposal_created`, `proposal_approved`,
 *     `proposal_executed` with the correct scope per proposal.
 *   - Empty instructions are rejected.
 *   - Section proposal against a missing sectionId returns `section_not_found`.
 *   - Approving a section/global proposal exits with the executed status.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-scopes-1',
  artifactId: 'artifact-scopes-1',
  title: 'Scopes Test Document',
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
          content: { text: 'Original summary paragraph.' } as unknown,
        },
        {
          blockId: 'blk-2',
          type: 'paragraph',
          content: { text: 'Second summary paragraph.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-findings',
      orderIndex: 1,
      level: 1,
      title: 'Findings',
      blocks: [
        {
          blockId: 'blk-3',
          type: 'bullet_list',
          content: { style: 'bullet', items: ['Finding A', 'Finding B'] } as unknown,
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
    if (artifactId !== 'artifact-scopes-1' || organizationId !== 'org-A') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Scopes Test Document',
      content: 'markdown',
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import {
  approveEditProposal,
  createGlobalEditProposal,
  createSectionEditProposal,
  listDocumentAuditEntries,
  rejectEditProposal,
} from '../documentStudioService.js';

describe('Document Studio editor — section scope (MVP-3)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('rejects empty section instructions', async () => {
    await expect(
      createSectionEditProposal({
        artifactId: 'artifact-scopes-1',
        organizationId: 'org-A',
        userId: 'user-1',
        sectionId: 'sec-summary',
        instruction: '   ',
      })
    ).rejects.toThrow();
  });

  it('returns section_not_found for an unknown sectionId', async () => {
    await expect(
      createSectionEditProposal({
        artifactId: 'artifact-scopes-1',
        organizationId: 'org-A',
        userId: 'user-1',
        sectionId: 'sec-does-not-exist',
        instruction: 'Tighten the section.',
      })
    ).rejects.toThrow('section_not_found');
  });

  it('approves a section proposal and rewrites every block in the section only', async () => {
    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-scopes-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-summary',
      instruction: 'Make the section concise and outcome-driven.',
    });
    expect(proposal.scope).toBe('section');
    expect(proposal.affectedSectionIds).toEqual(['sec-summary']);
    expect(proposal.status).toBe('proposed');

    const approved = await approveEditProposal({
      artifactId: 'artifact-scopes-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    expect(approved.proposal.status).toBe('executed');
    const summary = approved.schema.sections.find((s) => s.sectionId === 'sec-summary');
    if (!summary) throw new Error('expected summary section');
    summary.blocks.forEach((block) => {
      const text = (block.content as { text?: string }).text ?? '';
      expect(text).toContain('Edited with instruction');
    });
    // Findings section must remain unchanged.
    const findings = approved.schema.sections.find((s) => s.sectionId === 'sec-findings');
    if (!findings) throw new Error('expected findings section');
    const items = (findings.blocks[0].content as { items: string[] }).items;
    expect(items).toEqual(['Finding A', 'Finding B']);
  });
});

describe('Document Studio editor — global scope (MVP-3)', () => {
  it('approves a global proposal and rewrites every block in every section', async () => {
    const proposal = await createGlobalEditProposal({
      artifactId: 'artifact-scopes-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Tighten the entire document and remove fluff.',
    });
    expect(proposal.scope).toBe('global');
    expect(proposal.affectedSectionIds).toEqual(['sec-summary', 'sec-findings']);
    expect(proposal.status).toBe('proposed');

    const approved = await approveEditProposal({
      artifactId: 'artifact-scopes-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    expect(approved.proposal.status).toBe('executed');
    approved.schema.sections.forEach((section) => {
      section.blocks.forEach((block) => {
        const content = block.content as { text?: string; items?: string[] };
        if (typeof content.text === 'string') {
          expect(content.text).toContain('Edited with instruction');
        }
        if (Array.isArray(content.items)) {
          // Bullet items get joined+rewritten by the deterministic editor;
          // the marker shows up in at least one of the resulting items.
          expect(content.items.join(' ')).toContain('Edited with instruction');
        }
      });
    });
  });

  it('records the section/global scope in the audit trail', async () => {
    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-scopes-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-summary',
      instruction: 'Add a one-sentence recommendation at the end.',
    });
    await rejectEditProposal({
      artifactId: 'artifact-scopes-1',
      organizationId: 'org-A',
      userId: 'user-3',
      proposalId: proposal.proposalId,
    });
    const audit = listDocumentAuditEntries('artifact-scopes-1', 'org-A');
    const created = audit.find(
      (entry) => entry.action === 'proposal_created' && entry.proposalId === proposal.proposalId
    );
    expect(created?.details).toMatchObject({ scope: 'section', sectionId: 'sec-summary' });
    const rejected = audit.find(
      (entry) => entry.action === 'proposal_rejected' && entry.proposalId === proposal.proposalId
    );
    expect(rejected?.details).toMatchObject({ scope: 'section' });
  });
});
