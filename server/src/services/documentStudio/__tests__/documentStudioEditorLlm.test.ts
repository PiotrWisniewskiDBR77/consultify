/**
 * Document Studio — Editor `useLlm` integration tests (MVP-3 hardening).
 *
 * Verifies that:
 *   - `useLlm: true` calls the LLM refiner and stores per-block rewrites on
 *     the proposal (`blockRewrites`, `llmRefined`).
 *   - On approval, blocks with rewrites get the rewritten text; blocks
 *     without rewrites (e.g. when the LLM returned malformed output for
 *     that block) fall back to the deterministic instruction marker.
 *   - When the LLM throws for ALL blocks, the proposal still succeeds with
 *     no `blockRewrites` and approval applies the deterministic marker
 *     (legacy behavior preserved).
 *   - `useLlm` defaults to off: omitting it produces a deterministic
 *     proposal, identical to the legacy contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-llm-1',
  artifactId: 'artifact-llm-1',
  title: 'LLM Editor Test Document',
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
          content: { text: 'Original summary paragraph one.' } as unknown,
        },
        {
          blockId: 'blk-2',
          type: 'paragraph',
          content: { text: 'Original summary paragraph two.' } as unknown,
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
          type: 'paragraph',
          content: { text: 'Finding paragraph here.' } as unknown,
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
    if (artifactId !== 'artifact-llm-1' || organizationId !== 'org-A') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'LLM Editor Test Document',
      content: 'markdown',
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

vi.mock('../../aiService.js', () => ({
  generateChatResponse: vi.fn(),
}));

import { generateChatResponse } from '../../aiService.js';
import {
  approveEditProposal,
  createGlobalEditProposal,
  createLocalEditProposal,
  createSectionEditProposal,
} from '../documentStudioService.js';

const generateChatResponseMock = vi.mocked(generateChatResponse);

describe('Editor `useLlm` integration — local scope (MVP-3 hardening)', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('omitting useLlm produces a deterministic proposal (no LLM calls)', async () => {
    const proposal = await createLocalEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      input: {
        scope: 'local',
        sectionId: 'sec-summary',
        blockId: 'blk-1',
        instruction: 'Tighten the paragraph.',
      },
    });
    expect(proposal.scope).toBe('local');
    expect(proposal.llmRefined).toBeUndefined();
    expect(generateChatResponseMock).not.toHaveBeenCalled();
    expect(proposal.diff.after).toContain('Edited with instruction');
  });

  it('useLlm:true uses the LLM rewrite as diff.after on success', async () => {
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ text: 'Tightened paragraph one with sharper framing.' }),
    });
    const proposal = await createLocalEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      input: {
        scope: 'local',
        sectionId: 'sec-summary',
        blockId: 'blk-1',
        instruction: 'Tighten the paragraph.',
      },
      useLlm: true,
    });
    expect(generateChatResponseMock).toHaveBeenCalledTimes(1);
    expect(proposal.diff.after).toBe('Tightened paragraph one with sharper framing.');

    const approved = await approveEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    const summary = approved.schema.sections.find((s) => s.sectionId === 'sec-summary');
    if (!summary) throw new Error('expected summary section');
    const block1 = summary.blocks.find((b) => b.blockId === 'blk-1');
    if (!block1) throw new Error('expected blk-1');
    expect((block1.content as { text?: string }).text).toBe(
      'Tightened paragraph one with sharper framing.'
    );
  });

  it('useLlm:true falls back to deterministic marker when LLM fails', async () => {
    generateChatResponseMock.mockRejectedValueOnce(new Error('FEATURE_UNAVAILABLE'));
    const proposal = await createLocalEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      input: {
        scope: 'local',
        sectionId: 'sec-summary',
        blockId: 'blk-1',
        instruction: 'Tighten the paragraph.',
      },
      useLlm: true,
    });
    expect(proposal.diff.after).toContain('Edited with instruction');
  });
});

describe('Editor `useLlm` integration — section scope (MVP-3 hardening)', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('stores per-block rewrites and applies them on approval', async () => {
    generateChatResponseMock
      .mockResolvedValueOnce({
        content: JSON.stringify({ text: 'Refined block one summary.' }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ text: 'Refined block two summary.' }),
      });

    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-summary',
      instruction: 'Tighten the section.',
      useLlm: true,
    });
    expect(proposal.llmRefined).toBe(true);
    expect(proposal.blockRewrites).toEqual({
      'blk-1': 'Refined block one summary.',
      'blk-2': 'Refined block two summary.',
    });

    const approved = await approveEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    const summary = approved.schema.sections.find((s) => s.sectionId === 'sec-summary');
    if (!summary) throw new Error('expected summary section');
    const texts = summary.blocks.map((b) => (b.content as { text?: string }).text);
    expect(texts).toEqual(['Refined block one summary.', 'Refined block two summary.']);

    const findings = approved.schema.sections.find((s) => s.sectionId === 'sec-findings');
    if (!findings) throw new Error('expected findings section');
    expect((findings.blocks[0].content as { text?: string }).text).toBe('Finding paragraph here.');
  });

  it('mixes LLM rewrites and deterministic fallbacks per block', async () => {
    generateChatResponseMock
      .mockResolvedValueOnce({
        content: JSON.stringify({ text: 'Refined block one only.' }),
      })
      .mockRejectedValueOnce(new Error('FEATURE_UNAVAILABLE'));

    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-summary',
      instruction: 'Tighten the section.',
      useLlm: true,
    });
    expect(proposal.llmRefined).toBe(true);
    expect(proposal.blockRewrites).toEqual({ 'blk-1': 'Refined block one only.' });

    const approved = await approveEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    const summary = approved.schema.sections.find((s) => s.sectionId === 'sec-summary');
    if (!summary) throw new Error('expected summary section');
    const block1 = summary.blocks.find((b) => b.blockId === 'blk-1');
    const block2 = summary.blocks.find((b) => b.blockId === 'blk-2');
    if (!block1 || !block2) throw new Error('expected both blocks');
    expect((block1.content as { text?: string }).text).toBe('Refined block one only.');
    expect((block2.content as { text?: string }).text).toContain('Edited with instruction');
  });

  it('falls back to deterministic when every block fails LLM rewrite', async () => {
    generateChatResponseMock.mockRejectedValue(new Error('FEATURE_UNAVAILABLE'));
    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-summary',
      instruction: 'Tighten the section.',
      useLlm: true,
    });
    expect(proposal.llmRefined).toBeUndefined();
    expect(proposal.blockRewrites).toBeUndefined();
  });
});

describe('Editor `useLlm` integration — global scope (MVP-3 hardening)', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('rewrites every editable block across all sections', async () => {
    generateChatResponseMock
      .mockResolvedValueOnce({ content: JSON.stringify({ text: 'Refined one.' }) })
      .mockResolvedValueOnce({ content: JSON.stringify({ text: 'Refined two.' }) })
      .mockResolvedValueOnce({ content: JSON.stringify({ text: 'Refined finding.' }) });

    const proposal = await createGlobalEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Standardize the tone across the document.',
      useLlm: true,
    });
    expect(proposal.llmRefined).toBe(true);
    expect(proposal.blockRewrites).toEqual({
      'blk-1': 'Refined one.',
      'blk-2': 'Refined two.',
      'blk-3': 'Refined finding.',
    });

    const approved = await approveEditProposal({
      artifactId: 'artifact-llm-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });
    const allTexts = approved.schema.sections.flatMap((s) =>
      s.blocks.map((b) => (b.content as { text?: string }).text)
    );
    expect(allTexts).toEqual(['Refined one.', 'Refined two.', 'Refined finding.']);
  });
});
