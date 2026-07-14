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
 * Derive area-level scores from the report's per-axis data.
 *
 * The report builder stores `axisData` keyed either by internal axis key
 * (processes, dataManagement, …) or by numeric axis id. Each area in an axis
 * inherits that axis's actual/target (uniform fallback) so the report is fully
 * renderable even when only axis-level aggregates exist. When true per-area
 * scores are available, pass them directly instead.
 */
export function areaScoresFromAxisData(
  axisData: Record<string, { actual?: number; target?: number }>
): AreaScores {
  const scores: AreaScores = {};
  for (const axis of DRD_STRUCTURE) {
    const byKey = Object.entries(DRD_KEY_TO_AXIS_MAP).find(([, id]) => id === axis.id)?.[0];
    const entry =
      (byKey && axisData[byKey]) || axisData[String(axis.id)] || axisData[axis.name] || {};
    const actual = Number(entry.actual ?? 0);
    const target = Number(entry.target ?? 0);
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
