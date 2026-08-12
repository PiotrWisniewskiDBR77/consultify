import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PortfolioScenarioSurface } from '../../../src/components/Initiatives/PortfolioScenarioSurface';
import {
  readPortfolioScenario,
  readPortfolioScenarioDiff,
  requestPortfolioDecision,
  listPortfolioScenarioRegister,
  writePortfolioScenario,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
  readPortfolioScenario: vi.fn(),
  readPortfolioScenarioDiff: vi.fn(),
  requestPortfolioDecision: vi.fn(),
  listPortfolioScenarioRegister: vi.fn(),
  writePortfolioScenario: vi.fn(),
}));

const scenario = {
  scenarioId: 'portfolio-q4',
  scenarioVersion: 1,
  status: 'DRAFT' as const,
  scope: { portfolioId: 'project-1', goalIds: [], asOf: '2026-08-09T12:00:00.000Z' },
  model: { modelId: 'human-portfolio-v1', version: 1 },
  memberships: [
    {
      initiativeId: 'initiative-1',
      initiativeVersion: 4,
      disposition: 'INCLUDED' as const,
      scoreDecomposition: { value: 8, risk: 3, fit: 9 },
      rank: 1,
      rankOverride: null,
      coverage: { state: 'ESTIMATED' as const, value: 0.7, basis: 'Workshop' },
      overlap: { state: 'UNKNOWN' as const, value: null, reason: 'Not assessed' },
      roughDemand: {
        state: 'ESTIMATED' as const,
        value: { unit: 'FTE', low: 1, base: 2, high: 3 },
        basis: 'Rough estimate',
      },
      confidence: 'MEDIUM' as const,
      rationale: 'Balances value and risk',
    },
  ],
  decompositionKeys: ['value', 'risk', 'fit'],
  createdBy: 'owner',
  updatedBy: 'owner',
  publishedBy: null,
  publishedAt: null,
  previousPublishedVersion: null,
};

describe('PortfolioScenarioSurface', () => {
  beforeEach(() => {
    vi.mocked(readPortfolioScenario).mockReset().mockResolvedValue({ version: 1, scenario });
    vi.mocked(listPortfolioScenarioRegister)
      .mockReset()
      .mockResolvedValue({ scenarios: [{ id: 'portfolio-q4' }] });
    vi.mocked(readPortfolioScenarioDiff).mockReset().mockResolvedValue({ changes: [] });
    vi.mocked(writePortfolioScenario)
      .mockReset()
      .mockResolvedValue({ aggregateVersion: 2, response: { ...scenario, scenarioVersion: 2 } });
    vi.mocked(requestPortfolioDecision).mockReset().mockResolvedValue({ status: 'APPLIED' });
  });
  it('uses the membership projection for Menu3 filtering and counts', async () => {
    const onCountsChange = vi.fn();
    render(
      <PortfolioScenarioSurface
        portfolioId="project-1"
        initiatives={[{ id: 'initiative-1', name: 'Automation' }]}
        activePreset="included"
        onCountsChange={onCountsChange}
      />
    );
    const membershipRow = (await screen.findByText('Automation')).closest('tr')!;
    fireEvent.click(membershipRow);
    expect(screen.getByText('Portfolio membership')).toBeInTheDocument();
    await waitFor(() =>
      expect(onCountsChange).toHaveBeenCalledWith(
        expect.objectContaining({ current: 1, included: 1, excluded: 0 })
      )
    );
  });

  it('opens a persisted Initiative membership and enters the scenario Workbench', async () => {
    render(
      <PortfolioScenarioSurface
        portfolioId="project-1"
        initiatives={[{ id: 'initiative-1', name: 'Automation' }]}
      />
    );
    const row = (await screen.findByText('Automation')).closest('tr')!;
    fireEvent.click(row);
    expect(screen.getByText('Portfolio membership')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Portfolio Scenario Workbench' })).toBeNull();
    fireEvent.doubleClick(row);
    expect(
      screen.getByRole('region', { name: 'Portfolio Scenario Workbench' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Portfolio membership')).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText('Disposition initiative-1')).toHaveValue('INCLUDED');
    expect(screen.getByText('1/2/3 FTE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij narzędzia portfela' }));
    expect(screen.queryByRole('region', { name: 'Portfolio Scenario Workbench' })).toBeNull();
  });

  it('creates and publishes only a scenario proposal, then requests one Initiative Decision', async () => {
    vi.mocked(writePortfolioScenario)
      .mockResolvedValueOnce({ aggregateVersion: 1, response: scenario })
      .mockResolvedValueOnce({
        aggregateVersion: 2,
        response: {
          ...scenario,
          scenarioVersion: 2,
          status: 'PUBLISHED',
          publishedBy: 'owner',
          publishedAt: '2026-08-09T13:00:00.000Z',
        },
      });
    render(
      <PortfolioScenarioSurface
        portfolioId="project-1"
        initiatives={[{ id: 'initiative-1', name: 'Automation' }]}
      />
    );
    vi.mocked(listPortfolioScenarioRegister).mockResolvedValueOnce({ scenarios: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Nowy wariant' }));
    fireEvent.change(screen.getByLabelText('Scenario ID'), { target: { value: 'portfolio-q4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz wariant' }));
    fireEvent.change(screen.getByLabelText('Add Initiative'), {
      target: { value: 'initiative-1' },
    });
    fireEvent.change(screen.getByLabelText('Rationale initiative-1'), {
      target: { value: 'Portfolio rationale' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(writePortfolioScenario).toHaveBeenCalledWith(
        'portfolio-q4',
        expect.objectContaining({ operation: 'CREATE' })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish scenario' }));
    await waitFor(() =>
      expect(writePortfolioScenario).toHaveBeenLastCalledWith(
        'portfolio-q4',
        expect.objectContaining({ operation: 'PUBLISH' })
      )
    );
    fireEvent.change(screen.getByLabelText('Decision authority'), {
      target: { value: 'board-1' },
    });
    fireEvent.change(screen.getByLabelText('Decision due'), {
      target: { value: '2026-08-20T12:00' },
    });
    const request = screen.getByRole('button', { name: 'Request' });
    await waitFor(() => expect(request).toBeEnabled());
    fireEvent.click(request);
    await waitFor(() =>
      expect(requestPortfolioDecision).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({
          expectedVersion: 4,
          scenarioId: 'portfolio-q4',
          scenarioVersion: 2,
        })
      )
    );
  });
});
