/**
 * Pinning tests for the DRD report → Conclusion bridge (CONCLUSION_LAYER e2e,
 * OXFORD #41): the generated report's executive ConclusionOutput is persisted
 * as a Conclusion candidate with engine-exact evidence, and a Conclusions-layer
 * failure never breaks report generation.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildDrdReportConclusion,
  safePersistDrdReportConclusion,
} from '../../../../server/src/services/conclusions/reportConclusionBridge.ts';

import type { DrdReportModel } from '../../../../server/src/services/report/drdReportModel.ts';

function model(overrides: Partial<DrdReportModel> = {}): DrdReportModel {
  return {
    meta: { organizationName: 'Apator', language: 'pl' },
    credibility: {
      assessedAreas: 20,
      totalAreas: 25,
      completionPercent: 80,
      confidenceLabel: 'wysoka',
    },
    overall: {
      actual: 2.1,
      target: 3.4,
      gap: 1.3,
      actualPercent: 42,
      targetPercent: 68,
      maturityStage: 'Connected',
    },
    executiveSummary: {
      paragraphs: ['Dojrzałość cyfrowa 2.1/5 przy celu 3.4.', 'Największa luka: integracja danych.'],
      confidence: 'medium',
      limits: 'Ocena na 80% obszarów; pozostałe wymagają uzupełnienia.',
      evidence: [
        { type: 'drd_axis', ref: '1', excerpt: '2.1→3.4' },
        { type: 'drd_area', ref: '1A', excerpt: '1→3' },
      ],
      aiGenerated: false,
      narrative: 'deterministic',
    },
    dimensions: [],
    areas: [],
    gapCards: [
      {
        areaId: '1A',
        areaName: 'Integracja danych',
        axisName: 'Technologia',
        actual: 1,
        target: 3,
        gap: 2,
        maxLevel: 5,
        narrative: {
          paragraphs: ['Wdrożyć wspólny model danych między MES a ERP.'],
          confidence: 'medium',
          limits: '',
          evidence: [],
          aiGenerated: false,
          narrative: 'deterministic',
        },
      },
    ],
    roadmap: [],
    chapters: [],
    methodology: { axes: [], totalAreas: 25 },
    ...overrides,
  } as DrdReportModel;
}

describe('buildDrdReportConclusion (pure mapping)', () => {
  it('maps the executive summary to a candidate conclusion with engine-exact evidence', () => {
    const candidate = buildDrdReportConclusion(model(), {
      reportId: 'rep-1',
      reportTitle: 'DRD Apator 2026',
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.sourceModule).toBe('assessment_drd');
    expect(candidate!.status).toBe('candidate');
    expect(candidate!.title).toBe('DRD Apator 2026');
    expect(candidate!.statement).toContain('Dojrzałość cyfrowa 2.1/5');
    expect(candidate!.confidenceLevel).toBe('medium');
    expect(candidate!.limits).toContain('80%');
    expect(candidate!.evidenceRefs).toEqual([
      { type: 'drd_axis', ref: '1', excerpt: '2.1→3.4' },
      { type: 'drd_area', ref: '1A', excerpt: '1→3' },
    ]);
    expect(candidate!.recommendedNextAction).toContain('Integracja danych');
    expect(candidate!.sourceRefs[0]).toMatchObject({ type: 'assessment_report', id: 'rep-1' });
  });

  it('returns null when the model has no executive prose', () => {
    const empty = model();
    empty.executiveSummary = { ...empty.executiveSummary, paragraphs: [] };
    expect(buildDrdReportConclusion(empty, { reportId: 'rep-1' })).toBeNull();
  });
});

describe('safePersistDrdReportConclusion (fail-safe contract)', () => {
  it('persists via createConclusion and returns true', async () => {
    const writer = { createConclusion: vi.fn().mockResolvedValue(undefined) };
    const ok = await safePersistDrdReportConclusion(
      {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        model: model(),
        source: { reportId: 'rep-1', reportTitle: 'DRD Apator 2026', projectId: 'proj-9' },
      },
      { writer }
    );
    expect(ok).toBe(true);
    const call = writer.createConclusion.mock.calls[0][0];
    expect(call.sourceModule).toBe('assessment_drd');
    expect(call.projectId).toBe('proj-9');
    expect(call.createdBy).toBe('user-1');
  });

  it('never throws when the Conclusions layer fails — report generation continues', async () => {
    const writer = { createConclusion: vi.fn().mockRejectedValue(new Error('pg down')) };
    const warn = vi.fn();
    const ok = await safePersistDrdReportConclusion(
      {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        model: model(),
        source: { reportId: 'rep-1' },
      },
      { writer, logger: { warn } }
    );
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
