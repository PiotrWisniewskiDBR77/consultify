/**
 * Zlecenia (Case Workspace) — LIGHT one-click start ("Zatwierdź i rozpocznij").
 *
 * Osobny plik (poza `api.ts` — zakaz edycji w tym pakiecie), bo woła NOWĄ
 * trasę backendu (`server/src/routes/caseWorkspace/lightStart.routes.ts`),
 * jeszcze NIE zamontowaną w `routes/caseWorkspace/index.ts` (montaż to praca
 * koordynatora — patrz nagłówek tamtej trasy po dokładną linię). Dopóki
 * montaż nie wejdzie, wywołanie tej funkcji na żywym backendzie zwróci 404 —
 * to oczekiwane, nie błąd tego pliku.
 *
 * Ta jedna trasa robi WIĘCEJ niż zwykła komenda z `api.ts`: backend zwraca w
 * JEDNEJ odpowiedzi kompletny, świeżo odczytany stan (Case + PlanVersion +
 * Run + NodeRun-y) PO zakończeniu całego łańcucha (Plan v1 → walidacja →
 * propozycja → publikacja → Run → powiązanie → NodeRun). To już jest
 * „authoritative readback" w rozumieniu `api.ts`'s nagłówka (§4) — backend
 * czyta te obiekty PO zapisie, nie przed — więc `readback: 'confirmed'` jest
 * uczciwe bez dodatkowego zapytania. `outcome === 'refused'` to NIE błąd:
 * backend świadomie nie uruchomił Runu i podaje DOKŁADNY powód
 * (`reasonCode`/`reasonDetail`/`blockers`) — to jest komenda, która przeszła,
 * tylko z decyzją odmowną, więc wraca jako `ok: true`, nigdy jako `failure`.
 *
 * Zasady komend z `api.ts` (idempotencja, 401/403/404/409, brak zgadywania
 * wersji) obowiązują identycznie — patrz `newIdempotencyKey`/
 * `toCommandFailure`, reużyte stąd, nie skopiowane.
 */

import { fetchWithRetry, getHeaders, handleResponse } from '@/services/api/baseClient';

import { newIdempotencyKey, toCommandFailure } from './api';
import type {
  CaseCommandResult,
  CaseCoreView,
  CasePlanVersion,
  PlanValidationBlocker,
} from './types';

const V8_PREFIX = '/api/v8';
const BASE = '/case-workspace';

export type LightOneClickOutcome = 'started' | 'already_started' | 'refused';

export interface LightOneClickData {
  outcome: LightOneClickOutcome;
  alreadyStarted: boolean;
  caseId: string;
  case: CaseCoreView;
  /** Obecne tylko dla outcome 'started'/'already_started'. */
  casePlanVersionId?: string;
  planVersion?: CasePlanVersion;
  runId?: string;
  nodeRunIds?: string[];
  /** Obecne tylko dla outcome 'refused'. */
  reasonCode?: string;
  reasonDetail?: string;
  blockers?: PlanValidationBlocker[];
}

/**
 * `POST /cases/:caseId/light-start`. Bezpieczne do ponowienia z TYM SAMYM
 * `idempotencyKey` (podwójny klik, utracona odpowiedź, odświeżenie strony) —
 * backend serializuje wywołania dla jednego `caseId` i po pierwszym pełnym
 * przejściu każde kolejne dostaje `outcome: 'already_started'` z TYM SAMYM
 * `runId`, nigdy drugiego Runu (patrz `lightOneClickService.ts`'s nagłówek).
 */
export async function startLightOneClick(
  caseId: string,
  options?: { idempotencyKey?: string }
): Promise<CaseCommandResult<LightOneClickData>> {
  const idempotencyKey = options?.idempotencyKey ?? newIdempotencyKey();
  try {
    const res = await fetchWithRetry(`${V8_PREFIX}${BASE}/cases/${encodeURIComponent(caseId)}/light-start`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({}),
    });
    const json = await handleResponse<{ data: LightOneClickData }>(
      res,
      `V8 POST ${BASE}/cases/${caseId}/light-start`
    );
    return {
      ok: true,
      value: json.data,
      // Uczciwe bez drugiego zapytania — patrz nagłówek pliku.
      readback: 'confirmed',
      idempotencyKey,
    };
  } catch (error) {
    return { ok: false, failure: toCommandFailure(error), idempotencyKey };
  }
}
