/**
 * „Ryzyka i szanse" — siódmy ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych ekranów Syntezy na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().synthesis` (bufor edycji) ORAZ że
 * „Zapisz zmiany" woła `contextSync.saveNow()` — JEDYNY pisarz do
 * `/organization-context-store` (DEC-2026-08-24-15 warunek (a)).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgContextSyncHandle } from '../useOrgContextStoreSection';
import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationRisksOpportunitiesScreen from '../OrganizationRisksOpportunitiesScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// See OrganizationGoalsMetricsScreen.test.tsx header comment — minimal stub
// to short-circuit the real services/api.ts → i18n init transitive import.
vi.mock('../../../../services/api', () => ({ Api: {} }));

function makeContextSync(overrides?: Partial<OrgContextSyncHandle>): OrgContextSyncHandle {
  return {
    saveNow: vi.fn().mockResolvedValue(true),
    isSyncing: false,
    isUnsynced: false,
    ...overrides,
  };
}

function renderScreen(contextSync: OrgContextSyncHandle = makeContextSync()) {
  return render(
    <OrganizationRisksOpportunitiesScreen contextSync={contextSync}>
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

const SYNTHESIS_FIXTURE = {
  risks: [{ id: 'r1', risk: 'Opór kadry średniej', why: '', severity: 'High', mitigation: '' }],
  strengths: [],
  selectedScenarioId: '',
};

describe('OrganizationRisksOpportunitiesScreen', () => {
  const updateSynthesisList = vi.fn();

  beforeEach(() => {
    updateSynthesisList.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      synthesis: SYNTHESIS_FIXTURE,
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

  it('„Zapisz zmiany" woła contextSync.saveNow() — JEDYNY pisarz do serwera', () => {
    const contextSync = makeContextSync();
    renderScreen(contextSync);

    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    expect(contextSync.saveNow).toHaveBeenCalledTimes(1);
  });

  it('gdy contextSync.isUnsynced=true, panel pokazuje napis o buforze lokalnym', () => {
    renderScreen(makeContextSync({ isUnsynced: true }));

    expect(
      screen.getByText(/Dane zapisywane są lokalnie \(bufor roboczy\)/)
    ).toBeInTheDocument();
  });
});
