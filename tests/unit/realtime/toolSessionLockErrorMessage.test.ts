import { describe, expect, it } from 'vitest';

import { toolSessionLockErrorMessage } from '@/utils/realtime/toolSessionLockErrorMessage';

const codedError = (code: string, message = 'server message') =>
  ({
    data: { code },
    message,
  }) as Error & { data: { code: string } };

describe('toolSessionLockErrorMessage', () => {
  it('maps known realtime lock machine codes to deterministic messages', () => {
    expect(
      toolSessionLockErrorMessage(codedError('REALTIME_TOOL_SESSION_LOCK_PAYLOAD_INVALID'), 'fallback')
    ).toBe('Lock payload is invalid. Refresh the board and retry editing.');
    expect(toolSessionLockErrorMessage(codedError('REALTIME_TOOL_SESSION_LOCK_HELD'), 'fallback')).toBe(
      'This block is currently locked by another collaborator.'
    );
    expect(
      toolSessionLockErrorMessage(codedError('REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE'), 'fallback')
    ).toBe('Realtime edit locks are temporarily unavailable. Try again shortly.');
  });

  it('falls back to error message and then fallback text', () => {
    expect(toolSessionLockErrorMessage(new Error('server says no'), 'FB')).toBe('server says no');
    expect(toolSessionLockErrorMessage({ data: {} }, 'FB')).toBe('FB');
  });
});
