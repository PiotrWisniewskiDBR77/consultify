// @vitest-environment node
/**
 * blockTypeNormalization — unit testy unifikacji nazw typów bloków (A3).
 *
 * KANON = rodzina żywego pipeline'u B3/documentStudioTypes
 * (paragraph / bullet_list / kpi_strip / …). Rodzina legacy docScoring
 * (text / bulletList / kpi / …) jest aliasem akceptowanym na wejściu scoringu.
 */

import { describe, expect, it } from 'vitest';

import {
  blockTypeClass,
  blockTypeMatches,
  CANONICAL_DOC_BLOCK_TYPES,
  LEGACY_TO_CANONICAL,
  normalizeBlockType,
} from '../../integration/deliverables/scoring/blockTypeNormalization.js';
import { scoreDoc, type DocumentArtifact } from '../../integration/deliverables/scoring/docScoring.js';

describe('normalizeBlockType — aliasy legacy → kanon', () => {
  it('mapuje wszystkie 4 aliasy legacy na formę kanoniczną', () => {
    expect(normalizeBlockType('text')).toBe('paragraph');
    expect(normalizeBlockType('bulletList')).toBe('bullet_list');
    expect(normalizeBlockType('numberedList')).toBe('numbered_list');
    expect(normalizeBlockType('kpi')).toBe('kpi_strip');
  });

  it('typy kanoniczne przechodzą bez zmian (idempotencja)', () => {
    for (const type of CANONICAL_DOC_BLOCK_TYPES) {
      expect(normalizeBlockType(type)).toBe(type);
      // Podwójna normalizacja = pojedyncza.
      expect(normalizeBlockType(normalizeBlockType(type))).toBe(normalizeBlockType(type));
    }
  });

  it('każdy alias legacy wskazuje na istniejący typ kanoniczny', () => {
    for (const canonical of Object.values(LEGACY_TO_CANONICAL)) {
      expect(CANONICAL_DOC_BLOCK_TYPES).toContain(canonical);
    }
  });

  it('nieznany typ przechodzi bez zmian (scoring go po prostu nie zmatchuje)', () => {
    expect(normalizeBlockType('gibberish_type')).toBe('gibberish_type');
  });
});

describe('blockTypeClass / blockTypeMatches — klasy równoważności scoringu', () => {
  it('risk_table liczy się jako table', () => {
    expect(blockTypeClass('risk_table')).toBe('table');
    expect(blockTypeMatches('risk_table', 'table')).toBe(true);
  });

  it('footnote i citation liczą się jako paragraph (i legacy text)', () => {
    expect(blockTypeMatches('footnote', 'text')).toBe(true);
    expect(blockTypeMatches('citation', 'paragraph')).toBe(true);
  });

  it('matchuje krzyżowo obie rodziny nazw', () => {
    expect(blockTypeMatches('kpi_strip', 'kpi')).toBe(true);
    expect(blockTypeMatches('kpi', 'kpi_strip')).toBe(true);
    expect(blockTypeMatches('paragraph', 'text')).toBe(true);
    expect(blockTypeMatches('bullet_list', 'bulletList')).toBe(true);
    expect(blockTypeMatches('numbered_list', 'numberedList')).toBe(true);
  });

  it('NIE matchuje typów z różnych klas', () => {
    expect(blockTypeMatches('table', 'chart')).toBe(false);
    expect(blockTypeMatches('kpi_strip', 'table')).toBe(false);
    expect(blockTypeMatches('heading', 'paragraph')).toBe(false);
  });
});

describe('scoreDoc — akceptuje artefakt w OBU rodzinach nazw (granica A3)', () => {
  /** Ten sam dokument w dwóch słownikach nazw typów. */
  const canonicalDoc: DocumentArtifact = {
    sections: [
      {
        sectionId: 's1',
        heading: 'Wyniki finansowe',
        blocks: [
          { blockId: 'b1', type: 'heading', content: {} },
          { blockId: 'b2', type: 'paragraph', content: {} },
          { blockId: 'b3', type: 'kpi_strip', content: {} },
          { blockId: 'b4', type: 'bullet_list', content: {} },
        ],
      },
    ],
  };
  const legacyDoc: DocumentArtifact = {
    sections: [
      {
        sectionId: 's1',
        heading: 'Wyniki finansowe',
        blocks: [
          { blockId: 'b1', type: 'heading', content: {} },
          { blockId: 'b2', type: 'text', content: {} },
          { blockId: 'b3', type: 'kpi', content: {} },
          { blockId: 'b4', type: 'bulletList', content: {} },
        ],
      },
    ],
  };
  const criteriaLegacy = {
    scenarioId: 'a3-unit',
    minSections: 1,
    maxSections: 1,
    requireBlockType: [
      { type: 'kpi', min: 1 },
      { type: 'text', min: 1 },
      { type: 'bulletList', min: 1 },
    ],
    minDistinctBlockTypes: 4,
  } as const;

  it('raw wyjście B3 (kanoniczne typy) przechodzi kryteria pisane legacy', () => {
    const report = scoreDoc(canonicalDoc, criteriaLegacy as any);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('artefakt legacy scoruje IDENTYCZNIE jak kanoniczny', () => {
    const canonical = scoreDoc(canonicalDoc, criteriaLegacy as any);
    const legacy = scoreDoc(legacyDoc, criteriaLegacy as any);
    expect(legacy.passed).toBe(canonical.passed);
    expect(legacy.failures).toEqual(canonical.failures);
    expect(legacy.scorePct).toBe(canonical.scorePct);
  });

  it('kryteria pisane KANONICZNIE też działają (forbid + require)', () => {
    const report = scoreDoc(canonicalDoc, {
      scenarioId: 'a3-unit-canon',
      minSections: 1,
      maxSections: 1,
      requireBlockType: [{ type: 'kpi_strip', min: 1 }],
      forbidBlockType: ['chart'],
    } as any);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('mieszane rodziny w JEDNYM artefakcie nie dublują distinct types', () => {
    const mixed: DocumentArtifact = {
      sections: [
        {
          sectionId: 's1',
          heading: 'Mix',
          blocks: [
            { blockId: 'b1', type: 'text', content: {} },
            { blockId: 'b2', type: 'paragraph', content: {} },
          ],
        },
      ],
    };
    const report = scoreDoc(mixed, {
      scenarioId: 'a3-unit-mixed',
      minSections: 1,
      maxSections: 1,
      minDistinctBlockTypes: 2,
    } as any);
    // 'text' i 'paragraph' to JEDEN typ kanoniczny → distinct=1 → fail.
    expect(report.passed).toBe(false);
    expect(report.failures.map((f) => f.criterion)).toContain('distinct block types');
  });
});
