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
  buildControlCardSpec,
  buildKpisCardSpec,
  buildProblemCardSpec,
  buildScopeCardSpec,
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

// ── SCOPE ────────────────────────────────────────────────────────────────────

describe('buildScopeCardSpec', () => {
  it('maps inScope/outScope/killCriteria → heading+bullet_list per group', () => {
    const spec = buildScopeCardSpec({
      inScope: ['Moduł zamówień', 'Integracja ERP'],
      outScope: ['Migracja danych historycznych'],
      killCriteria: ['ROI < 0 po 12 mies.'],
    });
    expect(spec.sectionKey).toBe('scope');
    expect(types(spec.blocks)).toEqual([
      'heading',
      'bullet_list',
      'heading',
      'bullet_list',
      'heading',
      'bullet_list',
    ]);
    const firstList = spec.blocks[1] as { items: string[] };
    expect(firstList.items).toEqual(['Moduł zamówień', 'Integracja ERP']);
  });

  it('filters empty items and skips empty groups', () => {
    const spec = buildScopeCardSpec({
      inScope: ['  realny  ', '', null as unknown as string],
      outScope: [],
      killCriteria: undefined,
    });
    expect(types(spec.blocks)).toEqual(['heading', 'bullet_list']);
    expect((spec.blocks[1] as { items: string[] }).items).toEqual(['realny']);
  });

  it('honors provided i18n labels', () => {
    const spec = buildScopeCardSpec(
      { inScope: ['x'] },
      { title: 'Scope', inScopeHeading: 'In scope EN' },
    );
    expect(spec.title).toBe('Scope');
    expect((spec.blocks[0] as { text: string }).text).toBe('In scope EN');
  });

  it('returns zero blocks when all groups empty', () => {
    expect(buildScopeCardSpec({ inScope: [], outScope: [], killCriteria: [] }).blocks).toHaveLength(
      0,
    );
    expect(buildScopeCardSpec(null).blocks).toHaveLength(0);
    expect(buildScopeCardSpec(undefined).blocks).toHaveLength(0);
  });

  it('produced spec passes validateCardSpec with no CRITICAL when populated', () => {
    const spec = buildScopeCardSpec({ inScope: ['a'], outScope: ['b'] });
    expect(noCritical(spec)).toBe(true);
    expect(isBuiltSpecRenderable(spec)).toBe(true);
  });
});

// ── CONTROL ──────────────────────────────────────────────────────────────────

describe('buildControlCardSpec', () => {
  it('maps governance facts → single kpi_strip with one tile per present field', () => {
    const spec = buildControlCardSpec({
      module: 'Wdrożenie',
      status: 'W realizacji',
      priority: 'Wysoki',
      owner: 'Anna Kowalska',
    });
    expect(spec.sectionKey).toBe('control');
    expect(types(spec.blocks)).toEqual(['kpi_strip']);
    const strip = spec.blocks[0] as { tiles: Array<{ label: string; value: string }> };
    expect(strip.tiles).toHaveLength(4);
    expect(strip.tiles.map((t) => t.value)).toEqual([
      'Wdrożenie',
      'W realizacji',
      'Wysoki',
      'Anna Kowalska',
    ]);
  });

  it('includes only tiles for present fields and trims values', () => {
    const spec = buildControlCardSpec({ status: '  Aktywny  ', priority: '', owner: null });
    const strip = spec.blocks[0] as { tiles: Array<{ label: string; value: string }> };
    expect(strip.tiles).toHaveLength(1);
    expect(strip.tiles[0].value).toBe('Aktywny');
  });

  it('honors provided i18n labels', () => {
    const spec = buildControlCardSpec(
      { status: 'Active' },
      { title: 'Control', statusLabel: 'Status EN' },
    );
    expect(spec.title).toBe('Control');
    const strip = spec.blocks[0] as { tiles: Array<{ label: string }> };
    expect(strip.tiles[0].label).toBe('Status EN');
  });

  it('returns zero blocks when no facts present', () => {
    expect(buildControlCardSpec({}).blocks).toHaveLength(0);
    expect(buildControlCardSpec(null).blocks).toHaveLength(0);
  });

  it('produced spec passes validateCardSpec with no CRITICAL when populated', () => {
    const spec = buildControlCardSpec({ module: 'M', status: 'S' });
    expect(noCritical(spec)).toBe(true);
    expect(isBuiltSpecRenderable(spec)).toBe(true);
  });
});

// ── KPIs ─────────────────────────────────────────────────────────────────────

describe('buildKpisCardSpec', () => {
  it('maps KPI rows → 5-column table (name/baseline/current/target/unit)', () => {
    const spec = buildKpisCardSpec([
      { name: 'Czas cyklu', unit: 'dni', baseline: '14', current: '10', target: '7' },
      { name: 'NPS', unit: 'pkt', baseline: '20', current: '35', target: '50' },
    ]);
    expect(spec.sectionKey).toBe('kpis');
    expect(types(spec.blocks)).toEqual(['table']);
    const table = spec.blocks[0] as { columns: string[]; rows: string[][] };
    expect(table.columns).toHaveLength(5);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual(['Czas cyklu', '14', '10', '7', 'dni']);
    // every row matches the column count (validateCardSpec table-shape contract)
    expect(table.rows.every((r) => r.length === table.columns.length)).toBe(true);
  });

  it('skips rows without a name and dashes empty cells', () => {
    const spec = buildKpisCardSpec([
      { name: '', unit: 'x' },
      { name: 'Tylko nazwa' },
    ]);
    const table = spec.blocks[0] as { rows: string[][] };
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toEqual(['Tylko nazwa', '—', '—', '—', '—']);
  });

  it('honors provided i18n labels for title and columns', () => {
    const spec = buildKpisCardSpec([{ name: 'm' }], {
      title: 'KPIs',
      columnName: 'Metric',
      columnTarget: 'Goal',
    });
    expect(spec.title).toBe('KPIs');
    const table = spec.blocks[0] as { columns: string[] };
    expect(table.columns[0]).toBe('Metric');
    expect(table.columns[3]).toBe('Goal');
  });

  it('returns zero blocks for empty/undefined input', () => {
    expect(buildKpisCardSpec([]).blocks).toHaveLength(0);
    expect(buildKpisCardSpec(null).blocks).toHaveLength(0);
    expect(buildKpisCardSpec(undefined).blocks).toHaveLength(0);
  });

  it('produced spec passes validateCardSpec with no CRITICAL when populated', () => {
    const spec = buildKpisCardSpec([{ name: 'KPI', target: '100' }]);
    expect(noCritical(spec)).toBe(true);
    expect(isBuiltSpecRenderable(spec)).toBe(true);
  });
});
