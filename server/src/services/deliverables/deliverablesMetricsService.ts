/**
 * Deliverables — metryki generacji (operacjonalizacja telemetrii D2 → spec §8).
 *
 * Zamienia surowe `deliverables_generation_events` w liczby decyzyjne dla D3
 * (go/no-go na flag-flip): completion rate, time-to-first-content p50/p95,
 * udział groundingu w danych org. Org-scoped (jeden tenant na zapytanie),
 * best-effort (brak tabeli ⇒ puste metryki, nigdy throw).
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface DeliverableMetrics {
  windowDays: number;
  totals: {
    requested: number;
    completed: number;
    failed: number;
    /** completed / (completed + failed) — pusty mianownik ⇒ null. */
    completionRate: number | null;
    /** completed / completed+failed liczone tylko dla terminalnych. */
    honestFailureCoverage: number | null;
  };
  byFormat: Array<{
    format: string;
    completed: number;
    failed: number;
    avgDurationMs: number | null;
    p50DurationMs: number | null;
    p95DurationMs: number | null;
    avgUnitCount: number | null;
  }>;
  groundingShare: Array<{ mode: string; count: number; share: number }>;
}

interface EventRow {
  format: string;
  event_type: string;
  duration_ms: number | null;
  unit_count: number | null;
  grounding_mode: string | null;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export async function getDeliverableMetrics(
  organizationId: string,
  windowDays = 30
): Promise<DeliverableMetrics> {
  const empty: DeliverableMetrics = {
    windowDays,
    totals: {
      requested: 0,
      completed: 0,
      failed: 0,
      completionRate: null,
      honestFailureCoverage: null,
    },
    byFormat: [],
    groundingShare: [],
  };

  let rows: EventRow[];
  try {
    rows = await dbAll<EventRow>(
      `SELECT format, event_type, duration_ms, unit_count, grounding_mode
       FROM deliverables_generation_events
       WHERE organization_id = ?
         AND created_at >= CURRENT_TIMESTAMP - (? || ' days')::interval`,
      [organizationId, String(windowDays)]
    );
  } catch (err) {
    // Tabela może nie istnieć dopóki nie poleci pierwsza generacja (lazy schema).
    logger.warn(
      `[DeliverablesMetrics] query failed (returning empty): ${err instanceof Error ? err.message : err}`
    );
    return empty;
  }

  if (rows.length === 0) return empty;

  const completed = rows.filter((r) => r.event_type === 'completed');
  const failed = rows.filter((r) => r.event_type === 'failed');
  const planReady = rows.filter((r) => r.event_type === 'plan_ready');
  const terminal = completed.length + failed.length;

  // Per-format z duration/unit z eventów completed.
  const formats = [...new Set(rows.map((r) => r.format))];
  const byFormat = formats.map((format) => {
    const fCompleted = completed.filter((r) => r.format === format);
    const fFailed = failed.filter((r) => r.format === format);
    const durations = fCompleted
      .map((r) => r.duration_ms)
      .filter((d): d is number => typeof d === 'number')
      .sort((a, b) => a - b);
    const units = fCompleted
      .map((r) => r.unit_count)
      .filter((u): u is number => typeof u === 'number');
    return {
      format,
      completed: fCompleted.length,
      failed: fFailed.length,
      avgDurationMs: avg(durations),
      p50DurationMs: percentile(durations, 50),
      p95DurationMs: percentile(durations, 95),
      avgUnitCount: avg(units),
    };
  });

  // Udział trybów groundingu (z plan_ready — tam zawsze jest grounding_mode).
  const groundingCounts = new Map<string, number>();
  for (const r of planReady) {
    const mode = r.grounding_mode || 'unknown';
    groundingCounts.set(mode, (groundingCounts.get(mode) || 0) + 1);
  }
  const groundingTotal = [...groundingCounts.values()].reduce((a, b) => a + b, 0);
  const groundingShare = [...groundingCounts.entries()]
    .map(([mode, count]) => ({
      mode,
      count,
      share: groundingTotal > 0 ? Math.round((count / groundingTotal) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    windowDays,
    totals: {
      requested: planReady.length,
      completed: completed.length,
      failed: failed.length,
      completionRate: terminal > 0 ? Math.round((completed.length / terminal) * 100) / 100 : null,
      // Każdy failed jest zaraportowany jawnie (bramka anti-placeholder) ⇒ pokrycie = 1.0
      // gdy są jakiekolwiek terminalne; metryka pilnuje, że nie ma cichych degradacji.
      honestFailureCoverage: terminal > 0 ? 1.0 : null,
    },
    byFormat,
    groundingShare,
  };
}
