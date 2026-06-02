import { describe, expect, it } from 'vitest';

import {
  buildWeeklyDigest,
  type DigestInput,
  digestToMarkdown,
} from '../presentationWeeklyDigestService.js';

const ORG = 'org_test';
const WINDOW_START = '2026-04-30T00:00:00.000Z';
const WINDOW_END = '2026-05-07T00:00:00.000Z';

function baseInput(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    organizationId: ORG,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    decks: [],
    runtimeEvents: [],
    exports: [],
    agentOps: [],
    governanceVerdicts: [],
    ...overrides,
  };
}

describe('presentationWeeklyDigestService', () => {
  it('produces zero totals and no warnings for empty input', () => {
    const report = buildWeeklyDigest(baseInput());

    expect(report.organizationId).toBe(ORG);
    expect(report.windowStart).toBe(WINDOW_START);
    expect(report.windowEnd).toBe(WINDOW_END);
    expect(report.totals).toEqual({
      decks: 0,
      proposalsCreated: 0,
      proposalsApplied: 0,
      proposalsRejected: 0,
      proposalsReverted: 0,
      exportsAttempted: 0,
      exportsBlocked: 0,
      exportsSucceeded: 0,
      governance: { pass: 0, passWithP2: 0, blockedP1: 0, blockedP0: 0, inconclusive: 0 },
    });
    expect(report.topActiveDecks).toEqual([]);
    expect(report.topBlockedDecks).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('counts proposal lifecycle from runtime events when telemetry is present', () => {
    const at = '2026-05-02T10:00:00.000Z';
    const report = buildWeeklyDigest(
      baseInput({
        runtimeEvents: [
          { deckId: 'd1', eventType: 'agent_edit_proposal_created', createdAt: at },
          { deckId: 'd1', eventType: 'agent_edit_proposal_created', createdAt: at },
          { deckId: 'd1', eventType: 'agent_edit_applied', createdAt: at },
          { deckId: 'd1', eventType: 'agent_edit_rejected', createdAt: at },
          { deckId: 'd1', eventType: 'agent_edit_reverted', createdAt: at },
        ],
        agentOps: [
          { deckId: 'd1', status: 'applied', operationType: 'agent_edit', createdAt: at },
          { deckId: 'd1', status: 'applied', operationType: 'agent_edit', createdAt: at },
          { deckId: 'd1', status: 'rejected', operationType: 'agent_edit', createdAt: at },
        ],
      })
    );

    expect(report.totals.proposalsCreated).toBe(2);
    expect(report.totals.proposalsApplied).toBe(1);
    expect(report.totals.proposalsRejected).toBe(1);
    expect(report.totals.proposalsReverted).toBe(1);
    expect(report.warnings).toEqual([]);
  });

  it('falls back to ops status when telemetry is missing for a category', () => {
    const at = '2026-05-02T10:00:00.000Z';
    const report = buildWeeklyDigest(
      baseInput({
        runtimeEvents: [{ deckId: 'd1', eventType: 'agent_edit_proposal_created', createdAt: at }],
        agentOps: [
          { deckId: 'd1', status: 'applied', operationType: 'agent_edit', createdAt: at },
          { deckId: 'd1', status: 'applied', operationType: 'agent_edit', createdAt: at },
          { deckId: 'd1', status: 'rejected', operationType: 'agent_edit', createdAt: at },
          { deckId: 'd1', status: 'reverted', operationType: 'agent_edit', createdAt: at },
        ],
      })
    );

    expect(report.totals.proposalsCreated).toBe(1);
    expect(report.totals.proposalsApplied).toBe(2);
    expect(report.totals.proposalsRejected).toBe(1);
    expect(report.totals.proposalsReverted).toBe(1);
    expect(report.warnings).toEqual([
      'telemetry_fallback_to_ops:applied',
      'telemetry_fallback_to_ops:rejected',
      'telemetry_fallback_to_ops:reverted',
    ]);
  });

  it('orders top active decks by activity descending and limits to five', () => {
    const at = '2026-05-02T10:00:00.000Z';
    const decks = [
      { id: 'd1', title: 'Deck One', updatedAt: at },
      { id: 'd2', title: 'Deck Two', updatedAt: at },
      { id: 'd3', title: 'Deck Three', updatedAt: at },
      { id: 'd4', title: 'Deck Four', updatedAt: at },
      { id: 'd5', title: 'Deck Five', updatedAt: at },
      { id: 'd6', title: 'Deck Six', updatedAt: at },
    ];
    const runtimeEvents = [
      { deckId: 'd1', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd2', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd2', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd3', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd3', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd3', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd4', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd4', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd4', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd4', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd5', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd5', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd5', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd5', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd5', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd6', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd6', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd6', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd6', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd6', eventType: 'agent_edit_applied', createdAt: at },
      { deckId: 'd6', eventType: 'agent_edit_applied', createdAt: at },
    ];
    const report = buildWeeklyDigest(baseInput({ decks, runtimeEvents }));

    expect(report.topActiveDecks).toHaveLength(5);
    expect(report.topActiveDecks.map((d) => d.deckId)).toEqual(['d6', 'd5', 'd4', 'd3', 'd2']);
    expect(report.topActiveDecks[0]).toEqual({
      deckId: 'd6',
      title: 'Deck Six',
      activityCount: 6,
    });
  });

  it('orders top blocked decks with BLOCKED_P0 before BLOCKED_P1 and ignores other verdicts', () => {
    const decks = [
      { id: 'd1', title: 'Deck One', updatedAt: null },
      { id: 'd2', title: 'Deck Two', updatedAt: null },
      { id: 'd3', title: 'Deck Three', updatedAt: null },
      { id: 'd4', title: 'Deck Four', updatedAt: null },
    ];
    const report = buildWeeklyDigest(
      baseInput({
        decks,
        governanceVerdicts: [
          { deckId: 'd1', verdict: 'BLOCKED_P1' },
          { deckId: 'd2', verdict: 'BLOCKED_P0' },
          { deckId: 'd3', verdict: 'PASS' },
          { deckId: 'd4', verdict: 'BLOCKED_P0' },
        ],
      })
    );

    expect(report.topBlockedDecks).toHaveLength(3);
    expect(report.topBlockedDecks.map((d) => d.deckId)).toEqual(['d2', 'd4', 'd1']);
    expect(report.topBlockedDecks[0]).toEqual({
      deckId: 'd2',
      title: 'Deck Two',
      verdict: 'BLOCKED_P0',
    });
  });

  it('renders markdown that includes window dates, organization, and key totals', () => {
    const at = '2026-05-02T10:00:00.000Z';
    const report = buildWeeklyDigest(
      baseInput({
        decks: [{ id: 'd1', title: 'Steering Committee Q2', updatedAt: at }],
        runtimeEvents: [
          { deckId: 'd1', eventType: 'agent_edit_proposal_created', createdAt: at },
          { deckId: 'd1', eventType: 'agent_edit_applied', createdAt: at },
        ],
        exports: [
          { deckId: 'd1', status: 'completed', format: 'pptx', createdAt: at },
          { deckId: 'd1', status: 'blocked', format: 'pptx', createdAt: at },
        ],
        governanceVerdicts: [{ deckId: 'd1', verdict: 'BLOCKED_P0' }],
      })
    );

    const md = digestToMarkdown(report);

    expect(md).toContain('# Presentation Weekly Digest');
    expect(md).toContain(`Organization: \`${ORG}\``);
    expect(md).toContain(`Window start: \`${WINDOW_START}\``);
    expect(md).toContain(`Window end: \`${WINDOW_END}\``);
    expect(md).toContain('| Proposals created | 1 |');
    expect(md).toContain('| Proposals applied | 1 |');
    expect(md).toContain('| Exports attempted | 2 |');
    expect(md).toContain('| Exports succeeded | 1 |');
    expect(md).toContain('| Exports blocked | 1 |');
    expect(md).toContain('| Governance BLOCKED_P0 | 1 |');
    expect(md).toContain('## Top Active Decks');
    expect(md).toContain('## Top Blocked Decks');
    expect(md).toContain('Steering Committee Q2');
    expect(md).toContain('BLOCKED_P0');
  });

  it('counts exports across statuses with case-insensitive matching', () => {
    const at = '2026-05-02T10:00:00.000Z';
    const report = buildWeeklyDigest(
      baseInput({
        exports: [
          { deckId: 'd1', status: 'completed', format: 'pptx', createdAt: at },
          { deckId: 'd1', status: 'COMPLETED', format: 'pdf', createdAt: at },
          { deckId: 'd1', status: 'blocked', format: 'pptx', createdAt: at },
          { deckId: 'd2', status: 'started', format: 'pptx', createdAt: at },
          { deckId: 'd2', status: 'failed', format: 'pdf', createdAt: at },
        ],
      })
    );

    expect(report.totals.exportsAttempted).toBe(5);
    expect(report.totals.exportsSucceeded).toBe(2);
    expect(report.totals.exportsBlocked).toBe(1);
  });

  it('aggregates governance totals across all verdict buckets', () => {
    const report = buildWeeklyDigest(
      baseInput({
        governanceVerdicts: [
          { deckId: 'd1', verdict: 'PASS' },
          { deckId: 'd2', verdict: 'PASS' },
          { deckId: 'd3', verdict: 'PASS_WITH_P2' },
          { deckId: 'd4', verdict: 'BLOCKED_P1' },
          { deckId: 'd5', verdict: 'BLOCKED_P0' },
          { deckId: 'd6', verdict: 'INCONCLUSIVE' },
          { deckId: 'd7', verdict: 'unknown_verdict' },
        ],
      })
    );

    expect(report.totals.governance).toEqual({
      pass: 2,
      passWithP2: 1,
      blockedP1: 1,
      blockedP0: 1,
      inconclusive: 1,
    });
  });
});
