/**
 * Agent Plan Routes (HP-4 fundament — "Uruchom agenta z Teresy", tryb Plan).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_KONCEPT_HP4_AGENT_W_TERESIE.md
 * (sekcja 2 "Architektura wpięcia BEZ dotykania 9000-liniowego pipeline",
 * zadanie F2 tabeli §4). Ten plik jest CIENKI z rozmysłem — cały kręgosłup
 * (persystencja, statusy, checkpointy, SSE-emitter) już istnieje w
 * `agentPlannerService` (server/src/services/ai/agentPlannerService.ts,
 * migracja 672 — `ai_agent_plans`/`ai_agent_plan_steps`). Router NIE buduje
 * nowego executora — deleguje w 100% do serwisu i do `executeToolCall`
 * (server/src/services/ai/toolDefinitions.ts), tego samego rejestru narzędzi
 * którego używa czat Teresy.
 *
 * Endpoints:
 * - POST   /api/ai/agent-plan                    -> utworzenie planu (deleguje agentPlannerService.createPlan)
 * - GET    /api/ai/agent-plan                     -> lista planów (org + opcjonalnie user-scoped)
 * - GET    /api/ai/agent-plan/:id                 -> status planu (org-scoped)
 * - POST   /api/ai/agent-plan/:id/approve-step    -> zatwierdzenie kroku awaiting_approval
 * - POST   /api/ai/agent-plan/:id/cancel          -> przerwanie planu
 *
 * Linia montażu (integrator, NIE ten plik): dopisać w
 * `server/src/routes/ai/index.ts`:
 *   import agentPlanRoutes from './agent-plan.routes.js';
 *   router.use('/agent-plan', agentPlanRoutes);
 * Za flagą `ff_agentPlan` (patrz src/utils/agentPlanFlag.ts) — montaż
 * backendu może być bit-identyczny (route istnieje, ale front nigdy go nie
 * woła przy OFF); frontend-facing zachowanie sterowane wyłącznie flagą.
 *
 * Semantyka DOMYŚLNA (Piotr jeszcze nie odpowiedział na 3 pytania konceptu —
 * patrz sekcja 5 dokumentu; poniższe są ROZSĄDNYMI DOMYŚLNYMI, zmienialne):
 * - HP-4 default (Piotr decision pending): fail-fast — błąd kroku zatrzymuje
 *   cały plan (status 'failed'), tak jak dziś robi `agentPlannerService.executePlan`.
 *   Nie dodajemy tu trybu "pomiń i kontynuuj" (pytanie Q1 konceptu).
 * - HP-4 default (Piotr decision pending): background — wykonanie planu NIE
 *   blokuje żądania HTTP. `POST /` i `POST /:id/approve-step` tworzą/wznawiają
 *   plan i próbują (best-effort) zlecić wykonanie w tle przez istniejącą
 *   kolejkę `ai-tasks` (job `AGENT_BACKGROUND_TASK`, patrz
 *   `server/src/workers/aiWorker.ts:81-85`, już woła
 *   `agentPlannerService.executeBackgroundPlan`). Gdy kolejka niedostępna
 *   (np. MOCK_REDIS=true w testach/dev) — nie wysadzamy żądania, plan zostaje
 *   w stanie 'planning'/'awaiting_approval' do ręcznego/testowego wykonania
 *   (pytanie Q2 konceptu — "na żywo z SSE" to zadanie 2, tu tylko szkielet).
 * - HP-4 default (Piotr decision pending): manifest-only — `manifestId` w
 *   ciele żądania jest WALIDOWANY względem istniejącego katalogu
 *   (discoveryAgentManifestCatalog, status 'built') tylko jako referencja/etykieta
 *   planu. Ten fundament NIE generuje kroków z manifestu (katalog jest
 *   summary-only, bez `steps` — patrz komentarz w pliku katalogu) i NIE
 *   zawiera pełnego Agent Buildera (edycja definicji agenta) — to HP-5,
 *   osobna, późniejsza fala (pytanie Q3 konceptu). Kroki planu podaje
 *   wywołujący explicite (`steps: [{toolName, toolInput}]`) — przyszły
 *   `PlanBuilder` (zadanie F1 konceptu) wstawi się w to samo miejsce.
 */
import { Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { getDiscoveryAgentManifest } from '../../services/ai/agentRuntime/discoveryAgentManifestCatalog.js';
import { agentPlannerService } from '../../services/ai/agentPlannerService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.use(verifyToken);

const MAX_STEPS_PER_PLAN = 12; // koncept sekcja 1 "Limity (twarde)" — F6 doda timeout/budżet realny

const PlanStepInputSchema = z.object({
  toolName: z.string().trim().min(1).max(120),
  toolInput: z.record(z.string(), z.unknown()).default({}),
});

const CreatePlanRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  conversationId: z.string().trim().max(200).optional(),
  manifestId: z.string().trim().max(120).optional(),
  steps: z.array(PlanStepInputSchema).min(1).max(MAX_STEPS_PER_PLAN),
});

/** Best-effort background dispatch — nigdy nie wysadza żądania HTTP (default: background, patrz nagłówek pliku). */
async function tryDispatchBackgroundExecution(payload: {
  planId: string;
  organizationId: string;
  userId: string;
}): Promise<'enqueued' | 'unavailable'> {
  try {
    const { default: aiQueue } = await import('../../queues/aiQueue.js');
    await aiQueue.add('AGENT_BACKGROUND_TASK', {
      taskType: 'AGENT_BACKGROUND_TASK',
      payload,
      userId: payload.userId,
    });
    return 'enqueued';
  } catch (error: unknown) {
    logger.warn('[AgentPlanRoutes] Background dispatch unavailable, plan left pending', {
      planId: payload.planId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'unavailable';
  }
}

/** Org-scope guard: 404 (not 403) to avoid leaking plan existence across orgs. */
function assertPlanInOrg(
  plan: Awaited<ReturnType<typeof agentPlannerService.getPlan>>,
  organizationId: string
): plan is NonNullable<typeof plan> {
  return Boolean(plan) && plan!.organizationId === organizationId;
}

/**
 * POST /api/ai/agent-plan
 * Tworzy plan (agentPlannerService.createPlan) i zleca wykonanie w tle (best-effort).
 */
router.post(
  '/',
  validateBody(CreatePlanRequestSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const body = req.body as z.infer<typeof CreatePlanRequestSchema>;

    if (body.manifestId) {
      const manifest = getDiscoveryAgentManifest(body.manifestId);
      if (!manifest) {
        return res.status(400).json({ success: false, error: 'Unknown manifestId' });
      }
      // HP-4 default (manifest-only): referencyjna walidacja, katalog nie dostarcza
      // kroków (summary-only) — nie blokujemy 'planned', tylko oznaczamy w opisie.
      if (manifest.status !== 'built') {
        logger.warn('[AgentPlanRoutes] Plan referencing a non-built manifest', {
          manifestId: body.manifestId,
          status: manifest.status,
        });
      }
    }

    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      conversationId: body.conversationId,
      title: body.title,
      description: body.description,
      steps: body.steps,
      isBackground: true, // HP-4 default (Piotr decision pending): background, patrz nagłówek pliku
    });

    const dispatch = await tryDispatchBackgroundExecution({
      planId: plan.id,
      organizationId,
      userId,
    });

    return res.status(201).json({ success: true, plan, dispatch });
  })
);

/**
 * GET /api/ai/agent-plan
 * Lista planów (org-scoped; ?mine=1 zawęża do bieżącego usera).
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const mineOnly = String(req.query?.mine || '') === '1';
    const plans = await agentPlannerService.listPlans(organizationId, mineOnly ? userId : undefined);

    return res.json({ success: true, total: plans.length, plans });
  })
);

/**
 * GET /api/ai/agent-plan/:id
 * Status planu (org-scoped).
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const plan = await agentPlannerService.getPlan(String(req.params.id || ''));
    if (!assertPlanInOrg(plan, organizationId)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    return res.json({ success: true, plan });
  })
);

/**
 * POST /api/ai/agent-plan/:id/approve-step
 * Zatwierdza krok w stanie awaiting_approval, po czym próbuje wznowić
 * wykonanie w tle (best-effort — patrz tryDispatchBackgroundExecution).
 */
router.post(
  '/:id/approve-step',
  validateBody(z.object({ stepIndex: z.number().int().min(0) })),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const planId = String(req.params.id || '');
    const existingPlan = await agentPlannerService.getPlan(planId);
    if (!assertPlanInOrg(existingPlan, organizationId)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { stepIndex } = req.body as { stepIndex: number };

    try {
      await agentPlannerService.approveStep(planId, stepIndex, userId);
    } catch (error: unknown) {
      return res.status(409).json({
        success: false,
        error: error instanceof Error ? error.message : 'Step not awaiting approval',
      });
    }

    const dispatch = await tryDispatchBackgroundExecution({ planId, organizationId, userId });
    const plan = await agentPlannerService.getPlan(planId);

    return res.json({ success: true, plan, dispatch });
  })
);

/**
 * POST /api/ai/agent-plan/:id/cancel
 * Przerywa plan (agentPlannerService.cancelPlan) — kroki pending/awaiting_approval -> skipped.
 */
router.post(
  '/:id/cancel',
  asyncHandler(async (req: AuthRequest, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const planId = String(req.params.id || '');
    const existingPlan = await agentPlannerService.getPlan(planId);
    if (!assertPlanInOrg(existingPlan, organizationId)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    await agentPlannerService.cancelPlan(planId);
    const plan = await agentPlannerService.getPlan(planId);

    return res.json({ success: true, plan });
  })
);

export default router;
