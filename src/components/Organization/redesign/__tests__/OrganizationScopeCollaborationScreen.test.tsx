/**
 * „Zakres i tryb współpracy" — czwarty ekran redesignu (etap B).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Celów na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().goals`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationScopeCollaborationScreen from '../OrganizationScopeCollaborationScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationScopeCollaborationScreen>
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
    </OrganizationScopeCollaborationScreen>
  );
}

describe('OrganizationScopeCollaborationScreen', () => {
  const setGoals = vi.fn();
  const updateGoalsList = vi.fn();

  beforeEach(() => {
    setGoals.mockReset();
    updateGoalsList.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      goals: {
        primaryObjective: '',
        secondaryObjectives: '',
        topPriorities: [],
        kpis: [],
        inScope: [{ id: 's1', item: 'Zakład A', notes: 'Pełny audyt' }],
        outScope: [],
        noGo: [],
        transformationArchetype: 'fast',
        aiRole: '',
        steeringCadence: '',
      },
      setGoals,
      updateGoalsList,
    } as never);
  });

  it('scala dawne dwa ekrany Celów w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-scope')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-collaboration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Zakład A')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:5');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:2');
  });

  it('wybór segmentu trafia do tego samego store, co stary ekran (setGoals)', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('radio', { name: 'Współpilot' }));
    expect(setGoals).toHaveBeenCalledWith({ aiRole: 'partner' });
  });

  it('dodanie pozycji zakresu trafia do updateGoalsList("inScope", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj obszar'));
    expect(updateGoalsList).toHaveBeenCalledWith(
      'inScope',
      expect.arrayContaining([
        expect.objectContaining({ item: 'Zakład A' }),
        expect.objectContaining({ item: '' }),
      ])
    );
  });
});
