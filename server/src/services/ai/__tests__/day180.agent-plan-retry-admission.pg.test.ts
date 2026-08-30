/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FIX-180 / F1 + F2 — governance must not turn a retryable step into a dead one.
 *
 * F1: a refusal (`denied`) records that NOTHING ran. Replaying it forever made
 *     one momentary concurrency peak permanent: retries and resumes rebuild the
 *     same idempotency key, so the step could never be admitted again.
 * F2: after a real tool failure the reservation is `released`, and the step's
 *     remaining retry attempts replayed THAT instead of calling the tool — the
 *     retry loop was decorative and `step.error_message` carried an internal
 *     governance code instead of the real cause.
 *
 * `executeToolCall` is mocked because the production one swallows tool errors
 * into a JSON payload; these cases are about a tool that genuinely throws.
 */
const toolCalls: Array<{ toolName: string; input: Record<string, unknown> }> = [];
let toolBehaviour: (callNumber: number) => unknown = () => JSON.stringify({ ok: true });

vi.mock('../toolDefinitions.js', () => ({
  executeToolCall: async (toolName: string, input: Record<string, unknown>) => {
    toolCalls.push({ toolName, input });
    return toolBehaviour(toolCalls.length);
  },
}));

const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('DAY180 governed retry admission — real PG', () => {
  const tag = randomUUID();
  const organizationId = `day180-retry-org-${tag}`;
  const userId = `day180-retry-user-${tag}`;
  const toolName = 'generate_report_section';
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 180 governed retry']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name)
       VALUES ($1,$2,$3,'not-used','OWNER','active','Day','180')`,
      [userId, organizationId, `${userId}@example.test`]
    );
  });

  beforeEach(() => {
    toolCalls.length = 0;
    toolBehaviour = () => JSON.stringify({ ok: true });
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function createChatPlan(title: string) {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      title,
      isBackground: true,
      steps: [{ toolName, toolInput: { marker: tag }, requiresApproval: false }],
    });
    expect(plan.canonicalRunId).toBeNull();
    return plan;
  }

  const reservationsOf = async (planId: string) =>
    (
      await pool.query(
        `SELECT status,decision_reason,idempotency_key FROM v8_agent_resource_reservations
          WHERE organization_id=$1 AND run_id=$2 ORDER BY idempotency_key`,
        [organizationId, planId]
      )
    ).rows;

  it('F2: the retry after a real tool failure executes the tool again and completes', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const plan = await createChatPlan('Day 180 retry after tool failure');
    toolBehaviour = (callNumber) => {
      if (callNumber === 1) throw new Error('tool-transient-boom');
      return JSON.stringify({ ok: true });
    };

    const executed = await agentPlannerService.executeBackgroundPlan({
      planId: plan.id,
      organizationId,
      userId,
    });

    expect(executed.status).toBe('completed');
    // The tool ran a SECOND time — before the fix attempt 2 replayed the
    // released reservation and never reached the tool.
    expect(toolCalls).toHaveLength(2);
    expect(
      (await pool.query(`SELECT status FROM ai_agent_plan_steps WHERE plan_id=$1`, [plan.id]))
        .rows[0].status
    ).toBe('completed');
    const reservations = await reservationsOf(plan.id);
    expect(reservations).toHaveLength(2);
    expect(reservations[0].status).toBe('released'); // attempt 1 — the real failure
    expect(reservations[0].idempotency_key).not.toContain(':attempt:');
    expect(reservations[1].status).toBe('settled'); // attempt 2 — the successful retry
    expect(reservations[1].idempotency_key).toContain(':attempt:2');
  }, 60_000);

  it('F2: a step that keeps failing reports the REAL cause, not a governance code', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const plan = await createChatPlan('Day 180 retry exhausted');
    toolBehaviour = () => {
      throw new Error('tool-permanent-boom');
    };

    const executed = await agentPlannerService.executeBackgroundPlan({
      planId: plan.id,
      organizationId,
      userId,
    });

    expect(executed.status).toBe('completed_with_errors');
    expect(toolCalls).toHaveLength(3);
    const step = (
      await pool.query(`SELECT status,error_message FROM ai_agent_plan_steps WHERE plan_id=$1`, [
        plan.id,
      ])
    ).rows[0];
    expect(step.status).toBe('failed');
    expect(step.error_message).toContain('tool-permanent-boom');
    expect(step.error_message).not.toContain('resource_released_after_execution_failure');
  }, 60_000);

  it('F1: a stale denial from a past peak does not kill the step forever', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const plan = await createChatPlan('Day 180 stale denial');
    const stepId = plan.steps[0].id;
    // Exactly the key attempt 1 of this step rebuilds — as if a concurrency
    // peak had refused this step in an earlier run. The peak is over: no
    // reserved rows are left, so admission must be re-judged and pass.
    const staleKey = `planner-chat:${plan.id}:agent-plan:${plan.id}:step:${stepId}`;
    await pool.query(
      `INSERT INTO v8_agent_resource_policies
       (policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run,lease_seconds,enabled)
       VALUES ($1,$2,'agent-plan-chat:v1',4,0.25,300,1)
       ON CONFLICT (organization_id,project_id) DO NOTHING`,
      [randomUUID(), organizationId]
    );
    const policyId = (
      await pool.query(
        `SELECT policy_id FROM v8_agent_resource_policies
          WHERE organization_id=$1 AND project_id='agent-plan-chat:v1'`,
        [organizationId]
      )
    ).rows[0].policy_id;
    const staleReservationId = `agent-resource-${randomUUID()}`;
    await pool.query(
      `INSERT INTO v8_agent_resource_reservations
       (reservation_id,organization_id,project_id,run_id,user_id,agent_id,tool_name,idempotency_key,
        policy_id,status,decision_reason,estimated_cost_usd,actual_cost_usd,actual_usage_source)
       VALUES ($1,$2,'agent-plan-chat:v1',$3,$4,'agent-planner',$5,$6,$7,'denied',
        'resource_concurrency_limit_exceeded',0,NULL,'UNKNOWN')`,
      [staleReservationId, organizationId, plan.id, userId, toolName, staleKey, policyId]
    );

    const executed = await agentPlannerService.executeBackgroundPlan({
      planId: plan.id,
      organizationId,
      userId,
    });

    expect(executed.status).toBe('completed');
    expect(toolCalls).toHaveLength(1);
    const reservations = await reservationsOf(plan.id);
    // Re-judged IN PLACE: the same row, now settled — no duplicate reservation.
    expect(reservations).toHaveLength(1);
    expect(reservations[0].status).toBe('settled');
    expect(
      (
        await pool.query(
          `SELECT reservation_id FROM v8_agent_resource_reservations WHERE idempotency_key=$1`,
          [staleKey]
        )
      ).rows[0].reservation_id
    ).toBe(staleReservationId);
  }, 60_000);
});
