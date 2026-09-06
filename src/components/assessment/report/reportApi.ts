/**
 * AssessmentReportView — data fetching.
 *
 * Reuses the EXISTING method-core kernel endpoints — no new server route.
 * Verified directly against `server/src/routes/method-core.routes.ts`
 * (28 routes, all mounted at `/api/method` via
 * `server/src/Gateway.ts:902` — `app.use('/api/method', methodCoreRoutes)`):
 *
 *   GET /api/method/outputs/:id             — full immutable Output
 *   GET /api/method/sessions/:id            — session metadata
 *   GET /api/method/sessions/:id/approvals  — approval trail ("kto zatwierdził")
 *
 * ★ CORRECTION (verified empirically before writing this file, not assumed):
 * there is NO `GET /api/method/outputs/:id/report`. That path only has a
 * `router.post(...)` handler (`createArtefactSnapshot` — it creates a NEW
 * Report *snapshot* row from client-supplied `content`, it does not read
 * one). A same-repo coordinator flagged this path as "already existing" —
 * empirical proof offered was a live 401 on the running dev server. That
 * 401 is a false positive: `method-core.routes.ts:110` runs
 * `router.use(verifyToken, isAuthenticated)` with NO path filter, so it
 * intercepts and 401s ANY request under `/api/method/*`, including paths
 * with zero matching route — confirmed by curling a deliberately bogus path
 * under the same prefix and getting the identical 401 body, while a bogus
 * path OUTSIDE `/api/method` correctly 404s. Recorded here so nobody
 * re-derives "the GET report endpoint exists" from the same false signal.
 *
 * `getOutput`/`getSession` are re-used from the shared kernel client
 * (`@/method-core/api/methodCoreApi`) rather than re-implemented — only the
 * approvals fetch is new (no existing client function calls that route).
 * `getOutput`'s return type is the client's NARROWED `MethodOutputSummary`;
 * the real JSON on the wire is the full `MethodOutputRecord` (see
 * `types.ts`'s header comment) — cast once, at this one boundary, with the
 * reasoning on record, rather than scattering `as any` through the renderer.
 */
import {
  getOutput as getOutputSummary,
  getSession as getSessionRaw,
  isAuthError,
  isOfflineError,
  MethodCoreApiError,
} from '@/method-core/api/methodCoreApi';
import { fetchWithRetry, getHeaders } from '@/services/api/baseClient';

import {
  idOcenyZWierszaZastanego,
  projektujOceneZastanaNaOutput,
  projektujRaportZastanyNaTresc,
  type LegacyAssessmentDetail,
} from '../assessmentOutputProjection';
import type {
  FullAssessmentOutput,
  LegacyReportNarrative,
  ReportApproval,
  ReportSessionMeta,
} from './types';

export { isAuthError, isOfflineError, MethodCoreApiError };

const BASE = '/api/method';

async function handleJson<T>(promise: Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await promise;
  } catch (err) {
    throw new MethodCoreApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      {},
      true
    );
  }
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new MethodCoreApiError(
      typeof body.error === 'string' ? body.error : `Request failed with ${res.status}`,
      res.status,
      body
    );
  }
  return body as T;
}

export interface OutputFetchResult {
  readonly output: FullAssessmentOutput;
  readonly superseded: boolean;
  readonly supersededByOutputId: string | null;
  /** Z którego magazynu przyszedł ten wynik — patrz
   * `src/components/assessment/assessmentOutputProjection.ts`. */
  readonly source: 'method-core' | 'legacy';
  readonly unitNotes?: Readonly<Record<string, string>>;
  readonly narrative?: LegacyReportNarrative | null;
}

/** Pełna ocena zastana z `answers.drd.areas`. Endpoint `/api/assessments/:id`
 * NIE nadaje się: świadomie wycina `answers_json` (`assessment-hub.routes.ts`),
 * więc macierz nie miałaby z czego powstać — sprawdzone na żywym serwerze,
 * nie wyczytane z typów. */
async function pobierzOceneZastana(assessmentId: string): Promise<LegacyAssessmentDetail | null> {
  try {
    const res = await handleJson<{ data?: { assessment?: LegacyAssessmentDetail } }>(
      fetchWithRetry(`/api/v8/assessment/${encodeURIComponent(assessmentId)}`, {
        method: 'GET',
        headers: getHeaders(),
      })
    );
    return res.data?.assessment ?? null;
  } catch (err) {
    if (err instanceof MethodCoreApiError && err.status === 404) return null;
    throw err;
  }
}

/** Raport zastany powiązany z oceną — treść, nie liczby. Brak raportu to NIE
 * jest błąd: ocena bez raportu i tak wyświetla macierz oraz rozdziały osi. */
async function pobierzTrescRaportuZastanego(
  assessmentId: string
): Promise<LegacyReportNarrative | null> {
  try {
    const lista = await handleJson<{ reports?: { id?: string; assessmentId?: string }[] }>(
      fetchWithRetry('/api/assessment-reports', { method: 'GET', headers: getHeaders() })
    );
    const dopasowany = (lista.reports ?? []).find((r) => r.assessmentId === assessmentId);
    if (!dopasowany?.id) return null;
    const szczegol = await handleJson<Record<string, unknown>>(
      fetchWithRetry(`/api/assessment-reports/${encodeURIComponent(dopasowany.id)}`, {
        method: 'GET',
        headers: getHeaders(),
      })
    );
    return projektujRaportZastanyNaTresc(szczegol);
  } catch {
    return null;
  }
}

/** Prawdziwe Output jądra metodycznego mają identyfikator UUID (klucz główny
 * tabeli jądra). Stare linki do ocen zastanych sprzed dodania prefiksu
 * `ocena~` (np. `assess-drd-enterprise-01`, seed demo) nie są UUID-em — pytanie
 * jądra o taki identyfikator dałoby PEWNY 404. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fetches the immutable Output. Returns `null` on a 404 ("this id does not
 * exist / does not belong to this org") — the caller renders the honest
 * "not frozen" state, never a substitute calculation. */
export async function fetchOutputForReport(outputId: string): Promise<OutputFetchResult | null> {
  // Wiersz z przestrzeni zastanej (`ocena~<id>`) nigdy nie istnieje w jądrze —
  // pytanie o niego dałoby tylko 404 i mylący log.
  const idOcenyZastanej = idOcenyZWierszaZastanego(outputId);
  if (idOcenyZastanej) return pobierzRaportZMagazynuZastanego(idOcenyZastanej);

  // KOSMETYKA (RAPORT_A3 KOSMETYKA #6, 2026-09-06): dla identyfikatora bez
  // prefiksu, ale też NIE w kształcie UUID — stary link sprzed prefiksu —
  // sprawdzamy magazyn zastany OD RAZU, zamiast najpierw pytać jądro o
  // identyfikator, który nie może tam istnieć. Bez tego KAŻDE wejście w
  // taki raport logowało pewny, oczekiwany `GET /api/method/outputs/<id>`
  // 404 w konsoli przeglądarki (log sieciowy, nie da się go stłumić inaczej
  // niż nie wysyłając żądania). Jeśli magazyn zastany też nic nie ma —
  // spadamy do zwykłej ścieżki jądra niżej (bez zmiany zachowania brzegowego).
  if (!UUID_RE.test(outputId)) {
    const zastany = await pobierzRaportZMagazynuZastanego(outputId);
    if (zastany) return zastany;
  }

  try {
    const res = await getOutputSummary(outputId);
    // See module header comment — the wire payload is the FULL record.
    return {
      output: res.output as unknown as FullAssessmentOutput,
      superseded: res.superseded,
      supersededByOutputId: res.supersededByOutputId,
      source: 'method-core',
    };
  } catch (err) {
    if (err instanceof MethodCoreApiError && err.status === 404) {
      // Ten sam identyfikator BEZ prefiksu też sprawdzamy w magazynie
      // zastanym: linki wystawione zanim lista dostała prefiks (a także
      // ręcznie wklejone id oceny) mają dalej otwierać raport, nie ścianę.
      return pobierzRaportZMagazynuZastanego(outputId);
    }
    throw err;
  }
}

/** Druga połowa projekcji scalającej po stronie trasy raportu: ocena zastana
 * + jej raport → dokładnie ten sam kształt, co zamrożony Output jądra. */
async function pobierzRaportZMagazynuZastanego(
  assessmentId: string
): Promise<OutputFetchResult | null> {
  const assessment = await pobierzOceneZastana(assessmentId);
  if (!assessment) return null;
  const { output, notatkiObszarow } = projektujOceneZastanaNaOutput(assessment);
  const narrative = await pobierzTrescRaportuZastanego(assessmentId);
  return {
    output,
    superseded: false,
    supersededByOutputId: null,
    source: 'legacy',
    unitNotes: notatkiObszarow,
    narrative,
  };
}

/** Fetches session metadata for the header block (module, pinned method
 * pack, lifecycle state). Returns `null` on 404 rather than throwing — the
 * report still renders from the Output alone, just without session
 * enrichment, and says so. */
export async function fetchSessionForReport(sessionId: string): Promise<ReportSessionMeta | null> {
  try {
    const res = await getSessionRaw(sessionId);
    return res.session as unknown as ReportSessionMeta;
  } catch (err) {
    if (err instanceof MethodCoreApiError && err.status === 404) return null;
    throw err;
  }
}

/** Fetches the approval trail for the EXACT session revision the Output was
 * frozen from — this is where "kto zatwierdził" comes from (S2 hard rule
 * #4: approvals are scoped by sessionId, and a reopened session always gets
 * a brand-new sessionId, so this can never surface another revision's
 * decision). Returns `[]` on failure rather than throwing — approver info
 * is an enrichment, not a precondition for showing the frozen result. */
export async function fetchApprovalsForReport(sessionId: string): Promise<ReportApproval[]> {
  try {
    const res = await handleJson<{ approvals: ReportApproval[] }>(
      fetchWithRetry(`${BASE}/sessions/${encodeURIComponent(sessionId)}/approvals`, {
        method: 'GET',
        headers: getHeaders(),
      })
    );
    return res.approvals ?? [];
  } catch {
    return [];
  }
}
