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
 *                                                   (AGT-009: `draft:true` => plan zostaje w 'planning', bez dispatchu.
 *                                                   Decyzja Piotra 2026-07-23 (DOROBKA A): gdy `draft` NIE podano
 *                                                   jawnie, ścieżka generatora — `processId` obecne — domyślnie
 *                                                   liczy się jak `draft:true`; ścieżka katalogu — `manifestId` —
 *                                                   zostaje wstecznie zgodna, dispatch od razu.)
 * - GET    /api/ai/agent-plan                     -> lista planów (org + opcjonalnie user-scoped)
 * - GET    /api/ai/agent-plan/:id                 -> status planu (org-scoped)
 * - PATCH  /api/ai/agent-plan/:id/steps           -> AGT-009: zapis przestawionego schematu (tylko 'planning')
 * - POST   /api/ai/agent-plan/:id/run             -> AGT-009: jawne "Uruchom" (opc. zapis steps + dispatch).
 *                                                   M02-P16b: opc. body.idempotencyKey — retry/double-click z
 *                                                   TĄ SAMĄ wartością dostaje replay zamiast drugiego
 *                                                   replaceSteps + drugiego wpisu do kolejki (patrz
 *                                                   agentPlannerService.claimRunSubmission, migracja 942).
 * - POST   /api/ai/agent-plan/:id/approve-step    -> zatwierdzenie kroku awaiting_approval
 * - POST   /api/ai/agent-plan/:id/schedule        -> Harmonogram (Fala 1, 2026-07-26):
 *                                                   plan 'planning' -> 'scheduled'; dispatch robi
 *                                                   cron (server/src/jobs/agentPlanSchedulerJob.ts)
 *                                                   gdy `scheduled_at` minie, nie ten handler.
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
 * - HP-4 (F1 PlanBuilder — LANDED 2026-07-16): `manifestId` w ciele żądania
 *   jest WALIDOWANY względem istniejącego katalogu
 *   (discoveryAgentManifestCatalog). Gdy caller NIE poda `steps` explicite,
 *   ten router woła `buildPlanFromManifest(manifest)`
 *   (server/src/services/ai/agentPlan/planBuilderService.ts) — deterministyczne
 *   tłumaczenie manifestu na 3-4 kroki realnych narzędzi z `toolDefinitions.ts`
 *   (kurowane per manifest-id, z fallbackiem per `wave` dla manifestów bez
 *   kuracji, w tym `status: 'planned'`). Katalog wciąż jest summary-only —
 *   PlanBuilder NIE czyta z niego kroków (nie ma ich tam), tylko używa
 *   `id`/`wave`/`displayName` jako klucza do własnej tabeli playbooków.
 *   Caller może nadal podać `steps` explicite (np. do testów, albo gdy w
 *   przyszłości czat/LLM-planner wygeneruje własną listę) — jawne `steps`
 *   zawsze wygrywają nad wygenerowanymi z manifestu. Pełny Agent Builder
 *   (edycja definicji agenta) pozostaje HP-5, osobna, późniejsza fala
 *   (pytanie Q3 konceptu).
 */
import { Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { type AgentFolderScope, agentFolderService } from '../../services/ai/agentFolderService.js';
import { buildPlanFromManifest } from '../../services/ai/agentPlan/planBuilderService.js';
import {
  buildStepsFromProcess,
  listProcesses,
} from '../../services/ai/agentPlan/processLibraryService.js';
import { agentPlannerService } from '../../services/ai/agentPlannerService.js';
import { getDiscoveryAgentManifest } from '../../services/ai/agentRuntime/discoveryAgentManifestCatalog.js';
import contextDocumentService from '../../services/organizationContext/ContextDocumentService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.use(verifyToken);

const AGENT_FOLDER_SCOPES: AgentFolderScope[] = ['user', 'project', 'organization'];

const parseAgentFolderScope = (value: unknown): AgentFolderScope | null => {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (AGENT_FOLDER_SCOPES as string[]).includes(s) ? (s as AgentFolderScope) : null;
};

/**
 * Projekty, w których dany user jest członkiem — do domyślnego widoku
 * folderów agenta i filtra scope=project. Kopia `getMemberProjectIds`
 * (knowledge.routes.ts) — ta sama zapytanie, inny plik routera (żaden z tych
 * routerów nie eksportuje pomocników drugiemu, wzór powtórzony jak w reszcie
 * repo — patrz np. `parseVaultScope` vs ten `parseAgentFolderScope`).
 */
async function getMemberProjectIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const rows = await DbPromise.all<{ project_id: string }>(
    `SELECT project_id FROM project_members WHERE user_id = ?`,
    [userId]
  );
  return (rows || []).map((r) => String(r.project_id)).filter(Boolean);
}

const MAX_STEPS_PER_PLAN = 12; // koncept sekcja 1 "Limity (twarde)" — F6 doda timeout/budżet realny

const PlanStepInputSchema = z.object({
  toolName: z.string().trim().min(1).max(120),
  toolInput: z.record(z.string(), z.unknown()).default({}),
  // DOROBKA C (2026-07-23, decyzja Piotra): jawny override bramki akceptu —
  // patrz komentarz przy `agentPlannerService.createPlan`. Opcjonalny; gdy
  // pominięty, requiresApproval liczone jak dotąd z SIDE_EFFECT_TOOLS.
  requiresApproval: z.boolean().optional(),
});

const CreatePlanRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    conversationId: z.string().trim().max(200).optional(),
    manifestId: z.string().trim().max(120).optional(),
    // AGT-006 (partia 2): generator PROCESU konsultingowego. Gdy podany (i brak
    // explicit `steps`), ProcessLibrary kładzie cały schemat procesu — domyślny
    // `classic-5` (5 faz Kubr/ILO) lub wariant `drd` (4 kroki). Kontekst
    // dostrajający (opcjonalny) modyfikuje toolInput faz bez zmiany ich liczby.
    processId: z.string().trim().max(60).optional(),
    processContext: z
      .object({
        focusAxis: z.string().trim().max(120).optional(),
        industry: z.string().trim().max(120).optional(),
        hasVaultDocs: z.boolean().optional(),
        projectSummary: z.string().trim().max(500).optional(),
      })
      .optional(),
    // Optional now: when omitted and manifestId is set, PlanBuilder generates
    // the steps (see header comment). Still capped at MAX_STEPS_PER_PLAN when provided explicitly.
    steps: z.array(PlanStepInputSchema).max(MAX_STEPS_PER_PLAN).optional(),
    // AGT-009 (partia 2) + decyzja Piotra 2026-07-23 (DOROBKA A): rozdział
    // tworzenia od uruchomienia. Gdy `draft:true` (jawnie), router TWORZY
    // plan (zostaje w 'planning'), ale NIE zleca wykonania w tle — schemat
    // czeka na jawne "Uruchom" (POST /:id/run). Jawne `draft:false` wymusza
    // natychmiastowy dispatch niezależnie od ścieżki. Gdy `draft` NIE podano
    // wcale: ścieżka GENERATORA procesu (`processId` obecne) domyślnie liczy
    // się jak `draft:true` — ① AI kładzie schemat (np. classic-5) → user
    // przestawia klocki → dopiero jawne "Uruchom" dispatchuje. Ścieżka
    // KATALOGU (`manifestId`) i jawne `steps` bez `processId` zostają
    // wstecznie zgodne — natychmiastowy best-effort dispatch jak dotąd.
    draft: z.boolean().optional(),
  })
  .refine(
    (body) =>
      Boolean(body.manifestId) || Boolean(body.processId) || (body.steps && body.steps.length > 0),
    {
      message:
        'Either manifestId, processId (to auto-generate steps) or a non-empty steps array is required',
      path: ['steps'],
    }
  );

/** Best-effort background dispatch — nigdy nie wysadza żądania HTTP (default: background, patrz nagłówek pliku). */
async function tryDispatchBackgroundExecution(payload: {
  planId: string;
  organizationId: string;
  userId: string;
}): Promise<'enqueued' | 'unavailable'> {
  try {
    const { default: aiQueue } = (await import('../../queues/aiQueue.js')) as {
      default: { add: (name: string, data: unknown) => Promise<unknown> };
    };
    await agentPlannerService.executeGovernedEnqueue({
      ...payload,
      dispatchKey: `route:${payload.planId}`,
      enqueue: () =>
        aiQueue.add('AGENT_BACKGROUND_TASK', {
          taskType: 'AGENT_BACKGROUND_TASK',
          payload,
          userId: payload.userId,
        }),
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

function canAccessPlan(
  plan: NonNullable<Awaited<ReturnType<typeof agentPlannerService.getPlan>>>,
  req: AuthRequest
): boolean {
  const userId = req.user?.id;
  // `req.user.role` is the UI-facing mapped role (ADMIN -> administrator).
  // Authorization must use the canonical membership/JWT role resolved by auth.
  const role = String(req.userRole || req.user?.role || '').toUpperCase();
  return plan.userId === userId || ['OWNER', 'ADMIN', 'SUPERADMIN'].includes(role);
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

    // steps resolution order: explicit caller-provided steps win; otherwise,
    // when manifestId is set, PlanBuilder generates them from the manifest
    // (F1, 2026-07-16); otherwise, when processId is set, ProcessLibrary lays
    // down a whole consulting process (AGT-006 — default classic-5, variant drd).
    let steps = body.steps;

    if (body.manifestId) {
      const manifest = getDiscoveryAgentManifest(body.manifestId);
      if (!manifest) {
        return res.status(400).json({ success: false, error: 'Unknown manifestId' });
      }
      // referencyjna walidacja — nie blokujemy 'planned', tylko oznaczamy w logu.
      if (manifest.status !== 'built') {
        logger.warn('[AgentPlanRoutes] Plan referencing a non-built manifest', {
          manifestId: body.manifestId,
          status: manifest.status,
        });
      }
      if (!steps || steps.length === 0) {
        const generated = buildPlanFromManifest(manifest);
        // Punkt 10 (odbiór AGT-010/011, 2026-07-24): plany z KATALOGU manifestów
        // nie niosły `toolInput.phase` — `readablePhaseName()` (frontend,
        // AgentPlanPanel.tsx/planBuilderService konwersja bloków) spada wtedy na
        // surowy `toolName` (np. `search_knowledge_base`, `calculate_financial`).
        // Generator procesu (processLibraryService.buildExecutableSteps) już
        // wstrzykuje czytelną nazwę do `toolInput.phase` — tu robimy to samo z
        // `rationale`, które PlanBuilder liczy per-krok już DZIŚ (human-readable,
        // np. "Growth Paths (Ansoff): gather context on current growth strategy
        // options") ale dotąd gubiło się w mapowaniu do `{toolName, toolInput}`.
        steps = generated.map(({ toolName, toolInput, rationale }) => ({
          toolName,
          toolInput: { ...toolInput, phase: rationale },
        }));
        logger.info('[AgentPlanRoutes] PlanBuilder generated steps from manifest', {
          manifestId: body.manifestId,
          stepCount: steps.length,
        });
      }
    }

    // AGT-006: process generator — only when no explicit steps and no manifest
    // resolved them. Default schema = classic-5 (5 phases Kubr/ILO); drd = variant.
    // DOROBKA C: requiresApproval passed through — ProcessLibrary phases carry
    // an explicit override for phases that need a gate beyond SIDE_EFFECT_TOOLS
    // (e.g. "Rekomendacje"); createPlan honours it over its own computation.
    if ((!steps || steps.length === 0) && body.processId) {
      const generated = buildStepsFromProcess(body.processId, body.processContext);
      steps = generated.map(({ toolName, toolInput, requiresApproval }) => ({
        toolName,
        toolInput,
        requiresApproval,
      }));
      logger.info('[AgentPlanRoutes] ProcessLibrary generated steps from process', {
        processId: body.processId,
        stepCount: steps.length,
      });
    }

    if (!steps || steps.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'No steps could be resolved for this plan' });
    }
    if (steps.length > MAX_STEPS_PER_PLAN) {
      steps = steps.slice(0, MAX_STEPS_PER_PLAN);
    }

    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      conversationId: body.conversationId,
      title: body.title,
      description: body.description,
      steps,
      isBackground: true, // HP-4 default (Piotr decision pending): background, patrz nagłówek pliku
    });

    // AGT-009 + decyzja Piotra 2026-07-23 (DOROBKA A): jawne `draft` zawsze
    // wygrywa. Gdy nie podano jawnie, ścieżka GENERATORA (`processId` obecne)
    // domyślnie NIE dispatchuje — plan zostaje w 'planning' do jawnego
    // "Uruchom" (① AI kładzie schemat ② user przestawia klocki ③ dopiero wtedy
    // dispatch). Ścieżka katalogu (`manifestId`) i jawne `steps` BEZ ZMIAN —
    // dispatch od razu, wstecznie zgodnie z HP-4.
    const effectiveDraft = body.draft ?? Boolean(body.processId);
    const dispatch: 'enqueued' | 'unavailable' | 'deferred' = effectiveDraft
      ? 'deferred'
      : await tryDispatchBackgroundExecution({
          planId: plan.id,
          organizationId,
          userId,
        });

    return res.status(201).json({ success: true, plan, dispatch });
  })
);

/**
 * PATCH /api/ai/agent-plan/:id/steps
 * AGT-009 (partia 2): zapis przestawionego/edytowanego schematu na planie, który
 * jest jeszcze w 'planning' (przed "Uruchom"). Nadpisuje CAŁĄ listę kroków w
 * podanej kolejności (canvas AgentPlanCanvas.tsx). Guard: plan musi być
 * 'planning' (inaczej 409). Nie zleca wykonania — to robi dopiero POST /:id/run.
 */
router.patch(
  '/:id/steps',
  validateBody(z.object({ steps: z.array(PlanStepInputSchema).min(1).max(MAX_STEPS_PER_PLAN) })),
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
    if (!canAccessPlan(existingPlan, req)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    if (existingPlan.status !== 'planning') {
      return res.status(409).json({
        success: false,
        error: `Plan not editable in status '${existingPlan.status}' (only 'planning')`,
      });
    }

    const { steps } = req.body as {
      steps: Array<{ toolName: string; toolInput: Record<string, unknown> }>;
    };

    const plan = await agentPlannerService.replaceSteps(planId, steps);
    return res.json({ success: true, plan });
  })
);

/**
 * POST /api/ai/agent-plan/:id/run
 * AGT-009 (partia 2): jawne "Uruchom" — dispatch planu, który czeka w 'planning'
 * (utworzonego z `draft:true`). Opcjonalnie przyjmuje `steps` — wtedy najpierw
 * zapisuje ostateczny przestawiony schemat (replaceSteps), potem zleca wykonanie
 * w tle. Jednym żądaniem domyka ścieżkę canvas → "Uruchom" (zapis + dispatch).
 * Guard: plan musi być 'planning' (inaczej 409 — już ruszył albo terminalny).
 */
router.post(
  '/:id/run',
  validateBody(
    z.object({
      steps: z.array(PlanStepInputSchema).min(1).max(MAX_STEPS_PER_PLAN).optional(),
      // M02-P16b: opt-in request-bound idempotency key. A caller that sends
      // no key gets exactly the pre-existing behavior (unchanged). A caller
      // that sends the SAME key on a retry (double-click, network retry
      // before the response arrived) gets an idempotent replay instead of a
      // second steps-replace + a second background-queue enqueue. See
      // `agentPlannerService.claimRunSubmission` for the CAS this backs.
      idempotencyKey: z.string().trim().min(1).max(200).optional(),
    })
  ),
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
    if (!canAccessPlan(existingPlan, req)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { steps, idempotencyKey } = req.body as {
      steps?: Array<{ toolName: string; toolInput: Record<string, unknown> }>;
      idempotencyKey?: string;
    };

    if (existingPlan.status !== 'planning') {
      // A retry of the EXACT submission that already moved this plan past
      // 'planning' is not an error — replay instead of surfacing a 409 for
      // what is, from the client's perspective, the same run request.
      if (idempotencyKey && existingPlan.runIdempotencyKey === idempotencyKey) {
        return res.json({ success: true, plan: existingPlan, dispatch: 'idempotent-replay' });
      }
      return res.status(409).json({
        success: false,
        error: `Plan not runnable in status '${existingPlan.status}' (only 'planning')`,
      });
    }

    if (idempotencyKey) {
      const claim = await agentPlannerService.claimRunSubmission(planId, idempotencyKey);
      if (claim === 'already-mine') {
        // Same key, still 'planning': the earlier winning request is (or
        // was) in flight between claiming and dispatch. Do not re-run
        // replaceSteps or enqueue a second background job.
        const plan = (await agentPlannerService.getPlan(planId)) ?? existingPlan;
        return res.json({ success: true, plan, dispatch: 'idempotent-replay' });
      }
      if (claim === 'conflict') {
        return res.status(409).json({
          success: false,
          error: 'Plan run already claimed by a different submission',
        });
      }
      // claim === 'claimed' -> this request alone proceeds below.
    }

    if (steps && steps.length > 0) {
      await agentPlannerService.replaceSteps(planId, steps);
    }

    const dispatch = await tryDispatchBackgroundExecution({
      planId,
      organizationId,
      userId: existingPlan.userId,
    });

    if (idempotencyKey && dispatch === 'unavailable') {
      // Dispatch never even reached the queue: release the claim so a
      // deliberate later retry (fresh key or same key) is not permanently
      // blocked by a submission that never actually ran.
      await agentPlannerService.releaseRunSubmissionClaim(planId, idempotencyKey);
    }

    const plan = (await agentPlannerService.getPlan(planId)) ?? existingPlan;

    return res.json({ success: true, plan, dispatch });
  })
);

/**
 * POST /api/ai/agent-plan/:id/schedule
 * Harmonogram (Fala 1, 2026-07-26): plan gotowy w 'planning' -> 'scheduled'
 * z konkretnym `scheduledAt` (ISO). NIE dispatchuje — cron
 * (`server/src/jobs/agentPlanSchedulerJob.ts`, co 2 min) odbiera go, gdy czas
 * minie. `scheduledAt` w przeszłości jest dozwolone celowo — cron i tak
 * odbierze go przy najbliższym ticku (prostsze niż walidacja "musi być w
 * przyszłości", a UI (date-time input) i tak nie pozwala wybrać przeszłości).
 */
router.post(
  '/:id/schedule',
  validateBody(z.object({ scheduledAt: z.string().trim().min(1) })),
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
    if (!canAccessPlan(existingPlan, req)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { scheduledAt } = req.body as { scheduledAt: string };

    try {
      const plan = await agentPlannerService.schedulePlan(planId, scheduledAt);
      return res.json({ success: true, plan });
    } catch (error: unknown) {
      logger.warn('[agent-plan] schedulePlan rejected', { err: error, planId });
      return res.status(409).json({
        success: false,
        error: error instanceof Error ? error.message : 'Plan not schedulable',
      });
    }
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

    const role = String(req.user?.role || '').toUpperCase();
    const privileged = ['OWNER', 'ADMIN', 'SUPERADMIN'].includes(role);
    const mineOnly = String(req.query?.mine || '') === '1' || !privileged;
    const plans = await agentPlannerService.listPlans(
      organizationId,
      mineOnly ? userId : undefined
    );

    return res.json({ success: true, total: plans.length, plans });
  })
);

/**
 * GET /api/ai/agent-plan/processes
 * AGT-011: biblioteka procesów (ProcessLibrary) do zakładki "Szablony" —
 * `classic-5` (domyślny, 5 faz Kubr/ILO) + wariant `drd` (4 kroki). Musi być
 * zarejestrowany PRZED `GET /:id` (inaczej Express dopasuje 'processes' jako
 * `:id`). Read-only, bez organizationId-scope — to statyczna biblioteka, nie
 * dane usera.
 */
router.get(
  '/processes',
  asyncHandler(async (_req: AuthRequest, res) => {
    const processes = listProcesses();
    return res.json({ success: true, total: processes.length, processes });
  })
);

/**
 * AGT-FOLDERS (2026-07-28) — foldery dla "Moje procesy" (patrz
 * `agentFolderService.ts`, WZÓR 1:1 `knowledge.routes.ts` "/vault-folders").
 * Zarejestrowane PRZED `GET /:id` z tego samego powodu co `/processes`
 * powyżej (Express dopasowałby literal 'folders' jako `:id`).
 *
 * GET    /folders?scope=&project_id=  — lista folderów widocznych dla usera
 * POST   /folders                     — nowy folder (scope wymagany)
 * PUT    /folders/:folderId           — rename/opis/kolor — TYLKO twórca
 * DELETE /folders/:folderId           — usuń — TYLKO twórca; plany zostają, odpięte
 */
router.get(
  '/folders',
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const requestedScope = parseAgentFolderScope(req.query.scope);
    const requestedProjectId =
      typeof req.query.project_id === 'string' && req.query.project_id.trim()
        ? req.query.project_id.trim()
        : null;

    if (requestedScope === 'project' && requestedProjectId && userId) {
      const canAccess = await contextDocumentService.canAccessProject({
        organizationId: orgId,
        userId,
        projectId: requestedProjectId,
        userRole: req.user?.role || 'USER',
      });
      if (!canAccess)
        return res.status(403).json({ success: false, error: 'Brak dostępu do projektu' });
    }

    try {
      const memberProjectIds = userId ? await getMemberProjectIds(userId) : [];
      const folders = await agentFolderService.getFolders(orgId, userId, {
        scope: requestedScope,
        projectId: requestedProjectId,
        memberProjectIds,
      });
      return res.json({
        success: true,
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description ?? null,
          color: f.color ?? null,
          scope: f.scope,
          projectId: f.project_id ?? null,
          ownerId: f.owner_id,
          parentFolderId: f.parent_folder_id ?? null,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
      });
    } catch (err: unknown) {
      logger.error('[AgentPlanRoutes] Get folders failed', { err });
      return res.status(500).json({ success: false, error: 'Nie udało się pobrać folderów' });
    }
  })
);

router.post(
  '/folders',
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const scope = parseAgentFolderScope(req.body?.scope);
    if (!scope) {
      return res
        .status(400)
        .json({ success: false, error: 'scope is required (user|project|organization)' });
    }

    const rawProjectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.trim()
        ? req.body.projectId.trim()
        : null;

    if (scope === 'project') {
      if (!rawProjectId) {
        return res
          .status(400)
          .json({ success: false, error: 'projectId wymagany dla scope=project' });
      }
      const canAccess = await contextDocumentService.canAccessProject({
        organizationId: orgId,
        userId,
        projectId: rawProjectId,
        userRole: req.user?.role || 'USER',
      });
      if (!canAccess)
        return res.status(403).json({ success: false, error: 'Brak dostępu do projektu' });
    }

    try {
      const created = await agentFolderService.createFolder(orgId, userId, {
        name,
        description: typeof req.body?.description === 'string' ? req.body.description : null,
        color: req.body?.color ? String(req.body.color) : null,
        parentFolderId: req.body?.parentFolderId ? String(req.body.parentFolderId) : null,
        scope,
        projectId: scope === 'project' ? rawProjectId : null,
      });
      return res.status(201).json({
        success: true,
        id: created.id,
        name: created.name,
        description: created.description,
        color: created.color,
        scope: created.scope,
        projectId: created.project_id,
        ownerId: created.owner_id,
        parentFolderId: created.parent_folder_id,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      });
    } catch (err: unknown) {
      logger.error('[AgentPlanRoutes] Create folder failed', { err });
      return res.status(500).json({ success: false, error: 'Nie udało się utworzyć folderu' });
    }
  })
);

router.put(
  '/folders/:folderId',
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { folderId } = req.params;
    const { name, description, color, parentFolderId } = req.body || {};
    try {
      const result = await agentFolderService.updateFolder(orgId, userId, folderId, {
        name: typeof name === 'string' ? name : undefined,
        description: description !== undefined ? description : undefined,
        color: color !== undefined ? color : undefined,
        parentFolderId: parentFolderId !== undefined ? parentFolderId : undefined,
      });
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      logger.error('[AgentPlanRoutes] Update folder failed', { err });
      return res.status(500).json({ success: false, error: 'Nie udało się zaktualizować folderu' });
    }
  })
);

router.delete(
  '/folders/:folderId',
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { folderId } = req.params;
    try {
      const result = await agentFolderService.deleteFolder(orgId, userId, folderId);
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      logger.error('[AgentPlanRoutes] Delete folder failed', { err });
      return res.status(500).json({ success: false, error: 'Nie udało się usunąć folderu' });
    }
  })
);

/**
 * PATCH /api/ai/agent-plan/:id/folder
 * AGT-FOLDERS: przenosi plan do folderu (kebab "Przenieś do folderu",
 * wzór `PUT /documents/:id` scope-move w Vault). `folderId: null` odpina.
 */
router.patch(
  '/:id/folder',
  validateBody(z.object({ folderId: z.string().trim().min(1).nullable() })),
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
    if (!canAccessPlan(existingPlan, req)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { folderId } = req.body as { folderId: string | null };
    await agentPlannerService.setFolder(planId, organizationId, folderId);
    const plan = (await agentPlannerService.getPlan(planId)) ?? existingPlan;

    return res.json({ success: true, plan });
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
    if (!canAccessPlan(plan, req)) {
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
    if (!canAccessPlan(existingPlan, req)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { stepIndex } = req.body as { stepIndex: number };

    try {
      await agentPlannerService.approveStep(planId, stepIndex, userId);
    } catch (error: unknown) {
      logger.warn('[agent-plan] approveStep rejected', { err: error, planId, stepIndex });
      return res.status(409).json({
        success: false,
        error: 'Step not awaiting approval',
      });
    }

    const dispatch = await tryDispatchBackgroundExecution({
      planId,
      organizationId,
      userId: existingPlan.userId,
    });
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
    if (!canAccessPlan(existingPlan, req)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    await agentPlannerService.cancelPlan(planId);
    const plan = await agentPlannerService.getPlan(planId);

    return res.json({ success: true, plan });
  })
);

export default router;
