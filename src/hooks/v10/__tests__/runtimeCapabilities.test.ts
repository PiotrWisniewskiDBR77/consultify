import { beforeEach, describe, expect, it } from 'vitest';

import {
  resetAllChatV10FlagOverrides,
  setChatV10FlagOverride,
} from '../../../utils/chatV10FeatureFlags';
import { buildAgentRuntimeCapabilities } from '../useAgentSchedules';
import { buildConnectorsRuntimeCapabilities } from '../useConnectorsRuntime';
import { buildOnboardingRuntimeCapabilities } from '../useOnboardingRuntime';
import { buildOutcomeRuntimeCapabilities } from '../useOutcomeRuntime';
import { buildResearchRuntimeCapabilities } from '../useResearchRuntime';

describe('V10 runtime capability builders', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    resetAllChatV10FlagOverrides();
  });

  it('keeps onboarding runtime default-off until relevant flags are enabled', () => {
    expect(buildOnboardingRuntimeCapabilities()).toMatchObject({
      enabled: false,
      capturePersona: false,
      saveSnapshot: false,
      resume: false,
      recordEvent: false,
      kpiSummary: false,
    });

    setChatV10FlagOverride('onboard-persona-capture', 'on');
    setChatV10FlagOverride('onboard-resume-abandonment', 'on');
    setChatV10FlagOverride('onboard-activation-kpi-dashboard', 'on');

    expect(buildOnboardingRuntimeCapabilities()).toMatchObject({
      enabled: true,
      capturePersona: true,
      saveSnapshot: true,
      resume: true,
      recordEvent: true,
      kpiSummary: true,
    });
  });

  it('stages research runtime capabilities between mission and watch pipelines', () => {
    setChatV10FlagOverride('pipelines-research-mission', 'on');

    expect(buildResearchRuntimeCapabilities()).toMatchObject({
      enabled: true,
      planMission: true,
      startMission: true,
      summary: true,
      delegatePlan: true,
      watchMission: false,
    });

    setChatV10FlagOverride('pipelines-research-watch', 'on');
    expect(buildResearchRuntimeCapabilities().watchMission).toBe(true);
  });

  it('gates connectors runtime capabilities per function', () => {
    setChatV10FlagOverride('connectors-registry', 'on');
    setChatV10FlagOverride('pipelines-connectors-ingest', 'on');
    setChatV10FlagOverride('connectors-federated-search', 'on');
    setChatV10FlagOverride('connectors-token-refresh-revocation', 'on');
    setChatV10FlagOverride('connectors-user-disconnect', 'on');

    expect(buildConnectorsRuntimeCapabilities()).toMatchObject({
      enabled: true,
      catalog: true,
      sessions: true,
      fetch: true,
      search: true,
      readSource: true,
      connect: true,
      completeAuth: true,
      refreshTokens: true,
      disconnect: true,
    });
  });

  it('gates outcome runtime capabilities between signal, acceptance and pipeline actions', () => {
    setChatV10FlagOverride('outcome-signal', 'on');
    setChatV10FlagOverride('outcome-kpi-accept-outcome', 'on');
    setChatV10FlagOverride('pipelines-outcome-rollup', 'on');

    expect(buildOutcomeRuntimeCapabilities()).toMatchObject({
      enabled: true,
      previewAcceptance: true,
      ingestSignal: true,
      resolveAcceptance: true,
      linkAnalysis: true,
    });
  });

  it('exposes agent runtime capabilities through the shared builder', () => {
    expect(buildAgentRuntimeCapabilities()).toMatchObject({
      enabled: false,
      schedules: false,
      preferences: false,
      plan: false,
      preview: false,
      create: false,
      trigger: false,
      timeline: false,
    });

    setChatV10FlagOverride('agent-schedule-registry', 'on');
    expect(buildAgentRuntimeCapabilities()).toMatchObject({
      enabled: true,
      schedules: true,
      preferences: true,
      trigger: true,
      timeline: true,
    });
  });
});
