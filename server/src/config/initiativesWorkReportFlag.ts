/** Server-side kill switch for the Initiatives work-report capability. */
export const isInitiativesWorkReportEnabled = (): boolean =>
  process.env.ENABLE_INITIATIVES_WORK_REPORT === 'true';
