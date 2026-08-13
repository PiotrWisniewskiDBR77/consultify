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
import React from 'react';

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
  const accessibleName = `${methodName}, ${unitName}, poziom ${cell.level}, ${
    cell.achieved ? 'osiągnięty' : 'nieosiągnięty'
  }, odpowiedź ${ANSWER_STATE_LABEL[cell.answerState] || cell.answerState}, evidence ${cell.evidenceState}${
    cell.blocker ? ', blocker' : ''
  }`;

  const borderClass = cell.blocker
    ? 'border-2 border-c-danger'
    : cell.evidenceState === 'missing' || cell.evidenceState === 'conflicting'
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
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
              </tr>
            ))}
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
