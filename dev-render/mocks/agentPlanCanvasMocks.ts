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
 *
 * ★ AGT-008 — also intercepts GET /api/knowledge/vault-safes so the new
 * "Poziom Vault" picker on the 'vault-kontekst' block (AgentPlanCanvas.tsx)
 * has real safe names to show instead of an empty/error select. Mirrors the
 * shape of GET /api/knowledge/vault-safes (server/src/routes/knowledge.routes.ts).
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

const MOCK_VAULT_SAFES = [
  {
    id: 'user',
    type: 'user',
    projectId: null,
    name: 'Mój sejf',
    documentCount: 4,
    lastModified: null,
  },
  {
    id: 'organization',
    type: 'organization',
    projectId: null,
    name: 'Sejf organizacji',
    documentCount: 12,
    lastModified: null,
  },
  {
    id: 'project:proj-elkomtech',
    type: 'project',
    projectId: 'proj-elkomtech',
    name: 'Elkomtech',
    documentCount: 7,
    lastModified: null,
  },
];

// ★ VLT-FOLDERS — foldery WEWNĄTRZ "Mój sejf" i "Elkomtech" (project), żeby
// DRUGI select klocka 'vault-kontekst' (AgentPlanCanvas.tsx) miał realne
// opcje do pokazania zamiast pustego "— cały sejf (bez folderu) —".
const MOCK_VAULT_FOLDERS: Record<string, Array<{ id: string; name: string }>> = {
  'user:': [
    { id: 'folder-inbox', name: 'Inbox' },
    { id: 'folder-szkice', name: 'Szkice' },
  ],
  'organization:': [{ id: 'folder-polityki', name: 'Polityki' }],
  'project:proj-elkomtech': [{ id: 'folder-diagnoza', name: 'Diagnoza AiR' }],
};

export function installAgentPlanCanvasFetchMock(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    // AGT-008 — "Poziom Vault" picker na klocku 'vault-kontekst'.
    if (
      url.includes('/api/knowledge/vault-safes') &&
      (!init || !init.method || init.method === 'GET')
    ) {
      return respond({ safes: MOCK_VAULT_SAFES });
    }

    // ★ VLT-FOLDERS — DRUGI select: folder WEWNĄTRZ już wybranego sejfu.
    if (
      url.includes('/api/knowledge/vault-folders') &&
      (!init || !init.method || init.method === 'GET')
    ) {
      const parsed = new URL(url, window.location.origin);
      const scope = parsed.searchParams.get('scope') || '';
      const projectId = parsed.searchParams.get('project_id') || '';
      const key = scope === 'project' ? `project:${projectId}` : `${scope}:`;
      return respond(MOCK_VAULT_FOLDERS[key] || []);
    }

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
