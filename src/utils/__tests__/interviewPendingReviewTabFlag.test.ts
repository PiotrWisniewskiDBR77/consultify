/**
 * @vitest-environment jsdom
 *
 * M10 D-04 (DP-5) — kill-switch for the ④ "Pending review" interview tab.
 *
 * Coverage:
 *   * Default OFF when no override (client-facing prod stays unchanged).
 *   * localStorage override beats env default.
 *   * URL query override has highest priority.
 *   * `0`/`off`/`false` parse false; `1`/`on`/`true` parse true.
 *   * Invalid raw values fall through to lower priority (and ultimately OFF).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  INTERVIEW_PENDING_REVIEW_TAB_FLAG_KEYS as KEYS,
  isInterviewPendingReviewTabEnabled,
} from '../interviewPendingReviewTabFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('isInterviewPendingReviewTabEnabled (D-04 / DP-5)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to OFF when nothing is set (prod-safe)', () => {
    expect(isInterviewPendingReviewTabEnabled()).toBe(false);
  });

  it('honours localStorage override (1)', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    expect(isInterviewPendingReviewTabEnabled()).toBe(true);
  });

  it('honours localStorage override (off)', () => {
    window.localStorage.setItem(KEYS.localStorage, 'off');
    expect(isInterviewPendingReviewTabEnabled()).toBe(false);
  });

  it('URL query overrides localStorage', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    setLocationSearch(`?${KEYS.query}=0`);
    expect(isInterviewPendingReviewTabEnabled()).toBe(false);
  });

  it('URL query "true" turns it on', () => {
    setLocationSearch(`?${KEYS.query}=true`);
    expect(isInterviewPendingReviewTabEnabled()).toBe(true);
  });

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    setLocationSearch(`?${KEYS.query}=banana`);
    expect(isInterviewPendingReviewTabEnabled()).toBe(true);
  });

  it('invalid localStorage value falls through to default OFF', () => {
    window.localStorage.setItem(KEYS.localStorage, 'banana');
    expect(isInterviewPendingReviewTabEnabled()).toBe(false);
  });

  it('exposes stable flag keys', () => {
    expect(KEYS.localStorage).toBe('ff.interview_pending_review_tab');
    expect(KEYS.query).toBe('ff_interviewPendingReviewTab');
    expect(KEYS.env).toBe('VITE_INTERVIEW_PENDING_REVIEW_TAB');
  });
});
