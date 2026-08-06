import type { WorkbookSchema } from './WorkbookSchema.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseAmount(input: string): number | undefined {
  const value = Number(input.replace(/[\s,.]/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

function parseAmountList(input: string): number[] {
  return input
    .split(/[,;]+/)
    .map(parseAmount)
    .filter((value): value is number => value !== undefined);
}

/**
 * Fast, deterministic lane for an explicitly specified 12-month initiative
 * budget. It deliberately requires all twelve actual values; underspecified
 * requests continue through the general AI workbook pipeline.
 */
export function buildDeterministicInitiativeBudgetFromPrompt(
  prompt: string
): WorkbookSchema | null {
  const normalized = prompt.toLowerCase();
  if (!/(initiative budget|bud[żz]et\S* inicjatyw)/i.test(normalized)) return null;
  if (!/(12[ -]?(month|miesi)|stycz|january)/i.test(normalized)) return null;

  const totalMatch = prompt.match(/(?:total budget|bud[żz]et ca[łl]kowity)[^\d]*(\d[\d\s.,]*)/i);
  const planMatch = prompt.match(/(?:monthly plan|plan miesi[ęe]czny)[^\d]*(\d[\d\s.,]*)/i);
  const actualSection = prompt.match(
    /(?:actual costs|faktyczne koszty)\s*:\s*([\d\s,.;]+?)(?:\s*(?:EUR|PLN|USD)\b|$)/i
  );
  const totalBudget = totalMatch ? parseAmount(totalMatch[1]) : undefined;
  const monthlyPlan = planMatch ? parseAmount(planMatch[1]) : undefined;
  const actuals = actualSection ? parseAmountList(actualSection[1]) : [];
  if (!totalBudget || !monthlyPlan || actuals.length !== 12) return null;

  const currency = /\bPLN\b/i.test(prompt) ? 'PLN' : /\bUSD\b/i.test(prompt) ? 'USD' : 'EUR';
  const moneyFormat = currency === 'EUR' ? '#,##0.00 [$EUR]' : currency === 'USD' ? '$#,##0.00' : '#,##0.00 [$PLN]';
  const titleMatch = prompt.match(/[„"]([^”"]*Initiative Budget[^”"]*)[”"]/i);
  const title = titleMatch?.[1]?.trim() || 'Initiative Budget — 12 months';

  const inputRows = [
    { cells: { parameter: { value: 'Approved funding input' }, value: { value: totalBudget, style: { numberFormat: moneyFormat } } } },
    { cells: { parameter: { value: 'Monthly plan' }, value: { value: monthlyPlan, style: { numberFormat: moneyFormat } } } },
    ...MONTHS.map((month, index) => ({
      cells: {
        parameter: { value: `${month} actual` },
        value: { value: actuals[index], style: { numberFormat: moneyFormat } },
      },
    })),
  ];

  const monthlyRows = MONTHS.map((month, index) => {
    const row = index + 2;
    const inputActualRow = index + 4;
    return {
      cells: {
        month: { value: month },
        plan: { formula: "'Inputs'!B3", style: { numberFormat: moneyFormat } },
        actual: { formula: `'Inputs'!B${inputActualRow}`, style: { numberFormat: moneyFormat } },
        variance: { formula: `B${row}-C${row}`, style: { numberFormat: moneyFormat } },
        cumulativePlan: { formula: `SUM($B$2:B${row})`, style: { numberFormat: moneyFormat } },
        cumulativeActual: { formula: `SUM($C$2:C${row})`, style: { numberFormat: moneyFormat } },
        utilization: { formula: `IF(E${row}=0,0,F${row}/E${row})`, style: { numberFormat: '0.0%' } },
      },
    };
  });

  return {
    title,
    description: 'Deterministic 12-month initiative budget with plan, actuals, variance, cumulative totals and utilization formulas.',
    author: 'Consultify Teresa',
    metadata: { generationMode: 'deterministic_initiative_budget', currency },
    sheets: [
      {
        name: 'Inputs', purpose: 'Auditable source assumptions and actual costs.',
        columns: [
          { key: 'parameter', header: 'Input', type: 'text', width: 28 },
          { key: 'value', header: `Value (${currency})`, type: 'currency', width: 18 },
        ], rows: inputRows, freezeRow: 1, tabColor: '0C447C',
      },
      {
        name: 'Monthly Budget', purpose: 'Formula-driven monthly plan-versus-actual model.',
        columns: [
          { key: 'month', header: 'Month', type: 'text', width: 16 },
          { key: 'plan', header: 'Plan', type: 'currency', width: 16 },
          { key: 'actual', header: 'Actual', type: 'currency', width: 16 },
          { key: 'variance', header: 'Variance', type: 'currency', width: 16 },
          { key: 'cumulativePlan', header: 'Cumulative plan', type: 'currency', width: 20 },
          { key: 'cumulativeActual', header: 'Cumulative actual', type: 'currency', width: 20 },
          { key: 'utilization', header: 'Utilization %', type: 'percent', width: 16 },
        ], rows: monthlyRows, freezeRow: 1, freezeCol: 1, tabColor: '1D9E75',
      },
      {
        name: 'Summary', purpose: 'Formula-driven annual management summary.',
        columns: [
          { key: 'metric', header: 'Metric', type: 'text', width: 28 },
          { key: 'value', header: 'Value', type: 'number', width: 20 },
        ],
        rows: [
          { cells: { metric: { value: 'Total budget' }, value: { formula: "'Inputs'!B2", style: { numberFormat: moneyFormat } } }, isSummary: true },
          { cells: { metric: { value: 'Annual plan' }, value: { formula: "SUM('Monthly Budget'!B2:B13)", style: { numberFormat: moneyFormat } } }, isSummary: true },
          { cells: { metric: { value: 'Annual actual' }, value: { formula: "SUM('Monthly Budget'!C2:C13)", style: { numberFormat: moneyFormat } } }, isSummary: true },
          { cells: { metric: { value: 'Annual variance' }, value: { formula: 'B3-B4', style: { numberFormat: moneyFormat } } }, isSummary: true },
          { cells: { metric: { value: 'Utilization %' }, value: { formula: 'IF(B3=0,0,B4/B3)', style: { numberFormat: '0.0%' } } }, isSummary: true },
        ], freezeRow: 1, tabColor: '7C3AED',
      },
    ],
  };
}
