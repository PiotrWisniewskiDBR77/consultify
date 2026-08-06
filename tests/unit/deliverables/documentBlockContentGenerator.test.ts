// @vitest-environment node
/**
 * Unit tests — documentBlockContentGenerator (content-gen layer doc).
 *
 * Pokrywa normalizery (kpi clamp 3-5, chart palette≤7/series≤6, callout tone,
 * table rows, list, quote) + generateDocumentContent (premium/STANDARD/fail-open).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
const flagState = { premium: true };
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  default: {
    get ENABLE_DELIVERABLES_PREMIUM() {
      return flagState.premium;
    },
  },
}));

describe('documentBlockContentGenerator — normalizery', () => {
  let mod: typeof import('../../../server/src/services/documentStudio/documentBlockContentGenerator.js');

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    mod =
      await import('../../../server/src/services/documentStudio/documentBlockContentGenerator.js');
  });
  afterEach(() => vi.clearAllMocks());

  it('KPI: <3 itemy → dopełnione do 3; >5 → przycięte do 5', () => {
    expect(
      mod.normalizeKpiContent({ items: [{ label: 'A', value: '1', delta: '+1%' }] }).items as any[]
    ).toHaveLength(3);
    const big = mod.normalizeKpiContent({
      items: Array.from({ length: 8 }, (_, i) => ({ label: `K${i}`, value: '1', delta: '0' })),
    });
    expect(big.items as any[]).toHaveLength(5);
  });

  it('KPI: każdy item ma label/value/delta (uzupełnione gdy brak)', () => {
    const r = mod.normalizeKpiContent({ items: [{ label: 'X' }, {}, {}] });
    for (const it of r.items as any[]) {
      expect(it).toHaveProperty('label');
      expect(it).toHaveProperty('value');
      expect(it).toHaveProperty('delta');
    }
  });

  it('KPI: normalizuje alternatywny premium shape `kpis` do niepustego `items`', () => {
    const r = mod.normalizeKpiContent({
      kpis: [
        { label: 'Realizacja', value: '72%' },
        { label: 'Budżet', value: '1.4 mln EUR' },
        { label: 'Zakres', value: '18/21' },
      ],
    });
    expect(r.items).toEqual([
      { label: 'Realizacja', value: '72%', delta: '—' },
      { label: 'Budżet', value: '1.4 mln EUR', delta: '—' },
      { label: 'Zakres', value: '18/21', delta: '—' },
    ]);
  });

  it('Chart: paleta clamp ≤7 + series clamp ≤6 + kind walidowany', () => {
    const r = mod.normalizeChartContent({
      kind: 'rainbow', // invalid → bar
      series: Array.from({ length: 10 }, (_, i) => ({ label: `S${i}`, values: [1, 2, 3] })),
    });
    expect(r.kind).toBe('bar');
    expect(r.series as any[]).toHaveLength(6); // clamp ≤6
    const colors = new Set((r.series as any[]).map((s) => s.color));
    expect(colors.size).toBeLessThanOrEqual(7);
    expect(r.title).toBeTruthy();
    expect(r.xAxisLabel).toBeTruthy();
  });

  it('Chart: zachowuje valid kind (line/area/pie/donut/scatter)', () => {
    for (const kind of ['line', 'area', 'pie', 'donut', 'scatter']) {
      expect(mod.normalizeChartContent({ kind, series: [{ label: 'A', values: [1] }] }).kind).toBe(
        kind
      );
    }
  });

  it('Callout: tone walidowany ∈ {info,warning,danger,success}', () => {
    expect(mod.normalizeCalloutContent({ text: 'x', tone: 'panic' }).tone).toBe('info');
    expect(mod.normalizeCalloutContent({ text: 'x', tone: 'danger' }).tone).toBe('danger');
  });

  it('Table: normalizuje wiersze do {cells:{key:{value}}}', () => {
    const r = mod.normalizeTableContent({ rows: [{ a: 1, b: 2 }, { cells: { a: { value: 3 } } }] });
    expect(r.rows as any[]).toHaveLength(2);
    expect(r.columns).toEqual(['a', 'b']);
    expect(r.rows).toEqual([
      ['1', '2'],
      ['3', ''],
    ]);
  });

  it('Risk table: zachowuje jawne nagłówki i populację w kanonicznym shape', () => {
    const r = mod.normalizeTableContent({
      columns: ['Ryzyko', 'Wpływ', 'Mitygacja'],
      rows: [
        {
          cells: {
            Ryzyko: { value: 'Brak danych' },
            Wpływ: { value: 'Wysoki' },
            Mitygacja: { value: 'Walidacja' },
          },
        },
      ],
    });
    expect(r).toEqual({
      columns: ['Ryzyko', 'Wpływ', 'Mitygacja'],
      rows: [['Brak danych', 'Wysoki', 'Walidacja']],
    });
  });

  // ──────────────────────────────────────────────────────────────
  // generateDocumentContent
  // ──────────────────────────────────────────────────────────────

  const PLAN = {
    sections: [
      { title: 'KPI', purpose: '', blocks: [{ type: 'kpi_strip', hint: '4 KPI' }] },
      { title: 'Trend', purpose: '', blocks: [{ type: 'chart', hint: 'line trend' }] },
    ],
  };

  it('PREMIUM happy: LLM content → znormalizowane bloki', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        blocks: [
          { blockId: 'b-0-0', content: { items: [{ label: 'Rev', value: '12M', delta: '+8%' }] } },
          {
            blockId: 'b-1-0',
            content: { kind: 'line', title: 'T', series: [{ label: 'A', values: [1, 2, 3] }] },
          },
        ],
      },
    });

    const result = await mod.generateDocumentContent('raport', PLAN, {
      orgId: 'o',
      preferPremium: true,
    });
    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(false);
    const kpiBlock = result.sections[0].blocks[0];
    expect(kpiBlock.type).toBe('kpi');
    expect((kpiBlock.content.items as any[]).length).toBeGreaterThanOrEqual(3); // clamp dopełnił
    const chartBlock = result.sections[1].blocks[0];
    expect(chartBlock.type).toBe('chart');
    expect(chartBlock.content.kind).toBe('line');
  });

  it('STANDARD → prozowy fallback (heading+paragraph), NIE woła LLM', async () => {
    flagState.premium = false;
    const result = await mod.generateDocumentContent('raport', PLAN, { orgId: 'o' });
    expect(result.tierUsed).toBe('STANDARD');
    expect(result.fallbackUsed).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
    expect(result.sections[0].blocks.map((b) => b.type)).toEqual(['heading', 'text']);
  });

  it('FAIL-OPEN: LLM throws → prozowy fallback, no throw', async () => {
    llmCall.mockRejectedValueOnce(new Error('LLM down'));
    const result = await mod.generateDocumentContent('raport', PLAN, {
      orgId: 'o',
      preferPremium: true,
    });
    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(true);
    expect(result.sections[0].blocks[0].type).toBe('heading');
  });

  it('citationCount → wstrzykuje cytowania', async () => {
    llmCall.mockResolvedValueOnce({
      object: { blocks: [{ blockId: 'b-0-0', content: { items: [] } }] },
    });
    const result = await mod.generateDocumentContent('r', PLAN, {
      orgId: 'o',
      preferPremium: true,
      citationCount: 5,
    });
    expect(result.citations).toHaveLength(5);
  });
});
