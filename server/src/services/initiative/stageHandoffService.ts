/**
 * Uspójnienie F2.1 — granice stage'ów inicjatywy (single handoff point).
 *
 * JEDEN punkt dla przejść między modułami kręgosłupa cyklu życia inicjatywy:
 *   analiza → inicjatywa → wykonanie → rezultaty → finanse.
 *
 * Zamiast rozproszonych, niespójnych sprawdzeń „czy można oddać inicjatywę do
 * następnego modułu", ten serwis daje:
 *   - `evaluateHandoff` — CZYSTA walidacja: VALID_TRANSITIONS + „kontrakt
 *     gotowości" na kluczowych granicach (ready-for-execution, closure),
 *   - `moduleForStatus` — który moduł operuje danym statusem,
 *   - `handoffBoundary` — klasyfikacja granicy (analiza/inicjatywa/wykonanie/…),
 *   - `recordHandoff` — best-effort zapis zdarzenia do audytu (fail-safe).
 *
 * Wszystkie funkcje poza `recordHandoff` są CZYSTE (bez DB, bez efektów).
 */

import auditEventsService from '../AuditEventsService.js';
import logger from '../../utils/Logger.js';
import {
  InitiativeStatus,
  type InitiativeStatusType,
  VALID_TRANSITIONS,
  getStatusesForModule,
  isValidTransition,
  type ModuleId,
} from '../../constants/initiativeStatuses.js';

// ============================================
// TYPES
// ============================================

/** Kontrakt gotowości — sygnały zbierane przez warstwę wyżej (artefakty inicjatywy). */
export interface HandoffPayload {
  /** czy inicjatywa ma przypisane daty (start/koniec) */
  hasDates?: boolean;
  /** czy ma co najmniej jeden kamień milowy */
  hasMilestone?: boolean;
  /** czy ma co najmniej jeden KPI/wskaźnik rezultatu */
  hasKpi?: boolean;
  /** czy ma przypisanego właściciela (owner) */
  hasOwner?: boolean;
  /** czy bramka domknięcia (closure gate) została zatwierdzona */
  gateApproved?: boolean;
}

export interface HandoffEvaluation {
  /** czy przejście jest dozwolone (transition + kontrakt gotowości) */
  allowed: boolean;
  /** ludzko-czytelne powody blokady (puste gdy allowed) */
  reasons: string[];
  /** brakujące elementy kontraktu gotowości (klucze payloadu) */
  missing: string[];
}

export type HandoffBoundary =
  | 'analysis_to_initiative'
  | 'initiative_to_execution'
  | 'execution_to_results'
  | 'results_to_finance'
  | 'within_module'
  | 'unknown';

// ============================================
// MODULE MAPPING (odwrotne: status → moduł)
// ============================================

/**
 * Granice kręgosłupa F2 odwzorowane na moduły z initiativeStatuses.
 * „rezultaty" i „finanse" nie mają osobnych ModuleId w macierzy statusów —
 * benefits/tracking pełni rolę warstwy rezultatów, a finanse są fazą po niej.
 */
const MODULE_PRIORITY: ModuleId[] = [
  'tools',
  'assessment',
  'initiatives',
  'execution',
  'benefits',
  'reporting',
];

/**
 * Który moduł operuje danym statusem.
 *
 * Statusy współdzielone między modułami (np. SCHEDULED w initiatives i execution)
 * rozstrzygamy na korzyść modułu „dalej" w lejku, tak by granica
 * initiative→execution wypadała na przejściu APPROVED→SCHEDULED.
 */
export function moduleForStatus(status: InitiativeStatusType | string): string {
  const s = String(status || '').toUpperCase() as InitiativeStatusType;

  // Statusy terminalne nie należą do żadnego modułu operacyjnego.
  if (s === InitiativeStatus.CANCELLED || s === InitiativeStatus.ARCHIVED) {
    return 'terminal';
  }

  // SCHEDULED jest współdzielony (initiatives + execution) — przypisz do execution,
  // bo zaplanowanie = wejście w fazę realizacji (ready-for-execution boundary).
  if (s === InitiativeStatus.SCHEDULED) {
    return 'execution';
  }

  for (const moduleId of MODULE_PRIORITY) {
    if (moduleId === 'reporting') continue; // reporting widzi wszystko — pomiń
    if (getStatusesForModule(moduleId).includes(s)) {
      return moduleId;
    }
  }

  return 'unknown';
}

// ============================================
// BOUNDARY CLASSIFICATION
// ============================================

/**
 * Klasyfikacja granicy na podstawie modułów from/to.
 * Mapuje moduły z macierzy statusów na kanoniczne granice F2.
 */
export function handoffBoundary(
  fromStatus: InitiativeStatusType | string,
  toStatus: InitiativeStatusType | string
): HandoffBoundary {
  const fromModule = moduleForStatus(fromStatus);
  const toModule = moduleForStatus(toStatus);

  if (fromModule === 'unknown' || toModule === 'unknown') return 'unknown';

  if (fromModule === toModule) return 'within_module';

  // analiza (tools/assessment) → inicjatywa
  if (
    (fromModule === 'tools' || fromModule === 'assessment') &&
    toModule === 'initiatives'
  ) {
    return 'analysis_to_initiative';
  }

  // inicjatywa → wykonanie
  if (fromModule === 'initiatives' && toModule === 'execution') {
    return 'initiative_to_execution';
  }

  // wykonanie → rezultaty (benefits/tracking)
  if (fromModule === 'execution' && toModule === 'benefits') {
    return 'execution_to_results';
  }

  // rezultaty → finanse (benefits → ARCHIVED/finalizacja korzyści)
  if (fromModule === 'benefits' && toModule === 'terminal') {
    return 'results_to_finance';
  }

  return 'unknown';
}

// ============================================
// HANDOFF EVALUATION (pure)
// ============================================

/**
 * Czy przejście jest dozwolone: VALID_TRANSITIONS + kontrakt gotowości granicy.
 *
 * Kontrakt gotowości:
 *   - →SCHEDULED / →EXECUTING (ready-for-execution): hasDates + hasMilestone +
 *     hasKpi + hasOwner,
 *   - →TRACKING (wykonanie→rezultaty, closure): gateApproved,
 *   - inne przejścia: tylko walidacja VALID_TRANSITIONS.
 */
export function evaluateHandoff(
  fromStatus: InitiativeStatusType | string,
  toStatus: InitiativeStatusType | string,
  payload: HandoffPayload = {}
): HandoffEvaluation {
  const from = String(fromStatus || '').toUpperCase() as InitiativeStatusType;
  const to = String(toStatus || '').toUpperCase() as InitiativeStatusType;

  const reasons: string[] = [];
  const missing: string[] = [];

  // 1) Walidacja macierzy przejść.
  if (!(from in VALID_TRANSITIONS)) {
    reasons.push(`Unknown source status: ${from}`);
    return { allowed: false, reasons, missing };
  }
  if (!isValidTransition(from, to)) {
    reasons.push(`Transition ${from} → ${to} is not in VALID_TRANSITIONS`);
    return { allowed: false, reasons, missing };
  }

  // 2) Kontrakt gotowości na kluczowych granicach.
  if (to === InitiativeStatus.SCHEDULED || to === InitiativeStatus.EXECUTING) {
    // ready-for-execution
    if (!payload.hasDates) missing.push('hasDates');
    if (!payload.hasMilestone) missing.push('hasMilestone');
    if (!payload.hasKpi) missing.push('hasKpi');
    if (!payload.hasOwner) missing.push('hasOwner');
    if (missing.length > 0) {
      reasons.push(
        `Ready-for-execution contract not met (missing: ${missing.join(', ')})`
      );
    }
  } else if (to === InitiativeStatus.TRACKING) {
    // closure (wykonanie → rezultaty)
    if (!payload.gateApproved) {
      missing.push('gateApproved');
      reasons.push('Closure gate not approved (gateApproved required)');
    }
  }

  return { allowed: reasons.length === 0, reasons, missing };
}

// ============================================
// RECORD HANDOFF (best-effort DB)
// ============================================

/**
 * Best-effort zapis zdarzenia handoffu do unified audit log. Fail-safe:
 * NIGDY nie rzuca — błąd jest logowany i połykany (handoff nie może paść przez
 * audyt).
 */
export async function recordHandoff(
  orgId: string,
  initiativeId: string,
  fromStatus: InitiativeStatusType | string,
  toStatus: InitiativeStatusType | string,
  actorId?: string
): Promise<void> {
  const from = String(fromStatus || '').toUpperCase();
  const to = String(toStatus || '').toUpperCase();
  const boundary = handoffBoundary(from, to);

  try {
    await auditEventsService.log({
      actorId: actorId || undefined,
      actorType: actorId ? 'USER' : 'SYSTEM',
      action: 'initiative.handoff',
      resourceType: 'initiative',
      resourceId: initiativeId,
      organizationId: orgId,
      metadata: {
        fromStatus: from,
        toStatus: to,
        boundary,
        fromModule: moduleForStatus(from),
        toModule: moduleForStatus(to),
      },
    });
    logger.info(
      `[stageHandoff] ${initiativeId} ${from}→${to} (${boundary}) org=${orgId}`
    );
  } catch (err: unknown) {
    logger.warn(
      `[stageHandoff] audit record failed (non-fatal) for ${initiativeId} ${from}→${to}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export default {
  evaluateHandoff,
  moduleForStatus,
  handoffBoundary,
  recordHandoff,
};
