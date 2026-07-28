/**
 * Fetch mock for the AGT-010/AGT-011 dev-render screen (agent-hub).
 *
 * Intercepts only the endpoints AgentHubShell/AgentPlanWorkspace actually
 * call (`GET/POST /api/ai/agent-plan*`, `GET /api/ai/agent-plan/processes`,
 * `GET /api/ai/agent-manifests`) — everything else (locale JSON, app CSS, …)
 * passes through to the real `fetch` untouched. No backend, no DB, no login.
 *
 * Seeds a fixed list of plans covering the 4 statuses named in the
 * acceptance criterion (planning / executing / awaiting_approval /
 * completed) plus one `failed` row to prove the danger tone. The
 * single-plan GET is intentionally STATIC (no auto-advance, unlike
 * agentPlanCanvasMocks.ts) so the harness screenshot is stable when a row
 * is opened — the deep run/canvas behaviour already has its own proof
 * (dev-render/screens/agent-plan-canvas.tsx).
 *
 * AGT-011 adds `MOCK_PROCESSES` (mirror of ProcessLibrary) and
 * `MOCK_MANIFESTS` (representative sample of the built-manifest catalog,
 * with `stepCount` like the real /api/ai/agent-manifests route) so the
 * "Szablony" tab renders both template kinds without a backend.
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
  // AGT-FOLDERS + kolumny huba (2026-07-28) — patrz raport zadania.
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  folderId?: string | null;
}

export interface MockAgentFolder {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  scope: 'user' | 'project' | 'organization';
  projectId?: string | null;
  ownerId: string;
  parentFolderId?: string | null;
  createdAt: string;
  updatedAt: string;
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

let folders: MockAgentFolder[] = [
  {
    id: 'folder-mock-elkomtech',
    name: 'Elkomtech',
    scope: 'user',
    ownerId: 'user-piotr-demo',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: 'folder-mock-org',
    name: 'Standardowe analizy',
    scope: 'organization',
    ownerId: 'user-inna-osoba-demo',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  },
];

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
    folderId: 'folder-mock-elkomtech',
  },
  {
    id: 'plan-mock-scheduled',
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title: 'Przegląd kwartalny — automatyczny',
    status: 'scheduled',
    steps: makeClassicSteps(['pending', 'pending', 'pending', 'pending', 'pending']),
    totalSteps: 5,
    completedSteps: 0,
    currentStepIndex: 0,
    isBackground: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
    folderId: 'folder-mock-org',
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
    startedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
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
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
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
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5 + 1000 * 60 * 2).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5 + 1000 * 60 * 37).toISOString(),
    folderId: 'folder-mock-elkomtech',
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
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 + 1000 * 60).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 9).toISOString(),
  },
];

let newPlanSeq = 0;

/**
 * ★ Punkt 10 (odbiór triady 2026-07-24) — mirror MINIMALNY dwóch wpisów z
 * `CURATED_PLAYBOOKS` (server/src/services/ai/agentPlan/planBuilderService.ts)
 * żeby dev-render mógł DOWIEŚĆ fixa: PRZED (agent-plan.routes.ts sprzed
 * poprawki) `toolInput` niósł WYŁĄCZNIE `{toolName, toolInput}` bez `phase` —
 * `readablePhaseName()` spadał na surowy `toolName` (`search_knowledge_base`
 * itd.). PO poprawce backend wstrzykuje `rationale` do `toolInput.phase` —
 * ten mock robi TO SAMO (`phase: step.rationale`), więc "Użyj szablonu" na
 * Ansoff/Porter w tym harnessu pokazuje realny efekt fixa, nie zgadywanie.
 */
const MOCK_MANIFEST_PLAYBOOKS: Record<
  string,
  Array<{ toolName: string; rationale: string; requiresApproval?: boolean }>
> = {
  'growth-paths': [
    {
      toolName: 'search_knowledge_base',
      rationale: 'Growth Paths (Ansoff): gather context on current growth strategy options',
    },
    {
      toolName: 'get_initiative_status',
      rationale: 'Growth Paths (Ansoff): review initiatives already in flight for each growth path',
    },
    {
      toolName: 'calculate_financial',
      rationale: 'Growth Paths (Ansoff): size the ROI of the strongest growth path',
    },
    {
      toolName: 'generate_report_section',
      rationale: 'Growth Paths (Ansoff): recommend a prioritized growth path',
      requiresApproval: true,
    },
  ],
  'market-forces': [
    {
      toolName: 'search_knowledge_base',
      rationale:
        'Market Forces (Porter 5 Forces): gather internal evidence on the five competitive forces',
    },
    {
      toolName: 'compare_benchmarks',
      rationale:
        'Market Forces (Porter 5 Forces): compare competitive position against industry benchmarks',
    },
    {
      toolName: 'generate_report_section',
      rationale:
        'Market Forces (Porter 5 Forces): synthesize findings into a Porter Five Forces analysis',
      requiresApproval: true,
    },
  ],
};

function makeManifestSteps(manifestId: string): MockAgentPlanStep[] | null {
  const playbook = MOCK_MANIFEST_PLAYBOOKS[manifestId];
  if (!playbook) return null;
  return playbook.map((step, index) => ({
    id: `step-manifest-${index}`,
    stepIndex: index,
    toolName: step.toolName,
    // `phase: step.rationale` — dokładnie to, co agent-plan.routes.ts robi
    // teraz PO fixie (`toolInput: { ...toolInput, phase: rationale }`).
    toolInput: { phase: step.rationale },
    status: 'pending',
    requiresApproval: !!step.requiresApproval,
  }));
}

/**
 * AGT-011: mock biblioteki procesów (ProcessLibrary — mirror `PROCESS_LIBRARY`
 * z server/src/services/ai/agentPlan/processLibraryService.ts) dla zakładki
 * "Szablony". Statyczne — ta biblioteka jest deterministyczna (bez auto-advance).
 */
const MOCK_PROCESSES = [
  {
    id: 'classic-5',
    label: 'Klasyczny konsulting (5 faz, Kubr/ILO)',
    description:
      'Wejście/Kontraktowanie → Diagnoza → Rekomendacje → Wdrożenie → Zamknięcie. ' +
      'Uniwersalny, rozpoznawalny, zbieżny z McKinsey/BCG.',
    isDefault: true,
    phaseCount: 5,
  },
  {
    id: 'drd',
    label: 'DRD (4 kroki)',
    description: 'Discovery → Ocena → Inicjatywy → Efekty. Wariant skrócony.',
    isDefault: false,
    phaseCount: 4,
  },
];

/**
 * AGT-011: mock katalogu manifestów (mirror kilku wpisów `built` z
 * discoveryAgentManifestCatalog.ts + `stepCount` dokładany przez route
 * /api/ai/agent-manifests po stronie realnego backendu). Reprezentatywna
 * próbka (nie pełne 19) — wystarczająca do dowodu tabeli/scroll.
 */
const MOCK_MANIFESTS = [
  {
    id: 'market-forces',
    sourceType: 'discovery_tool',
    status: 'built',
    displayName: { pl: 'Siły Rynkowe (5 Sił Portera)', en: 'Market Forces (Porter 5 Forces)' },
    wave: 'wave-1',
    configDir: 'src/config/porter',
    stepCount: 3,
  },
  {
    id: 'growth-paths',
    sourceType: 'discovery_tool',
    status: 'built',
    displayName: { pl: 'Ścieżki Wzrostu (Ansoff)', en: 'Growth Paths (Ansoff)' },
    wave: 'wave-1',
    configDir: 'src/config/ansoff',
    stepCount: 3,
  },
  {
    id: 'portfolio-priority',
    sourceType: 'discovery_tool',
    status: 'built',
    displayName: { pl: 'Priorytetyzacja Portfela', en: 'Portfolio Priority' },
    wave: 'wave-1',
    configDir: 'src/config/portfolio',
    stepCount: 4,
  },
  {
    id: 'risk-uncertainty',
    sourceType: 'discovery_tool',
    status: 'built',
    displayName: { pl: 'Ryzyko i Niepewność', en: 'Risk & Uncertainty' },
    wave: 'wave-1',
    configDir: 'src/config/riskuncertainty',
    stepCount: 3,
  },
  {
    id: 'siri-readiness',
    sourceType: 'discovery_tool',
    status: 'built',
    displayName: { pl: 'Ocena gotowości SIRI 2.0', en: 'SIRI 2.0 Readiness Assessment' },
    wave: 'wave-2',
    configDir: 'src/config/siri',
    stepCount: 4,
  },
];

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

    // GET /api/ai/agent-plan/processes — AGT-011 "Szablony": biblioteka
    // procesów. MUSI być sprawdzone PRZED "Moje procesy"/getMatch niżej
    // (inaczej 'processes' zostałby wzięty za id planu -> 404).
    if (url.includes('/api/ai/agent-plan/processes') && method === 'GET') {
      return respond({ total: MOCK_PROCESSES.length, processes: MOCK_PROCESSES });
    }

    // AGT-FOLDERS (2026-07-28) — "Moje procesy" folder dropdown (Menu 2 huba,
    // no-op w tym harnessie bo AgentHubShell montuje BEZ providera slotów —
    // patrz raport zadania — ale kolejność musi być poprawna PRZED :id).
    if (url.includes('/api/ai/agent-plan/folders') && method === 'GET') {
      return respond({ folders });
    }
    if (url.includes('/api/ai/agent-plan/folders') && method === 'POST') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const folder: MockAgentFolder = {
        id: `folder-mock-new-${folders.length + 1}`,
        name: String(body.name || 'Folder'),
        scope: body.scope || 'user',
        projectId: body.projectId ?? null,
        ownerId: 'user-piotr-demo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      folders = [...folders, folder];
      return respond(folder, 201);
    }
    const folderIdMatch = url.match(/\/api\/ai\/agent-plan\/folders\/([^/?]+)$/);
    if (folderIdMatch && method === 'DELETE') {
      folders = folders.filter((f) => f.id !== folderIdMatch[1]);
      plans = plans.map((p) => (p.folderId === folderIdMatch[1] ? { ...p, folderId: null } : p));
      return respond({ success: true, deleted: true });
    }
    if (folderIdMatch && method === 'PUT') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      folders = folders.map((f) =>
        f.id === folderIdMatch[1] ? { ...f, ...body, updatedAt: new Date().toISOString() } : f
      );
      return respond({ success: true, updated: true });
    }

    // PATCH /api/ai/agent-plan/:id/folder — kebab "Przenieś do folderu".
    const moveFolderMatch = url.match(/\/api\/ai\/agent-plan\/([^/]+)\/folder$/);
    if (moveFolderMatch && method === 'PATCH') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const plan = plans.find((p) => p.id === moveFolderMatch[1]);
      if (!plan) return respond({ error: 'Plan not found' }, 404);
      plan.folderId = body.folderId ?? null;
      return respond({ plan });
    }

    // GET /api/projects/my-memberships — scope picker "Nowy folder…" (projekt).
    if (url.includes('/api/projects/my-memberships') && method === 'GET') {
      return respond({
        memberships: [{ projectId: 'proj-mock-elkomtech', projectName: 'Elkomtech — wdrożenie' }],
      });
    }

    // GET /api/ai/agent-manifests — AGT-011 "Szablony": katalog gotowych analiz.
    if (url.includes('/api/ai/agent-manifests') && method === 'GET') {
      return respond({ total: MOCK_MANIFESTS.length, manifests: MOCK_MANIFESTS });
    }

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
      const manifestSteps = parsedBody.manifestId
        ? makeManifestSteps(String(parsedBody.manifestId))
        : null;
      const steps =
        manifestSteps ?? makeClassicSteps(['pending', 'pending', 'pending', 'pending', 'pending']);
      const plan: MockAgentPlan = {
        id: `plan-mock-new-${newPlanSeq}`,
        organizationId: 'org-dbr77-demo',
        userId: 'user-piotr-demo',
        title: String(parsedBody.title || 'New process'),
        status: parsedBody.draft ? 'planning' : 'executing',
        steps,
        totalSteps: steps.length,
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
