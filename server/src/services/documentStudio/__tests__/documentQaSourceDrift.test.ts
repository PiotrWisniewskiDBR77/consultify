/**
 * Document Studio — Source-drift QA tests (Slice E5.6.qa).
 *
 * Verifies the 11th QA category added in slice E5.6.qa on top of the
 * NFR-17 pinning substrate from E5.6.
 *
 * Contract:
 *   - clean: every sourceRef carries a `sourceVersion` OR
 *     `sourceSnapshotId` → no findings, score 100;
 *   - clean (no sources): a document with zero source refs collapses
 *     to no findings (the `sources` category handles "no citations"
 *     separately; source-drift is silent in that case);
 *   - drift detection: each unpinned ref produces exactly one
 *     `source_drift_unpinned` finding at `low` severity;
 *   - location plumbing: findings correctly carry sectionId / blockId
 *     when the unpinned ref lives on a section or block;
 *   - whitespace-only `sourceVersion` / `sourceSnapshotId` is treated
 *     as unpinned (mirrors the helper contract from E5.6);
 *   - the category is NEVER blocking — even a document with many
 *     unpinned refs must export. NFR-17 is advisory until the
 *     registry-side hard-drift comparator lands.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-drift-1',
    artifactId: 'artifact-drift-1',
    title: 'Source Drift Test Document',
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
    sections: [],
    sourceRefs: [],
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

function getDriftCategory(schema: DocumentSchema) {
  const report = runDocumentQa(schema);
  const drift = report.categories.find((c) => c.category === 'source_drift');
  if (!drift) {
    throw new Error('source_drift category missing from runDocumentQa report');
  }
  return drift;
}

describe('Source-drift QA — clean cases (Slice E5.6.qa)', () => {
  it('document with zero source refs is silent (no findings)', () => {
    const drift = getDriftCategory(makeSchema());
    expect(drift.findings).toHaveLength(0);
    expect(drift.score).toBe(100);
    expect(drift.blocking).toBe(false);
  });

  it('all refs pinned via sourceVersion → no findings', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [
          { sourceType: 'transcript', sourceId: 't-1', sourceVersion: 'v1' },
          { sourceType: 'document', sourceId: 'd-7', sourceVersion: '3.2.0' },
        ],
      })
    );
    expect(drift.findings).toHaveLength(0);
    expect(drift.score).toBe(100);
  });

  it('all refs pinned via sourceSnapshotId → no findings', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [
          { sourceType: 'sourcepack', sourceId: 'sp-1', sourceSnapshotId: 'snap_abc' },
        ],
        sections: [
          {
            sectionId: 'sec-1',
            orderIndex: 0,
            level: 1,
            title: 'Findings',
            blocks: [
              {
                blockId: 'blk-1',
                type: 'paragraph',
                content: { text: 'Anchored finding.' } as unknown,
                sourceRef: {
                  sourceType: 'transcript',
                  sourceId: 't-1',
                  sourceSnapshotId: 'snap_xyz',
                },
              },
            ],
            sourceRefs: [
              { sourceType: 'transcript', sourceId: 't-1', sourceSnapshotId: 'snap_xyz' },
            ],
          },
        ],
      })
    );
    expect(drift.findings).toHaveLength(0);
  });

  it('mixed pinning (version + snapshot) is also clean', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [
          { sourceType: 'document', sourceId: 'd-1', sourceVersion: 'v1' },
          { sourceType: 'sourcepack', sourceId: 'sp-2', sourceSnapshotId: 'snap_def' },
        ],
      })
    );
    expect(drift.findings).toHaveLength(0);
  });
});

describe('Source-drift QA — drift detection (Slice E5.6.qa)', () => {
  it('detects an unpinned document-level ref', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [{ sourceType: 'transcript', sourceId: 't-1' }],
      })
    );
    expect(drift.findings).toHaveLength(1);
    expect(drift.findings[0].code).toBe('source_drift_unpinned');
    expect(drift.findings[0].severity).toBe('low');
    expect(drift.findings[0].sectionId).toBeUndefined();
    expect(drift.findings[0].blockId).toBeUndefined();
  });

  it('detects an unpinned section-level ref and propagates sectionId', () => {
    const drift = getDriftCategory(
      makeSchema({
        sections: [
          {
            sectionId: 'sec-7',
            orderIndex: 0,
            level: 1,
            title: 'Findings',
            blocks: [],
            sourceRefs: [{ sourceType: 'document', sourceId: 'd-1' }],
          },
        ],
      })
    );
    expect(drift.findings).toHaveLength(1);
    expect(drift.findings[0].sectionId).toBe('sec-7');
    expect(drift.findings[0].blockId).toBeUndefined();
  });

  it('detects an unpinned block-level ref and propagates sectionId + blockId', () => {
    const drift = getDriftCategory(
      makeSchema({
        sections: [
          {
            sectionId: 'sec-7',
            orderIndex: 0,
            level: 1,
            title: 'Findings',
            blocks: [
              {
                blockId: 'blk-42',
                type: 'paragraph',
                content: { text: 'Anchored to a transcript.' } as unknown,
                sourceRef: { sourceType: 'transcript', sourceId: 't-99' },
              },
            ],
            sourceRefs: [],
          },
        ],
      })
    );
    expect(drift.findings).toHaveLength(1);
    expect(drift.findings[0].sectionId).toBe('sec-7');
    expect(drift.findings[0].blockId).toBe('blk-42');
  });

  it('counts every unpinned ref independently across all three scopes', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [{ sourceType: 'transcript', sourceId: 't-doc' }], // doc-level: 1
        sections: [
          {
            sectionId: 'sec-1',
            orderIndex: 0,
            level: 1,
            title: 'A',
            blocks: [
              {
                blockId: 'blk-A',
                type: 'paragraph',
                content: { text: 'A.' } as unknown,
                sourceRef: { sourceType: 'transcript', sourceId: 't-A' }, // block-level: +1
              },
              {
                blockId: 'blk-B',
                type: 'paragraph',
                content: { text: 'B.' } as unknown,
                sourceRef: {
                  sourceType: 'transcript',
                  sourceId: 't-B',
                  sourceVersion: 'v1', // pinned → not counted
                },
              },
            ],
            sourceRefs: [
              { sourceType: 'document', sourceId: 'd-1' }, // section-level: +1
              { sourceType: 'document', sourceId: 'd-2', sourceSnapshotId: 'snap_x' }, // pinned
            ],
          },
        ],
      })
    );
    expect(drift.findings).toHaveLength(3);
    expect(drift.findings.every((f) => f.code === 'source_drift_unpinned')).toBe(true);
  });

  it('treats whitespace-only sourceVersion / sourceSnapshotId as unpinned', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [
          { sourceType: 'transcript', sourceId: 't-1', sourceVersion: '   ' },
          { sourceType: 'document', sourceId: 'd-1', sourceSnapshotId: '   ' },
        ],
      })
    );
    expect(drift.findings).toHaveLength(2);
  });

  it('mentions the source title or sourceType:sourceId in the finding message', () => {
    const drift = getDriftCategory(
      makeSchema({
        sourceRefs: [
          {
            sourceType: 'transcript',
            sourceId: 't-1',
            sourceTitle: 'Q2 Board Minutes',
          },
          { sourceType: 'document', sourceId: 'd-99' },
        ],
      })
    );
    expect(drift.findings).toHaveLength(2);
    expect(drift.findings[0].message).toContain('"Q2 Board Minutes"');
    expect(drift.findings[1].message).toContain('document:d-99');
  });
});

describe('Source-drift QA — non-blocking guarantee (Slice E5.6.qa)', () => {
  it('a document with many unpinned refs is NEVER blocking', () => {
    const refs = Array.from({ length: 20 }, (_, i) => ({
      sourceType: 'document',
      sourceId: `d-${i}`,
    }));
    const drift = getDriftCategory(makeSchema({ sourceRefs: refs }));
    expect(drift.findings.length).toBeGreaterThan(10);
    expect(drift.blocking).toBe(false);
  });

  it('the overall report cannot be soft-blocked solely by source_drift findings', () => {
    const refs = Array.from({ length: 10 }, (_, i) => ({
      sourceType: 'document',
      sourceId: `d-${i}`,
    }));
    const report = runDocumentQa(makeSchema({ sourceRefs: refs }));
    const driftCategory = report.categories.find((c) => c.category === 'source_drift');
    expect(driftCategory?.blocking).toBe(false);
    // Other categories may or may not be blocking on this synthetic
    // schema (no template + no content); the assertion that matters is
    // that source_drift specifically does not contribute to anyBlocking.
    const anyBlockingExceptDrift = report.categories
      .filter((c) => c.category !== 'source_drift')
      .some((c) => c.blocking);
    expect(report.anyBlocking).toBe(anyBlockingExceptDrift);
  });
});
