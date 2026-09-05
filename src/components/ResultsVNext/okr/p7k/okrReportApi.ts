/**
 * P7K część A — klient read modelu RAPORTU OKR.
 *
 * Dwa endpointy, obie dodane przez tę samą paczkę
 * (`server/src/routes/resultsVnext/okr.routes.ts`, repozytorium
 * `okrReportRepository.ts`):
 *
 *  · `GET /vnext/results/okr/report-summaries` — agregaty WSZYSTKICH
 *    widocznych raportów (cele, rezultaty, rozkład stanu, właściciele,
 *    ostatni check-in). Poziom 1 potrzebuje ich w kolumnach CELE /
 *    REZULTATY / STAN / WŁAŚCICIELE / OSTATNI CHECK-IN, a `GET /sets`
 *    zwraca wyłącznie kolumny `okr_vnext_sets` — żadnej z tych liczb tam
 *    nie ma. Alternatywą byłoby `GET /sets/:id/objectives` NA KAŻDY WIERSZ,
 *    czyli N+1 na wiersz, którego kanon zabrania (i który `okrApi.ts`
 *    nazywa po imieniu w swoim nagłówku).
 *
 *  · `GET /vnext/results/okr/sets/:setId/checkin-summaries` — data i notatka
 *    OSTATNIEGO check-inu per kluczowy rezultat. Bez tego kolumna „OSTATNI
 *    CHECK-IN” w tabeli poziomu 2 kosztowałaby jedno `listCheckIns` na
 *    wiersz (28 wywołań na raporcie DBR77).
 *
 * Ten sam kształt błędu i ta sama warstwa `fetch`, co w `okrApi.ts` —
 * świadomie NIE wydzielamy wspólnego helpera między plikami domeny
 * (konwencja tego programu, opisana w nagłówku `okrObjectiveApi.ts`).
 */
import { API_URL, getHeaders } from '@/services/api';

export class OkrReportApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'OkrReportApiError';
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
    throw new OkrReportApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // treść błędu nie jest JSON-em — zostaje komunikat ogólny
    }
    throw new OkrReportApiError(
      body.error || `Request failed (${res.status})`,
      res.status,
      body.code
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Cztery ROZŁĄCZNE kubełki stanu raportu, liczone po stronie serwera.
 * Suma = liczba nieanulowanych rezultatów; `cancelled` nie jest stanem
 * raportu i nie wchodzi do żadnego kubełka.
 */
export interface OkrReportStateCounts {
  onTrack: number;
  atRisk: number;
  critical: number;
  /** Rezultat `not_started` ALBO bez ani jednego check-inu. */
  noSignal: number;
}

export interface OkrReportSummaryDto {
  setId: string;
  objectiveCount: number;
  keyResultCount: number;
  ownerCount: number;
  stateCounts: OkrReportStateCounts;
  lastCheckinAt: string | null;
}

export async function listOkrReportSummaries(): Promise<OkrReportSummaryDto[]> {
  const { summaries } = await getJson<{ summaries: OkrReportSummaryDto[] }>(
    '/vnext/results/okr/report-summaries'
  );
  return summaries;
}

export interface OkrKeyResultCheckInSummaryDto {
  keyResultId: string;
  lastCheckinAt: string | null;
  lastNote: string | null;
  checkInCount: number;
}

export async function listKeyResultCheckInSummaries(
  setId: string
): Promise<OkrKeyResultCheckInSummaryDto[]> {
  const { checkIns } = await getJson<{ checkIns: OkrKeyResultCheckInSummaryDto[] }>(
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/checkin-summaries`
  );
  return checkIns;
}
