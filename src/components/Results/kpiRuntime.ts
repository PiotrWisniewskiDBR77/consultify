import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import {
  mapResultsKpis,
  type ResultsKPI,
  type ResultsTrackedInitiative,
} from './kpiDomain';
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

    return {
      initiatives: [],
      kpis,
      source: kpis.length > 0 ? 'legacy' : 'empty',
    };
  }
}
