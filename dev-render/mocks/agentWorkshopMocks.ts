/**
 * Fetch mock dla ekranu dev-render `agent-warsztat` (warsztat agenta, 3 kolumny).
 *
 * Trzy plany pokrywają stany, które trzeba zobaczyć na zrzucie PRZED
 * właścicielem (CLAUDE.md #7):
 *  - `warsztat-planning`  — schemat EDYTOWALNY: paleta aktywna, klocki z
 *    selectami, notatka „Informacja" w środku przepływu,
 *  - `warsztat-executing` — plan W TRAKCIE: krok 3 z 5 `running` → obwódka
 *    „TERAZ" w schemacie + blok „Teraz — krok 3 z 5" w kolumnie sterowania,
 *  - `warsztat-approval`  — plan zatrzymany na bramce: krok `awaiting_approval`
 *    + akcja „Zatwierdź krok" w sekcji Zgody.
 *
 * Przechwytuje GET /api/ai/agent-plan/:id oraz GET /api/knowledge/vault-safes
 * (picker „Poziom Vault" na klocku Vault-kontekst). POST/PATCH nie są tu
 * ćwiczone — realny zapis/uruchomienie ma pokrycie w agent-plan-canvas.
 */

type StepStatus = 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'skipped';

interface MockStep {
  id: string;
  stepIndex: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: StepStatus;
  requiresApproval: boolean;
  durationMs?: number;
  errorMessage?: string;
}

function step(
  id: string,
  stepIndex: number,
  toolName: string,
  toolInput: Record<string, unknown>,
  status: StepStatus,
  extra: Partial<MockStep> = {}
): MockStep {
  return { id, stepIndex, toolName, toolInput, status, requiresApproval: false, ...extra };
}

/** Klasyczny proces 5-fazowy (Kubr/ILO) — ten sam kształt, który kładzie generator. */
function fivePhase(
  status: (i: number) => StepStatus,
  extra: (i: number) => Partial<MockStep> = () => ({})
): MockStep[] {
  const phases: Array<{ name: string; module: string; tool: string; kind: string }> = [
    {
      name: 'Wejście / Kontraktowanie',
      module: 'Vault',
      tool: 'search_knowledge_base',
      kind: 'vault-kontekst',
    },
    { name: 'Diagnoza', module: 'Assessment', tool: 'get_assessment_data', kind: 'etap-modul' },
    { name: 'Rekomendacje', module: 'Finance', tool: 'calculate_financial', kind: 'etap-modul' },
    { name: 'Wdrożenie', module: 'My Work', tool: 'create_task', kind: 'automat' },
    { name: 'Zamknięcie', module: 'Materials', tool: 'generate_report_section', kind: 'ai-teresa' },
  ];
  return phases.map((phase, i) =>
    step(
      `wp-step-${i}`,
      i,
      phase.tool,
      {
        phase: phase.name,
        module: phase.module,
        blockKind: phase.kind,
        ...(phase.kind === 'vault-kontekst'
          ? {
              vault_scope: 'project',
              vault_safe_id: 'project:proj-elkomtech',
              vault_safe_name: 'Elkomtech',
            }
          : {}),
      },
      status(i),
      extra(i)
    )
  );
}

function plan(
  id: string,
  title: string,
  status: string,
  steps: MockStep[],
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    organizationId: 'org-dbr77-demo',
    userId: 'user-piotr-demo',
    title,
    status,
    steps,
    totalSteps: steps.length,
    completedSteps: steps.filter((s) => s.status === 'completed').length,
    currentStepIndex: Math.max(
      0,
      steps.findIndex((s) => s.status === 'running' || s.status === 'awaiting_approval')
    ),
    isBackground: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const PLANNING_STEPS: MockStep[] = [
  step(
    'wp-p-0',
    0,
    'search_knowledge_base',
    {
      phase: 'Kontekst klienta',
      module: 'Vault',
      blockKind: 'vault-kontekst',
      vault_scope: 'project',
      vault_safe_id: 'project:proj-elkomtech',
      vault_safe_name: 'Elkomtech',
      notesBefore: ['Zakres uzgodniony na spotkaniu 22.07 — trzymamy się 3 osi.'],
    },
    'pending'
  ),
  step(
    'wp-p-1',
    1,
    'get_assessment_data',
    { phase: 'Diagnoza', module: 'Assessment', blockKind: 'etap-modul' },
    'pending'
  ),
  step(
    'wp-p-2',
    2,
    'calculate_financial',
    { phase: 'Business case', module: 'Finance', blockKind: 'etap-modul' },
    'pending'
  ),
  step(
    'wp-p-3',
    3,
    'create_task',
    { phase: 'Zadania wdrożeniowe', module: 'My Work', blockKind: 'automat' },
    'pending',
    { requiresApproval: true }
  ),
];

const PLANS: Record<string, ReturnType<typeof plan>> = {
  'warsztat-planning': plan(
    'warsztat-planning',
    'Transformacja Elkomtech — schemat procesu',
    'planning',
    PLANNING_STEPS
  ),
  'warsztat-executing': plan(
    'warsztat-executing',
    'Transformacja Elkomtech — wykonanie',
    'executing',
    fivePhase(
      (i) => (i < 2 ? 'completed' : i === 2 ? 'running' : 'pending'),
      (i) => (i < 2 ? { durationMs: 4200 + i * 1800 } : {})
    )
  ),
  'warsztat-approval': plan(
    'warsztat-approval',
    'Transformacja Elkomtech — czeka na zgodę',
    'awaiting_approval',
    fivePhase(
      (i) => (i < 3 ? 'completed' : i === 3 ? 'awaiting_approval' : 'pending'),
      (i) => (i < 3 ? { durationMs: 3900 + i * 1500 } : i === 3 ? { requiresApproval: true } : {})
    )
  ),
};

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

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const WORKSHOP_PLAN_IDS = Object.keys(PLANS);

export function installAgentWorkshopFetchMock(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/knowledge/vault-safes')) {
      return respond({ safes: MOCK_VAULT_SAFES });
    }

    const match = url.match(/\/api\/ai\/agent-plan\/([^/?]+)/);
    if (match) {
      const found = PLANS[decodeURIComponent(match[1])];
      if (found) return respond({ plan: found, dispatch: 'enqueued' });
      return respond({ success: false, error: 'Plan not found' }, 404);
    }

    return originalFetch(input as RequestInfo, init);
  };
}
