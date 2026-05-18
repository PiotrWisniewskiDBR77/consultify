import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHAT_V10_BLOCKS,
  resetAllChatV10FlagOverrides,
  setChatV10FlagOverride,
} from '../chatV10FeatureFlags';
import {
  buildChatV10FlagSnapshotText,
  CHAT_V10_ROLLOUT_BLOCKS,
  getChatV10RolloutMissingFlagIds,
  getChatV10RolloutSnapshot,
  getChatV10RolloutSummary,
} from '../chatV10Rollout';

describe('chatV10Rollout', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    resetAllChatV10FlagOverrides();
  });

  it('defines rollout metadata for all 8 V10 blocks', () => {
    expect(new Set(CHAT_V10_ROLLOUT_BLOCKS.map((block) => block.block))).toEqual(
      new Set(CHAT_V10_BLOCKS)
    );
  });

  it('references only registered V10 flag ids', () => {
    expect(getChatV10RolloutMissingFlagIds()).toEqual([]);
  });

  it('computes rollout readiness per function as flags are enabled in stages', () => {
    const pickOnboardingActivation = () =>
      getChatV10RolloutSnapshot()
        .find((block) => block.block === 'onboarding')
        ?.functions.find((feature) => feature.id === 'onboarding-activation');

    expect(pickOnboardingActivation()?.readiness).toBe('flagged_off');

    expect(setChatV10FlagOverride('onboard-resume-abandonment', 'on')).toBe(true);
    expect(pickOnboardingActivation()?.readiness).toBe('partial');

    expect(setChatV10FlagOverride('onboard-activation-kpi-dashboard', 'on')).toBe(true);
    expect(pickOnboardingActivation()?.readiness).toBe('ready');
  });

  it('summarizes blocks, functions and default-off coverage', () => {
    const summary = getChatV10RolloutSummary();

    expect(summary.totalBlocks).toBe(8);
    expect(summary.totalFunctions).toBeGreaterThanOrEqual(24);
    expect(summary.defaultOffFlags).toBeLessThanOrEqual(summary.totalFlags);
    expect(summary.defaultOffFlags).toBeGreaterThan(0);
  });

  it('keeps the canonical convergence order across all 8 slices', () => {
    const snapshot = getChatV10RolloutSnapshot();

    expect(snapshot.map((block) => block.block)).toEqual([
      'artifact',
      'agent_runtime',
      'onboarding',
      'reasoning',
      'learning',
      'research',
      'connectors',
      'outcome',
    ]);
  });

  it('builds a human-readable V10 flag snapshot text blob', () => {
    const text = buildChatV10FlagSnapshotText({
      now: new Date('2026-04-21T10:00:00.000Z'),
      label: 'runtime rollout',
    });

    expect(text).toContain('Chat V10 flags snapshot · runtime rollout · 2026-04-21T10:00:00.000Z');
    expect(text).toContain(
      '| Ticket | ID | Block | State | Default | Matches default | Storage key | Test ID |'
    );
    expect(text).toContain('`artifact-unified-model`');
    expect(text).toContain('`ff.artifact_unified_model`');
  });
});
