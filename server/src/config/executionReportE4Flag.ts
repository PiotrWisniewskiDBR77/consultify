export const isExecutionReportE4Enabled = (): boolean =>
  process.env.ENABLE_EXECUTION_REPORT_E4 === 'true';
