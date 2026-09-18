type ReportBuilderNavEnv = Record<string, string | boolean | undefined>;

/** Default-OFF release gate for the RB-3 Write / Review / Publish shell. */
export function isReportBuilderNavV2Enabled(
  env: ReportBuilderNavEnv = import.meta.env as ReportBuilderNavEnv,
  search: string = typeof window === 'undefined' ? '' : window.location.search
): boolean {
  const override = new URLSearchParams(search).get('ff_report_builder_nav_v2');
  if (override === '1') return true;
  if (override === '0') return false;
  return env.VITE_REPORT_BUILDER_NAV_V2 === 'true';
}
