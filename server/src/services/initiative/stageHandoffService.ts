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

import { v4 as uuidv4 } from 'uuid';

import {
  getStatusesForModule,
  InitiativeStatus,
  type InitiativeStatusType,
  isValidTransition,
  type ModuleId,
  VALID_TRANSITIONS,
} from '../../constants/initiativeStatuses.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import auditEventsService from '../AuditEventsService.js';

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
  if (s === InitiativeStatus.REJECTED || s === InitiativeStatus.CLOSED) {
    return 'terminal';
  }

  // SCHEDULED jest współdzielony (initiatives + execution) — przypisz do execution,
  // bo zaplanowanie = wejście w fazę realizacji (ready-for-execution boundary).
  if (s === InitiativeStatus.APPROVED) {
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
  if ((fromModule === 'tools' || fromModule === 'assessment') && toModule === 'initiatives') {
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
  if (to === InitiativeStatus.IN_EXECUTION) {
    // ready-for-execution
    if (!payload.hasDates) missing.push('hasDates');
    if (!payload.hasMilestone) missing.push('hasMilestone');
    if (!payload.hasKpi) missing.push('hasKpi');
    if (!payload.hasOwner) missing.push('hasOwner');
    if (missing.length > 0) {
      reasons.push(`Ready-for-execution contract not met (missing: ${missing.join(', ')})`);
    }
  } else if (to === InitiativeStatus.CLOSED) {
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
 * USPOJNIENIE B1 — wyliczenie sygnałów kontraktu gotowości z rzeczywistego
 * rekordu inicjatywy. Czyni `evaluateHandoff` ŻYWYM kodem (był martwy: 0 wywołań).
 * Fail-safe: schema-drift / brak tabel → sygnał = false (advisory, nie blokuje).
 */
async function deriveReadiness(orgId: string, initiativeId: string): Promise<HandoffPayload> {
  const payload: HandoffPayload = {};
  try {
    const row = await queryHelpers.queryOne<Record<string, unknown>>(
      `SELECT planned_start_date, planned_end_date, start_date, end_date,
              owner_execution_id, owner_business_id, sponsor_id
         FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    if (row) {
      payload.hasDates = Boolean(
        (row.planned_start_date && row.planned_end_date) || (row.start_date && row.end_date)
      );
      payload.hasOwner = Boolean(row.owner_execution_id || row.owner_business_id || row.sponsor_id);
    }
  } catch {
    /* schema drift — leave hasDates/hasOwner undefined */
  }
  // hasKpi / hasMilestone — best-effort counts, każdy osobno guarded.
  try {
    const k = await queryHelpers.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM initiative_kpis WHERE initiative_id = ?`,
      [initiativeId]
    );
    payload.hasKpi = Boolean(k && Number(k.n) > 0);
  } catch {
    /* table absent */
  }
  try {
    const m = await queryHelpers.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tasks
        WHERE initiative_id = ? AND LOWER(COALESCE(task_type,'')) = 'milestone'`,
      [initiativeId]
    );
    payload.hasMilestone = Boolean(m && Number(m.n) > 0);
  } catch {
    /* table absent */
  }
  return payload;
}

/**
 * Best-effort zapis zdarzenia handoffu. Fail-safe: NIGDY nie rzuca — błąd jest
 * logowany i połykany (handoff nie może paść przez audyt). Zapisuje DWA ślady:
 *   1. ustrukturyzowany wiersz `initiative_handoffs` (B2) z wynikiem kontraktu
 *      gotowości (evaluateHandoff — B1), advisory,
 *   2. wpis w unified audit-logu (provenance).
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

  // B1 — oceń kontrakt gotowości na podstawie realnego stanu inicjatywy.
  // ADVISORY: zapisujemy wynik, ale NIE blokujemy przejścia (bramki M13/decyzje
  // pozostają autorytatywne). To czyni evaluateHandoff żywym + obserwowalnym.
  //
  // PERF: deriveReadiness (3 zapytania) wykonujemy WYŁĄCZNIE gdy kontrakt gotowości
  // jest faktycznie sprawdzany przez evaluateHandoff — czyli dla granic
  // →SCHEDULED/EXECUTING (ready-for-execution) i →TRACKING (closure). Dla
  // pozostałych przejść (np. DRAFT→PENDING_REVIEW) payload jest nieużywany, więc
  // nie obciążamy puli DB zbędnymi zapytaniami pod obciążeniem.
  let evaluation: HandoffEvaluation | null = null;
  try {
    const needsReadiness =
      to === InitiativeStatus.IN_EXECUTION ||
      to === InitiativeStatus.CLOSED;
    const payload = needsReadiness ? await deriveReadiness(orgId, initiativeId) : {};
    evaluation = evaluateHandoff(from, to, payload);
  } catch {
    /* readiness best-effort */
  }

  // B2 — ustrukturyzowany wiersz handoffu (dedykowana tabela, nie tylko audit-log).
  try {
    await queryHelpers.queryRun(
      `INSERT INTO initiative_handoffs (
         id, organization_id, initiative_id, from_status, to_status,
         boundary, from_module, to_module,
         readiness_allowed, readiness_missing, readiness_reasons, actor_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        orgId,
        initiativeId,
        from,
        to,
        boundary,
        moduleForStatus(from),
        moduleForStatus(to),
        evaluation ? evaluation.allowed : null,
        evaluation ? JSON.stringify(evaluation.missing) : null,
        evaluation ? JSON.stringify(evaluation.reasons) : null,
        actorId || null,
      ]
    );
  } catch (err: unknown) {
    logger.warn(
      `[stageHandoff] handoff-row insert failed (non-fatal) for ${initiativeId} ${from}→${to}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Provenance — unified audit log (jak dotąd).
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
        readinessAllowed: evaluation ? evaluation.allowed : undefined,
        readinessMissing: evaluation ? evaluation.missing : undefined,
      },
    });
    logger.info(
      `[stageHandoff] ${initiativeId} ${from}→${to} (${boundary}) org=${orgId}` +
        (evaluation ? ` ready=${evaluation.allowed}` : '')
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
