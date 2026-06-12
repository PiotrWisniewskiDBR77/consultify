import { describe, expect, it } from 'vitest';

import { __private__ } from '../../../src/components/Interview/InterviewHub';

const { resolveInterviewTabFromSearchParams, isInterviewTab } = __private__;

const ALL_PERMISSIONS = {
  canViewManaged: true,
  canViewTemplates: true,
  canViewInsights: true,
};

const NO_PERMISSIONS = {
  canViewManaged: false,
  canViewTemplates: false,
  canViewInsights: false,
};

describe('InterviewHub runtime helpers', () => {
  it('resolves requested tab when permissions allow it', () => {
    const params = new URLSearchParams('tab=insights');
    const resolved = resolveInterviewTabFromSearchParams(params, ALL_PERMISSIONS);
    expect(resolved).toBe('insights');
  });

  it('falls back to my_assignments when a restricted managed tab is requested', () => {
    const params = new URLSearchParams('tab=managed');
    const resolved = resolveInterviewTabFromSearchParams(params, NO_PERMISSIONS);
    expect(resolved).toBe('my_assignments');
  });

  it('gates the templates tab behind canViewTemplates', () => {
    const params = new URLSearchParams('tab=templates');
    expect(resolveInterviewTabFromSearchParams(params, NO_PERMISSIONS)).toBe('my_assignments');
    expect(resolveInterviewTabFromSearchParams(params, ALL_PERMISSIONS)).toBe('templates');
  });

  it('gates insight-family tabs behind canViewInsights', () => {
    for (const tab of ['insights', 'pending_review', 'initiatives']) {
      const params = new URLSearchParams(`tab=${tab}`);
      expect(resolveInterviewTabFromSearchParams(params, NO_PERMISSIONS)).toBe('my_assignments');
      expect(resolveInterviewTabFromSearchParams(params, ALL_PERMISSIONS)).toBe(tab);
    }
  });

  it('returns null for an unknown tab so the caller keeps its default', () => {
    const params = new URLSearchParams('tab=not_a_real_tab');
    expect(resolveInterviewTabFromSearchParams(params, ALL_PERMISSIONS)).toBeNull();
  });

  it('recognises every canonical interview tab and rejects others', () => {
    for (const tab of [
      'my_assignments',
      'sessions',
      'templates',
      'insights',
      'initiatives',
      'managed',
      'pending_review',
    ]) {
      expect(isInterviewTab(tab)).toBe(true);
    }
    expect(isInterviewTab('bogus')).toBe(false);
    expect(isInterviewTab('')).toBe(false);
  });
});
