import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isChatSignalsFeedEnabled, resetChatSignalsFeedFlagCache } from '../chatSignalsFeedFlag';

describe('chat signals feed flag', () => {
  const originalLocation = window.location;
  const setSearch = (search: string) =>
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, search },
    });

  beforeEach(() => {
    setSearch('');
    localStorage.clear();
    resetChatSignalsFeedFlagCache();
  });

  afterEach(() => {
    setSearch('');
    localStorage.clear();
    resetChatSignalsFeedFlagCache();
  });

  it('defaults OFF', () => expect(isChatSignalsFeedEnabled()).toBe(false));

  it('reads query ON', () => {
    setSearch('?ff_chatSignalsFeed=1');
    expect(isChatSignalsFeedEnabled()).toBe(true);
  });

  it('reads local storage ON', () => {
    localStorage.setItem('ff.chat_signals_feed', 'on');
    expect(isChatSignalsFeedEnabled()).toBe(true);
  });

  it('lets query OFF win over local storage ON', () => {
    localStorage.setItem('ff.chat_signals_feed', 'on');
    setSearch('?ff_chatSignalsFeed=0');
    expect(isChatSignalsFeedEnabled()).toBe(false);
  });

  it('fails closed when local storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(isChatSignalsFeedEnabled()).toBe(false);
    spy.mockRestore();
  });

  it('caches until reset', () => {
    setSearch('?ff_chatSignalsFeed=1');
    expect(isChatSignalsFeedEnabled()).toBe(true);
    setSearch('?ff_chatSignalsFeed=0');
    expect(isChatSignalsFeedEnabled()).toBe(true);
    resetChatSignalsFeedFlagCache();
    expect(isChatSignalsFeedEnabled()).toBe(false);
  });
});
