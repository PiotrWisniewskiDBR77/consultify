/**
 * `SourceEvidencePanel` — dowód źródłowy NA POZIOMIE WIERSZA/KOMÓRKI
 * (brief: "dowód źródłowy na poziomie wiersza i komórki").
 *
 * Pokazuje dokładnie to, co niesie `FinanceValue` z realnego kontraktu B2:
 * status/wartość, walutę+skalę TEJ komórki (może się różnić od nagłówka
 * tabeli — patrz `MIXED_CURRENCY_WITHIN_LINE`/`MIXED_UNIT_WITHIN_LINE` w
 * `deriveStatementTable`), `sourceRef` surowe (JSON — kształt zależy od
 * ekstraktora, nie ma stałego schematu w tym kontrakcie, więc pokazujemy
 * klucz:wartość zamiast zgadywać pola), i odznakę as-reported/management-
 * adjusted. Gdy `sourceRef` jest `null` (brak dowodu źródłowego zapisanego
 * dla tej wartości) — pokazujemy to WPROST, nie pomijamy sekcję po cichu
 * (Honest UI, CANON.md §4.1).
 *
 * ★ ODTWARZALNY ŁAŃCUCH (brief pkt 4) — drugi, niezależny krok dowodu: obok
 * `sourceRef` własnego `FinanceValue` (dowód NA POZIOMIE linii kanonicznej),
 * opcjonalny `mappingRow` pokazuje JAK wartość źródłowa trafiła do tej linii
 * (bucket/sourceAmount/mappedAmount/sourceRowRef z wiersza rekoncyliacji,
 * `findReconciliationDetailRowForCell` w `deriveStatementTable.ts`). Trzy
 * stany propa są rozróżnione WPROST (honest — `undefined` ≠ `null` ≠ obiekt):
 *   `undefined` — nie wybrano przebiegu rekoncyliacji, więc krok mapowania
 *                 nie został jeszcze poszukany (sekcja NIE renderuje się);
 *   `null`      — przebieg wybrany i wczytany, ale ŻADEN wiersz nie pasuje
 *                 do tej komórki (widoczne wprost, nie ukryte);
 *   obiekt      — dopasowany wiersz mapowania.
 */

import React from 'react';

import {
  financeValueDisplayReasonLabel,
  financeValueStatusLabel,
  formatFinanceValueForDisplay,
} from '@/services/api/financeV2.types';
import type { ReconciliationDetailRowDto } from '@/services/api/financeV2.types';

import type { StatementTableCell } from './deriveStatementTable';

export interface SourceEvidencePanelProps {
  rowLabel: string;
  periodLabel: string;
  cell: StatementTableCell | null;
  emptyLabel: string;
  /** Patrz komentarz pliku — `undefined` = mapowanie nie wyszukane, `null` = wyszukane i brak dopasowania. */
  mappingRow?: ReconciliationDetailRowDto | null;
}

export function SourceEvidencePanel(props: SourceEvidencePanelProps): React.ReactElement {
  const { rowLabel, periodLabel, cell, emptyLabel, mappingRow } = props;

  if (!cell) {
    return (
      <div className="p-4 text-xs text-c-text-muted" data-testid="source-evidence-panel-empty">
        {emptyLabel}
      </div>
    );
  }

  const display = formatFinanceValueForDisplay(cell.value);
  const reason = financeValueDisplayReasonLabel(cell.value.status);
  const sourceRefEntries = cell.value.sourceRef ? Object.entries(cell.value.sourceRef) : null;

  return (
    <div className="flex h-full flex-col overflow-auto p-4" data-testid="source-evidence-panel">
      <div className="mb-3">
        <p className="text-xs font-semibold text-c-text">{rowLabel}</p>
        <p className="text-[11px] text-c-text-muted">{periodLabel}</p>
      </div>

      <dl className="space-y-2 text-xs">
        <Row label="Wartość">
          <span className={`tabular-nums font-semibold ${display.isMissingLikeGlyph ? 'text-c-text-muted' : 'text-c-text'}`}>
            {display.text}
          </span>
        </Row>
        <Row label="Status">
          {/* Etykieta ludzka PL (financeValueStatusLabel) — NIE surowy token enuma
              (przed tą zmianą renderowało się np. "PRESENT_NONZERO" wprost jako
              tekst widoczny dla użytkownika). `data-value-status` niesie surowy
              token strukturalnie, dla testów/narzędzi — nigdy jako treść widoczna. */}
          <span
            className="text-[11px] text-c-text-secondary"
            data-testid="source-evidence-status"
            data-value-status={cell.value.status}
          >
            {financeValueStatusLabel(cell.value.status)}
          </span>
        </Row>
        {reason && (
          <Row label="Powód braku">
            <span className="text-c-text-secondary">{reason}</span>
          </Row>
        )}
        <Row label="Waluta / skala (tej komórki)">
          <span className="text-c-text-secondary">
            {cell.value.presentationCurrency} · {cell.value.unit}
            {cell.value.presentationCurrency !== cell.value.nativeCurrency && (
              <span className="ml-1 text-c-text-muted">(źródłowo: {cell.value.nativeCurrency})</span>
            )}
          </span>
        </Row>
        <Row label="Charakter wartości">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              cell.value.isAdjustment ? 'bg-c-warning/10 text-c-warning' : 'bg-c-surface-raised text-c-text-secondary'
            }`}
          >
            {cell.value.isAdjustment ? 'Korekta zarządcza (management-adjusted)' : 'Jak zaraportowano (as-reported)'}
          </span>
        </Row>
        {cell.value.isAdjustment && cell.value.adjustmentReason && (
          <Row label="Powód korekty">
            <span className="text-c-text-secondary">{cell.value.adjustmentReason}</span>
          </Row>
        )}
        <Row label="Entity">
          <span className="text-c-text-secondary">{cell.entityCode || cell.entityId}</span>
        </Row>
        {cell.consolidationScope && (
          <Row label="Zakres konsolidacji">
            <span className="text-c-text-secondary">{cell.consolidationScope}</span>
          </Row>
        )}
        {cell.accumulationBasis && (
          <Row label="Podstawa akumulacji">
            <span className="text-c-text-secondary">{cell.accumulationBasis}</span>
          </Row>
        )}
        {cell.reclassifiedFromLineId && (
          <Row label="Reklasyfikacja">
            <span className="font-mono text-[10px] text-c-text-secondary">z {cell.reclassifiedFromLineId}</span>
          </Row>
        )}
      </dl>

      <div className="mt-4 border-t border-c-border-subtle pt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">Dowód źródłowy</p>
        {sourceRefEntries && sourceRefEntries.length > 0 ? (
          <dl className="space-y-1 rounded-lg bg-c-surface-raised p-2 text-[11px]" data-testid="source-evidence-ref">
            {sourceRefEntries.map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <dt className="text-c-text-muted">{key}</dt>
                <dd className="font-mono text-c-text">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[11px] text-c-text-muted" data-testid="source-evidence-ref-missing">
            Brak zapisanego dowodu źródłowego dla tej wartości (sourceRef = brak).
          </p>
        )}
      </div>

      {mappingRow !== undefined && (
        <div className="mt-4 border-t border-c-border-subtle pt-3" data-testid="source-evidence-mapping">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
            Ścieżka mapowania (rekoncyliacja)
          </p>
          {mappingRow === null ? (
            <p className="text-[11px] text-c-text-muted" data-testid="source-evidence-mapping-missing">
              Wybrany przebieg rekoncyliacji nie zawiera wiersza mapowania dla tej komórki.
            </p>
          ) : (
            <dl className="space-y-1 rounded-lg bg-c-surface-raised p-2 text-[11px]" data-testid="source-evidence-mapping-row">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-c-text-muted">Bucket</dt>
                <dd className="font-mono text-c-text" data-testid="source-evidence-mapping-bucket">
                  {mappingRow.bucket}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-c-text-muted">Kwota źródłowa</dt>
                <dd className="font-mono text-c-text">{mappingRow.sourceAmount ?? '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-c-text-muted">Kwota zmapowana</dt>
                <dd className="font-mono text-c-text">{mappingRow.mappedAmount ?? '—'}</dd>
              </div>
              {mappingRow.sourceRowRef && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-c-text-muted">sourceRowRef</dt>
                  <dd className="font-mono text-c-text" data-testid="source-evidence-mapping-source-row-ref">
                    {JSON.stringify(mappingRow.sourceRowRef)}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-c-text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default SourceEvidencePanel;
