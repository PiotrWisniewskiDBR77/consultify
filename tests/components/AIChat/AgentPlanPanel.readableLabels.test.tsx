/**
 * @vitest-environment jsdom
 *
 * AgentPlanPanel — WARSZTAT AGENTA: czytelne nazwy + wskazanie „gdzie agent jest".
 *
 * Historia: pierwotnie (2026-07-24) ten test pilnował, żeby sekcje „Plan"
 * i „Aprobaty" pokazywały czytelną nazwę fazy (`toolInput.phase` z
 * `processLibraryService.buildExecutableSteps`) zamiast surowego `toolName`.
 * Po przebudowie panelu na trzykolumnowy warsztat te dwie sekcje zmieniły
 * miejsce (schemat = `AgentPlanCanvas` w środku, zgody i log = lewa kolumna
 * `AgentWorkshopControls`), więc test pilnuje TEGO SAMEGO KONTRAKTU w nowych
 * miejscach — plus dwie rzeczy, które dopiero teraz istnieją:
 *   (a) nazwa techniczna narzędzia nigdzie nie świeci jako snake_case
 *       (idzie przez `toolLabel` z agentWorkshopCatalog.ts),
 *   (b) krok wykonywany TERAZ jest wskazany zarówno w schemacie, jak i
 *       w kolumnie sterowania.
 *
 * Metoda: renderujemy PRAWDZIWY `AgentPlanPanel` z prawdziwą powłoką
 * (`ArtifactRightPanel`, `PreviewActionButton`, `AgentPlanCanvas`), mockując
 * WYŁĄCZNIE warstwę sieci (`@/services/api/agentPlan.api` i `@/services/api`,
 * żeby nie ciągnąć klienta HTTP).
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

// AgentPlanCanvas woła Api.getVaultSafes() tylko w trybie edytowalnym; tutaj
// testujemy stany read-only, ale mock zdejmuje z testu cały klient HTTP.
vi.mock('@/services/api', () => ({
  Api: { getVaultSafes: () => Promise.resolve([]) },
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

describe('AgentPlanPanel (warsztat) — czytelne nazwy etapów', () => {
  it('schemat pokazuje toolInput.phase, a nazwa techniczna nie świeci jako snake_case', async () => {
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

    // Czytelna nazwa fazy widoczna (schemat + log w kolumnie sterowania).
    expect((await screen.findAllByText('Diagnoza')).length).toBeGreaterThanOrEqual(1);
    // Surowy identyfikator rejestru nie pojawia się nigdzie w UI.
    expect(screen.queryByText('get_assessment_data')).toBeNull();
    // Zamiast niego — czytelna etykieta narzędzia z katalogu warsztatu.
    expect(screen.getAllByText(/Assessment data/).length).toBeGreaterThanOrEqual(1);
  });

  it('krok bez toolInput.phase dostaje czytelną etykietę narzędzia zamiast snake_case', async () => {
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

    expect((await screen.findAllByText('Search knowledge')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('search_knowledge_base')).toBeNull();
  });

  it('sekcja "Zgody" pokazuje czytelną nazwę fazy i przycisk zatwierdzenia', async () => {
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

    // Krok pojawia się w schemacie, w logu przebiegu i w sekcji Zgody.
    const matches = await screen.findAllByText('Wdrożenie');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('calculate_financial')).toBeNull();
    expect(screen.getByRole('button', { name: /zatwierdź krok/i })).toBeInTheDocument();
  });

  it('krok w toku jest wskazany JEDNOCZEŚNIE w schemacie i w kolumnie sterowania', async () => {
    getAgentPlan.mockResolvedValue({
      plan: makePlan({
        status: 'executing',
        totalSteps: 2,
        completedSteps: 1,
        currentStepIndex: 1,
        steps: [
          makeStep({
            id: 's1',
            stepIndex: 0,
            toolName: 'search_knowledge_base',
            toolInput: { phase: 'Wejście' },
            status: 'completed',
          }),
          makeStep({
            id: 's2',
            stepIndex: 1,
            toolName: 'get_assessment_data',
            toolInput: { phase: 'Diagnoza' },
            status: 'running',
          }),
        ],
      }),
    });

    render(<AgentPlanPanel planId="plan-1" />);

    // Wskazanie w kolumnie sterowania („Teraz — krok 2 z 2").
    const current = await screen.findByTestId('agent-controls-current');
    expect(current).toHaveTextContent('Diagnoza');
    // Wskazanie w schemacie — obwódka + plakietka na TEJ SAMEJ karcie.
    expect(screen.getByTestId('canvas-current-badge')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-block-1')).toHaveAttribute('data-current', 'true');
  });
});
