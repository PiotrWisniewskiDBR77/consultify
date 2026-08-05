/**
 * Agent Plan API client (HP-4 fundament — "Uruchom agenta z Teresy", tryb Plan).
 *
 * Thin wrapper over `/api/ai/agent-plan/*`
 * (server/src/routes/ai/agent-plan.routes.ts). Server-side delegates fully to
 * `agentPlannerService` (the existing plan→execute→observe kręgosłup) — this
 * client only shapes the HTTP calls, no local execution logic.
 *
 * Fundament note: this module is NOT yet imported anywhere in the app shell —
 * it exists so `AgentPlanPanel` (src/components/AIChat/AgentPlanPanel.tsx) has
 * a real client to call once wired behind `ff_agentPlan`
 * (src/utils/agentPlanFlag.ts). Chat→plan integration is a separate task
 * (concept §2 "Minimalna zmiana w czacie").
 */
import { API_URL, getHeaders, handleResponse } from './baseClient';

export type AgentPlanStatus =
  | 'planning'
  // Harmonogram (Fala 1, 2026-07-26): plan gotowy w 'planning', czeka na
  // scheduledAt zamiast na jawne "Uruchom" — patrz `scheduleAgentPlan` niżej.
  | 'scheduled'
  | 'awaiting_approval'
  | 'executing'
  | 'paused'
  | 'completed'
  // Continue-on-error (Piotr decision 07-16): a plan that ran to the end but
  // had 1+ failing steps lands here, never in 'failed' — see
  // agentPlannerService.executePlan's header comment for the full rationale.
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type AgentPlanStepStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AgentPlanStep {
  id: string;
  stepIndex: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: AgentPlanStepStatus;
  result?: unknown;
  errorMessage?: string;
  requiresApproval: boolean;
  durationMs?: number;
}

export interface AgentPlan {
  id: string;
  organizationId: string;
  conversationId?: string;
  userId: string;
  title: string;
  description?: string;
  status: AgentPlanStatus;
  steps: AgentPlanStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  resultSummary?: string;
  errorMessage?: string;
  isBackground: boolean;
  createdAt: string;
  /** Kolumny huba (2026-07-28) — patrz `agentPlannerService.ts` AgentPlan dla pochodzenia. */
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  /** AGT-FOLDERS (2026-07-28): folder w "Moje procesy", null/undefined = bez folderu. */
  folderId?: string | null;
}

/**
 * Krok wysyłany do backendu (`PlanStepInputSchema`
 * w server/src/routes/ai/agent-plan.routes.ts).
 *
 * `requiresApproval` to JAWNY override bramki akceptu (DOROBKA C 2026-07-23):
 * gdy pominięty, backend liczy go z `SIDE_EFFECT_TOOLS`; gdy podany, wygrywa.
 * Warsztat agenta wysyła `true` dla klocków „Zgoda (bramka)" i „Automat" —
 * pisarze My Work (`create_task`/`update_task`/`create_decision`) NIE są w
 * `SIDE_EFFECT_TOOLS`, więc bez tego wykonałyby się bez pytania użytkownika.
 */
export interface AgentPlanStepPayload {
  toolName: string;
  toolInput: Record<string, unknown>;
  requiresApproval?: boolean;
}

export interface CreateAgentPlanInput {
  title: string;
  description?: string;
  conversationId?: string;
  manifestId?: string;
  /**
   * AGT-006/AGT-010: generator PROCESU konsultingowego (nie katalogu
   * manifestów) — `classic-5` (domyślny, 5 faz Kubr/ILO) lub wariant `drd`.
   * Backend (agent-plan.routes.ts) kładzie cały schemat via ProcessLibrary.
   * Gdy `draft` nie podano jawnie, ta ścieżka domyślnie liczy się jak
   * `draft:true` (plan zostaje w 'planning' do jawnego "Uruchom").
   */
  processId?: string;
  processContext?: {
    focusAxis?: string;
    industry?: string;
    hasVaultDocs?: boolean;
    projectSummary?: string;
  };
  /**
   * Optional when `manifestId` is set — the backend's PlanBuilder
   * (server/src/services/ai/agentPlan/planBuilderService.ts) generates the
   * step list from the manifest. Provide explicit steps to override.
   */
  steps?: Array<{ toolName: string; toolInput: Record<string, unknown> }>;
  /**
   * AGT-009: gdy `true`, backend tworzy plan (zostaje w 'planning') ale NIE
   * zleca wykonania — schemat czeka na jawne `runAgentPlan` ("Uruchom"). To
   * ścieżka generatora procesu: ① AI kładzie schemat → user przestawia klocki
   * → dopiero wtedy dispatch. Bez tej flagi zachowanie jest jak dotąd.
   */
  draft?: boolean;
}

/**
 * AGT-009: 'deferred' dochodzi do wyników dispatchu, gdy plan utworzono jako draft.
 * M02-P16b: 'idempotent-replay' — TYLKO z `runAgentPlan`, gdy retry z tym
 * samym `idempotencyKey` trafił na już-w-toku/już-zakończoną submisję (patrz
 * komentarz przy `runAgentPlan` niżej) — front NIE nadpisał wtedy kroków ani
 * nie wysłał drugiego dispatchu.
 */
export type AgentPlanDispatch = 'enqueued' | 'unavailable' | 'deferred' | 'idempotent-replay';

export async function createAgentPlan(
  input: CreateAgentPlanInput
): Promise<{ plan: AgentPlan; dispatch: AgentPlanDispatch }> {
  const res = await fetch(`${API_URL}/ai/agent-plan`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse<{ plan: AgentPlan; dispatch: AgentPlanDispatch }>(
    res,
    'Failed to create agent plan'
  );
}

/**
 * AGT-009: zapis przestawionego/edytowanego schematu na planie w 'planning'
 * (PATCH /:id/steps). Nadpisuje całą listę kroków w podanej kolejności. NIE
 * uruchamia planu — to robi `runAgentPlan`.
 */
export async function updateAgentPlanSteps(
  planId: string,
  steps: AgentPlanStepPayload[]
): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/steps`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ steps }),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to update agent plan steps');
}

/**
 * AGT-009: jawne "Uruchom" (POST /:id/run) — dispatch planu z 'planning'.
 * Opcjonalne `steps` zapisują ostateczny przestawiony schemat przed dispatchem
 * (canvas → "Uruchom" jednym żądaniem: zapis + start).
 *
 * M02-P16b: opcjonalny `idempotencyKey` — caller (UI) generuje JEDEN klucz na
 * próbę uruchomienia i wysyła TEN SAM przy retry (network drop, ponowny klik
 * po błędzie, zanim payload/steps się zmienią). Serwer
 * (`agentPlannerService.claimRunSubmission`, migracja 942) na retry z tym
 * samym kluczem zwraca replay zamiast drugi raz nadpisywać kroki i drugi raz
 * kolejkować dispatch. Pominięcie parametru zachowuje dokładnie dotychczasowe
 * zachowanie (opt-in, jak reszta wzorca idempotency-key w repo).
 */
export async function runAgentPlan(
  planId: string,
  steps?: AgentPlanStepPayload[],
  idempotencyKey?: string
): Promise<{ plan: AgentPlan; dispatch: AgentPlanDispatch }> {
  const body: { steps?: AgentPlanStepPayload[]; idempotencyKey?: string } = {};
  if (steps && steps.length > 0) body.steps = steps;
  if (idempotencyKey) body.idempotencyKey = idempotencyKey;
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/run`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<{ plan: AgentPlan; dispatch: AgentPlanDispatch }>(
    res,
    'Failed to run agent plan'
  );
}

/**
 * Harmonogram (Fala 1, 2026-07-26): 'planning' -> 'scheduled' z konkretnym
 * `scheduledAt` (ISO string, np. z `<input type="datetime-local">`). Dispatch
 * robi cron (`server/src/jobs/agentPlanSchedulerJob.ts`, co 2 min), nie ten
 * wywołanie — w przeciwieństwie do `runAgentPlan` to żądanie nigdy nie zwraca
 * `dispatch`.
 */
export async function scheduleAgentPlan(
  planId: string,
  scheduledAt: string
): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/schedule`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ scheduledAt }),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to schedule agent plan');
}

export async function getAgentPlan(planId: string): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}`, {
    headers: getHeaders(),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to load agent plan');
}

export async function listAgentPlans(
  options: { mine?: boolean } = {}
): Promise<{ total: number; plans: AgentPlan[] }> {
  const query = options.mine ? '?mine=1' : '';
  const res = await fetch(`${API_URL}/ai/agent-plan${query}`, { headers: getHeaders() });
  return handleResponse<{ total: number; plans: AgentPlan[] }>(res, 'Failed to list agent plans');
}

export async function approveAgentPlanStep(
  planId: string,
  stepIndex: number
): Promise<{ plan: AgentPlan; dispatch: 'enqueued' | 'unavailable' }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/approve-step`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ stepIndex }),
  });
  return handleResponse<{ plan: AgentPlan; dispatch: 'enqueued' | 'unavailable' }>(
    res,
    'Failed to approve agent plan step'
  );
}

export async function cancelAgentPlan(planId: string): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/cancel`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to cancel agent plan');
}

/**
 * AGT-011: pozycja biblioteki procesów (ProcessLibrary,
 * server/src/services/ai/agentPlan/processLibraryService.ts `listProcesses`)
 * — dla galerii szablonów w zakładce "Szablony" (AgentHubShell).
 */
export interface AgentProcessSummary {
  id: string;
  label: string;
  description: string;
  isDefault: boolean;
  phaseCount: number;
}

/** GET /api/ai/agent-plan/processes — biblioteka procesów (classic-5 domyślny, drd wariant). */
export async function listAgentProcesses(): Promise<{
  total: number;
  processes: AgentProcessSummary[];
}> {
  const res = await fetch(`${API_URL}/ai/agent-plan/processes`, { headers: getHeaders() });
  return handleResponse<{ total: number; processes: AgentProcessSummary[] }>(
    res,
    'Failed to load process library'
  );
}

/**
 * AGT-FOLDERS (2026-07-28): foldery dla "Moje procesy" — analogiczny system
 * jak Vault (`getVaultFolders`/`createVaultFolder`/…, src/services/api.ts).
 * 3 poziomy: 'user' (prywatny, tylko twórca), 'project' (zespół projektu),
 * 'organization' (cała firma) — patrz `server/src/services/ai/agentFolderService.ts`.
 */
export type AgentFolderScope = 'user' | 'project' | 'organization';

export interface AgentFolder {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  scope: AgentFolderScope;
  projectId?: string | null;
  ownerId: string;
  parentFolderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /api/ai/agent-plan/folders — bez `scope` = widok domyślny (mój + org + projekty, których jestem członkiem). */
export async function listAgentFolders(
  params: { scope?: AgentFolderScope; projectId?: string } = {}
): Promise<AgentFolder[]> {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.projectId) query.set('project_id', params.projectId);
  const qs = query.toString();
  const res = await fetch(`${API_URL}/ai/agent-plan/folders${qs ? `?${qs}` : ''}`, {
    headers: getHeaders(),
  });
  const data = await handleResponse<{ folders: AgentFolder[] }>(
    res,
    'Failed to load agent folders'
  );
  return data.folders;
}

export async function createAgentFolder(input: {
  name: string;
  scope: AgentFolderScope;
  projectId?: string;
  description?: string;
  color?: string;
  parentFolderId?: string;
}): Promise<AgentFolder> {
  const res = await fetch(`${API_URL}/ai/agent-plan/folders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse<AgentFolder>(res, 'Failed to create agent folder');
}

export async function updateAgentFolder(
  folderId: string,
  updates: { name?: string; description?: string | null; color?: string | null }
): Promise<{ updated: boolean }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/folders/${encodeURIComponent(folderId)}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse<{ updated: boolean }>(res, 'Failed to update agent folder');
}

export async function deleteAgentFolder(folderId: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse<{ deleted: boolean }>(res, 'Failed to delete agent folder');
}

/** PATCH /api/ai/agent-plan/:id/folder — kebab "Przenieś do folderu"; `folderId: null` odpina. */
export async function setAgentPlanFolder(
  planId: string,
  folderId: string | null
): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/folder`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ folderId }),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to move agent plan to folder');
}
