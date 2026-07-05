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

export async function loadResultsKpis(): Promise<KpiCatalogRuntimeResult> {
  try {
    const catalog = await V8ResultsApi.getKpiCatalog();
    const initiatives = Array.isArray(catalog?.initiatives) ? catalog.initiatives : [];
    const kpis = mapResultsKpis(
      Array.isArray(catalog?.kpis) ? catalog.kpis : [],
      Array.isArray(catalog?.mappings) ? catalog.mappings : []
    );

    if (initiatives.length === 0 && kpis.length === 0 && shouldUseResultsShowcaseData()) {
      return {
        initiatives: createResultsShowcaseInitiatives(),
        kpis: createResultsShowcaseKpis(),
        source: 'showcase',
      };
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

    const [kpisRes, mappingsRes] = await Promise.allSettled([
      Api.get('/benefits/kpis'),
      Api.get('/benefits/kpi-mappings'),
    ]);

    const kpisPayload: any = kpisRes.status === 'fulfilled' ? kpisRes.value : null;
    const mappingsPayload: any = mappingsRes.status === 'fulfilled' ? mappingsRes.value : null;

    const initiatives: ResultsTrackedInitiative[] = [];
    const kpis = mapResultsKpis(kpisPayload?.data || [], mappingsPayload?.data || []);

    if (initiatives.length === 0 && kpis.length === 0 && shouldUseResultsShowcaseData()) {
      return {
        initiatives: createResultsShowcaseInitiatives(),
        kpis: createResultsShowcaseKpis(),
        source: 'showcase',
      };
    }

    // BUG-M15-04 (plan field): Harvard/_TRACKER.md documents a "plan field" bug in the
    // M15 results layer left unresolved. Static analysis of v8/results.routes.ts,
    // resultsROIService.ts and benefits.routes.ts found no missing or null-when-required
    // `plan` field in any API response. The bug likely requires a live API trace to reproduce.
    // Candidate: initiative_kpis.target_value vs a potential target_plan_value column.
    // TODO: trace /api/v8/results/kpi-catalog response with an org that has plan targets set.

    // Always return 'legacy' when V8 fell back — regardless of whether legacy returned data.
    // Previously, an empty legacy response produced source:'empty', silently suppressing the
    // degraded banner and runtime chip in ResultsHub. Now the banner/chip always render when
    // V8 is unavailable so users know they are looking at a degraded state. (BUG-M15 L-01)
    return {
      initiatives: [],
      kpis,
      source: 'legacy',
    };
  }
}
