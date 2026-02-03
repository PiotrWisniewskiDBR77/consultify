/**
 * DailyDigestCron
 *
 * Dynamically imported by `Scheduler.ts` using a `.js` specifier.
 * Provide safe no-op implementations to keep the scheduler resilient.
 */
export async function processDailyDigests() {
  return { sent: 0, failed: 0, skipped: 0 };
}

export async function processWeeklyDigests() {
  return { sent: 0, failed: 0, skipped: 0 };
}
