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
  // `Api.get` (src/services/api.ts) is not a generic function — it is a plain
  // `async (url: string) => ...` helper returning `any` — so `Api.get<T>(...)`
  // does not compile (TS2558: "Expected 0 type arguments, but got 1"),
  // verified directly against the tip with `npx tsc --noEmit`. Restoring the
  // generic was attempted and reverted for that reason. The unchecked
  // assertion below is a known, tracked debt: it trusts the server's
  // response shape without runtime or compile-time verification. Fixing it
  // properly requires typing `Api.get` itself (a ~1000-file migration, see
  // the @deprecated notice at the top of services/api.ts) or routing this
  // call through one of the typed `api/*.api.ts` modules instead.
  const response = await Api.get(`/vnext/results/search?${params}`);
  return response.data as ResultsSearchResponse;
}
