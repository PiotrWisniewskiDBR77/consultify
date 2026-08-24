/**
 * „Cele i mierniki" — trzeci ekran redesignu (etap B).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Celów na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().goals`, edycja KPI przez
 * `OrgRecordList` trafia do tego samego store'u co stary ekran.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationGoalsMetricsScreen from '../OrganizationGoalsMetricsScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationGoalsMetricsScreen>
      {(args) => (
        <div>
          {args.chips.map((chip) => (
            <span key={chip.id} data-testid={`chip-${chip.id}`}>
              {chip.label}:{chip.count}
            </span>
          ))}
          {args.content}
          <OrganizationStatePanel {...args.statePanel} />
        </div>
      )}
    </OrganizationGoalsMetricsScreen>
  );
}

describe('OrganizationGoalsMetricsScreen', () => {
  const setGoals = vi.fn();
  const updateGoalsList = vi.fn();

  beforeEach(() => {
    setGoals.mockReset();
    updateGoalsList.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      goals: {
        primaryObjective: 'Zostać liderem rynku w 3 lata',
        secondaryObjectives: '',
        topPriorities: ['eff'],
        kpis: [{ id: 'k1', name: 'OEE', baseline: '60%', target: '85%', timeframe: '12m' }],
        inScope: [],
        outScope: [],
        noGo: [],
        transformationArchetype: '',
        aiRole: '',
        steeringCadence: '',
      },
      setGoals,
      updateGoalsList,
    } as never);
  });

  it('scala dawne dwa ekrany Celów w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-intent')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-metrics')).toBeInTheDocument();
    expect(screen.getByLabelText('Cel nadrzędny')).toHaveValue('Zostać liderem rynku w 3 lata');
    expect(screen.getByDisplayValue('OEE')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:4');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:3');
  });

  it('edycja pola trafia do tego samego store, co stary ekran (setGoals)', () => {
    renderScreen();

    fireEvent.change(screen.getByLabelText('Cele drugorzędne'), {
      target: { value: 'Redukcja emisji CO2' },
    });
    expect(setGoals).toHaveBeenCalledWith({ secondaryObjectives: 'Redukcja emisji CO2' });
  });

  it('dodanie KPI trafia do updateGoalsList("kpis", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj miernik'));
    expect(updateGoalsList).toHaveBeenCalledWith(
      'kpis',
      expect.arrayContaining([expect.objectContaining({ name: 'OEE' }), expect.objectContaining({ name: '' })])
    );
  });
});
