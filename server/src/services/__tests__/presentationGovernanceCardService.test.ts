import { describe, expect, it } from 'vitest';

import { buildPresentationGovernanceCard } from '../presentationGovernanceCardService.js';

const NOW = new Date('2026-05-10T12:00:00.000Z');

function telemetry(overrides: Partial<{
  windowDays: number;
  proposalsCreated: number;
  editsApplied: number;
  editsRejected: number;
  exportsBlocked: number;
  noops: number;
  total: number;
  lastActivityAt: string | null;
}> = {}) {
  const {
    windowDays = 7,
    proposalsCreated = 0,
    editsApplied = 0,
    editsRejected = 0,
    exportsBlocked = 0,
    noops = 0,
    total = proposalsCreated + editsApplied + editsRejected + exportsBlocked + noops,
    lastActivityAt = null,
  } = overrides;
  return {
    windowDays,
    totals: { proposalsCreated, editsApplied, editsRejected, exportsBlocked, noops, total },
    lastActivityAt,
  };
}

describe('presentationGovernanceCardService', () => {
  it('verdict is PASS when quality is PASS and no exports blocked', () => {
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_pass',
      qualityReport: {
        result: 'PASS',
        scorecard: { p0: 0, p1: 0, p2: 0, gateCount: 5 },
        gates: [],
      },
      confidentialityLevel: 'internal',
      telemetryRollup: telemetry({ proposalsCreated: 2, editsApplied: 1 }),
      now: NOW,
    });

    expect(card.deckId).toBe('deck_pass');
    expect(card.generatedAt).toBe(NOW.toISOString());
    expect(card.quality.verdict).toBe('PASS');
    expect(card.quality.p0).toBe(0);
    expect(card.quality.p1).toBe(0);
    expect(card.quality.p2).toBe(0);
    expect(card.quality.gateCount).toBe(5);
    expect(card.telemetry.exportsBlocked).toBe(0);
    expect(card.overallVerdict).toBe('PASS');
  });

  it('overall verdict downgrades to BLOCKED_P1 when telemetry shows exports blocked even if quality is PASS', () => {
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_block_export',
      qualityReport: {
        result: 'PASS',
        scorecard: { p0: 0, p1: 0, p2: 0, gateCount: 4 },
        gates: [],
      },
      confidentialityLevel: 'internal',
      telemetryRollup: telemetry({ exportsBlocked: 3, lastActivityAt: NOW.toISOString() }),
      now: NOW,
    });

    expect(card.quality.verdict).toBe('PASS');
    expect(card.telemetry.exportsBlocked).toBe(3);
    expect(card.overallVerdict).toBe('BLOCKED_P1');
  });

  it('computes scorecard counters from gates when scorecard summary is missing', () => {
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_compute',
      qualityReport: {
        result: 'PASS_WITH_P2',
        gates: [
          { priority: 'P1', result: 'BLOCKED' },
          { priority: 'P2', result: 'WARN' },
          { priority: 'P2', result: 'WARN' },
          { priority: 'P2', result: 'PASS' },
        ],
      },
      confidentialityLevel: 'public',
      telemetryRollup: null,
      now: NOW,
    });

    expect(card.quality.p0).toBe(0);
    expect(card.quality.p1).toBe(1);
    expect(card.quality.p2).toBe(2);
    expect(card.quality.gateCount).toBe(4);
    expect(card.quality.verdict).toBe('PASS_WITH_P2');
  });

  it('forces BLOCKED_P0 when any P0 BLOCKED gate is present', () => {
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_p0',
      qualityReport: {
        // Upstream report incorrectly thinks this passes; aggregator must override.
        result: 'PASS',
        gates: [
          { priority: 'P0', result: 'BLOCKED' },
          { priority: 'P2', result: 'WARN' },
        ],
      },
      confidentialityLevel: 'internal',
      telemetryRollup: telemetry(),
      now: NOW,
    });

    expect(card.quality.p0).toBe(1);
    expect(card.quality.verdict).toBe('BLOCKED_P0');
    expect(card.overallVerdict).toBe('BLOCKED_P0');
  });

  it('marks confidentiality.sharingAllowedForRole=blocked for PROJECT_MANAGER on internal deck', () => {
    const blocked = buildPresentationGovernanceCard({
      deckId: 'deck_pm_internal',
      qualityReport: { result: 'PASS', scorecard: { p0: 0, p1: 0, p2: 0, gateCount: 1 } },
      confidentialityLevel: 'internal',
      callerRole: 'project_manager',
      telemetryRollup: telemetry(),
      now: NOW,
    });
    expect(blocked.confidentiality.level).toBe('internal');
    expect(blocked.confidentiality.sharingAllowedForRole).toBe('blocked');

    const allowed = buildPresentationGovernanceCard({
      deckId: 'deck_owner_internal',
      qualityReport: { result: 'PASS', scorecard: { p0: 0, p1: 0, p2: 0, gateCount: 1 } },
      confidentialityLevel: 'internal',
      callerRole: 'owner',
      telemetryRollup: telemetry(),
      now: NOW,
    });
    expect(allowed.confidentiality.sharingAllowedForRole).toBe('allowed');

    const noRole = buildPresentationGovernanceCard({
      deckId: 'deck_no_role',
      qualityReport: { result: 'PASS', scorecard: { p0: 0, p1: 0, p2: 0, gateCount: 1 } },
      confidentialityLevel: 'internal',
      telemetryRollup: telemetry(),
      now: NOW,
    });
    expect(noRole.confidentiality.sharingAllowedForRole).toBeUndefined();
  });

  it('returns INCONCLUSIVE for missing quality report', () => {
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_no_report',
      qualityReport: null,
      telemetryRollup: null,
      now: NOW,
    });

    expect(card.quality.verdict).toBe('INCONCLUSIVE');
    expect(card.quality.p0).toBe(0);
    expect(card.quality.p1).toBe(0);
    expect(card.quality.p2).toBe(0);
    expect(card.quality.gateCount).toBe(0);
    expect(card.confidentiality.level).toBe('internal');
    expect(card.telemetry.windowDays).toBe(0);
    expect(card.telemetry.lastActivityAt).toBeNull();
    expect(card.overallVerdict).toBe('INCONCLUSIVE');
  });
});
