import { afterEach, describe, expect, it } from 'vitest';

import { isExecutionFlagEnabled } from '../executionFeatureFlags';

describe('Execution work analysis rollout flag', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
  });

  it('keeps the new analysis surface off without an explicit opt-in', () => {
    expect(isExecutionFlagEnabled('workAnalysis')).toBe(false);
  });

  it('accepts an explicit operator opt-in and opt-out', () => {
    window.localStorage.setItem('ff.exec_work_analysis', '1');
    expect(isExecutionFlagEnabled('workAnalysis')).toBe(true);

    window.localStorage.setItem('ff.exec_work_analysis', '0');
    expect(isExecutionFlagEnabled('workAnalysis')).toBe(false);
  });
});
