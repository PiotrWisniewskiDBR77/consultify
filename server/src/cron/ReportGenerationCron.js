/**
 * Report Generation Cron (legacy scheduler)
 *
 * This legacy scheduler is intentionally disabled in this codebase.
 * Do not return fake scheduled reports or fake IDs.
 *
 * If/when re-enabled, it must be backed by real persistence (DB) and
 * have integration tests.
 */

export async function processScheduledReports() {
  return {
    processed: 0,
    scheduled: [],
    errors: [],
    unavailable: true,
  };
}

export async function getScheduledReports() {
  return [];
}

export async function scheduleReport(reportConfig) {
  throw new Error('Feature unavailable: legacy scheduled report creation is not implemented');
}

export default {
  processScheduledReports,
  getScheduledReports,
  scheduleReport,
};
