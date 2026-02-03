/**
 * ReportGenerationJob
 *
 * This module is dynamically imported by `server/src/cron/Scheduler.ts` using a `.js` specifier.
 * During Vitest runs (Vite ESM resolver), the `.js` specifier requires a real file to exist.
 *
 * The full report scheduling pipeline may be implemented elsewhere; for now we provide a safe
 * no-op implementation to prevent import-time crashes and keep the scheduler resilient.
 */
export async function processScheduledReports() {
  return { processed: 0 };
}
