import { describe, expect, it } from 'vitest';
import { isDrdInterviewV2Enabled } from '../drdInterviewV2Flag';

describe('VITE_DRD_INTERVIEW_V2', () => {
  it('is default OFF and enables only explicit true', () => {
    expect(isDrdInterviewV2Enabled({})).toBe(false);
    expect(isDrdInterviewV2Enabled({ VITE_DRD_INTERVIEW_V2: 'false' })).toBe(false);
    expect(isDrdInterviewV2Enabled({ VITE_DRD_INTERVIEW_V2: 'true' })).toBe(true);
  });
});
