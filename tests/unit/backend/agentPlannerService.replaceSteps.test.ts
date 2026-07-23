/**
 * agentPlannerService.replaceSteps — unit tests (AGT-009, partia 2).
 *
 * Dowodzi mechaniki rozdziału create/run po stronie kręgosłupa:
 *  1. plan utworzony przez `createPlan` ZOSTAJE w statusie 'planning'
 *     (bez wykonania — dispatch jest osobnym krokiem, POST /:id/run),
 *  2. `replaceSteps` nadpisuje CAŁĄ listę kroków w podanej kolejności —
 *     przestawienie utrwala się jako nowe `step_index` + `total_steps`,
 *     a plan pozostaje 'planning' (edytowalny aż do jawnego Uruchom),
 *  3. guard TWARDY: `replaceSteps` na planie poza 'planning' rzuca —
 *     po dispatchu kroki są w toku i edycja nie ma sensu.
 *
 * Ćwiczy REALNY `agentPlannerService` (nie mock) przeciw in-memory fake
 * `DbPromise` odzwierciedlającemu tabele migracji 672 — bez żywego sqlite/pg.
 * Wzór fake-DB z agentPlannerService.executePlan.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface PlanRow {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  total_steps: number;
  completed_steps: number;
  current_step_index: number;
  plan_json: string;
  result_summary: string | null;
  error_message: string | null;
  is_background: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  id: string;
  plan_id: string;
  step_index: number;
  tool_name: string;
  tool_input_json: string;
  status: string;
  result_json: string | null;
  error_message: string | null;
  requires_approval: number;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

const db = vi.hoisted(() => ({
  plans: new Map<string, PlanRow>(),
  steps: new Map<string, StepRow[]>(), // keyed by plan_id
}));

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);

    if (s.startsWith('INSERT INTO ai_agent_plans')) {
      const [
        id,
        organization_id,
        conversation_id,
        user_id,
        title,
        description,
        total_steps,
        plan_json,
        is_background,
        scheduled_at,
      ] = params as [
        string,
        string,
        string | null,
        string,
        string,
        string | null,
        number,
        string,
        number,
        string | null,
      ];
      db.plans.set(id, {
        id,
        organization_id,
        conversation_id,
        user_id,
        title,
        description,
        status: 'planning',
        total_steps,
        completed_steps: 0,
        current_step_index: 0,
        plan_json,
        result_summary: null,
        error_message: null,
        is_background,
        scheduled_at,
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }

    if (s.startsWith('INSERT INTO ai_agent_plan_steps')) {
      const [id, plan_id, step_index, tool_name, tool_input_json, requires_approval] = params as [
        string,
        string,
        number,
        string,
        string,
        number,
      ];
      const arr = db.steps.get(plan_id) || [];
      arr.push({
        id,
        plan_id,
        step_index,
        tool_name,
        tool_input_json,
        status: 'pending',
        result_json: null,
        error_message: null,
        requires_approval,
        approved_by: null,
        approved_at: null,
        started_at: null,
        completed_at: null,
        duration_ms: null,
        created_at: new Date().toISOString(),
      });
      db.steps.set(plan_id, arr);
      return { changes: 1 };
    }

    if (s.startsWith('DELETE FROM ai_agent_plan_steps WHERE plan_id = ?')) {
      db.steps.set(params[0] as string, []);
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE ai_agent_plans')) {
      // replaceSteps: SET plan_json = ?, total_steps = ?, completed_steps = 0, current_step_index = 0
      if (s.includes('plan_json = ?') && s.includes('total_steps = ?')) {
        const [plan_json, total_steps, id] = params as [string, number, string];
        const plan = db.plans.get(id);
        if (plan)
          Object.assign(plan, {
            plan_json,
            total_steps,
            completed_steps: 0,
            current_step_index: 0,
          });
        return { changes: 1 };
      }
      // dynamic updatePlanStatus(planId, status, ...) — used to simulate dispatch
      let idx = 0;
      const status = params[idx++] as string;
      const updates: Partial<PlanRow> = { status };
      if (s.includes('current_step_index = ?'))
        updates.current_step_index = params[idx++] as number;
      if (s.includes('error_message = ?')) updates.error_message = params[idx++] as string;
      const id = params[idx] as string;
      const plan = db.plans.get(id);
      if (plan) Object.assign(plan, updates);
      return { changes: 1 };
    }

    if (s.startsWith('CREATE TABLE') || s.startsWith('CREATE INDEX')) return { changes: 0 };

    throw new Error(`Unmocked SQL (run) in replaceSteps test: ${s}`);
  },

  get: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);
    if (s.startsWith('SELECT * FROM ai_agent_plans WHERE id = ?')) {
      return db.plans.get(params[0] as string) || undefined;
    }
    throw new Error(`Unmocked SQL (get) in replaceSteps test: ${s}`);
  },

  all: async (sql: string, params: unknown[] = []) => {
    const s = normalize(sql);
    if (s.startsWith('SELECT * FROM ai_agent_plan_steps WHERE plan_id = ?')) {
      const arr = db.steps.get(params[0] as string) || [];
      return [...arr].sort((a, b) => a.step_index - b.step_index);
    }
    throw new Error(`Unmocked SQL (all) in replaceSteps test: ${s}`);
  },
}));

const { agentPlannerService } = await import(
  '../../../server/src/services/ai/agentPlannerService.js'
);

async function seedPlan(steps: Array<{ toolName: string; toolInput: Record<string, unknown> }>) {
  return agentPlannerService.createPlan({
    organizationId: 'org-1',
    userId: 'user-1',
    title: 'Nowy projekt (classic-5)',
    steps,
  });
}

describe('agentPlannerService.replaceSteps (AGT-009 — rozdział create/run)', () => {
  beforeEach(() => {
    db.plans.clear();
    db.steps.clear();
  });

  it('plan utworzony generatorem ZOSTAJE w statusie planning (bez auto-wykonania)', async () => {
    const plan = await seedPlan([
      { toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' } },
      { toolName: 'get_assessment_data', toolInput: { phase: 'Diagnoza' } },
    ]);

    expect(plan.status).toBe('planning');

    const fetched = await agentPlannerService.getPlan(plan.id);
    expect(fetched?.status).toBe('planning');
    expect(fetched?.steps.map((s) => s.toolName)).toEqual([
      'search_knowledge_base',
      'get_assessment_data',
    ]);
  });

  it('replaceSteps utrwala PRZESTAWIONĄ kolejność jako nowe step_index, plan wciąż planning', async () => {
    const plan = await seedPlan([
      { toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' } },
      { toolName: 'get_assessment_data', toolInput: { phase: 'Diagnoza' } },
      { toolName: 'calculate_financial', toolInput: { phase: 'Rekomendacje' } },
    ]);

    // Przestawienie: Diagnoza na początek, Wejście usunięte (2 kroki zamiast 3).
    const updated = await agentPlannerService.replaceSteps(plan.id, [
      { toolName: 'get_assessment_data', toolInput: { phase: 'Diagnoza', module: 'Assessment' } },
      { toolName: 'calculate_financial', toolInput: { phase: 'Rekomendacje' } },
    ]);

    expect(updated.status).toBe('planning');
    expect(updated.totalSteps).toBe(2);
    expect(updated.steps.map((s) => s.stepIndex)).toEqual([0, 1]);
    expect(updated.steps.map((s) => s.toolName)).toEqual([
      'get_assessment_data',
      'calculate_financial',
    ]);
    // toolInput przestawionego kroku utrwalony (dowód że przestawienie nie gubi metadanych).
    expect(updated.steps[0].toolInput).toMatchObject({ phase: 'Diagnoza', module: 'Assessment' });

    // Odczyt z bazy potwierdza persystencję (nie tylko wynik zwrócony).
    const reread = await agentPlannerService.getPlan(plan.id);
    expect(reread?.steps.map((s) => s.toolName)).toEqual([
      'get_assessment_data',
      'calculate_financial',
    ]);
    expect(reread?.totalSteps).toBe(2);
  });

  it('przelicza requiresApproval z SIDE_EFFECT_TOOLS przy nowej liście kroków', async () => {
    const plan = await seedPlan([
      { toolName: 'search_knowledge_base', toolInput: {} },
    ]);

    const updated = await agentPlannerService.replaceSteps(plan.id, [
      { toolName: 'search_knowledge_base', toolInput: {} },
      { toolName: 'create_initiative_draft', toolInput: { title: 'X' } }, // side-effect => bramka
    ]);

    const approvalFlags = updated.steps.map((s) => s.requiresApproval);
    // Co najmniej jeden krok wymaga akceptu (bramka), nie-side-effect nie wymaga.
    expect(approvalFlags).toContain(true);
    expect(updated.steps.find((s) => s.toolName === 'search_knowledge_base')?.requiresApproval).toBe(
      false
    );
  });

  it('GUARD: replaceSteps na planie POZA planning rzuca (edycja po dispatchu bez sensu)', async () => {
    const plan = await seedPlan([{ toolName: 'search_knowledge_base', toolInput: {} }]);

    // Symulacja dispatchu: plan przechodzi do 'executing'.
    const row = db.plans.get(plan.id);
    if (row) row.status = 'executing';

    await expect(
      agentPlannerService.replaceSteps(plan.id, [
        { toolName: 'get_assessment_data', toolInput: {} },
      ])
    ).rejects.toThrow(/only 'planning'/);
  });

  it('GUARD: replaceSteps nieistniejącego planu rzuca', async () => {
    await expect(
      agentPlannerService.replaceSteps('nope', [{ toolName: 'search_knowledge_base', toolInput: {} }])
    ).rejects.toThrow(/not found/i);
  });
});
