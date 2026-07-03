/**
 * Pinning tests for the tool → Conclusion bridge (CONCLUSION_LAYER e2e, OXFORD #41).
 *
 * The bridge is the ONE generic helper wired into the shared tool flow
 * (ToolController.updateToolSession / approveTool). These tests pin:
 *  - W2 extraction (verdict + executive summary → statement, candidate status)
 *  - evidence refs from ACCEPTED elements only (proposal gate respected)
 *  - confidence derived from the evidence gate
 *  - null extraction for empty / rejected sessions (nothing persisted)
 *  - fail-safe: a Conclusion write failure never propagates
 */

import { describe, expect, it, vi } from 'vitest';

import {
  collectAcceptedEvidenceRefs,
  deriveToolConfidence,
  extractToolConclusion,
  persistToolSessionConclusion,
  safePersistToolSessionConclusion,
} from '../../../../server/src/services/conclusions/toolConclusionBridge.ts';

const swotAnswers = {
  context: { goal: 'Wejść na rynek DACH', scope: 'BU przemysł' },
  items: [
    { id: 'item-1', text: 'Silna baza referencji w PL', proposalStatus: 'accepted' },
    { id: 'item-2', text: 'Brak zespołu DE', proposalStatus: 'accepted' },
    { id: 'item-3', text: 'Halucynacja modelu', proposalStatus: 'rejected' },
    { id: 'item-4', text: 'Propozycja w toku', proposalStatus: 'ai-proposed' },
  ],
  signals: [{ id: 'sig-1', content: 'Klient X zapytał o ofertę DE w Q2', state: 'accepted' }],
  recommendedMoves: [
    {
      id: 'move-1',
      title: 'Partner lokalny w DACH',
      firstStep: 'Zmapować 5 kandydatów na partnera do końca miesiąca',
      proposalStatus: 'accepted',
    },
  ],
  summary: {
    proposalStatus: 'accepted',
    verdict: 'Wejście do DACH przez partnera, nie przez własny zespół.',
    executiveSummary: 'Analiza wskazuje partnera jako jedyną ścieżkę o akceptowalnym ryzyku.',
    appliedConclusions: ['Nie budować własnego zespołu DE w 2026.'],
    tradeoffs: [
      { chosen: 'model partnerski', rejected: 'własny zespół DE', why: 'koszt i czas wejścia' },
    ],
  },
};

describe('extractToolConclusion (pure W2 extraction)', () => {
  it('extracts a candidate conclusion from a session with an accepted W2 summary', () => {
    const candidate = extractToolConclusion({
      sessionId: 'ts-1',
      toolType: 'dynamic-swot',
      name: 'SWOT DACH',
      answers: swotAnswers,
      confidenceAvg: 4,
    });

    expect(candidate).not.toBeNull();
    expect(candidate!.status).toBe('candidate');
    expect(candidate!.title).toBe('SWOT DACH');
    expect(candidate!.statement).toContain('Wejście do DACH przez partnera');
    expect(candidate!.statement).toContain('akceptowalnym ryzyku');
    expect(candidate!.sourceRefs).toEqual([
      {
        type: 'tool_session',
        id: 'ts-1',
        title: 'SWOT DACH',
        url: '/my-work?tab=ideas&sessionId=ts-1',
      },
    ]);
    // accepted: item-1, item-2, sig-1, move-1 — rejected/ai-proposed excluded
    expect(candidate!.evidenceRefs.map((r) => r.ref)).toEqual([
      'item-1',
      'item-2',
      'sig-1',
      'move-1',
    ]);
    expect(candidate!.confidenceLevel).toBe('high');
    expect(candidate!.limits).toContain('model partnerski');
    expect(candidate!.recommendedNextAction).toBe(
      'Zmapować 5 kandydatów na partnera do końca miesiąca'
    );
  });

  it('returns null when there is no summary or no statement', () => {
    expect(
      extractToolConclusion({ sessionId: 'ts-2', answers: { items: [] }, confidenceAvg: 3 })
    ).toBeNull();
    expect(
      extractToolConclusion({
        sessionId: 'ts-2',
        answers: { summary: { keyInsights: [] } },
        confidenceAvg: 3,
      })
    ).toBeNull();
    expect(extractToolConclusion({ sessionId: 'ts-2', answers: null })).toBeNull();
  });

  it('never persists a rejected or rethinking conclusion proposal', () => {
    for (const proposalStatus of ['rejected', 'rethinking']) {
      expect(
        extractToolConclusion({
          sessionId: 'ts-3',
          answers: { summary: { ...swotAnswers.summary, proposalStatus } },
        })
      ).toBeNull();
    }
  });

  it('falls back to executiveSummary and applied conclusions when W2 verdict is absent', () => {
    const candidate = extractToolConclusion({
      sessionId: 'ts-4',
      toolType: 'market-forces',
      answers: {
        summary: {
          executiveSummary: 'Rywalizacja rośnie; marża pod presją.',
          appliedConclusions: ['Bronić marży w segmencie premium.'],
        },
      },
      confidenceAvg: 2,
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.statement).toBe('Rywalizacja rośnie; marża pod presją.');
    expect(candidate!.recommendedNextAction).toBe('Bronić marży w segmencie premium.');
    expect(candidate!.title).toBe('market-forces conclusion');
  });
});

describe('collectAcceptedEvidenceRefs (evidence gate)', () => {
  it('collects operational sections and quadrant maps one level deep', () => {
    const refs = collectAcceptedEvidenceRefs({
      sections: {
        countermeasures: [
          { id: 'cm-1', title: 'Standard pracy', proposalStatus: 'accepted' },
          { id: 'cm-2', title: 'Odrzucone', proposalStatus: 'rejected' },
        ],
      },
      quadrants: {
        marketPenetration: [{ id: 'opt-1', title: 'Upsell obecnych klientów' }],
      },
    });
    expect(refs).toEqual([
      { type: 'tool_quadrant_marketPenetration', ref: 'opt-1', excerpt: 'Upsell obecnych klientów' },
      { type: 'tool_section_countermeasures', ref: 'cm-1', excerpt: 'Standard pracy' },
    ]);
  });

  it('treats elements without any proposal marker as accepted (user-authored/engine output)', () => {
    const refs = collectAcceptedEvidenceRefs({
      risks: [{ id: 'r-1', title: 'Ryzyko FX' }],
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ type: 'tool_risks', ref: 'r-1' });
  });
});

describe('deriveToolConfidence (evidence gate → confidence)', () => {
  it('maps the gate deterministically', () => {
    expect(deriveToolConfidence(0, 5)).toBe('insufficient');
    expect(deriveToolConfidence(3, 4)).toBe('high');
    expect(deriveToolConfidence(3, 2)).toBe('medium');
    expect(deriveToolConfidence(1, 3)).toBe('medium');
    expect(deriveToolConfidence(1, 1)).toBe('low');
  });
});

describe('persistToolSessionConclusion', () => {
  const baseParams = {
    organizationId: 'org-1',
    projectId: 'proj-1',
    actorUserId: 'user-1',
    sessionId: 'ts-1',
    toolType: 'dynamic-swot',
    name: 'SWOT DACH',
    answers: swotAnswers,
    confidenceAvg: 4,
  };

  it('writes sourceModule=tool, status=candidate through createConclusion', async () => {
    const writer = { createConclusion: vi.fn().mockResolvedValue(undefined) };
    const persisted = await persistToolSessionConclusion(baseParams, writer);
    expect(persisted).toBe(true);
    expect(writer.createConclusion).toHaveBeenCalledTimes(1);
    const call = writer.createConclusion.mock.calls[0][0];
    expect(call.sourceModule).toBe('tool');
    expect(call.status).toBe('candidate');
    expect(call.organizationId).toBe('org-1');
    expect(call.projectId).toBe('proj-1');
    expect(call.createdBy).toBe('user-1');
    expect(call.evidenceRefs).toHaveLength(4);
  });

  it('does not write when the session has no conclusion yet', async () => {
    const writer = { createConclusion: vi.fn() };
    const persisted = await persistToolSessionConclusion(
      { ...baseParams, answers: { items: [] } },
      writer
    );
    expect(persisted).toBe(false);
    expect(writer.createConclusion).not.toHaveBeenCalled();
  });
});

describe('safePersistToolSessionConclusion (fail-safe contract)', () => {
  it('swallows Conclusion write failures — tool output generation is never broken', async () => {
    const writer = {
      createConclusion: vi.fn().mockRejectedValue(new Error('db down')),
    };
    const warn = vi.fn();
    const result = await safePersistToolSessionConclusion(
      {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        sessionId: 'ts-1',
        toolType: 'dynamic-swot',
        name: 'SWOT DACH',
        answers: swotAnswers,
        confidenceAvg: 4,
      },
      { writer, logger: { warn } }
    );
    expect(result).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({ sessionId: 'ts-1', error: 'db down' });
  });
});
