/**
 * @vitest-environment jsdom
 *
 * K5 — naprawy defektów widocznych na zrzutach żywego stagingu (2026-09-13,
 * org DBR77). Każdy `it` odpowiada jednemu defektowi z listy odbioru:
 *
 *   R1 — kolumna OWNER pokazywała surowy UUID `d2b6a316-…`, kanban awatar „D2".
 *   R2 — LIFECYCLE „UNKNOWN" jako chip + trzy linie prozy („Progress not
 *        reported" / „Baseline not set" / „Forecast not available") w każdej
 *        komórce każdego wiersza.
 *   R5 — „Open" w kebabie bez ikony obok „Open preview" z ikoną.
 *
 * DANE TESTOWE ODWZOROWUJĄ STAGING: realizacja `demo-story-…-execution-oee`
 * wskazuje na inicjatywę, której NIE MA w portfelu (`/api/initiatives` zwraca
 * dla niej 404 — aggregat żyje tylko w `ie_aggregate_state`), a jej
 * `executionManagerId` to identyfikator BEZ konta w tabeli `users`. Właśnie ta
 * para braków produkowała UUID na ekranie.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExecutionBankViews } from '@/components/Execution/ExecutionBankViews';
import {
  buildExecutionBankRows,
  buildExecutionCalendarWindow,
} from '@/components/Execution/executionBankModel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

afterEach(cleanup);

const ORPHAN_MANAGER_ID = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';

const stagingRows = () =>
  buildExecutionBankRows(
    [
      {
        id: 'initiative-in-execution',
        name: 'Automatyzacja magazynu WIP',
        lifecycleStatus: 'IN_EXECUTION',
        ownerId: 'user-marek',
        ownerName: 'Marek Nowak',
      },
    ],
    [
      {
        executionCaseId: 'demo-story-20260826-execution-oee',
        initiativeId: 'demo-story-20260826-initiative-oee',
        initiativeTitle: 'Program poprawy OEE linii montażowej',
        version: 1,
        state: 'ACTIVE',
        executionManagerId: ORPHAN_MANAGER_ID,
      } as never,
    ],
    { asOf: '2026-09-13T10:10:00.000Z' }
  );

const renderBank = (
  view: 'table' | 'kanban',
  resolveOwnerName?: (id: string) => string | null
) =>
  render(
    <ExecutionBankViews
      rows={stagingRows()}
      view={view}
      selected={null}
      calendarWindow={buildExecutionCalendarWindow('2026-09-13', 3)}
      onSelect={vi.fn()}
      onOpen={vi.fn()}
      onHorizonChange={vi.fn()}
      onDrilldownMonth={vi.fn()}
      resolveOwnerName={resolveOwnerName}
    />
  );

describe('K5-R1 — bank realizacji nigdy nie pokazuje identyfikatora osoby', () => {
  it('rozwiązuje identyfikatora na nazwisko z katalogu organizacji', () => {
    renderBank('table', (id) => (id === ORPHAN_MANAGER_ID ? 'Paweł Mroczkowski' : null));

    expect(screen.getByText('Paweł Mroczkowski')).toBeTruthy();
    expect(document.body.textContent).not.toContain(ORPHAN_MANAGER_ID);
  });

  it('gdy katalog nie zna identyfikatora, pokazuje „Unknown user", nie UUID', () => {
    renderBank('table', () => null);

    expect(screen.getByText('Unknown user')).toBeTruthy();
    expect(document.body.textContent).not.toContain(ORPHAN_MANAGER_ID);
    expect(document.body.textContent).not.toContain('d2b6a316');
  });

  it('kanban nie buduje awatara ze skrótu UUID („D2")', () => {
    renderBank('kanban', () => null);

    expect(document.body.textContent).not.toContain(ORPHAN_MANAGER_ID);
    expect(screen.queryByText('D2')).toBeNull();
  });
});

describe('K5-R2 — statusy po ludzku, luki danych jako ciche „—"', () => {
  it('nie renderuje surowego enuma statusu ani chipa „UNKNOWN"', () => {
    renderBank('table', () => null);

    expect(screen.queryByText('UNKNOWN')).toBeNull();
    expect(screen.queryByText('IN_EXECUTION')).toBeNull();
    expect(screen.getByText('In execution')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('wiersz bez realizacji mówi wprost „No execution case yet"', () => {
    renderBank('table', () => null);

    const caseless = screen
      .getByTestId('execution-bank-table-item-initiative:initiative-in-execution')
      .closest('tr');
    expect(caseless).toHaveTextContent('No execution case yet');
  });

  it('luki danych stoją myślnikiem, a powód siedzi w podpowiedzi', () => {
    renderBank('table', () => null);

    expect(screen.queryByText('Progress not reported')).toBeNull();
    expect(screen.queryByText('Baseline not set')).toBeNull();
    expect(document.querySelector('[title="Progress not reported"]')).not.toBeNull();
    expect(document.querySelector('[title="Baseline not set"]')).not.toBeNull();
  });
});

describe('K5-R5 — „Open" w kebabie ma ikonę, tak jak „Open preview"', () => {
  it('renderuje ikonę przy akcji głównej wiersza', async () => {
    renderBank('table', () => null);

    const kebab = screen.getAllByRole('button', { name: 'Row actions' })[0];
    fireEvent.click(kebab);

    const open = await screen.findByText('Open');
    const item = open.closest('button') ?? open.parentElement;
    expect(item?.querySelector('svg')).not.toBeNull();
  });
});
