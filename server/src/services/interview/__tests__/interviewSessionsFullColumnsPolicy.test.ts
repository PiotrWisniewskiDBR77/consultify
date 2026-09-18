import { describe, expect, it } from 'vitest';

import { isInterviewSessionsFullColumnsEnabled } from '../interviewSessionsFullColumnsPolicy.js';

describe('Interview sessions full-columns environment gate (IS-2)', () => {
  it('stays off unless the flag is the exact string "true"', () => {
    expect(isInterviewSessionsFullColumnsEnabled({})).toBe(false);
    expect(isInterviewSessionsFullColumnsEnabled({ INTERVIEW_SESSIONS_FULL_COLUMNS: 'false' })).toBe(
      false
    );
    expect(isInterviewSessionsFullColumnsEnabled({ INTERVIEW_SESSIONS_FULL_COLUMNS: '' })).toBe(
      false
    );
    expect(isInterviewSessionsFullColumnsEnabled({ INTERVIEW_SESSIONS_FULL_COLUMNS: 'true' })).toBe(
      true
    );
  });

  it('fails closed on every near-miss truthy spelling', () => {
    for (const value of ['1', 'TRUE', 'True', 'yes', 'on', ' true', 'true ']) {
      expect(isInterviewSessionsFullColumnsEnabled({ INTERVIEW_SESSIONS_FULL_COLUMNS: value })).toBe(
        false
      );
    }
  });
});
