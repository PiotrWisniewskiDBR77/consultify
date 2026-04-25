/**
 * Chat V9 / AG1 v1.8 — unit tests for the pure "should I offer
 * a description expansion toggle?" heuristic.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DESCRIPTION_EXPAND_THRESHOLD,
  shouldOfferChatV9FlagExpand,
} from '../shouldOfferChatV9FlagExpand';

describe('shouldOfferChatV9FlagExpand', () => {
  it('returns false for non-string inputs', () => {
    expect(shouldOfferChatV9FlagExpand({ description: null })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: undefined })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: 42 })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: {} })).toBe(false);
  });

  it('returns false for empty / whitespace-only strings', () => {
    expect(shouldOfferChatV9FlagExpand({ description: '' })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: '   ' })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: '\n\n\t\t' })).toBe(false);
  });

  it('returns false for strings shorter than the threshold', () => {
    const below = 'A'.repeat(DEFAULT_DESCRIPTION_EXPAND_THRESHOLD - 1);
    expect(shouldOfferChatV9FlagExpand({ description: below })).toBe(false);
  });

  it('returns true exactly at the threshold (inclusive boundary)', () => {
    const atThreshold = 'A'.repeat(DEFAULT_DESCRIPTION_EXPAND_THRESHOLD);
    expect(shouldOfferChatV9FlagExpand({ description: atThreshold })).toBe(true);
  });

  it('returns true for strings above the threshold', () => {
    const above = 'A'.repeat(DEFAULT_DESCRIPTION_EXPAND_THRESHOLD + 50);
    expect(shouldOfferChatV9FlagExpand({ description: above })).toBe(true);
  });

  it('ignores leading / trailing whitespace when counting length', () => {
    const core = 'A'.repeat(DEFAULT_DESCRIPTION_EXPAND_THRESHOLD - 1);
    const padded = `   ${core}   `;
    expect(shouldOfferChatV9FlagExpand({ description: padded })).toBe(false);
    const coreAtThreshold = 'A'.repeat(DEFAULT_DESCRIPTION_EXPAND_THRESHOLD);
    expect(shouldOfferChatV9FlagExpand({ description: `\n\n${coreAtThreshold}\n\n` })).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(shouldOfferChatV9FlagExpand({ description: 'short', threshold: 5 })).toBe(true);
    expect(shouldOfferChatV9FlagExpand({ description: 'short', threshold: 6 })).toBe(false);
  });

  it('returns false when threshold is non-finite / zero / negative', () => {
    const text = 'A'.repeat(500);
    expect(shouldOfferChatV9FlagExpand({ description: text, threshold: 0 })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: text, threshold: -10 })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: text, threshold: NaN })).toBe(false);
    expect(shouldOfferChatV9FlagExpand({ description: text, threshold: Infinity })).toBe(false);
  });
});
