import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import { mapResultsKpis, type ResultsKPI, type ResultsTrackedInitiative } from './kpiDomain';
import {
  createResultsShowcaseInitiatives,
  createResultsShowcaseKpis,
  shouldUseResultsShowcaseData,
} from './resultsShowcaseData';
import { isResultsOwnerReviewModeEnabled } from './resultsOwnerReviewMode';

export interface KpiCatalogRuntimeResult {
  initiatives: ResultsTrackedInitiative[];
  kpis: ResultsKPI[];
  source: 'v8' | 'legacy' | 'empty' | 'showcase';
}

type CatalogEnvelope = {
  data?: unknown;
  initiatives?: unknown;
  kpis?: unknown;
  mappings?: unknown;
};

function unwrapCatalog(payload: unknown): CatalogEnvelope {
  let current = payload as CatalogEnvelope | null | undefined;
  for (let depth = 0; depth < 2; depth += 1) {
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      !Array.isArray(current.initiatives) &&
      !Array.isArray(current.kpis) &&
      !Array.isArray(current.mappings) &&
      current.data &&
      typeof current.data === 'object'
    ) {
      current = current.data as CatalogEnvelope;
      continue;
    }
    break;
  }
  return current && typeof current === 'object' ? current : {};
}

export async function loadResultsDashboard(initiativeId?: string) {
  const scopedInitiativeId = String(initiativeId || '').trim();
  if (!scopedInitiativeId) return null;
  const response = await V8ResultsApi.getDashboard({ initiativeId: scopedInitiativeId });
  return response?.snapshot ?? null;
}

function showcaseResult(): KpiCatalogRuntimeResult {
  return {
    initiatives: createResultsShowcaseInitiatives(),
    kpis: createResultsShowcaseKpis(),
    source: 'showcase',
  };
}

/**
 * Loads KPIs from the deprecated legacy `/api/benefits/*` paths.
 *
 * BUG-M15-04 (plan field): Harvard/_TRACKER.md documents a "plan field" bug in
 * the M15 results layer left unresolved. Static analysis of v8/results.routes.ts,
 * resultsROIService.ts and benefits.routes.ts found no missing or null-when-required
 * `plan` field. Likely needs a live API trace (candidate: initiative_kpis.target_value
 * vs a target_plan_value column).
 *
 * Always returns source:'legacy' (even when empty) so ResultsHub keeps rendering the
 * degraded banner/runtime chip — an empty legacy response must not silently look
 * like a healthy 'empty' state. (BUG-M15 L-01)
 */
async function loadLegacyResultsKpis(): Promise<KpiCatalogRuntimeResult> {
  const [kpisRes, mappingsRes] = await Promise.allSettled([
    Api.get('/benefits/kpis'),
    Api.get('/benefits/kpi-mappings'),
  ]);

  const readGenericApiData = (response: unknown): unknown => {
    if (!response || typeof response !== 'object') return response;

    // Api.get uses an Axios-compat Proxy whose `data` getter intentionally
    // returns the whole JSON payload.  The server's real list is still the
    // target object's own `data` value, so read its descriptor without
    // triggering the Proxy getter.  Plain Axios-shaped test/caller responses
    // take the same path.
    const ownData = Object.getOwnPropertyDescriptor(response, 'data')?.value;
    return ownData === undefined ? (response as { data?: unknown }).data : ownData;
  };

  const kpisPayload = kpisRes.status === 'fulfilled' ? readGenericApiData(kpisRes.value) : null;
  const mappingsPayload =
    mappingsRes.status === 'fulfilled' ? readGenericApiData(mappingsRes.value) : null;

  const kpis = mapResultsKpis(
    Array.isArray(kpisPayload) ? kpisPayload : [],
    Array.isArray(mappingsPayload) ? mappingsPayload : []
  );

  return {
    initiatives: [],
    kpis,
    source: 'legacy',
  };
}

export async function loadResultsKpis(): Promise<KpiCatalogRuntimeResult> {
  const canonicalOnly = isResultsOwnerReviewModeEnabled();
  try {
    const catalog = unwrapCatalog(await V8ResultsApi.getKpiCatalog());
    const initiatives = Array.isArray(catalog?.initiatives) ? catalog.initiatives : [];
    const kpis = mapResultsKpis(
      Array.isArray(catalog?.kpis) ? catalog.kpis : [],
      Array.isArray(catalog?.mappings) ? catalog.mappings : []
    );

    if (initiatives.length === 0 && kpis.length === 0) {
      if (canonicalOnly) return { initiatives, kpis, source: 'v8' };
      // Presenter/demo curated data takes priority when enabled.
      if (shouldUseResultsShowcaseData()) {
        return showcaseResult();
      }
      // Z82 / split-brain: V8 is ENABLED but the `v8_kpi_*` tables are empty while
      // the legacy `initiative_kpis` tables hold the real data. V8 returns 200-empty
      // (not an error), so the catch-block fallback below never fires — fall back to
      // legacy here too, otherwise Results renders blank despite real data existing.
      const legacy = await loadLegacyResultsKpis();
      if (legacy.kpis.length > 0) {
        return legacy;
      }
      // Nothing anywhere — surface the (empty) V8 result.
      return { initiatives, kpis, source: 'v8' };
    }

    return {
      initiatives,
      kpis,
      source: 'v8',
    };
  } catch (error) {
    if (canonicalOnly) throw error;
    if (!shouldFallbackToLegacyResults(error)) {
      throw error;
    }

    if (typeof console !== 'undefined') {
      console.warn(
        '[kpiRuntime] V8 Results API unavailable, falling back to deprecated /api/benefits/* paths. ' +
          'The /api/v8/results/* endpoints are the canonical SSOT. Legacy paths will be removed in a future release.'
      );
    }

    const legacy = await loadLegacyResultsKpis();
    if (legacy.kpis.length === 0 && shouldUseResultsShowcaseData()) {
      return showcaseResult();
    }
    return legacy;
  }
}
