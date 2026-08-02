/**
 * Agent Plan Routes Unit Tests (HP-4 fundament — "Uruchom agenta z Teresy").
 *
 * Router: server/src/routes/ai/agent-plan.routes.ts. Thin delegation layer
 * over the existing `agentPlannerService` (kręgosłup, migracja 672) — this
 * test mocks that service + the background queue + the manifest catalog so
 * it verifies ROUTING/AUTH/ORG-SCOPE behaviour without touching a live DB,
 * consistent with `tests/unit/backend/agentManifests.routes.test.ts`.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'test-user';
    req.organizationId = 'test-org';
    req.user = { id: 'test-user', organizationId: 'test-org', role: 'member' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

const createPlan = vi.fn();
const getPlan = vi.fn();
const approveStep = vi.fn();
const cancelPlan = vi.fn();
const listPlans = vi.fn();
const replaceSteps = vi.fn(); // AGT-009

vi.mock('../../../server/src/services/ai/agentPlannerService.js', () => ({
  agentPlannerService: { createPlan, getPlan, approveStep, cancelPlan, listPlans, replaceSteps },
}));

const getDiscoveryAgentManifest = vi.fn();
vi.mock('../../../server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.js', () => ({
  getDiscoveryAgentManifest,
}));

const queueAdd = vi.fn();
vi.mock('../../../server/src/queues/aiQueue.js', () => ({
  default: { add: queueAdd },
}));

const { default: agentPlanRoutes } = await import(
  '../../../server/src/routes/ai/agent-plan.routes.js'
);

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/agent-plan', agentPlanRoutes);
  return app;
}

const basePlan = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'plan-1',
  organizationId: 'test-org',
  userId: 'test-user',
  title: 'Test plan',
  status: 'planning',
  steps: [
    { id: 's1', stepIndex: 0, toolName: 'search_web', toolInput: {}, status: 'pending', requiresApproval: false },
  ],
  totalSteps: 1,
  completedSteps: 0,
  currentStepIndex: 0,
  isBackground: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('Agent Plan Routes (HP-4 fundament)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /', () => {
    it('creates a plan via agentPlannerService and attempts background dispatch', async () => {
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({
          title: 'Test plan',
          steps: [{ toolName: 'search_web', toolInput: { query: 'x' } }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toEqual(plan);
      expect(res.body.dispatch).toBe('enqueued');
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'test-org',
          userId: 'test-user',
          title: 'Test plan',
          isBackground: true,
          steps: [{ toolName: 'search_web', toolInput: { query: 'x' } }],
        })
      );
      expect(queueAdd).toHaveBeenCalledWith(
        'AGENT_BACKGROUND_TASK',
        expect.objectContaining({
          taskType: 'AGENT_BACKGROUND_TASK',
          payload: { planId: 'plan-1', organizationId: 'test-org', userId: 'test-user' },
        })
      );
    });

    it('does not fail the request when the background queue is unavailable', async () => {
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockRejectedValue(new Error('AI queue unavailable: MOCK_REDIS=true'));

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Test plan', steps: [{ toolName: 'search_web', toolInput: {} }] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.dispatch).toBe('unavailable');
    });

    it('rejects an empty steps array (400)', async () => {
      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Test plan', steps: [] });

      expect(res.status).toBe(400);
      expect(createPlan).not.toHaveBeenCalled();
    });

    it('rejects more than 12 steps (hard limit from concept §1)', async () => {
      const steps = Array.from({ length: 13 }, () => ({ toolName: 'search_web', toolInput: {} }));
      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Test plan', steps });

      expect(res.status).toBe(400);
      expect(createPlan).not.toHaveBeenCalled();
    });

    it('rejects an unknown manifestId (400)', async () => {
      getDiscoveryAgentManifest.mockReturnValue(null);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({
          title: 'Test plan',
          manifestId: 'does-not-exist',
          steps: [{ toolName: 'search_web', toolInput: {} }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Unknown manifestId');
      expect(createPlan).not.toHaveBeenCalled();
    });

    it('accepts a known built manifestId', async () => {
      getDiscoveryAgentManifest.mockReturnValue({
        id: 'market-forces',
        status: 'built',
        sourceType: 'discovery_tool',
        displayName: { pl: 'x', en: 'x' },
        wave: 'wave-1',
        configDir: 'x',
      });
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({
          title: 'Test plan',
          manifestId: 'market-forces',
          steps: [{ toolName: 'search_web', toolInput: {} }],
        });

      expect(res.status).toBe(201);
      expect(createPlan).toHaveBeenCalled();
    });

    it('generates real multi-step steps via PlanBuilder when manifestId is given without steps (HP-4 F1 — no more single-step kickoff)', async () => {
      getDiscoveryAgentManifest.mockReturnValue({
        id: 'market-forces',
        status: 'built',
        sourceType: 'discovery_tool',
        displayName: { pl: 'Siły Rynkowe', en: 'Market Forces' },
        wave: 'wave-1',
        configDir: 'src/config/porter',
      });
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Test plan', manifestId: 'market-forces' });

      expect(res.status).toBe(201);
      expect(createPlan).toHaveBeenCalledTimes(1);
      const passedSteps = createPlan.mock.calls[0][0].steps as Array<{
        toolName: string;
        toolInput: Record<string, unknown>;
      }>;
      // Real PlanBuilder output: 3+ steps, more than one distinct tool — not
      // the old single "search_knowledge_base" kickoff placeholder.
      expect(passedSteps.length).toBeGreaterThanOrEqual(3);
      expect(new Set(passedSteps.map((s) => s.toolName)).size).toBeGreaterThan(1);
      // No stray `rationale` field leaking into what's persisted.
      expect(Object.keys(passedSteps[0]).sort()).toEqual(['toolInput', 'toolName']);
    });

    it('rejects when neither manifestId, processId nor steps are provided (400)', async () => {
      const res = await request(createApp()).post('/api/ai/agent-plan').send({ title: 'Test plan' });

      expect(res.status).toBe(400);
      expect(createPlan).not.toHaveBeenCalled();
    });

    it('generates the classic 5-phase consulting process when processId=classic-5 (AGT-006)', async () => {
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Nowy projekt', processId: 'classic-5' });

      expect(res.status).toBe(201);
      expect(createPlan).toHaveBeenCalledTimes(1);
      const passedSteps = createPlan.mock.calls[0][0].steps as Array<{
        toolName: string;
        toolInput: Record<string, unknown>;
        requiresApproval?: boolean;
      }>;
      // 5 faz klasycznego procesu we właściwej kolejności, z modułami/deliverables.
      expect(passedSteps).toHaveLength(5);
      expect(passedSteps.map((s) => s.toolInput.phase)).toEqual([
        'Wejście / Kontraktowanie',
        'Diagnoza',
        'Rekomendacje',
        'Wdrożenie',
        'Zamknięcie',
      ]);
      expect(passedSteps.every((s) => typeof s.toolInput.module === 'string')).toBe(true);
      expect(passedSteps.every((s) => typeof s.toolInput.deliverable === 'string')).toBe(true);
      // toolName/toolInput/requiresApproval trafiają do persystencji (bez rationale itp.).
      expect(Object.keys(passedSteps[0]).sort()).toEqual([
        'requiresApproval',
        'toolInput',
        'toolName',
      ]);
      // DOROBKA C (decyzja Piotra 2026-07-23): DWA kroki niosą requiresApproval:true
      // — Rekomendacje (override jawny) i Zamknięcie (SIDE_EFFECT_TOOLS naturalnie).
      expect(passedSteps.map((s) => s.requiresApproval)).toEqual([
        false,
        false,
        true,
        false,
        true,
      ]);
      expect(passedSteps.filter((s) => s.requiresApproval === true)).toHaveLength(2);
    });

    it('generates the 4-step DRD variant when processId=drd (AGT-006)', async () => {
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Projekt DRD', processId: 'drd' });

      expect(res.status).toBe(201);
      const passedSteps = createPlan.mock.calls[0][0].steps as Array<{
        toolName: string;
        toolInput: Record<string, unknown>;
      }>;
      expect(passedSteps).toHaveLength(4);
      expect(passedSteps.map((s) => s.toolInput.phase)).toEqual([
        'Discovery',
        'Ocena',
        'Inicjatywy',
        'Efekty',
      ]);
    });

    it('lets explicit steps override PlanBuilder generation even when manifestId is present', async () => {
      getDiscoveryAgentManifest.mockReturnValue({
        id: 'market-forces',
        status: 'built',
        sourceType: 'discovery_tool',
        displayName: { pl: 'x', en: 'x' },
        wave: 'wave-1',
        configDir: 'x',
      });
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({
          title: 'Test plan',
          manifestId: 'market-forces',
          steps: [{ toolName: 'search_web', toolInput: { query: 'override' } }],
        });

      expect(res.status).toBe(201);
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: [{ toolName: 'search_web', toolInput: { query: 'override' } }],
        })
      );
    });
  });

  describe('GET /:id', () => {
    it('returns the plan when it belongs to the caller org', async () => {
      const plan = basePlan();
      getPlan.mockResolvedValue(plan);

      const res = await request(createApp()).get('/api/ai/agent-plan/plan-1');

      expect(res.status).toBe(200);
      expect(res.body.plan).toEqual(plan);
    });

    it('returns 404 (not 403) for a plan belonging to another org', async () => {
      getPlan.mockResolvedValue(basePlan({ organizationId: 'other-org' }));

      const res = await request(createApp()).get('/api/ai/agent-plan/plan-1');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for a non-existent plan', async () => {
      getPlan.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/ai/agent-plan/does-not-exist');

      expect(res.status).toBe(404);
    });

    it('does not expose another member\'s plan from the same organization', async () => {
      getPlan.mockResolvedValue(basePlan({ userId: 'other-user' }));

      const res = await request(createApp()).get('/api/ai/agent-plan/plan-1');

      expect(res.status).toBe(404);
      expect(res.body.plan).toBeUndefined();
    });
  });

  describe('GET /', () => {
    it('lists plans scoped to the org', async () => {
      listPlans.mockResolvedValue([basePlan()]);

      const res = await request(createApp()).get('/api/ai/agent-plan');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(listPlans).toHaveBeenCalledWith('test-org', undefined);
    });

    it('narrows to the current user when ?mine=1', async () => {
      listPlans.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/ai/agent-plan?mine=1');

      expect(res.status).toBe(200);
      expect(listPlans).toHaveBeenCalledWith('test-org', 'test-user');
    });
  });

  describe('POST /:id/approve-step', () => {
    it('approves a step and re-dispatches background execution', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ status: 'awaiting_approval' }));
      approveStep.mockResolvedValue(undefined);
      queueAdd.mockResolvedValue(undefined);
      getPlan.mockResolvedValueOnce(basePlan({ status: 'executing' }));

      const res = await request(createApp())
        .post('/api/ai/agent-plan/plan-1/approve-step')
        .send({ stepIndex: 0 });

      expect(res.status).toBe(200);
      expect(approveStep).toHaveBeenCalledWith('plan-1', 0, 'test-user');
      expect(res.body.plan.status).toBe('executing');
      expect(res.body.dispatch).toBe('enqueued');
    });

    it('returns 404 for a plan in another org (no approveStep call)', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ organizationId: 'other-org' }));

      const res = await request(createApp())
        .post('/api/ai/agent-plan/plan-1/approve-step')
        .send({ stepIndex: 0 });

      expect(res.status).toBe(404);
      expect(approveStep).not.toHaveBeenCalled();
    });

    it('does not let a member approve another member\'s plan in the same organization', async () => {
      getPlan.mockResolvedValueOnce(
        basePlan({ userId: 'other-user', status: 'awaiting_approval' })
      );

      const res = await request(createApp())
        .post('/api/ai/agent-plan/plan-1/approve-step')
        .send({ stepIndex: 0 });

      expect(res.status).toBe(404);
      expect(approveStep).not.toHaveBeenCalled();
      expect(queueAdd).not.toHaveBeenCalled();
    });

    it('returns 409 when the step is not awaiting approval', async () => {
      getPlan.mockResolvedValueOnce(basePlan());
      approveStep.mockRejectedValue(new Error('Step not found or not awaiting approval'));

      const res = await request(createApp())
        .post('/api/ai/agent-plan/plan-1/approve-step')
        .send({ stepIndex: 0 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects a missing stepIndex (400)', async () => {
      const res = await request(createApp())
        .post('/api/ai/agent-plan/plan-1/approve-step')
        .send({});

      expect(res.status).toBe(400);
      expect(getPlan).not.toHaveBeenCalled();
    });
  });

  // ── AGT-009: rozdział tworzenia od uruchomienia ─────────────────────────
  describe('POST / — draft (AGT-009): tworzy plan bez auto-dispatch', () => {
    it('draft:true zostawia plan w planning i NIE zleca wykonania (dispatch=deferred)', async () => {
      const plan = basePlan(); // status 'planning'
      createPlan.mockResolvedValue(plan);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Nowy projekt', processId: 'classic-5', draft: true });

      expect(res.status).toBe(201);
      expect(res.body.plan.status).toBe('planning');
      expect(res.body.dispatch).toBe('deferred');
      // KLUCZ AGT-009: żaden job nie trafił do kolejki — plan czeka na "Uruchom".
      expect(queueAdd).not.toHaveBeenCalled();
    });

    it('bez draft (domyślnie), ale z processId: ścieżka generatora domyślnie NIE dispatchuje (decyzja Piotra 2026-07-23, DOROBKA A)', async () => {
      const plan = basePlan(); // status 'planning'
      createPlan.mockResolvedValue(plan);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Nowy projekt', processId: 'classic-5' });

      expect(res.status).toBe(201);
      expect(res.body.dispatch).toBe('deferred');
      expect(queueAdd).not.toHaveBeenCalled();
    });

    it('processId + draft:false jawnie wymusza natychmiastowy dispatch', async () => {
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Nowy projekt', processId: 'classic-5', draft: false });

      expect(res.status).toBe(201);
      expect(res.body.dispatch).toBe('enqueued');
      expect(queueAdd).toHaveBeenCalledTimes(1);
    });

    it('manifestId (ścieżka katalogu) bez draft: dispatch od razu — wstecznie zgodne, BEZ ZMIAN', async () => {
      getDiscoveryAgentManifest.mockReturnValue({
        id: 'market-forces',
        status: 'built',
        sourceType: 'discovery_tool',
        displayName: { pl: 'x', en: 'x' },
        wave: 'wave-1',
        configDir: 'x',
      });
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Nowy projekt', manifestId: 'market-forces' });

      expect(res.status).toBe(201);
      expect(res.body.dispatch).toBe('enqueued');
      expect(queueAdd).toHaveBeenCalledTimes(1);
    });

    it('jawne steps (bez processId/manifestId) bez draft: dispatch od razu — wstecznie zgodne', async () => {
      const plan = basePlan();
      createPlan.mockResolvedValue(plan);
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/ai/agent-plan')
        .send({ title: 'Test plan', steps: [{ toolName: 'search_web', toolInput: {} }] });

      expect(res.status).toBe(201);
      expect(res.body.dispatch).toBe('enqueued');
      expect(queueAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /:id/steps — zapis przestawionego schematu (AGT-009)', () => {
    it('nadpisuje kroki planu w statusie planning (200) i deleguje do replaceSteps', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ status: 'planning' }));
      const reordered = basePlan({
        totalSteps: 2,
        steps: [
          { id: 's2', stepIndex: 0, toolName: 'get_assessment_data', toolInput: { phase: 'Diagnoza' }, status: 'pending', requiresApproval: false },
          { id: 's1', stepIndex: 1, toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' }, status: 'pending', requiresApproval: false },
        ],
      });
      replaceSteps.mockResolvedValue(reordered);

      const res = await request(createApp())
        .patch('/api/ai/agent-plan/plan-1/steps')
        .send({
          steps: [
            { toolName: 'get_assessment_data', toolInput: { phase: 'Diagnoza' } },
            { toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' } },
          ],
        });

      expect(res.status).toBe(200);
      expect(replaceSteps).toHaveBeenCalledWith('plan-1', [
        { toolName: 'get_assessment_data', toolInput: { phase: 'Diagnoza' } },
        { toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' } },
      ]);
      // Dowód przestawienia: nowy step_index odzwierciedla nową kolejność.
      expect(res.body.plan.steps.map((s: { toolName: string }) => s.toolName)).toEqual([
        'get_assessment_data',
        'search_knowledge_base',
      ]);
    });

    it('odmawia edycji planu, który już ruszył (409, bez replaceSteps)', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ status: 'executing' }));

      const res = await request(createApp())
        .patch('/api/ai/agent-plan/plan-1/steps')
        .send({ steps: [{ toolName: 'search_web', toolInput: {} }] });

      expect(res.status).toBe(409);
      expect(replaceSteps).not.toHaveBeenCalled();
    });

    it('404 dla planu z innej organizacji (bez replaceSteps)', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ organizationId: 'other-org' }));

      const res = await request(createApp())
        .patch('/api/ai/agent-plan/plan-1/steps')
        .send({ steps: [{ toolName: 'search_web', toolInput: {} }] });

      expect(res.status).toBe(404);
      expect(replaceSteps).not.toHaveBeenCalled();
    });

    it('odrzuca pustą listę kroków (400, walidacja przed getPlan)', async () => {
      // validateBody odrzuca zanim handler dotknie getPlan — nie mockujemy go,
      // żeby nie zostawić niekonsumowanego once w kolejce mocka.
      const res = await request(createApp())
        .patch('/api/ai/agent-plan/plan-1/steps')
        .send({ steps: [] });

      expect(res.status).toBe(400);
      expect(getPlan).not.toHaveBeenCalled();
      expect(replaceSteps).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/run — jawne "Uruchom" (AGT-009)', () => {
    it('dispatchuje plan czekający w planning (queueAdd wywołane, dispatch=enqueued)', async () => {
      // Guard i odczyt końcowy: oba getPlan zwracają planning — po samym enqueue
      // status realnie NIE zmienia się synchronicznie (worker ustawi executing
      // dopiero gdy podejmie job). Kluczem AGT-009 jest, że job trafił do kolejki.
      getPlan.mockResolvedValue(basePlan({ status: 'planning' }));
      queueAdd.mockResolvedValue(undefined);

      const res = await request(createApp()).post('/api/ai/agent-plan/plan-1/run').send({});

      expect(res.status).toBe(200);
      expect(res.body.dispatch).toBe('enqueued');
      expect(queueAdd).toHaveBeenCalledTimes(1);
      expect(queueAdd).toHaveBeenCalledWith(
        'AGENT_BACKGROUND_TASK',
        expect.objectContaining({
          payload: { planId: 'plan-1', organizationId: 'test-org', userId: 'test-user' },
        })
      );
      expect(replaceSteps).not.toHaveBeenCalled(); // brak steps => tylko dispatch
    });

    it('gdy podano steps: najpierw zapisuje przestawiony schemat, potem dispatch', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ status: 'planning' }));
      replaceSteps.mockResolvedValue(basePlan({ status: 'planning' }));
      queueAdd.mockResolvedValue(undefined);
      getPlan.mockResolvedValueOnce(basePlan({ status: 'executing' }));

      const res = await request(createApp())
        .post('/api/ai/agent-plan/plan-1/run')
        .send({ steps: [{ toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' } }] });

      expect(res.status).toBe(200);
      expect(replaceSteps).toHaveBeenCalledWith('plan-1', [
        { toolName: 'search_knowledge_base', toolInput: { phase: 'Wejście' } },
      ]);
      expect(queueAdd).toHaveBeenCalledTimes(1);
      expect(res.body.dispatch).toBe('enqueued');
    });

    it('odmawia uruchomienia planu, który już ruszył (409, bez dispatch)', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ status: 'executing' }));

      const res = await request(createApp()).post('/api/ai/agent-plan/plan-1/run').send({});

      expect(res.status).toBe(409);
      expect(queueAdd).not.toHaveBeenCalled();
      expect(replaceSteps).not.toHaveBeenCalled();
    });

    it('404 dla planu z innej organizacji (bez dispatch)', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ organizationId: 'other-org' }));

      const res = await request(createApp()).post('/api/ai/agent-plan/plan-1/run').send({});

      expect(res.status).toBe(404);
      expect(queueAdd).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/cancel', () => {
    it('cancels a plan owned by the caller org', async () => {
      getPlan.mockResolvedValueOnce(basePlan());
      cancelPlan.mockResolvedValue(undefined);
      getPlan.mockResolvedValueOnce(basePlan({ status: 'cancelled' }));

      const res = await request(createApp()).post('/api/ai/agent-plan/plan-1/cancel');

      expect(res.status).toBe(200);
      expect(cancelPlan).toHaveBeenCalledWith('plan-1');
      expect(res.body.plan.status).toBe('cancelled');
    });

    it('returns 404 for a plan in another org (no cancelPlan call)', async () => {
      getPlan.mockResolvedValueOnce(basePlan({ organizationId: 'other-org' }));

      const res = await request(createApp()).post('/api/ai/agent-plan/plan-1/cancel');

      expect(res.status).toBe(404);
      expect(cancelPlan).not.toHaveBeenCalled();
    });
  });
});
