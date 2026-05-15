import { describe, expect, it } from 'vitest';

import { toolSessionPresenceErrorMessage } from '@/utils/realtime/toolSessionPresenceErrorMessage';

const codedError = (code: string, message = 'server message') =>
  ({
    data: { code },
    message,
  }) as Error & { data: { code: string } };

describe('toolSessionPresenceErrorMessage', () => {
  it('maps known realtime presence machine codes to deterministic messages', () => {
    expect(
      toolSessionPresenceErrorMessage(
        codedError('REALTIME_TOOL_SESSION_PRESENCE_PAYLOAD_INVALID'),
        'fallback'
      )
    ).toBe('Tool-session presence payload is invalid. Refresh the board and retry.');
    expect(
      toolSessionPresenceErrorMessage(codedError('REALTIME_TOOL_SESSION_PRESENCE_READ_FAILED'), 'fallback')
    ).toBe('Collaborator presence could not be refreshed. Try again shortly.');
    expect(
      toolSessionPresenceErrorMessage(
        codedError('REALTIME_TOOL_SESSION_PRESENCE_WRITE_FAILED'),
        'fallback'
      )
    ).toBe('Presence sync is temporarily unavailable. Try again shortly.');
  });

  it('falls back to error message and then fallback text', () => {
    expect(toolSessionPresenceErrorMessage(new Error('server says no'), 'FB')).toBe('server says no');
    expect(toolSessionPresenceErrorMessage({ data: {} }, 'FB')).toBe('FB');
  });
});
