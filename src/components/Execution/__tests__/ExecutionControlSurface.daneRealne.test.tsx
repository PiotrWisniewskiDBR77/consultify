/**
 * @vitest-environment jsdom
 *
 * 1.12-R1 (C) — zakładka „Sterowanie" staje się „Decyzje i ryzyka"
 * i czyta REALNE rejestry.
 *
 * POMIAR 06.09 (org DBR77, API 127.0.0.1:4100):
 *   · `runtime-v1/management-signals` → 0, `runtime-v1/interventions` → 0
 *     (jedyne dwa źródła, które ta powierzchnia czytała),
 *   · `/api/decisions` → 35, z tego 25 otwartych i 12 po terminie
 *     (wszystkie 12 ze statusem ESCALATED, `escalationLevelName` red 3 / amber 9),
 *   · `/api/raid` → 16 pozycji, 0 z terminem.
 *
 * MUTACJE, na które ten plik reaguje:
 *   (1) powrót źródła do `listManagementSignals`/`listInterventions` → padają
 *       wszystkie przypadki o liczbie wierszy,
 *   (2) zawężenie decyzji do `status === 'PENDING'` → „25 otwartych" spada do 13.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1' }, currentOrganization: { id: 'org-1' } }),
}));

const { apiGet, raidList, createDecision } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  raidList: vi.fn(),
  createDecision: vi.fn(),
}));
vi.mock('@/services/api', () => ({ Api: { get: apiGet, raidList, createDecision } }));

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

const dzien = (przesuniecie: number) =>
  new Date(Date.now() + przesuniecie * 86_400_000).toISOString();

/** 25 otwartych decyzji, z tego 12 po terminie i wszystkie 12 ze statusem ESCALATED. */
const DECYZJE = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `esc-${i}`,
    title: `Decyzja po terminie ${i}`,
    status: 'ESCALATED',
    ownerName: 'Anna Kowalska',
    dueDate: dzien(-(i + 1)),
    isOverdue: true,
    daysOverdue: i + 1,
    escalationLevel: i < 3 ? 2 : 1,
    escalationLevelName: i < 3 ? 'red' : 'amber',
  })),
  ...Array.from({ length: 13 }, (_, i) => ({
    id: `pend-${i}`,
    title: `Decyzja otwarta ${i}`,
    status: 'PENDING',
    ownerName: 'Marek Nowak',
    dueDate: dzien(10),
    isOverdue: false,
    escalationLevel: 0,
    escalationLevelName: 'none',
  })),
  // Rozstrzygnięte — nie należą do rejestru „do rozstrzygnięcia".
  { id: 'done-1', title: 'Decyzja zatwierdzona', status: 'APPROVED', isOverdue: false },
  { id: 'done-2', title: 'Decyzja odrzucona', status: 'REJECTED', isOverdue: false },
];

/** 16 pozycji RAID, żadna z terminem (dokładnie jak na pomiarze). */
const RAID = Array.from({ length: 16 }, (_, i) => ({
  id: `raid-${i}`,
  title: `Ryzyko ${i}`,
  type: i < 9 ? 'RISK' : i < 13 ? 'ISSUE' : 'DEPENDENCY',
  severity: i % 3 === 0 ? 'HIGH' : 'MEDIUM',
  status: 'OPEN',
  ownerId: 'osoba-1',
  dueDate: null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue(DECYZJE);
  raidList.mockResolvedValue(RAID);
  // Rzeczywistość DBR77: kanoniczny rejestr sterowania jest pusty.
  listInterventions.mockResolvedValue({ items: [] });
  listManagementSignals.mockResolvedValue({ items: [] });
  listCapacityOptions.mockResolvedValue({ items: [] });
});

const zamontuj = (preset = 'decyzje', onCountsChange?: (c: Record<string, number>) => void) =>
  render(
    <MemoryRouter>
      <ExecutionControlSurface activePreset={preset} onCountsChange={onCountsChange} />
    </MemoryRouter>
  );

const wierszeZ = (fragment: string) => {
  const tabela = document.querySelector('table');
  if (!tabela) return [];
  return Array.from(tabela.querySelectorAll('tbody tr')).filter((tr) =>
    (tr.textContent || '').includes(fragment)
  );
};

describe('1.12-R1 (C) — rejestr decyzji i ryzyk', () => {
  it('preset „Decyzje" pokazuje 25 OTWARTYCH decyzji (nie 13 PENDING, nie 35)', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    expect(wierszeZ('Decyzja')).toHaveLength(25);
    expect(screen.queryByText('Decyzja zatwierdzona')).toBeNull();
  });

  it('12 decyzji ma czerwoną liczbę „dni po terminie"', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    const czerwone = Array.from(document.querySelectorAll('table td .text-c-danger')).filter((el) =>
      /^\+\d+$/.test((el.textContent || '').trim())
    );
    expect(czerwone).toHaveLength(12);
  });

  it('kolumna Eskalacja nazywa poziom po polsku (3 czerwone, 9 bursztynowych)', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    expect(screen.getAllByText('Czerwona')).toHaveLength(3);
    expect(screen.getAllByText('Bursztynowa')).toHaveLength(9);
  });

  it('preset „Ryzyka" pokazuje 16 pozycji RAID, z terminem „—" (0 z 16 ma datę)', async () => {
    zamontuj('ryzyka');
    await waitFor(() => expect(screen.getByText('Ryzyko 0')).toBeInTheDocument());
    expect(wierszeZ('Ryzyko')).toHaveLength(16);
    expect(screen.getAllByText('Ryzyko').length).toBeGreaterThan(0); // etykieta typu
  });

  it('preset „Po terminie" łączy oba rejestry i pokazuje 12 pozycji', async () => {
    zamontuj('po-terminie');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    expect(wierszeZ('Decyzja po terminie')).toHaveLength(12);
  });

  it('liczniki Menu 3 to dokładnie trzy presety z realnymi liczbami', async () => {
    const onCountsChange = vi.fn();
    zamontuj('decyzje', onCountsChange);
    await waitFor(() =>
      expect(
        (onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>)?.decyzje
      ).toBe(25)
    );
    const ostatnie = onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>;
    expect(Object.keys(ostatnie).sort()).toEqual(['decyzje', 'po-terminie', 'ryzyka']);
    expect(ostatnie.ryzyka).toBe(16);
    expect(ostatnie['po-terminie']).toBe(12);
  });

  it('nie rysuje pustej tabeli interwencji, gdy runtime-v1 ma 0 rekordów', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    expect(screen.queryByText('Brak spraw interwencyjnych')).toBeNull();
    expect(document.querySelectorAll('table')).toHaveLength(1);
  });

  it('podgląd otwiera się na klik i pokazuje dni po terminie', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    screen.getByText('Decyzja po terminie 0').click();
    await waitFor(() => expect(screen.getAllByText('Dni po terminie').length).toBeGreaterThan(1));
  });
});
