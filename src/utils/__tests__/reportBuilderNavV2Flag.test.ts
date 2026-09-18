import { describe, expect, it } from 'vitest';

import { isReportBuilderNavV2Enabled } from '../reportBuilderNavV2Flag';

describe('VITE_REPORT_BUILDER_NAV_V2', () => {
  it('fails closed unless the environment value is exactly true', () => {
    expect(isReportBuilderNavV2Enabled({}, '')).toBe(false);
    expect(isReportBuilderNavV2Enabled({ VITE_REPORT_BUILDER_NAV_V2: 'false' }, '')).toBe(false);
    expect(isReportBuilderNavV2Enabled({ VITE_REPORT_BUILDER_NAV_V2: 'TRUE' }, '')).toBe(false);
    expect(isReportBuilderNavV2Enabled({ VITE_REPORT_BUILDER_NAV_V2: 'true' }, '')).toBe(true);
  });

  it('allows an explicit browser override for the real-shell harness', () => {
    expect(isReportBuilderNavV2Enabled({}, '?ff_report_builder_nav_v2=1')).toBe(true);
    expect(
      isReportBuilderNavV2Enabled(
        { VITE_REPORT_BUILDER_NAV_V2: 'true' },
        '?ff_report_builder_nav_v2=0'
      )
    ).toBe(false);
  });
});
