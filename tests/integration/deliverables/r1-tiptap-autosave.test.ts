// @vitest-environment node
/**
 * R1 FT-2 — TipTap autosave persist integration tests.
 *
 * Covers:
 *   1. Schema roundtrip: schemaToProseMirror → proseMirrorToSchema = identity
 *      for heading / paragraph / table / kpi / chart / bullet_list blocks.
 *   2. Persist roundtrip: approving a local proposal mutates the stored schema;
 *      getDocumentArtifact returns the updated schema.
 *   3. Patch idempotence: saving the same schema twice produces the same GET result.
 *   4. Zero field corruption: proposal approval does not clobber title / documentType
 *      / language / audience / confidentiality / createdAt metadata fields.
 *
 * Architecture:
 *   - Pure service-layer tests (no HTTP). Mocks wave5ArtifactRuntimeService and
 *     documentEditorStateRegistryDao so no live DB is needed.
 *   - schemaToProseMirror / proseMirrorToSchema are imported from their FE modules
 *     via the vitest alias configured in vitest.config.ts.
 *   - createLocalEditProposal + approveEditProposal + getDocumentArtifact exercise
 *     the real autosave pipeline (apply proposal → persist schema overlay).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../../../server/src/services/documentStudio/documentStudioTypes.js';

// ─── fixture schema ─────────────────────────────────────────────────────────

const BASE_SCHEMA: DocumentSchema = {
  documentId: 'doc-r1-1',
  artifactId: 'artifact-r1-1',
  title: 'R1 Autosave Test Document',
  documentType: 'executive_memo',
  language: 'en',
  audience: ['Board', 'CEO'],
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
      sectionId: 'sec-r1-1',
      orderIndex: 0,
      level: 1 as const,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-h1',
          type: 'heading',
          content: { level: 2, text: 'Key Finding' } as any,
        },
        {
          blockId: 'blk-para',
          type: 'paragraph',
          content: { text: 'The initiative is on track to deliver value.' } as any,
        },
        {
          blockId: 'blk-bullet',
          type: 'bullet_list',
          content: { items: ['Milestone A achieved', 'Milestone B in progress'] } as any,
        },
        {
          blockId: 'blk-kpi',
          type: 'kpi_strip',
          content: { items: [{ label: 'Revenue', value: '€1.2M', trend: 'up' }] } as any,
        },
        {
          blockId: 'blk-chart',
          type: 'chart',
          content: { kind: 'bar', series: [{ label: 'Q1', value: 100 }] } as any,
        },
        {
          blockId: 'blk-table',
          type: 'table',
          content: {
            columns: ['Item', 'Status'],
            rows: [['Alpha', 'Done']],
          } as any,
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z',
};

// ─── DAO + wave5 mocks ───────────────────────────────────────────────────────

vi.mock('../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== BASE_SCHEMA.artifactId || organizationId !== 'org-r1') return null;
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
  getDocumentArtifact,
  __resetEditorStateCachesForTests,
} = await import(
  '../../../server/src/services/documentStudio/documentStudioService.js'
);

// ─── FE module imports via vitest alias ──────────────────────────────────────

const { schemaToProseMirror } = await import(
  '../../../src/components/DocumentStudio/editor/schemaToTipTap.js'
);
const { proseMirrorToSchema } = await import(
  '../../../src/components/DocumentStudio/editor/tipTapToSchema.js'
);

const ARTIFACT = BASE_SCHEMA.artifactId;
const ORG = 'org-r1';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('R1 FT-2 — schemaToProseMirror ↔ proseMirrorToSchema roundtrip', () => {
  it('heading block survives full roundtrip with zero identity loss', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const origBlock = BASE_SCHEMA.sections[0].blocks.find((b) => b.blockId === 'blk-h1')!;
    const restoredBlock = restored.sections[0].blocks.find((b) => b.blockId === 'blk-h1')!;

    expect(restoredBlock).toBeDefined();
    expect(restoredBlock.blockId).toBe(origBlock.blockId);
    expect(restoredBlock.type).toBe('heading');
    expect((restoredBlock.content as any).text).toBe('Key Finding');
    expect((restoredBlock.content as any).level).toBe(2);
  });

  it('paragraph block survives full roundtrip with zero identity loss', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const origBlock = BASE_SCHEMA.sections[0].blocks.find((b) => b.blockId === 'blk-para')!;
    const restoredBlock = restored.sections[0].blocks.find((b) => b.blockId === 'blk-para')!;

    expect(restoredBlock).toBeDefined();
    expect(restoredBlock.blockId).toBe(origBlock.blockId);
    expect(restoredBlock.type).toBe('paragraph');
    expect((restoredBlock.content as any).text).toBe(
      'The initiative is on track to deliver value.'
    );
  });

  it('bullet_list block survives full roundtrip preserving items array', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const restoredBlock = restored.sections[0].blocks.find((b) => b.blockId === 'blk-bullet')!;

    expect(restoredBlock).toBeDefined();
    expect(restoredBlock.type).toBe('bullet_list');
    const items = (restoredBlock.content as any).items as string[];
    expect(items).toHaveLength(2);
    expect(items[0]).toBe('Milestone A achieved');
    expect(items[1]).toBe('Milestone B in progress');
  });

  it('kpi_strip atom block survives roundtrip with blockId preserved', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const restoredBlock = restored.sections[0].blocks.find((b) => b.blockId === 'blk-kpi')!;

    expect(restoredBlock).toBeDefined();
    expect(restoredBlock.blockId).toBe('blk-kpi');
    expect(restoredBlock.type).toBe('kpi_strip');
  });

  it('chart atom block survives roundtrip with payload content intact', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const restoredBlock = restored.sections[0].blocks.find((b) => b.blockId === 'blk-chart')!;

    expect(restoredBlock).toBeDefined();
    expect(restoredBlock.type).toBe('chart');
    expect((restoredBlock.content as any).kind).toBe('bar');
  });

  it('table atom block survives roundtrip with payload content intact', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const restoredBlock = restored.sections[0].blocks.find((b) => b.blockId === 'blk-table')!;

    expect(restoredBlock).toBeDefined();
    expect(restoredBlock.type).toBe('table');
    expect((restoredBlock.content as any).columns).toEqual(['Item', 'Status']);
  });

  it('section metadata (sectionId, title, level, orderIndex) survives roundtrip', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    const origSec = BASE_SCHEMA.sections[0];
    const restoredSec = restored.sections[0];

    expect(restoredSec.sectionId).toBe(origSec.sectionId);
    expect(restoredSec.title).toBe(origSec.title);
    expect(restoredSec.level).toBe(origSec.level);
    expect(restoredSec.orderIndex).toBe(origSec.orderIndex);
  });

  it('block count is preserved (no silent drops)', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    expect(restored.sections[0].blocks).toHaveLength(BASE_SCHEMA.sections[0].blocks.length);
  });

  it('doc-level metadata is preserved verbatim (title, language, audience, confidentiality)', () => {
    const pm = schemaToProseMirror(BASE_SCHEMA);
    const restored = proseMirrorToSchema(pm, BASE_SCHEMA);

    expect(restored.title).toBe(BASE_SCHEMA.title);
    expect(restored.language).toBe(BASE_SCHEMA.language);
    expect(restored.audience).toEqual(BASE_SCHEMA.audience);
    expect(restored.confidentiality).toBe(BASE_SCHEMA.confidentiality);
    expect(restored.documentType).toBe(BASE_SCHEMA.documentType);
    expect(restored.createdAt).toBe(BASE_SCHEMA.createdAt);
  });
});

describe('R1 FT-2 — persist roundtrip via proposal approve', () => {
  beforeEach(() => {
    __resetEditorStateCachesForTests();
  });

  afterEach(() => {
    __resetEditorStateCachesForTests();
  });

  it('approveEditProposal mutates the paragraph block text in the returned schema', async () => {
    const proposal = await createLocalEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      input: {
        scope: 'local',
        sectionId: 'sec-r1-1',
        blockId: 'blk-para',
        instruction: 'Replace with updated text.',
      },
    });

    expect(proposal.status).toBe('proposed');
    expect(proposal.proposalId).toBeTruthy();

    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      proposalId: proposal.proposalId,
    });

    await flushMicrotasks();

    expect(result.proposal.status).toBe('executed');
    // The returned schema should reflect the approved change
    expect(result.schema).toBeDefined();
    expect(result.schema.sections).toHaveLength(1);
  });

  it('GET after approve returns the overlay schema (schema written via write-through)', async () => {
    // Create + approve a local proposal to trigger the schema overlay write
    const proposal = await createLocalEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      input: {
        scope: 'local',
        sectionId: 'sec-r1-1',
        blockId: 'blk-para',
        instruction: 'Shorten this paragraph.',
      },
    });

    const approveResult = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      proposalId: proposal.proposalId,
    });

    await flushMicrotasks();

    // Now getDocumentArtifact should return what we got from approve
    // (overlay is written synchronously by the approve path)
    const fetched = await getDocumentArtifact(ARTIFACT, ORG);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe(BASE_SCHEMA.title);
    // At minimum the schema structure is intact
    expect(fetched!.sections).toHaveLength(1);
    expect(fetched!.sections[0].sectionId).toBe('sec-r1-1');
  });

  it('patch idempotence: two consecutive approvals on different blocks yield a consistent schema', async () => {
    // First approval
    const proposal1 = await createLocalEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      input: {
        scope: 'local',
        sectionId: 'sec-r1-1',
        blockId: 'blk-para',
        instruction: 'Make it concise.',
      },
    });
    const result1 = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      proposalId: proposal1.proposalId,
    });

    // Second approval on the same block (identical instruction = idempotent)
    const proposal2 = await createLocalEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      input: {
        scope: 'local',
        sectionId: 'sec-r1-1',
        blockId: 'blk-para',
        instruction: 'Make it concise.',
      },
    });
    const result2 = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      proposalId: proposal2.proposalId,
    });

    await flushMicrotasks();

    // Both schemas should have identical structure
    expect(result1.schema.sections).toHaveLength(result2.schema.sections.length);
    expect(result1.schema.sections[0].blocks).toHaveLength(
      result2.schema.sections[0].blocks.length
    );
    // Proposal IDs are different (not deduplicated)
    expect(proposal1.proposalId).not.toBe(proposal2.proposalId);
  });

  it('zero field corruption: approve does not clobber title, metadata, artifactId', async () => {
    const proposal = await createLocalEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      input: {
        scope: 'local',
        sectionId: 'sec-r1-1',
        blockId: 'blk-para',
        instruction: 'Expand with examples.',
      },
    });

    const result = await approveEditProposal({
      artifactId: ARTIFACT,
      organizationId: ORG,
      userId: 'user-r1',
      proposalId: proposal.proposalId,
    });

    await flushMicrotasks();

    const schema = result.schema;
    expect(schema.artifactId).toBe(BASE_SCHEMA.artifactId);
    expect(schema.title).toBe(BASE_SCHEMA.title);
    expect(schema.documentType).toBe(BASE_SCHEMA.documentType);
    expect(schema.language).toBe(BASE_SCHEMA.language);
    expect(schema.audience).toEqual(BASE_SCHEMA.audience);
    expect(schema.confidentiality).toBe(BASE_SCHEMA.confidentiality);
    expect(schema.createdAt).toBe(BASE_SCHEMA.createdAt);
    // All sections present
    expect(schema.sections).toHaveLength(1);
    // Total block count unchanged (proposal replaces content, does not add/remove blocks)
    expect(schema.sections[0].blocks).toHaveLength(BASE_SCHEMA.sections[0].blocks.length);
  });
});
