/**
 * FinanceComparePanel — Pakiet AP-CLIENT (Gate J), priorytet #2.
 *
 * Samodzielny panel Compare: pięć osi (okres/okres, actual/forecast,
 * wersja/wersja, scenariusz/baseline, metoda/metoda — plus podmiot/podmiot,
 * bo `financeCompareService.ts` sam ją eksponuje). Wartości bezwzględne,
 * Δ i %, filtr istotności (klient-side, na już pobranym pełnym zestawie —
 * `summary` z serwera zawsze opisuje PEŁNY zbiór, filtr dotyczy tylko
 * widoku wierszy), jedna tabela A/B w jednym kontenerze przewijania (więc
 * "zsynchronizowany scroll" jest strukturalny, nie dwa niezależne panele),
 * eksport różnic do CSV po stronie klienta.
 *
 * NIE montowany w żadnym workspace produkcyjnym w tym pakiecie — dev-render
 * only, do akceptu Piotra na zrzutach (CLAUDE.md #7).
 *
 * Za flagą `financeCompareV1` (default OFF): przy `enabled=false` renderuje
 * `null` PRZED jakimkolwiek wywołaniem sieciowym.
 */
import React, { useEffect, useMemo, useState } from 'react';

import { FinanceStatusAnnouncer } from '@/components/Finance/shared/FinanceStatusAnnouncer';
import { useFinanceCompareFlag } from '@/hooks/useFinanceCompareFlag';
import {
  compareFinanceActualVsForecast,
  compareFinanceEntities,
  compareFinancePeriods,
  compareFinanceScenarios,
  compareFinanceValuationMethods,
  compareFinanceVersions,
  type CompareFinanceActualVsForecastParams,
  type CompareFinanceEntitiesParams,
  type CompareFinancePeriodsParams,
  type CompareFinanceScenariosParams,
  type CompareFinanceValuationMethodsParams,
  type CompareFinanceVersionsParams,
} from '@/services/api/financeV2.api';
import {
  compareComparisonTypeLabel,
  compareDiffKindLabel,
  describeFinanceV2Error,
  type CompareResultDto,
  type CompareRowDto,
} from '@/services/api/financeV2.types';

export type FinanceCompareRequest =
  | { kind: 'periods'; params: CompareFinancePeriodsParams }
  | { kind: 'versions'; params: CompareFinanceVersionsParams }
  | { kind: 'entities'; params: CompareFinanceEntitiesParams }
  | { kind: 'scenarios'; params: CompareFinanceScenariosParams }
  | { kind: 'valuationMethods'; params: CompareFinanceValuationMethodsParams }
  | { kind: 'actualVsForecast'; params: CompareFinanceActualVsForecastParams };

export interface FinanceComparePanelProps {
  request: FinanceCompareRequest;
  className?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; detail: string; code: string | null }
  | { kind: 'loaded'; result: CompareResultDto };

async function runCompare(request: FinanceCompareRequest): Promise<CompareResultDto> {
  switch (request.kind) {
    case 'periods':
      return compareFinancePeriods(request.params);
    case 'versions':
      return compareFinanceVersions(request.params);
    case 'entities':
      return compareFinanceEntities(request.params);
    case 'scenarios':
      return compareFinanceScenarios(request.params);
    case 'valuationMethods':
      return compareFinanceValuationMethods(request.params);
    case 'actualVsForecast':
      return compareFinanceActualVsForecast(request.params);
    default: {
      const _exhaustive: never = request;
      throw new Error(`Nieznany tryb porównania: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

function formatPct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

function rowsToCsv(rows: CompareRowDto[]): string {
  const header = ['Wymiary', 'A', 'B', 'Δ', 'Δ%', 'Kind', 'Istotne'];
  const lines = [header.join(';')];
  for (const row of rows) {
    lines.push(
      [
        JSON.stringify(row.dimensions),
        row.a.fullUnitValue ?? '',
        row.b.fullUnitValue ?? '',
        row.absoluteDiff ?? '',
        row.pctDiff ?? '',
        compareDiffKindLabel(row.diffKind),
        row.materialityFlag ? 'tak' : 'nie',
      ].join(';')
    );
  }
  return lines.join('\n');
}

function downloadCsv(rows: CompareRowDto[]): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'finance-compare-diff.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function FinanceComparePanel({ request, className }: FinanceComparePanelProps): React.ReactElement | null {
  const { enabled } = useFinanceCompareFlag();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [onlyMaterial, setOnlyMaterial] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    runCompare(request)
      .then((result) => {
        if (!cancelled) setState({ kind: 'loaded', result });
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: 'error', ...describeFinanceV2Error(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(request)]);

  const visibleRows = useMemo(() => {
    if (state.kind !== 'loaded') return [];
    return onlyMaterial ? state.result.rows.filter((r) => r.materialityFlag) : state.result.rows;
  }, [state, onlyMaterial]);

  if (!enabled) return null;

  // ★ NAPRAWA a11y (Pakiet I, wymaganie #7 "ogłaszanie stanów dynamicznych"):
  // przeliczenie porównania trwa (compute po stronie serwera) i wcześniej nic
  // nie mówiło czytnikowi ekranu, że stan się zmienił — trzeba było wzrokowo
  // zauważyć zamianę treści. `liveMessage` to STAŁY, zawsze zamontowany
  // `role="status"` (niewidoczny wizualnie), więc zmiana jego tekstu jest
  // ogłaszana niezależnie od tego, że widoczna treść poniżej wymienia się na
  // inny DOM (loading→error/loaded).
  const liveMessage =
    state.kind === 'loading'
      ? 'Liczenie porównania…'
      : state.kind === 'error'
        ? `Błąd porównania: ${state.title}`
        : 'Porównanie gotowe.';
  const livePriority = state.kind === 'error' ? 'assertive' : 'polite';

  if (state.kind === 'loading') {
    return (
      <>
        <FinanceStatusAnnouncer message={liveMessage} priority={livePriority} />
        <div className={`rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="compare-panel-loading">
          <p className="text-xs text-c-text-secondary">Liczenie porównania…</p>
        </div>
      </>
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        <FinanceStatusAnnouncer message={liveMessage} priority={livePriority} />
        <div className={`rounded-lg border border-c-danger/40 bg-c-surface p-3 ${className ?? ''}`} data-testid="compare-panel-error">
          <p className="text-sm font-medium text-c-danger">{state.title}</p>
          <p className="text-xs text-c-text-secondary">{state.detail}</p>
        </div>
      </>
    );
  }

  const { result } = state;

  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="finance-compare-panel">
      <FinanceStatusAnnouncer message={liveMessage} priority={livePriority} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-c-text-primary">{compareComparisonTypeLabel(result.comparisonType)}</p>
          <p className="text-xs text-c-text-secondary">
            {result.sourceA.label} vs {result.sourceB.label} · próg istotności {result.materialityThresholdPct}%
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={() => downloadCsv(visibleRows)}
          data-testid="compare-export-diff"
        >
          Eksport różnic (.csv)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6" data-testid="compare-summary">
        <SummaryTile label="Wiersze" value={result.summary.totalRows} />
        <SummaryTile label="Obie strony" value={result.summary.bothPresent} />
        <SummaryTile label="Brak w A" value={result.summary.missingInA} />
        <SummaryTile label="Brak w B" value={result.summary.missingInB} />
        <SummaryTile label="Niezgodność walut" value={result.summary.currencyMismatch} />
        <SummaryTile label="Istotne" value={result.summary.materialCount} />
      </div>

      <label className="flex items-center gap-2 text-xs text-c-text-secondary">
        <input
          type="checkbox"
          checked={onlyMaterial}
          onChange={(e) => setOnlyMaterial(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-c-border-subtle text-c-focus focus:ring-c-focus"
          data-testid="compare-only-material-toggle"
        />
        Pokaż tylko istotne różnice
      </label>

      <div className="max-h-96 overflow-auto rounded-md border border-c-border-subtle" data-testid="compare-rows-scroll">
        {/* §27-exempt: archetyp Excel — wiersze to WYLICZONE różnice (A/B/Δ/Δ%),
            nie rekordy encji o stałym schemacie z klikiem-otwiera-rekord
            (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md #2), więc StandardTable
            nie pasuje — tak samo jak grid założeń w AssumptionsView.tsx. */}
        <table className="w-full text-left text-xs" /* §27-exempt */>
          <thead className="sticky top-0 bg-c-surface-raised text-c-text-secondary" /* §27-exempt */>
            <tr>
              <th className="px-2 py-1.5 font-medium">Wymiary</th>
              <th className="px-2 py-1.5 font-medium">A</th>
              <th className="px-2 py-1.5 font-medium">B</th>
              <th className="px-2 py-1.5 font-medium">Δ</th>
              <th className="px-2 py-1.5 font-medium">Δ%</th>
              <th className="px-2 py-1.5 font-medium">Stan</th>
            </tr>
          </thead>
          <tbody /* §27-exempt */>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-c-text-secondary">
                  Brak wierszy do pokazania.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.matchKey} className="border-t border-c-border-subtle" data-material={row.materialityFlag ? 'true' : 'false'}>
                  <td className="px-2 py-1.5 text-c-text-primary">{Object.values(row.dimensions).join(' · ') || '—'}</td>
                  <td className="px-2 py-1.5">{formatNumber(row.a.fullUnitValue)}</td>
                  <td className="px-2 py-1.5">{formatNumber(row.b.fullUnitValue)}</td>
                  <td className={`px-2 py-1.5 ${row.absoluteDiff !== null && row.absoluteDiff < 0 ? 'text-c-danger' : ''}`}>
                    {formatNumber(row.absoluteDiff)}
                  </td>
                  <td className="px-2 py-1.5">{formatPct(row.pctDiff)}</td>
                  <td className="px-2 py-1.5 text-c-text-secondary">{compareDiffKindLabel(row.diffKind)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1.5">
      <p className="text-[11px] text-c-text-secondary">{label}</p>
      <p className="text-sm font-semibold text-c-text-primary">{value}</p>
    </div>
  );
}

export default FinanceComparePanel;
