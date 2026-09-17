import { describe, expect, it } from 'vitest';

import { isPlanTimelineV2Enabled } from '../planTimelineV2Flag';

describe('isPlanTimelineV2Enabled', () => {
  it('fails closed unless VITE_PLAN_TIMELINE_V2 is exactly true', () => {
    expect(isPlanTimelineV2Enabled({})).toBe(false);
    expect(isPlanTimelineV2Enabled({ VITE_PLAN_TIMELINE_V2: 'false' })).toBe(false);
    expect(isPlanTimelineV2Enabled({ VITE_PLAN_TIMELINE_V2: 'TRUE' })).toBe(false);
    expect(isPlanTimelineV2Enabled({ VITE_PLAN_TIMELINE_V2: 'true' })).toBe(true);
  });
});
