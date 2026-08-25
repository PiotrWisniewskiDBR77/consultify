import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

import { SummaryStep } from '../SummaryStep';

// 2026-08-26 night-fixes-a P0 (NIGHT_SWEEP_A_REPORT_20260826.md #3, spec
// SWOT-003 §6.16/R19 "Results & Readiness"): this suite used to cover the
// Vault attach/list widget and the "Open Report Generator"/"Open Candidate
// Inbox" launcher buttons that lived on this step. The owner explicitly
// rejected those (they duplicate each object's own dedicated generator) and
// they were removed — see `SummaryStep.tsx`'s `dedicatedOutputs` branch.
// Rewritten to cover what the step does now: a read-only Results & Readiness
// assessment built only from data already loaded into the session (no Vault
// fetch, no navigation launchers).
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => navigateMock,
}));

describe('SummaryStep Dynamic SWOT — Results & Readiness', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
    useToolStore.getState().createSession('dynamic-swot');
  });

  it('renders exactly one Results & Readiness surface with no deliverable launchers or Vault widget', async () => {
    const session = useToolStore.getState().currentSession!;
    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    // The repo's global `react-i18next` test mock (tests/setup.ts) returns the
    // raw translation KEY, not the resolved PL/EN string — so assertions here
    // target the key, same convention every other test in this suite uses.
    expect(screen.getAllByTestId('swot-dedicated-outputs')).toHaveLength(1);
    expect(
      screen.getByText('discoveryToolsSteps.summaryStep.dynamicSwot.resultsReadiness.title')
    ).toBeInTheDocument();

    // Removed per spec SWOT-003 §6.16 "Usuwane elementy" — these must never
    // reappear on this step (their own dedicated generators own them now).
    expect(screen.queryByRole('button', { name: /Open Report Generator/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Candidate Inbox/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Vault$/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Source files in Vault/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Attach file/i)).not.toBeInTheDocument();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('scores completion from only 4 checklist items — "Initiatives defined" is no longer a completion condition', async () => {
    const session = useToolStore.getState().currentSession!;
    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    // Freshly created session: no mission goal/scope, no SWOT items, no
    // insights, no recommendations yet — 0 of 4 done.
    expect(await screen.findByText('0/4')).toBeInTheDocument();
    expect(
      screen.queryByText('discoveryToolsSteps.summaryStep.dynamicSwot.readiness.initiativesDefined')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'discoveryToolsSteps.summaryStep.dynamicSwot.resultsReadiness.overall.notReady'
      )
    ).toBeInTheDocument();
  });

  it('lists every unmet checklist item under Open blockers, and shows an honest empty state for the final summary', async () => {
    const session = useToolStore.getState().currentSession!;
    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    expect(
      screen.getByText('discoveryToolsSteps.summaryStep.dynamicSwot.resultsReadiness.openBlockers')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• discoveryToolsSteps.summaryStep.dynamicSwot.readiness.missionBrief')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• discoveryToolsSteps.summaryStep.dynamicSwot.readiness.swotFactors')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• discoveryToolsSteps.summaryStep.dynamicSwot.readiness.strategicInsights')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '• discoveryToolsSteps.summaryStep.dynamicSwot.readiness.recommendationsOrMoves'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText('discoveryToolsSteps.summaryStep.dynamicSwot.resultsReadiness.finalSummary')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'discoveryToolsSteps.summaryStep.dynamicSwot.resultsReadiness.finalSummaryEmpty'
      )
    ).toBeInTheDocument();
  });
});
