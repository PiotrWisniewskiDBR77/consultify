import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isAssessmentReportViewEnabled,
  resetAssessmentReportViewFlagCache,
} from '../assessmentReportViewFlag';

describe('assessment report view flag', () => {
  const originalLocation = window.location;
  const setSearch = (search: string) =>
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, search },
    });

  beforeEach(() => {
    setSearch('');
    localStorage.clear();
    resetAssessmentReportViewFlagCache();
  });

  afterEach(() => {
    setSearch('');
    localStorage.clear();
    resetAssessmentReportViewFlagCache();
  });

  // flip po akcepcie właściciela 27.08 (ekran raportu Oceny, dzień 27 po
  // FIX-ach, DEC-146/148): default was OFF, now ON.
  it('defaults ON with no query, localStorage, or env override', () => {
    expect(isAssessmentReportViewEnabled()).toBe(true);
  });

  it('reads query ON (redundant with default, still honoured)', () => {
    setSearch('?ff_assessmentReportView=1');
    expect(isAssessmentReportViewEnabled()).toBe(true);
  });

  it('reads query OFF', () => {
    setSearch('?ff_assessmentReportView=0');
    expect(isAssessmentReportViewEnabled()).toBe(false);
  });

  it('reads local storage ON (redundant with default, still honoured)', () => {
    localStorage.setItem('ff.assessment_report_view', 'on');
    expect(isAssessmentReportViewEnabled()).toBe(true);
  });

  it('local storage "off"/"0"/"false" still disables it despite the ON default', () => {
    for (const value of ['off', '0', 'false']) {
      localStorage.setItem('ff.assessment_report_view', value);
      resetAssessmentReportViewFlagCache();
      expect(isAssessmentReportViewEnabled()).toBe(false);
    }
  });

  it('lets query OFF win over local storage ON', () => {
    localStorage.setItem('ff.assessment_report_view', 'on');
    setSearch('?ff_assessmentReportView=0');
    expect(isAssessmentReportViewEnabled()).toBe(false);
  });

  // `readLocalStorage()` swallows its own error and returns null (unlike
  // the chat-signals flag, which fails closed at the outer try/catch), so a
  // broken local storage read simply falls through the chain to the next
  // source — here, the ON default, since query and env are both absent.
  it('a local storage read error falls through the chain to the ON default', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(isAssessmentReportViewEnabled()).toBe(true);
    spy.mockRestore();
  });

  // A query OFF override is read before local storage, so it still wins
  // even when the (unreached) local storage read would have thrown.
  it('query OFF still wins even when local storage would throw', () => {
    setSearch('?ff_assessmentReportView=0');
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(isAssessmentReportViewEnabled()).toBe(false);
    spy.mockRestore();
  });

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isAssessmentReportViewEnabled()).toBe(true);
    setSearch('?ff_assessmentReportView=0');
    expect(isAssessmentReportViewEnabled()).toBe(true);
    resetAssessmentReportViewFlagCache();
    expect(isAssessmentReportViewEnabled()).toBe(false);
  });

  it('caches until reset (ON -> OFF -> ON via query flips)', () => {
    setSearch('?ff_assessmentReportView=1');
    expect(isAssessmentReportViewEnabled()).toBe(true);
    setSearch('?ff_assessmentReportView=0');
    expect(isAssessmentReportViewEnabled()).toBe(true);
    resetAssessmentReportViewFlagCache();
    expect(isAssessmentReportViewEnabled()).toBe(false);
  });
});
