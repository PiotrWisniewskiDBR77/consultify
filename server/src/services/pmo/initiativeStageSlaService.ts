import { randomUUID } from 'node:crypto';

import {
  INITIATIVE_STAGE_FLOW,
  type InitiativeLifecycleStage,
  resolveInitiativeLifecycleStage,
} from '../../constants/initiativeLifecycleStages.js';
import logger from '../../utils/Logger.js';
import { queryAll, queryRun } from '../../utils/queryHelpers.js';

export const PMO_ROLES = [
  'OWNER',
  'SPONSOR',
  'STEERING_COMMITTEE',
  'PMO',
  'PROJECT_MANAGER',
  'MEMBER',
  'VIEWER',
] as const;

export type PmoRole = (typeof PMO_ROLES)[number];
export type PmoRoleSource = 'derived' | 'overridden';

const PMO_ROLE_SET = new Set<string>(PMO_ROLES);

export function isPmoRole(value: unknown): value is PmoRole {
  return PMO_ROLE_SET.has(String(value || '').trim().toUpperCase());
}

export function normalizePmoRole(value: unknown): PmoRole | null {
  const normalized = String(value || '').trim().toUpperCase();
  return isPmoRole(normalized) ? (normalized as PmoRole) : null;
}

export function derivePmoRoleFromLegacyStakeholderRole(role: string | null | undefined): PmoRole | null {
  const normalized = String(role ?? '').trim().toUpperCase();
  if (!normalized) return 'VIEWER';
  if (normalized === 'SPONSOR') return 'SPONSOR';
  if (normalized === 'OWNER') return 'OWNER';
  if (normalized === 'CONTRIBUTOR') return 'MEMBER';
  if (normalized === 'REVIEWER') return 'PMO';
  if (normalized === 'INFORMED') return 'VIEWER';
  return null;
}

export function resolvePlanDrivenNextStage(
  stage: string | null | undefined
): InitiativeLifecycleStage | null {
  const lifecycleStage = resolveInitiativeLifecycleStage(stage);
  if (!lifecycleStage) return null;
  return (INITIATIVE_STAGE_FLOW[lifecycleStage][0] ?? null) as InitiativeLifecycleStage | null;
}

export interface InitiativeStageSlaCandidate {
  dueDateId: string;
  organizationId: string;
  initiativeId: string;
  initiativeTitle: string | null;
  lifecycleStage: InitiativeLifecycleStage;
  nextLifecycleStage: InitiativeLifecycleStage;
  dueAt: string;
  escalationLevel: number;
  targetPmoRole: PmoRole | null;
  targetUserId: string | null;
  route: 'steering_committee' | 'sponsor' | 'pmo' | 'unassigned';
  reason: string;
}

export interface InitiativeStageSlaTickResult {
  dryRun: boolean;
  candidates: InitiativeStageSlaCandidate[];
  escalated: number;
  skippedAlreadyToday: number;
  skippedInvalidStage: number;
  errors: number;
}

interface DueDateRow {
  due_date_id: string;
  organization_id: string;
  initiative_id: string;
  initiative_title: string | null;
  lifecycle_stage: string | null;
  next_lifecycle_stage: string | null;
  due_at: string | Date;
  current_level: string | number | null;
  escalated_today: string | number | null;
}

interface StakeholderRouteRow {
  user_id: string | null;
  pmo_role: string | null;
}

function isMissingPmo1bSchemaError(err: unknown): boolean {
  const message = String((err as any)?.message || err || '').toLowerCase();
  return (
    message.includes('initiative_stage_due_dates') ||
    message.includes('initiative_stage_escalation_events') ||
    message.includes('pmo_role') ||
    message.includes('no such table') ||
    message.includes('does not exist')
  );
}

function buildReason(candidate: {
  lifecycleStage: string;
  nextLifecycleStage: string;
  dueAt: string;
}): string {
  return `PMO stage SLA is overdue: ${candidate.lifecycleStage} → ${candidate.nextLifecycleStage}, due at ${candidate.dueAt}.`;
}

async function resolveEscalationTarget(params: {
  initiativeId: string;
}): Promise<Pick<InitiativeStageSlaCandidate, 'targetPmoRole' | 'targetUserId' | 'route'>> {
  const rows = await queryAll<StakeholderRouteRow>(
    `SELECT user_id, pmo_role
       FROM initiative_stakeholders
      WHERE initiative_id = ?
        AND pmo_role IN ('STEERING_COMMITTEE', 'SPONSOR', 'PMO')
      ORDER BY CASE pmo_role
        WHEN 'STEERING_COMMITTEE' THEN 1
        WHEN 'SPONSOR' THEN 2
        WHEN 'PMO' THEN 3
        ELSE 4
      END, created_at ASC`,
    [params.initiativeId]
  );

  const committee = rows.find((row) => row.pmo_role === 'STEERING_COMMITTEE' && row.user_id);
  if (committee) {
    return { targetPmoRole: 'STEERING_COMMITTEE', targetUserId: committee.user_id, route: 'steering_committee' };
  }
  const sponsor = rows.find((row) => row.pmo_role === 'SPONSOR' && row.user_id);
  if (sponsor) return { targetPmoRole: 'SPONSOR', targetUserId: sponsor.user_id, route: 'sponsor' };
  const pmo = rows.find((row) => row.pmo_role === 'PMO' && row.user_id);
  if (pmo) return { targetPmoRole: 'PMO', targetUserId: pmo.user_id, route: 'pmo' };
  return { targetPmoRole: null, targetUserId: null, route: 'unassigned' };
}

export async function collectInitiativeStageSlaCandidates(params?: {
  organizationId?: string;
  now?: Date;
  limit?: number;
}): Promise<{
  candidates: InitiativeStageSlaCandidate[];
  skippedAlreadyToday: number;
  skippedInvalidStage: number;
}> {
  const now = params?.now ?? new Date();
  const nowIso = now.toISOString();
  const orgId = params?.organizationId;
  const limit = Math.max(1, Math.min(Number(params?.limit || 100), 500));

  let rows: DueDateRow[] = [];
  try {
    rows = await queryAll<DueDateRow>(
      `SELECT
          dd.id AS due_date_id,
          dd.organization_id,
          dd.initiative_id,
          i.title AS initiative_title,
          dd.lifecycle_stage,
          dd.next_lifecycle_stage,
          dd.due_at,
          COALESCE((SELECT MAX(ev.escalation_level)
                      FROM initiative_stage_escalation_events ev
                     WHERE ev.due_date_id = dd.id), 0) AS current_level,
          (SELECT COUNT(*)
             FROM initiative_stage_escalation_events ev2
            WHERE ev2.due_date_id = dd.id
              AND substr(CAST(ev2.created_at AS TEXT), 1, 10) = substr(?, 1, 10)) AS escalated_today
        FROM initiative_stage_due_dates dd
        JOIN initiatives i ON i.id = dd.initiative_id AND i.organization_id = dd.organization_id
       WHERE dd.due_at < ?
         AND UPPER(COALESCE(dd.status, 'OPEN')) = 'OPEN'
         ${orgId ? 'AND dd.organization_id = ?' : ''}
       ORDER BY dd.due_at ASC
       LIMIT ?`,
      orgId ? [nowIso, nowIso, orgId, limit] : [nowIso, nowIso, limit]
    );
  } catch (err) {
    if (isMissingPmo1bSchemaError(err)) {
      logger.warn('[initiativeStageSlaService] PMO-1b schema is not installed; SLA tick skipped');
      return { candidates: [], skippedAlreadyToday: 0, skippedInvalidStage: 0 };
    }
    throw err;
  }

  const candidates: InitiativeStageSlaCandidate[] = [];
  let skippedAlreadyToday = 0;
  let skippedInvalidStage = 0;

  for (const row of rows || []) {
    const lifecycleStage = resolveInitiativeLifecycleStage(row.lifecycle_stage);
    const nextLifecycleStage = resolveInitiativeLifecycleStage(row.next_lifecycle_stage);
    const planNext = resolvePlanDrivenNextStage(lifecycleStage);
    if (!lifecycleStage || !nextLifecycleStage || planNext !== nextLifecycleStage) {
      skippedInvalidStage += 1;
      continue;
    }
    if (Number(row.escalated_today ?? 0) > 0) {
      skippedAlreadyToday += 1;
      continue;
    }
    const target = await resolveEscalationTarget({ initiativeId: row.initiative_id });
    const currentLevel = Number(row.current_level ?? 0) || 0;
    const dueAt = row.due_at instanceof Date ? row.due_at.toISOString() : String(row.due_at);
    candidates.push({
      dueDateId: row.due_date_id,
      organizationId: row.organization_id,
      initiativeId: row.initiative_id,
      initiativeTitle: row.initiative_title,
      lifecycleStage,
      nextLifecycleStage,
      dueAt,
      escalationLevel: currentLevel + 1,
      targetPmoRole: target.targetPmoRole,
      targetUserId: target.targetUserId,
      route: target.route,
      reason: buildReason({ lifecycleStage, nextLifecycleStage, dueAt }),
    });
  }

  return { candidates, skippedAlreadyToday, skippedInvalidStage };
}

export async function runInitiativeStageSlaEscalationTick(params?: {
  dryRun?: boolean;
  organizationId?: string;
  now?: Date;
  limit?: number;
}): Promise<InitiativeStageSlaTickResult> {
  const dryRun = params?.dryRun === true;
  const { candidates, skippedAlreadyToday, skippedInvalidStage } =
    await collectInitiativeStageSlaCandidates(params);

  if (dryRun) {
    return { dryRun: true, candidates, escalated: 0, skippedAlreadyToday, skippedInvalidStage, errors: 0 };
  }

  let escalated = 0;
  let errors = 0;
  for (const candidate of candidates) {
    try {
      await queryRun(
        `INSERT INTO initiative_stage_escalation_events
           (id, organization_id, initiative_id, due_date_id, lifecycle_stage, next_lifecycle_stage,
            escalation_level, target_pmo_role, target_user_id, route, reason, triggered_by, trigger_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', 'PMO_STAGE_SLA_OVERDUE', ?)`,
        [
          randomUUID(),
          candidate.organizationId,
          candidate.initiativeId,
          candidate.dueDateId,
          candidate.lifecycleStage,
          candidate.nextLifecycleStage,
          candidate.escalationLevel,
          candidate.targetPmoRole,
          candidate.targetUserId,
          candidate.route,
          candidate.reason,
          (params?.now ?? new Date()).toISOString(),
        ]
      );
      escalated += 1;
    } catch (err: any) {
      errors += 1;
      logger.error('[initiativeStageSlaService] PMO stage SLA escalation failed', {
        dueDateId: candidate.dueDateId,
        initiativeId: candidate.initiativeId,
        error: err?.message || String(err),
      });
    }
  }

  return { dryRun: false, candidates, escalated, skippedAlreadyToday, skippedInvalidStage, errors };
}
