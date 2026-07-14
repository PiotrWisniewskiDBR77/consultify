// @vitest-environment node
/**
 * fullCatalog — regression guard: iteruje WSZYSTKIE 90 scenariuszy (30 deck +
 * 30 doc + 30 table), scoruje każdy `mockPass` (known-good artifact) i asertuje
 * passed===true + scorePct===100.
 *
 * Dwa cele:
 *   1. Waliduje że KAŻDY scenariusz ma SATISFIABLE criteria (istnieje artefakt
 *      który je spełnia w 100%). Gdyby criteria były wewnętrznie sprzeczne →
 *      mockPass by nie przeszedł.
 *   2. Regression-guard SCORINGU: jeśli ktoś zepsuje scorer (zmieni próg, doda
 *      kryterium), któryś z 90 mock-passów spadnie → test złapie natychmiast.
 *
 * Dodatkowo: sanity-check że scoring WYKRYWA degradację (degraded artifact fails).
 */

import { describe, expect, it } from 'vitest';

import {
  LAYOUT_INTENT_CATALOG,
  PALETTE_CATALOG,
} from '../../../server/src/services/presentationLayoutDirectorService.js';
import { DECK_SCENARIOS } from './catalog/decks.js';
import { DOC_SCENARIOS } from './catalog/reports.js';
import { TABLE_SCENARIOS } from './catalog/tables.js';
import { scoreDeck } from './scoring/deckScoring.js';
import { scoreDoc } from './scoring/docScoring.js';
import { scoreTable } from './scoring/tableScoring.js';

describe('Full catalog — M19 decks (30 scenarios mock-pass)', () => {
  it('all 30 deck scenarios have satisfiable criteria (mockPass scores 100%)', () => {
    const failures: string[] = [];
    for (const entry of DECK_SCENARIOS) {
      const report = scoreDeck(entry.mockPass, entry.criteria);
      if (!report.passed || report.scorePct !== 100) {
        failures.push(
          `${entry.meta.id} (${report.scorePct}%): ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([]);
  });

  it('count = 30, ids unique, all tiers present', () => {
    expect(DECK_SCENARIOS).toHaveLength(30);
    const ids = new Set(DECK_SCENARIOS.map((e) => e.meta.id));
    expect(ids.size).toBe(30);
    const tiers = new Set(DECK_SCENARIOS.map((e) => e.meta.tier));
    expect([...tiers].sort()).toEqual(['Lrg', 'Med', 'Sml', 'Xtr']);
  });
});

describe('Full catalog — M18 reports (30 scenarios mock-pass)', () => {
  it('all 30 doc scenarios have satisfiable criteria (mockPass scores 100%)', () => {
    const failures: string[] = [];
    for (const entry of DOC_SCENARIOS) {
      const report = scoreDoc(entry.mockPass, entry.criteria);
      if (!report.passed || report.scorePct !== 100) {
        failures.push(
          `${entry.meta.id} (${report.scorePct}%): ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([]);
  });

  it('count = 30, ids unique', () => {
    expect(DOC_SCENARIOS).toHaveLength(30);
    expect(new Set(DOC_SCENARIOS.map((e) => e.meta.id)).size).toBe(30);
  });
});

describe('Full catalog — M20 tables (30 scenarios mock-pass)', () => {
  it('all 30 table scenarios have satisfiable criteria (mockPass scores 100%)', () => {
    const failures: string[] = [];
    for (const entry of TABLE_SCENARIOS) {
      const report = scoreTable(entry.mockPass, entry.criteria);
      if (!report.passed || report.scorePct !== 100) {
        failures.push(
          `${entry.meta.id} (${report.scorePct}%): ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([]);
  });

  it('count = 30, ids unique', () => {
    expect(TABLE_SCENARIOS).toHaveLength(30);
    expect(new Set(TABLE_SCENARIOS.map((e) => e.meta.id)).size).toBe(30);
  });
});

describe('Catalog ↔ production contract — deck scenarios anchored to REAL server catalogs', () => {
  it('every deck mockPass plan references layoutIntent + paletteId from the real LAYOUT_INTENT_CATALOG / PALETTE_CATALOG', () => {
    const violations: string[] = [];
    for (const entry of DECK_SCENARIOS) {
      for (const plan of entry.mockPass.plans) {
        if (!LAYOUT_INTENT_CATALOG.includes(plan.layoutIntent as any)) {
          violations.push(
            `${entry.meta.id} slide ${plan.slideIndex}: layoutIntent=${plan.layoutIntent}`
          );
        }
        if (!PALETTE_CATALOG.includes(plan.paletteId as any)) {
          violations.push(`${entry.meta.id} slide ${plan.slideIndex}: paletteId=${plan.paletteId}`);
        }
      }
    }
    expect(violations, `\n${violations.join('\n')}`).toEqual([]);
  });

  it('every deck criteria layout requirement targets an intent that exists in the real catalog', () => {
    const violations: string[] = [];
    for (const entry of DECK_SCENARIOS) {
      const referenced = [
        ...(entry.criteria.requireLayoutAtLeast ?? []).map((r) => r.intent),
        ...(entry.criteria.forbidLayouts ?? []),
        ...Object.values(entry.criteria.sequence ?? {}),
      ];
      for (const intent of referenced) {
        if (!LAYOUT_INTENT_CATALOG.includes(intent as any)) {
          violations.push(`${entry.meta.id}: criteria references unknown intent "${intent}"`);
        }
      }
    }
    expect(violations, `\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('Scoring sanity — degradacja JEST wykrywana', () => {
  it('deck: usunięcie wymaganego layoutu → fail', () => {
    const entry = DECK_SCENARIOS.find((e) => e.meta.id === 'M19.S16')!;
    // Degraduj: zamień wszystkie root_cause na key_messages.
    const degraded = {
      ...entry.mockPass,
      plans: entry.mockPass.plans.map((p) =>
        p.layoutIntent === 'root_cause' ? { ...p, layoutIntent: 'key_messages' as any } : p
      ),
    };
    const report = scoreDeck(degraded, entry.criteria);
    expect(report.passed).toBe(false);
  });

  it('table: usunięcie kolorów z singleSelect → fail', () => {
    const entry = TABLE_SCENARIOS.find((e) => e.meta.id === 'M20.S01')!;
    const degraded = {
      ...entry.mockPass,
      fields: entry.mockPass.fields.map((f) =>
        f.options ? { ...f, options: f.options.map((o) => ({ label: o.label })) } : f
      ),
    };
    const report = scoreTable(degraded, entry.criteria);
    expect(report.passed).toBe(false);
  });

  it('doc: spłaszczenie do samej prozy → fail (gdy wymagane typed blocks)', () => {
    const entry = DOC_SCENARIOS.find((e) => e.meta.id === 'M18.S16')!;
    const degraded = {
      ...entry.mockPass,
      sections: entry.mockPass.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) => ({ ...b, type: 'text' as const })),
      })),
    };
    const report = scoreDoc(degraded, entry.criteria);
    expect(report.passed).toBe(false);
  });
});
