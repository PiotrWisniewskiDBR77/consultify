/**
 * FALA B — RENDER, nie źródło.
 *
 * Powód osobnego pliku (i osobnej noty): testy „source-anchor" w tym katalogu
 * sprawdzają obecność napisów w pliku i przechodzą także wtedy, gdy DOM jest
 * zły. Ten plik montuje REALNY `ExecutionBankViews` (a w nim realny
 * `StandardTable`) i pyta o to, co naprawdę zobaczy właściciel.
 *
 * Broni trzech rzeczy:
 *  1. PARYTET PRZY OFF — bez flag w tabeli NIE MA ani kolumny „Handoff", ani
 *     „Risk". To jest bezpiecznik reguły #9: ekran bez akceptu nie wchodzi na
 *     żywo bocznymi drzwiami.
 *  2. DEC-487 — sygnał niesie TEKST, nie sam kolor. Test czyta treść pastylki,
 *     więc „zostały same ikony" (realny defekt złapany harnessem 14.09) robi
 *     się czerwone.
 *  3. SANITIZER H2 — wiersz w toku bez przekazania ZOSTAJE w tabeli i jest
 *     oznaczony; nie znika.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildExecutionBankRows } from '../executionBankModel';
import { buildExecutionBankPreviewDeclaration } from '../executionBankPreviewDeclaration';
import { ExecutionBankViews, formatExecutionBankDate } from '../ExecutionBankViews';
import { buildExecutionRiskSignalMap } from '../executionRiskSignal';

/** Deklaracja podglądu bierze `t` jawnie — ten sam kształt co atrapa wyżej. */
const previewT = (key: string, defaultValue: string, vars?: Record<string, string | number>) =>
  String(defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n) => String(vars?.[n] ?? ''));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string, vars?: Record<string, unknown>) =>
      String(defaultValue ?? '').replace(/\{\{(\w+)\}\}/g, (_m, n) => String(vars?.[n] ?? '')),
    // `StandardTable` czyta `i18n.language` synchronicznie w renderze —
    // atrapa bez tego pola wywraca się na `undefined.language`.
    i18n: { language: 'en' },
  }),
}));

const ASOF = '2026-09-14T00:00:00.000Z';

const rows = buildExecutionBankRows(
  [
    { id: 'ini-1', name: 'Alpha', lifecycleStatus: 'IN_EXECUTION' },
    { id: 'ini-2', name: 'Beta bez przekazania', lifecycleStatus: 'IN_EXECUTION' },
  ] as never,
  [
    {
      executionCaseId: 'case-1',
      initiativeId: 'ini-1',
      state: 'ACTIVE',
      handoffPackageId: 'pkg-1',
      acceptedAt: '2026-04-02T08:00:00.000Z',
    },
  ] as never,
  { asOf: ASOF }
);

const riskSignals = buildExecutionRiskSignalMap([
  {
    initiativeId: 'ini-1',
    scheduleHealth: { ratio: 0.99 },
    impactGap: { ratio: 0.99 },
    deliveryPromise: { ratio: 0.99 },
  },
  {
    initiativeId: 'ini-2',
    scheduleHealth: { ratio: 0.4 },
    impactGap: { ratio: null, rag: 'NA' },
    deliveryPromise: { ratio: 0.9 },
  },
]);

const renderBank = (props: Record<string, unknown> = {}) =>
  render(
    <ExecutionBankViews
      rows={rows}
      view="table"
      selected={null}
      calendarWindow={{ asOf: ASOF, resolution: 'MONTH', buckets: [], horizonMonths: 6 } as never}
      onSelect={() => undefined}
      onOpen={() => undefined}
      onHorizonChange={() => undefined}
      onDrilldownMonth={() => undefined}
      {...props}
    />
  );

describe('Bank Realizacji — parytet z linią przy flagach OFF', () => {
  it('bez flag nie ma ani kolumny Handoff, ani Risk', () => {
    renderBank();
    expect(screen.queryByText('Handoff')).toBeNull();
    expect(screen.queryByText('Risk')).toBeNull();
    expect(screen.queryAllByTestId('execution-bank-handoff')).toHaveLength(0);
    expect(screen.queryAllByTestId('execution-risk-aggregate')).toHaveLength(0);
  });

  it('sam sygnał ryzyka nie wyciąga kolumny przekazania (flagi są niezależne)', () => {
    renderBank({ riskSignals });
    expect(screen.getByText('Risk')).toBeTruthy();
    expect(screen.queryByText('Handoff')).toBeNull();
  });
});

describe('Bank Realizacji — FALA B przy flagach ON', () => {
  it('sygnał ryzyka niesie SŁOWO, nie tylko kolor (DEC-487)', () => {
    renderBank({ riskSignals, showHandoffTrace: true });
    const pills = screen.getAllByTestId('execution-risk-aggregate');
    expect(pills.length).toBe(2);
    // Każda pastylka ma niepustą treść tekstową — „same ikony" to FAIL.
    for (const pill of pills) expect(pill.textContent?.trim().length).toBeGreaterThan(2);
    expect(pills.some((pill) => pill.textContent?.includes('In tolerance'))).toBe(true);
    expect(pills.some((pill) => pill.textContent?.includes('Escalate'))).toBe(true);
  });

  it('niepełny pomiar mówi o sobie wprost, zamiast udawać komplet', () => {
    renderBank({ riskSignals, showHandoffTrace: true });
    const partial = screen
      .getAllByTestId('execution-risk-aggregate')
      .find((pill) => pill.getAttribute('data-risk-measured') === '2');
    expect(partial).toBeTruthy();
    expect(partial?.textContent).toContain('2/3');
  });

  it('SANITIZER: wiersz w toku bez przekazania zostaje widoczny i oznaczony', () => {
    renderBank({ riskSignals, showHandoffTrace: true });
    expect(screen.getByText('Beta bez przekazania')).toBeTruthy();
    const badges = screen.getAllByTestId('execution-bank-handoff');
    expect(badges.some((badge) => badge.getAttribute('data-handoff-status') === 'MISSING')).toBe(
      true
    );
  });

  it('wiersz przekazany pokazuje datę przyjęcia, a zdanie idzie w podpowiedź', () => {
    renderBank({ riskSignals, showHandoffTrace: true });
    const accepted = screen
      .getAllByTestId('execution-bank-handoff')
      .find((badge) => badge.getAttribute('data-handoff-status') === 'ACCEPTED');
    expect(accepted).toBeTruthy();
    // DEC-510: zapis daty idzie za locale konta, nie za przybitym `'en'`.
    // Oczekiwanie liczy TEN SAM formater co produkt — data nadal konkretna.
    expect(within(accepted!).getByText(formatExecutionBankDate('2026-04-02'))).toBeTruthy();
    expect(accepted?.getAttribute('title')).toContain('Handed over');
  });
});

/**
 * D-29 — WPIĘCIE, nie obecność biblioteki. `executionRiskAxisSentence` ma
 * własny test jednostkowy, ale sam klucz i18n nic nie znaczy, dopóki zdanie
 * nie stanie w DOM: tu pytamy REALNY bank (tabela + podgląd) o `title`
 * pastylek. Usunięcie `title={sentence}` albo zepsucie mapowania powodu robi
 * się czerwone bez dotykania atrapy.
 */
describe('D-29 — zdanie osi dociera do DOM (wpięcie)', () => {
  it('agregat w tabeli niesie w podpowiedzi zdania WSZYSTKICH trzech osi', () => {
    renderBank({ riskSignals, showHandoffTrace: true });
    const full = screen
      .getAllByTestId('execution-risk-aggregate')
      .find((pill) => pill.getAttribute('data-risk-measured') === '3');
    const title = full?.getAttribute('title') ?? '';
    expect(title).toContain('Schedule health: In tolerance (index 0.99)');
    expect(title).toContain('Impact gap: In tolerance (index 0.99)');
    expect(title).toContain('Delivery promise: In tolerance (index 0.99)');
    expect(title.split(' · ')).toHaveLength(3);
    expect(full?.getAttribute('aria-label')).toBe(title);
  });

  it('podgląd niesie zdanie każdej osi, a brak pomiaru nazywa wprost', () => {
    const declaration = buildExecutionBankPreviewDeclaration({
      row: rows[1],
      t: previewT,
      statusChipTone: () => 'neutral',
      asOf: ASOF,
      progressLabel: '—',
      relations: [],
      riskSignal: riskSignals.get('ini-2') ?? null,
    });
    const facts = new Map(declaration.details?.properties?.map((fact) => [fact.id, fact.value]));
    render(<>{[...facts.values()]}</>);

    const schedule = screen.getByTestId('execution-risk-axis-schedule');
    expect(schedule.getAttribute('title')).toBe('Schedule health: Escalate (index 0.40)');
    const impact = screen.getByTestId('execution-risk-axis-impact');
    expect(impact.getAttribute('title')).toContain('Impact gap: not measured — ');
    expect(impact.getAttribute('aria-label')).toBe(impact.getAttribute('title'));
  });
});
