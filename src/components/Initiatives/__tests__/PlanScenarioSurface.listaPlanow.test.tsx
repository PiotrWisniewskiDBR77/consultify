/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listPlanScenarioRegister, readPlanScenario } = vi.hoisted(() => ({
  listPlanScenarioRegister: vi.fn(),
  readPlanScenario: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key, i18n: { language: 'pl' } }),
}));
vi.mock('@/i18n', () => ({ default: { language: 'pl', t: (_key: string, fallback?: string) => fallback ?? _key } }));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(async () => ({ versions: [] })),
  createPlanAnalysisProposal: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  writePlanScenario: vi.fn(),
  RuntimeApiError: class RuntimeApiError extends Error {},
}));

import { PlanScenarioSurface } from '../PlanScenarioSurface';

describe('P11 — lista planów', () => {
  beforeEach(() => {
    listPlanScenarioRegister.mockResolvedValue({
      scenarios: [{
        id: 'plan-123456789', name: 'Plan modernizacji zakładu', state: 'DRAFT', version: 1,
        portfolioRef: { scenarioId: 'portfolio-123456789', scenarioVersion: 2 },
        window: { earliest: '2026-09-01T00:00:00.000Z', latest: '2026-12-01T00:00:00.000Z' },
        updatedAt: '2026-09-06T10:00:00.000Z', initiativeCount: 2, conflicts: 0,
        author: 'Anna Kowalska',
        timeBasis: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: [], knowledgeState: 'KNOWN' },
      }],
    });
    readPlanScenario.mockResolvedValue({ version: 1, scenario: {
      scenarioId: 'plan-123456789', name: 'Plan modernizacji zakładu', scenarioVersion: 1,
      status: 'DRAFT', portfolioScenarioId: 'portfolio-123456789', portfolioScenarioVersion: 2,
      windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: [], windows: [], assumptions: [],
      createdBy: 'Anna Kowalska', updatedBy: 'Anna Kowalska', publishedBy: null, publishedAt: null,
    }});
  });

  it('pierwszą kolumną jest nazwa planu, a inicjatywy nie stają się wierszami listy', async () => {
    render(<MemoryRouter><PlanScenarioSurface activePreset="all" initiatives={[{ id: 'ie-1', name: 'Inicjatywa nie jest wierszem' }]} /></MemoryRouter>);
    expect(await screen.findAllByText('Plan modernizacji zakładu')).not.toHaveLength(0);
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Nazwa');
    expect(screen.queryByText('Inicjatywa nie jest wierszem')).not.toBeInTheDocument();
  });
});
