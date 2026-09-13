/**
 * K5-3 — PODGLĄD BANKU REALIZACJI NA POWŁOCE KANONU (test RENDERU).
 *
 * Warunek właściciela przy odbiorze Realizacji (DEC-491): „preview nie jest
 * zgodne ze standardem, reszta ok".
 *
 * Test montuje REALNY `<StandardPreview>` (fasada kanonu) na REALNEJ
 * deklaracji, którą `ExecutionHub` przekazuje do podglądu
 * (`buildExecutionBankPreviewDeclaration` — ta sama funkcja, nie kopia).
 * Dzięki temu nie jest to test źródła (grep), który przechodzi także wtedy,
 * gdy wyrenderowany DOM jest zły — asercje patrzą na DOM.
 *
 * Sprawdzane literalnie (lista czekowania B + TABLE_AND_PREVIEW_CANON §7.3):
 *   · sześć bloków kanonu w sztywnej kolejności + „Co dalej" NA KOŃCU,
 *   · DOKŁADNIE JEDEN „×" i dokładnie jedno „Open" (oba w nagłówku),
 *   · zero nagłówków „Property"/„Value" w tabeli faktów,
 *   · akcje stopki = wyłącznie te z realnym wołaczem (żadnego „Create
 *     execution case"/„Report progress" — front nie ma dla nich trasy),
 *   · wiersz bez realizacji MÓWI o tym wprost i podaje następny krok.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StandardPreview } from '../../standard/StandardPreview';
import type {
  ExecutionBankEvidence,
  ExecutionBankEvidenceMeta,
  ExecutionBankRow,
  ExecutionBankUnknownReason,
} from '../executionBankModel';
import { buildExecutionBankPreviewDeclaration } from '../executionBankPreviewDeclaration';

// Powłoka kanonu woła `useTranslation()` po własne napisy (Relations, „Close",
// licznik słów). Zwracamy fallback — tak jak robią to testy rdzenia podglądu.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

const META: ExecutionBankEvidenceMeta = {
  asOf: '2026-09-13',
  source: 'test',
  completeness: 'KNOWN',
  staleness: 'CURRENT',
  formula: { id: 'test', version: 1 },
  inputs: {},
  window: null,
};

const known = <T,>(value: T): ExecutionBankEvidence<T> => ({ status: 'KNOWN', value, meta: META });
const gap = <T,>(reason: ExecutionBankUnknownReason): ExecutionBankEvidence<T> => ({
  status: 'UNKNOWN',
  value: null,
  reason,
  meta: META,
});

/** Wiersz Z realizacją i kompletnym harmonogramem. */
const rowWithCase = (overrides: Partial<ExecutionBankRow> = {}): ExecutionBankRow =>
  ({
    id: 'exec-inventory',
    initiativeId: 'init-inventory',
    executionCaseId: 'exec-inventory',
    executionCaseVersion: 2,
    name: 'Component stock optimisation',
    description: null,
    lifecycleStatus: 'IN_EXECUTION',
    executionState: 'ACTIVE',
    executionPhase: 'Delivery',
    ownerId: 'user-marek',
    ownerName: 'Marek Nowak',
    deliveryProfile: 'Standard',
    progress: known(45),
    confidence: gap('CONFIDENCE_MISSING'),
    baselineStart: known('2026-04-01'),
    baselineFinish: known('2026-09-30'),
    currentPlanStart: known('2026-04-01'),
    currentPlanFinish: known('2026-10-12'),
    forecastStart: known('2026-04-01'),
    forecastFinish: known('2026-10-12'),
    actualStart: known('2026-04-03'),
    actualFinish: gap('ACTUAL_MISSING'),
    varianceDays: { ...known(12), reference: 'FORECAST' as const },
    health: known('AT_RISK'),
    blockerCount: 2,
    pendingDecisionCount: 1,
    resourceConstraint: null,
    nextAction: null,
    updatedAt: known('2026-09-10T10:00:00.000Z'),
    displayFinish: { ...known('2026-10-12'), reference: 'FORECAST' as const },
    ...overrides,
  }) as ExecutionBankRow;

/** Wiersz BEZ realizacji — inicjatywa w toku, której nikt jeszcze nie przekazał. */
const rowWithoutCase = (): ExecutionBankRow =>
  rowWithCase({
    id: 'initiative:init-wip',
    initiativeId: 'init-wip',
    executionCaseId: null,
    executionCaseVersion: null,
    name: 'WIP warehouse automation',
    executionState: 'UNKNOWN',
    executionPhase: null,
    deliveryProfile: null,
    ownerId: null,
    ownerName: null,
    progress: gap('PROGRESS_MISSING'),
    baselineFinish: gap('BASELINE_MISSING'),
    currentPlanFinish: gap('CURRENT_PLAN_MISSING'),
    forecastFinish: gap('FORECAST_MISSING'),
    actualFinish: gap('ACTUAL_MISSING'),
    varianceDays: gap('VALUE_MISSING') as ExecutionBankRow['varianceDays'],
    health: gap('HEALTH_MISSING'),
    blockerCount: null,
    pendingDecisionCount: null,
  });

const t = (key: string, defaultValue: string, vars?: Record<string, string | number>) =>
  defaultValue.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars?.[name] ?? `{{${name}}}`));

const renderPreview = (row: ExecutionBankRow, extra?: { onCopyLink?: () => void }) => {
  const declaration = buildExecutionBankPreviewDeclaration({
    row,
    t,
    statusChipTone: () => 'neutral',
    asOf: '2026-09-13',
    progressLabel: row.progress.status === 'KNOWN' ? `${row.progress.value}%` : '—',
    relations: [{ id: 'source', label: 'Source: Assessment · DRD' }],
    onCopyLink: extra?.onCopyLink ?? (() => {}),
  });
  return render(
    <StandardPreview
      title={row.name}
      onClose={() => {}}
      onOpenFull={() => {}}
      {...declaration}
    />
  );
};

const blok = (container: HTMLElement, nazwa: string) =>
  container.querySelector<HTMLElement>(`[data-preview-block="${nazwa}"]`);

describe('K5-3 — podgląd banku Realizacji na powłoce kanonu', () => {
  it('(1) renderuje sześć bloków kanonu, a „Co dalej" stoi PO akcjach', () => {
    const { container } = renderPreview(rowWithCase());

    for (const nazwa of ['header', 'details', 'relations', 'actions', 'whatsnext']) {
      expect(blok(container, nazwa), `brak bloku ${nazwa}`).not.toBeNull();
    }
    // Blok 2 (meta) nie ma własnego `data-preview-block` — rozpoznajemy go po
    // chipach stanu, które MUSZĄ stać NAD blokiem treści.
    expect(screen.getByText('In execution')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Progress 45%')).toBeInTheDocument();
    expect(screen.getByText('At risk')).toBeInTheDocument();

    const kolejnosc = Array.from(
      container.querySelectorAll<HTMLElement>('[data-preview-block]')
    ).map((el) => el.dataset.previewBlock);
    expect(kolejnosc.indexOf('details')).toBeLessThan(kolejnosc.indexOf('relations'));
    expect(kolejnosc.indexOf('relations')).toBeLessThan(kolejnosc.indexOf('actions'));
    // §7.3 pkt 4.4 — „Co dalej" ZAWSZE na końcu, nigdy przed akcjami.
    expect(kolejnosc.indexOf('actions')).toBeLessThan(kolejnosc.indexOf('whatsnext'));
  });

  it('(2) nagłówek ma DOKŁADNIE jedno „×" i dokładnie jedno „Open"', () => {
    renderPreview(rowWithCase());

    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(1);
  });

  it('(3) blok treści ma PROZĘ z licznikiem słów, kebab i tabelę faktów bez „Property/Value"', () => {
    const { container } = renderPreview(rowWithCase());
    const details = blok(container, 'details')!;

    expect(within(details).getByText('Execution context')).toBeInTheDocument();
    // Proza złożona z dowodów wiersza — nie pusty blok i nie zrzut pól.
    expect(
      within(details).getByText(/Execution case active, version 2\./)
    ).toBeInTheDocument();
    expect(within(details).getByText(/Reported progress 45%\./)).toBeInTheDocument();
    expect(
      within(details).getByText(/Finish date is 12 days later than the baseline\./)
    ).toBeInTheDocument();
    // Licznik słów renderuje się tylko przy realnej prozie (§7.3 pkt 3).
    expect(within(details).getByText(/^~\d+ /)).toBeInTheDocument();
    // Kebab lokalny bloku 3.
    expect(within(details).getByRole('button')).toBeInTheDocument();

    // Nagłówki tabeli NAZYWAJĄ zawartość — generyczne „Property/Value" znikają.
    expect(within(details).getByText('Execution fact')).toBeInTheDocument();
    expect(within(details).getByText('Reported value')).toBeInTheDocument();
    expect(within(details).queryByText('Property')).toBeNull();
    expect(within(details).queryByText('Value')).toBeNull();

    for (const label of [
      'Execution case',
      'Owner',
      'Execution phase',
      'Baseline finish',
      'Current plan finish',
      'Forecast finish',
      'Actual finish',
      'Variance',
    ]) {
      expect(within(details).getByText(label), `brak wiersza „${label}"`).toBeInTheDocument();
    }
    expect(within(details).getByText('Marek Nowak')).toBeInTheDocument();
    expect(within(details).getByText('+12 d (forecast vs baseline)')).toBeInTheDocument();
  });

  it('(4) stopka ma TYLKO akcje z realnym wołaczem — bez „Open", bez martwych przycisków', async () => {
    const onCopyLink = vi.fn();
    const { container } = renderPreview(rowWithCase(), { onCopyLink });
    const actions = blok(container, 'actions')!;

    const przyciski = within(actions).getAllByRole('button');
    expect(przyciski).toHaveLength(1);
    expect(przyciski[0]).toHaveTextContent('Copy link');
    // Anty-duplikacja §7.3 pkt 4.3 — „Open" żyje wyłącznie w nagłówku.
    expect(within(actions).queryByRole('button', { name: /open/i })).toBeNull();
    // Martwe przyciski: te dwie akcje nie mają wołacza we froncie.
    expect(screen.queryByRole('button', { name: /create execution case/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /report progress/i })).toBeNull();
    // Pigułka, nie `rounded-lg` (pułapka #36).
    expect(przyciski[0].className).toContain('rounded-full');
    expect(przyciski[0].className).not.toContain('rounded-lg');

    await userEvent.click(przyciski[0]);
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it('(5) wiersz BEZ realizacji mówi o tym wprost i podaje następny krok bez przycisku', () => {
    const { container } = renderPreview(rowWithoutCase());

    expect(screen.getByText('No execution case yet')).toBeInTheDocument();
    const details = blok(container, 'details')!;
    expect(within(details).getByText('Not linked yet')).toBeInTheDocument();
    expect(
      within(details).getByText(/with no execution case behind it yet/)
    ).toBeInTheDocument();

    const whatsNext = blok(container, 'whatsnext')!;
    expect(
      within(whatsNext).getByText(/handed off from its initiative record/)
    ).toBeInTheDocument();
    expect(within(whatsNext).queryAllByRole('button')).toHaveLength(0);
  });

  it('(6) „Co dalej" wynika ZE STANU — brak bazy odniesienia wygrywa z brakiem postępu', () => {
    const { container } = renderPreview(
      rowWithCase({
        baselineFinish: gap('BASELINE_MISSING'),
        forecastFinish: gap('FORECAST_MISSING'),
        progress: gap('PROGRESS_MISSING'),
      })
    );
    expect(
      within(blok(container, 'whatsnext')!).getByText(/Set the schedule baseline/)
    ).toBeInTheDocument();
  });

  it('(7) „Co dalej" prosi o prognozę, gdy baza odniesienia JEST, a prognozy nie ma', () => {
    const { container } = renderPreview(
      rowWithCase({ forecastFinish: gap('FORECAST_MISSING'), progress: gap('PROGRESS_MISSING') })
    );
    expect(
      within(blok(container, 'whatsnext')!).getByText(/Report a forecast finish date/)
    ).toBeInTheDocument();
  });

  it('(8) „Co dalej" prosi o postęp, gdy cały harmonogram jest, a postępu nie ma', () => {
    const { container } = renderPreview(rowWithCase({ progress: gap('PROGRESS_MISSING') }));
    expect(
      within(blok(container, 'whatsnext')!).getByText(/Report progress on the execution case/)
    ).toBeInTheDocument();
  });
});
