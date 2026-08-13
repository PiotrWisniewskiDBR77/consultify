/**
 * RN-G2 — shared, tiny client for the three read-only legacy-archive index
 * endpoints (`GET /api/vnext/results/{kpi,roi,okr}/legacy`).
 *
 * Same convention as `../roi/roiApi.ts`'s own `getJson` helper (hand-written
 * `fetch` + `getHeaders()` + `API_URL`, not the giant shared `Api` object —
 * see that file's header comment for the rationale) rather than the ~19k-line
 * `Api.get`, whose axios-like Proxy (`toAxiosLikeResponse` in
 * `src/services/api.ts`) special-cases the property name `data` to mean "the
 * whole payload", which would make it IMPOSSIBLE to reach the real `data`
 * array these routes return in a `{ data, meta }` envelope — see that
 * function's own comment: `if (prop === 'data') return target`.
 *
 * All three legacy-archive routers (`kpiLegacyArchive.routes.ts`,
 * `roiLegacyArchive.routes.ts`, `okrLegacyArchive.routes.ts`) share the EXACT
 * same `GET /` index shape — verified by reading all three route files, not
 * assumed: each returns `{ data: LegacyArchiveIndexRow[], meta }` where every
 * row is `{ sourceTable, originDomain, label, count }` (the row shape is
 * declared once, per domain, next to its `getLegacyArchiveIndex`/
 * `getRoiLegacyArchiveIndex`/`getOkrLegacyArchiveIndex` repository function —
 * e.g. `server/src/services/resultsVnext/kpi/kpiLegacyArchiveRepository.ts`'s
 * `LegacyArchiveIndexRow`). That shared shape is what this client — and the
 * panel built on top of it — actually reads.
 *
 * Per-legacy-table row detail (`GET /kpi/legacy/kpis`, `/kpi-definitions`,
 * etc.) is deliberately OUT of scope here: each of those ~20 sub-tables is a
 * raw legacy DB row with its own, genuinely different column set (see each
 * repository file's own row-shape comments) — building per-table
 * `StandardTable` column configs for all of them is real, per-domain work
 * for the wave that actually wires this panel into a hub tab, not this prep
 * package (RN_G2_UI_SCOPE.md's own "bounded packages" philosophy: this
 * client + panel is the shared shell, the next wave supplies the per-table
 * columns exactly like KPI/ROI/OKR registries supply their own `table` prop
 * to `ResultsVNextRegistryShell`).
 */
import { API_URL, getHeaders } from '@/services/api';

export type ResultsVNextLegacyDomain = 'kpi' | 'roi' | 'okr';

/** Mirrors the closed `OriginDomain` union declared in every `*LegacyArchive.routes.ts` file. */
export type LegacyArchiveOriginDomain = 'results_legacy' | 'table_platform_live';

export interface LegacyArchiveIndexRow {
  sourceTable: string;
  originDomain: LegacyArchiveOriginDomain;
  label: string;
  count: number;
}

export interface LegacyArchiveIndexMeta {
  label: string;
  readOnly: true;
  organizationId: string;
  fetchedAt: string;
}

export interface LegacyArchiveIndexResponse {
  data: LegacyArchiveIndexRow[];
  meta: LegacyArchiveIndexMeta;
}

export class LegacyArchiveApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'LegacyArchiveApiError';
    this.status = status;
    this.code = code;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new LegacyArchiveApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through with a generic message
    }
    throw new LegacyArchiveApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

/**
 * `GET /api/vnext/results/{domain}/legacy` — read-only index of every legacy
 * source table for that domain (label + origin + row count). All GET, no
 * mutation endpoint exists anywhere under `.../legacy` — see the
 * `denyMutations` middleware mounted FIRST in every one of these routers.
 */
export async function listLegacyArchiveIndex(
  domain: ResultsVNextLegacyDomain
): Promise<LegacyArchiveIndexResponse> {
  return getJson<LegacyArchiveIndexResponse>(`/vnext/results/${domain}/legacy`);
}
