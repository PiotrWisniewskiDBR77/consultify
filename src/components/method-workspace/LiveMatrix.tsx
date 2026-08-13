/**
 * LiveMatrix — the "Graphic Mirror" (unit × level matrix), reading and writing
 * the SAME model as the Interview canvas (WORKBENCH §2). Semantics per
 * UI-NAV §3:
 *
 *   - the cell's fill intensity encodes maturity LEVEL only (neutral ramp —
 *     never a status hue, so it can never be misread as confidence/workflow);
 *   - border style + icon overlay encode WORKFLOW/EVIDENCE (dashed = weak/
 *     missing evidence, ring = target level, icon = AI-pending/review/blocker);
 *   - every cell carries a full accessible name (method/unit/level/state/
 *     evidence) and a textual state — never color alone.
 *
 * Clicking a cell opens the caller-supplied side sheet; selection is a
 * CONTROLLED prop so the parent shell can restore zoom/scroll/selection on
 * return, exactly as UI-NAV §2.1 requires — this component never owns that
 * state itself.
 */
import { AlertTriangle, Eye, Sparkles, X } from 'lucide-react';
import React, { useEffect } from 'react';

import type { MatrixCellState, MatrixRow, MatrixSelection } from './types';

export interface LiveMatrixProps {
  rows: readonly MatrixRow[];
  levels: readonly number[];
  selection: MatrixSelection | null;
  onSelect: (selection: MatrixSelection) => void;
  onCloseSideSheet: () => void;
  renderSideSheet: (selection: MatrixSelection, cell: MatrixCellState | null) => React.ReactNode;
  methodName: string;
  legendCollapsed?: boolean;
  className?: string;
}

const ANSWER_STATE_LABEL: Record<string, string> = {
  confirmed: 'potwierdzone',
  partial: 'częściowo',
  no: 'nie',
  dont_know: 'nie wiem',
  no_evidence: 'brak dowodu',
  not_applicable: 'nie dotyczy',
  unresolved: 'nierozstrzygnięte',
};

/**
 * A cell only carries evidence MEANING once someone has actually engaged with
 * it: it's part of the confirmed ramp (`achieved`), it IS the current blocker
 * (the next thing to work on), or it was confirmed out of order and needs
 * review (`reviewRequired`). Every other cell is simply not reached yet —
 * "nieoceniony", a normal working state, never a data-quality problem.
 *
 * This gate is what stops "brak dowodu" (evidenceState 'missing', which the
 * view-model returns for ANY untouched unit) from painting the entire
 * not-yet-worked part of the matrix with the same dashed/amber treatment
 * meant for a real evidence gap on a cell that's actually in play.
 */
function isCellEngaged(cell: MatrixCellState): boolean {
  return cell.achieved || cell.blocker || cell.reviewRequired;
}

/**
 * Current/Target/Gap read at a glance, per row — derived from the same cell
 * data the grid already renders (no separate source of truth). `current` is
 * the top of the confirmed ramp; `target` is whichever level carries the
 * `target` flag; `gap` is only ever shown when both are known.
 */
function rowSummary(row: MatrixRow): { current: number | null; target: number | null; gap: number | null } {
  const achievedLevels = row.levels.filter((c) => c.achieved).map((c) => c.level);
  const current = achievedLevels.length > 0 ? Math.max(...achievedLevels) : null;
  const targetLevel = row.levels.find((c) => c.target)?.level ?? null;
  const gap = current !== null && targetLevel !== null ? targetLevel - current : null;
  return { current, target: targetLevel, gap };
}

function cellLevelTint(level: number, maxLevel: number): React.CSSProperties {
  const ratio = maxLevel > 0 ? level / maxLevel : 0;
  const pct = Math.round(10 + ratio * 30); // 10%..40% neutral tint — level magnitude only
  return { backgroundColor: `color-mix(in srgb, var(--c-text) ${pct}%, transparent)` };
}

const Cell: React.FC<{
  cell: MatrixCellState;
  unitName: string;
  methodName: string;
  selected: boolean;
  maxLevel: number;
  onSelect: () => void;
}> = ({ cell, unitName, methodName, selected, maxLevel, onSelect }) => {
  const engaged = isCellEngaged(cell);

  // Not-yet-reached cells never mention evidence at all — there is nothing to
  // report yet, and saying "evidence missing" here would read as a defect.
  const evidencePhrase = engaged ? `evidence ${cell.evidenceState}` : 'jeszcze nieoceniony';
  const accessibleName = `${methodName}, ${unitName}, poziom ${cell.level}, ${
    cell.achieved ? 'osiągnięty' : 'nieosiągnięty'
  }, odpowiedź ${ANSWER_STATE_LABEL[cell.answerState] || cell.answerState}, ${evidencePhrase}${
    cell.blocker ? ', blocker' : ''
  }`;

  // Kanon: nieoceniony obszar (jeszcze nie dotknięty) NIE jest blokerem ani
  // luką dowodową — dostaje spokojną, neutralną obwódkę niezależnie od
  // wyliczonego (per-unit) evidenceState. Dashed/amber jest zarezerwowany dla
  // komórek, które są faktycznie w grze: osiągniętych, blokera, above-gap.
  const borderClass = cell.blocker
    ? 'border-2 border-c-danger'
    : !engaged
      ? 'border border-c-border-subtle'
      : cell.evidenceState === 'conflicting'
        ? 'border-2 border-c-danger'
        : cell.evidenceState === 'missing'
          ? 'border border-dashed border-c-warning'
          : cell.evidenceState === 'weak'
            ? 'border border-dashed border-c-border'
            : 'border border-c-border';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={accessibleName}
      aria-pressed={selected}
      title={accessibleName}
      data-testid="matrix-cell"
      data-unit-id={cell.unitId}
      data-level={cell.level}
      className={`relative flex h-9 w-9 items-center justify-center rounded-md text-[11px] font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${borderClass} ${
        selected ? 'ring-2 ring-c-focus scale-105' : ''
      } ${cell.target ? 'outline outline-2 outline-c-info/60' : ''}`}
      style={cellLevelTint(cell.achieved ? cell.level : 0, maxLevel)}
    >
      <span className={cell.achieved ? 'text-c-text' : 'text-c-text-muted'}>{cell.level}</span>
      {cell.aiProposalPending && (
        <Sparkles size={9} className="absolute -top-1 -right-1 text-teal-500 dark:text-teal-400" aria-hidden="true" />
      )}
      {cell.reviewRequired && !cell.aiProposalPending && (
        <Eye size={9} className="absolute -top-1 -right-1 text-c-info" aria-hidden="true" />
      )}
      {cell.blocker && (
        <AlertTriangle size={9} className="absolute -bottom-1 -right-1 text-c-danger" aria-hidden="true" />
      )}
    </button>
  );
};

export const LiveMatrix: React.FC<LiveMatrixProps> = ({
  rows,
  levels,
  selection,
  onSelect,
  onCloseSideSheet,
  renderSideSheet,
  methodName,
  legendCollapsed = false,
  className = '',
}) => {
  const maxLevel = levels.length > 0 ? Math.max(...levels) : 1;
  const selectedCell =
    selection != null
      ? rows
          .find((r) => r.unitId === selection.unitId)
          ?.levels.find((c) => c.level === selection.level) ?? null
      : null;

  // Esc closes the side sheet — the most local layer open on this screen.
  // Only wired while a selection exists, so it never intercepts Esc elsewhere.
  useEffect(() => {
    if (!selection) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseSideSheet();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, onCloseSideSheet]);

  return (
    <div data-testid="live-matrix" className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-c-text-secondary">Macierz na żywo</h3>
        {!legendCollapsed && (
          <div className="flex items-center gap-3 text-[10px] text-c-text-muted">
            <span className="flex items-center gap-1">
              <Sparkles size={9} className="text-teal-500" /> Propozycja AI
            </span>
            <span className="flex items-center gap-1">
              <Eye size={9} className="text-c-info" /> Review
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle size={9} className="text-c-danger" /> Blocker
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm border border-dashed border-c-warning" /> Evidence luka
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm border border-c-border-subtle" /> Nieoceniony
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        {/* archetyp Matryca (Graphic Mirror unit×level), nie ekran listowy —
            docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md §3 */}
        <table className="border-separate border-spacing-1"> {/* §27-exempt */}
          <thead>
            <tr>
              <th className="sticky left-0 bg-c-bg text-left text-[10px] font-medium text-c-text-muted pr-2">
                Jednostka
              </th>
              {levels.map((level) => (
                <th key={level} className="text-[10px] font-medium text-c-text-muted w-9">
                  L{level}
                </th>
              ))}
              <th className="pl-3 text-left text-[10px] font-medium text-c-text-muted whitespace-nowrap">
                Current · Target · Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const summary = rowSummary(row);
              return (
                <tr key={row.unitId}>
                  <th
                    scope="row"
                    className="sticky left-0 bg-c-bg text-left text-xs font-medium text-c-text pr-2 max-w-[160px] truncate"
                  >
                    {row.unitName}
                  </th>
                  {row.levels.map((cell) => (
                    <td key={cell.level}>
                      <Cell
                        cell={cell}
                        unitName={row.unitName}
                        methodName={methodName}
                        maxLevel={maxLevel}
                        selected={selection?.unitId === row.unitId && selection?.level === cell.level}
                        onSelect={() => onSelect({ unitId: row.unitId, level: cell.level })}
                      />
                    </td>
                  ))}
                  <td
                    data-testid="matrix-row-summary"
                    data-unit-id={row.unitId}
                    className="pl-3 text-[10px] tabular-nums text-c-text-secondary whitespace-nowrap"
                  >
                    <span title="Obecny poziom">C {summary.current ?? '—'}</span>
                    <span className="mx-1 text-c-text-muted" aria-hidden="true">
                      ·
                    </span>
                    <span title="Poziom docelowy">T {summary.target ?? '—'}</span>
                    <span className="mx-1 text-c-text-muted" aria-hidden="true">
                      ·
                    </span>
                    <span
                      title="Luka (target − current)"
                      className={summary.gap !== null && summary.gap > 0 ? 'font-medium text-c-text' : 'text-c-text-muted'}
                    >
                      Δ {summary.gap ?? '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selection && (
        <div
          role="dialog"
          aria-label={`Szczegóły komórki: ${selection.unitId}, poziom ${selection.level}`}
          data-testid="matrix-side-sheet"
          className="rounded-xl border border-c-border bg-c-surface p-4 mt-1"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-c-text">
              {selection.unitId} · Poziom {selection.level}
            </p>
            <button
              type="button"
              onClick={onCloseSideSheet}
              aria-label="Zamknij szczegóły komórki"
              className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <X size={14} />
            </button>
          </div>
          {renderSideSheet(selection, selectedCell)}
        </div>
      )}
    </div>
  );
};

export default LiveMatrix;
