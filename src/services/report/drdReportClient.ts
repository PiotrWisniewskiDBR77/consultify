/**
 * DRD Report — client-side helpers.
 *
 * Bridges the report-builder view (which holds per-AXIS data) to the area-level
 * report generator, and opens the generated publishing-grade HTML in a new window
 * for print-to-PDF. This is the simplest live path: render-to-HTML on the client,
 * then the browser's own print dialog produces the PDF (print-CSS A4 in the doc).
 */

import DRD_STRUCTURE, { DRD_KEY_TO_AXIS_MAP } from '../drdStructure';
import { generateDrdReport } from './drdReportGenerator';
import type { AreaScores, DrdReportMeta } from './drdReportModel';

/**
 * CONTRACT (finding O1 W7 — client-report absurdity guard): `axis_data` on
 * `assessment_reports` stores DRD MATURITY LEVELS (0..axis.levelCount, i.e.
 * 0..5 or 0..7 depending on the axis), NEVER 0-100 percentages. A stray
 * percentage here (e.g. from a bad seed/fixture/import) would blow past
 * `axis.levelCount` and — once divided into a percent downstream — render as
 * nonsense like "Cybersecurity 600%" in a client-facing report. Clamp at the
 * DB→engine-scores boundary so corrupt values can never propagate, and warn
 * loudly (this should never legitimately happen) so the bad write gets fixed
 * at the source.
 */
function clampAxisLevel(
  raw: number,
  max: number,
  axisLabel: string,
  field: 'actual' | 'target'
): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0 || raw > max) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AxisDataGuard] axis_data out of range — clamped ${field}=${raw} to [0,${max}] for axis "${axisLabel}". ` +
        `axis_data must hold DRD levels (0..maxLevel), never 0-100 percentages. Check the write path (seed/import/generator).`
    );
    return Math.max(0, Math.min(max, raw));
  }
  return raw;
}

/**
 * Derive area-level scores from the report's per-axis data.
 *
 * The report builder stores `axisData` keyed either by internal axis key
 * (processes, dataManagement, …) or by numeric axis id. Each area in an axis
 * inherits that axis's actual/target (uniform fallback) so the report is fully
 * renderable even when only axis-level aggregates exist. When true per-area
 * scores are available, pass them directly instead.
 *
 * DEFENSE-IN-DEPTH (finding O1 W7): clamps actual/target into [0, axis.levelCount]
 * — this is the single choke point between stored `axis_data` (any source: live
 * generation, demo seed, future import) and the report engine, so bad data
 * already sitting in the DB can never produce an impossible (>100%) report.
 */
export function areaScoresFromAxisData(
  axisData: Record<string, { actual?: number; target?: number }>
): AreaScores {
  const scores: AreaScores = {};
  for (const axis of DRD_STRUCTURE) {
    const byKey = Object.entries(DRD_KEY_TO_AXIS_MAP).find(([, id]) => id === axis.id)?.[0];
    const entry =
      (byKey && axisData[byKey]) || axisData[String(axis.id)] || axisData[axis.name] || {};
    const actual = clampAxisLevel(Number(entry.actual ?? 0), axis.levelCount, axis.name, 'actual');
    const target = clampAxisLevel(Number(entry.target ?? 0), axis.levelCount, axis.name, 'target');
    for (const area of axis.areas) {
      scores[area.id] = { actual, target };
    }
  }
  return scores;
}

/** Open an already-generated HTML document string in a new print-ready window. */
export function openHtmlForPrint(
  html: string,
  { autoPrint = false }: { autoPrint?: boolean } = {}
): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (autoPrint) win.setTimeout(() => win.print(), 400);
}

/**
 * Generate the DRD report HTML and open it in a new window ready to print.
 * Returns the generated HTML (also useful for tests / download).
 */
export async function openDrdReportForPrint(
  areaScores: AreaScores,
  meta: DrdReportMeta,
  { autoPrint = false }: { autoPrint?: boolean } = {}
): Promise<string> {
  const { html } = await generateDrdReport(areaScores, meta);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    if (autoPrint) {
      // Give the browser a tick to lay out before invoking print.
      win.setTimeout(() => win.print(), 400);
    }
  }
  return html;
}
