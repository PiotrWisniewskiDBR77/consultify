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
 * Only `threeScenarioPnL` is implemented today; the map is the extension point.
 */

import { z } from 'zod';

import {
  buildThreeScenarioPnLSchema,
  DEFAULT_BASE,
  DEFAULT_BULL,
  DEFAULT_BEAR,
  THREE_SCENARIO_GENERAL_DEFAULTS,
  type ScenarioDrivers,
  type ThreeScenarioPnLParams,
} from './threeScenarioPnL.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';

/** Stable identifiers for registered model templates. */
export type WorkbookTemplateId = 'threeScenarioPnL';

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
const DRIVER_FIELDS: Array<{ key: keyof ScenarioDrivers; label: string; min: number; max: number }> = [
  { key: 'revenueGrowthPct', label: 'Wzrost przychodów %/rok', min: -1, max: 5 },
  { key: 'cogsPct', label: 'COGS % przychodów', min: 0, max: 1 },
  { key: 'opexPct', label: 'OPEX % przychodów', min: 0, max: 1 },
  { key: 'daPct', label: 'Amortyzacja (D&A) % przychodów', min: 0, max: 1 },
  { key: 'interestPct', label: 'Odsetki % przychodów', min: 0, max: 1 },
  { key: 'taxRatePct', label: 'Stopa podatkowa %', min: 0, max: 1 },
];

const SCENARIO_GROUPS: Array<{ prefix: keyof ThreeScenarioPnLParams; label: string; defaults: ScenarioDrivers }> = [
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
// Registry
// ---------------------------------------------------------------------------

/** The registry map: `templateId → entry`. */
export const WORKBOOK_TEMPLATES: {
  threeScenarioPnL: WorkbookTemplateEntry<ThreeScenarioPnLParams>;
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
export function buildFromTemplate(
  id: string,
  params: unknown
): WorkbookSchema | null {
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
          p.options && p.options.length
            ? z.enum(p.options as [string, ...string[]])
            : z.string();
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
  buildThreeScenarioPnLSchema,
};
export type { ThreeScenarioPnLParams };
