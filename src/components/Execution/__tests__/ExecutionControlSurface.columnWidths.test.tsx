/**
 * @vitest-environment jsdom
 *
 * K5-7 — SZEROKOŚCI KOLUMN „DECYZJE" (Risk management), sam mechanizm jak
 * w tabeli Praca (`ExecutionWorkSurface.columnWidths.test.tsx`): `buildCols`
 * bez `dataType` siada na podłodze LICZBOWEJ (90 px) przy przepełnieniu,
 * zamiast na podłodze TYPU (110/130/150 px) — patrz `getColumnFitFloor`
 * w `FilterableTable.tsx`.
 *
 * ZAKRES: RAID (`buildRaidColumns`) i Sygnały (`buildDelayColumns`) deklarują
 * `dataType` na każdej kolumnie od R3/R4/R5 — nie powtarzamy tu ich testu.
 * `buildDecisionColumns` (kolumny Termin/Osoba decyzyjna/Status/Dni po
 * terminie) go NIE miał — to ten sam defekt, ta sama naprawa (K5-7 2026-09-13).
 *
 * DOWÓD MUTACYJNY: skasowanie `dataType` z `dueAt`/`decydent`/`statusLabel`
 * albo z nadpisania `kolumnaDniPoTerminie` w `buildDecisionColumns` cofa
 * podłogę do 90 px i łamie test niżej.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COLUMN_MIN_WIDTH_BY_DATA_TYPE } from '../../shared/ModuleHub/FilterableTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1' }, currentOrganization: { id: 'org-1' } }),
}));

const {
  apiGet,
  raidList,
  createDecision,
  decideDecision,
  escalateDecision,
  getOrganizationMembers,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  raidList: vi.fn(),
  createDecision: vi.fn(),
  decideDecision: vi.fn(),
  escalateDecision: vi.fn(),
  getOrganizationMembers: vi.fn(),
}));
vi.mock('@/services/api', () => ({
  Api: { get: apiGet, raidList, createDecision, decideDecision, escalateDecision },
  ApiError: class ApiError extends Error {
    errorCode: string;
    status?: number;
    constructor(payload: any, fallback: string, status?: number) {
      super(String(payload?.error ?? fallback));
      this.errorCode = String(payload?.code ?? 'INTERNAL').toUpperCase();
      this.status = status;
    }
  },
}));
vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers },
}));

const { listInterventions, listManagementSignals, listCapacityOptions } = vi.hoisted(() => ({
  listInterventions: vi.fn(),
  listManagementSignals: vi.fn(),
  listCapacityOptions: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listInterventions,
  listManagementSignals,
  listCapacityOptions,
  createMaterialChange: vi.fn(),
  draftIntervention: vi.fn(),
  ingestManagementSignal: vi.fn(),
  transitionIntervention: vi.fn(),
}));

import { ExecutionControlSurface } from '../ExecutionControlSurface';

const DECYZJE = [
  {
    id: 'dec-1',
    title: 'Choose the canonical demand forecast source',
    status: 'ESCALATED',
    ownerName: 'Anna Kowalska',
    dueDate: new Date(Date.now() - 86_400_000).toISOString(),
    isOverdue: true,
    daysOverdue: 1,
    escalationLevel: 1,
    escalationLevelName: 'amber',
  },
];

const odpowiedz = (sciezka: string): unknown =>
  sciezka === '/initiatives'
    ? []
    : sciezka === '/execution-control/delay-signals'
      ? { signals: [], count: 0 }
      : DECYZJE;

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((sciezka: string) => Promise.resolve(odpowiedz(sciezka)));
  getOrganizationMembers.mockResolvedValue([
    { userId: 'osoba-1', name: 'Anna Kowalska' },
  ]);
  raidList.mockResolvedValue([]);
  listInterventions.mockResolvedValue({ items: [] });
  listManagementSignals.mockResolvedValue({ items: [] });
  listCapacityOptions.mockResolvedValue({ items: [] });
});

const headerWidth = (container: HTMLElement, columnId: string): number => {
  const th = container.querySelector<HTMLTableCellElement>(`th[data-column-id="${columnId}"]`);
  if (!th) throw new Error(`Brak kolumny ${columnId} w wyrenderowanej tabeli`);
  return Number.parseInt(th.style.width, 10);
};

describe('ExecutionControlSurface — podłogi typu tabeli Decyzje (Risk management)', () => {
  it('Termin/Osoba decyzyjna/Status/Dni po terminie deklarują dataType', async () => {
    const { container } = render(
      <MemoryRouter>
        <ExecutionControlSurface activePreset="decyzje" />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(
        screen.getByText('Choose the canonical demand forecast source')
      ).toBeInTheDocument()
    );

    expect(headerWidth(container, 'dueAt')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.date
    );
    expect(headerWidth(container, 'decydent')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.owner
    );
    expect(headerWidth(container, 'statusLabel')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.status
    );
    expect(headerWidth(container, 'daysOverdue')).toBeGreaterThanOrEqual(
      COLUMN_MIN_WIDTH_BY_DATA_TYPE.number
    );
  });
});
