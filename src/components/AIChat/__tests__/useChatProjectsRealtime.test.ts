import { describe, expect, it } from 'vitest';

import { resolveChatProjectsSocketEndpoint } from '../useChatProjectsRealtime';

describe('resolveChatProjectsSocketEndpoint', () => {
  it('uses the backend target for a split local frontend/backend runtime', () => {
    expect(resolveChatProjectsSocketEndpoint('http://127.0.0.1:3111/')).toBe(
      'http://127.0.0.1:3111/chat-projects'
    );
  });

  it('keeps same-origin routing in deployed builds', () => {
    expect(resolveChatProjectsSocketEndpoint('')).toBe('/chat-projects');
  });
});
