/**
 * Łańcuch zarządzania inicjatywą (DEC-424) — klient jedynych kanonicznych tras.
 *
 * Powód istnienia: do 2026-09-07 front nie wołał ANI RAZU zmiany statusu inicjatywy
 * z listy ani z Realizacji; jedyny „pisarz" (`updateInitiativeStatusWriteTruth`) wisiał
 * na przeciągnij-i-upuść kanbana, który jest wyłączony (`canDrag={false}`). Ten moduł
 * daje trzy operacje i NIC WIĘCEJ: podgląd, przejście, flagę wstrzymania.
 *
 * Trasy zastane (`/start-execution`, `/block`, `/unblock`, `/move`) są od decyzji 26A
 * wygaszone (409) i nie wolno ich tu wołać.
 */

import { Api } from '@/services/api';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';

export interface InitiativeTransitionPreflightItem {
  targetStatus: string;
  gate: string | null;
  requiredRoles: string[];
  roleAllowed: boolean;
  conditionSatisfied: boolean;
  blockingRule: string | null;
  /** Dla `GATE_BLOCKED`: brakujące wymagania gotowości bramki (klucz + etykieta serwera). */
  blockingItems?: Array<{ key: string; label: string }>;
  requiresReason: boolean;
  allowed: boolean;
}

export interface InitiativeFlagPreflightItem {
  operation: 'HOLD' | 'RESUME' | 'ARCHIVE';
  gate: string;
  requiredRoles: string[];
  roleAllowed: boolean;
  requiresReason: boolean;
  stateAllowed: boolean;
  allowed: boolean;
}

export interface InitiativeTransitionPreflight {
  initiativeId: string;
  currentStatus: string;
  onHold: boolean;
  archived: boolean;
  isAuthor: boolean;
  effectiveRoles: string[];
  transitions: InitiativeTransitionPreflightItem[];
  flags: InitiativeFlagPreflightItem[];
}

/** Kod reguły z serwera; UI mapuje go na polski komunikat. Nigdy nie tłumacz na serwerze. */
export type InitiativeBlockingRule =
  | 'TITLE_AND_JUSTIFICATION_REQUIRED'
  | 'REASON_REQUIRED'
  | 'INITIATIVE_CARD_INCOMPLETE'
  | 'GATE_DECISION_REQUIRED'
  | 'HANDOFF_AND_START_DATE_REQUIRED'
  | 'OPEN_WORK_BLOCKS_CLOSURE'
  | 'GATE_BLOCKED'
  | 'AUTHOR_ONLY';

export async function fetchInitiativeTransitionPreflight(
  initiativeId: string
): Promise<InitiativeTransitionPreflight> {
  const response = await Api.get(
    `/initiatives/${encodeURIComponent(initiativeId)}/transition-preflight`
  );
  const payload = (response?.data ?? response) as InitiativeTransitionPreflight;
  if (!payload || !Array.isArray(payload.transitions)) {
    throw new Error('Odpowiedź podglądu przejść nie ma oczekiwanego kształtu');
  }
  return payload;
}

/**
 * E1c/F2 (10.09, po E2/E2b): trzy nowe kody odmowy z bramki uprawnień
 * (`effectiveCapability.middleware.ts`) — koperta 403 tej bramki niesie
 * `code` (`CAPABILITY_OBJECT_OWNERSHIP_REQUIRED` / `_PREDICATE_MISSING` /
 * `_CHECK_FAILED`), NIGDY `rule`. Bez tego zestawu `readInitiativeFailureRule`
 * zwracał `null` dla takiej odmowy, a `useInitiativeLifecycle.run` pokazywał
 * `error.message` — generyczny angielski „Capability required" zamiast
 * polskiego zdania o właścicielu inicjatywy.
 */
const KODY_ODMOWY_WLASNOSCI = new Set([
  'CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
  'CAPABILITY_OWNERSHIP_PREDICATE_MISSING',
  'CAPABILITY_OWNERSHIP_CHECK_FAILED',
]);

/**
 * Kod reguły z odrzuconego zapisu. `ApiError.data` niesie pełną kopertę serwera,
 * więc powód („brak powodu", „otwarte zadania") nie ginie za ogólnikiem.
 */
export const readInitiativeFailureRule = (error: unknown): string | null => {
  const data = (error as { data?: { rule?: unknown; code?: unknown } } | null)?.data;
  const rule = data && typeof data === 'object' ? (data as { rule?: unknown }).rule : null;
  if (rule) return String(rule);
  const code = data && typeof data === 'object' ? (data as { code?: unknown }).code : null;
  const normalizedCode = code ? String(code).toUpperCase() : '';
  return KODY_ODMOWY_WLASNOSCI.has(normalizedCode)
    ? 'CAPABILITY_OBJECT_OWNERSHIP_REQUIRED'
    : null;
};

export async function applyInitiativeTransition(
  initiativeId: string,
  targetStatus: string,
  reason?: string
): Promise<void> {
  // ZERO cichych awarii: brak `.catch(() => {})`. Błąd leci do wołającego,
  // który MUSI go pokazać po polsku.
  await Api.patch(`/initiatives/${encodeURIComponent(initiativeId)}/status`, {
    status: targetStatus,
    ...(reason && reason.trim() ? { reason: reason.trim() } : {}),
  });
  bumpInitiativeRefresh();
}

export async function setInitiativeLifecycleFlag(
  initiativeId: string,
  operation: 'HOLD' | 'RESUME',
  reason?: string
): Promise<void> {
  await Api.post(`/initiatives/${encodeURIComponent(initiativeId)}/lifecycle-flag`, {
    operation,
    ...(reason && reason.trim() ? { reason: reason.trim() } : {}),
  });
  bumpInitiativeRefresh();
}
