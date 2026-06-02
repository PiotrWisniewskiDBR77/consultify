import { describe, expect, it } from 'vitest';

import { ideaTablePresenceErrorMessage } from '@/utils/mywork/ideaTablePresenceErrorMessage';

const codedError = (code: string, message = 'server message') =>
  ({
    data: { code },
    message,
  }) as Error & { data: { code: string } };

describe('ideaTablePresenceErrorMessage', () => {
  it('maps legacy idea-table presence machine codes to deterministic messages', () => {
    expect(
      ideaTablePresenceErrorMessage(codedError('IDEA_TABLE_PRESENCE_POLL_FAILED'), 'fallback')
    ).toBe('Idea table presence is unavailable. Refresh My Work and retry.');
    expect(
      ideaTablePresenceErrorMessage(codedError('IDEA_TABLE_PRESENCE_UPSERT_FAILED'), 'fallback')
    ).toBe('Could not publish your cursor to collaborators. Retry in a moment.');
  });

  it('falls back to error message and then fallback text', () => {
    expect(ideaTablePresenceErrorMessage(new Error('server says no'), 'FB')).toBe('server says no');
    expect(ideaTablePresenceErrorMessage({ data: {} }, 'FB')).toBe('FB');
  });
});
