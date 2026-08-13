/**
 * ROI-E008 — Legacy Archive API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §3/B1. Same shape
 * as `resultsVnextKpiLegacy.validators.ts` (KPI-E007).
 *
 * `LegacyIdParamsSchema` is deliberately NOT a UUID-only schema — several of
 * the 7 legacy tables' PKs are plain `TEXT`, not guaranteed UUID-shaped
 * (`analysis_financials.id`/`digitization_analyses.id`/
 * `initiative_benefits.id`/`roi_assumptions.id`/`roi_realized_values.id`/
 * `benefits_register.id` are all `TEXT PRIMARY KEY`, verified against their
 * own DDL — none are `UUID`-typed columns).
 */
import { z } from 'zod';

export const ListRoiLegacyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const RoiLegacyIdParamsSchema = z.object({
  legacyId: z.string().min(1).max(200),
});
