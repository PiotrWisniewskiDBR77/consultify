/**
 * Zlecenia (Case Workspace) — Teresa CASE INTAKE (rozmowa -> potwierdzenie -> Case).
 *
 * R4-P1. Osobny plik (poza `api.ts` — zakaz edycji w tym pakiecie), bo woła
 * NOWE trasy backendu dodane w `server/src/routes/v10/teresa.routes.ts`
 * (`/api/v10/teresa/case-intake/...`) — jedynym Teresa-routerze, który
 * `Gateway.ts` faktycznie montuje. Te trasy tylko DELEGUJĄ do
 * `caseIntakeService` (patrz nagłówek tamtego bloku w `teresa.routes.ts`) —
 * ten sam serwis, którym `routes/v8/chat.routes.ts` już żywo tworzy Case'y
 * (dowiedzione curl-em: `POST .../case-intake/turn` -> `POST .../confirm` ->
 * 201, realny wiersz w `case_core`). Ten plik jest jedynym miejscem we
 * frontendzie, które te trasy woła — przed tym pakietem `grep case-intake`
 * w `src/` pokazywał WYŁĄCZNIE odczyt `GET .../work-orders` w `api.ts`.
 *
 * KANON (niezmienny niezależnie od routera):
 *  · Rozmowa informacyjna -> ZERO Case'ów (backend odmawia propozycji, nawet
 *    gdy ktoś dołączy `workOrder` do wiadomości — patrz `chatIntake.pg.test.ts`).
 *  · Potwierdzenie NIESIE WYŁĄCZNIE `confirmedDigest` — serwer sam czyta
 *    AKTUALNY work order tej rozmowy; przeterminowany digest = 409
 *    (`intake_work_order_digest_stale`), nie po cichu wykonuje starszej wersji.
 *  · Potwierdzenie tworzy DOKŁADNIE JEDEN Case: 201 przy utworzeniu, 200 przy
 *    REUŻYCIU (refresh/retry/wyścig) — nigdy duplikatu, nigdy błędu do
 *    interpretacji przez UI.
 *
 * Zasady komend z `api.ts` (idempotencja, mapowanie 401/403/404/409/422)
 * obowiązują identycznie — `newIdempotencyKey`/`toCommandFailure` są
 * REUŻYTE stąd, nie skopiowane. `confirm` nie potrzebuje osobnego
 * "authoritative readback" zapytania: sama odpowiedź serwera na potwierdzenie
 * JEST autorytatywnym, świeżo odczytanym stanem (`caseId`/`caseCreated`
 * liczone przez `caseIntakeService.confirmWorkOrder` PO zapisie transakcji),
 * więc `readback: 'confirmed'` jest uczciwe bez dodatkowego GET-a — dokładnie
 * ten sam wzorzec co `apiLightStart.ts`.
 */

import { fetchWithRetry, getHeaders, handleResponse } from '@/services/api/baseClient';

import { newIdempotencyKey, toCommandFailure } from './api';
import type { CaseCommandResult } from './types';

const BASE = '/api/v10/teresa/case-intake';

export type CaseIntakeClosureType =
  | 'DELIVERY_COMPLETED'
  | 'DECISION_COMPLETED'
  | 'IMPLEMENTATION_COMPLETED'
  | 'OUTCOME_VALIDATED'
  | 'COMPLETED_PARTIAL';

export type CaseIntakeCaseProfile = 'LIGHT' | 'STANDARD' | 'TRANSFORMATION' | 'MONITORING';
export type CaseIntakeGovernanceTier = 'LIGHTWEIGHT' | 'STANDARD' | 'CONTROLLED';
export type CaseIntakeAutonomyPolicy =
  | 'ASK_EACH_ACTION'
  | 'ASK_MATERIAL_ACTIONS'
  | 'EXECUTE_APPROVED_PLAN';

/**
 * To, co Teresa POKAZUJE człowiekowi przed kliknięciem "Potwierdź". `goal`,
 * `scope` i `expectedOutcome` są WYMAGANE — reszta to metadane governance,
 * które i tak wchodzą w digest, więc człowiek potwierdza też profil i
 * politykę autonomii, nie tylko treść.
 */
export interface CaseIntakeWorkOrderDraft {
  projectId: string;
  goal: string;
  scope: string[];
  expectedOutcome: string;
  constraints?: string[] | null;
  successCriteria?: string[] | null;
  contractedClosureType: CaseIntakeClosureType;
  caseProfile?: CaseIntakeCaseProfile | null;
  governanceTier?: CaseIntakeGovernanceTier | null;
  autonomyPolicy?: CaseIntakeAutonomyPolicy | null;
  sourceMessageId?: string | null;
}

/** Znormalizowany, w pełni zdigestowany work order — to, co faktycznie podpisuje digest. */
export interface CaseIntakeCanonicalWorkOrder extends CaseIntakeWorkOrderDraft {
  workOrderSchemaVersion: number;
  organizationId: string;
  caseName: string;
  constraints: string[];
  successCriteria: string[];
  caseProfile: CaseIntakeCaseProfile;
  governanceTier: CaseIntakeGovernanceTier;
  autonomyPolicy: CaseIntakeAutonomyPolicy;
  sourceConversationId: string | null;
}

export type CaseIntakeRunStartPolicy =
  | 'MAY_START_SINGLE_RUN_AFTER_CONFIRMATION'
  | 'REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START';

export interface CaseIntakeProposeResult {
  conversationId: string;
  workOrder: CaseIntakeCanonicalWorkOrder;
  workOrderId: string;
  /** `sha256:<64 hex>` — DOKŁADNIE to, co trzeba wysłać do `confirmWorkOrder`. */
  workOrderDigest: string;
  alreadyProposed: boolean;
  runStartPolicy: CaseIntakeRunStartPolicy;
  caseCreated: false;
  runCreated: false;
}

export interface CaseIntakeCurrentWorkOrder {
  conversationId: string;
  workOrderId: string;
  workOrderDigest: string;
  workOrder: CaseIntakeCanonicalWorkOrder;
  proposedEventId: string;
  proposedAt: string;
  proposedByActorId: string;
  runStartPolicy: CaseIntakeRunStartPolicy;
  caseCreated: false;
  runCreated: false;
}

export type CaseIntakeReuseReason = 'none' | 'work_order_already_confirmed';

export interface CaseIntakeConfirmResult {
  conversationId: string;
  caseId: string;
  workOrderId: string;
  workOrderDigest: string;
  /** false = to wywołanie utworzyło Case; true = zwrócono ISTNIEJĄCY (refresh/retry/wyścig). */
  caseCreated: boolean;
  reused: boolean;
  reuseReason: CaseIntakeReuseReason;
  confirmedEventId: string;
  confirmedEventDeduplicated: boolean;
  runStartPolicy: CaseIntakeRunStartPolicy;
  runCreated: false;
}

export interface CaseIntakeConversationLink {
  caseId: string;
  conversationId: string;
  projectId: string | null;
  workOrderId: string;
  workOrderDigest: string;
  confirmedByActorId: string;
  confirmedAt: string;
  confirmedEventId: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${BASE}${path}`, { headers: getHeaders() });
  const json = await handleResponse<{ data: T }>(res, `V10 GET ${path}`);
  return json.data;
}

/**
 * "Oto dokładnie to, co zrozumiałam, że chcesz." Zapisuje, że TEN summary
 * został POKAZANY i zwraca go z digestem. Tworzy ZERO Case'ów i ZERO Runów.
 * Bezpieczne do ponowienia — ten sam `workOrder` daje `alreadyProposed: true`
 * i TEN SAM digest, nigdy drugiego zdarzenia propozycji.
 */
export async function proposeConversationWorkOrder(
  conversationId: string,
  workOrder: CaseIntakeWorkOrderDraft
): Promise<CaseCommandResult<CaseIntakeProposeResult>> {
  const idempotencyKey = newIdempotencyKey();
  try {
    const res = await fetchWithRetry(
      `${BASE}/conversations/${encodeURIComponent(conversationId)}/summary`,
      {
        method: 'POST',
        headers: { ...getHeaders(), 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(workOrder),
      }
    );
    const json = await handleResponse<{ data: CaseIntakeProposeResult }>(
      res,
      `V10 POST case-intake/conversations/${conversationId}/summary`
    );
    return { ok: true, value: json.data, readback: 'confirmed', idempotencyKey };
  } catch (error) {
    return { ok: false, failure: toCommandFailure(error), idempotencyKey };
  }
}

/**
 * AKTUALNY work order tej rozmowy (odczyt, nie komenda) — to, co ekran musi
 * przeczytać PONOWNIE po odświeżeniu strony, żeby przycisk "Potwierdź" nigdy
 * nie niósł digestu sprzed przeredagowania.
 */
export function getCurrentConversationWorkOrder(
  conversationId: string
): Promise<CaseIntakeCurrentWorkOrder | null> {
  return get<CaseIntakeCurrentWorkOrder | null>(
    `/conversations/${encodeURIComponent(conversationId)}/work-order`
  );
}

/**
 * Człowiek kliknął "Potwierdź". Ciało niesie WYŁĄCZNIE `confirmedDigest` —
 * digest z ostatniej odpowiedzi `proposeConversationWorkOrder` albo
 * `getCurrentConversationWorkOrder`, NIGDY ręcznie zbudowany. 201 = ten
 * request utworzył Case; 200 = zwrócono istniejący (podwójny klik, retry po
 * zerwanym połączeniu, dwie równoległe konfirmacje) — oba stany wracają jako
 * `ok: true`, nigdy jako błąd do interpretacji przez UI.
 */
export async function confirmConversationWorkOrder(
  conversationId: string,
  confirmedDigest: string
): Promise<CaseCommandResult<CaseIntakeConfirmResult>> {
  const idempotencyKey = newIdempotencyKey();
  try {
    const res = await fetchWithRetry(
      `${BASE}/conversations/${encodeURIComponent(conversationId)}/confirm`,
      {
        method: 'POST',
        headers: { ...getHeaders(), 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ confirmedDigest }),
      }
    );
    const json = await handleResponse<{ data: CaseIntakeConfirmResult }>(
      res,
      `V10 POST case-intake/conversations/${conversationId}/confirm`
    );
    return { ok: true, value: json.data, readback: 'confirmed', idempotencyKey };
  } catch (error) {
    return { ok: false, failure: toCommandFailure(error), idempotencyKey };
  }
}

/** Rozmowa -> Case. `null`, gdy ten czat nigdy nie wyprodukował Case'a. */
export function getCaseForConversation(
  conversationId: string
): Promise<CaseIntakeConversationLink | null> {
  return get<CaseIntakeConversationLink | null>(
    `/conversations/${encodeURIComponent(conversationId)}/case`
  );
}

/** Case -> rozmowa ("wróć do czatu, z którego to powstało"). */
export function getConversationForCase(
  caseId: string
): Promise<CaseIntakeConversationLink | null> {
  return get<CaseIntakeConversationLink | null>(`/cases/${encodeURIComponent(caseId)}/conversation`);
}
