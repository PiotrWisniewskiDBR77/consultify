/**
 * Fetch mock for the AGT-007 dev-render screen (agent-plan-canvas).
 *
 * Serves two `AgentPlan` records, both in status `planning` (the window
 * during which `AgentPlanPanel` renders the editable `AgentPlanCanvas`
 * instead of the read-only step list — see AgentPlanPanel.tsx header):
 *  - `plan-canvas-path1` — ścieżka ① "AI proponuje": pre-loaded z klasycznym
 *    schematem 5-fazowym (Kubr/ILO), zgodnie z SPEC §4 Partia 2.
 *  - `plan-canvas-path2` — ścieżka ② "Ręcznie z klocków": zero kroków, user
 *    dokłada bloki sam.
 *
 * Only intercepts GET /api/ai/agent-plan/:id — nothing else is called by
 * this screen (no approve/cancel exercised here, that is already proven by
 * the agent-plan-view.tsx harness).
 */

interface MockStep {
  id: string;
  stepIndex: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: 'pending';
  requiresApproval: boolean;
}

function classicFivePhaseSteps(): MockStep[] {
  const phases: Array<{ name: string; module: string }> = [
    { name: 'Wejście / Kontraktowanie', module: 'Chat · My Work' },
    { name: 'Diagnoza', module: 'Interview · Assessment' },
    { name: 'Rekomendacje', module: 'Initiatives · Finance' },
    { name: 'Wdrożenie', module: 'Execution' },
    { name: 'Zamknięcie', module: 'Results · Materials' },
  ];
  return phases.map((phase, index) => ({
    id: `path1-step-${index}`,
    stepIndex: index,
    toolName: phase.name,
    toolInput: { module: phase.module, blockKind: 'etap-modul' },
    status: 'pending',
    requiresApproval: false,
  }));
}

function makePlan(id: string, title: string, steps: MockStep[]) {
  return {
    id,
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title,
    status: 'planning',
    steps,
    totalSteps: steps.length,
    completedSteps: 0,
    currentStepIndex: 0,
    isBackground: true,
    createdAt: new Date().toISOString(),
  };
}

const PLANS: Record<string, ReturnType<typeof makePlan>> = {
  'plan-canvas-path1': makePlan(
    'plan-canvas-path1',
    'Nowy projekt — AI proponuje schemat',
    classicFivePhaseSteps()
  ),
  'plan-canvas-path2': makePlan('plan-canvas-path2', 'Nowy projekt — od pustego', []),
};

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function installAgentPlanCanvasFetchMock(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    const getMatch = url.match(/\/api\/ai\/agent-plan\/([^/?]+)$/);
    if (getMatch && (!init || !init.method || init.method === 'GET')) {
      const plan = PLANS[getMatch[1]];
      if (!plan) return respond({ error: 'Plan not found' }, 404);
      // Zwraca zawsze ten sam obiekt referencyjnie — panel trzyma edycję
      // lokalnie (canvasBlocks/localStorage), więc polling nie kasuje
      // przestawionego układu (patrz AgentPlanPanel.tsx useEffect).
      return respond({ plan });
    }

    return originalFetch(input, init);
  };
}
