/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactRightPanel } from '../ArtifactRightPanel';

const actions = {
  id: 'actions',
  label: 'Akcje',
  defaultOpen: true,
  children: <button type="button">Zwykła akcja</button>,
};

/**
 * DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): przycisk „Zapytaj
 * Teresę o …" w sekcji Akcje USUNIĘTY — jedyne wejście do Teresy jest teraz
 * w Menu 1 (DEC-404). Ten test pilnował ODWROTNEGO kontraktu (P8, do 06.09);
 * teraz pilnuje, że `teresaEntry` NIE RENDERUJE SIĘ, nawet gdy wołający go
 * jeszcze przekazuje (prop zostaje w typie jako deprecated, patrz
 * ArtifactRightPanel.tsx).
 *
 * MUTACJA: przywróć render `<TeresaEntryButton>` w `ArtifactRightPanel` →
 * ten test RED.
 */
describe('ArtifactRightPanel Teresa entry (DEC-419: usunięty)', () => {
  it('nie renderuje przycisku Teresy, nawet gdy wołający przekazuje teresaEntry', () => {
    render(
      <ArtifactRightPanel
        sections={[actions]}
        teresaEntry={{ label: 'Zapytaj Teresę o obiekt', onOpen: vi.fn() }}
      />
    );
    expect(screen.queryByTestId('teresa-entry')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zapytaj Teresę o obiekt' })).not.toBeInTheDocument();
    const section = document.querySelector('[data-artifact-section="actions"]');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getAllByRole('button')).toHaveLength(1);
    expect(within(section as HTMLElement).getByRole('button')).toHaveTextContent('Zwykła akcja');
  });

  it('leaves Actions unchanged without the prop', () => {
    render(<ArtifactRightPanel sections={[actions]} />);
    expect(screen.queryByTestId('teresa-entry')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zwykła akcja' })).toBeInTheDocument();
  });
});
