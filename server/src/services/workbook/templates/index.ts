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

/** A registered template: metadata + descriptors + a params→schema builder. */
export interface WorkbookTemplateEntry<P = any> {
  id: WorkbookTemplateId;
  /** Human-facing title (surfaced to the LLM/UI when choosing a template). */
  title: string;
  /** One-line description of what the template models. */
  description: string;
  /** Self-describing, FE-renderable parameter list (flat keys). */
  params: WorkbookTemplateParam[];
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

/** The 6 scenario drivers, in vertical order, with PL labels + sane bounds. */
const DRIVER_FIELDS: Array<{
  key: keyof ScenarioDrivers;
  label: string;
  min: number;
  max: number;
}> = [
  { key: 'revenueGrowthPct', label: 'Wzrost przychodów %/rok', min: -1, max: 5 },
  { key: 'cogsPct', label: 'COGS % przychodów', min: 0, max: 1 },
  { key: 'opexPct', label: 'OPEX % przychodów', min: 0, max: 1 },
  { key: 'daPct', label: 'Amortyzacja (D&A) % przychodów', min: 0, max: 1 },
  { key: 'interestPct', label: 'Odsetki % przychodów', min: 0, max: 1 },
  { key: 'taxRatePct', label: 'Stopa podatkowa %', min: 0, max: 1 },
];

const SCENARIO_GROUPS: Array<{
  prefix: keyof ThreeScenarioPnLParams;
  label: string;
  defaults: ScenarioDrivers;
}> = [
  { prefix: 'base', label: 'Base (bazowy)', defaults: DEFAULT_BASE },
  { prefix: 'bull', label: 'Bull (optymistyczny)', defaults: DEFAULT_BULL },
  { prefix: 'bear', label: 'Bear (pesymistyczny)', defaults: DEFAULT_BEAR },
];

function buildThreeScenarioParams(): WorkbookTemplateParam[] {
  const params: WorkbookTemplateParam[] = [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: THREE_SCENARIO_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: THREE_SCENARIO_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'startYear',
      label: 'Pierwszy rok prognozy',
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: 'Ogólne',
    },
    {
      name: 'baseRevenue',
      label: 'Przychód roku bazowego',
      type: 'currency',
      default: THREE_SCENARIO_GENERAL_DEFAULTS.baseRevenue,
      min: 0,
      step: 1000,
      group: 'Ogólne',
    },
  ];

  for (const scen of SCENARIO_GROUPS) {
    for (const drv of DRIVER_FIELDS) {
      params.push({
        name: `${String(scen.prefix)}.${String(drv.key)}`,
        label: drv.label,
        type: 'percent',
        default: scen.defaults[drv.key],
        min: drv.min,
        max: drv.max,
        step: 0.005,
        group: scen.label,
      });
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// operatingBudget — parameter descriptors
// ---------------------------------------------------------------------------

function buildOperatingBudgetParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: OPERATING_BUDGET_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: OPERATING_BUDGET_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'startYear',
      label: 'Rok budżetu',
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: 'Ogólne',
    },
    {
      name: 'baseMonthlyRevenue',
      label: 'Przychód m-c 1',
      type: 'currency',
      default: OPERATING_BUDGET_GENERAL_DEFAULTS.baseMonthlyRevenue,
      min: 0,
      step: 1000,
      group: 'Przychody',
    },
    {
      name: 'monthlyRevenueGrowthPct',
      label: 'Wzrost przychodów m/m %',
      type: 'percent',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.monthlyRevenueGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: 'Przychody',
    },
    {
      name: 'variableCostPct',
      label: 'Koszty zmienne % przychodów',
      type: 'percent',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.variableCostPct,
      min: 0,
      max: 1,
      step: 0.005,
      group: 'Koszty zmienne',
    },
    {
      name: 'rentMonthly',
      label: 'Czynsz (m-c 1)',
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.rentMonthly,
      min: 0,
      step: 100,
      group: 'Koszty stałe',
    },
    {
      name: 'salariesMonthly',
      label: 'Wynagrodzenia (m-c 1)',
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.salariesMonthly,
      min: 0,
      step: 100,
      group: 'Koszty stałe',
    },
    {
      name: 'marketingMonthly',
      label: 'Marketing (m-c 1)',
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.marketingMonthly,
      min: 0,
      step: 100,
      group: 'Koszty stałe',
    },
    {
      name: 'otherFixedMonthly',
      label: 'Pozostałe koszty stałe (m-c 1)',
      type: 'currency',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.otherFixedMonthly,
      min: 0,
      step: 100,
      group: 'Koszty stałe',
    },
    {
      name: 'fixedCostGrowthPct',
      label: 'Wzrost kosztów stałych m/m %',
      type: 'percent',
      default: OPERATING_BUDGET_DRIVER_DEFAULTS.fixedCostGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: 'Koszty stałe',
    },
  ];
}

// ---------------------------------------------------------------------------
// dcfValuation — parameter descriptors
// ---------------------------------------------------------------------------

function buildDcfValuationParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: DCF_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: DCF_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'valuationYear',
      label: 'Rok wyceny (rok 0)',
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: 'Ogólne',
    },
    {
      name: 'fcf0',
      label: 'FCF rok bazowy (rok 0)',
      type: 'currency',
      default: DCF_GENERAL_DEFAULTS.fcf0,
      min: 0,
      step: 1000,
      group: 'Projekcja',
    },
    {
      name: 'fcfGrowthPct',
      label: 'Wzrost FCF (prognoza) % rocznie',
      type: 'percent',
      default: DCF_DRIVER_DEFAULTS.fcfGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: 'Projekcja',
    },
    {
      name: 'horizonYears',
      label: 'Horyzont prognozy (lata)',
      type: 'integer',
      default: DCF_DRIVER_DEFAULTS.horizonYears,
      min: 3,
      max: 10,
      step: 1,
      group: 'Projekcja',
    },
    {
      name: 'waccPct',
      label: 'WACC (stopa dyskontowa) %',
      type: 'percent',
      default: DCF_DRIVER_DEFAULTS.waccPct,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: 'Dyskontowanie',
    },
    {
      name: 'terminalGrowthPct',
      label: 'Wzrost terminalny (g) %',
      type: 'percent',
      default: DCF_DRIVER_DEFAULTS.terminalGrowthPct,
      min: -0.5,
      max: 0.5,
      step: 0.005,
      group: 'Dyskontowanie',
    },
    {
      name: 'netDebt',
      label: 'Dług netto',
      type: 'currency',
      default: DCF_DRIVER_DEFAULTS.netDebt,
      step: 1000,
      group: 'Mostek EV → Equity',
    },
    {
      name: 'sharesOutstanding',
      label: 'Liczba akcji',
      type: 'number',
      default: DCF_DRIVER_DEFAULTS.sharesOutstanding,
      min: 1,
      step: 1000,
      group: 'Mostek EV → Equity',
    },
  ];
}

// ---------------------------------------------------------------------------
// breakEven — parameter descriptors
// ---------------------------------------------------------------------------

function buildBreakEvenParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: BREAK_EVEN_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: BREAK_EVEN_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'unitPrice',
      label: 'Cena jednostkowa',
      type: 'currency',
      default: BREAK_EVEN_GENERAL_DEFAULTS.unitPrice,
      min: 0.01,
      step: 1,
      group: 'Ogólne',
    },
    {
      name: 'variableCostPerUnit',
      label: 'Koszt zmienny na sztukę',
      type: 'currency',
      default: BREAK_EVEN_DRIVER_DEFAULTS.variableCostPerUnit,
      min: 0,
      step: 1,
      group: 'Koszty',
    },
    {
      name: 'fixedCosts',
      label: 'Koszty stałe',
      type: 'currency',
      default: BREAK_EVEN_DRIVER_DEFAULTS.fixedCosts,
      min: 0,
      step: 1000,
      group: 'Koszty',
    },
    {
      name: 'plannedVolume',
      label: 'Planowany wolumen sprzedaży (szt.)',
      type: 'integer',
      default: BREAK_EVEN_DRIVER_DEFAULTS.plannedVolume,
      min: 0,
      step: 100,
      group: 'Sprzedaż',
    },
  ];
}

// ---------------------------------------------------------------------------
// cashflow12m — parameter descriptors
// ---------------------------------------------------------------------------

function buildCashflow12mParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: CASHFLOW_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: CASHFLOW_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'startYear',
      label: 'Rok prognozy',
      type: 'integer',
      default: new Date().getFullYear(),
      min: 2000,
      max: 2100,
      step: 1,
      group: 'Ogólne',
    },
    {
      name: 'openingBalance',
      label: 'Saldo początkowe',
      type: 'currency',
      default: CASHFLOW_GENERAL_DEFAULTS.openingBalance,
      step: 1000,
      group: 'Ogólne',
    },
    {
      name: 'baseMonthlyRevenue',
      label: 'Przychód m-c 1',
      type: 'currency',
      default: CASHFLOW_DRIVER_DEFAULTS.baseMonthlyRevenue,
      min: 0,
      step: 1000,
      group: 'Przychody',
    },
    {
      name: 'monthlyRevenueGrowthPct',
      label: 'Wzrost przychodów m/m %',
      type: 'percent',
      default: CASHFLOW_DRIVER_DEFAULTS.monthlyRevenueGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: 'Przychody',
    },
    {
      name: 'paymentDelayMonths',
      label: 'Opóźnienie płatności (miesiące)',
      type: 'integer',
      default: CASHFLOW_DRIVER_DEFAULTS.paymentDelayMonths,
      min: 0,
      max: 3,
      step: 1,
      group: 'Przychody',
    },
    {
      name: 'monthlyCosts',
      label: 'Koszty m-c 1',
      type: 'currency',
      default: CASHFLOW_DRIVER_DEFAULTS.monthlyCosts,
      min: 0,
      step: 1000,
      group: 'Koszty',
    },
    {
      name: 'costGrowthPct',
      label: 'Wzrost kosztów m/m %',
      type: 'percent',
      default: CASHFLOW_DRIVER_DEFAULTS.costGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: 'Koszty',
    },
  ];
}

// ---------------------------------------------------------------------------
// unitEconomics — parameter descriptors
// ---------------------------------------------------------------------------

function buildUnitEconomicsParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: UNIT_ECONOMICS_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: UNIT_ECONOMICS_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'startingMrr',
      label: 'MRR startowy',
      type: 'currency',
      default: UNIT_ECONOMICS_GENERAL_DEFAULTS.startingMrr,
      min: 0,
      step: 1000,
      group: 'Ogólne',
    },
    {
      name: 'churnPctMonthly',
      label: 'Churn m/m %',
      type: 'percent',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.churnPctMonthly,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: 'Metryki wejściowe',
    },
    {
      name: 'cac',
      label: 'CAC (koszt pozyskania klienta)',
      type: 'currency',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.cac,
      min: 0.01,
      step: 50,
      group: 'Metryki wejściowe',
    },
    {
      name: 'grossMarginPct',
      label: 'Marża brutto %',
      type: 'percent',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.grossMarginPct,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: 'Metryki wejściowe',
    },
    {
      name: 'arpu',
      label: 'ARPU (przychód / klient / m-c)',
      type: 'currency',
      default: UNIT_ECONOMICS_DRIVER_DEFAULTS.arpu,
      min: 0.01,
      step: 10,
      group: 'Metryki wejściowe',
    },
  ];
}

// ---------------------------------------------------------------------------
// loanAmortization — parameter descriptors
// ---------------------------------------------------------------------------

function buildLoanAmortizationParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'companyName',
      label: 'Nazwa spółki',
      type: 'text',
      default: LOAN_AMORTIZATION_GENERAL_DEFAULTS.companyName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: LOAN_AMORTIZATION_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'loanAmount',
      label: 'Kwota kredytu',
      type: 'currency',
      default: LOAN_AMORTIZATION_GENERAL_DEFAULTS.loanAmount,
      min: 0.01,
      step: 1000,
      group: 'Ogólne',
    },
    {
      name: 'annualInterestRatePct',
      label: 'Oprocentowanie roczne %',
      type: 'percent',
      default: LOAN_AMORTIZATION_DRIVER_DEFAULTS.annualInterestRatePct,
      min: 0.0001,
      max: 1,
      step: 0.001,
      group: 'Warunki kredytu',
    },
    {
      name: 'termMonths',
      label: 'Okres (miesiące)',
      type: 'integer',
      default: LOAN_AMORTIZATION_DRIVER_DEFAULTS.termMonths,
      min: 1,
      max: 360,
      step: 1,
      group: 'Warunki kredytu',
    },
  ];
}

// ---------------------------------------------------------------------------
// projectViability — parameter descriptors
// ---------------------------------------------------------------------------

function buildProjectViabilityParams(): WorkbookTemplateParam[] {
  return [
    {
      name: 'projectName',
      label: 'Nazwa projektu',
      type: 'text',
      default: PROJECT_VIABILITY_GENERAL_DEFAULTS.projectName,
      group: 'Ogólne',
    },
    {
      name: 'currencyCode',
      label: 'Waluta',
      type: 'enum',
      options: ['PLN', 'EUR', 'USD'],
      default: PROJECT_VIABILITY_GENERAL_DEFAULTS.currencyCode,
      group: 'Ogólne',
    },
    {
      name: 'startYear',
      label: 'Pierwszy rok eksploatacji (rok 1)',
      type: 'integer',
      default: new Date().getFullYear() + 1,
      min: 2000,
      max: 2100,
      step: 1,
      group: 'Ogólne',
    },
    {
      name: 'investment',
      label: 'Nakład początkowy (inwestycja)',
      type: 'currency',
      default: PROJECT_VIABILITY_GENERAL_DEFAULTS.investment,
      min: 0.01,
      step: 1000,
      group: 'Inwestycja',
    },
    {
      name: 'baseCashFlow',
      label: 'Przepływ operacyjny brutto — rok 1',
      type: 'currency',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.baseCashFlow,
      step: 1000,
      group: 'Przepływy',
    },
    {
      name: 'cashFlowGrowthPct',
      label: 'Wzrost przepływów % rocznie',
      type: 'percent',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.cashFlowGrowthPct,
      min: -1,
      max: 2,
      step: 0.005,
      group: 'Przepływy',
    },
    {
      name: 'horizonYears',
      label: 'Horyzont projektu (lata)',
      type: 'integer',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.horizonYears,
      min: 3,
      max: 15,
      step: 1,
      group: 'Przepływy',
    },
    {
      name: 'discountRatePct',
      label: 'Stopa dyskontowa (wymagana stopa zwrotu)',
      type: 'percent',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.discountRatePct,
      min: 0.001,
      max: 1,
      step: 0.005,
      group: 'Dyskontowanie',
    },
    {
      name: 'residualValue',
      label: 'Wartość rezydualna (koniec horyzontu)',
      type: 'currency',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.residualValue,
      step: 1000,
      group: 'Dyskontowanie',
    },
    {
      name: 'taxRatePct',
      label: 'Stopa podatkowa (od przepływu operacyjnego)',
      type: 'percent',
      default: PROJECT_VIABILITY_DRIVER_DEFAULTS.taxRatePct,
      min: 0,
      max: 1,
      step: 0.005,
      group: 'Dyskontowanie',
    },
  ];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const BENEFITS_REALIZATION_PARAMS: WorkbookTemplateParam[] = [
  { name: 'programName', label: 'Nazwa programu', type: 'text', default: BENEFITS_REALIZATION_DEFAULTS.programName, group: 'Ogólne' },
  { name: 'currencyCode', label: 'Waluta', type: 'enum', options: ['PLN', 'EUR', 'USD'], default: BENEFITS_REALIZATION_DEFAULTS.currencyCode, group: 'Ogólne' },
  { name: 'investment', label: 'Nakład inwestycyjny', type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.investment, min: 0, group: 'Wartość' },
  { name: 'implementationCost', label: 'Koszt wdrożenia', type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.implementationCost, min: 0, group: 'Wartość' },
  { name: 'revenueBenefit', label: 'Korzyść przychodowa', type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.revenueBenefit, min: 0, group: 'Wartość' },
  { name: 'costBenefit', label: 'Redukcja kosztów', type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.costBenefit, min: 0, group: 'Wartość' },
  { name: 'workingCapitalBenefit', label: 'Kapitał obrotowy', type: 'currency', default: BENEFITS_REALIZATION_DEFAULTS.workingCapitalBenefit, min: 0, group: 'Wartość' },
  { name: 'confidencePct', label: 'Pewność estymacji', type: 'percent', default: BENEFITS_REALIZATION_DEFAULTS.confidencePct, min: 0, max: 1, group: 'Kontrola' },
  { name: 'realizationPct', label: 'Realizacja planu YTD', type: 'percent', default: BENEFITS_REALIZATION_DEFAULTS.realizationPct, min: 0, max: 1, group: 'Kontrola' },
];

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
    title: 'Rachunek wyników — 3 scenariusze × 3 lata',
    description:
      'Parametryczny P&L (Base/Bull/Bear) na 3 lata: przychody→COGS→zysk brutto→OPEX→EBITDA→D&A→EBIT→odsetki→EBT→podatek→zysk netto→marża, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusz Porównanie.',
    params: buildThreeScenarioParams(),
    build: buildThreeScenarioPnLSchema,
    coerceParams: (flat) => unflattenDotted(flat) as ThreeScenarioPnLParams,
  },
  operatingBudget: {
    id: 'operatingBudget',
    title: 'Budżet operacyjny — 12 miesięcy',
    description:
      'Parametryczny budżet operacyjny 12-miesięczny: przychody→koszty zmienne→marża→koszty stałe (czynsz/wynagrodzenia/marketing/pozostałe)→koszty razem→wynik operacyjny→wynik narastająco→marża %, każda pozycja jako formuła, kolumna RAZEM (rok), wejścia na arkuszu Założenia, arkusz Podsumowanie.',
    params: buildOperatingBudgetParams(),
    build: buildOperatingBudgetSchema,
  },
  dcfValuation: {
    id: 'dcfValuation',
    title: 'Wycena DCF (Discounted Cash Flow)',
    description:
      'Prosta wycena metodą DCF: projekcja FCF na zadany horyzont→współczynnik dyskontowy→zdyskontowany FCF→wartość rezydualna (Gordon)→Enterprise Value→Equity Value→wartość na akcję, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusze Projekcja FCF i Wycena.',
    params: buildDcfValuationParams(),
    build: buildDcfValuationSchema,
  },
  breakEven: {
    id: 'breakEven',
    title: 'Analiza progu rentowności (Break-Even)',
    description:
      'Parametryczna analiza progu rentowności: marża jednostkowa→wolumen BEP→przychód BEP→margines ' +
      'bezpieczeństwa, tabela wrażliwości wyniku dla kilku poziomów wolumenu, każda pozycja jako formuła, ' +
      'wejścia na arkuszu Założenia.',
    params: buildBreakEvenParams(),
    build: buildBreakEvenSchema,
  },
  cashflow12m: {
    id: 'cashflow12m',
    title: 'Prognoza przepływów pieniężnych — 12 miesięcy',
    description:
      'Parametryczna prognoza cash-flow 12-miesięczna: wpływy (przychód z opóźnieniem płatności)→wypływy ' +
      '(koszty)→przepływ netto m/m→saldo narastające, każda pozycja jako formuła, kolumna RAZEM (rok), ' +
      'wejścia na arkuszu Założenia, arkusz Podsumowanie.',
    params: buildCashflow12mParams(),
    build: buildCashflow12mSchema,
  },
  unitEconomics: {
    id: 'unitEconomics',
    title: 'Ekonomia jednostkowa SaaS',
    description:
      'Parametryczna ekonomia jednostkowa SaaS: LTV=ARPU×marża/churn, LTV/CAC, okres zwrotu CAC=CAC/(ARPU×marża), ' +
      'NRR, oraz 12-miesięczna projekcja klientów/MRR z churnem m/m, każda pozycja jako formuła, wejścia na ' +
      'arkuszu Założenia, arkusze Metryki i Projekcja 12m.',
    params: buildUnitEconomicsParams(),
    build: buildUnitEconomicsSchema,
  },
  loanAmortization: {
    id: 'loanAmortization',
    title: 'Harmonogram spłaty kredytu (amortyzacja)',
    description:
      'Parametryczny harmonogram kredytu: rata annuitetowa (formuła arytmetyczna, nie PMT), podział raty na ' +
      'odsetki i kapitał, saldo malejące miesiąc po miesiącu do zera, wiersz RAZEM z sumami i saldem końcowym, ' +
      'każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusz Harmonogram.',
    params: buildLoanAmortizationParams(),
    build: buildLoanAmortizationSchema,
  },
  projectViability: {
    id: 'projectViability',
    title: 'Ocena opłacalności projektu (NPV/IRR)',
    description:
      'Parametryczna ocena opłacalności projektu: projekcja przepływów pieniężnych netto (rok 0 = ' +
      'inwestycja, lata 1..N = eksploatacja z podatkiem i wartością rezydualną)→NPV→IRR→wskaźnik ' +
      'rentowności (PI)→okres zwrotu prosty i zdyskontowany, plus siatka wrażliwości NPV na stopę ' +
      'dyskontową i poziom przepływów, każda pozycja jako formuła, wejścia na arkuszu Założenia, ' +
      'arkusze Przepływy, Wyniki i Wrażliwość.',
    params: buildProjectViabilityParams(),
    build: buildProjectViabilitySchema,
  },
  benefitsRealization: {
    id: 'benefitsRealization',
    title: 'Benefits Realization — wartość programu',
    description: 'Board-ready model korzyści: kontrolowane założenia i właściciele dowodów, plan risk-adjusted, realizacja YTD, luka, ROI oraz jednokartkowe Executive Summary.',
    params: BENEFITS_REALIZATION_PARAMS,
    build: buildBenefitsRealizationSchema,
  },
};

/** All registered templates as a list (for enumeration / prompt injection). */
export function listWorkbookTemplates(): WorkbookTemplateEntry[] {
  return Object.values(WORKBOOK_TEMPLATES);
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
  for (const p of entry.params) {
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
