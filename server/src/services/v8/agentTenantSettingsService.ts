import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { get as dbGet } from '../../utils/DbPromise.js';
import { withPgTransaction } from '../../utils/queryHelpers.js';

export const A06_TENANT_SEED_VERSION = 'a06-t01-v1';
export const A06_RATIFIED_TOOLS = [
  ['transformation.ideas.materialize', 'medium_risk', 'bounded_write'],
  ['transformation.interviews.materialize', 'medium_risk', 'bounded_write'],
  ['transformation.drd.materialize', 'medium_risk', 'bounded_write'],
  ['transformation.initiative_candidate.materialize', 'medium_risk', 'bounded_write'],
  ['transformation.finance_kpi.materialize', 'high_risk', 'workflow_mutation'],
  ['transformation.portfolio_decision.materialize', 'high_risk', 'workflow_mutation'],
  ['transformation.mobilization.materialize', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.initiative_results.accept', 'medium_risk', 'workflow_mutation'],
  ['transformation.gate.finance_kpi_results.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.portfolio_decision_results.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.mobilization_results.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.execution_start.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.execution_results.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.delivery_handoff.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.benefits_review.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.gate.sustainability_review.accept', 'high_risk', 'workflow_mutation'],
  ['transformation.final_outputs.publish', 'high_risk', 'bounded_write'],
] as const;

type AdminRole = 'ADMIN' | 'OWNER' | 'SUPERADMIN';
function assertAuthority(role: string): asserts role is AdminRole {
  if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(role.toUpperCase()))
    throw new Error('AGENT_ADMIN_ROLE_REQUIRED');
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
async function assertProject(organizationId: string, projectId: string | null): Promise<void> {
  if (!projectId) return;
  const project = await dbGet(`SELECT id FROM projects WHERE id=? AND organization_id=?`, [
    projectId,
    organizationId,
  ]);
  if (!project) throw new Error('AGENT_SETTINGS_PROJECT_NOT_FOUND');
}

export async function getAgentTenantSettings(input: {
  organizationId: string;
  projectId?: string | null;
}) {
  await assertProject(input.organizationId, input.projectId ?? null);
  return dbGet(
    `SELECT * FROM v8_agent_tenant_settings WHERE organization_id=? AND COALESCE(project_id,'')=COALESCE(?,'')`,
    [input.organizationId, input.projectId ?? null]
  );
}

export async function updateAgentTenantSettings(input: {
  organizationId: string;
  projectId?: string | null;
  actorUserId: string;
  actorRole: string;
  expectedVersion: number;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  calendarEnabled: boolean;
  cadence: 'manual' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  autoActions: Record<string, boolean>;
  legalHold: boolean;
}) {
  assertAuthority(input.actorRole);
  await assertProject(input.organizationId, input.projectId ?? null);
  if (Object.values(input.autoActions).some(Boolean))
    throw new Error('AGENT_AUTO_ACTIONS_REQUIRE_POLICY');
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `agent-settings:${input.organizationId}:${input.projectId ?? ''}`,
    ]);
    const before = (
      await client.query<any>(
        `SELECT * FROM v8_agent_tenant_settings WHERE organization_id=? AND COALESCE(project_id,'')=COALESCE(?,'') FOR UPDATE`,
        [input.organizationId, input.projectId ?? null]
      )
    ).rows[0];
    if (before && Number(before.version) !== input.expectedVersion)
      throw new Error('AGENT_SETTINGS_VERSION_CONFLICT');
    if (!before && input.expectedVersion !== 0) throw new Error('AGENT_SETTINGS_VERSION_CONFLICT');
    const nextVersion = Number(before?.version ?? 0) + 1;
    const settingsId = before?.settings_id ?? `agent-settings-${uuidv4()}`;
    await client.query(
      `INSERT INTO v8_agent_tenant_settings
       (settings_id,organization_id,project_id,version,in_app_enabled,email_enabled,calendar_enabled,
        cadence,timezone,auto_actions_json,legal_hold,updated_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?,?)
       ON CONFLICT (settings_id) DO UPDATE SET version=EXCLUDED.version,
        in_app_enabled=EXCLUDED.in_app_enabled,email_enabled=EXCLUDED.email_enabled,
        calendar_enabled=EXCLUDED.calendar_enabled,cadence=EXCLUDED.cadence,
        timezone=EXCLUDED.timezone,auto_actions_json=EXCLUDED.auto_actions_json,
        legal_hold=EXCLUDED.legal_hold,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=NOW()`,
      [
        settingsId,
        input.organizationId,
        input.projectId ?? null,
        nextVersion,
        input.inAppEnabled,
        input.emailEnabled,
        input.calendarEnabled,
        input.cadence,
        input.timezone,
        JSON.stringify(input.autoActions),
        input.legalHold,
        input.actorUserId,
      ]
    );
    const after = (
      await client.query<any>(`SELECT * FROM v8_agent_tenant_settings WHERE settings_id=?`, [
        settingsId,
      ])
    ).rows[0];
    await client.query(
      `INSERT INTO v8_agent_admin_audit_events
       (event_id,organization_id,project_id,actor_user_id,event_type,before_json,after_json)
       VALUES (?,?,?,?, 'settings_updated',?::jsonb,?::jsonb)`,
      [
        `agent-admin-audit-${uuidv4()}`,
        input.organizationId,
        input.projectId ?? null,
        input.actorUserId,
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
      ]
    );
    return after;
  });
}

export async function activateA06ForTenant(input: {
  organizationId: string;
  projectId?: string | null;
  actorUserId: string;
  actorRole: string;
  idempotencyKey: string;
}) {
  assertAuthority(input.actorRole);
  await assertProject(input.organizationId, input.projectId ?? null);
  if (input.idempotencyKey.trim().length < 8)
    throw new Error('AGENT_ACTIVATION_IDEMPOTENCY_KEY_REQUIRED');
  const requestDigest = digest({
    projectId: input.projectId ?? null,
    seed: A06_TENANT_SEED_VERSION,
  });
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `agent-activation:${input.organizationId}:${input.idempotencyKey}`,
    ]);
    const replay = (
      await client.query<any>(
        `SELECT * FROM v8_agent_tenant_activation_receipts WHERE organization_id=? AND idempotency_key=? FOR UPDATE`,
        [input.organizationId, input.idempotencyKey]
      )
    ).rows[0];
    if (replay) {
      if (replay.request_digest !== requestDigest)
        throw new Error('AGENT_ACTIVATION_IDEMPOTENCY_CONFLICT');
      const replayCount = Number(
        (
          await client.query<{ count: number }>(
            `SELECT COUNT(*)::int count FROM v8_consumer_tool_policies
          WHERE organization_id=? AND COALESCE(project_id,'')=COALESCE(?,'')
            AND policy_id LIKE ? AND allowed=1 AND approval_override='force_policy_gate'`,
            [
              input.organizationId,
              input.projectId ?? null,
              `a06-t01-policy:${input.organizationId}:%`,
            ]
          )
        ).rows[0]?.count ?? 0
      );
      if (replayCount !== Number(replay.policy_count) || replayCount !== A06_RATIFIED_TOOLS.length)
        throw new Error('AGENT_ACTIVATION_READBACK_DRIFT');
      return { ...replay, idempotentReplay: true };
    }
    for (const [name, riskClass, mutationType] of A06_RATIFIED_TOOLS) {
      const toolId = `a06-t01:${input.organizationId}:${name.replaceAll('.', ':')}`;
      await client.query(
        `INSERT INTO v8_tool_catalog
         (tool_id,organization_id,name,description,category,risk_class,mutation_type,
          classification_status,default_approval_mode,classified_by,classified_at,version,created_at,updated_at)
         VALUES (?,?,?,?, 'workflow_action',?,?, 'ratified','policy_approvable',?,NOW(),?,NOW(),NOW())
         ON CONFLICT (tool_id) DO NOTHING`,
        [
          toolId,
          input.organizationId,
          name,
          `Ratified T01 tool: ${name}`,
          riskClass,
          mutationType,
          input.actorUserId,
          A06_TENANT_SEED_VERSION,
        ]
      );
      await client.query(
        `INSERT INTO v8_consumer_tool_policies
         (policy_id,organization_id,project_id,consumer_class,tool_id,allowed,
          approval_override,max_invocations_per_run,effective_from,created_at,updated_at)
         VALUES (?,?,?,?,?,1,'force_policy_gate',64,NOW(),NOW(),NOW())
         ON CONFLICT (policy_id) DO NOTHING`,
        [
          `a06-t01-policy:${input.organizationId}:${input.projectId ?? 'all'}:${name.replaceAll('.', ':')}`,
          input.organizationId,
          input.projectId ?? null,
          'execution',
          toolId,
        ]
      );
    }
    const count = Number(
      (
        await client.query<{ count: number }>(
          `SELECT COUNT(*)::int count FROM v8_consumer_tool_policies
        WHERE organization_id=? AND COALESCE(project_id,'')=COALESCE(?,'')
          AND policy_id LIKE ? AND allowed=1 AND approval_override='force_policy_gate'`,
          [
            input.organizationId,
            input.projectId ?? null,
            `a06-t01-policy:${input.organizationId}:%`,
          ]
        )
      ).rows[0]?.count ?? 0
    );
    if (count !== A06_RATIFIED_TOOLS.length) throw new Error('AGENT_ACTIVATION_READBACK_DRIFT');
    const receiptId = `agent-activation-${uuidv4()}`;
    await client.query(
      `INSERT INTO v8_agent_tenant_activation_receipts
       (receipt_id,organization_id,project_id,idempotency_key,request_digest,seed_version,
        policy_count,activated_by_user_id) VALUES (?,?,?,?,?,?,17,?)`,
      [
        receiptId,
        input.organizationId,
        input.projectId ?? null,
        input.idempotencyKey,
        requestDigest,
        A06_TENANT_SEED_VERSION,
        input.actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO v8_agent_admin_audit_events
       (event_id,organization_id,project_id,actor_user_id,event_type,after_json)
       VALUES (?,?,?,?, 'a06_activated',?::jsonb)`,
      [
        `agent-admin-audit-${uuidv4()}`,
        input.organizationId,
        input.projectId ?? null,
        input.actorUserId,
        JSON.stringify({ receiptId, seedVersion: A06_TENANT_SEED_VERSION, policyCount: 17 }),
      ]
    );
    return {
      receipt_id: receiptId,
      organization_id: input.organizationId,
      project_id: input.projectId ?? null,
      seed_version: A06_TENANT_SEED_VERSION,
      policy_count: 17,
      idempotentReplay: false,
    };
  });
}
