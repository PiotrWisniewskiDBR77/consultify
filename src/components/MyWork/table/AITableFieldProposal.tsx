/**
 * AITableFieldProposal — podgląd różnicy (co było → co będzie) dla autofill/odświeżania.
 *
 * P1-6 (rozdz. 09 §4): akcje `tbl_autofill_from_artifact` / `tbl_refresh_artifact_data`
 * nie zapisują już prosto do komórek. Najpierw pokazują TĘ propozycję:
 *   - per wiersz: etykieta + lista zmienianych pól z parą przed → po,
 *   - per-wiersz akceptacja (checkbox) + „Zastosuj wszystkie / Odrzuć wszystkie",
 *   - „Zastosuj" pisze TYLKO zaakceptowane wiersze; „Odrzuć" = zero zmian w danych.
 *
 * Migawka przed zastosowaniem jest zdejmowana przez wołającego (undo stack),
 * analogicznie do modelu propozycji canvasu (IdeaProposalReview).
 */
import { Check, ChevronDown, ChevronRight, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Pojedyncza zmiana komórki: klucz kolumny, nagłówek, wartość przed i po. */
export interface FieldFillCellChange {
  key: string;
  header: string;
  before: unknown;
  after: unknown;
}

/** Zmiany dla jednego wiersza (co najmniej jedna komórka faktycznie się różni). */
export interface FieldFillRowChange {
  rowId: string;
  label: string;
  cells: FieldFillCellChange[];
}

/** Cała propozycja autofill/odświeżania oczekująca na akcept. */
export interface FieldFillProposal {
  source: 'autofill' | 'refresh';
  rows: FieldFillRowChange[];
}

interface AITableFieldProposalProps {
  proposal: FieldFillProposal;
  /** Wywoływane z wierszami zaakceptowanymi przez użytkownika (może być podzbiorem). */
  onApply: (acceptedRows: FieldFillRowChange[]) => void;
  onReject: () => void;
}

function formatValue(v: unknown, emptyLabel: string): string {
  if (v === null || v === undefined || v === '') return emptyLabel;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export const AITableFieldProposal: React.FC<AITableFieldProposalProps> = ({
  proposal,
  onApply,
  onReject,
}) => {
  const { t } = useTranslation();

  const [acceptedRowIds, setAcceptedRowIds] = useState<Set<string>>(
    () => new Set(proposal.rows.map((r) => r.rowId))
  );
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(
    () => new Set(proposal.rows.map((r) => r.rowId))
  );

  const totalCells = useMemo(
    () => proposal.rows.reduce((sum, r) => sum + r.cells.length, 0),
    [proposal.rows]
  );

  const toggleRow = useCallback((rowId: string) => {
    setAcceptedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const allSelected = acceptedRowIds.size === proposal.rows.length;
  const emptyLabel = t('myWorkTable.fieldProposal.empty', '(puste)');

  const handleApply = useCallback(() => {
    const accepted = proposal.rows.filter((r) => acceptedRowIds.has(r.rowId));
    onApply(accepted);
  }, [acceptedRowIds, onApply, proposal.rows]);

  const SourceIcon = proposal.source === 'refresh' ? RefreshCw : Wand2;

  return (
    <div className="rounded-2xl border border-c-info/20 bg-c-surface shadow-lg shadow-c-info/5 overflow-hidden">
      {/* Nagłówek */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-c-info/15">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-c-info/15 flex items-center justify-center">
            <Sparkles size={12} className="text-c-info" />
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-c-text">
              <SourceIcon size={11} className="text-c-info" />
              {proposal.source === 'refresh'
                ? t('myWorkTable.fieldProposal.refreshTitle', 'Odświeżenie z artefaktów')
                : t('myWorkTable.fieldProposal.autofillTitle', 'Autofill z artefaktów')}
            </div>
            <div className="text-[9px] text-c-text-muted">
              {t('myWorkTable.fieldProposal.summary', {
                defaultValue: '{{rows}} wierszy · {{cells}} pól do zmiany',
                rows: proposal.rows.length,
                cells: totalCells,
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setAcceptedRowIds(
                allSelected ? new Set() : new Set(proposal.rows.map((r) => r.rowId))
              )
            }
            className="px-2 py-1 rounded-lg text-[10px] font-semibold text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {allSelected
              ? t('myWorkTable.fieldProposal.deselectAll', 'Odznacz wszystkie')
              : t('myWorkTable.fieldProposal.selectAll', 'Zaznacz wszystkie')}
          </button>
          <button
            onClick={onReject}
            className="ml-1 p-1 rounded-lg text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
            title={t('myWorkTable.fieldProposal.dismiss', 'Odrzuć')}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Lista wierszy z różnicą przed → po */}
      <div className="max-h-[340px] overflow-y-auto divide-y divide-c-border-subtle">
        {proposal.rows.map((row) => {
          const checked = acceptedRowIds.has(row.rowId);
          const expanded = expandedRowIds.has(row.rowId);
          return (
            <div key={row.rowId} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRow(row.rowId)}
                  className="accent-c-info"
                  aria-label={row.label}
                />
                <button
                  onClick={() => toggleExpanded(row.rowId)}
                  className="flex-1 flex items-center gap-1 min-w-0 text-left"
                >
                  {expanded ? (
                    <ChevronDown size={12} className="text-c-text-secondary flex-shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-c-text-secondary flex-shrink-0" />
                  )}
                  <span className="text-[11px] font-medium text-c-text truncate">
                    {row.label || row.rowId}
                  </span>
                  <span className="text-[9px] text-c-text-muted flex-shrink-0">
                    {t('myWorkTable.fieldProposal.fieldCount', {
                      defaultValue: '{{count}} pól',
                      count: row.cells.length,
                    })}
                  </span>
                </button>
              </div>

              {expanded && (
                <div className="mt-1.5 ml-6 space-y-1">
                  {row.cells.map((cell) => (
                    <div
                      key={cell.key}
                      className="rounded-lg bg-c-surface-raised px-2 py-1.5 text-[10px]"
                    >
                      <div className="font-semibold text-c-text-secondary mb-0.5">
                        {cell.header}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-c-text-muted line-through decoration-c-text-muted/50">
                          {formatValue(cell.before, emptyLabel)}
                        </span>
                        <span className="text-c-text-muted">→</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatValue(cell.after, emptyLabel)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Akcje */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-2.5 border-t border-c-border-subtle">
        <button
          onClick={onReject}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-danger-600 dark:text-danger-400 bg-danger-500/10 hover:bg-danger-500/20 transition-colors"
        >
          <X size={11} />
          {t('myWorkTable.fieldProposal.reject', 'Odrzuć')}
        </button>
        <button
          onClick={handleApply}
          disabled={acceptedRowIds.size === 0}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
        >
          <Check size={11} />
          {t('myWorkTable.fieldProposal.apply', {
            defaultValue: 'Zastosuj ({{count}})',
            count: acceptedRowIds.size,
          })}
        </button>
      </div>
    </div>
  );
};

export default AITableFieldProposal;
