/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * FIX-180 / F4 — malformed timing envs must behave like unset ones.
 *
 * Both knobs are read ONCE, when the planner singleton is constructed, so this
 * lives in its own file: the values below are planted before the very first
 * import of `agentPlannerService`, and no other test in this file may import it
 * under different values. Before the fix, `Number('nieprawidlowa')` = NaN went
 * straight through `Math.max`, which meant `setInterval(NaN)` = a lease UPDATE
 * every millisecond and `durationMs < NaN` = a "long step" warning on EVERY
 * step. The assertions below are the observable form of both defaults
 * (60 s heartbeat, 120 s warning): during a ~150 ms step neither fires.
 */
const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('DAY180 malformed agent-plan timing envs — real PG', () => {
  const tag = randomUUID();
  const organizationId = `day180-envguard-org-${tag}`;
  const userId = `day180-envguard-user-${tag}`;
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    process.env.AGENT_PLAN_HEARTBEAT_INTERVAL_MS = 'nieprawidlowa';
    process.env.AGENT_PLAN_LONG_STEP_WARNING_MS = 'nieprawidlowa';
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 180 env guard']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name)
       VALUES ($1,$2,$3,'not-used','OWNER','active','Day','180')`,
      [userId, organizationId, `${userId}@example.test`]
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('falls back to the documented defaults on both knobs instead of NaN', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { default: logger } = await import('../../../utils/Logger.js');
    const heartbeat = vi.spyOn(agentPlannerService, 'renewExecutionLease');
    const warning = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    try {
      const plan = await agentPlannerService.createPlan({
        organizationId,
        userId,
        title: 'Day 180 malformed timing envs',
        steps: [{ toolName: 'generate_report_section', toolInput: {}, requiresApproval: false }],
      });
      const executed = await agentPlannerService.executePlan(plan.id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { ok: true };
      });
      expect(executed.status).toBe('completed');

      // Heartbeat default 60 s: NOT ONE renewal inside a 150 ms step.
      // With NaN the interval degrades to 1 ms — hundreds of DB writes.
      expect(heartbeat).not.toHaveBeenCalled();
      // Warning default 120 s: a 150 ms step is not "long".
      // With NaN the comparison is always false, so every step warns.
      expect(
        warning.mock.calls.filter(
          ([message]) => message === '[AgentPlanner] long-running step completed'
        )
      ).toHaveLength(0);
    } finally {
      warning.mockRestore();
      heartbeat.mockRestore();
    }
  }, 60_000);
});
