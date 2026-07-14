/**
 * Initiative RACI + Results summary — batched READ for the Initiatives LIST.
 * =====================================================================================
 * Faza2 gap #5 (audyt endpointów READ, 2026-07): the initiatives LIST endpoint
 * (`GET /api/initiatives`, `InitiativeController.getInitiatives`) returns ownerBusiness/
 * ownerExecution only — no RACI assignment (`initiative_stakeholders.raci_type`) and no
 * linked results (KPIs). Both exist per-initiative (`GET /:id/stakeholders`,
 * `GET /:id/kpis`), but the list screen would need N+1 calls to show them inline.
 *
 * This module is a BATCHED, additive companion read: given a set of initiative ids
 * (typically the ids already rendered by the list), it returns RACI buckets + a results
 * (KPI) summary per initiative in one call. It does NOT change the shape of the existing
 * list/detail endpoints — purely additive, new route only (`GET /raci-results-summary`).
 *
 * Results reader: reuses `listInitiativeKpiAssignments` (initiativeKpiAssignmentService.ts)
 * — the SAME schema-drift-safe reader the KPI catalog/drawer already uses, which reads
 * `initiative_kpis` (+ `initiative_kpi_mappings`), NOT the v8 KPI tables (memory: "katalog
 * czyta initiative_kpis NIE v8 — zasil zgodnie z istniejącym wzorcem"). No new tables.
 *
 * Fail-soft: a bad/foreign initiative id degrades to an empty entry (no 500, no leak
 * across orgs) instead of failing the whole batch.
 */

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { listInitiativeKpiAssignments } from '../initiative/initiativeKpiAssignmentService.js';

const RACI_BUCKET_KEYS = ['responsible', 'accountable', 'consulted', 'informed'] as const;
type RaciBucketKey = (typeof RACI_BUCKET_KEYS)[number] | 'unspecified';

export interface RaciAssignmentEntry {
  id: string;
  raciType: string | null;
  role: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
}

export interface InitiativeResultSummaryEntry {
  kpiId: string;
  name: string;
  unit: string | null;
  targetValue: number | null;
  latestValue: number | null;
  isOnTarget: boolean;
  status: string;
}

export interface InitiativeRaciResultsEntry {
  initiativeId: string;
  raci: Record<RaciBucketKey, RaciAssignmentEntry[]>;
  raciCount: number;
  results: InitiativeResultSummaryEntry[];
  resultsCount: number;
}

function emptyEntry(initiativeId: string): InitiativeRaciResultsEntry {
  return {
    initiativeId,
    raci: {
      responsible: [],
      accountable: [],
      consulted: [],
      informed: [],
      unspecified: [],
    },
    raciCount: 0,
    results: [],
    resultsCount: 0,
  };
}

// snake_case row shape on purpose (not camelCase aliases) — Postgres folds unquoted
// SQL aliases to lower case, so `AS someCamelAlias` would come back as `somecamelalias`
// on the live PG-backed demo/staging DB. Reading raw snake_case columns and mapping to
// camelCase in JS (same pattern as `AssignmentQueryRow`/`mapAssignmentRow` in
// initiativeKpiAssignmentService.ts) is the driver-agnostic, safe convention.
interface RaciBatchRow {
  id: string;
  initiative_id: string;
  raci_type: string | null;
  role: string | null;
  user_id: string | null;
  external_name: string | null;
  external_email: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const MAX_IDS = 200;
const KPI_READ_CONCURRENCY = 8;

/**
 * Batched RACI + results (KPI) summary for a set of initiative ids, org-scoped.
 * Unknown / foreign ids are silently omitted from RACI (batched IN query naturally
 * excludes them) and degrade to an empty entry for results (fail-soft per id).
 */
export async function getInitiativesRaciResultsSummary(
  organizationId: string,
  initiativeIds: string[]
): Promise<Record<string, InitiativeRaciResultsEntry>> {
  const ids = Array.from(
    new Set((initiativeIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, MAX_IDS);

  const out: Record<string, InitiativeRaciResultsEntry> = {};
  for (const id of ids) out[id] = emptyEntry(id);
  if (ids.length === 0) return out;

  // ── RACI — one batched IN query over initiative_stakeholders, org-scoped via JOIN. ──
  try {
    const placeholders = queryHelpers.buildInPlaceholders(ids);
    const raciRows = await queryHelpers.queryAll<RaciBatchRow>(
      `SELECT
         s.id,
         s.initiative_id,
         s.raci_type,
         s.role,
         s.user_id,
         s.external_name,
         s.external_email,
         u.first_name,
         u.last_name,
         u.email
       FROM initiative_stakeholders s
       JOIN initiatives i ON i.id = s.initiative_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE i.organization_id = ? AND s.initiative_id IN (${placeholders})`,
      [organizationId, ...ids]
    );

    for (const row of raciRows || []) {
      const entry = out[String(row.initiative_id)];
      if (!entry) continue;
      const raciTypeLower = String(row.raci_type || '').toLowerCase();
      const bucketKey: RaciBucketKey = (RACI_BUCKET_KEYS as readonly string[]).includes(
        raciTypeLower
      )
        ? (raciTypeLower as RaciBucketKey)
        : 'unspecified';
      const name = row.user_id
        ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || null
        : row.external_name || row.external_email || null;
      entry.raci[bucketKey].push({
        id: String(row.id),
        raciType: row.raci_type ?? null,
        role: row.role ?? null,
        userId: row.user_id ?? null,
        name,
        email: row.user_id ? row.email : (row.external_email ?? null),
      });
      entry.raciCount += 1;
    }
  } catch (err) {
    logger.warn(
      `[initiativeRaciResultsSummaryService] RACI batch read failed (degrading to empty): ${(err as Error)?.message || err}`
    );
  }

  // ── Results — reuse the tested per-initiative KPI reader (schema-drift-safe), ──
  // bounded concurrency so a large `ids` list doesn't fan out unbounded DB load.
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < ids.length) {
      const initiativeId = ids[cursor++];
      try {
        const kpis = await listInitiativeKpiAssignments(initiativeId, organizationId);
        const entry = out[initiativeId];
        if (!entry) continue;
        entry.results = kpis.map((k) => ({
          kpiId: k.id,
          name: k.name,
          unit: k.unit ?? null,
          targetValue: k.targetValue,
          latestValue: k.latestValue ?? k.currentValue ?? null,
          isOnTarget: k.isOnTarget,
          status: k.status,
        }));
        entry.resultsCount = entry.results.length;
      } catch (err) {
        // Fail-soft per id: foreign/unknown initiativeId (assertInitiativeBelongsToOrg
        // throws) or a transient read error both degrade to an empty results list —
        // never leaks cross-org data, never fails the whole batch.
        logger.warn(
          `[initiativeRaciResultsSummaryService] KPI read failed for ${initiativeId} (degrading to empty): ${(err as Error)?.message || err}`
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(KPI_READ_CONCURRENCY, ids.length) }, () => worker())
  );

  return out;
}
