/**
 * Fetch mock for the HP-4 F3 dev-render screen (agent-plan-view).
 *
 * Intercepts only the two real endpoints the real client code calls
 * (`GET /api/ai/agent-manifests`, `/api/ai/agent-plan*` — see
 * src/services/api/agentManifests.api.ts / agentPlan.api.ts). Everything else
 * (locale JSON via i18next-http-backend, the app CSS, etc.) passes through to
 * the real `fetch` untouched, so this only fakes the two agent-plan calls —
 * no backend, no DB, no login.
 */

export interface AgentPlanMockStep {
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

let planState: {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  status: string;
  steps: AgentPlanMockStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  resultSummary?: string;
  errorMessage?: string;
  isBackground: boolean;
  createdAt: string;
} | null = null;

let pollCount = 0;

function makeSteps(manifestId: string): AgentPlanMockStep[] {
  const base: Array<Pick<AgentPlanMockStep, 'toolName' | 'toolInput' | 'requiresApproval'>> = [
    {
      toolName: 'search_knowledge_base',
      toolInput: { query: manifestId },
      requiresApproval: false,
    },
    {
      toolName: 'analyze_context',
      toolInput: { manifestId },
      requiresApproval: false,
    },
    {
      toolName: 'draft_deliverable',
      toolInput: { manifestId, format: 'markdown' },
      requiresApproval: true,
    },
  ];
  return base.map((step, index) => ({
    id: `step-${index}`,
    stepIndex: index,
    ...step,
    status: 'pending',
  }));
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Installs the fetch mock on `window.fetch`. Returns nothing — call once at
 * screen mount, before the component renders its first effect.
 */
export function installAgentPlanFetchMock(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    // GET /api/ai/agent-manifests — read-only catalog (real endpoint already
    // live; mocked here only so the dev-render harness never needs a backend).
    if (url.includes('/api/ai/agent-manifests')) {
      return respond({
        total: 4,
        manifests: [
          {
            id: 'discovery-siri-readiness',
            sourceType: 'discovery_tool',
            status: 'built',
            displayName: { pl: 'Ocena gotowości SIRI 2.0', en: 'SIRI 2.0 Readiness Assessment' },
            wave: 'wave-1',
            configDir: 'siri-readiness',
          },
          {
            id: 'discovery-process-mapper',
            sourceType: 'discovery_tool',
            status: 'built',
            displayName: { pl: 'Mapowanie procesów', en: 'Process Mapper' },
            wave: 'wave-1',
            configDir: 'process-mapper',
          },
          {
            id: 'discovery-lean-diagnostic',
            sourceType: 'discovery_tool',
            status: 'built',
            displayName: { pl: 'Diagnoza Lean', en: 'Lean Diagnostic' },
            wave: 'wave-2',
            configDir: 'lean-diagnostic',
          },
          {
            id: 'discovery-digital-maturity',
            sourceType: 'discovery_tool',
            status: 'built',
            displayName: { pl: 'Dojrzałość cyfrowa', en: 'Digital Maturity' },
            wave: 'wave-3',
            configDir: 'digital-maturity',
          },
        ],
      });
    }

    // POST /api/ai/agent-plan — create plan from manifestId.
    if (
      url.includes('/api/ai/agent-plan') &&
      !url.match(/agent-plan\/[^/]+/) &&
      init?.method === 'POST'
    ) {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
      const manifestId = String(parsedBody.manifestId || 'unknown-manifest');
      pollCount = 0;
      planState = {
        id: 'plan-dev-render-mock-1',
        organizationId: 'org-dbr77-demo',
        userId: 'user-piotr-demo',
        title: String(parsedBody.title || 'Agent run'),
        status: 'executing',
        steps: makeSteps(manifestId),
        totalSteps: 3,
        completedSteps: 0,
        currentStepIndex: 0,
        isBackground: true,
        createdAt: new Date().toISOString(),
      };
      return respond({ plan: planState, dispatch: 'enqueued' });
    }

    // GET /api/ai/agent-plan/:id — poll for progress. Advances a step each
    // call so the harness shows the panel actually changing over time.
    const getMatch = url.match(/\/api\/ai\/agent-plan\/([^/?]+)$/);
    if (getMatch && (!init || !init.method || init.method === 'GET')) {
      if (!planState) {
        return respond({ error: 'Plan not found' }, 404);
      }
      pollCount += 1;
      if (pollCount === 1) {
        planState.steps[0].status = 'completed';
        planState.steps[0].durationMs = 820;
        planState.steps[1].status = 'running';
        planState.completedSteps = 1;
        planState.currentStepIndex = 1;
      } else if (pollCount === 2) {
        planState.steps[1].status = 'completed';
        planState.steps[1].durationMs = 1340;
        planState.steps[2].status = 'awaiting_approval';
        planState.completedSteps = 2;
        planState.currentStepIndex = 2;
        planState.status = 'awaiting_approval';
      }
      return respond({ plan: planState });
    }

    // POST /api/ai/agent-plan/:id/approve-step
    if (url.includes('/approve-step')) {
      if (planState) {
        planState.steps[2].status = 'completed';
        planState.steps[2].durationMs = 2100;
        planState.completedSteps = 3;
        planState.status = 'completed';
        planState.resultSummary = 'Agent finished 3/3 steps successfully (dev-render mock).';
      }
      return respond({ plan: planState, dispatch: 'enqueued' });
    }

    // POST /api/ai/agent-plan/:id/cancel
    if (url.includes('/cancel')) {
      if (planState) {
        planState.status = 'cancelled';
      }
      return respond({ plan: planState });
    }

    return originalFetch(input, init);
  };
}
