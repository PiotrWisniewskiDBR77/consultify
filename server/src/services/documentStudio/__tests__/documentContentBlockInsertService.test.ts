import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-insert-1',
    artifactId: 'artifact-insert-1',
    title: 'Content insert test',
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
        sectionId: 'section-1',
        orderIndex: 0,
        level: 1,
        title: 'Executive summary',
        blocks: [{ blockId: 'block-1', type: 'paragraph', content: { text: 'Before' } }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('Document Studio — durable content block insert', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('inserts an instantiated content block into the live schema with snapshot and audit read-back', async () => {
    const schema = makeSchema();
    vi.doMock('../../wave5ArtifactRuntimeService.js', () => ({
      buildWave5ExportManifest: vi.fn(async () => ({})),
      createWave5Artifact: vi.fn(async () => ({ artifactId: schema.artifactId })),
      getWave5Artifact: vi.fn(async () => ({
        artifactId: schema.artifactId,
        metadata: { documentStudioSchema: schema },
      })),
      markWave5ArtifactExported: vi.fn(async () => null),
    }));

    const { draftDocumentContentBlock } = await import('../documentContentBlockService.js');
    const {
      __resetSchemaOverlayForTests,
      getDocumentArtifact,
      insertDocumentContentBlock,
      listDocumentAuditEntries,
    } = await import('../documentStudioService.js');
    const { __resetDocumentVersionSnapshotsForTests } =
      await import('../documentVersionSnapshotService.js');

    __resetSchemaOverlayForTests();
    __resetDocumentVersionSnapshotsForTests();

    const template = draftDocumentContentBlock({
      organizationId: 'org-1',
      userId: 'user-1',
      input: {
        name: 'Reusable intro',
        block: { type: 'paragraph', content: { text: 'Reusable text' } },
      },
    });

    const result = await insertDocumentContentBlock({
      organizationId: 'org-1',
      artifactId: schema.artifactId,
      userId: 'user-2',
      contentBlockId: template.contentBlockId,
      sectionId: 'section-1',
    });

    expect(result.insertedBlock.blockId).toMatch(/^block-/);
    expect(result.schema.sections[0].blocks.map((block) => block.blockId)).toEqual([
      'block-1',
      result.insertedBlock.blockId,
    ]);
    expect(result.snapshot.versionNumber).toBe(1);

    const readBack = await getDocumentArtifact(schema.artifactId, 'org-1');
    expect(readBack?.sections[0].blocks).toHaveLength(2);

    const audit = listDocumentAuditEntries(schema.artifactId, 'org-1');
    expect(audit.map((entry) => entry.action)).toContain('content_block_inserted');
    expect(audit.map((entry) => entry.action)).toContain('document_version_snapshot_created');
  });
});
