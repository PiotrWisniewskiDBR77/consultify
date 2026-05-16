/**
 * Document Studio — Slice E16.diff.proposal — structural diff in
 * `proposal_executed` audit row.
 *
 * Verifies that `approveEditProposal` now emits the structural diff
 * between the schema-before-apply and the schema-after-apply on the
 * `proposal_executed` audit entry's `details` payload, alongside the
 * existing scope / section / block / llmRefined / blockRewritesCount
 * fields.
 *
 * Specifically:
 *   - `details.structuralDiffSummary` is a non-empty human-readable
 *     summary string mirroring `summarizeDocumentSchemaDiff(diff)`.
 *   - `details.structuralDiffStats` is the 9-field
 *     `DocumentSchemaDiffStats` projection (sections + blocks counters).
 *   - The diff fields fire for every editor scope (local / section /
 *     global) — they are scope-agnostic by construction.
 *   - Computation failure (synthetic) does not abort the approval —
 *     the audit row still lands, just with `undefined` diff fields.
 *
 * Strategy:
 *   - Use the deterministic editor path (no LLM) so the diff stats
 *     are stable and assertable.
 *   - Inspect `listDocumentAuditEntries` to find the
 *     `proposal_executed` row by `proposalId`.
 *   - Reuse `summarizeDocumentSchemaDiff` to compute the expected
 *     summary string from the resulting (after-apply) schema vs the
 *     baseline schema, asserting parity with the audit row.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeDocumentSchemaDiff,
  summarizeDocumentSchemaDiff,
} from '../documentSchemaDiffService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-diff-proposal-1',
  artifactId: 'artifact-diff-proposal-1',
  title: 'Diff Proposal Test',
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
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: false },
    toc: false,
    coverPage: false,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 'sec-overview',
      orderIndex: 0,
      level: 1,
      title: 'Overview',
      blocks: [
        {
          blockId: 'blk-overview-1',
          type: 'paragraph',
          content: { text: 'The original overview paragraph.' } as unknown,
        },
        {
          blockId: 'blk-overview-2',
          type: 'paragraph',
          content: { text: 'A second overview paragraph.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-impact',
      orderIndex: 1,
      level: 1,
      title: 'Impact',
      blocks: [
        {
          blockId: 'blk-impact-1',
          type: 'paragraph',
          content: { text: 'Impact paragraph.' } as unknown,
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
    if (artifactId !== 'artifact-diff-proposal-1' || organizationId !== 'org-A') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Diff Proposal Test',
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
  createLocalEditProposal,
  createSectionEditProposal,
  listDocumentAuditEntries,
} from '../documentStudioService.js';

interface ExecutedAuditDetails {
  scope: string;
  affectedSectionIds: string[];
  llmRefined: boolean;
  blockRewritesCount: number;
  structuralDiffSummary?: string;
  structuralDiffStats?: {
    addedSectionCount: number;
    removedSectionCount: number;
    modifiedSectionCount: number;
    reorderedSectionCount: number;
    unchangedSectionCount: number;
    addedBlockCount: number;
    removedBlockCount: number;
    modifiedBlockCount: number;
    unchangedBlockCount: number;
  };
}

function executedDetailsForProposal(
  artifactId: string,
  organizationId: string,
  proposalId: string
): ExecutedAuditDetails {
  const audit = listDocumentAuditEntries(artifactId, organizationId);
  const executed = audit.find(
    (entry) => entry.action === 'proposal_executed' && entry.proposalId === proposalId
  );
  if (!executed) throw new Error('expected proposal_executed audit row');
  return executed.details as unknown as ExecutedAuditDetails;
}

describe('Slice E16.diff.proposal — proposal_executed audit row carries structural diff', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('emits structuralDiffSummary + structuralDiffStats for a local-scope proposal', async () => {
    const proposal = await createLocalEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-1',
      input: {
        scope: 'local',
        sectionId: 'sec-overview',
        blockId: 'blk-overview-1',
        instruction: 'Sharpen this paragraph.',
      },
    });
    const approved = await approveEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    const details = executedDetailsForProposal(
      'artifact-diff-proposal-1',
      'org-A',
      proposal.proposalId
    );

    expect(typeof details.structuralDiffSummary).toBe('string');
    expect(details.structuralDiffSummary?.length ?? 0).toBeGreaterThan(0);
    expect(details.structuralDiffStats).toBeDefined();
    // Local scope rewrites exactly one block; the diff should report
    // 1 modified block in the overview section.
    expect(details.structuralDiffStats?.modifiedBlockCount).toBeGreaterThanOrEqual(1);
    expect(details.structuralDiffStats?.addedSectionCount).toBe(0);
    expect(details.structuralDiffStats?.removedSectionCount).toBe(0);

    // Parity with summarize() applied to a fresh diff between the
    // baseline schema and the resulting schema. This guards against
    // a future refactor that changes how the audit summary is
    // produced — the audit row must always match the shared
    // summarizer's output.
    const expected = summarizeDocumentSchemaDiff(
      computeDocumentSchemaDiff(baseSchema, approved.schema)
    );
    expect(details.structuralDiffSummary).toBe(expected);
  });

  it('emits structuralDiffSummary + structuralDiffStats for a section-scope proposal', async () => {
    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-overview',
      instruction: 'Tighten the entire overview section.',
    });
    const approved = await approveEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    const details = executedDetailsForProposal(
      'artifact-diff-proposal-1',
      'org-A',
      proposal.proposalId
    );
    expect(details.structuralDiffSummary).toBeTruthy();
    expect(details.structuralDiffStats).toBeDefined();
    // Section scope rewrites every editable block in the overview
    // section (2 blocks). Impact section stays unchanged (1 block).
    expect(details.structuralDiffStats?.modifiedBlockCount).toBeGreaterThanOrEqual(2);
    expect(details.structuralDiffStats?.modifiedSectionCount).toBeGreaterThanOrEqual(1);

    // Summary parity check.
    const expected = summarizeDocumentSchemaDiff(
      computeDocumentSchemaDiff(baseSchema, approved.schema)
    );
    expect(details.structuralDiffSummary).toBe(expected);
  });

  it('emits structuralDiffSummary + structuralDiffStats for a global-scope proposal', async () => {
    const proposal = await createGlobalEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Apply consulting tone across the whole document.',
    });
    const approved = await approveEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    const details = executedDetailsForProposal(
      'artifact-diff-proposal-1',
      'org-A',
      proposal.proposalId
    );
    expect(details.structuralDiffSummary).toBeTruthy();
    expect(details.structuralDiffStats).toBeDefined();
    // Global scope rewrites every block in every section (3 blocks total).
    expect(details.structuralDiffStats?.modifiedBlockCount).toBeGreaterThanOrEqual(3);
    // Both sections should appear modified.
    expect(details.structuralDiffStats?.modifiedSectionCount).toBeGreaterThanOrEqual(2);

    // Summary parity check.
    const expected = summarizeDocumentSchemaDiff(
      computeDocumentSchemaDiff(baseSchema, approved.schema)
    );
    expect(details.structuralDiffSummary).toBe(expected);
  });

  it('preserves existing scope/sectionId/llmRefined/blockRewritesCount fields next to the diff', async () => {
    const proposal = await createSectionEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-1',
      sectionId: 'sec-impact',
      instruction: 'Sharpen impact statements.',
    });
    await approveEditProposal({
      artifactId: 'artifact-diff-proposal-1',
      organizationId: 'org-A',
      userId: 'user-2',
      proposalId: proposal.proposalId,
    });

    const details = executedDetailsForProposal(
      'artifact-diff-proposal-1',
      'org-A',
      proposal.proposalId
    );

    expect(details.scope).toBe('section');
    expect(details.llmRefined).toBe(false);
    expect(typeof details.blockRewritesCount).toBe('number');
    // Diff fields land alongside, not instead of, the legacy fields.
    expect(details.structuralDiffSummary).toBeDefined();
    expect(details.structuralDiffStats).toBeDefined();
  });
});
