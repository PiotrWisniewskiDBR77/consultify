import type { PortfolioInitiative } from '@/types';
import { mapInitiativeStatus } from '@/contracts/initiatives-execution/statusMapping';

import { nextStepForLifecycle } from './initiativeRegisterProjection';

export type InitiativeRegisterRow = PortfolioInitiative & {
  gateReadiness?: string;
  nextAction?: string;
  plannedWindow?: string | null;
  lifecycleState?: string | null;
};

export type PmoQueueId = 'review' | 'discuss' | 'approve' | 'blocked' | 'overdue';

export const PMO_QUEUE_PRIORITY: readonly PmoQueueId[] = [
  'overdue',
  'blocked',
  'approve',
  'discuss',
  'review',
];

export const PMO_QUEUE_LABELS: Record<PmoQueueId, { en: string; pl: string }> = {
  review: { en: 'To review', pl: 'Do przeglądu' },
  discuss: { en: 'To discuss', pl: 'Do omówienia' },
  approve: { en: 'To approve', pl: 'Do akceptacji' },
  blocked: { en: 'Blocked', pl: 'Zablokowane' },
  overdue: { en: 'Overdue', pl: 'Przeterminowane' },
};

const STAGES: Record<string, { number: number; en: string; pl: string }> = {
  REGISTERED_DRAFT: { number: 1, en: 'Registered draft', pl: 'Szkic zarejestrowany' },
  DEFINED: { number: 2, en: 'Defined', pl: 'Zdefiniowana' },
  ANALYZING: { number: 3, en: 'Analyzing', pl: 'W analizie' },
  READY_FOR_DECISION: { number: 4, en: 'Ready for decision', pl: 'Gotowa do decyzji' },
  APPROVED_BACKLOG: { number: 5, en: 'Approved backlog', pl: 'Zatwierdzony backlog' },
  SCHEDULED: { number: 6, en: 'Scheduled', pl: 'Zaplanowana' },
  IN_EXECUTION: { number: 7, en: 'In execution', pl: 'W realizacji' },
  DELIVERED: { number: 8, en: 'Delivered', pl: 'Dostarczona' },
  BENEFITS_TRACKING: { number: 9, en: 'Benefits tracking', pl: 'Śledzenie korzyści' },
  EFFECTIVENESS_REVIEWED: { number: 10, en: 'Effect reviewed', pl: 'Efekt oceniony' },
  CLOSED: { number: 11, en: 'Closed', pl: 'Zamknięta' },
  ARCHIVED: { number: 12, en: 'Archived', pl: 'Zarchiwizowana' },
};

const APPROVAL_STAGES = new Set([
  'READY_FOR_DECISION',
  'APPROVED_BACKLOG',
  'DELIVERED',
  'EFFECTIVENESS_REVIEWED',
  'CLOSED',
]);

function normalizedLifecycle(row: InitiativeRegisterRow): string {
  const raw = String(
    row.lifecycleState || row.p11LifecycleState || row.displayStatus || row.status || ''
  ).toUpperCase();
  return mapInitiativeStatus({ direction: 'legacy-to-runtime', status: raw }) || raw;
}

export function pmoDueDate(row: InitiativeRegisterRow): string | null {
  const direct = String(row.plannedEndDate || '').trim();
  if (direct) return direct;
  const plannedWindow = String(row.plannedWindow || '').trim();
  if (!plannedWindow) return null;
  const [, end] = plannedWindow.split('/').map((part) => part.trim());
  return end || plannedWindow || null;
}

export function pmoQueueForInitiative(
  row: InitiativeRegisterRow,
  now: Date = new Date()
): PmoQueueId {
  const due = pmoDueDate(row);
  const dueTs = due ? new Date(due).getTime() : Number.NaN;
  if (Number.isFinite(dueTs) && dueTs < now.getTime()) return 'overdue';

  const readiness = String(row.gateReadiness || '').toUpperCase();
  if (row.onHold || readiness === 'BLOCKED' || readiness === 'NOT_READY') return 'blocked';

  const lifecycle = normalizedLifecycle(row);
  if (APPROVAL_STAGES.has(lifecycle)) return 'approve';

  // Existing data has no dedicated "returned decision" column. PARTIAL and
  // PENDING_REVIEW are the honest available signals that a conversation is
  // required before a binary decision can be taken.
  if (readiness === 'PARTIAL' || String(row.status).toUpperCase() === 'PENDING_REVIEW') {
    return 'discuss';
  }
  return 'review';
}

export function pmoQueueCounts(rows: InitiativeRegisterRow[], now: Date = new Date()) {
  const counts: Record<PmoQueueId, number> = {
    review: 0,
    discuss: 0,
    approve: 0,
    blocked: 0,
    overdue: 0,
  };
  rows.forEach((row) => {
    counts[pmoQueueForInitiative(row, now)] += 1;
  });
  return counts;
}

export function pmoStageLabel(row: InitiativeRegisterRow, isPolish: boolean): string {
  const lifecycle = normalizedLifecycle(row);
  const stage = STAGES[lifecycle];
  return stage ? `${stage.number} · ${isPolish ? stage.pl : stage.en}` : '—';
}

export function pmoResponsible(row: InitiativeRegisterRow, isPolish: boolean): string {
  const person = row.ownerBusiness || row.ownerExecution;
  if (!person) return isPolish ? 'Nieprzypisana · Owner' : 'Unassigned · Owner';
  return `${person.firstName} ${person.lastName} · Owner`;
}

export function pmoNextStep(row: InitiativeRegisterRow): string {
  return String(row.nextAction || nextStepForLifecycle(normalizedLifecycle(row)).action || '—');
}

export function withPmoProjection<T extends PortfolioInitiative>(
  row: T
): T & {
  pmoQueue: PmoQueueId;
} {
  return { ...row, pmoQueue: pmoQueueForInitiative(row as InitiativeRegisterRow) };
}
