/**
 * Pure derivation: `StatementLineDto[]` (kanoniczny kształt B2, `GET
 * /statements/:businessVersionId/lines`) → wiersze×okresy do renderu w
 * `CanonicalStatementTableV2` + realne ostrzeżenia jakości (OWN-FIN — sekcja
 * "ostrzeżenia o okresach/duplikatach/jednostkach").
 *
 * Zero sieci/DOM tutaj — to jest funkcja czysta, testowalna w izolacji
 * (`__tests__/deriveStatementTable.test.ts`), żeby dowód "MISSING ≠ zero" i
 * dowód wykrywania duplikatów/niespójności jednostek nie zależał od renderu.
 */

import type { ReconciliationDetailRowDto, StatementLineDto } from '@/services/api/financeV2.types';

const LINE_CODE_FALLBACK_PREFIX = 'linecode:';

export interface StatementPeriodColumn {
  periodId: string;
  periodLabel: string;
  /** Kolejność chronologiczna wyprowadzona z kolejności pierwszego wystąpienia w danych — serwer nie oznacza indeksu okresu w tym DTO. */
  sortKey: string;
}

export interface StatementTableCell {
  stmtLineId: string;
  value: StatementLineDto['value'];
  entityId: string;
  entityCode: string | null;
  accumulationBasis: string | null;
  consolidationScope: string | null;
  signConvention: string | null;
  accountingPolicy: string | null;
  reclassifiedFromLineId: string | null;
}

export interface StatementTableRow {
  /** Klucz grupowania — `canonicalLineId` gdy dostępny, inaczej `lineCode` (fallback, oznaczony `usesLineCodeFallback`). */
  rowKey: string;
  canonicalLineId: string | null;
  lineCode: string | null;
  usesLineCodeFallback: boolean;
  cellsByPeriodId: Record<string, StatementTableCell>;
}

export type StatementWarningCode =
  | 'DUPLICATE_PERIOD_LABEL'
  | 'MIXED_UNIT_WITHIN_LINE'
  | 'MIXED_CURRENCY_WITHIN_LINE'
  | 'MULTIPLE_ENTITIES_PRESENT'
  | 'UNMAPPED_LINE_CODE';

export interface StatementWarning {
  code: StatementWarningCode;
  severity: 'warning' | 'info';
  message: string;
  /** rowKey lub periodId dotknięty ostrzeżeniem, gdy dotyczy — do podświetlenia w UI. */
  affectedKey: string | null;
}

export interface DerivedStatementTable {
  periods: StatementPeriodColumn[];
  rows: StatementTableRow[];
  warnings: StatementWarning[];
  entityIds: string[];
}

export function deriveStatementTable(lines: readonly StatementLineDto[]): DerivedStatementTable {
  const periodsById = new Map<string, StatementPeriodColumn>();
  const rowsByKey = new Map<string, StatementTableRow>();
  const entityIds = new Set<string>();
  const periodLabelCounts = new Map<string, Set<string>>(); // label -> set of periodIds sharing it
  const unitByRowKey = new Map<string, Set<string>>();
  const currencyByRowKey = new Map<string, Set<string>>();

  let order = 0;
  for (const line of lines) {
    entityIds.add(line.entityId);

    if (!periodsById.has(line.periodId)) {
      order += 1;
      periodsById.set(line.periodId, {
        periodId: line.periodId,
        periodLabel: line.periodLabel || line.periodId,
        sortKey: String(order).padStart(6, '0'),
      });
    }
    const label = line.periodLabel || line.periodId;
    if (!periodLabelCounts.has(label)) periodLabelCounts.set(label, new Set());
    periodLabelCounts.get(label)!.add(line.periodId);

    const usesLineCodeFallback = !line.canonicalLineId;
    const rowKey = line.canonicalLineId || `${LINE_CODE_FALLBACK_PREFIX}${line.lineCode || 'unknown'}`;
    if (!rowsByKey.has(rowKey)) {
      rowsByKey.set(rowKey, {
        rowKey,
        canonicalLineId: line.canonicalLineId,
        lineCode: line.lineCode,
        usesLineCodeFallback,
        cellsByPeriodId: {},
      });
    }
    const row = rowsByKey.get(rowKey)!;
    row.cellsByPeriodId[line.periodId] = {
      stmtLineId: line.stmtLineId,
      value: line.value,
      entityId: line.entityId,
      entityCode: line.entityCode,
      accumulationBasis: line.accumulationBasis,
      consolidationScope: line.consolidationScope,
      signConvention: line.signConvention,
      accountingPolicy: line.accountingPolicy,
      reclassifiedFromLineId: line.reclassifiedFromLineId,
    };

    if (!unitByRowKey.has(rowKey)) unitByRowKey.set(rowKey, new Set());
    unitByRowKey.get(rowKey)!.add(line.value.unit);
    if (!currencyByRowKey.has(rowKey)) currencyByRowKey.set(rowKey, new Set());
    currencyByRowKey.get(rowKey)!.add(line.value.presentationCurrency);
  }

  const periods = Array.from(periodsById.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const rows = Array.from(rowsByKey.values());

  const warnings: StatementWarning[] = [];

  for (const [label, ids] of periodLabelCounts) {
    if (ids.size > 1) {
      warnings.push({
        code: 'DUPLICATE_PERIOD_LABEL',
        severity: 'warning',
        message: `Etykieta okresu "${label}" jest współdzielona przez ${ids.size} różne periodId — możliwy duplikat lub niespójne okresy źródłowe.`,
        affectedKey: label,
      });
    }
  }

  for (const row of rows) {
    const units = unitByRowKey.get(row.rowKey);
    if (units && units.size > 1) {
      warnings.push({
        code: 'MIXED_UNIT_WITHIN_LINE',
        severity: 'warning',
        message: `Linia "${row.lineCode || row.rowKey}" ma różne jednostki skali w różnych okresach (${Array.from(units).join(', ')}).`,
        affectedKey: row.rowKey,
      });
    }
    const currencies = currencyByRowKey.get(row.rowKey);
    if (currencies && currencies.size > 1) {
      warnings.push({
        code: 'MIXED_CURRENCY_WITHIN_LINE',
        severity: 'warning',
        message: `Linia "${row.lineCode || row.rowKey}" ma różne waluty prezentacji w różnych okresach (${Array.from(currencies).join(', ')}).`,
        affectedKey: row.rowKey,
      });
    }
    if (row.usesLineCodeFallback) {
      warnings.push({
        code: 'UNMAPPED_LINE_CODE',
        severity: 'info',
        message: `Linia bez przypisanego canonicalLineId — grupowana po lineCode "${row.lineCode || '(brak)'}" (mniej pewne grupowanie).`,
        affectedKey: row.rowKey,
      });
    }
  }

  if (entityIds.size > 1) {
    warnings.push({
      code: 'MULTIPLE_ENTITIES_PRESENT',
      severity: 'info',
      message: `Ten widok zawiera dane z ${entityIds.size} różnych podmiotów (entity) — sprawdź zakres konsolidacji przed interpretacją sum.`,
      affectedKey: null,
    });
  }

  return { periods, rows, warnings, entityIds: Array.from(entityIds) };
}

/** Bierze pierwszą realną (PRESENT_*) wartość dla waluty/skali nagłówka tabeli — honest fallback gdy brak danych: `null`. */
export function pickHeaderCurrencyAndScale(
  table: DerivedStatementTable
): { currency: string; unit: string } | null {
  for (const row of table.rows) {
    for (const period of table.periods) {
      const cell = row.cellsByPeriodId[period.periodId];
      if (cell && (cell.value.status === 'PRESENT_ZERO' || cell.value.status === 'PRESENT_NONZERO')) {
        return { currency: cell.value.presentationCurrency, unit: cell.value.unit };
      }
    }
  }
  // Brak jakiejkolwiek obecnej wartości — spróbuj metadanych pierwszej komórki (nawet MISSING niesie deklarowaną walutę/skalę).
  for (const row of table.rows) {
    for (const period of table.periods) {
      const cell = row.cellsByPeriodId[period.periodId];
      if (cell) return { currency: cell.value.presentationCurrency, unit: cell.value.unit };
    }
  }
  return null;
}

/**
 * ★ ODTWARZALNY ŁAŃCUCH (brief Pakietu D, punkt 4): "źródło → mapping →
 * canonical line → presentation" — od zaprezentowanej liczby (komórka
 * `CanonicalStatementTableV2`) do jej dowodu MAPOWANIA (nie mylić z
 * `FinanceValue.sourceRef`, który jest dowodem na poziomie samej linii
 * kanonicznej — to jest DRUGI, niezależny krok w łańcuchu: wiersz
 * rekoncyliacji z `GET /statements/reconciliation-runs/:id`, który niesie
 * `sourceAmount`/`mappedAmount`/`sourceRowRef` i `bucket`, czyli JAK dana
 * wartość źródłowa trafiła do tej linii kanonicznej).
 *
 * Dopasowanie po (canonicalLineId, periodId, entityId) — strukturalne pola
 * WSPÓLNE `StatementTableCell`/`ReconciliationDetailRowDto`, NIGDY po
 * etykiecie/nazwie. Gdy `canonicalLineId` komórki jest `null` (linia bez
 * przypisania, `usesLineCodeFallback`), dopasowanie po definicji zawodzi
 * (rekoncyliacja operuje na canonicalLineId) — honest `null`, nie zgadywanie.
 */
/**
 * Odwrotność konstrukcji `rowKey` powyżej — `CanonicalStatementTableV2`
 * przekazuje `onSelectCell({rowKey, periodId, cell})` bez osobnego pola
 * `canonicalLineId` (nie duplikujemy go w `StatementTableCell`), więc caller
 * (`StatementPackWorkspaceV2`), chcąc dociągnąć krok mapowania po kliknięciu
 * komórki, musi odzyskać `canonicalLineId` z `rowKey`. JEDNO miejsce prawdy
 * dla obu kierunków tej konwencji — `LINE_CODE_FALLBACK_PREFIX` używany też
 * przy budowie `rowKey` powyżej, żeby te dwie funkcje nie mogły dryfować.
 */
export function canonicalLineIdFromRowKey(rowKey: string): string | null {
  return rowKey.startsWith(LINE_CODE_FALLBACK_PREFIX) ? null : rowKey;
}

export function findReconciliationDetailRowForCell(
  target: { canonicalLineId: string | null; periodId: string; entityId: string },
  rows: readonly ReconciliationDetailRowDto[]
): ReconciliationDetailRowDto | null {
  if (!target.canonicalLineId) return null;
  for (const row of rows) {
    if (
      row.canonicalLineId === target.canonicalLineId &&
      row.periodId === target.periodId &&
      row.entityId === target.entityId
    ) {
      return row;
    }
  }
  return null;
}
