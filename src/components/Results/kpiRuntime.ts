import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import { mapResultsKpis, type ResultsKPI, type ResultsTrackedInitiative } from './kpiDomain';
import {
  createResultsShowcaseInitiatives,
  createResultsShowcaseKpis,
  shouldUseResultsShowcaseData,
} from './resultsShowcaseData';

export interface KpiCatalogRuntimeResult {
  initiatives: ResultsTrackedInitiative[];
  kpis: ResultsKPI[];
  source: 'v8' | 'legacy' | 'empty' | 'showcase';
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

  const kpisPayload: any = kpisRes.status === 'fulfilled' ? kpisRes.value : null;
  const mappingsPayload: any = mappingsRes.status === 'fulfilled' ? mappingsRes.value : null;

  const kpis = mapResultsKpis(kpisPayload?.data || [], mappingsPayload?.data || []);

  return {
    initiatives: [],
    kpis,
    source: 'legacy',
  };
}

export async function loadResultsKpis(): Promise<KpiCatalogRuntimeResult> {
  try {
    const catalog = await V8ResultsApi.getKpiCatalog();
    const initiatives = Array.isArray(catalog?.initiatives) ? catalog.initiatives : [];
    const kpis = mapResultsKpis(
      Array.isArray(catalog?.kpis) ? catalog.kpis : [],
      Array.isArray(catalog?.mappings) ? catalog.mappings : []
    );

    if (initiatives.length === 0 && kpis.length === 0) {
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
