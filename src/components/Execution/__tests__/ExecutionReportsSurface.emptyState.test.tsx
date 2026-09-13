/**
 * @vitest-environment jsdom
 *
 * K5-6 — PUSTY STAN zakładki „Raporty" ma DOKŁADNIE JEDNĄ akcję
 * (odbiór właściciela 13.09, staging `cf3fded7e4`, org DBR77: „tu nie
 * widzę" — rejestr pusty, pigułki `All 0 · Needs review 0 · Published 0 ·
 * Definitions 12`, a w pustym stanie ZERO akcji).
 *
 * Kanon P5 (`docs/ui-standards/TRIADA_KANON.md`): pusty stan = jedno zdanie
 * + JEDNA akcja. Do 13.09 ten ekran świadomie nie miał żadnej akcji w pustce,
 * bo jedyne wejście do generatora żyło w primary CTA Menu 2 — właściciel
 * udowodnił na żywym ekranie, że tego wejścia nie widać.
 *
 * MUTACJE, na które te testy reagują:
 *   (e1) usunięcie `empty.actionLabel`/`empty.onAction` (powrót do pustki bez
 *        akcji) → brak przycisku (FAIL);
 *   (e2) dołożenie DRUGIEJ akcji w pustym stanie (np. kafle `empty.actions`,
 *        odrzucone przez właściciela 08.09) → więcej niż jeden przycisk (FAIL);
 *   (e3) przycisk-atrapa: akcja, która nie otwiera realnego kreatora ani nie
 *        dochodzi do ISTNIEJĄCEGO wołacza `createExecutionReportRun` (FAIL) —
 *        „wołacz istnieje ≠ renderuje się" działa też w drugą stronę;
 *   (e4) rozjazd nazw: akcja pustego stanu i primary CTA Menu 2 nazwane
 *        inaczej, choć robią DOKŁADNIE to samo (FAIL).
 *
 * Wzorzec atrapy i18n (resolvePlKey) oraz inertnego `onRegisterPrimaryCta`
 * — 1:1 z `ExecutionReportsSurface.addReportMenu.test.tsx` (tam opisany powód:
 * żywy `useState` + nowe `t` przy każdym renderze napędzały pętlę renderów).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';

const resolvePlKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      plTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => {
      const resolved = resolvePlKey(k);
      if (resolved !== undefined) return resolved;
      return typeof fallback === 'string' ? fallback : k;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

/** Katalog jak na stagingu: MVP generuje migawkę, Fala 2 nie. */
const TEST_CATALOG = [
  {
    key: 'weekly-exec',
    name: 'Weekly Execution Pack',
    audience: 'PMO',
    cadence: 'Weekly',
    scope: 'Delivery portfolio',
    sections: ['Sekcja A'],
    level: 'PMO' as const,
    mvp: true,
    formats: ['SCREEN' as const],
  },
  {
    key: 'monthly-pmo',
    name: 'Monthly PMO Review',
    audience: 'Board',
    cadence: 'Monthly',
    scope: 'Program',
    sections: ['Sekcja B'],
    level: 'BOARD' as const,
    mvp: false,
    formats: ['SCREEN' as const],
  },
];

const SNAPSHOT = {
  definitionKey: 'weekly-exec',
  title: 'Weekly Execution Pack',
  rag: 'GREEN' as const,
  period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:59.000Z' },
  asOf: '2026-09-08T06:00:00.000Z',
  metrics: [],
  sections: [{ id: 's1', title: 'Sekcja A', narrative: 'Treść' }],
};

const { listExecutionReportDefinitions, listExecutionReportRuns, createExecutionReportRun } =
  vi.hoisted(() => ({
    listExecutionReportDefinitions: vi.fn(),
    listExecutionReportRuns: vi.fn(),
    createExecutionReportRun: vi.fn(),
  }));
vi.mock('@/services/executionReports/executionReportsApi', () => ({
  listExecutionReportDefinitions,
  listExecutionReportRuns,
  createExecutionReportRun,
  readExecutionReportRun: vi.fn(),
  publishExecutionReportRun: vi.fn(),
  downloadExecutionReportFile: vi.fn(),
}));

const { buildExecutionReportSnapshot, fetchExecutionReportInputs } = vi.hoisted(() => ({
  buildExecutionReportSnapshot: vi.fn(),
  fetchExecutionReportInputs: vi.fn(),
}));
vi.mock('../executionReportModel', () => ({
  buildExecutionReportSnapshot,
  fetchExecutionReportInputs,
}));

const {
  listReportRuns,
  listReportDefinitions,
  listExecutionCases,
  getReportDefinition,
  createReportRun,
  createReportDefinition,
  transitionReportDefinition,
  transitionReportRun,
  readExecutionCase,
  createExecutionTask,
} = vi.hoisted(() => ({
  listReportRuns: vi.fn(),
  listReportDefinitions: vi.fn(),
  listExecutionCases: vi.fn(),
  getReportDefinition: vi.fn(),
  createReportRun: vi.fn(),
  createReportDefinition: vi.fn(),
  transitionReportDefinition: vi.fn(),
  transitionReportRun: vi.fn(),
  readExecutionCase: vi.fn(),
  createExecutionTask: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listReportRuns,
  listReportDefinitions,
  listExecutionCases,
  getReportDefinition,
  createReportRun,
  createReportDefinition,
  transitionReportDefinition,
  transitionReportRun,
  readExecutionCase,
  createExecutionTask,
}));

import { ExecutionReportsSurface } from '../ExecutionReportsSurface';

describe('ExecutionReportsSurface — pusty rejestr raportów ma JEDNĄ akcję (K5-6, 13.09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listExecutionReportDefinitions.mockResolvedValue({ definitions: TEST_CATALOG });
    listExecutionReportRuns.mockResolvedValue({ items: [] });
    listReportRuns.mockResolvedValue({ items: [] });
    listReportDefinitions.mockResolvedValue({ items: [] });
    listExecutionCases.mockResolvedValue({ cases: [] });
    fetchExecutionReportInputs.mockResolvedValue({
      initiatives: [],
      tasks: [],
      decisions: [],
      raid: [],
      signals: [],
      unavailable: [],
    });
    buildExecutionReportSnapshot.mockReturnValue(SNAPSHOT);
    createExecutionReportRun.mockResolvedValue({
      id: 'run-new',
      definitionKey: 'weekly-exec',
      level: 'PMO',
      title: 'Weekly Execution Pack',
      status: 'DRAFT',
      rag: 'GREEN',
      period: SNAPSHOT.period,
      asOf: SNAPSHOT.asOf,
      createdAt: SNAPSHOT.asOf,
      createdByName: 'Paweł Kowalski',
      publishedAt: null,
    });
  });

  const mountSurface = () => {
    const onRegisterPrimaryCta = vi.fn();
    render(
      <MemoryRouter>
        <ExecutionReportsSurface onRegisterPrimaryCta={onRegisterPrimaryCta} />
      </MemoryRouter>
    );
    return onRegisterPrimaryCta;
  };

  const emptyState = async () => {
    const node = await screen.findByTestId('standard-table-empty');
    return node;
  };

  it('(e1/e2) pusty stan pokazuje DOKŁADNIE JEDEN przycisk akcji — „Nowy raport"', async () => {
    mountSurface();

    const pustka = await emptyState();
    const przyciski = within(pustka).getAllByRole('button');
    expect(przyciski).toHaveLength(1);
    expect(przyciski[0]).toHaveTextContent('Nowy raport');
    // Kafle `empty.actions` (odrzucone 08.09) nie wracają tylnymi drzwiami.
    expect(screen.queryByTestId('standard-table-empty-actions')).not.toBeInTheDocument();
  });

  it('(e3) akcja pustego stanu otwiera REALNY kreator i dochodzi do istniejącego wołacza `createExecutionReportRun`', async () => {
    mountSurface();

    const pustka = await emptyState();
    fireEvent.click(within(pustka).getByRole('button', { name: /Nowy raport/ }));

    const kreator = await screen.findByTestId('execution-report-wizard');
    // Kreator otwiera się z pierwszą definicją MVP z KATALOGU (nie pusty wybór),
    // więc jedno kliknięcie wystarcza do wygenerowania raportu.
    const wybor = within(kreator).getByLabelText('Definicja raportu') as HTMLSelectElement;
    await waitFor(() => expect(wybor.value).toBe('weekly-exec'));

    fireEvent.click(within(kreator).getByRole('button', { name: /Generuj migawkę/ }));

    await waitFor(() => {
      expect(createExecutionReportRun).toHaveBeenCalledTimes(1);
    });
    expect(createExecutionReportRun.mock.calls[0][0]).toMatchObject({
      definitionKey: 'weekly-exec',
    });
  });

  it('(e4) akcja pustego stanu i primary CTA Menu 2 mają TĘ SAMĄ nazwę — jedno działanie, jedna nazwa', async () => {
    const onRegisterPrimaryCta = mountSurface();

    await waitFor(() => {
      expect(onRegisterPrimaryCta.mock.calls.length).toBeGreaterThan(1);
    });
    const cta = onRegisterPrimaryCta.mock.calls[onRegisterPrimaryCta.mock.calls.length - 1][0];

    const pustka = await emptyState();
    const przycisk = within(pustka).getByRole('button');
    expect(przycisk.textContent?.trim()).toBe(cta.label);
  });
});
