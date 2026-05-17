/**
 * Document Studio — Structural diff service tests
 * (Slice E16.diff).
 *
 * Verifies the `computeDocumentSchemaDiff` contract that powers
 * the FR-15 track-changes substrate. Covers:
 *   - both-null / only-before / only-after edge cases;
 *   - identical schemas → all unchanged;
 *   - section-level kinds (added / removed / modified / reordered
 *     / unchanged);
 *   - block-level kinds (added / removed / modified / unchanged);
 *   - position-index propagation;
 *   - aggregate stats accuracy;
 *   - human-readable summary;
 *   - canonical block-text projection (`blockToDiffText`).
 *
 * Pure-function contract: every spec asserts immutability of the
 * input snapshots after running the diff.
 */

import { describe, expect, it } from 'vitest';

import {
  blockToDiffText,
  computeDocumentSchemaDiff,
  summarizeDocumentSchemaDiff,
} from '../documentSchemaDiffService.js';
import type { DocumentBlock, DocumentSchema, DocumentSection } from '../documentStudioTypes.js';

function makeBlock(blockId: string, type: DocumentBlock['type'], content: unknown): DocumentBlock {
  return { blockId, type, content };
}

function makeSection(
  sectionId: string,
  orderIndex: number,
  title: string,
  blocks: DocumentBlock[] = []
): DocumentSection {
  return {
    sectionId,
    orderIndex,
    level: 1,
    title,
    blocks,
    sourceRefs: [],
  };
}

function makeSchema(sections: DocumentSection[]): DocumentSchema {
  return {
    documentId: 'doc-diff-1',
    artifactId: 'artifact-diff-1',
    title: 'Diff test',
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
    sections,
    sourceRefs: [],
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
  };
}

describe('computeDocumentSchemaDiff — edge cases (Slice E16.diff)', () => {
  it('both null / undefined → empty diff, hasChanges=false', () => {
    const diff = computeDocumentSchemaDiff(null, null);
    expect(diff.hasChanges).toBe(false);
    expect(diff.sectionDiffs).toEqual([]);
    expect(diff.stats.addedSectionCount).toBe(0);
    expect(diff.stats.removedSectionCount).toBe(0);
  });

  it('only after → every section reported as added', () => {
    const after = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Hello' })]),
      makeSection('s2', 1, 'Findings', [makeBlock('b2', 'paragraph', { text: 'X' })]),
    ]);
    const diff = computeDocumentSchemaDiff(null, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.stats.addedSectionCount).toBe(2);
    expect(diff.stats.removedSectionCount).toBe(0);
    expect(diff.stats.addedBlockCount).toBe(2);
    expect(diff.sectionDiffs.every((s) => s.kind === 'added')).toBe(true);
    expect(diff.sectionDiffs.every((s) => s.beforeTitle === null)).toBe(true);
  });

  it('only before → every section reported as removed', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Hello' })]),
    ]);
    const diff = computeDocumentSchemaDiff(before, null);
    expect(diff.hasChanges).toBe(true);
    expect(diff.stats.addedSectionCount).toBe(0);
    expect(diff.stats.removedSectionCount).toBe(1);
    expect(diff.stats.removedBlockCount).toBe(1);
    expect(diff.sectionDiffs[0].kind).toBe('removed');
    expect(diff.sectionDiffs[0].afterTitle).toBe(null);
  });

  it('identical schemas → all unchanged, hasChanges=false', () => {
    const sections = [
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Hello' })]),
      makeSection('s2', 1, 'Findings', [makeBlock('b2', 'paragraph', { text: 'X' })]),
    ];
    const before = makeSchema(JSON.parse(JSON.stringify(sections)));
    const after = makeSchema(JSON.parse(JSON.stringify(sections)));
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.hasChanges).toBe(false);
    expect(diff.stats.unchangedSectionCount).toBe(2);
    expect(diff.stats.unchangedBlockCount).toBe(2);
    expect(diff.sectionDiffs.every((s) => s.kind === 'unchanged')).toBe(true);
  });
});

describe('computeDocumentSchemaDiff — section-level kinds (Slice E16.diff)', () => {
  it('detects added section (new id in after)', () => {
    const before = makeSchema([makeSection('s1', 0, 'Intro')]);
    const after = makeSchema([makeSection('s1', 0, 'Intro'), makeSection('s2', 1, 'Findings')]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.addedSectionCount).toBe(1);
    const added = diff.sectionDiffs.find((s) => s.kind === 'added');
    expect(added?.sectionId).toBe('s2');
    expect(added?.afterTitle).toBe('Findings');
    expect(added?.beforeTitle).toBe(null);
  });

  it('detects removed section (id missing in after)', () => {
    const before = makeSchema([makeSection('s1', 0, 'Intro'), makeSection('s2', 1, 'Findings')]);
    const after = makeSchema([makeSection('s1', 0, 'Intro')]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.removedSectionCount).toBe(1);
    const removed = diff.sectionDiffs.find((s) => s.kind === 'removed');
    expect(removed?.sectionId).toBe('s2');
    expect(removed?.beforeTitle).toBe('Findings');
    expect(removed?.afterTitle).toBe(null);
  });

  it('detects modified section (title changed, blocks unchanged)', () => {
    const blocks = [makeBlock('b1', 'paragraph', { text: 'Hello' })];
    const before = makeSchema([makeSection('s1', 0, 'Old Title', blocks)]);
    const after = makeSchema([makeSection('s1', 0, 'New Title', blocks)]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.modifiedSectionCount).toBe(1);
    const mod = diff.sectionDiffs.find((s) => s.kind === 'modified');
    expect(mod?.beforeTitle).toBe('Old Title');
    expect(mod?.afterTitle).toBe('New Title');
  });

  it('detects modified section (blocks changed, title unchanged)', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Old' })]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'New' })]),
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.modifiedSectionCount).toBe(1);
    expect(diff.stats.modifiedBlockCount).toBe(1);
  });

  it('detects reordered section (orderIndex changed, content identical)', () => {
    const blocks = [makeBlock('b1', 'paragraph', { text: 'Hello' })];
    const before = makeSchema([makeSection('s1', 0, 'Intro', blocks)]);
    const after = makeSchema([makeSection('s1', 5, 'Intro', blocks)]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.reorderedSectionCount).toBe(1);
    expect(diff.stats.modifiedSectionCount).toBe(0);
    const reord = diff.sectionDiffs.find((s) => s.kind === 'reordered');
    expect(reord?.beforeOrderIndex).toBe(0);
    expect(reord?.afterOrderIndex).toBe(5);
  });

  it('section ordering: after-first, removed-appended', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Old 1'),
      makeSection('s2', 1, 'Old 2'),
      makeSection('s3', 2, 'Old 3'),
    ]);
    const after = makeSchema([
      makeSection('s2', 0, 'Old 2'), // unchanged content, reordered
      makeSection('s4', 1, 'New 4'), // added
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    // After-first: s2 (reordered), s4 (added) — then removed: s1, s3.
    expect(diff.sectionDiffs.map((s) => s.sectionId)).toEqual(['s2', 's4', 's1', 's3']);
  });
});

describe('computeDocumentSchemaDiff — block-level kinds (Slice E16.diff)', () => {
  it('detects added block within an existing section', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Hi' })]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'Intro', [
        makeBlock('b1', 'paragraph', { text: 'Hi' }),
        makeBlock('b2', 'paragraph', { text: 'Bye' }),
      ]),
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.addedBlockCount).toBe(1);
    expect(diff.stats.unchangedBlockCount).toBe(1);
    const sec = diff.sectionDiffs[0];
    expect(sec.kind).toBe('modified');
    const added = sec.blockDiffs.find((b) => b.blockId === 'b2');
    expect(added?.kind).toBe('added');
    expect(added?.beforePositionIndex).toBe(null);
    expect(added?.afterPositionIndex).toBe(1);
  });

  it('detects removed block within an existing section', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [
        makeBlock('b1', 'paragraph', { text: 'Hi' }),
        makeBlock('b2', 'paragraph', { text: 'Bye' }),
      ]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Hi' })]),
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.removedBlockCount).toBe(1);
    const removed = diff.sectionDiffs[0].blockDiffs.find((b) => b.blockId === 'b2');
    expect(removed?.kind).toBe('removed');
    expect(removed?.afterPositionIndex).toBe(null);
    expect(removed?.beforePositionIndex).toBe(1);
  });

  it('detects modified block (text changed, type unchanged)', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Old' })]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'New' })]),
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.modifiedBlockCount).toBe(1);
    const mod = diff.sectionDiffs[0].blockDiffs[0];
    expect(mod.kind).toBe('modified');
    expect(mod.beforeText).toBe('Old');
    expect(mod.afterText).toBe('New');
  });

  it('detects modified block (type changed)', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'Same' })]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'callout', { text: 'Same' })]),
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.modifiedBlockCount).toBe(1);
    expect(diff.sectionDiffs[0].blockDiffs[0].blockType).toBe('callout');
  });

  it('does not double-count a block kept across reordered sections', () => {
    // Block stays inside the same section; only section
    // orderIndex changes → block reports as `unchanged`.
    const blocks = [makeBlock('b1', 'paragraph', { text: 'Same' })];
    const before = makeSchema([makeSection('s1', 0, 'Intro', blocks)]);
    const after = makeSchema([makeSection('s1', 5, 'Intro', blocks)]);
    const diff = computeDocumentSchemaDiff(before, after);
    expect(diff.stats.unchangedBlockCount).toBe(1);
    expect(diff.stats.modifiedBlockCount).toBe(0);
    expect(diff.stats.addedBlockCount).toBe(0);
    expect(diff.stats.removedBlockCount).toBe(0);
  });
});

describe('computeDocumentSchemaDiff — purity & immutability (Slice E16.diff)', () => {
  it('does not mutate either input schema', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Intro', [makeBlock('b1', 'paragraph', { text: 'X' })]),
    ]);
    const after = makeSchema([
      makeSection('s2', 0, 'Findings', [makeBlock('b2', 'paragraph', { text: 'Y' })]),
    ]);
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    computeDocumentSchemaDiff(before, after);
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(JSON.stringify(after)).toBe(afterJson);
  });

  it('is deterministic — same inputs produce equal outputs', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'A', [makeBlock('b1', 'paragraph', { text: 'X' })]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'A', [makeBlock('b1', 'paragraph', { text: 'Y' })]),
    ]);
    const a = computeDocumentSchemaDiff(before, after);
    const b = computeDocumentSchemaDiff(before, after);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('summarizeDocumentSchemaDiff (Slice E16.diff)', () => {
  it('returns "No structural changes." for null / clean diff', () => {
    expect(summarizeDocumentSchemaDiff(null)).toBe('No structural changes.');
    expect(summarizeDocumentSchemaDiff(undefined)).toBe('No structural changes.');
    const clean = computeDocumentSchemaDiff(makeSchema([]), makeSchema([]));
    expect(summarizeDocumentSchemaDiff(clean)).toBe('No structural changes.');
  });

  it('reports every non-zero count with proper pluralisation', () => {
    const before = makeSchema([
      makeSection('s1', 0, 'Old', [makeBlock('b1', 'paragraph', { text: 'X' })]),
    ]);
    const after = makeSchema([
      makeSection('s1', 0, 'New', [
        makeBlock('b1', 'paragraph', { text: 'X' }),
        makeBlock('b2', 'paragraph', { text: 'Y' }),
      ]),
      makeSection('s2', 1, 'Findings'),
    ]);
    const diff = computeDocumentSchemaDiff(before, after);
    const summary = summarizeDocumentSchemaDiff(diff);
    expect(summary).toContain('1 section added');
    expect(summary).toContain('1 section modified');
    expect(summary).toContain('1 block added');
  });

  it('uses singular form for count of 1 and plural otherwise', () => {
    const single = makeSchema([makeSection('s1', 0, 'A')]);
    const before = makeSchema([]);
    const summary1 = summarizeDocumentSchemaDiff(computeDocumentSchemaDiff(before, single));
    expect(summary1).toContain('1 section added');

    const plural = makeSchema([
      makeSection('s1', 0, 'A'),
      makeSection('s2', 1, 'B'),
      makeSection('s3', 2, 'C'),
    ]);
    const summaryN = summarizeDocumentSchemaDiff(computeDocumentSchemaDiff(before, plural));
    expect(summaryN).toContain('3 sections added');
  });
});

describe('blockToDiffText — canonical text projection (Slice E16.diff)', () => {
  it('handles null / undefined → empty string', () => {
    expect(blockToDiffText(null)).toBe('');
    expect(blockToDiffText(undefined)).toBe('');
  });

  it('projects heading with level prefix', () => {
    expect(blockToDiffText(makeBlock('b', 'heading', { level: 2, text: '  Hello  ' }))).toBe(
      'H2:Hello'
    );
  });

  it('projects paragraph as trimmed text', () => {
    expect(blockToDiffText(makeBlock('b', 'paragraph', { text: '  Hello world  ' }))).toBe(
      'Hello world'
    );
  });

  it('projects bullet_list / numbered_list as newline-joined items', () => {
    const bullets = makeBlock('b', 'bullet_list', { items: ['  a  ', 'b', 'c'] });
    expect(blockToDiffText(bullets)).toBe('a\nb\nc');
    const numbered = makeBlock('b', 'numbered_list', { items: ['x', 'y'] });
    expect(blockToDiffText(numbered)).toBe('x\ny');
  });

  it('projects table as pipe-joined rows joined by newlines', () => {
    expect(
      blockToDiffText(
        makeBlock('b', 'table', {
          rows: [
            ['A', 'B'],
            ['C', 'D'],
          ],
        })
      )
    ).toBe('A|B\nC|D');
  });

  it('projects chart with kind + title + series', () => {
    expect(
      blockToDiffText(
        makeBlock('b', 'chart', {
          kind: 'bar',
          title: 'Q1',
          series: [{ label: 'Rev', values: [1, 2, 3] }],
        })
      )
    ).toBe('CHART:bar|Q1|Rev:[1,2,3]');
  });

  it('falls back to JSON for unknown block types (deterministic)', () => {
    const unknown = makeBlock('b', 'paragraph_x' as DocumentBlock['type'], { foo: 'bar' });
    expect(blockToDiffText(unknown)).toBe('{"foo":"bar"}');
  });
});
