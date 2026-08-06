import type { Cell, ColumnDef, Row, Sheet, WorkbookSchema } from '../WorkbookSchema.js';

export interface BenefitsRealizationParams {
  programName?: string;
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  investment?: number;
  revenueBenefit?: number;
  costBenefit?: number;
  workingCapitalBenefit?: number;
  confidencePct?: number;
  realizationPct?: number;
}

export const BENEFITS_REALIZATION_DEFAULTS = {
  programName: 'Program transformacji', currencyCode: 'PLN' as const,
  investment: 2_400_000, revenueBenefit: 1_800_000, costBenefit: 1_200_000,
  workingCapitalBenefit: 600_000, confidencePct: 0.8, realizationPct: 0.65,
};

const fmt = (code: string) => code === 'EUR' ? '€#,##0;[Red](€#,##0);"–"' : code === 'USD' ? '$#,##0;[Red]($#,##0);"–"' : '# ##0" zł";[Red](# ##0" zł");"–"';
const input = (value: number, numberFormat: string): Cell => ({
  value, style: { bgColor: 'FFF3D6', border: 'thin', numberFormat },
  validation: { type: 'decimal', operator: 'greaterThanOrEqual', min: 0, allowBlank: false },
});

export function buildBenefitsRealizationSchema(p: BenefitsRealizationParams = {}): WorkbookSchema {
  const d = { ...BENEFITS_REALIZATION_DEFAULTS, ...p };
  const cur = fmt(d.currencyCode);
  const assumptions: Sheet = {
    name: 'Assumptions', purpose: 'Kontrolowane wejścia biznesowe — żadne korzyści nie są zaszyte w formułach.',
    columns: [
      { key: 'driver', header: 'Założenie', type: 'text', width: 38 },
      { key: 'value', header: 'Wartość', type: 'number', width: 20 },
      { key: 'owner', header: 'Właściciel dowodu', type: 'text', width: 24 },
      { key: 'source', header: 'Źródło / system', type: 'text', width: 28 },
    ],
    rows: [
      { cells: { driver: { value: 'Nakład inwestycyjny', style: { bold: true } }, value: input(d.investment, cur), owner: { value: 'CFO / Program Director' }, source: { value: 'Approved investment case' } } },
      { cells: { driver: { value: 'Korzyść przychodowa — plan roczny' }, value: input(d.revenueBenefit, cur), owner: { value: 'Commercial Director' }, source: { value: 'CRM + revenue ledger' } } },
      { cells: { driver: { value: 'Redukcja kosztów — plan roczny' }, value: input(d.costBenefit, cur), owner: { value: 'COO' }, source: { value: 'ERP cost centres' } } },
      { cells: { driver: { value: 'Uwolnienie kapitału obrotowego' }, value: input(d.workingCapitalBenefit, cur), owner: { value: 'CFO' }, source: { value: 'ERP balance sheet' } } },
      { cells: { driver: { value: 'Pewność estymacji' }, value: input(d.confidencePct, '0%'), owner: { value: 'Benefits Office' }, source: { value: 'Evidence review' } } },
      { cells: { driver: { value: 'Realizacja planu YTD' }, value: input(d.realizationPct, '0%'), owner: { value: 'PMO' }, source: { value: 'Monthly benefits sign-off' } } },
      { cells: { driver: { value: 'Mnożnik Downside' }, value: input(0.7, '0%'), owner: { value: 'CFO' }, source: { value: 'Scenario workshop' } } },
      { cells: { driver: { value: 'Mnożnik Base' }, value: input(1, '0%'), owner: { value: 'CFO' }, source: { value: 'Approved business case' } } },
      { cells: { driver: { value: 'Mnożnik Upside' }, value: input(1.25, '0%'), owner: { value: 'CFO' }, source: { value: 'Scenario workshop' } } },
    ],
    freezeRow: 1, isAssumptions: true, nameKeyColumn: 'driver', nameValueColumn: 'value',
    showGridLines: false, tabColor: 'D8A928',
  };

  const benefitColumns: ColumnDef[] = [
    { key: 'benefit', header: 'Strumień korzyści', type: 'text', width: 34 },
    { key: 'plan', header: 'Plan roczny', type: 'number' },
    { key: 'riskAdjusted', header: 'Plan risk-adjusted', type: 'number' },
    { key: 'realized', header: 'Zrealizowano YTD', type: 'number' },
    { key: 'gap', header: 'Luka do planu', type: 'number' },
  ];
  const benefitRow = (label: string, assumptionRow: number, outputRow: number): Row => ({ cells: {
    benefit: { value: label, style: { bold: true } },
    plan: { formula: `'Assumptions'!B${assumptionRow}`, style: { numberFormat: cur } },
    riskAdjusted: { formula: `B${outputRow}*'Assumptions'!$B$6`, style: { numberFormat: cur } },
    realized: { formula: `C${outputRow}*'Assumptions'!$B$7`, style: { numberFormat: cur } },
    gap: { formula: `C${outputRow}-D${outputRow}`, style: { numberFormat: cur } },
  }});
  // Sheet rows 2..4 intentionally align with assumption rows 3..5.
  const benefits: Sheet = {
    name: 'Benefits Register', purpose: 'Plan, plan skorygowany o pewność, realizacja i luka dla każdego strumienia.',
    columns: benefitColumns,
    rows: [benefitRow('Wzrost przychodów', 3, 2), benefitRow('Redukcja kosztów', 4, 3), benefitRow('Kapitał obrotowy', 5, 4), {
      isSummary: true, cells: {
        benefit: { value: 'RAZEM', style: { bold: true, bgColor: 'DCEFEA' } },
        plan: { formula: 'SUM(B2:B4)', style: { bold: true, numberFormat: cur } },
        riskAdjusted: { formula: 'SUM(C2:C4)', style: { bold: true, numberFormat: cur } },
        realized: { formula: 'SUM(D2:D4)', style: { bold: true, numberFormat: cur } },
        gap: { formula: 'SUM(E2:E4)', style: { bold: true, numberFormat: cur } },
      }
    }],
    freezeRow: 1, showGridLines: false, tabColor: '1D9E75',
    conditionalFormatting: [{ ref: 'E2:E5', rules: [{ type: 'dataBar', color: 'D97706' }] }],
  };

  const scenarios: Sheet = {
    name: 'Scenario Model', purpose: 'Downside / Base / Upside — dynamiczny wpływ na wartość, ROI i payback.',
    columns: [
      { key: 'metric', header: 'Metryka', type: 'text', width: 34 },
      { key: 'downside', header: 'Downside', type: 'number' },
      { key: 'base', header: 'Base', type: 'number' },
      { key: 'upside', header: 'Upside', type: 'number' },
    ],
    rows: [
      { cells: { metric: { value: 'Mnożnik scenariusza', style: { bold: true } }, downside: { formula: `'Assumptions'!B8`, style: { numberFormat: '0%' } }, base: { formula: `'Assumptions'!B9`, style: { numberFormat: '0%' } }, upside: { formula: `'Assumptions'!B10`, style: { numberFormat: '0%' } } } },
      { cells: { metric: { value: 'Korzyści risk-adjusted' }, downside: { formula: `'Benefits Register'!$C$5*B2`, style: { numberFormat: cur } }, base: { formula: `'Benefits Register'!$C$5*C2`, style: { numberFormat: cur } }, upside: { formula: `'Benefits Register'!$C$5*D2`, style: { numberFormat: cur } } } },
      { cells: { metric: { value: 'ROI' }, downside: { formula: `(B3-'Assumptions'!$B$2)/'Assumptions'!$B$2`, style: { numberFormat: '0.0%' } }, base: { formula: `(C3-'Assumptions'!$B$2)/'Assumptions'!$B$2`, style: { numberFormat: '0.0%' } }, upside: { formula: `(D3-'Assumptions'!$B$2)/'Assumptions'!$B$2`, style: { numberFormat: '0.0%' } } } },
      { cells: { metric: { value: 'Payback (miesiące)' }, downside: { formula: `'Assumptions'!$B$2/(B3/12)`, style: { numberFormat: '0.0' } }, base: { formula: `'Assumptions'!$B$2/(C3/12)`, style: { numberFormat: '0.0' } }, upside: { formula: `'Assumptions'!$B$2/(D3/12)`, style: { numberFormat: '0.0' } } } },
    ],
    freezeRow: 1, showGridLines: false, tabColor: '6D5BD0',
    conditionalFormatting: [{ ref: 'B3:D5', rules: [{ type: 'colorScale', colors: ['FCE4E4', 'FFF3CD', 'E4F4EC'] }] }],
  };

  const months = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
  const monthly: Sheet = {
    name: 'Monthly Tracking', purpose: 'Miesięczny plan, realized i skumulowana luka — bez ręcznych sum.',
    columns: [
      { key: 'month', header: 'Miesiąc', type: 'text', width: 16 },
      { key: 'plan', header: 'Plan risk-adjusted', type: 'number' },
      { key: 'realized', header: 'Realized', type: 'number' },
      { key: 'variance', header: 'Variance', type: 'number' },
      { key: 'cumulative', header: 'Cumulative realized', type: 'number' },
    ],
    rows: months.map((month, index) => {
      const row = index + 2;
      return { cells: {
        month: { value: month },
        plan: { formula: `'Benefits Register'!$C$5/12`, style: { numberFormat: cur } },
        realized: { formula: `B${row}*'Assumptions'!$B$7`, style: { numberFormat: cur } },
        variance: { formula: `C${row}-B${row}`, style: { numberFormat: cur } },
        cumulative: { formula: `SUM($C$2:C${row})`, style: { numberFormat: cur } },
      }};
    }),
    freezeRow: 1, showGridLines: false, tabColor: '0C447C',
    conditionalFormatting: [{ ref: 'D2:D13', rules: [{ type: 'dataBar', color: 'C2415D' }] }],
  };

  const summary: Sheet = {
    name: 'Executive Summary', purpose: 'Jednostronicowa karta decyzji dla sponsora i CFO.',
    columns: [{ key: 'metric', header: 'KPI / decyzja', type: 'text', width: 38 }, { key: 'value', header: 'Wartość', type: 'number', width: 22 }],
    rows: [
      { cells: { metric: { value: 'Nakład inwestycyjny', style: { bold: true } }, value: { formula: `'Assumptions'!B2`, style: { numberFormat: cur } } } },
      { cells: { metric: { value: 'Korzyści risk-adjusted' }, value: { formula: `'Benefits Register'!C5`, style: { numberFormat: cur } } } },
      { cells: { metric: { value: 'Zrealizowane korzyści YTD' }, value: { formula: `'Benefits Register'!D5`, style: { numberFormat: cur } } } },
      { cells: { metric: { value: 'ROI risk-adjusted' }, value: { formula: `('Benefits Register'!C5-'Assumptions'!B2)/'Assumptions'!B2`, style: { bold: true, numberFormat: '0.0%' } } } },
      { cells: { metric: { value: 'Pokrycie planu YTD' }, value: { formula: `'Benefits Register'!D5/'Benefits Register'!C5`, style: { bold: true, numberFormat: '0.0%' } } } },
    ],
    freezeRow: 1, showGridLines: false, tabColor: '164E63',
    conditionalFormatting: [{ ref: 'B5:B6', rules: [{ type: 'colorScale', colors: ['FCE4E4', 'FFF3CD', 'E4F4EC'] }] }],
  };
  return { title: `${d.programName} — Benefits Realization`, description: 'Board-ready model korzyści: dashboard, założenia i źródła, rejestr, scenariusze oraz miesięczny tracking.', author: 'Consultify', sheets: [summary, assumptions, benefits, scenarios, monthly], metadata: { template: 'benefitsRealization', currency: d.currencyCode } };
}
