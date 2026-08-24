/**
 * Szkielet ekranu: Menu 2/Menu 3 pochodzą ze `StandardModuleBar`, prawa kolumna
 * to panel stanu, a ekran bez zadeklarowanych sekcji/chipów (etap B) NIE dostaje
 * pustego paska udającego funkcję.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import OrganizationScreenShell from '../OrganizationScreenShell';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'pl' },
  }),
}));

describe('OrganizationScreenShell', () => {
  it('renderuje sekcje Menu 2, chipy Menu 3 z licznikami i panel stanu', () => {
    render(
      <OrganizationScreenShell
        sections={[
          { id: 'identity', label: 'Tożsamość' },
          { id: 'scale', label: 'Skala' },
        ]}
        activeSection="identity"
        onSectionChange={vi.fn()}
        chips={[
          { id: 'all', label: 'Wszystkie', count: 17 },
          { id: 'missing', label: 'Do uzupełnienia', count: 0 },
        ]}
        activeChip="all"
        onChipChange={vi.fn()}
        statePanel={{ filledFields: 12, totalFields: 17, approvedFacts: 26, onSave: vi.fn() }}
      >
        <p>Treść ekranu</p>
      </OrganizationScreenShell>
    );

    expect(screen.getByText('Tożsamość')).toBeInTheDocument();
    expect(screen.getByText('Skala')).toBeInTheDocument();
    // Licznik widoczny także dla zera (kanon Menu 3).
    expect(screen.getByTestId('standard-chip-missing')).toHaveTextContent('0');
    expect(screen.getByTestId('org-state-panel')).toBeInTheDocument();
    expect(screen.getByText('12/17')).toBeInTheDocument();
    expect(screen.getByText('Treść ekranu')).toBeInTheDocument();
  });

  it('bez sekcji, chipów i CTA nie renderuje paska modułu ani panelu', () => {
    render(
      <OrganizationScreenShell>
        <p>Ekran etapu B</p>
      </OrganizationScreenShell>
    );

    expect(screen.getByText('Ekran etapu B')).toBeInTheDocument();
    expect(screen.queryByTestId('org-state-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
