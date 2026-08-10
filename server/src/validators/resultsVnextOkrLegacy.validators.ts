/**
 * OKR-E008 Half C — Legacy Archive API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §5.4. Same shape as
 * `resultsVnextRoiLegacy.validators.ts` (ROI-E008) / `resultsVnextKpiLegacy
 * .validators.ts` (KPI-E007).
 *
 * `OkrLegacyIdParamsSchema` is deliberately NOT a UUID-only schema — all 4
 * legacy OKR tables' PKs are plain `TEXT` (`server/migrations/
 * 914_okr_management.sql`: `okr_objectives.id`/`okr_key_results.id` are
 * `TEXT PRIMARY KEY`; `okr_cycles.id`/`okr_check_ins.id` are
 * `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text` — UUID-shaped in
 * practice but not a UUID-typed column) — same permissive-string precedent
 * ROI-E008/KPI-E007 both use, not worth a UUID-format constraint.
 */
import { z } from 'zod';

export const ListOkrLegacyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const OkrLegacyIdParamsSchema = z.object({
  legacyId: z.string().min(1).max(200),
});
