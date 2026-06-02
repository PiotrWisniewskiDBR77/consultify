import { describe, expect, it } from 'vitest';

import { __private__ } from '../../../src/components/Interview/InterviewHub';

const { resolveInterviewTabFromSearchParams, readInterviewCoreRuntimeHandoff } = __private__;

describe('InterviewHub runtime helpers', () => {
  it('resolves requested tab when permissions allow it', () => {
    const params = new URLSearchParams('tab=insights');
    const resolved = resolveInterviewTabFromSearchParams(params, {
      canViewManaged: true,
      canViewTemplates: true,
      canViewInsights: true,
    });
    expect(resolved).toBe('insights');
  });

  it('falls back to my_assignments when restricted tab is requested', () => {
    const params = new URLSearchParams('tab=managed');
    const resolved = resolveInterviewTabFromSearchParams(params, {
      canViewManaged: false,
      canViewTemplates: false,
      canViewInsights: false,
    });
    expect(resolved).toBe('my_assignments');
  });

  it('builds a handoff trace from Teresa query params', () => {
    const params = new URLSearchParams('source=teresa&tab=my_assignments');
    const trace = readInterviewCoreRuntimeHandoff('/interview', params);
    expect(trace).toEqual(
      expect.objectContaining({
        target: 'interview',
        source: 'teresa',
        tab: 'my_assignments',
        pathname: '/interview',
      })
    );
  });
});
