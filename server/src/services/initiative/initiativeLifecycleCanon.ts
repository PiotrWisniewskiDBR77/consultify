/**
 * P11 Final V8 — Initiative lifecycle canon bridge.
 * Maps persisted PMO status values to contract §2.3.1 canonical lifecycle buckets
 * and builds bounded handoff envelopes for P03 / P04 / P02 consumers.
 *
 * DB SSOT remains `initiatives.status` (InitiativeStatus enum); this module is the
 * read/coherence + outbound handoff adapter — no parallel grammar in other modules.
 */

import {
  InitiativeStatus,
  VALID_TRANSITIONS,
  GATE_TRANSITIONS,
  isValidTransition,
  validateTransition,
  type InitiativeStatusType,
} from '../../constants/initiativeStatuses.js';

/** Frozen set from FINAL_IMPLEMENTATION_PLAN_11 §2.3.1 (order preserved). */
export const P11_CANONICAL_LIFECYCLE_STATES = [
  'intake',
  'triage',
  'planned',
  'approved',
  'executing',
  'blocked',
  'delivered',
  'closed',
  'archived',
] as const;

export type P11LifecycleCanonState = (typeof P11_CANONICAL_LIFECYCLE_STATES)[number];

const KNOWN_DB_STATUSES = new Set<string>(Object.values(InitiativeStatus));

/**
 * Normalize legacy / drifted status strings for read surfaces (portfolio, detail header).
 * Aligns with previous `normalizePortfolioStatus` behavior in planningPortfolioReadService.
 */
export function normalizeInitiativeDbStatusForRead(status: string | unknown): string {
  const s = String(status || 'DRAFT').toUpperCase();
  if (s.includes('STEP3') || s.includes('STEP_3')) return 'REVIEW';
  if (s.includes('STEP4') || s.includes('STEP_4') || s.includes('PILOT')) return 'APPROVED';
  if (s.includes('STEP5') || s.includes('STEP_5') || s.includes('FULL')) return 'EXECUTING';
  if (s === 'COMPLETED' || s === 'DONE') return 'DONE';
  if (KNOWN_DB_STATUSES.has(s)) return s;
  return 'DRAFT';
}

/**
 * True when raw DB value is not a known InitiativeStatus (after trim/uppercase).
 */
export function hasInitiativeStatusSchemaDrift(rawStatus: string | unknown): boolean {
  const s = String(rawStatus ?? '')
    .trim()
    .toUpperCase();
  if (!s) return false;
  const normalized = normalizeInitiativeDbStatusForRead(rawStatus);
  if (normalized === 'DRAFT' && s !== 'DRAFT' && !KNOWN_DB_STATUSES.has(s)) return true;
  return false;
}

/**
 * Contract §2.3.1 mapping: one canon bucket per DB lifecycle value.
 */
export function mapDbStatusToP11Lifecycle(dbStatus: string | unknown): P11LifecycleCanonState {
  const s = normalizeInitiativeDbStatusForRead(dbStatus);
  switch (s) {
    case 'DRAFT':
      return 'intake';
    case 'PENDING_REVIEW':
      return 'triage';
    case 'REVIEW':
    case 'PROMOTED':
      return 'triage';
    case 'PLANNING':
      return 'planned';
    case 'APPROVED':
    case 'SCHEDULED':
      return 'approved';
    case 'EXECUTING':
      return 'executing';
    case 'BLOCKED':
      return 'blocked';
    case 'DONE':
      return 'delivered';
    case 'TRACKING':
    case 'CANCELLED':
      return 'closed';
    case 'ARCHIVED':
      return 'archived';
    default:
      return 'intake';
  }
}

export type InitiativeHandoffKind = 'execution' | 'kpi' | 'calendar';

export interface InitiativeHandoffContextLink {
  kind: 'decision' | 'milestone' | 'risk' | 'task' | 'note' | 'other';
  ref: string;
  label?: string;
}

export interface InitiativeOutboundHandoffPayload {
  initiativeId: string;
  initiativeTitle: string;
  initiativeLifecycleState: P11LifecycleCanonState;
  initiativeDbStatus: string;
  initiativeOwnerId: string | null;
  initiativeTimebox: { start: string | null; end: string | null };
  contextPack: InitiativeHandoffContextLink[];
  handoffAt: string;
  handoffBy: string | null;
  executionIntent?: string;
  initialWorkstreamIds?: string[];
  kpiIntent?: string;
  measurementWindow?: string | null;
  calendarIntent?: string;
  milestoneRefs?: string[];
}

const sliceContextPack = (links: InitiativeHandoffContextLink[]): InitiativeHandoffContextLink[] =>
  links.filter((l) => l.ref).slice(0, 5);

/**
 * Bounded outbound handoff envelope (§2.3.5). Does not mutate initiative or consumer truth.
 */
export function buildInitiativeOutboundHandoffPayload(input: {
  initiativeRow: Record<string, unknown>;
  organizationId: string;
  handoffBy: string | null;
  kind: InitiativeHandoffKind;
  contextPackExtras?: InitiativeHandoffContextLink[];
}): InitiativeOutboundHandoffPayload {
  const row = input.initiativeRow;
  const id = String(row.id || '');
  const title =
    String(row.title || row.name || row.summary || 'Initiative').trim() || 'Initiative';
  const rawStatus = row.status;
  const dbStatus = normalizeInitiativeDbStatusForRead(rawStatus);
  const lifecycle = mapDbStatusToP11Lifecycle(rawStatus);
  const ownerId =
    (row.owner_execution_id as string) || (row.owner_business_id as string) || null;
  const start =
    (row.planned_start_date as string) ||
    (row.start_date as string) ||
    (row.actual_start_date as string) ||
    null;
  const end =
    (row.planned_end_date as string) ||
    (row.end_date as string) ||
    (row.actual_end_date as string) ||
    null;

  const basePack: InitiativeHandoffContextLink[] = [];
  if (row.program_id) {
    basePack.push({
      kind: 'other',
      ref: `program:${String(row.program_id)}`,
      label: 'program',
    });
  }
  if (row.project_id) {
    basePack.push({ kind: 'other', ref: `project:${String(row.project_id)}`, label: 'project' });
  }
  if (row.schedule_baseline_id) {
    basePack.push({
      kind: 'milestone',
      ref: `schedule_baseline:${String(row.schedule_baseline_id)}`,
      label: 'baseline',
    });
  }
  const merged = sliceContextPack([
    ...basePack,
    ...(Array.isArray(input.contextPackExtras) ? input.contextPackExtras : []),
  ]);

  const now = new Date().toISOString();
  const common = {
    initiativeId: id,
    initiativeTitle: title,
    initiativeLifecycleState: lifecycle,
    initiativeDbStatus: dbStatus,
    initiativeOwnerId: ownerId,
    initiativeTimebox: { start, end },
    contextPack: merged,
    handoffAt: now,
    handoffBy: input.handoffBy,
  };

  if (input.kind === 'execution') {
    return {
      ...common,
      executionIntent: 'Continue delivery control tower work linked to this initiative',
      initialWorkstreamIds: [],
    };
  }
  if (input.kind === 'kpi') {
    return {
      ...common,
      kpiIntent: 'Track outcomes and measurement for this initiative',
      measurementWindow: null,
    };
  }
  return {
    ...common,
    calendarIntent: 'Mirror milestones and key dates for this initiative',
    milestoneRefs: [],
  };
}

/**
 * §2.3.2 Transition matrix re-export — single canon surface.
 * Implementation lives in `constants/initiativeStatuses.ts`; this re-export ensures
 * downstream consumers can import everything lifecycle-related from one module.
 */
export {
  VALID_TRANSITIONS as P11_VALID_TRANSITIONS,
  GATE_TRANSITIONS as P11_GATE_TRANSITIONS,
  isValidTransition as p11IsValidTransition,
  validateTransition as p11ValidateTransition,
  type InitiativeStatusType,
};

/** Guard: refuse to propose persisting unknown enum-like status (write path helper). */
export function coerceInitiativeStatusForWrite(
  candidate: string | unknown
): { ok: true; status: string } | { ok: false; code: 'UNKNOWN_STATUS'; message: string } {
  const raw = String(candidate ?? '')
    .trim()
    .toUpperCase();
  if (!raw) {
    return { ok: false, code: 'UNKNOWN_STATUS', message: 'Status is required' };
  }
  if (!KNOWN_DB_STATUSES.has(raw)) {
    return {
      ok: false,
      code: 'UNKNOWN_STATUS',
      message: `Refusing unknown initiative status "${raw}" (schema drift guard)`,
    };
  }
  return { ok: true, status: raw };
}
