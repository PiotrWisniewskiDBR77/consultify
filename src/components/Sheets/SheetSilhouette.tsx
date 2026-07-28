/**
 * Deterministic mini layout preview for a spreadsheet/workbook artifact —
 * sibling of `SlideSilhouette` (Presentations) and `DocumentStructurePreview`
 * (DocumentStudio). Originated in the accepted prototype
 * `dev-render/screens/proto-galeria-szablonow.tsx` (`SylwetkaArkusza`) for
 * MATERIAŁY ▸ Biblioteka wzorców as a GALERIA (N4, 2026-07-27/28); promoted
 * here because no equivalent existed for the "sheet" format and the shape is
 * reusable anywhere a workbook/table artifact needs a structure glyph.
 *
 * Renders a header row + a data grid (darker cell = formula, same
 * distinction the live xlsx preview already draws with `font-mono` for
 * formula cells) + a row of sheet tabs. Pure geometry, no invented numbers:
 * it never reads or displays real cell values.
 *
 * ★ Today's `TemplateItem` (ReportsAndPresentations) carries NO structural
 * field for sheets (no column/row/tab count) — `sectionCount`/`slideCount`
 * are only populated for report/presentation templates (see
 * `mapCanonicalTemplateArtifact` in useRapData.ts). Callers without real
 * counts should pass `NEUTRAL_SHEET_SILHOUETTE` — a fixed, honest "this is a
 * spreadsheet" glyph that makes no claim about actual structure — rather
 * than inventing plausible-looking numbers.
 */
import React from 'react';

export interface SheetSilhouetteProps {
  /** Number of header/data columns to draw. */
  columns: number;
  /** Number of data rows to draw. */
  rows: number;
  /** Every Nth cell (by reading order) renders as a formula cell (darker). */
  formulaDensity: number;
  /** Number of sheet-tab chips drawn along the bottom. */
  tabs: number;
  className?: string;
}

/**
 * Neutral fallback parameters — used whenever the caller has no real
 * structural data for the sheet (which is the common case today; see file
 * header). Deliberately generic, not derived from any specific artifact.
 */
export const NEUTRAL_SHEET_SILHOUETTE: Omit<SheetSilhouetteProps, 'className'> = {
  columns: 5,
  rows: 5,
  formulaDensity: 4,
  tabs: 3,
};

export const SheetSilhouette: React.FC<SheetSilhouetteProps> = ({
  columns,
  rows,
  formulaDensity,
  tabs,
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`flex h-full w-full flex-col gap-1.5 rounded-md border border-c-border-subtle bg-c-surface-raised p-2 ${className}`}
  >
    {/* header row */}
    <div className="flex gap-1">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="h-2 flex-1 rounded-sm bg-c-text-muted/40" />
      ))}
    </div>
    {/* data grid — darker cell = formula */}
    <div className="flex flex-1 flex-col justify-between gap-1">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-1">
          {Array.from({ length: columns }).map((_, c) => {
            const formula = (r * columns + c) % formulaDensity === formulaDensity - 1;
            return (
              <div
                key={c}
                className={`h-1.5 flex-1 rounded-sm ${
                  formula ? 'bg-c-text-secondary/45' : 'bg-c-text-muted/20'
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
    {/* sheet tabs */}
    <div className="flex items-end gap-1">
      {Array.from({ length: tabs }).map((_, tIdx) => (
        <div
          key={tIdx}
          className={`rounded-sm ${tIdx === 0 ? 'h-2 bg-c-text-muted/45' : 'h-1.5 bg-c-text-muted/20'}`}
          style={{ width: 18 }}
        />
      ))}
    </div>
  </div>
);

export default SheetSilhouette;
