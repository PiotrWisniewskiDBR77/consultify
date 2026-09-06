/**
 * ROI (P7K C) — TREŚĆ trzech części karty analizy: Założenia → Wyliczenia →
 * Realizacja. Dokładnie ta kolejność i ten podział, o które prosił właściciel:
 *
 *   „Każdy ROI zawiera kartę typu N, w której znajdują się: najpierw elementy
 *    związane z założeniami, potem karta z wyliczeniami, a na koniec analiza,
 *    czy wszystko zostało dostarczone."
 *   (docs/program/grafika/ROI_METODYKA_WLASCICIELA_20260905.md)
 *
 * ZAŁOŻENIA NIE SĄ JEDNYM AKAPITEM. Prototyp streszczał je zdaniem — to była
 * makieta. Tutaj każda rodzina z metodyki dostaje własną, uporządkowaną
 * tabelę: przedmiot i cel (§1), horyzont (§2), nakłady z rezerwą (§3),
 * ΔNWC (§4), przyrostowy OPEX (§5), korzyści per klasa Hard/Avoided/Soft/
 * Strategic z łańcuchem KPI → pieniądze (§6-14, §32-35), założenia z
 * wychyleniami i pewnością, ryzyka z mitygacjami (§30).
 *
 * KOLOR: neutralnie wszędzie. Czerwień (`c-danger`) WYŁĄCZNIE dla wariancji
 * NIEKORZYSTNEJ w części Realizacja — tam znaczy „poza planem", czyli dokładnie
 * to, na co czerwień jest zarezerwowana (TRIADA_KANON, CLAUDE.md pułapka nr 1:
 * `primary-*` to crimson, nie wolno go używać do stanów aktywnych).
 *
 * BRAK = „—" Z POWODEM. Puste sekcje mówią, CZEGO brakuje i dlaczego, zamiast
 * pokazywać 0 albo pustą ramkę.
 */
import React from 'react';

import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StatusChip } from '@/components/ui/primitives';

import type {
  RoiCaseCard,
  RoiCardBenefitLine,
  RoiCardCostLine,
} from './roiCardApi';
import {
  BRAK,
  benefitClassLabel,
  cadenceLabel,
  confidenceLabel,
  fmtDate,
  fmtMoney,
  fmtNumber,
  fmtPercent,
  fmtRatio,
  fmtSignedNumber,
  fmtYears,
  RECOMMENDATION_LABEL,
  riskLevelLabel,
  roiHorizonLabel,
  scenarioTypeLabel,
  sensitivityDriverLabel,
  variantLabel,
  varianceDirection,
  verdictLabel,
} from './roiCardFormat';

// ==========================================
// Prymitywy układu — jeden wygląd bloku i tabeli w całej karcie
// ==========================================

const CARD_CLASS =
  'rounded-2xl border border-c-border-subtle bg-c-surface p-4 md:p-5';

export const RoiBlock: React.FC<{
  title: string;
  hint?: string;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, hint, children, testId }) => (
  <section className={CARD_CLASS} data-testid={testId}>
    <header className="mb-3">
      <h3 className="text-sm font-semibold text-c-text">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-c-text-muted">{hint}</p> : null}
    </header>
    {children}
  </section>
);

const EmptyLine: React.FC<{ reason: string }> = ({ reason }) => (
  <p className="text-xs italic text-c-text-muted">{reason}</p>
);

interface SimpleColumn<T> {
  id: string;
  label: string;
  align?: 'left' | 'right';
  /** Liczby i daty NIGDY się nie łamią (werdykt K2/K13). */
  nowrap?: boolean;
  render: (row: T) => React.ReactNode;
}

/**
 * Tabela wewnątrz karty N.
 *
 * ŚWIADOMIE NIE `StandardTable`: kanon list (CLAUDE.md §UI 1/9) rządzi
 * EKRANAMI LISTOWYMI — tam, gdzie wiersz jest obiektem otwieranym w podglądzie,
 * z kebabem, pstryczkiem kolumn i filtrami. Tu wiersz jest POZYCJĄ TREŚCI
 * wewnątrz jednego artefaktu (linia kosztu, rok przepływu, wariancja) i nie ma
 * ani podglądu, ani kebaba, ani filtrów. Ten sam wybór już podjęły karty
 * KPI i OKR (`ArtifactPropertiesTable` + własne tabelki sekcji) — jedna
 * konwencja, nie druga tabela-rywalka.
 */
function RoiTable<T>({
  columns,
  rows,
  keyOf,
  emptyReason,
  testId,
}: {
  columns: SimpleColumn<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  emptyReason: string;
  testId?: string;
}): React.ReactElement {
  if (rows.length === 0) return <EmptyLine reason={emptyReason} />;
  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table /* §27-exempt: tabela TREŚCI wewnątrz karty artefaktu (pozycja kosztu, rok przepływu, wariancja) — read-only, bez podglądu, kebaba i filtrów; kanon list dotyczy ekranów listowych, patrz docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md */ className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-c-border-subtle">
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={`px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                }`}
                // Nagłówek łamie się TYLKO na spacji (K13), nigdy w środku słowa.
                style={{ hyphens: 'none', overflowWrap: 'normal' }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyOf(row)} className="border-b border-c-border-subtle/60 last:border-0">
              {columns.map((c) => (
                <td
                  key={c.id}
                  className={`px-2 py-2 align-top text-c-text-secondary ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  } ${c.nowrap ? 'whitespace-nowrap tabular-nums' : ''}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Tile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
    <div className="text-[11px] font-medium uppercase tracking-wider text-c-text-muted">{label}</div>
    <div className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums text-c-text">{value}</div>
    {hint ? <div className="mt-0.5 text-[11px] text-c-text-muted">{hint}</div> : null}
  </div>
);

// ==========================================
// CZĘŚĆ 1 — ZAŁOŻENIA
// ==========================================

/** Pozycje jednorazowe = nakład (CAPEX z rezerwą); cykliczne = przyrostowy OPEX. */
function splitCostLines(lines: RoiCardCostLine[]) {
  return {
    capital: lines.filter((l) => l.timingType === 'one_time'),
    operating: lines.filter((l) => l.timingType === 'recurring'),
  };
}

/** Korzyści monetyzowane i te ŚWIADOMIE niemonetyzowane (Soft/Strategic). */
function splitBenefitLines(lines: RoiCardBenefitLine[]) {
  return {
    monetised: lines.filter((l) => l.isFinancial),
    reported: lines.filter((l) => !l.isFinancial),
  };
}

export const RoiAssumptionsPart: React.FC<{ card: RoiCaseCard; isPolish: boolean }> = ({
  card,
  isPolish,
}) => {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const cur = card.currency;
  const { capital, operating } = splitCostLines(card.costLines);
  const { monetised, reported } = splitBenefitLines(card.benefitLines);
  const horizon = card.indicators.horizonYears;
  const workingCapital = card.assumptions.find((a) => a.category === 'working_capital') ?? null;

  const subjectRows: ArtifactPropertyRow[] = [
    { id: 'subject', label: t('Przedmiot inwestycji', 'Investment subject'), value: card.subjectType ?? BRAK },
    {
      id: 'variant',
      label: t('Wariant', 'Option'),
      value: variantLabel(card.optionVariant, card.optionVariantLabel),
    },
    {
      id: 'horizon',
      label: t('Horyzont analizy', 'Analysis horizon'),
      value: horizon ? `${horizon} ${t('lat', 'yrs')} (${fmtDate(card.analysisStart, isPolish)} – ${fmtDate(card.analysisEnd, isPolish)})` : BRAK,
      mono: true,
    },
    { id: 'problem', label: t('Problem biznesowy', 'Business problem'), value: card.problemStatement ?? BRAK },
    { id: 'scope', label: t('Zakres', 'Scope'), value: card.scopeSummary ?? BRAK },
    {
      id: 'bau',
      label: t('Wariant bazowy (BAU)', 'Baseline option (BAU)'),
      value: card.bauOptionLabel ?? BRAK,
    },
    {
      id: 'baseline',
      label: t('Punkt odniesienia', 'Measured baseline'),
      value: card.baseline?.currentMeasuredValue !== null && card.baseline?.currentMeasuredValue !== undefined
        ? `${fmtNumber(card.baseline.currentMeasuredValue, isPolish)} ${card.baseline.currentMeasuredUnit ?? ''} · ${fmtDate(card.baseline.currentMeasuredAsOf, isPolish)}`.trim()
        : BRAK,
      mono: true,
    },
    {
      id: 'baselineNotes',
      label: t('Opis punktu odniesienia', 'Baseline notes'),
      value: card.baseline?.interventionComparisonNotes ?? BRAK,
    },
  ];

  return (
    <div className="space-y-4" data-testid="roi-card-part-assumptions">
      <RoiBlock
        title={t('Przedmiot, cel i wariant bazowy', 'Subject, goal and baseline option')}
        hint={t(
          'Inwestycji nie porównuje się do abstrakcyjnego zera — punktem odniesienia jest wariant bazowy (BAU).',
          'An investment is never compared to an abstract zero — the reference is the baseline (BAU) option.'
        )}
        testId="roi-card-subject"
      >
        <ArtifactPropertiesTable
          rows={subjectRows}
          propertyLabel={t('Element', 'Element')}
          valueLabel={t('Wartość', 'Value')}
        />
      </RoiBlock>

      <RoiBlock
        title={t('Nakłady inwestycyjne (CAPEX z rezerwą)', 'Investment outlay (CAPEX incl. contingency)')}
        hint={t('Suma pozycji jednorazowych; rezerwa jest osobną pozycją, nie doliczana w tle.', 'Sum of one-time lines; contingency is its own line, never added silently.')}
        testId="roi-card-capex"
      >
        <RoiTable
          columns={[
            { id: 'label', label: t('Pozycja', 'Line'), render: (l: RoiCardCostLine) => <span className="text-c-text">{l.label}</span> },
            { id: 'category', label: t('Kategoria', 'Category'), render: (l: RoiCardCostLine) => l.category },
            { id: 'description', label: t('Opis', 'Description'), render: (l: RoiCardCostLine) => l.description ?? BRAK },
            {
              id: 'amount',
              label: t('Kwota', 'Amount'),
              align: 'right',
              nowrap: true,
              render: (l: RoiCardCostLine) => fmtMoney(l.amount, l.currency, isPolish),
            },
          ]}
          rows={capital}
          keyOf={(l) => l.costLineId}
          emptyReason={t(
            'Brak pozycji nakładu — model kosztowy tej analizy nie został jeszcze wprowadzony.',
            'No outlay lines — the cost model for this analysis has not been entered yet.'
          )}
          testId="roi-card-capex-table"
        />
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-c-border-subtle pt-3">
          <span className="text-xs font-medium uppercase tracking-wider text-c-text-muted">
            {t('Nakład początkowy razem', 'Total initial outlay')}
          </span>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-c-text">
            {fmtMoney(card.indicators.capex, cur, isPolish)}
          </span>
        </div>
        {/*
          ΔNWC (metodyka §4). W tym schemacie zmiana kapitału obrotowego jest
          ZAŁOŻENIEM (kategoria `working_capital`), nie pozycją kosztu — więc
          pokazujemy ją osobno i JAWNIE mówimy, skąd pochodzi, zamiast po cichu
          doliczać do CAPEX-u albo udawać, że jej nie ma.
        */}
        {workingCapital ? (
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-c-text-muted">
              {t('ΔNWC — zmiana kapitału obrotowego (z założeń)', 'ΔNWC — working capital change (from assumptions)')}
            </span>
            <span className="whitespace-nowrap text-sm tabular-nums text-c-text-secondary">
              {fmtMoney(workingCapital.baseValue, cur, isPolish)}
            </span>
          </div>
        ) : null}
      </RoiBlock>

      <RoiBlock
        title={t('Przyrostowe koszty operacyjne (incremental OPEX)', 'Incremental OPEX')}
        hint={t(
          'Tylko różnica: koszt z inwestycją minus koszt bez inwestycji.',
          'Only the difference: cost with the investment minus cost without it.'
        )}
        testId="roi-card-opex"
      >
        <RoiTable
          columns={[
            { id: 'label', label: t('Pozycja', 'Line'), render: (l: RoiCardCostLine) => <span className="text-c-text">{l.label}</span> },
            { id: 'cadence', label: t('Częstotliwość', 'Cadence'), nowrap: true, render: (l: RoiCardCostLine) => cadenceLabel(l.recurrenceCadence, isPolish) },
            {
              id: 'amount',
              label: t('Kwota', 'Amount'),
              align: 'right',
              nowrap: true,
              render: (l: RoiCardCostLine) => fmtMoney(l.amount, l.currency, isPolish),
            },
          ]}
          rows={operating}
          keyOf={(l) => l.costLineId}
          emptyReason={t(
            'Brak zaksięgowanych kosztów cyklicznych. Wartości z listy założeń (np. serwis, media) nie są tu doliczane automatycznie — dopóki nie staną się pozycją kosztu, nie wchodzą do przepływów.',
            'No recurring cost lines recorded. Values from the assumptions list are not folded in automatically — until they become cost lines they do not enter the cash flow.'
          )}
        />
      </RoiBlock>

      <RoiBlock
        title={t('Korzyści ekonomiczne', 'Economic benefits')}
        hint={t(
          'Każda korzyść ma własną klasę i własne wyprowadzenie z KPI — zakaz podwójnego liczenia.',
          'Every benefit carries its own class and its own KPI derivation — no double counting.'
        )}
        testId="roi-card-benefits"
      >
        <RoiTable
          columns={[
            { id: 'label', label: t('Korzyść', 'Benefit'), render: (l: RoiCardBenefitLine) => <span className="text-c-text">{l.label}</span> },
            {
              id: 'class',
              label: t('Klasa', 'Class'),
              nowrap: true,
              render: (l: RoiCardBenefitLine) => (
                <StatusChip label={benefitClassLabel(l.benefitClass, isPolish)} tone="neutral" hideDot />
              ),
            },
            {
              id: 'chain',
              label: t('Łańcuch KPI → pieniądze', 'KPI → money chain'),
              render: (l: RoiCardBenefitLine) => l.kpiChainNote ?? BRAK,
            },
            {
              id: 'cadence',
              label: t('Częstotliwość', 'Cadence'),
              nowrap: true,
              render: (l: RoiCardBenefitLine) => cadenceLabel(l.recurrenceCadence, isPolish),
            },
            {
              id: 'amount',
              label: t('Kwota / rok', 'Amount / yr'),
              align: 'right',
              nowrap: true,
              render: (l: RoiCardBenefitLine) => fmtMoney(l.amount, l.currency ?? cur, isPolish),
            },
          ]}
          rows={monetised}
          keyOf={(l) => l.benefitLineId}
          emptyReason={t(
            'Brak korzyści monetyzowanych — model korzyści nie został jeszcze wprowadzony.',
            'No monetized benefits — the benefit model has not been entered yet.'
          )}
          testId="roi-card-benefits-table"
        />
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-c-border-subtle pt-3">
          <span className="text-xs font-medium uppercase tracking-wider text-c-text-muted">
            {t('Roczna korzyść netto', 'Annual net benefit')}
          </span>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-c-text">
            {fmtMoney(card.indicators.annualNetBenefit, cur, isPolish)}
          </span>
        </div>

        {reported.length > 0 ? (
          <div className="mt-4 border-t border-c-border-subtle pt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-c-text-muted">
              {t('Raportowane, świadomie nie monetyzowane', 'Reported, deliberately not monetized')}
            </h4>
            <RoiTable
              columns={[
                { id: 'label', label: t('Korzyść', 'Benefit'), render: (l: RoiCardBenefitLine) => <span className="text-c-text">{l.label}</span> },
                {
                  id: 'class',
                  label: t('Klasa', 'Class'),
                  nowrap: true,
                  render: (l: RoiCardBenefitLine) => (
                    <StatusChip label={benefitClassLabel(l.benefitClass, isPolish)} tone="neutral" hideDot />
                  ),
                },
                { id: 'chain', label: t('Efekt', 'Effect'), render: (l: RoiCardBenefitLine) => l.kpiChainNote ?? l.description ?? BRAK },
              ]}
              rows={reported}
              keyOf={(l) => l.benefitLineId}
              emptyReason=""
            />
          </div>
        ) : null}
      </RoiBlock>

      <RoiBlock
        title={t('Założenia i ich wychylenia', 'Assumptions and their swings')}
        hint={t('Wartość bazowa z wariantem pesymistycznym i optymistycznym oraz pewnością i źródłem.', 'Base value with downside and upside, plus confidence and source.')}
        testId="roi-card-assumptions"
      >
        <RoiTable
          columns={[
            { id: 'label', label: t('Założenie', 'Assumption'), render: (a) => <span className="text-c-text">{a.label}</span> },
            { id: 'unit', label: t('Jedn.', 'Unit'), nowrap: true, render: (a) => a.unit ?? BRAK },
            { id: 'base', label: t('Bazowa', 'Base'), align: 'right', nowrap: true, render: (a) => fmtNumber(a.baseValue, isPolish, 2) },
            { id: 'down', label: t('Pesym.', 'Downside'), align: 'right', nowrap: true, render: (a) => fmtNumber(a.downsideValue, isPolish, 2) },
            { id: 'up', label: t('Optym.', 'Upside'), align: 'right', nowrap: true, render: (a) => fmtNumber(a.upsideValue, isPolish, 2) },
            { id: 'confidence', label: t('Pewność', 'Confidence'), nowrap: true, render: (a) => confidenceLabel(a.confidence, isPolish) },
            { id: 'source', label: t('Źródło', 'Source'), render: (a) => a.source ?? BRAK },
          ]}
          rows={card.assumptions}
          keyOf={(a) => a.assumptionId}
          emptyReason={t('Brak zapisanych założeń.', 'No assumptions recorded.')}
          testId="roi-card-assumptions-table"
        />
      </RoiBlock>

      <RoiBlock
        title={t('Ryzyka i mitygacje', 'Risks and mitigations')}
        testId="roi-card-risks"
      >
        <RoiTable
          columns={[
            { id: 'label', label: t('Ryzyko', 'Risk'), render: (r) => <span className="text-c-text">{r.label}</span> },
            { id: 'category', label: t('Rodzina', 'Family'), nowrap: true, render: (r) => r.category },
            { id: 'likelihood', label: t('Prawdop.', 'Likelihood'), nowrap: true, render: (r) => riskLevelLabel(r.likelihood, isPolish) },
            { id: 'impact', label: t('Skutek', 'Impact'), nowrap: true, render: (r) => riskLevelLabel(r.impact, isPolish) },
            { id: 'mitigation', label: t('Mitygacja', 'Mitigation'), render: (r) => r.mitigation ?? BRAK },
          ]}
          rows={card.risks}
          keyOf={(r) => r.riskId}
          emptyReason={t('Brak zarejestrowanych ryzyk dla tej analizy.', 'No risks recorded for this analysis.')}
          testId="roi-card-risks-table"
        />
      </RoiBlock>
    </div>
  );
};

// ==========================================
// CZĘŚĆ 2 — WYLICZENIA
// ==========================================

export const RoiCalculationsPart: React.FC<{ card: RoiCaseCard; isPolish: boolean }> = ({
  card,
  isPolish,
}) => {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const cur = card.currency;
  const run = card.storedRun;
  const ind = card.indicators;

  return (
    <div className="space-y-4" data-testid="roi-card-part-calculations">
      <RoiBlock
        title={t('Wskaźniki inwestycyjne', 'Investment ratios')}
        hint={
          run
            ? t(
                `Liczby z przebiegu silnika (${run.engineVersion}, ${fmtDate(run.completedAt, isPolish)}). PI liczone z tej samej serii przepływów.`,
                `Numbers from the calculation run (${run.engineVersion}, ${fmtDate(run.completedAt, isPolish)}). PI derived from the same cash-flow series.`
              )
            : t(
                'Brak zakończonego przebiegu kalkulacji — wskaźniki pozostają puste, a nie zerowe.',
                'No completed calculation run — the ratios stay empty, not zero.'
              )
        }
        testId="roi-card-indicators"
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          <Tile label="CAPEX" value={fmtMoney(ind.capex, cur, isPolish)} />
          <Tile
            label={t('Roczna korzyść netto', 'Annual net benefit')}
            value={fmtMoney(ind.annualNetBenefit, cur, isPolish)}
          />
          <Tile label={roiHorizonLabel(ind.horizonYears)} value={fmtPercent(run?.roiPct ?? null, isPolish, 0)} />
          <Tile label="Payback" value={fmtYears(run?.paybackPeriods ?? null, isPolish)} />
          <Tile
            label={t('Payback zdyskontowany', 'Discounted Payback')}
            value={fmtYears(run?.discountedPaybackPeriods ?? null, isPolish)}
          />
          <Tile
            label="NPV"
            value={fmtMoney(run?.npv ?? null, cur, isPolish)}
            hint={
              ind.discountRatePct !== null
                ? t(`stopa ${fmtPercent(ind.discountRatePct, isPolish, 1)}`, `rate ${fmtPercent(ind.discountRatePct, isPolish, 1)}`)
                : undefined
            }
          />
          <Tile
            label="IRR"
            value={fmtPercent(run?.irrPct ?? null, isPolish)}
            hint={
              run && run.irrPct === null && run.irrStatus === 'not_required_by_policy'
                ? t('nie wymagane przez politykę analizy', 'not required by the analysis policy')
                : undefined
            }
          />
          <Tile label="PI" value={fmtRatio(ind.profitabilityIndex, isPolish)} />
          <Tile label="BCR" value={fmtRatio(run?.benefitCostRatio ?? null, isPolish)} />
          <Tile label="ARR" value={fmtPercent(ind.arrPct, isPolish, 1)} />
        </div>
      </RoiBlock>

      <RoiBlock
        title={t('Przepływy pieniężne, rok 0–n', 'Cash flow, year 0–n')}
        hint={t(
          'Rok 0 niesie nakład, lata 1–n różnicę korzyści i kosztów cyklicznych. Analizujemy cash flow, nie wynik księgowy.',
          'Year 0 carries the outlay; years 1–n carry recurring benefits minus recurring costs. Cash flow, not accounting profit.'
        )}
        testId="roi-card-cashflow"
      >
        <RoiTable
          columns={[
            { id: 'year', label: t('Rok', 'Year'), nowrap: true, render: (r) => <span className="text-c-text">{r.label}</span> },
            { id: 'costs', label: t('Koszty', 'Costs'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.costs, cur, isPolish) },
            { id: 'benefits', label: t('Korzyści', 'Benefits'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.benefits, cur, isPolish) },
            { id: 'net', label: t('Netto', 'Net'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.net, cur, isPolish) },
            { id: 'cumulative', label: t('Narastająco', 'Cumulative'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.cumulative, cur, isPolish) },
            { id: 'discounted', label: t('Zdyskontowane', 'Discounted'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.discounted, cur, isPolish) },
            {
              id: 'cumulativeDiscounted',
              label: t('Narast. zdysk.', 'Cum. discounted'),
              align: 'right',
              nowrap: true,
              render: (r) => fmtMoney(r.cumulativeDiscounted, cur, isPolish),
            },
          ]}
          rows={card.cashFlow}
          keyOf={(r) => String(r.year)}
          emptyReason={t(
            'Brak serii przepływów — analiza nie ma jeszcze pozycji kosztów i korzyści albo horyzontu.',
            'No cash-flow series — the analysis has no cost/benefit lines or no horizon yet.'
          )}
          testId="roi-card-cashflow-table"
        />
      </RoiBlock>

      <RoiBlock
        title={t('Scenariusze', 'Scenarios')}
        hint={t(
          'Conservative / Base / Upside. Wskaźniki scenariusza pochodzą z JEGO przebiegu kalkulacji — bez przebiegu jest „—", nie liczba przepisana z wariantu bazowego.',
          'Conservative / Base / Upside. Scenario ratios come from that scenario’s own run — without one the value is “—”, never the base case copied over.'
        )}
        testId="roi-card-scenarios"
      >
        <RoiTable
          columns={[
            {
              id: 'type',
              label: t('Scenariusz', 'Scenario'),
              nowrap: true,
              render: (s) => <span className="text-c-text">{scenarioTypeLabel(s.scenarioType)}</span>,
            },
            { id: 'label', label: t('Nazwa', 'Name'), render: (s) => s.label },
            { id: 'description', label: t('Opis', 'Description'), render: (s) => s.description ?? BRAK },
            { id: 'roi', label: 'ROI', align: 'right', nowrap: true, render: (s) => fmtPercent(s.roiPct, isPolish, 0) },
            { id: 'payback', label: 'Payback', align: 'right', nowrap: true, render: (s) => fmtYears(s.paybackYears, isPolish) },
            { id: 'npv', label: 'NPV', align: 'right', nowrap: true, render: (s) => fmtMoney(s.npv, cur, isPolish) },
          ]}
          rows={card.scenarios}
          keyOf={(s) => s.scenarioId}
          emptyReason={t('Brak zdefiniowanych scenariuszy.', 'No scenarios defined.')}
          testId="roi-card-scenarios-table"
        />
      </RoiBlock>

      <RoiBlock
        title={t('Wrażliwość ±20 %', 'Sensitivity ±20 %')}
        hint={t(
          'Pojedyncze sterowniki modelu wychylone o ±20 % — im większa zmiana NPV, tym mocniejszy value driver.',
          'Single model drivers swung by ±20 % — the larger the NPV change, the stronger the value driver.'
        )}
        testId="roi-card-sensitivity"
      >
        <RoiTable
          columns={[
            {
              id: 'driver',
              label: t('Sterownik', 'Driver'),
              render: (r) => <span className="text-c-text">{sensitivityDriverLabel(r.driverId, isPolish)}</span>,
            },
            { id: 'minusNpv', label: t('NPV przy −20\u00a0%', 'NPV at −20\u00a0%'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.minusNpv, cur, isPolish) },
            { id: 'minusRoi', label: t('ROI przy −20\u00a0%', 'ROI at −20\u00a0%'), align: 'right', nowrap: true, render: (r) => fmtPercent(r.minusRoiPct, isPolish, 0) },
            { id: 'minusPp', label: t('Payback przy −20\u00a0%', 'Payback at −20\u00a0%'), align: 'right', nowrap: true, render: (r) => fmtYears(r.minusPaybackYears, isPolish) },
            { id: 'plusNpv', label: t('NPV przy +20\u00a0%', 'NPV at +20\u00a0%'), align: 'right', nowrap: true, render: (r) => fmtMoney(r.plusNpv, cur, isPolish) },
            { id: 'plusRoi', label: t('ROI przy +20\u00a0%', 'ROI at +20\u00a0%'), align: 'right', nowrap: true, render: (r) => fmtPercent(r.plusRoiPct, isPolish, 0) },
            { id: 'plusPp', label: t('Payback przy +20\u00a0%', 'Payback at +20\u00a0%'), align: 'right', nowrap: true, render: (r) => fmtYears(r.plusPaybackYears, isPolish) },
          ]}
          rows={card.sensitivity}
          keyOf={(r) => r.driverId}
          emptyReason={t(
            'Brak modelu do wychylenia — wrażliwość wymaga nakładu, rocznej korzyści i horyzontu.',
            'Nothing to swing — sensitivity needs an outlay, an annual benefit and a horizon.'
          )}
          testId="roi-card-sensitivity-table"
        />
      </RoiBlock>

      <RoiBlock title={t('Rekomendacja', 'Recommendation')} testId="roi-card-recommendation">
        {card.recommendation ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip label={RECOMMENDATION_LABEL[card.recommendation]} tone="neutral" />
            <p className="min-w-0 flex-1 text-sm text-c-text-secondary">
              {card.recommendationCondition ??
                t('Bez dodatkowych warunków.', 'No additional conditions.')}
            </p>
          </div>
        ) : (
          <EmptyLine
            reason={t(
              'Rekomendacja nie została jeszcze wydana — analiza nie przeszła części wyliczeniowej.',
              'No recommendation issued yet — the analysis has not completed its calculation part.'
            )}
          />
        )}
        {card.calculationPolicy?.notes ? (
          <p className="mt-3 border-t border-c-border-subtle pt-3 text-xs text-c-text-muted">
            {card.calculationPolicy.notes}
          </p>
        ) : null}
      </RoiBlock>
    </div>
  );
};

// ==========================================
// CZĘŚĆ 3 — REALIZACJA (Post Investment Review)
// ==========================================

export const RoiRealizationPart: React.FC<{ card: RoiCaseCard; isPolish: boolean }> = ({
  card,
  isPolish,
}) => {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const cur = card.currency;
  const pir = card.pirs[card.pirs.length - 1] ?? null;

  return (
    <div className="space-y-4" data-testid="roi-card-part-realization">
      <RoiBlock
        title={
          pir?.milestoneMonths
            ? t(`Przegląd po ${pir.milestoneMonths} miesiącach`, `Review after ${pir.milestoneMonths} months`)
            : t('Przegląd po realizacji', 'Post investment review')
        }
        hint={t(
          'Expected vs Actual per KPI i per korzyść. Kolor niesie kierunek: wariancja niekorzystna jest czerwona, korzystna neutralna.',
          'Expected vs Actual per KPI and per benefit. Colour carries direction: an unfavourable variance is red, a favourable one neutral.'
        )}
        testId="roi-card-pir"
      >
        <RoiTable
          columns={[
            {
              id: 'metric',
              label: t('KPI / korzyść', 'KPI / benefit'),
              render: (v) => <span className="text-c-text">{v.metric}</span>,
            },
            { id: 'expected', label: 'Expected', align: 'right', nowrap: true, render: (v) => fmtNumber(v.expected, isPolish, 2) },
            { id: 'actual', label: 'Actual', align: 'right', nowrap: true, render: (v) => fmtNumber(v.actual, isPolish, 2) },
            {
              id: 'variance',
              label: t('Wariancja', 'Variance'),
              align: 'right',
              nowrap: true,
              render: (v) => {
                const direction = varianceDirection(v.metric, v.varianceAmount);
                return (
                  <span
                    className={
                      // Czerwień TYLKO dla wariancji niekorzystnej — to jedyne
                      // miejsce w tej karcie, w którym kolor coś znaczy.
                      direction === 'unfavourable'
                        ? 'font-semibold text-c-danger'
                        : 'font-semibold text-c-text'
                    }
                  >
                    {fmtSignedNumber(v.varianceAmount, isPolish)}
                  </span>
                );
              },
            },
            {
              id: 'variancePct',
              label: '%',
              align: 'right',
              nowrap: true,
              render: (v) => fmtSignedNumber(v.variancePct, isPolish, '%'),
            },
          ]}
          rows={card.variances}
          keyOf={(v) => v.varianceId}
          emptyReason={t(
            'Brak porównania Expected vs Actual — przegląd po realizacji nie został jeszcze przeprowadzony.',
            'No Expected vs Actual comparison — the post investment review has not been carried out yet.'
          )}
          testId="roi-card-variances-table"
        />
      </RoiBlock>

      <RoiBlock
        title={t('Prawdziwość założeń', 'Truthfulness of the assumptions')}
        hint={t(
          'Werdykt per założenie: potwierdzone / częściowo / obalone, z opisem.',
          'A verdict per assumption: confirmed / partial / refuted, with a note.'
        )}
        testId="roi-card-truth"
      >
        <RoiTable
          columns={[
            { id: 'label', label: t('Założenie', 'Assumption'), render: (a) => <span className="text-c-text">{a.label}</span> },
            {
              id: 'verdict',
              label: t('Werdykt', 'Verdict'),
              nowrap: true,
              render: (a) => <StatusChip label={verdictLabel(a.verdict, isPolish)} tone="neutral" hideDot />,
            },
            { id: 'note', label: t('Opis', 'Note'), render: (a) => a.verdictNote ?? BRAK },
          ]}
          rows={card.assumptions.filter((a) => a.verdict !== null)}
          keyOf={(a) => a.assumptionId}
          emptyReason={t(
            'Żadne założenie nie zostało jeszcze ocenione po realizacji.',
            'No assumption has been assessed after implementation yet.'
          )}
          testId="roi-card-truth-table"
        />
      </RoiBlock>

      <RoiBlock title={t('ROI po realizacji i wnioski', 'ROI after implementation and learnings')} testId="roi-card-realized">
        {pir ? (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Tile
                label={t('ROI po realizacji', 'Realized ROI')}
                value={fmtPercent(pir.realizedRoiPct, isPolish, 1)}
              />
              <Tile label={t('NPV po realizacji', 'Realized NPV')} value={fmtMoney(pir.realizedNpv, cur, isPolish)} />
              <Tile
                label={t('Payback po realizacji', 'Realized payback')}
                value={fmtYears(pir.realizedPaybackYears, isPolish)}
              />
            </div>
            <div className="mt-3">
            <ArtifactPropertiesTable
              rows={[
                {
                  id: 'outcome',
                  label: t('Wynik przeglądu', 'Review outcome'),
                  value:
                    pir.outcome === 'benefits_fully_realized'
                      ? t('Korzyści zrealizowane w całości', 'Benefits fully realized')
                      : pir.outcome === 'benefits_partially_realized'
                        ? t('Korzyści zrealizowane częściowo', 'Benefits partially realized')
                        : pir.outcome === 'benefits_not_realized'
                          ? t('Korzyści niezrealizowane', 'Benefits not realized')
                          : BRAK,
                },
                { id: 'lessons', label: t('Wnioski', 'Lessons learned'), value: pir.lessonsLearned ?? BRAK },
                { id: 'recommendation', label: t('Rekomendacja przeglądu', 'Review recommendation'), value: pir.recommendation ?? BRAK },
                { id: 'finalized', label: t('Zamknięty', 'Finalized'), value: fmtDate(pir.finalizedAt, isPolish), mono: true },
              ]}
              propertyLabel={t('Element', 'Element')}
              valueLabel={t('Wartość', 'Value')}
            />
            </div>
          </>
        ) : (
          <EmptyLine
            reason={t(
              'Przegląd po realizacji nie został jeszcze rozpoczęty — ROI po realizacji policzymy dopiero z wykonań.',
              'The post investment review has not started — realized ROI will be computed from actuals.'
            )}
          />
        )}
      </RoiBlock>
    </div>
  );
};
