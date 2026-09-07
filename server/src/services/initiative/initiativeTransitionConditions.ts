/**
 * Warunki merytoryczne przejść inicjatywy (DEC-424) — JEDEN kod dla zapisu i dla podglądu.
 *
 * Powód istnienia tego pliku: dopóki warunek („komplet karty", „0 otwartych zadań",
 * „aktualna decyzja GO") był zapisany wyłącznie w ciele `executeInitiativeTransition`,
 * interfejs nie miał jak pokazać powodu blokady PRZED kliknięciem — pokazywał przycisk,
 * a serwer odmawiał po fakcie. Każdy warunek jest tu policzony dokładnie raz i wołany
 * z dwóch miejsc:
 *   1) `executeInitiativeTransition` — ścieżka zapisu (na zablokowanym wierszu),
 *   2) `GET /api/initiatives/:id/transition-preflight` — ścieżka podglądu (bez blokady).
 * Rozjazd między przyciskiem a pisarzem jest więc niemożliwy z konstrukcji.
 *
 * Serwer NIE zwraca tekstu po polsku — zwraca kod reguły (`rule`), a warstwa UI mapuje
 * go na klucz i18n. Dzięki temu jeden komunikat nie żyje w dwóch językach w dwóch repo.
 */

import type { InitiativeTransitionCondition } from '../../constants/initiativeStatuses.js';
import type { PgTransactionClient } from '../../utils/queryHelpers.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export const INITIATIVE_CONDITION_RULES = {
  TITLE_AND_JUSTIFICATION: 'TITLE_AND_JUSTIFICATION_REQUIRED',
  REASON_REQUIRED: 'REASON_REQUIRED',
  CARD_COMPLETE: 'INITIATIVE_CARD_INCOMPLETE',
  CURRENT_GO_DECISION: 'GATE_DECISION_REQUIRED',
  HANDOFF_AND_START_DATE: 'HANDOFF_AND_START_DATE_REQUIRED',
  NO_OPEN_WORK: 'OPEN_WORK_BLOCKS_CLOSURE',
} as const satisfies Record<InitiativeTransitionCondition, string>;

export const INITIATIVE_AUTHOR_ONLY_RULE = 'AUTHOR_ONLY' as const;

export interface InitiativeConditionFailure {
  /** Kod reguły — kontrakt z UI, mapowany na klucz i18n po stronie frontu. */
  rule: string;
  /** Angielski opis techniczny; UI go NIE pokazuje, służy logom i testom. */
  error: string;
}

export interface EvaluateInitiativeConditionInput {
  orgId: string;
  initiativeId: string;
  /** Wiersz `initiatives` — w zapisie zablokowany `FOR UPDATE`, w podglądzie zwykły odczyt. */
  row: Record<string, unknown>;
  condition: InitiativeTransitionCondition;
  /** Powód podany przez użytkownika (już przycięty). */
  reason: string;
  /**
   * Podgląd nie zna jeszcze powodu — dla niego REASON_REQUIRED nie jest blokadą,
   * tylko informacją „to przejście poprosi o powód" (pole `requiresReason`).
   */
  skipReasonRequired?: boolean;
  /**
   * Wstrzykiwane po to, by ścieżka zapisu użyła SWOJEGO przypiętego klienta
   * (ta sama transakcja, ten sam zablokowany wiersz), a podgląd zwykłego odczytu.
   */
  hasApprovedGateDecision: (
    orgId: string,
    initiativeId: string,
    pmoDomain: string,
    client: PgTransactionClient
  ) => Promise<{ ok: boolean; decisionId: string | null }>;
  hasPendingExecutionGateDecisions: (orgId: string, initiativeId: string) => Promise<boolean>;
}

const nonEmpty = (value: unknown): boolean => String(value ?? '').trim().length > 0;

const scopePresent = (row: Record<string, unknown>): boolean =>
  [row.scope_in, row.scope_out].some((value) =>
    Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0
  );

/** Właściciel biznesowy LUB wykonawczy — tak samo jak `executeInitiativeTransition`. */
const ownerId = (row: Record<string, unknown>): unknown =>
  row.owner_business_id ?? row.owner_execution_id;

/**
 * Zwraca `null` gdy warunek spełniony, albo opis blokady.
 * Nigdy nie rzuca dla „warunek niespełniony" — rzut zarezerwowany dla awarii bazy.
 */
export async function evaluateInitiativeTransitionCondition(
  client: PgTransactionClient,
  input: EvaluateInitiativeConditionInput
): Promise<InitiativeConditionFailure | null> {
  const { condition, row, reason, orgId, initiativeId } = input;

  if (condition === 'TITLE_AND_JUSTIFICATION') {
    const titled = nonEmpty(row.title ?? row.name);
    if (!titled || !nonEmpty(row.description)) {
      return {
        rule: INITIATIVE_CONDITION_RULES.TITLE_AND_JUSTIFICATION,
        error: 'Title and justification are required',
      };
    }
    return null;
  }

  if (condition === 'REASON_REQUIRED') {
    if (input.skipReasonRequired) return null;
    if (!nonEmpty(reason)) {
      return { rule: INITIATIVE_CONDITION_RULES.REASON_REQUIRED, error: 'Reason is required' };
    }
    return null;
  }

  if (condition === 'CARD_COMPLETE') {
    if (!nonEmpty(row.description) || !ownerId(row) || !scopePresent(row)) {
      return {
        rule: INITIATIVE_CONDITION_RULES.CARD_COMPLETE,
        error: 'Description, owner and scope are required',
      };
    }
    return null;
  }

  if (condition === 'CURRENT_GO_DECISION') {
    const goNoGo = await input.hasApprovedGateDecision(
      orgId,
      initiativeId,
      'GOVERNANCE_DECISION_MAKING',
      client
    );
    if (!goNoGo.ok) {
      return {
        rule: INITIATIVE_CONDITION_RULES.CURRENT_GO_DECISION,
        error: 'A current GO decision is required',
      };
    }
    return null;
  }

  if (condition === 'HANDOFF_AND_START_DATE') {
    const handoff = (
      await client.query<{ ok: boolean }>(
        `SELECT TRUE AS ok FROM initiative_handoffs
         WHERE initiative_id = ? AND organization_id = ? AND readiness_allowed = TRUE
         ORDER BY created_at DESC LIMIT 1`,
        [initiativeId, orgId]
      )
    ).rows[0];
    if (!handoff?.ok || !(row.planned_start_date ?? row.start_date)) {
      return {
        rule: INITIATIVE_CONDITION_RULES.HANDOFF_AND_START_DATE,
        error: 'Accepted handoff and start date are required',
      };
    }
    return null;
  }

  if (condition === 'NO_OPEN_WORK') {
    const openTasks = Number(
      (
        await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM tasks
           WHERE initiative_id = ? AND organization_id = ?
             AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'COMPLETED', 'CANCELLED')`,
          [initiativeId, orgId]
        )
      ).rows[0]?.count ?? 0
    );
    if (openTasks > 0 || (await input.hasPendingExecutionGateDecisions(orgId, initiativeId))) {
      return {
        rule: INITIATIVE_CONDITION_RULES.NO_OPEN_WORK,
        error: 'Open tasks or blocking decisions prevent closure',
      };
    }
    return null;
  }

  return null;
}

/** Autorstwo — jedyny warunek, który kończy się 403, a nie 400. */
export function evaluateInitiativeAuthorOnly(
  row: Record<string, unknown>,
  actorId: string | null | undefined
): InitiativeConditionFailure | null {
  const createdBy = row.created_by ? String(row.created_by) : null;
  if (!createdBy || createdBy !== String(actorId ?? '')) {
    return {
      rule: INITIATIVE_AUTHOR_ONLY_RULE,
      error: 'Only the initiative author can execute this transition',
    };
  }
  return null;
}

/**
 * Klient „tylko do odczytu" dla podglądu — ten sam interfejs co transakcyjny,
 * więc funkcja warunków nie wie, z której ścieżki jest wołana.
 */
export function createReadOnlyConditionClient(): PgTransactionClient {
  return {
    query: async <T = unknown>(sql: string, params: unknown[] = []) => {
      const rows = (await queryHelpers.queryAll(sql, params)) as T[];
      return { rows, rowCount: rows.length };
    },
  };
}
