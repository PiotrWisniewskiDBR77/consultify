/**
 * Document Studio — DOCX structure helpers tests (Epic E8, Slice 8.2).
 *
 * Covers the pure structural decisions the renderer leans on:
 *   - appendix detection (explicit `kind` + title-prefix heuristic, PL/EN);
 *   - body/appendix partitioning preserving source order inside each group;
 *   - body-section numbering (Arabic);
 *   - appendix labelling per `appendixStyle` (lettered / numbered / none);
 *   - idempotency for already-prefixed appendix titles;
 *   - spreadsheet-style letter sequence beyond Z (AA, AB, …).
 */

import { describe, expect, it } from 'vitest';

import {
  formatAppendixHeading,
  formatBodyHeading,
  isAppendixSection,
  letterForIndex,
  partitionSections,
  planSectionHeadings,
} from '../documentDocxStructure.js';
import type { DocumentSection, FormattingSchema } from '../documentStudioTypes.js';

function makeSection(overrides: Partial<DocumentSection> & { sectionId: string }): DocumentSection {
  return {
    // `sectionId` is required on `overrides` and the trailing spread already
    // supplies it — restating it here was dead (and flagged as an overwritten
    // duplicate property).
    orderIndex: overrides.orderIndex ?? 0,
    level: overrides.level ?? 1,
    title: overrides.title ?? 'Untitled',
    blocks: overrides.blocks ?? [],
    sourceRefs: overrides.sourceRefs ?? [],
    ...overrides,
  };
}

function makeFormattingSchema(overrides: Partial<FormattingSchema> = {}): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

describe('isAppendixSection', () => {
  it('treats explicit kind="appendix" as an appendix even with a non-matching title', () => {
    expect(
      isAppendixSection(makeSection({ sectionId: 's1', title: 'Methodology', kind: 'appendix' }))
    ).toBe(true);
  });

  it('treats explicit kind="body" as body even when the title starts with "Appendix"', () => {
    expect(
      isAppendixSection(
        makeSection({ sectionId: 's1', title: 'Appendix prep notes', kind: 'body' })
      )
    ).toBe(false);
  });

  it('falls back to title prefix heuristic when kind is missing (EN)', () => {
    expect(isAppendixSection(makeSection({ sectionId: 's1', title: 'Appendix A: Glossary' }))).toBe(
      true
    );
    expect(
      isAppendixSection(makeSection({ sectionId: 's2', title: 'Annex 1 — Methodology' }))
    ).toBe(true);
  });

  it('falls back to title prefix heuristic when kind is missing (PL)', () => {
    expect(
      isAppendixSection(makeSection({ sectionId: 's1', title: 'Załącznik A — słownik' }))
    ).toBe(true);
    expect(isAppendixSection(makeSection({ sectionId: 's2', title: 'Zalacznik B' }))).toBe(true);
  });

  it('returns false for ordinary body section titles', () => {
    expect(isAppendixSection(makeSection({ sectionId: 's1', title: 'Executive Summary' }))).toBe(
      false
    );
    expect(isAppendixSection(makeSection({ sectionId: 's2', title: 'Findings' }))).toBe(false);
  });
});

describe('partitionSections', () => {
  it('preserves source ordering inside each group', () => {
    const sections = [
      makeSection({ sectionId: 'b1', title: 'Findings' }),
      makeSection({ sectionId: 'a1', title: 'Appendix A — Glossary' }),
      makeSection({ sectionId: 'b2', title: 'Recommendations' }),
      makeSection({ sectionId: 'a2', title: 'Appendix B — Sources', kind: 'appendix' }),
    ];
    const partitioned = partitionSections(sections);
    expect(partitioned.body.map((s) => s.sectionId)).toEqual(['b1', 'b2']);
    expect(partitioned.appendix.map((s) => s.sectionId)).toEqual(['a1', 'a2']);
  });

  it('returns empty groups when all sections are body-only', () => {
    const sections = [
      makeSection({ sectionId: 'b1', title: 'Summary' }),
      makeSection({ sectionId: 'b2', title: 'Findings' }),
    ];
    const partitioned = partitionSections(sections);
    expect(partitioned.appendix).toHaveLength(0);
    expect(partitioned.body).toHaveLength(2);
  });
});

describe('formatBodyHeading', () => {
  it('uses one-based Arabic numerals', () => {
    const section = makeSection({ sectionId: 's1', title: 'Findings' });
    expect(formatBodyHeading(section, 0)).toBe('1. Findings');
    expect(formatBodyHeading(section, 4)).toBe('5. Findings');
  });
});

describe('formatAppendixHeading', () => {
  const section = (title: string) => makeSection({ sectionId: 'a', title });

  it('emits "Appendix A — title" under the lettered scheme', () => {
    const formatting = makeFormattingSchema({ appendixStyle: 'lettered' });
    expect(formatAppendixHeading(section('Glossary'), 0, formatting)).toBe('Appendix A — Glossary');
    expect(formatAppendixHeading(section('Sources'), 1, formatting)).toBe('Appendix B — Sources');
  });

  it('emits "Appendix 1 — title" under the numbered scheme', () => {
    const formatting = makeFormattingSchema({ appendixStyle: 'numbered' });
    expect(formatAppendixHeading(section('Glossary'), 0, formatting)).toBe('Appendix 1 — Glossary');
    expect(formatAppendixHeading(section('Sources'), 2, formatting)).toBe('Appendix 3 — Sources');
  });

  it('returns the bare title under the "none" scheme', () => {
    const formatting = makeFormattingSchema({ appendixStyle: 'none' });
    expect(formatAppendixHeading(section('Glossary'), 0, formatting)).toBe('Glossary');
  });

  it('does not double-prefix titles that the author already labelled', () => {
    const formatting = makeFormattingSchema({ appendixStyle: 'lettered' });
    expect(formatAppendixHeading(section('Appendix A — Glossary'), 0, formatting)).toBe(
      'Appendix A — Glossary'
    );
    expect(formatAppendixHeading(section('Załącznik 1 — Słownik'), 0, formatting)).toBe(
      'Załącznik 1 — Słownik'
    );
  });
});

describe('letterForIndex', () => {
  it('maps 0..25 to A..Z', () => {
    expect(letterForIndex(0)).toBe('A');
    expect(letterForIndex(1)).toBe('B');
    expect(letterForIndex(25)).toBe('Z');
  });

  it('continues to AA, AB, … past Z', () => {
    expect(letterForIndex(26)).toBe('AA');
    expect(letterForIndex(27)).toBe('AB');
    expect(letterForIndex(51)).toBe('AZ');
    expect(letterForIndex(52)).toBe('BA');
  });

  it('clamps non-finite or negative indices to A', () => {
    expect(letterForIndex(-1)).toBe('A');
    expect(letterForIndex(Number.NaN)).toBe('A');
  });
});

describe('planSectionHeadings', () => {
  it('produces the full ordered heading list a renderer would emit', () => {
    const sections = [
      makeSection({ sectionId: 'b1', title: 'Executive Summary' }),
      makeSection({ sectionId: 'a1', title: 'Glossary', kind: 'appendix' }),
      makeSection({ sectionId: 'b2', title: 'Findings' }),
      makeSection({ sectionId: 'a2', title: 'Sources', kind: 'appendix' }),
    ];
    const formatting = makeFormattingSchema({ appendixStyle: 'lettered' });
    const plan = planSectionHeadings(sections, formatting);
    expect(plan).toEqual([
      { sectionId: 'b1', kind: 'body', heading: '1. Executive Summary' },
      { sectionId: 'b2', kind: 'body', heading: '2. Findings' },
      { sectionId: 'a1', kind: 'appendix', heading: 'Appendix A — Glossary' },
      { sectionId: 'a2', kind: 'appendix', heading: 'Appendix B — Sources' },
    ]);
  });
});
