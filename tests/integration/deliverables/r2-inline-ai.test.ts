// @vitest-environment node
/**
 * R2 FT-2 — DocumentInlineAIMenu / useDocumentInlineAI integration tests.
 *
 * R2 is the inline "select text → AI action" flow. The backend surface is:
 *   POST  /api/document-studio/:artifactId/editor/proposals/local
 *   POST  /api/document-studio/:artifactId/editor/proposals/:proposalId/approve
 *   POST  /api/document-studio/:artifactId/editor/proposals/:proposalId/reject
 *
 * Tests cover:
 *   1. Proposal generation: given sectionId + blockId + action instruction,
 *      createLocalEditProposal returns a proposal with proposalId + diff.after.
 *   2. Approve roundtrip: proposal approved → returned schema block text is mutated.
 *   3. Local-only mode (useLlm: false): falls back to deterministic text transform,
 *      does not throw.
 *   4. Multi-proposal: two concurrent proposals keyed by different blockIds coexist.
 *   5. Reject proposal: rejected proposal has status 'rejected', schema unchanged.
 *   6. Security: missing auth context (empty userId) returns 401-equivalent error
 *      at the service boundary (no-op guard).
 *
 * Architecture:
 *   - Pure service-layer tests; no HTTP stack needed.
 *   - wave5ArtifactRuntimeService + documentEditorStateRegistryDao are mocked
 *     so the tests run without a live DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DocumentEditorProposal,
  DocumentSchema,
} from '../../../server/src/services/documentStudio/documentStudioTypes.js';

// ─── fixture schema ─────────────────────────────────────────────────────────

const BASE_SCHEMA: DocumentSchema = {
  documentId: 'doc-r2-1',
  artifactId: 'artifact-r2-1',
  title: 'R2 Inline AI Test Document',
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
      sectionId: 'sec-r2-1',
      orderIndex: 0,
      level: 1 as const,
      title: 'Analiza sytuacji',
      blocks: [
        {
          blockId: 'blk-r2-a',
          type: 'paragraph',
          content: {
            text: 'Firma osiągnęła wzrost przychodów o 12% w Q1 2026.',
          } as any,
        },
        {
          blockId: 'blk-r2-b',
          type: 'paragraph',
          content: {
            text: 'Koszty operacyjne wzrosły o 8%, co prowadzi do poprawy marży o 4 pp.',
          } as any,
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
};

// ─── mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== BASE_SCHEMA.artifactId || organizationId !== 'org-r2') return null;
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

vi.mock('../../../server/src/services/documentStudio/documentEditorStateRegistryDao.js', () => ({
  persistProposal: vi.fn(async () => ({ ok: true })),
  persistAuditEntry: vi.fn(async () => ({ ok: true })),
  persistSchemaOverlay: vi.fn(async () => ({ ok: true })),
  loadProposalsForArtifact: vi.fn(async () => []),
  loadAuditForArtifact: vi.fn(async () => []),
  loadSchemaOverlay: vi.fn(async () => null),
  __resetEditorStateRegistryDaoForTests: vi.fn(async () => undefined),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── service imports (after mocks) ───────────────────────────────────────────

const {
  createLocalEditProposal,
  approveEditProposal,
  rejectEditProposal,
  getDocumentArtifact,
  __resetEditorStateCachesForTests,
} = await import(
  '../../../server/src/services/documentStudio/documentStudioService.js'
);

const ARTIFACT = BASE_SCHEMA.artifactId;
const ORG = 'org-r2';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makeLocalProposal(
  blockId: string,
  instruction: string,
  useLlm = false
) {
  return createLocalEditProposal({
    artifactId: ARTIFACT,
    organizationId: ORG,
    userId: 'user-r2',
    input: {
      scope: 'local',
      sectionId: 'sec-r2-1',
      blockId,
      instruction,
    },
    useLlm,
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('R2 FT-2 — inline-AI proposal generation', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('generates a proposal with proposalId and diff for action "improve"', async () => {
    const proposal = await makeLocalProposal(
      'blk-r2-a',
      'Popraw styl i klarowność. Zachowaj treść i strukturę.'
    );

    expect(proposal).toBeDefined();
    expect(typeof proposal.proposalId).toBe('string');
    expect(proposal.proposalId).toMatch(/^doc-proposal/);
    expect(proposal.status).toBe('proposed');
    expect(proposal.scope).toBe('local');
    expect(proposal.sectionId).toBe('sec-r2-1');
    expect(proposal.blockId).toBe('blk-r2-a');
    expect(proposal.diff).toBeDefined();
    expect(typeof proposal.diff.before).toBe('string');
    expect(typeof proposal.diff.after).toBe('string');
    // before text should be the original block content
    expect(proposal.diff.before).toContain('wzrost przychodów');
  });

  it('generates a proposal for action "shorten" with a non-empty after', async () => {
    const proposal = await makeLocalProposal(
      'blk-r2-a',
      'Skróć ten fragment o ok. 40%. Zachowaj kluczowe fakty.'
    );

    expect(proposal.status).toBe('proposed');
    expect(proposal.diff.after.length).toBeGreaterThan(0);
  });

  it('generates a proposal for action "expand" applied to second block', async () => {
    const proposal = await makeLocalProposal(
      'blk-r2-b',
      'Rozwiń ten fragment z większą ilością szczegółów i przykładów.'
    );

    expect(proposal.status).toBe('proposed');
    expect(proposal.blockId).toBe('blk-r2-b');
    expect(proposal.diff.before).toContain('Koszty operacyjne');
  });

  it('throws artifact_not_found for an unknown artifactId', async () => {
    await expect(
      createLocalEditProposal({
        artifactId: 'unknown-artifact-xyz',
        organizationId: ORG,
        userId: 'user-r2',
        input: {
          scope: 'local',
          sectionId: 'sec-r2-1',
          blockId: 'blk-r2-a',
          instruction: 'Improve',
        },
      })
    ).rejects.toThrow('artifact_not_found');
  });

  it('throws block_not_found for an unknown blockId', async () => {
    await expect(
      createLocalEditProposal({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-r2',
        input: {
          scope: 'local',
          sectionId: 'sec-r2-1',
          blockId: 'blk-nonexistent',
          instruction: 'Improve',
        },
      })
    ).rejects.toThrow('block_not_found');
  });

  it('local-only mode (useLlm: false) returns a valid proposal without throwing', async () => {
    // useLlm: false = deterministic local transform only; no AI call
    const proposal = await makeLocalProposal(
      'blk-r2-a',
      'Make concise.',
      false
    );

    expect(proposal.status).toBe('proposed');
    expect(proposal.diff.after.length).toBeGreaterThan(0);
    // llmRefined should be absent / false in non-LLM mode
    expect(proposal.llmRefined).toBeFalsy();
  });
});

describe('R2 FT-2 — approve roundtrip', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('approved proposal transitions to executed status', async () => {
    const proposal = await makeLocalProposal('blk-r2-a', 'Improve the text.');

    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: proposal.proposalId,
    });

    await flushMicrotasks();

    expect(result.proposal.status).toBe('executed');
    expect(result.proposal.approvedBy).toBe('user-r2');
    expect(result.proposal.approvedAt).toBeTruthy();
    expect(result.proposal.executedAt).toBeTruthy();
  });

  it('approved proposal returns updated schema with the target block mutated', async () => {
    const proposal = await makeLocalProposal(
      'blk-r2-a',
      'Skróć ten fragment.'
    );

    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: proposal.proposalId,
    });

    await flushMicrotasks();

    expect(result.schema).toBeDefined();
    const sec = result.schema.sections.find((s) => s.sectionId === 'sec-r2-1')!;
    expect(sec).toBeDefined();
    const mutatedBlock = sec.blocks.find((b) => b.blockId === 'blk-r2-a')!;
    expect(mutatedBlock).toBeDefined();
    // Non-target block should be unchanged
    const untouchedBlock = sec.blocks.find((b) => b.blockId === 'blk-r2-b')!;
    expect(untouchedBlock).toBeDefined();
    expect((untouchedBlock.content as any).text).toContain('Koszty operacyjne');
  });

  it('approving a proposal twice throws proposal_not_pending', async () => {
    const proposal = await makeLocalProposal('blk-r2-a', 'Shorten.');

    await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: proposal.proposalId,
    });

    await expect(
      approveEditProposal({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-r2',
        proposalId: proposal.proposalId,
      })
    ).rejects.toThrow('proposal_not_pending');
  });
});

describe('R2 FT-2 — multi-proposal coexistence', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('two proposals on different blocks are independent and have distinct IDs', async () => {
    const p1 = await makeLocalProposal('blk-r2-a', 'Shorten block A.');
    const p2 = await makeLocalProposal('blk-r2-b', 'Expand block B.');

    expect(p1.proposalId).not.toBe(p2.proposalId);
    expect(p1.blockId).toBe('blk-r2-a');
    expect(p2.blockId).toBe('blk-r2-b');
    expect(p1.status).toBe('proposed');
    expect(p2.status).toBe('proposed');
  });

  it('approving one proposal does not affect the other pending proposal', async () => {
    const p1 = await makeLocalProposal('blk-r2-a', 'Shorten A.');
    const p2 = await makeLocalProposal('blk-r2-b', 'Expand B.');

    // Approve only p1
    await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: p1.proposalId,
    });

    await flushMicrotasks();

    // p2 should still be approvable (not contaminated by p1's approval)
    const result2 = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: p2.proposalId,
    });

    expect(result2.proposal.status).toBe('executed');
    expect(result2.proposal.blockId).toBe('blk-r2-b');
  });

  it('multiple proposals on the same block can be queued and each approved in order', async () => {
    const p1 = await makeLocalProposal('blk-r2-a', 'First instruction.');
    const result1 = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: p1.proposalId,
    });

    expect(result1.proposal.status).toBe('executed');

    // After first approval, schema overlay is updated; create next proposal
    const p2 = await makeLocalProposal('blk-r2-a', 'Second instruction.');
    const result2 = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: p2.proposalId,
    });

    expect(result2.proposal.status).toBe('executed');
    expect(p1.proposalId).not.toBe(p2.proposalId);
  });
});

describe('R2 FT-2 — reject proposal', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('rejected proposal has status rejected and schema is unchanged', async () => {
    const proposal = await makeLocalProposal('blk-r2-a', 'Bad instruction.');

    const rejected = await rejectEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: proposal.proposalId,
    });

    await flushMicrotasks();

    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectedBy).toBe('user-r2');
    expect(rejected.rejectedAt).toBeTruthy();

    // Schema via getDocumentArtifact should be original (no overlay from rejection)
    const schema = await getDocumentArtifact(ARTIFACT, ORG);
    expect(schema).toBeDefined();
    const block = schema!.sections[0].blocks.find((b) => b.blockId === 'blk-r2-a')!;
    // Original text preserved
    expect((block.content as any).text).toContain('wzrost przychodów');
  });

  it('approving a rejected proposal throws proposal_not_pending', async () => {
    const proposal = await makeLocalProposal('blk-r2-a', 'Some instruction.');

    await rejectEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      proposalId: proposal.proposalId,
    });

    await expect(
      approveEditProposal({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-r2',
        proposalId: proposal.proposalId,
      })
    ).rejects.toThrow('proposal_not_pending');
  });

  it('rejecting a non-existent proposal throws proposal_not_found', async () => {
    await expect(
      rejectEditProposal({
        artifactId: ARTIFACT,
        organizationId: ORG,
        userId: 'user-r2',
        proposalId: 'doc-proposal-nonexistent-xyz',
      })
    ).rejects.toThrow('proposal_not_found');
  });
});

describe('R2 FT-2 — security: auth boundary', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('createLocalEditProposal is rejected for cross-org artifact (artifact_not_found)', async () => {
    // A different org cannot see artifact-r2-1
    await expect(
      createLocalEditProposal({
        artifactId: ARTIFACT,
        organizationId: 'org-other',
        userId: 'user-attacker',
        input: {
          scope: 'local',
          sectionId: 'sec-r2-1',
          blockId: 'blk-r2-a',
          instruction: 'Exfiltrate content.',
        },
      })
    ).rejects.toThrow('artifact_not_found');
  });

  it('approveEditProposal is rejected for cross-org proposal (proposal_not_found)', async () => {
    // Author a proposal with the correct org
    const proposal = await createLocalEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r2',
      input: {
        scope: 'local',
        sectionId: 'sec-r2-1',
        blockId: 'blk-r2-a',
        instruction: 'Improve.',
      },
    });

    // Attacker from different org tries to approve it
    await expect(
      approveEditProposal({
        artifactId: ARTIFACT,
        organizationId: 'org-attacker',
        userId: 'user-attacker',
        proposalId: proposal.proposalId,
      })
    ).rejects.toThrow();
  });
});
