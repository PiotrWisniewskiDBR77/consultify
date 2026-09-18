import { describe, expect, it } from 'vitest';

import { isInterviewExecSummaryProseEnabled } from '../interviewExecSummaryProseFlag';

describe('isInterviewExecSummaryProseEnabled (DEC-510 / U-08 / IS-3b)', () => {
  it('is OFF when the env var is missing (fail-closed default)', () => {
    expect(isInterviewExecSummaryProseEnabled({})).toBe(false);
  });

  it('is OFF for an empty string', () => {
    expect(isInterviewExecSummaryProseEnabled({ VITE_INTERVIEW_EXEC_SUMMARY_PROSE: '' })).toBe(false);
  });

  it('is OFF for any value other than the exact string "true"', () => {
    for (const value of ['1', 'TRUE', 'True', 'yes', 'on', 'false', '0', 'unexpected']) {
      expect(
        isInterviewExecSummaryProseEnabled({ VITE_INTERVIEW_EXEC_SUMMARY_PROSE: value })
      ).toBe(false);
    }
  });

  it('is ON only for the exact string "true"', () => {
    expect(isInterviewExecSummaryProseEnabled({ VITE_INTERVIEW_EXEC_SUMMARY_PROSE: 'true' })).toBe(
      true
    );
  });
});
