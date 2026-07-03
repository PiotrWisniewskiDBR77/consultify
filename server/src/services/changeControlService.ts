/**
 * changeControlService — M14/F5 (5.5)
 *
 * Lightweight RFC/CAB layer over the existing `rollout_changes` register.
 * Adds change classification + risk assessment (pure functions) and an
 * auto-emit path that logs change events (rebaseline, KPI change, etc.)
 * into rollout_changes. Does NOT touch rollout.routes.
 *
 * node-pg / snake_case columns. Org-scoped.
 */
import { all as dbAll } from '../utils/DbPromise.js';

export type ChangeClass = 'standard' | 'normal' | 'emergency';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ClassifyChangeInput {
  /** free-text or coded impact; "high"/"critical" → elevated */
  impact?: string;
  /** whether the change can be rolled back safely */
  reversible?: boolean;
  /** pre-approved standard change (off the CAB path entirely) */
  preApproved?: boolean;
}

/**
 * Classify a change for the RFC/CAB process.
 * - preApproved  → 'standard'  (routine, no CAB)
 * - high-impact OR irreversible → 'emergency' (expedited CAB)
 * - otherwise    → 'normal'    (full CAB review)
 */
export function classifyChange(input: ClassifyChangeInput): ChangeClass {
  if (input.preApproved) return 'standard';

  const impact = (input.impact ?? '').trim().toLowerCase();
  const highImpact = impact === 'high' || impact === 'critical';
  const irreversible = input.reversible === false;

  if (highImpact || irreversible) return 'emergency';
  return 'normal';
}

export interface AssessChangeRiskInput {
  /** schedule slip introduced by the change, in days */
  scheduleImpactDays?: number;
  /** monetary cost impact (any currency, magnitude only) */
  costImpact?: number;
  /** number of initiatives affected by the change */
  affectedInitiatives?: number;
}

export interface ChangeRisk {
  score: number;
  level: RiskLevel;
}

/**
 * Score a change's risk on a small additive model and bucket into a level.
 * Scoring (each capped to keep one dimension from dominating):
 *   schedule: ceil(days / 5),     cap 6
 *   cost:     floor(|cost| / 10k), cap 6
 *   reach:    affectedInitiatives, cap 6
 * Levels: <3 LOW, 3..6 MEDIUM, >6 HIGH.
 */
export function assessChangeRisk(input: AssessChangeRiskInput): ChangeRisk {
  const days = Math.max(0, input.scheduleImpactDays ?? 0);
  const cost = Math.abs(input.costImpact ?? 0);
  const reach = Math.max(0, input.affectedInitiatives ?? 0);

  const scheduleScore = Math.min(6, Math.ceil(days / 5));
  const costScore = Math.min(6, Math.floor(cost / 10_000));
  const reachScore = Math.min(6, reach);

  const score = scheduleScore + costScore + reachScore;

  let level: RiskLevel;
  if (score < 3) level = 'LOW';
  else if (score <= 6) level = 'MEDIUM';
  else level = 'HIGH';

  return { score, level };
}

export interface EmitChangeInput {
  initiativeId?: string | null;
  title: string;
  type?: string;
  change_class?: ChangeClass;
  requested_by?: string | null;
  assessment?: string | null;
}

export interface EmittedChange {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  type: string;
  status: string;
  change_class: string | null;
  requested_by: string | null;
  assessment: string | null;
  decision_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Auto-log a change event into rollout_changes (the change register).
 * Used as the sink for system-emitted change events such as rebaseline
 * or KPI-target changes. Org-scoped; snake_case columns.
 */
export async function emitChange(
  orgId: string,
  input: EmitChangeInput,
): Promise<EmittedChange> {
  const rows = await dbAll<EmittedChange>(
    `INSERT INTO rollout_changes
       (organization_id, project_id, title, type, status, change_class, requested_by, assessment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id, organization_id, project_id, title, type, status,
               change_class, requested_by, assessment, decision_date,
               created_at, updated_at`,
    [
      orgId,
      input.initiativeId ?? null,
      input.title,
      input.type ?? 'process',
      'PROPOSED',
      input.change_class ?? null,
      input.requested_by ?? null,
      input.assessment ?? null,
    ],
  );
  return rows[0];
}
