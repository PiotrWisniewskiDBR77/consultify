import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isResultsVNextFlagEnabled } from '@/components/ResultsVNext/resultsVNextFeatureFlags';
import { isIdeaBusinessCaseEnabled } from '../ideaBusinessCaseSchemaFlag';
import { isIdeaDecisionLogEnabled } from '../ideaDecisionLogFlag';
import { isIdeaFinancialCaseEnabled } from '../ideaFinancialCaseFlag';
import {
  isIdeaDetailsInPanelEnabled,
  resetIdeaDetailsInPanelFlagCache,
} from '../ideaDetailsInPanelFlag';
import { isDemoAcceptanceProfileEnabled } from '../demoAcceptanceProfile';

describe('DEMO_ACCEPTANCE profile', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetIdeaDetailsInPanelFlagCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
    resetIdeaDetailsInPanelFlagCache();
  });

  it('is opt-in and public-production fail-closed', () => {
    expect(
      isDemoAcceptanceProfileEnabled({
        env: { VITE_DEMO_ACCEPTANCE: 'true' },
        hostname: 'demo.consultify.ai',
      })
    ).toBe(true);
    expect(
      isDemoAcceptanceProfileEnabled({
        env: { VITE_DEMO_ACCEPTANCE: 'true' },
        hostname: 'www.consultify.ai',
      })
    ).toBe(false);
    expect(isDemoAcceptanceProfileEnabled({ env: {}, hostname: 'demo.consultify.ai' })).toBe(false);
  });

  it('centrally enables hidden Ideas surfaces without query or storage', () => {
    const source = { env: { VITE_DEMO_ACCEPTANCE: 'true' }, hostname: 'demo.consultify.ai' };

    expect(isIdeaDecisionLogEnabled(source)).toBe(true);
    expect(isIdeaFinancialCaseEnabled(source)).toBe(true);
    expect(isIdeaBusinessCaseEnabled(source)).toBe(true);
    expect(isIdeaDetailsInPanelEnabled(source)).toBe(true);
  });

  it('adds a dedicated env switch for Ideas Business Case outside the profile', () => {
    expect(
      isIdeaBusinessCaseEnabled({
        env: { VITE_IDEA_BUSINESS_CASE: 'true' },
        hostname: 'demo.consultify.ai',
      })
    ).toBe(true);
  });

  it('centrally enables all Results VNext domains', () => {
    // DEC-120/A7: the Execution 'changeSignals' assertion this test used to
    // also carry was removed along with the phantom flag — real resolution
    // logic in isExecutionFlagEnabled, but zero live callers
    // (ExecutionChangeSignalsPanel, the only thing it gated, was never
    // mounted anywhere reachable).
    const source = { env: { VITE_DEMO_ACCEPTANCE: 'true' }, hostname: 'demo.consultify.ai' };

    expect(isResultsVNextFlagEnabled('kpiRegistry', source)).toBe(true);
    expect(isResultsVNextFlagEnabled('roiRegistry', source)).toBe(true);
    expect(isResultsVNextFlagEnabled('okrRegistry', source)).toBe(true);
  });
});
