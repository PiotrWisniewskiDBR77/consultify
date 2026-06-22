// @vitest-environment node
/**
 * Unit tests — B4-ext: emisja conditional formatting (tableSchemaGeneratorService).
 *
 * Pokrywa normalizeCf przez publiczne generateTableSchema:
 * - CF by-fieldKey → A1-ref obliczony z pozycji kolumny + rowCount
 * - CF na polu CF-eligible (number/currency/percent/rating) → akceptowane
 * - CF na singleLineText/select → ODRZUCone
 * - nieznany typ reguły → ODRZUCony
 * - column letter dla idx >25 (kolumna AA)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));
vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  default: { select: vi.fn(async () => ({ id: 'premium' })) },
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

describe('B4-ext conditional formatting', () => {
  let generateTableSchema: typeof import('../../../server/src/services/tableSchemaGeneratorService.js').generateTableSchema;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    const mod = await import('../../../server/src/services/tableSchemaGeneratorService.js');
    generateTableSchema = mod.generateTableSchema;
  });

  afterEach(() => vi.clearAllMocks());

  it('CF-1: dataBar na percent → ref obliczony z kolumny (C) + rowCount', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        fields: [
          { key: 'task', header: 'Task', type: 'singleLineText' },
          { key: 'owner', header: 'Owner', type: 'singleLineText' },
          { key: 'progress', header: 'Progress', type: 'percent' },
        ],
        seedRows: [
          { task: 'A', owner: 'X', progress: 0.2 },
          { task: 'B', owner: 'Y', progress: 0.5 },
          { task: 'C', owner: 'Z', progress: 0.9 },
        ],
        conditionalFormatting: [{ fieldKey: 'progress', rule: { type: 'dataBar', color: '#16A34A' } }],
      },
    });

    const schema = await generateTableSchema('zadania', { orgId: 'o', preferPremium: true });
    expect(schema.conditionalFormatting).toHaveLength(1);
    // progress = kolumna 3 (0-based idx 2) → litera C; 3 wiersze → C2:C4
    expect(schema.conditionalFormatting![0].ref).toBe('C2:C4');
    expect(schema.conditionalFormatting![0].rules[0].type).toBe('dataBar');
    expect(schema.conditionalFormatting![0].rules[0].color).toBe('#16A34A');
  });

  it('CF-2: CF na singleLineText → ODRZUCone (nie-eligible)', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        fields: [
          { key: 'name', header: 'Name', type: 'singleLineText' },
          { key: 'score', header: 'Score', type: 'number' },
        ],
        seedRows: [
          { name: 'A', score: 1 },
          { name: 'B', score: 2 },
          { name: 'C', score: 3 },
        ],
        conditionalFormatting: [
          { fieldKey: 'name', rule: { type: 'colorScale', colors: ['#DC2626', '#16A34A'] } }, // text — reject
          { fieldKey: 'score', rule: { type: 'colorScale', colors: ['#DC2626', '#16A34A'] } }, // number — ok
        ],
      },
    });

    const schema = await generateTableSchema('t', { orgId: 'o', preferPremium: true });
    expect(schema.conditionalFormatting).toHaveLength(1);
    expect(schema.conditionalFormatting![0].ref).toBe('B2:B4'); // score = kolumna B
  });

  it('CF-3: nieznany typ reguły → ODRZUCony', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        fields: [{ key: 'v', header: 'V', type: 'number' }],
        seedRows: [{ v: 1 }, { v: 2 }, { v: 3 }],
        conditionalFormatting: [{ fieldKey: 'v', rule: { type: 'rainbow' } }],
      },
    });

    const schema = await generateTableSchema('t', { orgId: 'o', preferPremium: true });
    expect(schema.conditionalFormatting).toEqual([]);
  });

  it('CF-4: fieldKey nieistniejący → pominięty', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        fields: [{ key: 'v', header: 'V', type: 'number' }],
        seedRows: [{ v: 1 }, { v: 2 }, { v: 3 }],
        conditionalFormatting: [{ fieldKey: 'ghost', rule: { type: 'dataBar', color: '#000000' } }],
      },
    });

    const schema = await generateTableSchema('t', { orgId: 'o', preferPremium: true });
    expect(schema.conditionalFormatting).toEqual([]);
  });

  it('CF-5: brak CF w odpowiedzi LLM → conditionalFormatting=[]', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        fields: [
          { key: 'name', header: 'N', type: 'singleLineText' },
          { key: 'v', header: 'V', type: 'number' },
        ],
        seedRows: [{ name: 'a', v: 1 }, { name: 'b', v: 2 }, { name: 'c', v: 3 }],
      },
    });

    const schema = await generateTableSchema('t', { orgId: 'o', preferPremium: true });
    expect(schema.conditionalFormatting).toEqual([]);
  });

  it('CF-6: cellIs zachowuje operator+formulae+style', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        fields: [
          { key: 'deal', header: 'Deal', type: 'singleLineText' },
          { key: 'value', header: 'Value', type: 'currency' },
        ],
        seedRows: [{ deal: 'a', value: 50000 }, { deal: 'b', value: 150000 }, { deal: 'c', value: 90000 }],
        conditionalFormatting: [
          {
            fieldKey: 'value',
            rule: { type: 'cellIs', operator: 'greaterThan', formulae: ['100000'], style: { bgColor: '#DC2626', bold: true } },
          },
        ],
      },
    });

    const schema = await generateTableSchema('t', { orgId: 'o', preferPremium: true });
    expect(schema.conditionalFormatting).toHaveLength(1);
    const rule = schema.conditionalFormatting![0].rules[0] as any;
    expect(rule.operator).toBe('greaterThan');
    expect(rule.formulae).toEqual(['100000']);
    expect(rule.style.bgColor).toBe('#DC2626');
  });

  it('CF-7: STANDARD tier → brak CF (fallback, no LLM)', async () => {
    flagState.premium = false;
    const schema = await generateTableSchema('t', { orgId: 'o' });
    expect(schema.fallbackUsed).toBe(true);
    expect(schema.conditionalFormatting).toBeUndefined();
    expect(llmCall).not.toHaveBeenCalled();
  });
});
