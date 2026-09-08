/**
 * Podgląd przejść inicjatywy (DEC-424) — co użytkownik MOŻE zrobić i dlaczego nie może.
 *
 * Wymaganie właściciela: „warunek blokujący jest widoczny ZANIM użytkownik kliknie".
 * Ten serwis liczy dla KAŻDEGO przejścia z macierzy trzy niezależne rzeczy:
 *   • `roleAllowed`        — czy rola aktora przechodzi bramkę (ta sama `canExecuteGate`),
 *   • `conditionSatisfied` — czy warunek merytoryczny jest spełniony (ten sam moduł
 *                            `initiativeTransitionConditions`, którego używa pisarz),
 *   • `requiresReason`     — czy przejście zażąda powodu (okno tekstowe w UI).
 * Brak roli => UI nie pokazuje przycisku. Warunek niespełniony => przycisk nieaktywny
 * z powodem. Nigdy odwrotnie: 403/400 po kliknięciu jest awarią projektu, nie UX-em.
 */

import {
  INITIATIVE_FLAG_RULES,
  INITIATIVE_TRANSITION_MATRIX,
  VALID_TRANSITIONS,
  getTransitionDefinition,
  type InitiativeFlagOperation,
} from '../../constants/initiativeStatuses.js';
import type { PgTransactionClient } from '../../utils/queryHelpers.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  canExecuteGate,
  resolveGateRequiredRoles,
  resolveInitiativeCapabilityContext,
} from './initiativeCapabilityMatrix.js';
import {
  createReadOnlyConditionClient,
  evaluateInitiativeAuthorOnly,
  evaluateInitiativeTransitionCondition,
} from './initiativeTransitionConditions.js';
import { getBlockingReadinessItems } from './initiativeGateReadinessService.js';
import {
  hasApprovedGateDecision,
  hasPendingExecutionGateDecisions,
  normalizeStatus,
} from './initiativeTransitionService.js';
import { normalizeInitiativeDbStatusForRead } from './initiativeLifecycleCanon.js';

export interface InitiativeTransitionPreflightItem {
  targetStatus: string;
  gate: string | null;
  requiredRoles: string[];
  roleAllowed: boolean;
  conditionSatisfied: boolean;
  /** Kod reguły blokującej (kontrakt i18n dla UI) albo `null`. */
  blockingRule: string | null;
  /**
   * Dla `GATE_BLOCKED`: brakujące wymagania gotowości (klucz + etykieta z
   * `getBlockingReadinessItems`). UI mapuje klucz na polski opis.
   */
  blockingItems: Array<{ key: string; label: string }>;
  requiresReason: boolean;
  /** Wypadkowa: przycisk wolno kliknąć. */
  allowed: boolean;
}

export interface InitiativeFlagPreflightItem {
  operation: InitiativeFlagOperation;
  gate: string;
  requiredRoles: string[];
  roleAllowed: boolean;
  requiresReason: boolean;
  /** Czy stan inicjatywy w ogóle dopuszcza tę operację (np. RESUME tylko gdy wstrzymana). */
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

export async function getInitiativeTransitionPreflight(input: {
  orgId: string;
  initiativeId: string;
  actorId: string;
  actorRole?: string | null;
}): Promise<InitiativeTransitionPreflight | null> {
  const { orgId, initiativeId, actorId } = input;

  const row = (await queryHelpers.queryOne(
    `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  )) as Record<string, unknown> | null;
  if (!row) return null;

  const currentStatus = normalizeInitiativeDbStatusForRead(String(row.status || ''));
  const accessCtx = await resolveInitiativeCapabilityContext(
    orgId,
    initiativeId,
    actorId,
    input.actorRole ?? null
  );
  const steeringBoardEnabled = !!accessCtx?.steeringBoardEnabled;
  const effectiveRoles: string[] = accessCtx?.effectiveRoles || [];
  const client: PgTransactionClient = createReadOnlyConditionClient();
  // DEC-453: pass effectiveRoles so ADMIN/OWNER (or a no-author draft) reads as
  // "author satisfied" here EXACTLY like the writer (initiativeTransitionService)
  // does — both call the same `evaluateInitiativeAuthorOnly`, so the preflight
  // button and the 403 it would otherwise get can never disagree.
  const isAuthor = evaluateInitiativeAuthorOnly(row, actorId, effectiveRoles) === null;

  const validNext: string[] =
    (VALID_TRANSITIONS as Record<string, string[]>)[normalizeStatus(currentStatus)] || [];

  // Pisarz (`executeInitiativeTransition`) po warunku z macierzy sprawdza jeszcze
  // gotowość bramki (`getBlockingReadinessItems` -> `GATE_BLOCKED`) dla KAŻDEGO
  // przejścia. Bez tego podgląd pokazywałby aktywny przycisk, a pisarz odmawiał
  // po kliknięciu — dokładnie to, czego właściciel zabronił. Liczone raz: wynik
  // zależy od wiersza inicjatywy, nie od celu przejścia.
  const readinessItems = validNext.length > 0
    ? await getBlockingReadinessItems(orgId, initiativeId)
    : [];
  const readinessBlocking = readinessItems.map((item) => ({ key: item.key, label: item.label }));

  const transitions: InitiativeTransitionPreflightItem[] = [];
  for (const targetStatus of validNext) {
    const definition = getTransitionDefinition(currentStatus as never, targetStatus as never);
    const gate = definition?.gate ?? null;
    const requiredRoles = resolveGateRequiredRoles(gate, steeringBoardEnabled);
    const roleByGate = canExecuteGate({ gate, effectiveRoles, steeringBoardEnabled });
    // `authorOnly` jest częścią prawa do wykonania, nie warunkiem merytorycznym —
    // nie-autor NIE ma widzieć przycisku „Prześlij do zatwierdzenia" cudzego szkicu.
    const roleAllowed = roleByGate && (!definition?.authorOnly || isAuthor);
    const requiresReason = definition?.condition === 'REASON_REQUIRED';

    let blockingRule: string | null = null;
    if (definition) {
      const failure = await evaluateInitiativeTransitionCondition(client, {
        orgId,
        initiativeId,
        row,
        condition: definition.condition,
        reason: '',
        skipReasonRequired: true,
        hasApprovedGateDecision,
        hasPendingExecutionGateDecisions,
      });
      blockingRule = failure?.rule ?? null;
    }
    // Ta sama kolejność co u pisarza: najpierw warunek z macierzy, potem gotowość.
    const blockingItems = blockingRule === null && readinessBlocking.length > 0 ? readinessBlocking : [];
    if (blockingItems.length > 0) blockingRule = 'GATE_BLOCKED';

    transitions.push({
      targetStatus,
      gate,
      requiredRoles,
      roleAllowed,
      conditionSatisfied: blockingRule === null,
      blockingRule,
      blockingItems,
      requiresReason,
      allowed: roleAllowed && blockingRule === null,
    });
  }

  const onHold = Boolean(row.on_hold);
  const archived = Boolean(row.archived);
  const flags: InitiativeFlagPreflightItem[] = (
    Object.keys(INITIATIVE_FLAG_RULES) as InitiativeFlagOperation[]
  ).map((operation) => {
    const rule = INITIATIVE_FLAG_RULES[operation];
    const requiredRoles = resolveGateRequiredRoles(rule.gate, steeringBoardEnabled);
    const roleAllowed = canExecuteGate({
      gate: rule.gate,
      effectiveRoles,
      steeringBoardEnabled,
    });
    // Strażnik stanu z `executeInitiativeTransition`, ZAWĘŻONY o jeden warunek:
    // pisarz przyjmuje HOLD także dla już wstrzymanej inicjatywy, a interfejs nie ma
    // powodu pokazywać „Wstrzymaj" obok „Wznów". Zawężenie nigdy nie odblokowuje
    // niczego, czego pisarz by odmówił — działa wyłącznie w stronę bezpieczną.
    const stateAllowed =
      operation === 'ARCHIVE'
        ? currentStatus === 'CLOSED' || currentStatus === 'REJECTED'
        : currentStatus === 'IN_EXECUTION' && (operation === 'RESUME' ? onHold : !onHold);
    return {
      operation,
      gate: rule.gate,
      requiredRoles,
      roleAllowed,
      requiresReason: rule.reasonRequired,
      stateAllowed,
      allowed: roleAllowed && stateAllowed,
    };
  });

  return {
    initiativeId,
    currentStatus,
    onHold,
    archived,
    isAuthor,
    effectiveRoles,
    transitions,
    flags,
  };
}

/** Eksport dla testów kontraktu: macierz, z której liczony jest podgląd. */
export const PREFLIGHT_SOURCE_MATRIX = INITIATIVE_TRANSITION_MATRIX;
