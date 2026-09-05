/**
 * RoiCaseAssumptionsNarrative — sekcja „Założenia" karty ROI w KOMPOZYCJI
 * ZATWIERDZONEJ PRZEZ WŁAŚCICIELA.
 *
 * ── DLACZEGO TEN PLIK ISTNIEJE (odrzucenie 2026-09-05) ────────────────────
 * Właściciel odrzucił żywy ekran `roi-jedna-karta` jednym zdaniem: „Nie. Ma
 * być taka jak zatwierdzona." Pomiar (runda 7, `evidence/odbior-zywo-20260905/
 * 08-wyniki/wyniki.json` → wpis `roi-jedna-karta`) rozstrzygnął, że różnica
 * jest KOMPOZYCYJNA, nie danymi: `RoiCaseFullTool.tsx` renderował w sekcji
 * „Założenia" BEZWARUNKOWO surowy warsztat edycyjny (`RoiCaseModelWorkspace`,
 * zakładki „Baseline i polityka"/„Założenia" z tabelami Ustawienie/
 * Podsumowanie/Pewność/Zaktualizowano), a narracja z zatwierdzonego obrazu
 * (`evidence/grafika/25-roi-jedna-karta/roi-jedna-karta__PO__light__zalozenia.png`)
 * istniała WYŁĄCZNIE jako twardo wpisany JSX w prototypie
 * `dev-render/screens/roi-jedna-karta.tsx:206-241` (fikcyjna sprawa NordFood).
 *
 * Ten komponent buduje TE SAME TRZY BLOKI z REALNYCH danych sprawy — zero
 * tekstu mock, zero liczby wymyślonej:
 *   ① „Parametry przypadku biznesowego" — `RoiCalculationPolicy` (stopa
 *      dyskontowa, wymagane metryki, podatki, inflacja) + `RoiCaseListItem`
 *      (okno analizy, waluta, ziarno) + suma `RoiCostLine`.
 *   ② „Na co idzie {suma}"             — `RoiCostLine[]` (etykieta, opis,
 *      kwota, tryb czasowy) — dokładnie tabela Pozycja/Kwota z obrazu.
 *   ③ „Źródła liczb"                   — `RoiBaseline.source/confidence`,
 *      `RoiAssumption.source/evidenceRef/notes`, `RoiCalculationPolicy.notes`
 *      i właściciel sprawy jako IMIĘ (`useOrganizationMemberNames`).
 *
 * ── CZEGO TU NIE MA (uczciwie) ────────────────────────────────────────────
 * Nie ma ani jednego zdania generowanego „z powietrza". Gdy pole jest puste,
 * wiersz pokazuje „—", a blok bez ani jednego rekordu pokazuje PRAWDZIWY stan
 * pusty z jednym CTA prowadzącym do istniejącego warsztatu edycyjnego (który
 * NIE został usunięty — patrz kebab Menu 1 „Edytuj założenia"
 * w `RoiCaseFullTool.tsx`).
 *
 * Tokeny wyłącznie `c-*`; zero `primary-*` (crimson) — `scripts/check-artefakt.sh`.
 */
import { Pencil, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { NModeContentBlock } from '@/components/shared/NModeLayout';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';

import { toUserFacingErrorMessage } from '../shared/errorMessage';
import type { RoiCaseListItem } from './roiApi';
import {
  getRoiBaseline,
  getRoiCalculationPolicy,
  listRoiAssumptions,
  listRoiCostLines,
  type RoiAssumption,
  type RoiBaseline,
  type RoiCalculationPolicy,
  type RoiCostLine,
} from './roiCaseDetailApi';
import {
  describeRoiLineTiming,
  roiConfidenceLabel,
  roiTaxTreatmentLabel,
} from './roiCaseDetailMappers';
import {
  formatRoiCurrency,
  formatRoiDate,
  formatRoiPercent,
} from './roiRegistryMappers';

export interface RoiCaseAssumptionsNarrativeProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  /** Wejście do surowego warsztatu edycyjnego (Baseline i polityka / Założenia). */
  onEditAssumptions: () => void;
  /** Wejście do sekcji „Model" → zakładka „Koszty" (tam mieszka CRUD pozycji). */
  onEditCostLines: () => void;
}

const EM_DASH = '—';

const SECONDARY_BTN =
  'inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-c-border-subtle ' +
  'bg-c-surface-raised px-3 text-left text-xs font-medium text-c-text-secondary transition ' +
  'hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[color:var(--c-focus)]';

// ── prymitywy wizualne 1:1 z zatwierdzonym prototypem ───────────────────────

const KV: React.FC<{ rows: { label: string; value: string }[] }> = ({ rows }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
    {rows.map((r) => (
      <div
        key={r.label}
        className="flex items-baseline justify-between gap-3 border-b border-c-border-subtle/60 pb-1.5"
      >
        <dt className="text-xs text-c-text-muted">{r.label}</dt>
        <dd className="text-right text-xs font-medium tabular-nums text-c-text">{r.value}</dd>
      </div>
    ))}
  </dl>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((item, idx) => (
      <li key={idx} className="flex items-start gap-2 text-xs text-c-text-secondary">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
        <span className="min-w-0">{item}</span>
      </li>
    ))}
  </ul>
);

const CostTable: React.FC<{
  head: [string, string];
  rows: { id: string; label: string; description: string | null; timing: string; amount: string }[];
}> = ({ head, rows }) => (
  <div className="overflow-x-auto rounded-lg border border-c-border-subtle">
    {/* Narracyjna tabela read-only wewnątrz bloku karty artefaktu (dwie kolumny
        Pozycja/Kwota, zero sortowania/filtrów/zaznaczania/kebaba) — nie jest
        listą encji do przeglądania, więc StandardTable (moduł-bar, pstryczek
        kolumn, preview) byłby obcym ekranem listowym w środku zatwierdzonej
        kompozycji. Ta sama klasa wyjątku co FullReportDocument/TaskDetailView. */}
    <table /* §27-exempt: tabela dokumentowa/narracyjna read-only w karcie artefaktu */ className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-c-surface-raised">
          <th className="border-b border-c-border-subtle px-3 py-2 text-left font-medium text-c-text-muted">
            {head[0]}
          </th>
          <th className="border-b border-c-border-subtle px-3 py-2 text-right font-medium text-c-text-muted">
            {head[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr
            key={row.id}
            className={ri < rows.length - 1 ? 'border-b border-c-border-subtle' : ''}
            data-testid="roi-narrative-cost-row"
          >
            <td className="px-3 py-2 text-left text-c-text">
              <span className="block">{row.label}</span>
              {row.description ? (
                <span className="mt-0.5 block text-[11px] text-c-text-muted">{row.description}</span>
              ) : null}
              <span className="mt-0.5 block text-[11px] text-c-text-muted">{row.timing}</span>
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-c-text-secondary align-top">
              {row.amount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── czysto obliczeniowe pomocniki (eksportowane dla testu) ──────────────────

/**
 * Liczba pełnych miesięcy okna analizy + jego słowny opis, np.
 * „24 miesiące (wrzesień 2026 – sierpień 2028)". Zwraca `null`, gdy sprawa nie
 * ma jeszcze ustalonego okna — wtedy wiersz pokazuje „—", a nie zmyśloną liczbę.
 */
export function describeRoiAnalysisHorizon(
  analysisStart: string | null,
  analysisEnd: string | null,
  isPolish: boolean
): string | null {
  if (!analysisStart || !analysisEnd) return null;
  const start = new Date(analysisStart);
  const end = new Date(analysisEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const locale = isPolish ? 'pl-PL' : 'en-US';
  const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const span = `${fmt(start)} – ${fmt(end)}`;
  if (months <= 0) return span;
  return `${months} ${monthWord(months, isPolish)} (${span})`;
}

/** Polska odmiana „miesiąc/miesiące/miesięcy" (angielski: month/months). */
export function monthWord(n: number, isPolish: boolean): string {
  if (!isPolish) return n === 1 ? 'month' : 'months';
  if (n === 1) return 'miesiąc';
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'miesiące';
  return 'miesięcy';
}

/** Opis metody liczenia z REALNEJ polityki kalkulacji sprawy. */
export function describeRoiCalculationMethod(
  policy: RoiCalculationPolicy | null,
  granularity: RoiCaseListItem['granularity'],
  isPolish: boolean
): string {
  const parts: string[] = [];
  parts.push(
    granularity === 'monthly'
      ? isPolish
        ? 'przepływy miesięczne'
        : 'monthly cash flows'
      : isPolish
        ? 'przepływy roczne'
        : 'annual cash flows'
  );
  const metrics = policy?.requiredMetrics ?? null;
  if (metrics && metrics.length > 0) parts.push(metrics.join('/'));
  if (policy?.taxTreatment && policy.taxTreatment !== 'not_modeled') {
    parts.push(roiTaxTreatmentLabel(policy.taxTreatment, isPolish).toLocaleLowerCase(isPolish ? 'pl-PL' : 'en-US'));
  }
  return parts.join(', ');
}

/** Opis waluty + traktowania inflacji — nigdy „ceny stałe", gdy polityka milczy. */
export function describeRoiCurrencyNote(
  currency: string,
  policy: RoiCalculationPolicy | null,
  isPolish: boolean
): string {
  if (!policy || policy.inflationRatePct === null) return currency;
  if (policy.inflationRatePct === 0) {
    return `${currency}, ${isPolish ? 'ceny stałe (bez inflacji w prognozie)' : 'constant prices (no inflation modeled)'}`;
  }
  return `${currency}, ${isPolish ? 'inflacja' : 'inflation'} ${formatRoiPercent(policy.inflationRatePct, isPolish)}`;
}

/**
 * Bullety „Źródła liczb" — WYŁĄCZNIE z rekordów sprawy. Pusty wynik znaczy
 * „nikt jeszcze nie udokumentował źródeł", a nie „brak danych do pokazania".
 */
export function buildRoiSourceBullets(
  baseline: RoiBaseline | null,
  policy: RoiCalculationPolicy | null,
  assumptions: RoiAssumption[],
  isPolish: boolean
): string[] {
  const out: string[] = [];

  if (baseline) {
    const bits: string[] = [];
    if (baseline.currentMeasuredValue !== null) {
      const unit = baseline.currentMeasuredUnit ? ` ${baseline.currentMeasuredUnit}` : '';
      bits.push(
        `${baseline.currentMeasuredValue.toLocaleString(isPolish ? 'pl-PL' : 'en-US')}${unit}`
      );
    }
    if (baseline.currentMeasuredAsOf) {
      bits.push(
        `${isPolish ? 'stan na' : 'as of'} ${formatRoiDate(baseline.currentMeasuredAsOf, isPolish)}`
      );
    }
    if (baseline.source) bits.push(baseline.source);
    if (baseline.confidence) {
      bits.push(
        `${isPolish ? 'pewność' : 'confidence'}: ${roiConfidenceLabel(baseline.confidence, isPolish)}`
      );
    }
    if (bits.length > 0) out.push(`${isPolish ? 'Poziom bazowy' : 'Baseline'} — ${bits.join('; ')}`);
  }

  assumptions.forEach((a) => {
    const source = a.source || a.evidenceRef || a.notes;
    out.push(
      source
        ? `${a.label} — ${source}`
        : `${a.label} — ${isPolish ? 'źródło nieudokumentowane' : 'source not documented'}`
    );
  });

  if (policy?.notes) {
    out.push(`${isPolish ? 'Polityka kalkulacji' : 'Calculation policy'} — ${policy.notes}`);
  }

  return out;
}

// ── komponent ───────────────────────────────────────────────────────────────

export const RoiCaseAssumptionsNarrative: React.FC<RoiCaseAssumptionsNarrativeProps> = ({
  roiCase,
  isPolish,
  onEditAssumptions,
  onEditCostLines,
}) => {
  const scope = `roi:${roiCase.caseId}`;
  const resolveMemberName = useOrganizationMemberNames();

  const [baseline, setBaseline] = useState<RoiBaseline | null>(null);
  const [policy, setPolicy] = useState<RoiCalculationPolicy | null>(null);
  const [assumptions, setAssumptions] = useState<RoiAssumption[]>([]);
  const [costLines, setCostLines] = useState<RoiCostLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getRoiBaseline(roiCase.caseId),
      getRoiCalculationPolicy(roiCase.caseId),
      listRoiAssumptions(roiCase.caseId),
      listRoiCostLines(roiCase.caseId),
    ])
      .then(([b, p, a, c]) => {
        if (cancelled) return;
        setBaseline(b);
        setPolicy(p);
        setAssumptions(a.filter((row) => !row.deletedAt));
        setCostLines(c.filter((row) => !row.deletedAt));
      })
      .catch((err) => {
        if (!cancelled) setError(toUserFacingErrorMessage(err, isPolish));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `isPolish` steruje tylko językiem komunikatu błędu — nie przeładowujemy
    // danych przy zmianie języka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roiCase.caseId]);

  useEffect(() => load(), [load]);

  const costTotal = useMemo(
    () => costLines.reduce((sum, line) => sum + (Number.isFinite(line.amount) ? line.amount : 0), 0),
    [costLines]
  );
  const allOneTime = costLines.length > 0 && costLines.every((l) => l.timingType === 'one_time');

  const money = (v: number) => formatRoiCurrency(v, roiCase.currency, isPolish);

  const horizon = describeRoiAnalysisHorizon(roiCase.analysisStart, roiCase.analysisEnd, isPolish);
  const sourceBullets = buildRoiSourceBullets(baseline, policy, assumptions, isPolish);
  const ownerName = memberNameOrUnknown(resolveMemberName, roiCase.ownerUserId, isPolish);

  const paramRows: { label: string; value: string }[] = [
    {
      label: allOneTime
        ? isPolish
          ? 'Inwestycja początkowa'
          : 'Initial investment'
        : isPolish
          ? 'Koszty łącznie'
          : 'Total costs',
      value: costLines.length > 0 ? money(costTotal) : EM_DASH,
    },
    { label: isPolish ? 'Horyzont analizy' : 'Analysis horizon', value: horizon ?? EM_DASH },
    {
      label: isPolish ? 'Stopa dyskontowa' : 'Discount rate',
      value:
        policy?.discountRatePct !== null && policy?.discountRatePct !== undefined
          ? `${formatRoiPercent(policy.discountRatePct, isPolish)} ${isPolish ? 'rocznie' : 'per year'}`
          : EM_DASH,
    },
    {
      label: isPolish ? 'Data startu analizy' : 'Analysis start date',
      value: formatRoiDate(roiCase.analysisStart, isPolish),
    },
    {
      label: isPolish ? 'Metoda liczenia' : 'Calculation method',
      value: describeRoiCalculationMethod(policy, roiCase.granularity, isPolish),
    },
    {
      label: isPolish ? 'Waluta' : 'Currency',
      value: describeRoiCurrencyNote(roiCase.currency, policy, isPolish),
    },
  ];

  if (loading) {
    return (
      <div
        className="flex h-full min-h-0 items-start justify-center overflow-y-auto p-6 text-xs text-c-text-muted"
        data-testid="roi-narrative-loading"
      >
        {isPolish ? 'Wczytywanie założeń sprawy…' : 'Loading case assumptions…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-6" data-testid="roi-narrative-error">
        <p className="text-xs text-c-danger">{error}</p>
        <button type="button" className={SECONDARY_BTN} onClick={load}>
          {isPolish ? 'Spróbuj ponownie' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4" data-testid="roi-assumptions-narrative">
      <div className="flex flex-col gap-4">
        <NModeContentBlock
          blockId="zalozenia-parametry"
          scope={scope}
          isPolish={isPolish}
          title={isPolish ? 'Parametry przypadku biznesowego' : 'Business case parameters'}
          readMode
        >
          <KV rows={paramRows} />
        </NModeContentBlock>

        <NModeContentBlock
          blockId="zalozenia-sklad-inwestycji"
          scope={scope}
          isPolish={isPolish}
          title={
            costLines.length > 0
              ? isPolish
                ? `Na co idzie ${money(costTotal)}`
                : `Where the ${money(costTotal)} goes`
              : isPolish
                ? 'Skład inwestycji'
                : 'Investment breakdown'
          }
          readMode
        >
          {costLines.length > 0 ? (
            <CostTable
              head={[isPolish ? 'Pozycja' : 'Item', isPolish ? 'Kwota' : 'Amount']}
              rows={costLines.map((line) => ({
                id: line.costLineId,
                label: line.label,
                description: line.description,
                timing: describeRoiLineTiming(line, isPolish, formatRoiDate),
                amount: formatRoiCurrency(line.amount, line.currency || roiCase.currency, isPolish),
              }))}
            />
          ) : (
            <div className="flex flex-col gap-3" data-testid="roi-narrative-costs-empty">
              <p className="text-xs text-c-text-secondary">
                {isPolish
                  ? 'Ta sprawa nie ma jeszcze ani jednej pozycji kosztowej — dopóki ich nie ma, nie da się uczciwie napisać, na co idą pieniądze.'
                  : 'This case has no cost lines yet — until they exist, there is no honest way to say where the money goes.'}
              </p>
              <button type="button" className={SECONDARY_BTN} onClick={onEditCostLines}>
                <Plus size={13} className="shrink-0 text-c-text-muted" />
                {isPolish ? 'Dodaj pozycje kosztowe' : 'Add cost lines'}
              </button>
            </div>
          )}
        </NModeContentBlock>

        <NModeContentBlock
          blockId="zalozenia-zrodla"
          scope={scope}
          isPolish={isPolish}
          title={isPolish ? 'Źródła liczb' : 'Where the numbers come from'}
          readMode
        >
          {sourceBullets.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Bullets items={sourceBullets} />
              <p className="text-xs text-c-text-muted">
                {isPolish ? 'Właściciel liczb' : 'Owner of the numbers'}: {ownerName}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3" data-testid="roi-narrative-sources-empty">
              <p className="text-xs text-c-text-secondary">
                {isPolish
                  ? 'Nikt jeszcze nie udokumentował źródeł liczb tej sprawy (brak baseline’u ze źródłem i brak założeń).'
                  : 'Nobody has documented the sources for this case yet (no sourced baseline, no assumptions).'}
              </p>
              <button type="button" className={SECONDARY_BTN} onClick={onEditAssumptions}>
                <Pencil size={13} className="shrink-0 text-c-text-muted" />
                {isPolish ? 'Uzupełnij założenia i baseline' : 'Fill in assumptions and baseline'}
              </button>
            </div>
          )}
        </NModeContentBlock>
      </div>
    </div>
  );
};

export default RoiCaseAssumptionsNarrative;
