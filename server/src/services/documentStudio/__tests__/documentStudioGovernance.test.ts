import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-1',
  artifactId: 'artifact-1',
  title: 'Test Document',
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
      blocks: [
        { blockId: 'blk-1', type: 'paragraph', content: { text: 'Original summary text.' } as any },
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
    if (artifactId !== 'artifact-1' || organizationId !== 'org-1') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Test Document',
      content: 'markdown',
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  buildWave5ExportManifest: vi.fn(async () => ({})),
}));

import {
  approveLocalEditProposal,
  createLocalEditProposal,
  listDocumentAuditEntries,
  rejectLocalEditProposal,
} from '../documentStudioService.js';

describe('Document Studio governance flow', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('enforces proposal -> approval -> execution -> audit sequence', async () => {
    const proposal = await createLocalEditProposal({
      artifactId: 'artifact-1',
      organizationId: 'org-1',
      userId: 'user-1',
      input: {
        scope: 'local',
        sectionId: 'sec-1',
        blockId: 'blk-1',
        instruction: 'Make this concise and action-oriented.',
      },
    });

    expect(proposal.status).toBe('proposed');
    const approved = await approveLocalEditProposal({
      artifactId: 'artifact-1',
      organizationId: 'org-1',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    expect(approved.proposal.status).toBe('executed');
    expect(approved.schema.sections[0].blocks[0].content).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('Edited with instruction'),
      })
    );

    const audit = listDocumentAuditEntries('artifact-1', 'org-1');
    const actions = audit.map((entry) => entry.action);
    expect(actions).toContain('proposal_created');
    expect(actions).toContain('proposal_approved');
    expect(actions).toContain('proposal_executed');
  });

  it('supports rejecting pending proposals and records audit', async () => {
    const proposal = await createLocalEditProposal({
      artifactId: 'artifact-1',
      organizationId: 'org-1',
      userId: 'user-1',
      input: {
        scope: 'local',
        sectionId: 'sec-1',
        blockId: 'blk-1',
        instruction: 'Replace with short bullet summary.',
      },
    });

    const rejected = rejectLocalEditProposal({
      artifactId: 'artifact-1',
      organizationId: 'org-1',
      userId: 'user-3',
      proposalId: proposal.proposalId,
    });

    expect(rejected.status).toBe('rejected');
    const audit = listDocumentAuditEntries('artifact-1', 'org-1');
    expect(audit.some((entry) => entry.action === 'proposal_rejected')).toBe(true);
  });
});
