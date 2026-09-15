/**
 * Workbook model-template registry.
 *
 * A lightweight `templateId → builder` map so the model library grows by
 * REGISTRATION, not by rewiring the generator. Each builder takes a plain
 * params object and returns a COMPLETE, correct `WorkbookSchema` — the LLM (or a
 * caller) parametrizes a proven template instead of designing a model from
 * scratch. That is the whole reliability thesis of this library: the risky part
 * (formula chains, cross-sheet refs, assumptions separation) is fixed and
 * tested; only the numbers are variable.
 *
 * C3 (2026-07-22) — the registry is now SELF-DESCRIBING: each entry carries a
 * flat list of `params` descriptors (name/label/type/default/min-max) so a FE
 * can render a parameter form and a route can build a zod validator, WITHOUT the
 * caller knowing the builder's internal (possibly nested) param shape. `coerceParams`
 * turns the validated flat map back into the builder's native input.
 *
 * To add a template (e.g. DCF, budget-vs-actual):
 *   1. Implement `buildXxxSchema(params): WorkbookSchema` in its own file here,
 *      following the threeScenarioPnL pattern (every computed cell a formula,
 *      inputs on an assumptions sheet, no magic-numbers, formulas WITHOUT a
 *      leading `=`).
 *   2. Add an entry to `WORKBOOK_TEMPLATES` below with a short `id`, a human
 *      `title`, a `description`, a `params` descriptor list, the `build` fn, and
 *      (if the builder takes a nested shape) a `coerceParams` un-flattener.
 *   3. Add a focused read-back + math-verification test under `__tests__/`.
 *
 * Eight templates are registered today: `threeScenarioPnL` (flagship 3-scenario
 * P&L), `operatingBudget` (12-month operating budget), `dcfValuation`
 * (Discounted Cash Flow valuation), `breakEven` (break-even / BEP analysis),
 * `cashflow12m` (12-month cash-flow forecast), `unitEconomics` (SaaS unit
 * economics: LTV/CAC/payback/NRR + 12m churn-decay projection),
 * `loanAmortization` (loan amortization schedule, annuity payment), and
 * `projectViability` (project profitability assessment: NPV/IRR/payback/PI —
 * answers "does this PROJECT pay off", as opposed to `dcfValuation` which
 * values a whole COMPANY). The map is the extension point.
 */

import { z } from 'zod';

import type { WorkbookSchema } from '../WorkbookSchema.js';
import {
  BENEFITS_REALIZATION_DEFAULTS,
  buildBenefitsRealizationSchema,
  type BenefitsRealizationParams,
} from './benefitsRealization.js';
import {
  BREAK_EVEN_DRIVER_DEFAULTS,
  BREAK_EVEN_GENERAL_DEFAULTS,
  type BreakEvenParams,
  buildBreakEvenSchema,
} from './breakEven.js';
import {
  buildCashflow12mSchema,
  CASHFLOW_DRIVER_DEFAULTS,
  CASHFLOW_GENERAL_DEFAULTS,
  type Cashflow12mParams,
} from './cashflow12m.js';
import {
  buildDcfValuationSchema,
  DCF_DRIVER_DEFAULTS,
  DCF_GENERAL_DEFAULTS,
  type DcfValuationParams,
} from './dcfValuation.js';
import {
  buildLoanAmortizationSchema,
  LOAN_AMORTIZATION_DRIVER_DEFAULTS,
  LOAN_AMORTIZATION_GENERAL_DEFAULTS,
  type LoanAmortizationParams,
} from './loanAmortization.js';
import {
  buildOperatingBudgetSchema,
  OPERATING_BUDGET_DRIVER_DEFAULTS,
  OPERATING_BUDGET_GENERAL_DEFAULTS,
  type OperatingBudgetParams,
} from './operatingBudget.js';
import {
  buildProjectViabilitySchema,
  PROJECT_VIABILITY_DRIVER_DEFAULTS,
  PROJECT_VIABILITY_GENERAL_DEFAULTS,
  type ProjectViabilityParams,
} from './projectViability.js';
import {
  buildThreeScenarioPnLSchema,
  DEFAULT_BASE,
  DEFAULT_BEAR,
  DEFAULT_BULL,
  type ScenarioDrivers,
  THREE_SCENARIO_GENERAL_DEFAULTS,
  type ThreeScenarioPnLParams,
} from './threeScenarioPnL.js';
import {
  buildUnitEconomicsSchema,
  UNIT_ECONOMICS_DRIVER_DEFAULTS,
  UNIT_ECONOMICS_GENERAL_DEFAULTS,
  type UnitEconomicsParams,
} from './unitEconomics.js';
import { normalizeWorkbookLocale, t, type WorkbookLocale } from './templateLocale.js';

export { normalizeWorkbookLocale, type WorkbookLocale };

/** Stable identifiers for registered model templates. */
export type WorkbookTemplateId =
  | 'threeScenarioPnL'
  | 'operatingBudget'
  | 'dcfValuation'
  | 'breakEven'
  | 'cashflow12m'
  | 'unitEconomics'
  | 'loanAmortization'
  | 'projectViability'
  | 'benefitsRealization';

/** A FE-renderable, zod-validatable parameter type. */
export type WorkbookTemplateParamType =
  | 'text'
  | 'integer'
  | 'number'
  | 'percent' // fraction stored (0.08 = 8%); FE may show ×100
  | 'currency'
  | 'enum';

/**
 * One self-describing input of a template. `name` is a FLAT key — dotted when the
 * builder's native shape is nested (e.g. `base.cogsPct`) — so a FE form stays flat
 * and `coerceParams` reconstructs the nested object.
 */
export interface WorkbookTemplateParam {
  name: string;
  label: string;
  type: WorkbookTemplateParamType;
  default: string | number;
  min?: number;
  max?: number;
  step?: number;
  /** For `enum` types — the allowed values. */
  options?: string[];
  /** FE grouping hint (e.g. "Ogólne", "Base", "Bull", "Bear"). */
  group?: string;
  /** Optional one-line helper shown under the field. */
  help?: string;
}

/**
 * A registered template: metadata + descriptors + a params→schema builder.
 *
 * `title`/`description`/`params` are LOCALE-AWARE (DEC-461/F7b, 2026-09-14):
 * each takes an optional `WorkbookLocale` (default `'en'`) and returns the
 * resolved string(s) — English is the default value, Polish comes from the
 * `templateLocale.ts` dictionary. This keeps `buildTemplateParamsSchema`
 * (which only cares about `name`/`type`/`min`/`max`) locale-independent.
 */
export interface WorkbookTemplateEntry<P = any> {
  id: WorkbookTemplateId;
  /** Human-facing title (surfaced to the LLM/UI when choosing a template). */
  title: (locale?: WorkbookLocale) => string;
  /** One-line description of what the template models. */
  description: (locale?: WorkbookLocale) => string;
  /** Self-describing, FE-renderable parameter list (flat keys). */
  params: (locale?: WorkbookLocale) => WorkbookTemplateParam[];
  /** Build a complete WorkbookSchema from the template's NATIVE params. */
  build: (params: P) => WorkbookSchema;
  /**
   * Turn a validated FLAT param map (keys = `params[].name`) into the builder's
   * native input. Omit for templates whose native shape is already flat.
   */
  coerceParams?: (flat: Record<string, unknown>) => P;
}

// ---------------------------------------------------------------------------
// threeScenarioPnL — parameter descriptors
//
// Derived from the SAME default constants the builder clamps against, so the
// form defaults never drift from the model defaults.
// ---------------------------------------------------------------------------

/** The 6 scenario drivers, in vertical order, with EN labels + sane bounds. */
const DRIVER_FIELDS: Array<{
  key: keyof ScenarioDrivers;
  label: string;
  min: number;
  max: number;
}> = [
  { key: 'revenueGrowthPct', label: 'Revenue growth %/year', min: -1, max: 5 },
  { key: 'cogsPct', label: 'COGS % of revenue', min: 0, max: 1 },
  { key: 'opexPct', label: 'OPEX % of revenue', min: 0, max: 1 },
  { key: 'daPct', label: 'Depreciation & amortization (D&A) % of revenue', min: 0, max: 1 },
  { key: 'interestPct', label: 'Interest % of revenue', min: 0, max: 1 },
  { key: 'taxRatePct', label: 'Tax rate %', min: 0, max: 1 },
];

const SCENARIO_GROUPS: Array<{
  prefix: keyof ThreeScenarioPnLParams;
  label: string;
  defaults: ScenarioDrivers;
}> = [
  { prefix: 'base', label: 'Base (baseline)', defaults: DEFAULT_BASE },
  { prefix: 'bull', label: 'Bull (optimistic)', defaults: DEFAULT_BULL },
  { prefix: 'bear', label: 'Bear (pessimistic)', defaults: DEFAULT_BEAR },
];

function buildThreeScenarioParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  const params: WorkbookTemplateParam[] = [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: THREE_SCENARIO_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: THREE_SCENARIO_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'startYear',
      label: t(locale, 'First forecast year'),
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: t(locale, 'General'),
    },
    {
      name: 'baseRevenue',
      label: t(locale, 'Base-year revenue'),
      type: 'currency',
      default: THREE_SCENARIO_GENERAL_DEFAULTS.baseRevenue,
      min: 0,
      step: 1000,
      group: t(locale, 'General'),
    },
  ];

  for (const scen of SCENARIO_GROUPS) {
    for (const drv of DRIVER_FIELDS) {
      params.push({
        name: `${String(scen.prefix)}.${String(drv.key)}`,
        label: t(locale, drv.label),
        type: 'percent',
        default: scen.defaults[drv.key],
        min: drv.min,
        max: drv.max,
        step: 0.005,
        group: t(locale, scen.label),
      });
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// operatingBudget — parameter descriptors
// ---------------------------------------------------------------------------

function buildOperatingBudgetParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: OPERATING_BUDGET_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: OPERATING_BUDGET_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'startYear',
      label: t(locale, 'Budget year'),
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: t(locale, 'General'),
    },
    {
      name: 'baseMonthlyRevenue',
      label: t(locale, 'Revenue, month 1'),
      type: 'currency',
      default: OPERATING_BUDGET_GENERAL_DEFAULTS.baseMonthlyRevenue,
      min: 0,
      step: 1000,
      group: t(locale, 'Revenue'),
    },
    {
      name: 'monthlyRevenueGrowthPct',
      label: t(locale, 'Revenue growth m/m %'),
      type: 'percent',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.monthlyRevenueGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: t(locale, 'Revenue'),
    },
    {
      name: 'variableCostPct',
      label: t(locale, 'Variable costs % of revenue'),
      type: 'percent',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.variableCostPct,
      min: 0,
      max: 1,
      step: 0.005,
      group: t(locale, 'Variable costs'),
    },
    {
      name: 'rentMonthly',
      label: t(locale, 'Rent (month 1)'),
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.rentMonthly,
      min: 0,
      step: 100,
      group: t(locale, 'Fixed costs'),
    },
    {
      name: 'salariesMonthly',
      label: t(locale, 'Salaries (month 1)'),
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.salariesMonthly,
      min: 0,
      step: 100,
      group: t(locale, 'Fixed costs'),
    },
    {
      name: 'marketingMonthly',
      label: t(locale, 'Marketing (month 1)'),
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.marketingMonthly,
      min: 0,
      step: 100,
      group: t(locale, 'Fixed costs'),
    },
    {
      name: 'otherFixedMonthly',
      label: t(locale, 'Other fixed costs (month 1)'),
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.otherFixedMonthly,
      min: 0,
      step: 100,
      group: t(locale, 'Fixed costs'),
    },
    {
      name: 'fixedCostGrowthPct',
      label: t(locale, 'Fixed cost growth m/m %'),
      type: 'percent',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.fixedCostGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: t(locale, 'Fixed costs'),
    },
  ];
}

// ---------------------------------------------------------------------------
// dcfValuation — parameter descriptors
// ---------------------------------------------------------------------------

function buildDcfValuationParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: DCF_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: DCF_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'valuationYear',
      label: t(locale, 'Valuation year (year 0)'),
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: t(locale, 'General'),
    },
    {
      name: 'fcf0',
      label: t(locale, 'Base-year FCF (year 0)'),
      type: 'currency',
      default: DCF_GENERAL_DEFAULTS.fcf0,
      min: 0,
      step: 1000,
      group: t(locale, 'Projection'),
    },
    {
      name: 'fcfGrowthPct',
      label: t(locale, 'FCF growth (forecast) % per year'),
      type: 'percent',
      default: DCF_DRIVER_DEFAULTS.fcfGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: t(locale, 'Projection'),
    },
    {
      name: 'horizonYears',
      label: t(locale, 'Forecast horizon (years)'),
      type: 'integer',
      default: DCF_DRIVER_DEFAULTS.horizonYears,
      min: 3,
      max: 10,
      step: 1,
      group: t(locale, 'Projection'),
    },
    {
      name: 'waccPct',
      label: t(locale, 'WACC (discount rate) %'),
      type: 'percent',
      default: DCF_DRIVER_DEFAULTS.waccPct,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: t(locale, 'Discounting'),
    },
    {
      name: 'terminalGrowthPct',
      label: t(locale, 'Terminal growth (g) %'),
      type: 'percent',
      default: DCF_DRIVER_DEFAULTS.terminalGrowthPct,
      min: -0.5,
      max: 0.5,
      step: 0.005,
      group: t(locale, 'Discounting'),
    },
    {
      name: 'netDebt',
      label: t(locale, 'Net debt'),
      type: 'currency',
      default: DCF_DRIVER_DEFAULTS.netDebt,
      step: 1000,
      group: t(locale, 'EV → Equity bridge'),
    },
    {
      name: 'sharesOutstanding',
      label: t(locale, 'Shares outstanding'),
      type: 'number',
      default: DCF_DRIVER_DEFAULTS.sharesOutstanding,
      min: 1,
      step: 1000,
      group: t(locale, 'EV → Equity bridge'),
    },
  ];
}

// ---------------------------------------------------------------------------
// breakEven — parameter descriptors
// ---------------------------------------------------------------------------

function buildBreakEvenParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: BREAK_EVEN_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: BREAK_EVEN_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'unitPrice',
      label: t(locale, 'Unit price'),
      type: 'currency',
      default: BREAK_EVEN_GENERAL_DEFAULTS.unitPrice,
      min: 0.01,
      step: 1,
      group: t(locale, 'General'),
    },
    {
      name: 'variableCostPerUnit',
      label: t(locale, 'Variable cost per unit'),
      type: 'currency',
      default: BREAK_EVEN_DRIVER_DEFAULTS.variableCostPerUnit,
      min: 0,
      step: 1,
      group: t(locale, 'Costs'),
    },
    {
      name: 'fixedCosts',
      label: t(locale, 'Fixed costs'),
      type: 'currency',
      default: BREAK_EVEN_DRIVER_DEFAULTS.fixedCosts,
      min: 0,
      step: 1000,
      group: t(locale, 'Costs'),
    },
    {
      name: 'plannedVolume',
      label: t(locale, 'Planned sales volume (units)'),
      type: 'integer',
      default: BREAK_EVEN_DRIVER_DEFAULTS.plannedVolume,
      min: 0,
      step: 100,
      group: t(locale, 'Sales'),
    },
  ];
}

// ---------------------------------------------------------------------------
// cashflow12m — parameter descriptors
// ---------------------------------------------------------------------------

function buildCashflow12mParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: CASHFLOW_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: CASHFLOW_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'startYear',
      label: t(locale, 'Forecast year'),
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: t(locale, 'General'),
    },
    {
      name: 'openingBalance',
      label: t(locale, 'Opening balance'),
      type: 'currency',
      default: CASHFLOW_GENERAL_DEFAULTS.openingBalance,
      step: 1000,
      group: t(locale, 'General'),
    },
    {
      name: 'baseMonthlyRevenue',
      label: t(locale, 'Revenue, month 1'),
      type: 'currency',
      default: CASHFLOW_DRIVER_DEFAULTS.baseMonthlyRevenue,
      min: 0,
      step: 1000,
      group: t(locale, 'Revenue'),
    },
    {
      name: 'monthlyRevenueGrowthPct',
      label: t(locale, 'Revenue growth m/m %'),
      type: 'percent',
      default: CASHFLOW_DRIVER_DEFAULTS.monthlyRevenueGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: t(locale, 'Revenue'),
    },
    {
      name: 'paymentDelayMonths',
      label: t(locale, 'Payment delay (months)'),
      type: 'integer',
      default: CASHFLOW_DRIVER_DEFAULTS.paymentDelayMonths,
      min: 0,
      max: 3,
      step: 1,
      group: t(locale, 'Revenue'),
    },
    {
      name: 'monthlyCosts',
      label: t(locale, 'Costs, month 1'),
      type: 'currency',
      default: CASHFLOW_DRIVER_DEFAULTS.monthlyCosts,
      min: 0,
      step: 1000,
      group: t(locale, 'Costs'),
    },
    {
      name: 'costGrowthPct',
      label: t(locale, 'Cost growth m/m %'),
      type: 'percent',
      default: CASHFLOW_DRIVER_DEFAULTS.costGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: t(locale, 'Costs'),
    },
  ];
}

// ---------------------------------------------------------------------------
// unitEconomics — parameter descriptors
// ---------------------------------------------------------------------------

function buildUnitEconomicsParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: UNIT_ECONOMICS_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: UNIT_ECONOMICS_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'startingMrr',
      label: t(locale, 'Starting MRR'),
      type: 'currency',
      default: UNIT_ECONOMICS_GENERAL_DEFAULTS.startingMrr,
      min: 0,
      step: 1000,
      group: t(locale, 'General'),
    },
    {
      name: 'churnPctMonthly',
      label: t(locale, 'Churn m/m %'),
      type: 'percent',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.churnPctMonthly,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: t(locale, 'Input metrics'),
    },
    {
      name: 'cac',
      label: t(locale, 'CAC (customer acquisition cost)'),
      type: 'currency',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.cac,
      min: 0.01,
      step: 50,
      group: t(locale, 'Input metrics'),
    },
    {
      name: 'grossMarginPct',
      label: t(locale, 'Gross margin %'),
      type: 'percent',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.grossMarginPct,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: t(locale, 'Input metrics'),
    },
    {
      name: 'arpu',
      label: t(locale, 'ARPU (revenue / customer / month)'),
      type: 'currency',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.arpu,
      min: 0.01,
      step: 10,
      group: t(locale, 'Input metrics'),
    },
  ];
}

// ---------------------------------------------------------------------------
// loanAmortization — parameter descriptors
// ---------------------------------------------------------------------------

function buildLoanAmortizationParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: t(locale, 'Company name'),
      type: 'text',
      default: LOAN_AMORTIZATION_GENERAL_DEFAULTS.companyName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: LOAN_AMORTIZATION_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'loanAmount',
      label: t(locale, 'Loan amount'),
      type: 'currency',
      default: LOAN_AMORTIZATION_GENERAL_DEFAULTS.loanAmount,
      min: 0.01,
      step: 1000,
      group: t(locale, 'General'),
    },
    {
      name: 'annualInterestRatePct',
      label: t(locale, 'Annual interest rate %'),
      type: 'percent',
      default: LOAN_AMORTIZATION_DRIVER_DEFAULTS.annualInterestRatePct,
      min: 0.0001,
      max: 1,
      step: 0.001,
      group: t(locale, 'Loan terms'),
    },
    {
      name: 'termMonths',
      label: t(locale, 'Term (months)'),
      type: 'integer',
      default: LOAN_AMORTIZATION_DRIVER_DEFAULTS.termMonths,
      min: 1,
      max: 360,
      step: 1,
      group: t(locale, 'Loan terms'),
    },
  ];
}

// ---------------------------------------------------------------------------
// projectViability — parameter descriptors
// ---------------------------------------------------------------------------

function buildProjectViabilityParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    {
      name: 'projectName',
      label: t(locale, 'Project name'),
      type: 'text',
      default: PROJECT_VIABILITY_GENERAL_DEFAULTS.projectName,
      group: t(locale, 'General'),
    },
    {
      name: 'currencyCode',
      label: t(locale, 'Currency'),
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: PROJECT_VIABILITY_GENERAL_DEFAULTS.currencyCode,
      group: t(locale, 'General'),
    },
    {
      name: 'startYear',
      label: t(locale, 'First year of operation (year 1)'),
      type: 'integer',
      default: new Date().getFullYear() + 1,
      min: 2000,
      max: 2100,
      step: 1,
      group: t(locale, 'General'),
    },
    {
      name: 'investment',
      label: t(locale, 'Initial outlay (investment)'),
      type: 'currency',
      default: PROJECT_VIABILITY_GENERAL_DEFAULTS.investment,
      min: 0.01,
      step: 1000,
      group: t(locale, 'Investment'),
    },
    {
      name: 'baseCashFlow',
      label: t(locale, 'Gross operating cash flow — year 1'),
      type: 'currency',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.baseCashFlow,
      step: 1000,
      group: t(locale, 'Cash flows'),
    },
    {
      name: 'cashFlowGrowthPct',
      label: t(locale, 'Cash-flow growth % per year'),
      type: 'percent',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.cashFlowGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: t(locale, 'Cash flows'),
    },
    {
      name: 'horizonYears',
      label: t(locale, 'Project horizon (years)'),
      type: 'integer',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.horizonYears,
      min: 3,
      max: 15,
      step: 1,
      group: t(locale, 'Cash flows'),
    },
    {
      name: 'discountRatePct',
      label: t(locale, 'Discount rate (required rate of return)'),
      type: 'percent',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.discountRatePct,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: t(locale, 'Discounting'),
    },
    {
      name: 'residualValue',
      label: t(locale, 'Residual value (end of horizon)'),
      type: 'currency',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.residualValue,
      step: 1000,
      group: t(locale, 'Discounting'),
    },
    {
      name: 'taxRatePct',
      label: t(locale, 'Tax rate (on operating cash flow)'),
      type: 'percent',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.taxRatePct,
      min: 0,
      max: 1,
      step: 0.005,
      group: t(locale, 'Discounting'),
    },
  ];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

function buildBenefitsRealizationParams(locale: WorkbookLocale = 'en'): WorkbookTemplateParam[] {
  return [
    { name: 'programName', label: t(locale, 'Program name'), type: 'text', default: BENEFITS_REALIZATION_DEFAULTS.programName, group: t(locale, 'General') },
    { name: 'currencyCode', label: t(locale, 'Currency'), type: 'enum', options: ['PLN', 'EUR', 'USD'], default: BENEFITS_REALIZATION_DEFAULTS.currencyCode, group: t(locale, 'General') },
    { name: 'investment', label: t(locale, 'Investment outlay'), type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.investment, min: 0, group: t(locale, 'Value') },
    { name: 'implementationCost', label: t(locale, 'Implementation cost'), type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.implementationCost, min: 0, group: t(locale, 'Value') },
    { name: 'revenueBenefit', label: t(locale, 'Revenue benefit'), type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.revenueBenefit, min: 0, group: t(locale, 'Value') },
    { name: 'costBenefit', label: t(locale, 'Cost reduction'), type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.costBenefit, min: 0, group: t(locale, 'Value') },
    { name: 'workingCapitalBenefit', label: t(locale, 'Working capital'), type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.workingCapitalBenefit, min: 0, group: t(locale, 'Value') },
    { name: 'confidencePct', label: t(locale, 'Estimation confidence'), type: 'percent', default: BENEFITS_REALIZATION_DEFAULTS.confidencePct, min: 0, max: 1, group: t(locale, 'Control') },
    { name: 'realizationPct', label: t(locale, 'YTD plan realization'), type: 'percent', default: BENEFITS_REALIZATION_DEFAULTS.realizationPct, min: 0, max: 1, group: t(locale, 'Control') },
  ];
}

/** The registry map: `templateId → entry`. */
export const WORKBOOK_TEMPLATES: {
  threeScenarioPnL: WorkbookTemplateEntry<ThreeScenarioPnLParams>;
  operatingBudget: WorkbookTemplateEntry<OperatingBudgetParams>;
  dcfValuation: WorkbookTemplateEntry<DcfValuationParams>;
  breakEven: WorkbookTemplateEntry<BreakEvenParams>;
  cashflow12m: WorkbookTemplateEntry<Cashflow12mParams>;
  unitEconomics: WorkbookTemplateEntry<UnitEconomicsParams>;
  loanAmortization: WorkbookTemplateEntry<LoanAmortizationParams>;
  projectViability: WorkbookTemplateEntry<ProjectViabilityParams>;
  benefitsRealization: WorkbookTemplateEntry<BenefitsRealizationParams>;
} = {
  threeScenarioPnL: {
    id: 'threeScenarioPnL',
    title: (locale = 'en') => t(locale, 'Income statement — 3 scenarios × 3 years'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric P&L (Base/Bull/Bear) over 3 years: revenue→COGS→gross profit→OPEX→EBITDA→D&A→EBIT→interest→EBT→tax→net profit→margin, every line a formula, inputs on an Assumptions sheet, a Comparison sheet.'
      ),
    params: (locale = 'en') => buildThreeScenarioParams(locale),
    build: buildThreeScenarioPnLSchema,
    coerceParams: (flat) => unflattenDotted(flat) as ThreeScenarioPnLParams,
  },
  operatingBudget: {
    id: 'operatingBudget',
    title: (locale = 'en') => t(locale, 'Operating budget — 12 months'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric 12-month operating budget: revenue→variable costs→margin→fixed costs (rent/salaries/marketing/other)→total costs→operating result→cumulative result→margin %, every line a formula, a TOTAL (year) column, inputs on an Assumptions sheet, a Summary sheet.'
      ),
    params: (locale = 'en') => buildOperatingBudgetParams(locale),
    build: buildOperatingBudgetSchema,
  },
  dcfValuation: {
    id: 'dcfValuation',
    title: (locale = 'en') => t(locale, 'DCF valuation (Discounted Cash Flow)'),
    description: (locale = 'en') =>
      t(
        locale,
        'Simple DCF valuation: FCF projection over the chosen horizon→discount factor→discounted FCF→terminal value (Gordon)→Enterprise Value→Equity Value→value per share, every line a formula, inputs on an Assumptions sheet, FCF Projection and Valuation sheets.'
      ),
    params: (locale = 'en') => buildDcfValuationParams(locale),
    build: buildDcfValuationSchema,
  },
  breakEven: {
    id: 'breakEven',
    title: (locale = 'en') => t(locale, 'Break-even analysis (BEP)'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric break-even analysis: unit margin→BEP volume→BEP revenue→margin of safety, a sensitivity table across several volume levels, every line a formula, inputs on an Assumptions sheet.'
      ),
    params: (locale = 'en') => buildBreakEvenParams(locale),
    build: buildBreakEvenSchema,
  },
  cashflow12m: {
    id: 'cashflow12m',
    title: (locale = 'en') => t(locale, 'Cash-flow forecast — 12 months'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric 12-month cash-flow forecast: inflows (revenue with payment delay)→outflows (costs)→net flow m/m→cumulative balance, every line a formula, a TOTAL (year) column, inputs on an Assumptions sheet, a Summary sheet.'
      ),
    params: (locale = 'en') => buildCashflow12mParams(locale),
    build: buildCashflow12mSchema,
  },
  unitEconomics: {
    id: 'unitEconomics',
    title: (locale = 'en') => t(locale, 'SaaS unit economics'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric SaaS unit economics: LTV=ARPU×margin/churn, LTV/CAC, CAC payback period=CAC/(ARPU×margin), NRR, plus a 12-month customer/MRR projection with m/m churn, every line a formula, inputs on an Assumptions sheet, Metrics and 12m Projection sheets.'
      ),
    params: (locale = 'en') => buildUnitEconomicsParams(locale),
    build: buildUnitEconomicsSchema,
  },
  loanAmortization: {
    id: 'loanAmortization',
    title: (locale = 'en') => t(locale, 'Loan amortization schedule'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric loan schedule: annuity payment (arithmetic formula, not PMT), payment split into interest and principal, declining balance month by month to zero, a TOTAL row with sums and closing balance, every line a formula, inputs on an Assumptions sheet, a Schedule sheet.'
      ),
    params: (locale = 'en') => buildLoanAmortizationParams(locale),
    build: buildLoanAmortizationSchema,
  },
  projectViability: {
    id: 'projectViability',
    title: (locale = 'en') => t(locale, 'Project viability assessment (NPV/IRR)'),
    description: (locale = 'en') =>
      t(
        locale,
        'Parametric project viability assessment: net cash-flow projection (year 0 = investment, years 1..N = operations with tax and residual value)→NPV→IRR→profitability index (PI)→simple and discounted payback period, plus an NPV sensitivity grid across discount rate and cash-flow level, every line a formula, inputs on an Assumptions sheet, Cash Flows, Results and Sensitivity sheets.'
      ),
    params: (locale = 'en') => buildProjectViabilityParams(locale),
    build: buildProjectViabilitySchema,
  },
  benefitsRealization: {
    id: 'benefitsRealization',
    title: (locale = 'en') => t(locale, 'Benefits Realization — program value'),
    description: (locale = 'en') =>
      t(
        locale,
        'Board-ready benefits model: controlled assumptions and evidence owners, risk-adjusted plan, YTD realization, gap, ROI and a one-page Executive Summary.'
      ),
    params: (locale = 'en') => buildBenefitsRealizationParams(locale),
    build: buildBenefitsRealizationSchema,
  },
};

/** All registered templates as a list (for enumeration / prompt injection). */
export interface WorkbookTemplateListing {
  id: WorkbookTemplateId;
  title: string;
  description: string;
  params: WorkbookTemplateParam[];
}

/**
 * Enumerate templates with their metadata RESOLVED for `locale` (default `'en'`
 * — DEC-461/F7b). Callers that need the raw locale-aware entry (to build a
 * schema, or to re-resolve for a different locale) should read
 * `WORKBOOK_TEMPLATES` / `getWorkbookTemplate` directly instead.
 */
export function listWorkbookTemplates(locale: WorkbookLocale = 'en'): WorkbookTemplateListing[] {
  return Object.values(WORKBOOK_TEMPLATES).map((entry) => ({
    id: entry.id,
    title: entry.title(locale),
    description: entry.description(locale),
    params: entry.params(locale),
  }));
}

/** Look up a registry entry by id (null for an unknown id). */
export function getWorkbookTemplate(id: string): WorkbookTemplateEntry | null {
  return (WORKBOOK_TEMPLATES as Record<string, WorkbookTemplateEntry>)[id] ?? null;
}

/**
 * Build a WorkbookSchema from a template id + params. Returns `null` for an
 * unknown id so the caller can fall back to free-form LLM generation.
 *
 * `params` is the builder's NATIVE (possibly nested) shape — the same contract as
 * before. To build from a validated FLAT param map, use `buildFromTemplateFlat`.
 */
export function buildFromTemplate(id: string, params: unknown): WorkbookSchema | null {
  const entry = getWorkbookTemplate(id);
  if (!entry) return null;
  return entry.build(params as any);
}

/**
 * Build a WorkbookSchema from a template id + a validated FLAT param map (keys =
 * `entry.params[].name`). Applies the entry's `coerceParams` when present.
 */
export function buildFromTemplateFlat(
  id: string,
  flatParams: Record<string, unknown>
): WorkbookSchema | null {
  const entry = getWorkbookTemplate(id);
  if (!entry) return null;
  const native = entry.coerceParams ? entry.coerceParams(flatParams) : flatParams;
  return entry.build(native as any);
}

// ---------------------------------------------------------------------------
// Param plumbing: un-flatten + zod validation
// ---------------------------------------------------------------------------

/**
 * Turn a flat map with dotted keys into a nested object.
 * `{ "base.cogsPct": 0.5, companyName: "X" }` → `{ base: { cogsPct: 0.5 }, companyName: "X" }`.
 * Non-object collisions are overwritten by the deepest assignment (last wins).
 */
export function unflattenDotted(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    const parts = key.split('.');
    let cursor = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cursor[p] !== 'object' || cursor[p] === null) cursor[p] = {};
      cursor = cursor[p] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}

/**
 * Build a zod schema for a template's params from its descriptors. Every field is
 * optional (the builder applies defaults + clamps), but when PRESENT it must be
 * the right type and within declared min/max — so a caller sending `cogsPct: 9`
 * (900%) or a non-numeric `startYear` is rejected at the edge instead of silently
 * clamped. Unknown keys are stripped.
 */
export function buildTemplateParamsSchema(entry: WorkbookTemplateEntry): z.ZodType {
  const shape: Record<string, z.ZodTypeAny> = {};
  // Locale is irrelevant here — `name`/`type`/`min`/`max` never vary by locale.
  for (const p of entry.params('en')) {
    let field: z.ZodTypeAny;
    switch (p.type) {
      case 'text':
        field = z.string().max(200);
        break;
      case 'enum':
        field =
          p.options && p.options.length ? z.enum(p.options as [string, ...string[]]) : z.string();
        break;
      case 'integer': {
        let n = z.coerce.number().int();
        if (p.min !== undefined) n = n.min(p.min);
        if (p.max !== undefined) n = n.max(p.max);
        field = n;
        break;
      }
      case 'number':
      case 'percent':
      case 'currency':
      default: {
        let n = z.coerce.number().finite();
        if (p.min !== undefined) n = n.min(p.min);
        if (p.max !== undefined) n = n.max(p.max);
        field = n;
        break;
      }
    }
    shape[p.name] = field.optional();
  }
  return z.object(shape).strip();
}

export {
  buildBreakEvenSchema,
  buildCashflow12mSchema,
  buildDcfValuationSchema,
  buildLoanAmortizationSchema,
  buildOperatingBudgetSchema,
  buildProjectViabilitySchema,
  buildThreeScenarioPnLSchema,
  buildUnitEconomicsSchema,
};
export type {
  BreakEvenParams,
  Cashflow12mParams,
  DcfValuationParams,
  LoanAmortizationParams,
  OperatingBudgetParams,
  ProjectViabilityParams,
  ThreeScenarioPnLParams,
  UnitEconomicsParams,
};
