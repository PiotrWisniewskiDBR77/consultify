import { Api } from '@/services/api';

export type ResultsSearchKind = 'kpi' | 'okr_set' | 'roi_case';

export interface ResultsSearchHit {
  kind: ResultsSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  updatedAt: string;
  matchedField: 'title' | 'code' | 'description';
  href: string;
}

export interface ResultsSearchResponse {
  query: string;
  kinds: ResultsSearchKind[];
  results: ResultsSearchHit[];
  nextCursor: string | null;
  scopeCompleteness: 'FULL' | 'PARTIAL';
  unavailableKinds: ResultsSearchKind[];
}

export async function searchResults(
  query: string,
  cursor?: string
): Promise<ResultsSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (cursor) params.set('cursor', cursor);
  const response = await Api.get(`/vnext/results/search?${params}`);
  return response.data as ResultsSearchResponse;
}
