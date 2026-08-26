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

  // flip po akcepcie właściciela 27.08 (dyżur 26 feed sygnałów, po FIX-1..13,
  // scalony do m03, DEC-143): default was OFF, now ON.
  it('defaults ON with no query, localStorage, or env override', () => {
    expect(isChatSignalsFeedEnabled()).toBe(true);
  });

  it('reads query ON (redundant with default, still honoured)', () => {
    setSearch('?ff_chatSignalsFeed=1');
    expect(isChatSignalsFeedEnabled()).toBe(true);
  });

  it('reads query OFF', () => {
    setSearch('?ff_chatSignalsFeed=0');
    expect(isChatSignalsFeedEnabled()).toBe(false);
  });

  it('reads local storage ON (redundant with default, still honoured)', () => {
    localStorage.setItem('ff.chat_signals_feed', 'on');
    expect(isChatSignalsFeedEnabled()).toBe(true);
  });

  it('local storage "off"/"0"/"false" still disables it despite the ON default', () => {
    for (const value of ['off', '0', 'false']) {
      localStorage.setItem('ff.chat_signals_feed', value);
      resetChatSignalsFeedFlagCache();
      expect(isChatSignalsFeedEnabled()).toBe(false);
    }
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

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isChatSignalsFeedEnabled()).toBe(true);
    setSearch('?ff_chatSignalsFeed=0');
    expect(isChatSignalsFeedEnabled()).toBe(true);
    resetChatSignalsFeedFlagCache();
    expect(isChatSignalsFeedEnabled()).toBe(false);
  });

  it('caches until reset (ON -> OFF -> ON via query flips)', () => {
    setSearch('?ff_chatSignalsFeed=1');
    expect(isChatSignalsFeedEnabled()).toBe(true);
    setSearch('?ff_chatSignalsFeed=0');
    expect(isChatSignalsFeedEnabled()).toBe(true);
    resetChatSignalsFeedFlagCache();
    expect(isChatSignalsFeedEnabled()).toBe(false);
  });
});
