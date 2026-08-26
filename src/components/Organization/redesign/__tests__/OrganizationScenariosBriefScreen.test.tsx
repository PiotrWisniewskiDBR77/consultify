/**
 * „Scenariusze i brief" — ósmy ekran redesignu (etap B).
 * Sprawdzamy: dwie sekcje z dawnych ekranów Syntezy na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore()` i katalogu `SCENARIOS`, zero
 * emoji (ikony `lucide-react`) i zero crimson (`OrgStatusChip`, nie
 * `bg-primary-*`).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationScenariosBriefScreen from '../OrganizationScenariosBriefScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationScenariosBriefScreen>
      {(args) => (
        <div>
          {args.content}
          <OrganizationStatePanel {...args.statePanel} />
        </div>
      )}
    </OrganizationScenariosBriefScreen>
  );
}

describe('OrganizationScenariosBriefScreen', () => {
  const setSynthesis = vi.fn();

  beforeEach(() => {
    setSynthesis.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      synthesis: { risks: [{ id: 'r1', severity: 'High' }], strengths: [], selectedScenarioId: 'ai-powered' },
      setSynthesis,
      challenges: { declaredChallenges: [{ id: 'c1', challenge: 'Braki jakościowe' }] },
      goals: { strategicGoals: [], successMetrics: [] },
      companyProfile: {
        companyName: 'Northstar',
        industry: 'Manufacturing',
        employees: '500',
        revenue: '50M',
        currentMaturityLevel: 'Level 2',
        targetMaturityLevel: 'Level 4',
        activeConstraints: [],
        constraintDetails: {},
      },
    } as never);
  });

  it('scala dawne dwa ekrany Syntezy w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-scenarios')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-brief')).toBeInTheDocument();
    expect(screen.getAllByText('AI-Powered Transformation').length).toBeGreaterThan(0);
    expect(screen.getByText('Northstar')).toBeInTheDocument();
  });

  it('klik karty scenariusza trafia do setSynthesis({ selectedScenarioId })', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Digital Foundation'));
    expect(setSynthesis).toHaveBeenCalledWith(
      expect.objectContaining({ selectedScenarioId: 'digital-foundation' })
    );
  });

  it('zero crimson: karty nie używają klas bg-primary/text-primary', () => {
    const { container } = renderScreen();
    expect(container.innerHTML).not.toMatch(/\b(bg|text|border)-primary-/);
  });
});
