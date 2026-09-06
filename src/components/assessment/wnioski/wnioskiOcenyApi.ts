/**
 * Wnioski z Oceny (DEC-416) — klient dwóch ISTNIEJĄCYCH powierzchni serwera.
 *
 * POMIAR 06.09 (zakładka „Wnioski” Oceny): lista pokazywała wyłącznie ZAPISY
 * SESJI (`/api/method/outputs` + magazyn zastany `/api/assessments`), a moduł
 * nie miał żadnego przycisku „zrób wniosek”. Silnik jednak istniał i pisał
 * wnioski „w bok”: most `safePersistDrdReportConclusion` zapisywał streszczenie
 * wykonawcze raportu DRD do warstwy Wniosków (`conclusions`) jako efekt uboczny
 * oglądania raportu. Ten moduł spina te dwa końce:
 *   - `listaRaportowOceny` — `GET /api/assessment-reports` (istniejąca trasa),
 *   - `generujWniosekZRaportu` — `POST /api/assessment-reports/:id/conclusion`
 *     (przewód dodany w tym samym kroku; woła ten sam most, ale z `await` i
 *     zwraca `conclusionId`, żeby UI mogło od razu otworzyć kartę wniosku).
 *
 * Świadomie NIE ma tu żadnego promptu ani modelu treści — wniosek powstaje w
 * silniku raportu DRD, a nie w tym pliku.
 */
import { fetchWithRetry, getHeaders, handleResponse } from '@/services/api/baseClient';

export interface RaportOceny {
  id: string;
  name: string;
  assessmentId: string | null;
  assessmentName: string;
  assessmentType: string | null;
  status: string;
  updatedAt?: string | null;
}

export interface WynikGeneracjiWniosku {
  conclusionId: string;
  title: string;
  status: string;
  sourceRefs: Array<{ type: string; id: string; title?: string | null; url?: string | null }>;
  narrative?: string | null;
}

export async function listaRaportowOceny(): Promise<RaportOceny[]> {
  const res = await fetchWithRetry('/api/assessment-reports', {
    method: 'GET',
    headers: getHeaders(),
  });
  const body = await handleResponse<{ reports?: RaportOceny[] }>(res, 'GET /assessment-reports');
  return (body.reports ?? []).filter((r) => typeof r?.id === 'string' && r.id.length > 0);
}

export async function generujWniosekZRaportu(reportId: string): Promise<WynikGeneracjiWniosku> {
  // ZMIERZONE 06.09 na stanowisku lokalnym: domyślny limit 20 s w
  // `fetchWithRetry` przerywał to wywołanie i UI pokazywało „Request timed
  // out", chociaż serwer kończył pracę i wniosek POWSTAWAŁ w bazie — najgorszy
  // możliwy komunikat: kłamie o porażce. Generacja przechodzi przez model
  // raportu DRD (narrator LLM + ugruntowanie), więc ma własny, długi limit.
  // Powtórzenie jest bezpieczne: warstwa Wniosków deduplikuje po rodowodzie.
  const res = await fetchWithRetry(
    `/api/assessment-reports/${encodeURIComponent(reportId)}/conclusion`,
    { method: 'POST', headers: getHeaders(), body: JSON.stringify({}), timeoutMs: 180000 }
  );
  return handleResponse<WynikGeneracjiWniosku>(res, 'POST /assessment-reports/:id/conclusion');
}
