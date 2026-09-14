/**
 * K5-4 — PODGLĄD BANKU REALIZACJI 1:1 JAK ZAAKCEPTOWANY PODGLĄD INICJATYW.
 *
 * Odrzut właściciela na żywym stagingu `cf3fded7e4`: „Preview tutaj nie mieści
 * się na ekranie i jest niezgodne ze standardem".
 *
 * PRZYCZYNA (zmierzona, nie zgadnięta): bank renderował `JedenPrawyPanel`, a
 * ten NIE MA stopki — bloki 5·6 i „Co dalej" jechały WEWNĄTRZ przewijanego
 * ciała panelu, więc jedyna akcja („Copy link") stała pod dolną krawędzią okna.
 * Zaakceptowany podgląd Inicjatyw (`CanonicalInitiativeRegister.tsx`) używa
 * `TableWithPreviewLayout`, który podaje stopkę do `PreviewPaneShell` jako
 * `footer` — a ta jest `shrink-0`, czyli PRZYKLEJONA do dołu panelu.
 *
 * Ten zestaw montuje DOKŁADNIE tę kompozycję, którą składa `ExecutionHub`
 * (`TableWithPreviewLayout` + `StandardPreview embedded` na realnej deklaracji
 * `buildExecutionBankPreviewDeclaration` + `PreviewActionBar` w stopce) — nie
 * jej kopię — i patrzy na DOM, nie na źródło.
 *
 * MUTACJE, KTÓRE MUSZĄ WYWRACAĆ TEN ZESTAW:
 *   · oddanie stopki z powrotem do ciała panelu (usunięcie `renderPreviewFooter`
 *     albo powrót do `JedenPrawyPanel`)            → (1)
 *   · przywrócenie bloku „Co dalej"                 → (2)
 *   · powrót nagłówków „Execution fact/Reported value" → (4)
 *   · powrót chipów „Progress"/zdrowie do karty meta → (3)
 *   · `rounded-lg` zamiast pigułki w stopce (pułapka #36) → (5)
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Copy } from 'lucide-react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { PreviewActionBar } from '../../shared/PreviewPane/PreviewActionBar';
import { TableWithPreviewLayout } from '../../shared/TableWithPreviewLayout';
import { StandardPreview } from '../../standard/StandardPreview';
import type {
  ExecutionBankEvidence,
  ExecutionBankEvidenceMeta,
  ExecutionBankRow,
  ExecutionBankUnknownReason,
} from '../executionBankModel';
import { buildExecutionBankPreviewDeclaration } from '../executionBankPreviewDeclaration';
import { formatExecutionBankDate } from '../ExecutionBankViews';

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

/**
 * DOKŁADNIE ta kompozycja, którą składa `ExecutionHub` w zakładce „Execution
 * bank" — i DOKŁADNIE ta, którą składa `CanonicalInitiativeRegister` dla
 * zaakceptowanych Inicjatyw: `TableWithPreviewLayout` (nagłówek + przewijane
 * ciało + PRZYKLEJONA stopka) ⊃ `StandardPreview embedded` ⊃ deklaracja modułu.
 */
const renderPodglad = (row: ExecutionBankRow, extra?: { onCopyLink?: () => void }) => {
  const declaration = buildExecutionBankPreviewDeclaration({
    row,
    t,
    statusChipTone: () => 'neutral',
    asOf: '2026-09-13',
    progressLabel: row.progress.status === 'KNOWN' ? `${row.progress.value}%` : '—',
    relations: [{ id: 'source', label: 'Source: Assessment · DRD' }],
  });
  const item = { ...row, title: row.name };
  return render(
    // `TableWithPreviewLayout` woła `useJedenPanel()` → `useLocation()`; ta sama
    // otoczka co w `jedenPanel.contract.test.tsx`.
    <MemoryRouter initialEntries={['/execution']}>
    <TableWithPreviewLayout<typeof item>
      selectedId={item.id}
      selectedItem={item}
      onSelect={() => {}}
      onOpenFull={() => {}}
      itemIds={[item.id]}
      getItemById={() => item}
      renderPreview={(wiersz) => (
        <StandardPreview title={wiersz.name} embedded {...declaration} />
      )}
      renderPreviewFooter={() => (
        <PreviewActionBar
          rows={[
            {
              columns: 2,
              buttons: [
                {
                  label: 'Copy link',
                  icon: Copy,
                  colorScheme: 'neutral',
                  onClick: extra?.onCopyLink ?? (() => {}),
                },
              ],
            },
          ]}
        />
      )}
    >
      {/* Zaślepka obszaru tabeli — w produkcie stoi tu `ExecutionBankViews`
          (realny `StandardTable`). Test dotyczy PANELU, nie tabeli, więc
          zaślepka jest `div`-em: kanon list zabrania surowych prymitywów
          tabeli poza `StandardTable`. */}
      <div data-testid="obszar-tabeli">{row.name}</div>
    </TableWithPreviewLayout>
    </MemoryRouter>
  );
};

const blok = (container: HTMLElement, nazwa: string) =>
  container.querySelector<HTMLElement>(`[data-preview-block="${nazwa}"]`);

describe('K5-4 — podgląd banku Realizacji 1:1 jak Inicjatywy', () => {
  it('(1) pasek akcji stoi w PRZYKLEJONEJ stopce powłoki, NIE w przewijanym ciele panelu', () => {
    const { container } = renderPodglad(rowWithCase());

    const aside = container.querySelectorAll('aside[data-right-panel]');
    expect(aside, 'kanon: dokładnie jeden <aside>').toHaveLength(1);

    const stopka = blok(container, 'footer');
    expect(stopka, 'brak stopki powłoki — panel wrócił do kształtu bez stopki').not.toBeNull();
    expect(within(stopka!).getByRole('button', { name: /copy link/i })).toBeInTheDocument();

    // Ciało panelu przewija się SAMO; stopka jest jego RODZEŃSTWEM, nie dzieckiem.
    // To jest różnica między „mieści się" a „wypada poza ekran".
    const cialo = container.querySelector<HTMLElement>('.overflow-y-auto');
    expect(cialo, 'ciało panelu musi mieć własny przewijalny obszar').not.toBeNull();
    expect(cialo!.className).toContain('flex-1');
    expect(cialo!.contains(stopka!), 'stopka wewnątrz przewijanego ciała = defekt K5-4').toBe(
      false
    );
    expect(stopka!.className).toContain('shrink-0');
  });

  it('(2) NIE MA bloku „Co dalej" — bank nie jest źródłem cross-module (§7.0–§7.3b)', () => {
    const { container } = renderPodglad(rowWithCase());
    expect(blok(container, 'whatsnext')).toBeNull();
    expect(screen.queryByText(/what's next/i)).toBeNull();

    // Zdanie o następnym kroku nie znika — wraca jako OSTATNIE zdanie prozy bloku 3.
    const details = blok(container, 'details')!;
    expect(
      within(details).getByText(/Schedule evidence is complete/)
    ).toBeInTheDocument();
  });

  it('(3) karta meta = JEDEN rząd dwóch chipów + krótka data + jedna linia małym drukiem', () => {
    const { container } = renderPodglad(rowWithCase());
    const meta = blok(container, 'meta')!;

    expect(within(meta).getByText('In execution')).toBeInTheDocument();
    expect(within(meta).getByText('Active')).toBeInTheDocument();
    // Chipy, które robiły drugi rząd — zeszły do tabeli faktów.
    expect(within(meta).queryByText(/^Progress/)).toBeNull();
    expect(within(meta).queryByText('At risk')).toBeNull();
    // Długa etykieta „Reporting date" wypychała chipy — zostaje sama data.
    // DEC-510: data idzie przez locale konta (`localeListy`), nie przez
    // przybite `Intl.DateTimeFormat('en')`. Asercja liczy oczekiwany zapis tym
    // samym formaterem co produkt — nadal sprawdza KONKRETNĄ datę, nie regex.
    const dataRaportu = formatExecutionBankDate('2026-09-13');
    const dataAktualizacji = formatExecutionBankDate('2026-09-10T00:00:00.000Z');
    expect(within(meta).queryByText(new RegExp(`Reporting date\\s+${dataRaportu}`))).toBeNull();
    expect(within(meta).getByText(dataRaportu)).toBeInTheDocument();
    expect(within(meta).getByText(`Updated ${dataAktualizacji}`)).toBeInTheDocument();

    const details = blok(container, 'details')!;
    expect(within(details).getByText('Progress')).toBeInTheDocument();
    expect(within(details).getByText('45%')).toBeInTheDocument();
    expect(within(details).getByText('Health')).toBeInTheDocument();
    expect(within(details).getByText('At risk')).toBeInTheDocument();
  });

  it('(4) tabela faktów ma nagłówki kanonu „Property / Value" (jak w Inicjatywach)', () => {
    const { container } = renderPodglad(rowWithCase());
    const details = blok(container, 'details')!;

    expect(within(details).getByText('Property')).toBeInTheDocument();
    expect(within(details).getByText('Value')).toBeInTheDocument();
    expect(within(details).queryByText('Execution fact')).toBeNull();
    expect(within(details).queryByText('Reported value')).toBeNull();

    for (const label of [
      'Execution case',
      'Owner',
      'Execution phase',
      'Progress',
      'Health',
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
    // Proza bloku 3 + licznik słów (§7.3 pkt 3) i kebab lokalny.
    expect(within(details).getByText(/Execution case active, version 2\./)).toBeInTheDocument();
    expect(within(details).getByText(/^~\d+ /)).toBeInTheDocument();
  });

  it('(5) stopka: DOKŁADNIE jeden pill „Copy link" przez actionPillClass, zero „Open"', async () => {
    const onCopyLink = vi.fn();
    const { container } = renderPodglad(rowWithCase(), { onCopyLink });
    const stopka = blok(container, 'footer')!;

    const przyciski = within(stopka).getAllByRole('button');
    expect(przyciski).toHaveLength(1);
    expect(przyciski[0]).toHaveTextContent('Copy link');
    // Pułapka #36 — pigułka, nie `rounded-lg`; klasy z `actionPillClass()`.
    expect(przyciski[0].className).toContain('rounded-full');
    expect(przyciski[0].className).not.toContain('rounded-lg');
    expect(przyciski[0].className).not.toMatch(/\bbg-primary|\btext-primary/);
    // Anty-duplikacja §7.3 pkt 4.3 — „Open" żyje WYŁĄCZNIE w nagłówku i jest jeden.
    expect(within(stopka).queryByRole('button', { name: /open/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^open$/i })).toHaveLength(1);
    // Martwe przyciski: te dwie akcje nie mają wołacza we froncie.
    expect(screen.queryByRole('button', { name: /create execution case/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /report progress/i })).toBeNull();

    await userEvent.click(przyciski[0]);
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it('(6) wiersz BEZ realizacji: jeden chip stanu, brak dubla zdania, same myślniki w faktach', () => {
    const { container } = renderPodglad(rowWithoutCase());
    const meta = blok(container, 'meta')!;
    expect(within(meta).getByText('No execution case yet')).toBeInTheDocument();

    const details = blok(container, 'details')!;
    expect(within(details).getByText('Not linked yet')).toBeInTheDocument();
    // Proza: zdanie o braku realizacji PADA RAZ, nie dwa (summary + next step).
    const proza = details.textContent ?? '';
    expect(proza).toMatch(/with no execution case behind it yet/);
    expect(proza).toMatch(/Execution starts when this initiative is handed off/);
    expect(proza.match(/No execution case yet/g) ?? []).toHaveLength(0);
    // Stopka nadal przyklejona — także dla wiersza bez danych.
    expect(within(blok(container, 'footer')!).getByRole('button')).toHaveTextContent('Copy link');
  });

  it('(7) następny krok wynika ZE STANU — brak bazy odniesienia wygrywa z brakiem postępu', () => {
    const { container } = renderPodglad(
      rowWithCase({
        baselineFinish: gap('BASELINE_MISSING'),
        forecastFinish: gap('FORECAST_MISSING'),
        progress: gap('PROGRESS_MISSING'),
      })
    );
    const details = blok(container, 'details')!;
    expect(within(details).getByText(/Set the schedule baseline/)).toBeInTheDocument();
    expect(within(details).queryByText(/Report a forecast finish date/)).toBeNull();
  });

  it('(8) następny krok prosi o prognozę, a potem o postęp — w tej kolejności', () => {
    const { container: bezPrognozy } = renderPodglad(
      rowWithCase({ forecastFinish: gap('FORECAST_MISSING'), progress: gap('PROGRESS_MISSING') })
    );
    expect(
      within(blok(bezPrognozy, 'details')!).getByText(/Report a forecast finish date/)
    ).toBeInTheDocument();

    const { container: bezPostepu } = renderPodglad(
      rowWithCase({ progress: gap('PROGRESS_MISSING') })
    );
    expect(
      within(blok(bezPostepu, 'details')!).getByText(/Report progress on the execution case/)
    ).toBeInTheDocument();
  });

  it('(9) powiązana realizacja bez wersji pokazuje opisowy brak danych bez prefiksu „v"', () => {
    const { container } = renderPodglad(rowWithCase({ executionCaseVersion: null }));
    const details = blok(container, 'details')!;

    expect(within(details).getByText('Linked · version not reported')).toBeInTheDocument();
    expect(within(details).queryByText('Linked · v—')).toBeNull();
    expect(details).not.toHaveTextContent('v—');
  });
});
