/**
 * @vitest-environment jsdom
 *
 * K5-7 — SZEROKOŚCI KOLUMN „PRACA" (odbiór na żywo, staging `c1e8fba7c2`,
 * jasny motyw, zrzut `k5d-work-podglad-jasny.png`).
 *
 * ODCHYLENIE ZMIERZONE: kolumny DUE i STATUS zlewają się bez odstępu w
 * części wierszy („05/02/2026Done", „08/02/2026To do"), w jednym wiersz
 * łamie STATUS do nowej linii.
 *
 * PRZYCZYNA (zmierzona w kodzie, nie z oka): `buildCols` (`ExecutionWorkSurface.tsx`)
 * nie deklarował `dataType` na kolumnach `owner`/`dueAt`/`status`/`slipDays`.
 * `getColumnFitFloor` (`FilterableTable.tsx`, K5-7 2026-09-13) daje podłogę
 * TYPU (110/130/150 px) wyłącznie, gdy moduł ją zadeklarował — kolumna bez
 * `dataType` siada na podłodze LICZBOWEJ (90 px, `FIT_MIN_COLUMN_WIDTH`)
 * podbitej co najwyżej zmierzonym nagłówkiem. 90 px nie mieści ani chipa
 * statusu, ani „05/02/2026" — i bez `overflow-hidden` na komórce (świadome,
 * patrz `columnWidthCanon.ts` — komórki niosą popovery bez portalu) treść
 * wylewa się w prawo, na sąsiednią kolumnę.
 *
 * UWAGA TECHNICZNA: `headerFloors` (`FilterableTable.tsx`) mierzy nagłówek
 * przez Canvas 2D i — bez FALLBACKU — siada cicho na 0, gdy `getContext('2d')`
 * zwraca `null` (dokładnie to robi jsdom bez pakietu `canvas`, którego ten
 * projekt nie instaluje). Bez mocka canvasu poniższe testy renderowałyby
 * nagłówek z podłogą 0 i NIE ŁAPAŁYBY mutacji (`dataType` przestałby robić
 * jakąkolwiek różnicę). Dlatego każdy test renderujący `ExecutionWorkSurface`
 * mockuje `HTMLCanvasElement.prototype.getContext` na 7 px/znak — tak samo,
 * jak `FilterableTable.columnWidth.test.tsx`.
 *
 * DOWÓD MUTACYJNY: skasowanie `dataType: 'owner'|'status'` w
 * `ExecutionWorkSurface.tsx` cofa podłogę zjazdu do ~90 px i łamie pierwszy
 * test niżej (zmierzone ręcznie: `owner` 150→131 px, `status` 130→90 px).
 */
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COLUMN_MIN_WIDTH_BY_DATA_TYPE,
  getColumnFitFloor,
} from '../../shared/ModuleHub/FilterableTable';
import { CELL_CONTENT_PADDING_PX } from '../../shared/ModuleHub/columnWidthCanon';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({
      currentUser: { id: 'user-anna' },
      currentOrganization: { id: 'org-1' },
    }),
}));

const { getOrganizationMembers } = vi.hoisted(() => ({ getOrganizationMembers: vi.fn() }));
vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers },
}));

const { listExecutionCases, readExecutionWork } = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases,
  readExecutionWork,
  readOperationalAllocations: vi.fn(),
  readExecutionCase: vi.fn(),
  readExecutionMilestones: vi.fn(),
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  createExecutionMilestone: vi.fn(),
  proposeOperationalAllocation: vi.fn(),
  simulateOperationalAllocation: vi.fn(),
  acceptResourceCommitment: vi.fn(),
  requestResourceCommitment: vi.fn(),
  decideResourceCommitment: vi.fn(),
  assessOperationalAllocation: vi.fn(),
  confirmOperationalAllocation: vi.fn(),
  releaseOperationalAllocation: vi.fn(),
}));

import { ExecutionWorkSurface } from '../ExecutionWorkSurface';

/** Dwa wiersze DOKŁADNIE jak w repro zrzutu odbiorowego: zamknięty (bez
 * osoby) i otwarty (z osobą i terminem) — „05/02/2026Done"/„08/02/2026To do". */
beforeEach(() => {
  vi.clearAllMocks();
  // Kanon mierzy tekst przez Canvas 2D — patrz nota w nagłówku pliku.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (t: string) => ({ width: t.length * 7 }),
  } as unknown as CanvasRenderingContext2D);
  getOrganizationMembers.mockResolvedValue([
    {
      id: 'membership-1',
      user_id: 'user-anna',
      first_name: 'Anna',
      last_name: 'Kowalska',
      email: 'anna.kowalska@dbr77.com',
    },
  ]);
  listExecutionCases.mockResolvedValue({
    cases: [{ executionCaseId: 'case-ok', initiativeId: 'init-ok', initiativeTitle: 'Security' }],
  });
  readExecutionWork.mockResolvedValue({
    tasks: [
      {
        taskId: 'task-1',
        title: 'Close the security audit',
        status: 'DONE',
        assigneeId: '',
        dueAt: '2026-02-05T00:00:00.000Z',
        version: 1,
        evidenceRefs: [],
      },
      {
        taskId: 'task-2',
        title: 'Approve the supplier data scope',
        status: 'TODO',
        assigneeId: 'user-anna',
        dueAt: '2026-02-08T00:00:00.000Z',
        version: 1,
        evidenceRefs: [],
      },
    ],
    decisions: [],
  });
});

afterEach(() => vi.restoreAllMocks());

const headerWidth = (container: HTMLElement, columnId: string): number => {
  const th = container.querySelector<HTMLTableCellElement>(`th[data-column-id="${columnId}"]`);
  if (!th) throw new Error(`Brak kolumny ${columnId} w wyrenderowanej tabeli`);
  return Number.parseInt(th.style.width, 10);
};

describe('ExecutionWorkSurface — podłogi typu OWNER/DUE/STATUS/DAYS OVERDUE', () => {
  it('kolumny buildCols deklarują dataType — podłoga zjazdu NIE jest liczbowa (90 px)', async () => {
    const { container, getByText } = render(
      <MemoryRouter>
        <ExecutionWorkSurface activePreset="all" />
      </MemoryRouter>
    );

    await waitFor(() => expect(getByText('Close the security audit')).toBeInTheDocument());

    // Podłogi z DEKLAROWANEGO typu (K5-7): 150/110/130/90 px — NIE ~90 px,
    // jak dawałaby podłoga liczbowa bez `dataType`.
    expect(headerWidth(container, 'owner')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.owner
    );
    expect(headerWidth(container, 'dueAt')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.date
    );
    expect(headerWidth(container, 'status')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.status
    );
    expect(headerWidth(container, 'slipDays')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.number
    );
  });

  it('kolumna DAYS OVERDUE jest wyrównana do prawej (kanon §3.3: liczby/metryki)', async () => {
    const { container, getByText } = render(
      <MemoryRouter>
        <ExecutionWorkSurface activePreset="all" />
      </MemoryRouter>
    );
    await waitFor(() => expect(getByText('Close the security audit')).toBeInTheDocument());

    const th = container.querySelector<HTMLTableCellElement>('th[data-column-id="slipDays"]');
    expect(th?.className).toContain('text-right');
  });
});

describe('Podłoga STATUS ≥ najdłuższy chip statusu Pracy + padding komórki', () => {
  /** Ten sam pomiar deterministyczny, co w `columnWidthCanon.test.ts` (7 px/znak). */
  const measure = (text: string) => text.length * 7;
  // Etykiety realnie renderowane w kolumnie STATUS Pracy (`workStatusLabel`,
  // `ExecutionWorkSurface.tsx`) — „Conditionally approved" jest z rejestru
  // Decyzji, nie zadań, więc NIE wchodzi do tego zbioru.
  const ETYKIETY_PRACY = [
    'Draft',
    'Open',
    'Blocked',
    'Completed',
    'Cancelled',
    'Ready',
    'At risk',
    'In progress',
    'No data',
  ];

  it('130 px (podłoga status) mieści najdłuższy realny chip Pracy + padding', () => {
    const najszerszy = Math.max(...ETYKIETY_PRACY.map(measure));
    expect(COLUMN_MIN_WIDTH_BY_DATA_TYPE.status).toBeGreaterThanOrEqual(
      najszerszy + CELL_CONTENT_PADDING_PX
    );
  });

  it('bez deklaracji typu podłoga (nagłówek) NIE wystarcza na chip "In progress"', () => {
    // To jest DOWÓD PRZYCZYNY, nie regresja: mierzy dokładnie to zachowanie,
    // które K5-7 naprawia deklaracją `dataType: 'status'` w `ExecutionWorkSurface`.
    const potrzeba = measure('In progress') + CELL_CONTENT_PADDING_PX;
    const podlogaBezTypu = getColumnFitFloor({ id: 'status', label: 'Status' });
    expect(podlogaBezTypu).toBeLessThan(potrzeba);

    const podlogaZTypem = getColumnFitFloor({ id: 'status', label: 'Status', dataType: 'status' });
    expect(podlogaZTypem).toBeGreaterThanOrEqual(potrzeba);
  });
});
