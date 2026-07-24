/**
 * Fetch mock for the AGT-010 dev-render screen (agent-hub).
 *
 * Intercepts only the endpoints AgentHubShell/AgentPlanWorkspace actually
 * call (`GET/POST /api/ai/agent-plan*`) — everything else (locale JSON,
 * app CSS, …) passes through to the real `fetch` untouched. No backend, no
 * DB, no login.
 *
 * Seeds a fixed list of plans covering the 4 statuses named in the
 * acceptance criterion (planning / executing / awaiting_approval /
 * completed) plus one `failed` row to prove the danger tone. The
 * single-plan GET is intentionally STATIC (no auto-advance, unlike
 * agentPlanCanvasMocks.ts) so the harness screenshot is stable when a row
 * is opened — the deep run/canvas behaviour already has its own proof
 * (dev-render/screens/agent-plan-canvas.tsx).
 */

export interface MockAgentPlanStep {
  id: string;
  stepIndex: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  errorMessage?: string;
  requiresApproval: boolean;
  durationMs?: number;
}

export interface MockAgentPlan {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  status: string;
  steps: MockAgentPlanStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  resultSummary?: string;
  errorMessage?: string;
  isBackground: boolean;
  createdAt: string;
}

const CLASSIC_5_PHASES = [
  'Wejście / Kontraktowanie',
  'Diagnoza',
  'Rekomendacje',
  'Wdrożenie',
  'Zamknięcie',
];

function makeClassicSteps(statusPattern: MockAgentPlanStep['status'][]): MockAgentPlanStep[] {
  return CLASSIC_5_PHASES.map((phase, index) => ({
    id: `step-${index}`,
    stepIndex: index,
    toolName: phase,
    toolInput: { module: phase, phase, blockKind: 'etap-modul' },
    status: statusPattern[index] ?? 'pending',
    requiresApproval: phase === 'Rekomendacje',
  }));
}

let plans: MockAgentPlan[] = [
  {
    id: 'plan-mock-planning',
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title: 'Program transformacji — Elkomtech',
    status: 'planning',
    steps: makeClassicSteps(['pending', 'pending', 'pending', 'pending', 'pending']),
    totalSteps: 5,
    completedSteps: 0,
    currentStepIndex: 0,
    isBackground: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'plan-mock-executing',
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title: 'Diagnoza operacyjna — Apator',
    status: 'executing',
    steps: makeClassicSteps(['completed', 'running', 'pending', 'pending', 'pending']),
    totalSteps: 5,
    completedSteps: 1,
    currentStepIndex: 1,
    isBackground: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'plan-mock-awaiting',
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title: 'Rekomendacje kosztowe — AiR ICT',
    status: 'awaiting_approval',
    steps: makeClassicSteps(['completed', 'completed', 'awaiting_approval', 'pending', 'pending']),
    totalSteps: 5,
    completedSteps: 2,
    currentStepIndex: 2,
    isBackground: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'plan-mock-completed',
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title: 'Ocena gotowości SIRI 2.0',
    status: 'completed',
    steps: makeClassicSteps(['completed', 'completed', 'completed', 'completed', 'completed']),
    totalSteps: 5,
    completedSteps: 5,
    currentStepIndex: 4,
    resultSummary: 'Proces zakończony pomyślnie (dev-render mock).',
    isBackground: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: 'plan-mock-failed',
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title: 'Mapowanie procesów — pilot',
    status: 'failed',
    steps: makeClassicSteps(['completed', 'failed', 'pending', 'pending', 'pending']),
    totalSteps: 5,
    completedSteps: 1,
    currentStepIndex: 1,
    errorMessage: 'Tool timeout (dev-render mock).',
    isBackground: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
];

let newPlanSeq = 0;

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Installs the fetch mock. Call once at screen mount, before first render. */
export function installAgentHubFetchMock(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    // GET /api/ai/agent-plan?mine=1 — "Moje procesy" table.
    if (
      url.includes('/api/ai/agent-plan') &&
      !url.match(/agent-plan\/[^/?]+/) &&
      method === 'GET'
    ) {
      return respond({ total: plans.length, plans });
    }

    // POST /api/ai/agent-plan — "Nowy proces" (processId: 'classic-5', draft: true).
    if (
      url.includes('/api/ai/agent-plan') &&
      !url.match(/agent-plan\/[^/?]+/) &&
      method === 'POST'
    ) {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
      newPlanSeq += 1;
      const plan: MockAgentPlan = {
        id: `plan-mock-new-${newPlanSeq}`,
        organizationId: 'org-dbr77-demo',
        userId: 'user-piotr-demo',
        title: String(parsedBody.title || 'New process'),
        status: parsedBody.draft ? 'planning' : 'executing',
        steps: makeClassicSteps(['pending', 'pending', 'pending', 'pending', 'pending']),
        totalSteps: 5,
        completedSteps: 0,
        currentStepIndex: 0,
        isBackground: true,
        createdAt: new Date().toISOString(),
      };
      plans = [plan, ...plans];
      return respond({ plan, dispatch: parsedBody.draft ? 'deferred' : 'enqueued' });
    }

    // GET /api/ai/agent-plan/:id — open a row (static, no auto-advance).
    const getMatch = url.match(/\/api\/ai\/agent-plan\/([^/?]+)$/);
    if (getMatch && method === 'GET') {
      const plan = plans.find((p) => p.id === getMatch[1]);
      if (!plan) return respond({ error: 'Plan not found' }, 404);
      return respond({ plan });
    }

    // PATCH /api/ai/agent-plan/:id/steps — canvas save (planning only).
    if (url.includes('/steps') && method === 'PATCH') {
      const idMatch = url.match(/\/api\/ai\/agent-plan\/([^/]+)\/steps/);
      const plan = idMatch ? plans.find((p) => p.id === idMatch[1]) : undefined;
      if (!plan) return respond({ error: 'Plan not found' }, 404);
      return respond({ plan });
    }

    // POST /api/ai/agent-plan/:id/run — jawne "Uruchom" z canvasa.
    if (url.includes('/run') && method === 'POST') {
      const idMatch = url.match(/\/api\/ai\/agent-plan\/([^/]+)\/run/);
      const plan = idMatch ? plans.find((p) => p.id === idMatch[1]) : undefined;
      if (!plan) return respond({ error: 'Plan not found' }, 404);
      plan.status = 'executing';
      return respond({ plan, dispatch: 'enqueued' });
    }

    // POST /api/ai/agent-plan/:id/cancel
    if (url.includes('/cancel') && method === 'POST') {
      const idMatch = url.match(/\/api\/ai\/agent-plan\/([^/]+)\/cancel/);
      const plan = idMatch ? plans.find((p) => p.id === idMatch[1]) : undefined;
      if (!plan) return respond({ error: 'Plan not found' }, 404);
      plan.status = 'cancelled';
      return respond({ plan });
    }

    return originalFetch(input, init);
  };
}
