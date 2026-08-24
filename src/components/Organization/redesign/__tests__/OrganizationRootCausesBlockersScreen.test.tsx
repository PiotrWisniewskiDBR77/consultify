/**
 * „Przyczyny i blockery" — szósty ekran redesignu (etap B).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Wyzwań na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().challenges`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationRootCausesBlockersScreen from '../OrganizationRootCausesBlockersScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationRootCausesBlockersScreen>
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
    </OrganizationRootCausesBlockersScreen>
  );
}

describe('OrganizationRootCausesBlockersScreen', () => {
  const setChallenges = vi.fn();

  beforeEach(() => {
    setChallenges.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      challenges: {
        declaredChallenges: [],
        rootCauseAnswers: { 0: 'Zarząd boi się delegować decyzje.' },
        evidence: [],
        activeBlockers: [
          { id: 'b1', type: 'Culture', title: 'Lęk przed porażką', desc: '', status: 'confirmed' },
        ],
      },
      setChallenges,
    } as never);
  });

  it('scala dawne dwa ekrany Wyzwań w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-rootcause')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-blockers')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Zarząd boi się delegować decyzje.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lęk przed porażką')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:2');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:2');
  });

  it('odpowiedź na pytanie diagnostyczne trafia do setChallenges(rootCauseAnswers)', () => {
    renderScreen();

    fireEvent.change(screen.getByDisplayValue('Zarząd boi się delegować decyzje.'), {
      target: { value: 'Zarząd boi się delegować decyzje operacyjne.' },
    });
    expect(setChallenges).toHaveBeenCalledWith({
      rootCauseAnswers: { 0: 'Zarząd boi się delegować decyzje operacyjne.' },
    });
  });

  it('dodanie blockera trafia do setChallenges(activeBlockers)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj blocker'));
    expect(setChallenges).toHaveBeenCalledWith({
      activeBlockers: expect.arrayContaining([
        expect.objectContaining({ title: 'Lęk przed porażką' }),
        expect.objectContaining({ title: '' }),
      ]),
    });
  });
});
