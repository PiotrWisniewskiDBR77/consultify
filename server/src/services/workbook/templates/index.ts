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
 * To add a template (e.g. DCF, budget-vs-actual):
 *   1. Implement `buildXxxSchema(params): WorkbookSchema` in its own file here,
 *      following the threeScenarioPnL pattern (every computed cell a formula,
 *      inputs on an assumptions sheet, no magic-numbers, formulas WITHOUT a
 *      leading `=`).
 *   2. Add an entry to `WORKBOOK_TEMPLATES` below with a short `id`, a human
 *      `title`, a `description`, and the `build` fn.
 *   3. Add a focused read-back + math-verification test under `__tests__/`.
 *
 * Only `threeScenarioPnL` is implemented today; the map is the extension point.
 */

import {
  buildThreeScenarioPnLSchema,
  type ThreeScenarioPnLParams,
} from './threeScenarioPnL.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';

/** Stable identifiers for registered model templates. */
export type WorkbookTemplateId = 'threeScenarioPnL';

/** A registered template: metadata + a params→schema builder. */
export interface WorkbookTemplateEntry<P = any> {
  id: WorkbookTemplateId;
  /** Human-facing title (surfaced to the LLM/UI when choosing a template). */
  title: string;
  /** One-line description of what the template models. */
  description: string;
  /** Build a complete WorkbookSchema from the template's params. */
  build: (params: P) => WorkbookSchema;
}

/** The registry map: `templateId → entry`. */
export const WORKBOOK_TEMPLATES: {
  threeScenarioPnL: WorkbookTemplateEntry<ThreeScenarioPnLParams>;
} = {
  threeScenarioPnL: {
    id: 'threeScenarioPnL',
    title: 'Rachunek wyników — 3 scenariusze × 3 lata',
    description:
      'Parametryczny P&L (Base/Bull/Bear) na 3 lata: przychody→COGS→zysk brutto→OPEX→EBITDA→D&A→EBIT→odsetki→EBT→podatek→zysk netto→marża, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusz Porównanie.',
    build: buildThreeScenarioPnLSchema,
  },
};

/** All registered templates as a list (for enumeration / prompt injection). */
export function listWorkbookTemplates(): WorkbookTemplateEntry[] {
  return Object.values(WORKBOOK_TEMPLATES);
}

/**
 * Build a WorkbookSchema from a template id + params. Returns `null` for an
 * unknown id so the caller can fall back to free-form LLM generation.
 */
export function buildFromTemplate(
  id: string,
  params: unknown
): WorkbookSchema | null {
  const entry = (WORKBOOK_TEMPLATES as Record<string, WorkbookTemplateEntry>)[id];
  if (!entry) return null;
  return entry.build(params as any);
}

export { buildThreeScenarioPnLSchema };
export type { ThreeScenarioPnLParams };
