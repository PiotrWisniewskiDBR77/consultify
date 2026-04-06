import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import {
  mapResultsKpis,
  type ResultsKPI,
  type ResultsTrackedInitiative,
} from './kpiDomain';

export interface KpiCatalogRuntimeResult {
  initiatives: ResultsTrackedInitiative[];
  kpis: ResultsKPI[];
  source: 'v8' | 'legacy' | 'empty';
}

export async function loadResultsKpis(): Promise<KpiCatalogRuntimeResult> {
  try {
    const catalog = await V8ResultsApi.getKpiCatalog();
    return {
      initiatives: Array.isArray(catalog?.initiatives) ? catalog.initiatives : [],
      kpis: mapResultsKpis(
        Array.isArray(catalog?.kpis) ? catalog.kpis : [],
        Array.isArray(catalog?.mappings) ? catalog.mappings : []
      ),
      source: 'v8',
    };
  } catch (error) {
    if (!shouldFallbackToLegacyResults(error)) {
      throw error;
    }

    const [kpisRes, mappingsRes] = await Promise.allSettled([
      Api.get('/benefits/kpis'),
      Api.get('/benefits/kpi-mappings'),
    ]);

    const kpisPayload: any = kpisRes.status === 'fulfilled' ? kpisRes.value : null;
    const mappingsPayload: any = mappingsRes.status === 'fulfilled' ? mappingsRes.value : null;

    return {
      initiatives: [],
      kpis: mapResultsKpis(kpisPayload?.data || [], mappingsPayload?.data || []),
      source: (kpisPayload?.data || mappingsPayload?.data) ? 'legacy' : 'empty',
    };
  }
}
