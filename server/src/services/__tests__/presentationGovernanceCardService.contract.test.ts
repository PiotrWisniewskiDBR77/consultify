import { describe, expect, it } from 'vitest';

import { buildPresentationGovernanceCard } from '../presentationGovernanceCardService.js';

describe('presentationGovernanceCardService — contract for governance-card endpoint', () => {
  it('produces a contract-stable payload shape consumable by frontend and CI', () => {
    const now = new Date('2026-05-08T12:00:00.000Z');
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_contract',
      qualityReport: {
        result: 'PASS_WITH_P2',
        scorecard: { p0: 0, p1: 0, p2: 2, gateCount: 8 },
      } as any,
      confidentialityLevel: 'internal',
      callerRole: 'PROJECT_MANAGER',
      telemetryRollup: {
        windowDays: 7,
        totals: {
          proposalsCreated: 3,
          editsApplied: 2,
          editsRejected: 1,
          exportsBlocked: 0,
          noops: 1,
          total: 7,
        },
        lastActivityAt: '2026-05-07T18:00:00.000Z',
      },
      now,
    });

    expect(card.deckId).toBe('deck_contract');
    expect(card.generatedAt).toBe(now.toISOString());

    expect(card).toHaveProperty('quality.verdict');
    expect(card).toHaveProperty('quality.p0');
    expect(card).toHaveProperty('quality.p1');
    expect(card).toHaveProperty('quality.p2');
    expect(card).toHaveProperty('quality.gateCount');

    expect(card).toHaveProperty('confidentiality.level');
    expect(card.confidentiality.level).toBe('internal');
    expect(card.confidentiality.sharingAllowedForRole).toBe('blocked');

    expect(card).toHaveProperty('telemetry.windowDays');
    expect(card.telemetry.windowDays).toBe(7);
    expect(card.telemetry.proposalsCreated).toBe(3);
    expect(card.telemetry.editsApplied).toBe(2);
    expect(card.telemetry.exportsBlocked).toBe(0);
    expect(card.telemetry.lastActivityAt).toBe('2026-05-07T18:00:00.000Z');

    expect(['PASS', 'PASS_WITH_P2', 'BLOCKED_P0', 'BLOCKED_P1', 'INCONCLUSIVE']).toContain(
      card.overallVerdict
    );
    expect(card.overallVerdict).toBe('PASS_WITH_P2');
  });

  it('overall verdict reflects telemetry exportsBlocked even when quality is PASS', () => {
    const card = buildPresentationGovernanceCard({
      deckId: 'deck_blocked_telemetry',
      qualityReport: {
        result: 'PASS',
        scorecard: { p0: 0, p1: 0, p2: 0, gateCount: 4 },
      } as any,
      confidentialityLevel: 'public',
      callerRole: 'ADMIN',
      telemetryRollup: {
        windowDays: 7,
        totals: {
          proposalsCreated: 0,
          editsApplied: 0,
          editsRejected: 0,
          exportsBlocked: 2,
          noops: 0,
          total: 2,
        },
        lastActivityAt: '2026-05-07T18:00:00.000Z',
      },
    });

    expect(card.quality.verdict).toBe('PASS');
    expect(card.overallVerdict).toBe('BLOCKED_P1');
    expect(card.telemetry.exportsBlocked).toBe(2);
  });
});
