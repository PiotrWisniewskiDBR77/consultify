/**
 * „Wyzwania i dowody" — piąty ekran redesignu (etap B).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Wyzwań na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().challenges`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationChallengesEvidenceScreen from '../OrganizationChallengesEvidenceScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationChallengesEvidenceScreen>
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
    </OrganizationChallengesEvidenceScreen>
  );
}

describe('OrganizationChallengesEvidenceScreen', () => {
  const updateChallengesList = vi.fn();

  beforeEach(() => {
    updateChallengesList.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      challenges: {
        declaredChallenges: [
          { id: 'c1', challenge: 'Wysoki wskaźnik braków', area: 'Jakość', severity: 'High', notes: '' },
        ],
        rootCauseAnswers: {},
        evidence: [],
        activeBlockers: [],
      },
      updateChallengesList,
    } as never);
  });

  it('scala dawne dwa ekrany Wyzwań w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-challenges')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-evidence')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wysoki wskaźnik braków')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:2');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:1');
  });

  it('dodanie dowodu trafia do updateChallengesList("evidence", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj dowód'));
    expect(updateChallengesList).toHaveBeenCalledWith(
      'evidence',
      expect.arrayContaining([expect.objectContaining({ metric: '' })])
    );
  });

  it('edycja wyzwania trafia do updateChallengesList("declaredChallenges", …)', () => {
    renderScreen();

    fireEvent.change(screen.getByDisplayValue('Wysoki wskaźnik braków'), {
      target: { value: 'Wysoki wskaźnik braków (Linia 2)' },
    });
    expect(updateChallengesList).toHaveBeenCalledWith(
      'declaredChallenges',
      expect.arrayContaining([expect.objectContaining({ challenge: 'Wysoki wskaźnik braków (Linia 2)' })])
    );
  });
});
