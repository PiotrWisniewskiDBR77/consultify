// @vitest-environment node
/**
 * W7.3 — slideArchetypes: arsenał ≥20 archetypów z walidną geometrią.
 * Kluczowy test: KAŻDY archetyp ma regiony rozłączne i w granicach (critic DR-06).
 */
import { describe, expect, it } from 'vitest';
import {
  SLIDE_ARCHETYPES,
  ARCHETYPE_COUNT,
  getArchetype,
  isArchetypeId,
  archetypesForIntent,
  resolveArchetype,
} from '../../../server/src/services/deliverables/slideArchetypes';
import { critiqueSlide } from '../../../server/src/services/deliverables/deckDesignCritic';

describe('W7.3 — arsenał archetypów', () => {
  it('ma ≥20 archetypów (DoD)', () => {
    expect(ARCHETYPE_COUNT).toBeGreaterThanOrEqual(20);
    expect(SLIDE_ARCHETYPES.length).toBe(ARCHETYPE_COUNT);
  });

  it('id-y są unikalne', () => {
    const ids = SLIDE_ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('każdy archetyp ma label, description, ≥1 region, ≥1 intent', () => {
    for (const a of SLIDE_ARCHETYPES) {
      expect(a.label, a.id).toBeTruthy();
      expect(a.description, a.id).toBeTruthy();
      expect(a.regions.length, a.id).toBeGreaterThan(0);
      expect(a.bestForIntents.length, a.id).toBeGreaterThan(0);
    }
  });

  it('każdy region ma ≥1 dozwolony blok', () => {
    for (const a of SLIDE_ARCHETYPES) {
      for (const r of a.regions) {
        expect(r.blocks.length, `${a.id}.${r.name}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('W7.3 — geometria: regiony w granicach 0..1', () => {
  it('każdy region mieści się w kanwie (0 ≤ x,y i x+w,y+h ≤ 1)', () => {
    for (const a of SLIDE_ARCHETYPES) {
      for (const r of a.regions) {
        expect(r.x, `${a.id}.${r.name}.x`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${a.id}.${r.name}.y`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${a.id}.${r.name} prawa krawędź`).toBeLessThanOrEqual(1.0001);
        expect(r.y + r.h, `${a.id}.${r.name} dolna krawędź`).toBeLessThanOrEqual(1.0001);
        expect(r.w, `${a.id}.${r.name}.w`).toBeGreaterThan(0);
        expect(r.h, `${a.id}.${r.name}.h`).toBeGreaterThan(0);
      }
    }
  });

  it('KAŻDY archetyp przechodzi critic DR-06 (brak overlapów/poza-kanwą)', () => {
    for (const a of SLIDE_ARCHETYPES) {
      const result = critiqueSlide({
        layoutIntent: a.bestForIntents[0],
        title: 'Tytuł testowy archetypu o sensownej długości',
        keyMessage: 'Teza wystarczająco długa aby przejść DR-04 w tym teście.',
        regions: a.regions.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
      });
      const dr06 = result.critiques.filter((c) => c.code === 'DR-06-GRID-OVERLAP');
      expect(dr06, `${a.id} ma kolizje/poza-kanwą: ${dr06.map((c) => c.message).join('; ')}`).toHaveLength(0);
    }
  });
});

describe('W7.3 — arsenał pokrywa kluczowe archetypy konsultanckie', () => {
  it('zawiera SCQA/2×2/before-after/funnel/heatmap/roadmap/Minto/big-number', () => {
    const ids = new Set(SLIDE_ARCHETYPES.map((a) => a.id));
    for (const expected of [
      'exec_scqa', 'matrix_2x2', 'before_after', 'funnel', 'heatmap',
      'roadmap_swimlane', 'minto_pyramid', 'big_number', 'logo_wall',
    ]) {
      expect(ids.has(expected), `brak archetypu ${expected}`).toBe(true);
    }
  });
});

describe('W7.3 — API resolverów', () => {
  it('getArchetype zwraca po id lub null', () => {
    expect(getArchetype('kpi_grid_2x2')?.id).toBe('kpi_grid_2x2');
    expect(getArchetype('nieistnieje')).toBeNull();
  });

  it('isArchetypeId', () => {
    expect(isArchetypeId('funnel')).toBe(true);
    expect(isArchetypeId('xxx')).toBe(false);
    expect(isArchetypeId(123)).toBe(false);
  });

  it('archetypesForIntent zwraca pasujące, fallback stacked', () => {
    const forExec = archetypesForIntent('executive_summary');
    expect(forExec.length).toBeGreaterThan(0);
    expect(forExec.every((a) => a.bestForIntents.includes('executive_summary'))).toBe(true);
    // nieznana intencja → fallback stacked
    const fallback = archetypesForIntent('nieznana_intencja');
    expect(fallback).toHaveLength(1);
    expect(fallback[0].id).toBe('stacked');
  });

  it('resolveArchetype: preferowany gdy pasuje, inaczej pierwszy dla intencji', () => {
    // preferowany pasuje
    expect(resolveArchetype('comparison', 'before_after').id).toBe('before_after');
    // preferowany NIE pasuje do intencji → pierwszy dla intencji
    const r = resolveArchetype('cover', 'kpi_grid_2x2');
    expect(r.bestForIntents).toContain('cover');
    // brak preferowanego → pierwszy dla intencji
    expect(resolveArchetype('roadmap').bestForIntents).toContain('roadmap');
  });

  it('każda z 17 intencji M19 ma ≥1 archetyp (lub fallback)', () => {
    const INTENTS = [
      'cover', 'executive_summary', 'section_intro', 'key_messages', 'performance_overview',
      'single_insight', 'comparison', 'assessment', 'root_cause', 'recommendation_single',
      'recommendation_portfolio', 'initiative_portfolio', 'prioritization_matrix', 'roadmap',
      'risk_management', 'next_steps', 'appendix',
    ];
    for (const intent of INTENTS) {
      expect(archetypesForIntent(intent).length, intent).toBeGreaterThan(0);
    }
  });
});
