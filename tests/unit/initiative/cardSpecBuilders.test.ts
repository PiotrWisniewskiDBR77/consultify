/**
 * cardSpecBuilders.test — F3 (D11): czyste producenty CardSpec z danych sekcji.
 *
 * Sprawdza, że builder mapuje pola → poprawne bloki, znosi braki, oraz że
 * wynik przechodzi `validateCardSpec` bez issues CRITICAL.
 */

import { describe, expect, it } from 'vitest';

import {
  type CardBlock,
  validateCardSpec,
} from '@/components/Initiatives/cards/cardBlockSchema';
import {
  buildBusinessCaseCardSpec,
  buildProblemCardSpec,
  buildTargetStateCardSpec,
  isBuiltSpecRenderable,
} from '@/components/Initiatives/cards/cardSpecBuilders';

function types(blocks: CardBlock[]): string[] {
  return blocks.map((b) => b.type);
}

function noCritical(spec: ReturnType<typeof buildProblemCardSpec>): boolean {
  return !validateCardSpec(spec).some((it) => it.severity === 'CRITICAL');
}

// ── PROBLEM ──────────────────────────────────────────────────────────────────

describe('buildProblemCardSpec', () => {
  it('maps symptom → heading+paragraph, rootCause → heading+paragraph, cost → danger callout', () => {
    const spec = buildProblemCardSpec({
      symptom: 'Zamówienia spadają 12% kw/kw',
      rootCause: 'Brak retencji po onboardingu',
      costOfInaction: '2 mln zł utraconego przychodu rocznie',
    });
    expect(spec.sectionKey).toBe('problemDefinition');
    expect(types(spec.blocks)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'paragraph',
      'callout',
    ]);
    const callout = spec.blocks.find((b) => b.type === 'callout');
    expect(callout).toMatchObject({ type: 'callout', tone: 'danger' });
    expect((callout as { text: string }).text).toContain('2 mln');
  });

  it('skips missing fields and produces no empty blocks', () => {
    const spec = buildProblemCardSpec({ symptom: 'Tylko symptom' });
    expect(types(spec.blocks)).toEqual(['heading', 'paragraph']);
    expect((spec.blocks[1] as { text: string }).text).toBe('Tylko symptom');
  });

  it('trims whitespace and treats blank/whitespace fields as absent', () => {
    const spec = buildProblemCardSpec({
      symptom: '   ',
      rootCause: '  realna przyczyna  ',
      costOfInaction: null,
    });
    expect(types(spec.blocks)).toEqual(['heading', 'paragraph']);
    expect((spec.blocks[1] as { text: string }).text).toBe('realna przyczyna');
  });

  it('honors provided i18n labels for headings and callout title', () => {
    const spec = buildProblemCardSpec(
      { symptom: 's', costOfInaction: 'c' },
      { title: 'Problem', symptomHeading: 'Symptom EN', costOfInactionTitle: 'Cost EN' },
    );
    expect(spec.title).toBe('Problem');
    expect((spec.blocks[0] as { text: string }).text).toBe('Symptom EN');
    expect((spec.blocks.find((b) => b.type === 'callout') as { title: string }).title).toBe(
      'Cost EN',
    );
  });

  it('returns zero blocks for empty/undefined input (renderer shows empty-state)', () => {
    expect(buildProblemCardSpec({}).blocks).toHaveLength(0);
    expect(buildProblemCardSpec(null).blocks).toHaveLength(0);
    expect(buildProblemCardSpec(undefined).blocks).toHaveLength(0);
  });

  it('produced spec passes validateCardSpec with no CRITICAL when populated', () => {
    const spec = buildProblemCardSpec({ symptom: 'a', rootCause: 'b', costOfInaction: 'c' });
    expect(noCritical(spec)).toBe(true);
    expect(isBuiltSpecRenderable(spec)).toBe(true);
  });
});

// ── TARGET STATE ─────────────────────────────────────────────────────────────

describe('buildTargetStateCardSpec', () => {
  it('maps vision → lead paragraph, criteria/deliverables → heading+bullet_list', () => {
    const spec = buildTargetStateCardSpec({
      vision: 'Samoobsługowy onboarding w 24h',
      successCriteria: ['NPS > 50', 'Retencja 90d > 80%'],
      deliverables: ['Kreator onboardingu', 'Panel sukcesu klienta'],
    });
    expect(spec.sectionKey).toBe('targetState');
    expect(types(spec.blocks)).toEqual([
      'paragraph',
      'heading',
      'bullet_list',
      'heading',
      'bullet_list',
    ]);
    expect((spec.blocks[0] as { emphasis?: string }).emphasis).toBe('lead');
    const firstList = spec.blocks.find((b) => b.type === 'bullet_list');
    expect((firstList as { items: string[] }).items).toEqual(['NPS > 50', 'Retencja 90d > 80%']);
  });

  it('filters empty/whitespace list items and skips empty lists', () => {
    const spec = buildTargetStateCardSpec({
      successCriteria: ['  real  ', '', '   ', null as unknown as string],
      deliverables: [],
    });
    // brak vision, deliverables puste → tylko heading + bullet_list dla kryteriów
    expect(types(spec.blocks)).toEqual(['heading', 'bullet_list']);
    expect((spec.blocks[1] as { items: string[] }).items).toEqual(['real']);
  });

  it('returns zero blocks when all sources empty', () => {
    expect(buildTargetStateCardSpec({ successCriteria: [], deliverables: [] }).blocks).toHaveLength(
      0,
    );
    expect(buildTargetStateCardSpec(null).blocks).toHaveLength(0);
  });

  it('produced spec passes validateCardSpec with no CRITICAL when populated', () => {
    const spec = buildTargetStateCardSpec({ vision: 'v', successCriteria: ['x'] });
    expect(noCritical(spec)).toBe(true);
  });
});

// ── BUSINESS CASE ────────────────────────────────────────────────────────────

describe('buildBusinessCaseCardSpec', () => {
  it('maps investment/return/payback → kpi_strip with roi as delta on return', () => {
    const spec = buildBusinessCaseCardSpec({
      investment: '500 tys. zł',
      expectedReturn: '1,8 mln zł',
      roi: '37%',
      payback: '8 mies.',
      rationale: 'Skraca cykl sprzedaży o 30%',
      keyRisk: 'Zależność od integracji ERP',
    });
    expect(spec.sectionKey).toBe('businessCase');
    expect(types(spec.blocks)).toEqual(['kpi_strip', 'heading', 'paragraph', 'callout']);

    const kpi = spec.blocks.find((b) => b.type === 'kpi_strip') as {
      tiles: Array<{ label: string; value: string; delta?: string; trend?: string }>;
    };
    expect(kpi.tiles).toHaveLength(3);
    const returnTile = kpi.tiles.find((t) => t.value === '1,8 mln zł');
    expect(returnTile?.delta).toBe('37%');
    expect(returnTile?.trend).toBe('up');

    const risk = spec.blocks.find((b) => b.type === 'callout');
    expect(risk).toMatchObject({ type: 'callout', tone: 'warning' });
  });

  it('omits kpi_strip entirely when no financial values present', () => {
    const spec = buildBusinessCaseCardSpec({ rationale: 'Tylko uzasadnienie' });
    expect(types(spec.blocks)).toEqual(['heading', 'paragraph']);
  });

  it('omits roi delta when expectedReturn absent', () => {
    const spec = buildBusinessCaseCardSpec({ investment: '100', roi: '50%' });
    const kpi = spec.blocks.find((b) => b.type === 'kpi_strip') as {
      tiles: Array<{ delta?: string }>;
    };
    expect(kpi.tiles).toHaveLength(1);
    expect(kpi.tiles[0].delta).toBeUndefined();
  });

  it('returns zero blocks for fully empty input', () => {
    expect(buildBusinessCaseCardSpec({}).blocks).toHaveLength(0);
    expect(buildBusinessCaseCardSpec(undefined).blocks).toHaveLength(0);
  });

  it('produced spec passes validateCardSpec with no CRITICAL when populated', () => {
    const spec = buildBusinessCaseCardSpec({
      investment: '1',
      expectedReturn: '2',
      rationale: 'r',
    });
    expect(noCritical(spec)).toBe(true);
    expect(isBuiltSpecRenderable(spec)).toBe(true);
  });
});
