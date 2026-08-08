import { get as dbGet } from '../../utils/DbPromise.js';

export const TRANSFORMATION_AGENT_ID = 'consultify:teresa:transformation-agent';

export interface TransformationAgentExecutionContext {
  transformationCaseId: string;
  organizationId: string;
  canonicalRunId: string;
  projectId: string | null;
  actorUserId: string;
  agentId: typeof TRANSFORMATION_AGENT_ID;
  lineageId: string;
}

export async function loadTransformationAgentExecutionContext(input: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<TransformationAgentExecutionContext> {
  if (!input.transformationCaseId.trim()) throw new Error('transformation_case_id_required');
  if (!input.organizationId.trim()) throw new Error('transformation_organization_id_required');
  if (!input.actorUserId.trim()) throw new Error('transformation_actor_user_id_required');
  const row = await dbGet<{
    transformation_case_id: string;
    organization_id: string;
    project_id: string | null;
    execution_run_id: string | null;
    lineage_id: string;
    identity_run_id: string | null;
    identity_lineage_id: string | null;
    agent_id: string | null;
  }>(
    `SELECT c.transformation_case_id,c.organization_id,c.project_id,c.execution_run_id,c.lineage_id,
            i.canonical_run_id AS identity_run_id,i.lineage_id AS identity_lineage_id,
            a.agent_id
       FROM transformation_cases c
       LEFT JOIN v8_agent_run_identities i
         ON i.canonical_run_id=c.execution_run_id
        AND i.organization_id=c.organization_id
        AND i.transformation_case_id=c.transformation_case_id
       LEFT JOIN wave8_agent_definitions a
         ON a.agent_id=? AND (a.organization_id IS NULL OR a.organization_id=c.organization_id)
      WHERE c.transformation_case_id=? AND c.organization_id=?`,
    [TRANSFORMATION_AGENT_ID, input.transformationCaseId, input.organizationId]
  );
  if (!row) throw new Error('transformation_execution_context_not_found');
  if (!row.execution_run_id || row.identity_run_id !== row.execution_run_id)
    throw new Error('transformation_canonical_run_identity_missing');
  if (row.identity_lineage_id !== row.lineage_id)
    throw new Error('transformation_canonical_run_identity_drift');
  if (row.agent_id !== TRANSFORMATION_AGENT_ID)
    throw new Error('transformation_agent_identity_missing');
  return {
    transformationCaseId: row.transformation_case_id,
    organizationId: row.organization_id,
    canonicalRunId: row.execution_run_id,
    projectId: row.project_id,
    actorUserId: input.actorUserId,
    agentId: TRANSFORMATION_AGENT_ID,
    lineageId: row.lineage_id,
  };
}
