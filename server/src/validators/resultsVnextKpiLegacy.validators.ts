/**
 * KPI-E007 — Legacy Archive API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/KPI_E007_DESIGN.md §4.
 *
 * `ListLegacyQuerySchema` matches `ListKpisQuerySchema`
 * (`resultsVnextKpi.validators.ts:108-112`) verbatim, minus `status` — the 4
 * legacy tables have no unified status concept across all of them (Decision
 * D4).
 *
 * `LegacyIdParamsSchema` is deliberately NOT `KpiIdParamsSchema` reused —
 * that schema enforces `z.string().uuid()` (verified by reading
 * `resultsVnextKpi.validators.ts`), which would wrongly 400 a legacy row
 * whose primary key isn't a UUID. Two of the four legacy tables confirm this
 * concern is real: `kpi_definitions.id` and `v8_kpi_definitions.kpi_id` are
 * both plain `TEXT` columns with no UUID format constraint (verified against
 * `server/migrations/262_benefits_tracking.sql` and
 * `server/migrations-v2/001_baseline_20260413.sql`'s `v8_kpi_definitions`
 * DDL) — a legacy id like `kpi-cost-savings` (a real seeded row id) is not a
 * valid UUID and must still resolve, not 400.
 */
import { z } from 'zod';

export const ListLegacyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const LegacyIdParamsSchema = z.object({
  legacyId: z.string().min(1).max(200),
});
