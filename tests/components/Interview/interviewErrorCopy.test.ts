import { describe, expect, it } from 'vitest';

import { getSafeInterviewErrorMessage } from '../../../src/components/Interview/interviewErrorCopy';

describe('interviewErrorCopy', () => {
  it('keeps plain user-safe messages', () => {
    expect(
      getSafeInterviewErrorMessage({ message: 'Interview insight is still generating.' }, 'Fallback')
    ).toBe('Interview insight is still generating.');
  });

  it('falls back when the payload looks like raw backend data', () => {
    expect(
      getSafeInterviewErrorMessage(
        { response: { data: { error: { code: 'SQL_ERROR', detail: 'select * from interviews' } } } },
        'Failed to load interview insights.'
      )
    ).toBe('Failed to load interview insights.');
  });
});
