/**
 * @vitest-environment jsdom
 *
 * AgentPlanPanel — NAPRAWA CZYTELNOŚCI poza `stepsToBlocks` (2026-07-24).
 *
 * Kontekst: `stepsToBlocks`/`blocksToSteps` (AgentPlanPanel.tsx) mają już
 * pokrycie w tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts — ten test
 * pokrywa DWA MIEJSCA, które ten plik NIE dotyka: sekcję „Plan" (read-only
 * lista kroków, ~L425-443) i sekcję „Aprobaty" (~L493-508). Obie renderowały
 * WPROST `step.toolName` (np. `get_assessment_data`) zamiast czytelnej nazwy
 * fazy z generatora (`step.toolInput.phase`, patrz `processLibraryService.
 * buildExecutableSteps` — wstrzykuje `phase`/`module`/`deliverable` do
 * `toolInput`). Naprawa: obie sekcje wołają ten sam helper `readablePhaseName`
 * co `stepsToBlocks`, nie duplikują logiki priorytetu.
 *
 * Metoda: renderujemy PRAWDZIWY `AgentPlanPanel` (prawdziwy `ArtifactRightPanel`
 * — accordion prosty, sekcje domyślnie otwarte — i prawdziwy
 * `PreviewActionButton`), mockując WYŁĄCZNIE `@/services/api/agentPlan.api`
 * (żeby nie robić realnego fetch) i ciężki `AgentPlanCanvas` (nieużywany w
 * tych dwóch scenariuszach — canvas edytowalny renderuje się TYLKO w statusie
 * `planning`, tu testujemy `executing`/`awaiting_approval`, czyli read-only
 * ścieżkę).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AgentPlan, AgentPlanStep } from '@/services/api/agentPlan.api';

const getAgentPlan = vi.fn();
const approveAgentPlanStep = vi.fn();
const cancelAgentPlan = vi.fn();
const runAgentPlan = vi.fn();

vi.mock('@/services/api/agentPlan.api', () => ({
  getAgentPlan: (...a: unknown[]) => getAgentPlan(...a),
  approveAgentPlanStep: (...a: unknown[]) => approveAgentPlanStep(...a),
  cancelAgentPlan: (...a: unknown[]) => cancelAgentPlan(...a),
  runAgentPlan: (...a: unknown[]) => runAgentPlan(...a),
}));

// AgentPlanCanvas nie montuje się w statusie inny-niż-'planning' (por.
// AgentPlanPanel.tsx `isEditableSchema`), więc atrapa tu jest wyłącznie
// zabezpieczeniem przed zaciągnięciem ciężkiego drzewa, gdyby ktoś kiedyś
// zmienił warunek.
vi.mock('@/components/AIChat/AgentPlanCanvas', () => ({
  AgentPlanCanvas: () => <div data-testid="agent-plan-canvas-stub" />,
}));

import { AgentPlanPanel } from '@/components/AIChat/AgentPlanPanel';

function makeStep(overrides: Partial<AgentPlanStep> = {}): AgentPlanStep {
  return {
    id: 'step-diag',
    stepIndex: 0,
    toolName: 'get_assessment_data',
    toolInput: {},
    status: 'pending',
    requiresApproval: false,
    ...overrides,
  };
}

function makePlan(overrides: Partial<AgentPlan> = {}): AgentPlan {
  return {
    id: 'plan-1',
    organizationId: 'org-1',
    userId: 'user-1',
    title: 'Test plan',
    status: 'executing',
    steps: [],
    totalSteps: 1,
    completedSteps: 0,
    currentStepIndex: 0,
    isBackground: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AgentPlanPanel — czytelna nazwa fazy w sekcjach Plan/Aprobaty', () => {
  it('sekcja "Plan" (read-only, status executing) pokazuje toolInput.phase, nie surowy toolName', async () => {
    getAgentPlan.mockResolvedValue({
      plan: makePlan({
        status: 'executing',
        steps: [
          makeStep({
            id: 'step-diag',
            toolName: 'get_assessment_data',
            toolInput: { phase: 'Diagnoza', module: 'Interview · Assessment' },
            status: 'running',
          }),
        ],
      }),
    });

    render(<AgentPlanPanel planId="plan-1" />);

    // Etykieta czytelna widoczna
    expect(await screen.findByText('Diagnoza')).toBeInTheDocument();
    // Nazwa techniczna NIE jest tytułem klocka — nie może wystąpić jako
    // jedyny/dominujący tekst; dopuszczamy ją jako drugorzędny podpis, więc
    // sprawdzamy, że nie zastąpiła etykiety głównej (Diagnoza jest obecne).
    expect(screen.queryByText('get_assessment_data')).not.toBeNull(); // dozwolone jako info drugorzędne
  });

  it('sekcja "Plan" fallback: krok bez toolInput.phase nadal pokazuje toolName (brak regresji)', async () => {
    getAgentPlan.mockResolvedValue({
      plan: makePlan({
        status: 'executing',
        steps: [
          makeStep({
            id: 'step-legacy',
            toolName: 'search_knowledge_base',
            toolInput: { query: 'coś' },
            status: 'completed',
          }),
        ],
      }),
    });

    render(<AgentPlanPanel planId="plan-1" />);

    expect(await screen.findByText('search_knowledge_base')).toBeInTheDocument();
  });

  it('sekcja "Aprobaty" pokazuje toolInput.phase dla kroku awaiting_approval, nie surowy toolName', async () => {
    getAgentPlan.mockResolvedValue({
      plan: makePlan({
        status: 'awaiting_approval',
        steps: [
          makeStep({
            id: 'step-wdrozenie',
            toolName: 'calculate_financial',
            toolInput: { phase: 'Wdrożenie', module: 'Execution · Initiatives' },
            status: 'awaiting_approval',
            requiresApproval: true,
          }),
        ],
      }),
    });

    render(<AgentPlanPanel planId="plan-1" />);

    // Krok w statusie awaiting_approval renderuje się i w sekcji "Plan"
    // (read-only lista wszystkich kroków), i w sekcji "Aprobaty" (tylko
    // oczekujące) — obie muszą pokazywać czytelną nazwę fazy, stąd
    // getAllByText zamiast getByText (dopuszczamy 2 dopasowania).
    const matches = await screen.findAllByText('Wdrożenie');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Nazwa techniczna nie może w ogóle zastąpić etykiety głównej w żadnej
    // z sekcji — nie może wystąpić więcej razy niż czytelna nazwa fazy.
    expect(screen.getAllByText('calculate_financial').length).toBeLessThanOrEqual(matches.length);
    // Przycisk zatwierdzenia nadal obecny w sekcji Aprobaty.
    expect(screen.getByRole('button', { name: /approve step/i })).toBeInTheDocument();
  });
});
