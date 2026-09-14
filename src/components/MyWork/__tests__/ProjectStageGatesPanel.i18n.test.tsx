import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import pl from '../../../../public/locales/pl/translation.json';
import { ProjectStageGatesPanel } from '../ProjectStageGatesPanel';

const api = vi.hoisted(() => ({
  getProjectCurrentStageGate: vi.fn(),
  getProjectStageGateHistory: vi.fn(),
  passProjectStageGate: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      const translated = key
        .split('.')
        .reduce<unknown>(
          (value, part) =>
            value && typeof value === 'object'
              ? (value as Record<string, unknown>)[part]
              : undefined,
          pl
        );
      if (typeof translated === 'string') return translated;
      return typeof fallback === 'string' ? fallback : fallback?.defaultValue || key;
    },
  }),
}));

describe('ProjectStageGatesPanel criterion localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProjectCurrentStageGate.mockResolvedValue({
      currentPhase: 'Assessment',
      nextGate: 'DESIGN_GATE',
      gateType: 'DESIGN_GATE',
      status: 'NOT_READY',
      completionCriteria: [
        { criterion: 'assessmentComplete', isMet: false, evidence: 'NOT_MET' },
        { criterion: 'gapAnalysisReviewed', isMet: false, evidence: 'NOT_MET' },
      ],
      missingElements: ['assessmentComplete', 'gapAnalysisReviewed'],
    });
    api.getProjectStageGateHistory.mockResolvedValue([]);
  });

  it('renders Polish criterion labels from stable backend keys', async () => {
    render(<ProjectStageGatesPanel projectId="project-1" />);

    expect(await screen.findByText(/Oceniono wszystkie osie/)).toBeInTheDocument();
    expect(screen.getByText(/Zweryfikowano analizę luk/)).toBeInTheDocument();
    expect(screen.queryByText(/All axes assessed|Gap analysis reviewed/)).not.toBeInTheDocument();
    expect(screen.getByText('Ocena → Inicjatywy')).toBeInTheDocument();
    expect(screen.queryByText('Assessment → Initiatives')).not.toBeInTheDocument();
  });
});
