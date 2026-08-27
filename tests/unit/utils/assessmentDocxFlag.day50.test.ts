import { beforeEach, describe, expect, it } from 'vitest';

import {
  ASSESSMENT_DOCX_FLAG_KEYS,
  isAssessmentDocxEnabled,
  resolveAssessmentDocxFlag,
} from '../../../src/utils/assessmentDocxFlag';

describe('Day 50 Assessment DOCX reveal flag', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('defaults OFF', () => {
    expect(isAssessmentDocxEnabled()).toBe(false);
  });

  it('uses query before localStorage', () => {
    expect(resolveAssessmentDocxFlag(true, false, false)).toBe(true);
    expect(resolveAssessmentDocxFlag(false, true, true)).toBe(false);
  });

  it('uses localStorage when query is absent', () => {
    localStorage.setItem(ASSESSMENT_DOCX_FLAG_KEYS.localStorage, 'on');
    expect(isAssessmentDocxEnabled()).toBe(true);
  });
});
