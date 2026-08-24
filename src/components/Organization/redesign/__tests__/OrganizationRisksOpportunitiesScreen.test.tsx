/**
 * „Ryzyka i szanse" — siódmy ekran redesignu (etap B).
 * Sprawdzamy: dwie sekcje z dawnych ekranów Syntezy na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().synthesis`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationRisksOpportunitiesScreen from '../OrganizationRisksOpportunitiesScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationRisksOpportunitiesScreen>
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
    </OrganizationRisksOpportunitiesScreen>
  );
}

describe('OrganizationRisksOpportunitiesScreen', () => {
  const updateSynthesisList = vi.fn();

  beforeEach(() => {
    updateSynthesisList.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      synthesis: {
        risks: [{ id: 'r1', risk: 'Opór kadry średniej', why: '', severity: 'High', mitigation: '' }],
        strengths: [],
        selectedScenarioId: '',
      },
      updateSynthesisList,
    } as never);
  });

  it('scala dawne dwa ekrany Syntezy w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-risks')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-strengths')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Opór kadry średniej')).toBeInTheDocument();
  });

  it('dodanie szansy trafia do updateSynthesisList("strengths", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj szansę'));
    expect(updateSynthesisList).toHaveBeenCalledWith(
      'strengths',
      expect.arrayContaining([expect.objectContaining({ enabler: '' })])
    );
  });

  it('edycja ryzyka trafia do updateSynthesisList("risks", …)', () => {
    renderScreen();

    fireEvent.change(screen.getByDisplayValue('Opór kadry średniej'), {
      target: { value: 'Opór kadry średniej i związkowej' },
    });
    expect(updateSynthesisList).toHaveBeenCalledWith(
      'risks',
      expect.arrayContaining([expect.objectContaining({ risk: 'Opór kadry średniej i związkowej' })])
    );
  });
});
