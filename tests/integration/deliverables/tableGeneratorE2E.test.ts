// @vitest-environment node
/**
 * tableGeneratorE2E — przepuszcza deck-scenariusze M20 przez PRAWDZIWY
 * `generateTableSchema` (B4) z mock-LLM i scoruje wynik.
 *
 * WAŻNE ODKRYCIE (udokumentowane testem):
 * Obecny B4 (`tableSchemaGeneratorService`) zwraca TYLKO {fields, seedRows} —
 * NIE emituje conditionalFormatting / hasFormulas / sheets. Te są
 * rozszerzeniami (X2 WorkbookBuilder CF + przyszła B4-extension). Dlatego:
 *   - scenariusze BEZ CF/formuł/multi-sheet (głównie Sml + część Med) →
 *     przechodzą przez B4 i scorują pass (REACHABLE dziś)
 *   - scenariusze z requireCfRule/requireFormulas/requireMultiSheet →
 *     NIE są osiągalne przez obecny B4 (NEED-EXTENSION) — test je liczy
 *     i wypisuje jako known-gap, nie jako porażkę
 *
 * To jest precyzyjna mapa: co B4 już potrafi vs co wymaga dobudowania, zanim
 * te scenariusze przejdą w live mode.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TABLE_SCENARIOS } from './catalog/tables.js';
import { scoreTable } from './scoring/tableScoring.js';

const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));
vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  default: { select: vi.fn(async () => ({ id: 'premium', provider: 'anthropic' })) },
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

/**
 * Scenariusz wymaga rozszerzenia B4 TYLKO jeśli ma multi-sheet.
 * - CF: wspierane przez B4-ext (emisja conditionalFormatting by-fieldKey)
 * - Formuły: B4 przepuszcza stringi "=..." w seedRows + prompt zachęca →
 *   strukturalnie reachable
 * - Multi-sheet: GeneratedTableSchema nie ma sheets[] → genuinely need-extension
 */
function needsExtension(criteria: any): boolean {
  return Boolean(criteria.requireMultiSheet);
}

const CF_ELIGIBLE = new Set(['number', 'currency', 'percent', 'rating']);

const RULE_BY_TYPE: Record<string, any> = {
  dataBar: { type: 'dataBar', color: '#16A34A' },
  colorScale: { type: 'colorScale', colors: ['#DC2626', '#F59E0B', '#16A34A'] },
  iconSet: { type: 'iconSet', iconSet: '3Arrows' },
  cellIs: { type: 'cellIs', operator: 'greaterThan', formulae: ['100000'], style: { bgColor: '#DC2626', bold: true } },
};

/**
 * Buduje CF-input dla mock-LLM (kształt by-fieldKey) z criteria.requireCfRule.
 * Każdą wymaganą regułę przypisuje do CF-eligible pola (number/currency/percent/rating).
 */
function buildCfInput(criteria: any, fields: any[]): Array<{ fieldKey: string; rule: any }> {
  if (!criteria.requireCfRule) return [];
  const eligible = fields.filter((f) => CF_ELIGIBLE.has(f.type));
  if (eligible.length === 0) return [];
  const out: Array<{ fieldKey: string; rule: any }> = [];
  let idx = 0;
  for (const req of criteria.requireCfRule) {
    for (let i = 0; i < req.min; i++) {
      const field = eligible[idx % eligible.length];
      idx++;
      out.push({ fieldKey: field.key, rule: { ...RULE_BY_TYPE[req.type] } });
    }
  }
  return out;
}

describe('B4 table generator E2E — mapa reachable vs need-extension', () => {
  let generateTableSchema: typeof import('../../../server/src/services/tableSchemaGeneratorService.js').generateTableSchema;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    const mod = await import('../../../server/src/services/tableSchemaGeneratorService.js');
    generateTableSchema = mod.generateTableSchema;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('scenariusze BEZ CF/formuł/multi-sheet przechodzą przez prawdziwy B4', async () => {
    const reachable = TABLE_SCENARIOS.filter((e) => !needsExtension(e.criteria));
    const failures: string[] = [];

    for (const entry of reachable) {
      llmCall.mockReset();
      llmCall.mockResolvedValueOnce({
        object: {
          fields: entry.mockPass.fields.map((f) => ({
            key: f.key,
            header: f.header,
            type: f.type,
            options: f.options,
          })),
          seedRows: entry.mockPass.seedRows,
          conditionalFormatting: buildCfInput(entry.criteria, entry.mockPass.fields),
        },
      });

      const schema = await generateTableSchema(entry.meta.intent, {
        orgId: 'org-e2e',
        preferPremium: true,
      });

      // Adapter: GeneratedTableSchema → GeneratedTable (scoring shape).
      const report = scoreTable(
        {
          fields: schema.fields as any,
          seedRows: schema.seedRows,
          conditionalFormatting: schema.conditionalFormatting,
          hasFormulas: schema.hasFormulas,
        },
        entry.criteria
      );
      if (!report.passed) {
        failures.push(
          `${entry.meta.id}: ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }

    expect(
      failures,
      `\nB4 zdegradował reachable scenariusze:\n${failures.join('\n')}`
    ).toEqual([]);
    // Sanity: jest co najmniej kilkanaście reachable scenariuszy.
    expect(reachable.length).toBeGreaterThanOrEqual(12);
  });

  it('mapa gap: ile scenariuszy wymaga rozszerzenia B4 (CF/formuły/multi-sheet)', () => {
    const needExt = TABLE_SCENARIOS.filter((e) => needsExtension(e.criteria));
    const reachable = TABLE_SCENARIOS.filter((e) => !needsExtension(e.criteria));

    // Udokumentowany podział — gdy B4 zostanie rozszerzone, ten test się zmieni.
    const needExtIds = needExt.map((e) => e.meta.id);
    expect(reachable.length + needExt.length).toBe(30);

    // Known gap: scenariusze Lrg z CF + Xtr z formułami/multi-sheet.
    // (Informacyjne — jeśli liczba spadnie, znaczy że B4 rozszerzone.)
    expect(needExt.length).toBeGreaterThan(0);
    // Wszystkie need-extension to Lrg/Xtr (CF zaczyna się od S16).
    for (const e of needExt) {
      const num = parseInt(e.meta.id.match(/S(\d+)/)![1], 10);
      expect(num, `${e.meta.id} powinien być Lrg/Xtr (≥16)`).toBeGreaterThanOrEqual(16);
    }
    // Log dla widoczności.
    // eslint-disable-next-line no-console
    console.log(`[B4 gap map] reachable=${reachable.length}, need-extension=${needExt.length}: ${needExtIds.join(', ')}`);
  });

  it('STANDARD tier → fallback 3-text-col, NIE woła LLM', async () => {
    flagState.premium = false;
    const schema = await generateTableSchema('jakakolwiek tabela', { orgId: 'org-e2e' });
    expect(schema.fallbackUsed).toBe(true);
    expect(schema.tierUsed).toBe('STANDARD');
    expect(llmCall).not.toHaveBeenCalled();
  });
});
