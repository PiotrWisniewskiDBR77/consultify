import * as queryHelpers from '../../../utils/queryHelpers.js';
import type { ActionCardSourceKind } from '../actionCardService.js';

export interface LegacyActionCardCandidate {
  sourceKind: ActionCardSourceKind;
  sourceId: string;
  problem: string;
  actionText: string;
  ownerUserId: string;
  dueDate: string;
}

async function rows(sql: string, organizationId: string): Promise<any[]> {
  return queryHelpers.queryAll<any>(sql, [organizationId]);
}

export async function readLegacyActionCardCandidates(organizationId: string): Promise<LegacyActionCardCandidate[]> {
  const [kpi, audits, delays, meetings] = await Promise.all([
    rows(`SELECT action_id AS source_id, title AS problem, COALESCE(description,title) AS action_text, owner_user_id, due_date FROM rvn_kpi_corrective_actions WHERE organization_id = ? AND status NOT IN ('completed','cancelled') AND owner_user_id IS NOT NULL AND due_date IS NOT NULL`, organizationId),
    rows(`SELECT id AS source_id, title AS problem, COALESCE(description,title) AS action_text, owner_user_id, due_date FROM audit_corrective_actions WHERE organization_id = ? AND status NOT IN ('implemented','verified','rejected','cancelled') AND owner_user_id IS NOT NULL AND due_date IS NOT NULL`, organizationId),
    rows(`SELECT id AS source_id, entity_name AS problem, CONCAT(deviation_type, ': ', days_deviation, ' dni') AS action_text, NULL AS owner_user_id, planned_date AS due_date FROM delay_signals WHERE organization_id = ? AND is_dismissed = FALSE`, organizationId),
    rows(`SELECT id AS source_id, title AS problem, title AS action_text, owner_user_id, due_at AS due_date FROM meeting_follow_ups WHERE organization_id = ? AND status = 'open' AND owner_user_id IS NOT NULL AND due_at IS NOT NULL`, organizationId),
  ]);
  const mapRows = (sourceKind: ActionCardSourceKind, sourceRows: any[]) => sourceRows
    .filter((row) => row.owner_user_id && row.due_date)
    .map((row) => ({ sourceKind, sourceId: String(row.source_id), problem: String(row.problem || '—'), actionText: String(row.action_text || '—'), ownerUserId: String(row.owner_user_id), dueDate: String(row.due_date).slice(0, 10) }));
  return [
    ...mapRows('kpi_deviation', kpi),
    ...mapRows('audit_finding', audits),
    ...mapRows('execution_delay', delays),
    ...mapRows('meeting_action', meetings),
  ];
}
