import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CanonicalInitiativeRegister } from '../CanonicalInitiativeRegister';

/**
 * A19 + A13 (uwagi właściciela 2026-09-05).
 *
 * Zrzut PRZED (`evidence/inicjatywy-tabela-20260905/01-przed-ocena-inicjatywy.png`):
 * zakładka Inicjatywy w Ocenie miała te same 10 kolumn co /initiatives, ale
 * SZEŚĆ z nich pokazywało „—" / „Nieznane" w każdym wierszu, bo rekordy Oceny
 * niosą legacy `InitiativeStatus` (DRAFT), a nie `lifecycleState`
 * (REGISTERED_DRAFT). Ten test sprawdza WYRENDEROWANY wiersz, nie źródło.
 */
const legacyAssessmentRow = {
  id: 'assessment-draft-1',
  title: 'Automated Change Management',
  name: 'Automated Change Management',
  summary: 'Zmiany wchodzą bez kontroli wersji.',
  status: 'DRAFT',
  updatedAt: '2026-08-10T08:00:00.000Z',
  sourceLabel: 'Ocena: DRD',
} as never;

const renderRegister = (props: Record<string, unknown> = {}) =>
  render(
    <CanonicalInitiativeRegister
      rows={[legacyAssessmentRow]}
      selectedId={null}
      onSelect={vi.fn()}
      onOpen={vi.fn()}
      persistKey="test.a19.register"
      emptyTitle="Pusto"
      emptyDescription="Pusto"
      {...props}
    />
  );

const bodyRow = () => {
  const rows = screen.getAllByRole('row');
  // [0] to nagłówek tabeli.
  return rows[rows.length - 1];
};

describe('A19 — jedna tabela inicjatyw także dla rekordów Oceny', () => {
  it('wylicza bramkę i następne działanie z legacy statusu zamiast drukować „—"', () => {
    renderRegister();
    const cells = within(bodyRow());

    expect(cells.getByText('Szkic zarejestrowany')).toBeInTheDocument();
    expect(cells.getByText('Definicja')).toBeInTheDocument();
    expect(cells.getByText('Uzupełnij definicję')).toBeInTheDocument();
    // Brak oceny bramki to „Nie oceniono", nie angielskie/puste „Nieznane".
    expect(cells.getByText('Nie oceniono')).toBeInTheDocument();
  });

  it('kolumna kontekstu „Źródło" pojawia się TYLKO jako opcja tej samej definicji', () => {
    const { unmount } = renderRegister();
    expect(screen.queryByRole('columnheader', { name: /Źródło/ })).not.toBeInTheDocument();
    unmount();

    renderRegister({ columnOptions: { includeSource: true } });
    expect(screen.getByRole('columnheader', { name: /Źródło/ })).toBeInTheDocument();
    expect(within(bodyRow()).getByText('Ocena: DRD')).toBeInTheDocument();
  });

  it('niesie kanoniczny kebab wiersza (pozycja „Otwórz") na każdej powierzchni', () => {
    renderRegister({ columnOptions: { includeSource: true } });
    expect(within(bodyRow()).getByRole('button', { name: /Row actions|Akcje/i })).toBeInTheDocument();
  });
});
