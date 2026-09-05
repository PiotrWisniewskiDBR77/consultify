/**
 * kpiReportPresenters — TREŚĆ trzech poziomów raportu KPI dla komponentów
 * standardu (`StandardTable`, `StandardPreview`). Ten plik NIE renderuje ani
 * tabeli, ani menu, ani panelu podglądu: deklaruje kolumny, komórki i bloki,
 * a wygląd narzuca komponent — kanon „standard jest KODEM, nie opisem"
 * (`CLAUDE.md` UI §1).
 *
 * Wzorzec wizualny: zaakceptowany prototyp
 * `dev-render/screens/p7k-wyniki-prototype.tsx` (widoki `kpi-l1` i `kpi-l2`)
 * i zrzuty `evidence/p7k-wyniki/prototype/kpi-*--light.png`.
 * Źródło prawdy treści: `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`
 * §2 i §6.
 *
 * DLACZEGO OSOBNY PLIK OBOK `kpiScorecardPresenters.tsx`: tamten opisuje
 * ZESTAWIENIE jako rekord cyklu życia (status, właściciel, migawki przeglądu)
 * i dalej obsługuje pozycje oraz migawki. Ten opisuje ten sam obiekt jako
 * RAPORT OKRESOWY właściciela — z okresem, rozkładem stanów, otwartymi
 * kartami działania i matrycą CEL/Rezultat. Dwie różne odpowiedzi na pytanie
 * „co pokazać", więc dwa pliki; wspólne mapowania (etykiety statusu, zakresu,
 * dat) są importowane, nie kopiowane.
 */
import React from 'react';

import type { StandardPreviewProps, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';
import {
  formatKpiValue,
  kpiCadenceLabel,
  kpiDirectionLabel,
  kpiIndicatorTypeLabel,
  kpiPerformanceStatusLabel,
  kpiPerformanceStatusTone,
  kpiPeriodColumnLabel,
  kpiPeriodKeyForDate,
  kpiReportPeriodLabel,
} from '@/labels/kpiReportLabels';

import type {
  KpiScorecardDto,
  KpiScorecardItemDto,
  ScorecardAreaStatusDistributionDto,
  ScorecardPeriodCellDto,
  ScorecardPeriodDefinitionDto,
  ScorecardPeriodMatrixItemDto,
  ScorecardStatusDistributionDto,
} from './kpiScorecardApi';
import { formatKpiScorecardDate, kpiScorecardScopeLabel } from './kpiScorecardMappers';

const DASH = '—';

/** Wartość, której nie ma, JEST znakiem „—" — nigdy zerem (SSOT §6). */
const MutedDash: React.FC = () => <span className="text-sm text-c-text-muted">{DASH}</span>;

// ==========================================
// STAN JAKO CZTERY KROPKI (kolumna STAN na poziomie 1)
//
// Werdykt 1d odrzucił nagłówek-skrót („STAN · N / O / K / B"): litery da się
// przeczytać dopiero po odgadnięciu, co znaczą. Nagłówek to samo „STAN",
// a znaczenie niosą KOLOROWE KROPKI przy liczbach plus pełny opis w dymku.
// Czerwona kropka to jedyne miejsce, w którym czerwień wchodzi do tej
// kolumny — i tylko dla „krytyczne" (CLAUDE.md, pułapka nr 1).
// ==========================================

export interface KpiStateCountsProps {
  safe: number;
  warning: number;
  critical: number;
  missing: number;
  isPolish: boolean;
}

const DOT_CLASS: Record<'ok' | 'warn' | 'bad' | 'muted', string> = {
  ok: 'bg-c-success',
  warn: 'bg-c-warning',
  bad: 'bg-c-danger',
  muted: 'bg-c-text-muted',
};

export const KpiStateCounts: React.FC<KpiStateCountsProps> = ({
  safe,
  warning,
  critical,
  missing,
  isPolish,
}) => {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const parts: { tone: 'ok' | 'warn' | 'bad' | 'muted'; value: number; label: string }[] = [
    { tone: 'ok', value: safe, label: t('w normie', 'on target') },
    { tone: 'warn', value: warning, label: t('ostrzeżenie', 'warning') },
    { tone: 'bad', value: critical, label: t('krytyczne', 'critical') },
    { tone: 'muted', value: missing, label: t('brak danych', 'missing') },
  ];
  return (
    <span
      title={parts.map((p) => `${p.label} ${p.value}`).join(' · ')}
      className="inline-flex items-center whitespace-nowrap text-xs tabular-nums text-c-text-secondary"
    >
      {parts.map((part, index) => (
        <React.Fragment key={part.tone}>
          {index > 0 ? (
            <span aria-hidden="true" className="mx-1 text-c-text-muted">
              ·
            </span>
          ) : null}
          <i aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[part.tone]}`} />
          {part.value}
        </React.Fragment>
      ))}
    </span>
  );
};

// ==========================================
// PIGUŁKA STANU (kolumna STAN na poziomie 2)
//
// Werdykt K5: pigułka jest JEDNOWIERSZOWA. Otwarta karta działania dokłada
// małą ikonę, a nie drugie słowo — pełna treść siedzi w dymku.
// ==========================================

export interface KpiStatePillProps {
  status: string | null;
  openActions: number;
  isPolish: boolean;
}

export const KpiStatePill: React.FC<KpiStatePillProps> = ({ status, openActions, isPolish }) => {
  const label = kpiPerformanceStatusLabel(status, isPolish);
  if (!label) return <MutedDash />;
  const tone = kpiPerformanceStatusTone(status);
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const title =
    openActions > 0
      ? `${label} · ${t('otwarte karty działania', 'open action cards')}: ${openActions}`
      : label;
  const toneClass =
    tone === 'bad'
      ? 'border-c-danger/40 bg-c-danger/10 text-c-danger'
      : tone === 'warn'
        ? 'border-c-warning/40 bg-c-warning/10 text-c-warning'
        : tone === 'ok'
          ? 'border-c-success/40 text-c-success'
          : 'border-c-border-subtle text-c-text-secondary';
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
    >
      {label}
      {openActions > 0 ? (
        <svg
          aria-label={t('Otwarta karta działania', 'Open action card')}
          role="img"
          viewBox="0 0 24 24"
          className="h-3 w-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      ) : null}
    </span>
  );
};

// ==========================================
// PARA CEL / REZULTAT W KOMÓRCE OKRESU
//
// SSOT §6: „dla każdego okresu dwie liczby w komórce: CEL nad Rezultatem".
// Werdykt K2: liczba NIGDY się nie łamie. Etykiety `CEL`/`Rezultat` są
// opisami (10 px, wyciszone), sama wartość zostaje czytelna (14 px) —
// dzięki temu para mieści się w treści kolumny okresu, zamiast ją rozpychać.
// ==========================================

export interface KpiPeriodPairProps {
  targetValue: number | null;
  actualValue: number | null;
  status: string | null;
  unit: string | null;
  isPolish: boolean;
}

export const KpiPeriodPair: React.FC<KpiPeriodPairProps> = ({
  targetValue,
  actualValue,
  status,
  unit,
  isPolish,
}) => {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const target = formatKpiValue(targetValue, unit, isPolish) ?? DASH;
  const actual = formatKpiValue(actualValue, unit, isPolish) ?? DASH;
  const tone = actualValue === null ? 'neutral' : kpiPerformanceStatusTone(status);
  const actualClass =
    tone === 'bad'
      ? 'font-semibold text-c-danger'
      : tone === 'warn'
        ? 'font-semibold text-c-warning'
        : 'font-medium text-c-text';
  return (
    <div
      title={`${t('CEL', 'TARGET')} ${target} · ${t('Rezultat', 'Actual')} ${actual}`}
      className="w-full overflow-hidden whitespace-nowrap text-right tabular-nums"
    >
      <div className="flex items-baseline justify-end gap-1.5 whitespace-nowrap text-[10px] text-c-text-muted">
        <span>{t('CEL', 'TARGET')}</span>
        <span>{target}</span>
      </div>
      <div className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
        <span className="text-[10px] text-c-text-muted">{t('Rezultat', 'Actual')}</span>
        <span className={`text-sm ${actualClass}`}>{actual}</span>
      </div>
    </div>
  );
};

// ==========================================
// POZIOM 1 — TABELA RAPORTÓW (`/results/kpi`)
//
// Kolumny dokładnie z SSOT §6 i z zaakceptowanego zrzutu `kpi-l1--light.png`:
// NAZWA RAPORTU · ZAKRES · OKRES · MIERNIKI · STAN · OTWARTE DZIAŁANIA ·
// PRZYGOTOWAŁ · AKTUALIZACJA.
// ==========================================

export interface KpiReportRowVm {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  /** Okres przeglądu, już zapisany słowem („VIII 2026", „Q3 2026", „2026 · edycja 03"). */
  period: string | null;
  /** `null` dopóki rozkład stanu nie wrócił ⇒ komórka pokazuje „—", nie 0. */
  indicatorCount: number | null;
  distribution: ScorecardStatusDistributionDto | null;
  openActions: number | null;
  preparedBy: string | null;
  updatedAt: string | null;
  scorecard: KpiScorecardDto;
}

export function buildKpiReportColumns(isPolish: boolean): TableColumn[] {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const numberCell = (value: number | null) =>
    value === null ? <MutedDash /> : <span className="text-sm tabular-nums text-c-text-secondary">{value}</span>;
  return [
    {
      id: 'name',
      label: t('NAZWA RAPORTU', 'REPORT NAME'),
      width: '320px',
      sortable: true,
      render: (row: KpiReportRowVm) => (
        <span className="block truncate text-sm font-medium text-c-text" title={row.name}>
          {row.name}
        </span>
      ),
    },
    {
      id: 'scope',
      label: t('ZAKRES', 'SCOPE'),
      width: '150px',
      dataType: 'status',
      sortable: true,
      render: (row: KpiReportRowVm) => (
        <span className="block truncate text-sm text-c-text-secondary" title={row.scope}>
          {row.scope}
        </span>
      ),
    },
    {
      id: 'period',
      label: t('OKRES', 'PERIOD'),
      width: '160px',
      dataType: 'number',
      sortable: true,
      render: (row: KpiReportRowVm) =>
        row.period ? (
          <span className="block truncate whitespace-nowrap text-sm text-c-text-secondary" title={row.period}>
            {row.period}
          </span>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: 'indicatorCount',
      label: t('MIERNIKI', 'INDICATORS'),
      width: '110px',
      dataType: 'number',
      sortable: true,
      render: (row: KpiReportRowVm) => numberCell(row.indicatorCount),
    },
    {
      id: 'state',
      label: t('STAN', 'STATUS'),
      width: '160px',
      dataType: 'number',
      render: (row: KpiReportRowVm) =>
        row.distribution ? (
          <KpiStateCounts
            safe={row.distribution.safe}
            warning={row.distribution.warning}
            critical={row.distribution.critical}
            missing={row.distribution.missing}
            isPolish={isPolish}
          />
        ) : (
          <MutedDash />
        ),
    },
    {
      id: 'openActions',
      label: t('OTWARTE DZIAŁANIA', 'OPEN ACTIONS'),
      width: '175px',
      dataType: 'number',
      sortable: true,
      render: (row: KpiReportRowVm) => numberCell(row.openActions),
    },
    {
      id: 'preparedBy',
      label: t('PRZYGOTOWAŁ', 'PREPARED BY'),
      width: '160px',
      dataType: 'owner',
      sortable: true,
      render: (row: KpiReportRowVm) =>
        row.preparedBy ? (
          <span className="block truncate text-sm text-c-text-secondary" title={row.preparedBy}>
            {row.preparedBy}
          </span>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: 'updatedAt',
      label: t('AKTUALIZACJA', 'UPDATED'),
      width: '150px',
      dataType: 'date',
      sortable: true,
      render: (row: KpiReportRowVm) =>
        row.updatedAt ? (
          <span className="whitespace-nowrap text-sm text-c-text-secondary">
            {formatKpiScorecardDate(row.updatedAt, isPolish)}
          </span>
        ) : (
          <MutedDash />
        ),
    },
  ];
}

/**
 * OKRES, którego raport dotyczy (kolumna OKRES na poziomie 1, podtytuł na
 * poziomie 2).
 *
 * Kolejność źródeł, od najmocniejszego (korekta P7K §4: „ostatni opublikowany
 * snapshot lub bieżący okres wg `reviewCadence`"):
 *   1. ostatnia OPUBLIKOWANA migawka przeglądu — to jest okres, który raport
 *      naprawdę zamknął;
 *   2. gdy migawki nie ma — okres BIEŻĄCY wyliczony z `reviewFrequency`;
 *      raport istnieje i dotyczy trwającego okresu, więc puste „—" byłoby
 *      mniej prawdziwe niż nazwa okresu.
 * `editionLabel` (gdy jest) dokleja się jako drugi człon — tak jak w arkuszu
 * właściciela: „2026 · edycja 03".
 */
export function resolveKpiReportPeriodLabel(
  scorecard: KpiScorecardDto,
  publishedSnapshot: { reviewPeriodStart: string; reviewPeriodEnd: string } | null,
  now: Date = new Date()
): string | null {
  const granularity: 'month' | 'quarter' | 'year' =
    scorecard.reviewFrequency === 'quarterly'
      ? 'quarter'
      : scorecard.reviewFrequency === 'annual'
        ? 'year'
        : 'month';
  const anchorDate = publishedSnapshot ? new Date(publishedSnapshot.reviewPeriodStart) : now;
  if (Number.isNaN(anchorDate.getTime())) return scorecard.editionLabel ?? null;
  const base = kpiReportPeriodLabel(kpiPeriodKeyForDate(anchorDate, granularity));
  return scorecard.editionLabel ? `${base} · ${scorecard.editionLabel}` : base;
}

// ==========================================
// PODGLĄD RAPORTU (poziom 1) — rozkład stanu PER OBSZAR
//
// Paczka §14: „podgląd raportu KPI ma rozkład per obszar" (a OKR per
// właściciel — bo KPI dotyczy procesu, a OKR człowieka). Rozkład przychodzi
// policzony z serwera, w tym samym wywołaniu co liczby nagłówkowe, więc
// podgląd nie ściąga całej matrycy okresów.
// ==========================================

export interface KpiReportPreviewCtx {
  isPolish: boolean;
  onClose: () => void;
  onOpenReport: (scorecardId: string) => void;
}

export function buildKpiReportPreview(
  row: KpiReportRowVm,
  ctx: KpiReportPreviewCtx
): StandardPreviewProps {
  const t = (pl: string, en: string) => (ctx.isPolish ? pl : en);
  const areas: ScorecardAreaStatusDistributionDto[] = row.distribution?.byArea ?? [];
  return {
    title: row.name,
    onClose: ctx.onClose,
    onOpenFull: () => ctx.onOpenReport(row.id),
    openLabel: t('Otwórz raport', 'Open report'),
    meta: {
      pills: [
        { label: row.scope, tone: 'neutral' as const },
        ...(row.period ? [{ label: row.period, tone: 'neutral' as const }] : []),
      ],
      trailing: row.updatedAt ? (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatKpiScorecardDate(row.updatedAt, ctx.isPolish)}
        </span>
      ) : undefined,
    },
    details: {
      propertyLabel: t('Właściwość', 'Property'),
      valueLabel: t('Wartość', 'Value'),
      properties: [
        { id: 'description', label: t('Opis', 'Description'), value: row.description ?? DASH },
        {
          id: 'prepared',
          label: t('Przygotował', 'Prepared by'),
          value: row.preparedBy ?? DASH,
        },
        {
          id: 'count',
          label: t('Mierniki', 'Indicators'),
          value: row.indicatorCount === null ? DASH : String(row.indicatorCount),
        },
        {
          id: 'openActions',
          label: t('Otwarte karty działania', 'Open action cards'),
          value: row.openActions === null ? DASH : String(row.openActions),
        },
        {
          id: 'byArea',
          label: t('Stan per obszar', 'Status by area'),
          value:
            areas.length === 0 ? (
              DASH
            ) : (
              <span className="flex flex-col gap-1">
                {areas.map((area) => (
                  <span
                    key={area.areaName ?? '__none__'}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-c-text-secondary">
                      {area.areaName ?? t('Bez obszaru', 'No area')}
                    </span>
                    <KpiStateCounts
                      safe={area.safe}
                      warning={area.warning}
                      critical={area.critical}
                      missing={area.missing}
                      isPolish={ctx.isPolish}
                    />
                  </span>
                ))}
              </span>
            ),
        },
      ],
    },
  };
}

// ==========================================
// POZIOM 2 — TABELA MIERNIKÓW RAPORTU
//
// Geometria kolumn wprost z zaakceptowanego prototypu (K2/K10): MIERNIK
// przypięty z lewej, kolumny kontraktu i wszystkie okresy roku przewijane
// poziomo, YTD i STAN przypięte z prawej. Przypięcie robi jądro tabeli
// (`TableColumn.pinned`), nie ten plik — tu jest tylko deklaracja.
//
// Kolumny kontraktu (KIERUNEK/JEDNOSTKA, CZĘSTOTLIWOŚĆ, TYP, ODPOWIEDZIALNY,
// BENCHMARK, LIMIT %) są DOMYŚLNIE UKRYTE i wracają pstryczkiem kolumn:
// zaakceptowany zrzut pokazuje przy 1440 px miernik, okresy, YTD i STAN, a nie
// siedem kolumn opisowych zjadających miejsce miesiącom. Nic nie znika —
// pełny kontrakt jest w karcie miernika (poziom 3) i w pstryczku.
// ==========================================

export interface KpiReportItemRowVm {
  /** `itemId` pozycji raportu, albo `group:<obszar>` dla wiersza grupującego. */
  id: string;
  group: boolean;
  areaName: string | null;
  superiorOwnerName: string | null;
  kpiId: string | null;
  name: string;
  contract: string | null;
  cadence: string | null;
  indicatorType: string | null;
  owner: string | null;
  benchmark: string | null;
  limitPercent: string | null;
  unit: string | null;
  cellByPeriod: Record<string, ScorecardPeriodCellDto>;
  ytdTargetValue: number | null;
  ytdActualValue: number | null;
  ytdStatus: string | null;
  latestStatus: string | null;
  openActions: number;
  item: KpiScorecardItemDto | null;
}

export interface BuildKpiReportItemColumnsParams {
  isPolish: boolean;
  periods: ScorecardPeriodDefinitionDto[];
}

/** Szerokość kolumny okresu — zmierzona treść pary CEL/Rezultat + `px-4` z obu stron. */
export const KPI_PERIOD_COLUMN_WIDTH_PX = 140;

export function buildKpiReportItemColumns({
  isPolish,
  periods,
}: BuildKpiReportItemColumnsParams): TableColumn[] {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const textCell = (value: string | null) =>
    value ? (
      <span className="block truncate text-sm text-c-text-secondary" title={value}>
        {value}
      </span>
    ) : (
      <MutedDash />
    );

  const periodColumns: TableColumn[] = periods.map((period) => ({
    id: `period:${period.key}`,
    label: kpiPeriodColumnLabel(period.key, isPolish),
    width: `${KPI_PERIOD_COLUMN_WIDTH_PX}px`,
    /* ŚWIADOMIE `text` (podłoga 140 px), nie `number` (90 px): przy dwunastu
       kolumnach okresów tabela zawsze jest szersza niż obszar, więc każda
       kolumna dostaje swoją PODŁOGĘ. Przy `number` na treść zostawałoby 58 px,
       a „Rezultat 11 620" ma 103 px i wychodziłoby poza komórkę (defekt K10). */
    dataType: 'text',
    render: (row: KpiReportItemRowVm) => {
      if (row.group) return null;
      const cell = row.cellByPeriod[period.key];
      return (
        <KpiPeriodPair
          targetValue={cell?.targetValue ?? null}
          actualValue={cell?.actualValue ?? null}
          status={cell?.performanceStatus ?? null}
          unit={row.unit}
          isPolish={isPolish}
        />
      );
    },
  }));

  return [
    {
      id: 'name',
      label: t('MIERNIK', 'INDICATOR'),
      width: '324px',
      pinned: 'left',
      render: (row: KpiReportItemRowVm) => (
        <b className="block truncate text-sm text-c-text" title={row.name}>
          {row.name}
        </b>
      ),
    },
    {
      id: 'contract',
      label: t('KIERUNEK / JEDNOSTKA', 'DIRECTION / UNIT'),
      width: '180px',
      defaultVisible: false,
      render: (row: KpiReportItemRowVm) => textCell(row.contract),
    },
    {
      id: 'cadence',
      label: t('CZĘSTOTLIWOŚĆ', 'CADENCE'),
      width: '150px',
      defaultVisible: false,
      render: (row: KpiReportItemRowVm) => textCell(row.cadence),
    },
    {
      id: 'indicatorType',
      label: t('TYP', 'TYPE'),
      width: '150px',
      dataType: 'status',
      defaultVisible: false,
      render: (row: KpiReportItemRowVm) => textCell(row.indicatorType),
    },
    {
      id: 'owner',
      label: t('ODPOWIEDZIALNY', 'ACCOUNTABLE'),
      width: '160px',
      dataType: 'owner',
      defaultVisible: false,
      render: (row: KpiReportItemRowVm) => textCell(row.owner),
    },
    {
      id: 'benchmark',
      label: t('BENCHMARK', 'BENCHMARK'),
      width: '120px',
      dataType: 'number',
      defaultVisible: false,
      render: (row: KpiReportItemRowVm) => textCell(row.benchmark),
    },
    {
      id: 'limitPercent',
      label: t('LIMIT %', 'LIMIT %'),
      width: '100px',
      dataType: 'number',
      defaultVisible: false,
      render: (row: KpiReportItemRowVm) => textCell(row.limitPercent),
    },
    ...periodColumns,
    {
      id: 'ytd',
      label: 'YTD',
      width: '140px',
      pinned: 'right',
      dataType: 'text',
      render: (row: KpiReportItemRowVm) =>
        row.group ? null : (
          <KpiPeriodPair
            targetValue={row.ytdTargetValue}
            actualValue={row.ytdActualValue}
            status={row.ytdStatus}
            unit={row.unit}
            isPolish={isPolish}
          />
        ),
    },
    {
      id: 'state',
      label: t('STAN', 'STATUS'),
      width: '140px',
      pinned: 'right',
      dataType: 'status',
      render: (row: KpiReportItemRowVm) =>
        row.group ? null : (
          <KpiStatePill status={row.latestStatus} openActions={row.openActions} isPolish={isPolish} />
        ),
    },
  ];
}

/**
 * Wiersz grupy obszaru — jedna komórka na całą szerokość (werdykt K6).
 * Nazwa obszaru wersalikami i właściciel nadrzędny obok; zero „—".
 */
export function renderKpiReportGroupRow(
  row: KpiReportItemRowVm,
  isPolish: boolean
): React.ReactNode {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  return (
    <>
      <b className="whitespace-nowrap text-sm uppercase tracking-wide text-c-text">
        {row.areaName ?? t('Bez obszaru', 'No area')}
      </b>
      {row.superiorOwnerName ? (
        <span className="truncate text-xs font-normal text-c-text-secondary">
          {t('właściciel nadrzędny', 'superior owner')}: {row.superiorOwnerName}
        </span>
      ) : null}
    </>
  );
}

// ==========================================
// SKŁADANIE WIERSZY POZIOMU 2 z pozycji raportu + matrycy okresów
// ==========================================

export interface BuildKpiReportItemRowsParams {
  items: KpiScorecardItemDto[];
  matrixItems: ScorecardPeriodMatrixItemDto[];
  isPolish: boolean;
  /** Rozwiązywanie nazwiska odpowiedzialnego, gdy serwer nie dołączył joinu. */
  resolveOwnerName: (userId: string | null) => string | null;
}

export function buildKpiReportItemRows({
  items,
  matrixItems,
  isPolish,
  resolveOwnerName,
}: BuildKpiReportItemRowsParams): KpiReportItemRowVm[] {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const matrixByItemId = new Map(matrixItems.map((entry) => [entry.itemId, entry]));

  /* Grupowanie po obszarze z ZACHOWANIEM kolejności pozycji raportu
     (`sort_order`): arkusz właściciela ma obszary w ustalonej kolejności i
     posortowanie ich alfabetycznie zmieniłoby dokument, który zna na pamięć.
     Pozycje bez obszaru lądują w jednej, jawnie nazwanej grupie na końcu. */
  const order: (string | null)[] = [];
  const byArea = new Map<string | null, KpiScorecardItemDto[]>();
  for (const item of items) {
    const key = item.areaName ?? null;
    if (!byArea.has(key)) {
      byArea.set(key, []);
      order.push(key);
    }
    byArea.get(key)!.push(item);
  }

  const rows: KpiReportItemRowVm[] = [];
  for (const areaName of order) {
    const areaItems = byArea.get(areaName) ?? [];
    const superiorOwnerName =
      areaItems.find((item) => item.superiorOwnerName)?.superiorOwnerName ?? null;
    rows.push({
      id: `group:${areaName ?? '__none__'}`,
      group: true,
      areaName,
      superiorOwnerName,
      kpiId: null,
      name: areaName ?? t('Bez obszaru', 'No area'),
      contract: null,
      cadence: null,
      indicatorType: null,
      owner: null,
      benchmark: null,
      limitPercent: null,
      unit: null,
      cellByPeriod: {},
      ytdTargetValue: null,
      ytdActualValue: null,
      ytdStatus: null,
      latestStatus: null,
      openActions: 0,
      item: null,
    });

    for (const item of areaItems) {
      const matrix = matrixByItemId.get(item.itemId);
      const cellByPeriod: Record<string, ScorecardPeriodCellDto> = {};
      for (const cell of matrix?.cells ?? []) cellByPeriod[cell.periodKey] = cell;
      const direction = kpiDirectionLabel(item.targetGeometry, isPolish);
      const unit = item.unit?.trim() || null;
      rows.push({
        id: item.itemId,
        group: false,
        areaName,
        superiorOwnerName,
        kpiId: item.kpiId,
        name: item.kpiName ?? t('Miernik bez nazwy', 'Unnamed indicator'),
        contract: [direction, unit].filter(Boolean).join(' · ') || null,
        cadence: kpiCadenceLabel(item.measurementFrequencyDays, isPolish),
        indicatorType: kpiIndicatorTypeLabel(item.indicatorType, isPolish),
        owner: item.ownerName ?? resolveOwnerName(item.ownerUserId),
        benchmark: formatKpiValue(item.benchmarkValue, unit, isPolish),
        limitPercent:
          item.limitPercent === null ? null : `${formatKpiValue(item.limitPercent, null, isPolish)}%`,
        unit,
        cellByPeriod,
        ytdTargetValue: matrix?.ytdTargetValue ?? null,
        ytdActualValue: matrix?.ytdActualValue ?? null,
        ytdStatus: matrix?.ytdPerformanceStatus ?? null,
        latestStatus: matrix?.latestPerformanceStatus ?? null,
        openActions: matrix?.openDeviationCaseCount ?? 0,
        item,
      });
    }
  }
  return rows;
}

/** Nagłówek raportu (poziom 2) — jedna linia opisu pod nazwą, jak w prototypie. */
export function buildKpiReportSubtitle(
  scorecard: KpiScorecardDto,
  periodLabel: string | null,
  isPolish: boolean
): string {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const parts = [
    kpiScorecardScopeLabel(scorecard.scopeType, isPolish),
    periodLabel,
    scorecard.editionLabel,
    scorecard.revisionDate
      ? `${t('rewizja', 'revision')} ${formatKpiScorecardDate(scorecard.revisionDate, isPolish)}`
      : null,
    scorecard.preparedByName ? `${t('przygotował', 'prepared by')} ${scorecard.preparedByName}` : null,
  ].filter((part): part is string => !!part);
  return parts.join(' · ');
}

export interface KpiReportSummaryProps {
  distribution: ScorecardStatusDistributionDto | null;
  isPolish: boolean;
}

/** Podsumowanie stanów w nagłówku raportu — te same cztery liczby co na L1. */
export const KpiReportSummary: React.FC<KpiReportSummaryProps> = ({ distribution, isPolish }) => {
  if (!distribution) return <MutedDash />;
  return (
    <KpiStateCounts
      safe={distribution.safe}
      warning={distribution.warning}
      critical={distribution.critical}
      missing={distribution.missing}
      isPolish={isPolish}
    />
  );
};

export { MutedDash as KpiMutedDash, DASH as KPI_DASH };

/** Etykieta pigułki dla stanu pozycji — używana też w podglądzie pozycji. */
export function kpiItemStatusChip(status: string | null, isPolish: boolean): React.ReactNode {
  const label = kpiPerformanceStatusLabel(status, isPolish);
  if (!label) return <MutedDash />;
  const tone = kpiPerformanceStatusTone(status);
  return (
    <StatusChip
      label={label}
      tone={tone === 'bad' ? 'danger' : tone === 'warn' ? 'warning' : tone === 'ok' ? 'success' : 'neutral'}
    />
  );
}
