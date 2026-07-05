/**
 * Pinning tests for the SIRI/ADMA report → Conclusion push bridge
 * (src/services/report/conclusionPush.ts, CONCLUSION_LAYER e2e, OXFORD #41):
 * pure payload mapping + the fail-safe push contract (a Conclusions-layer
 * failure never affects report rendering).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: { createConclusion: vi.fn() },
}));

import { Api } from '@/services/api';
import {
  buildAdmaConclusionPayload,
  buildSiriConclusionPayload,
  pushReportConclusion,
} from '@/services/report/conclusionPush';

import type { ADMAConclusionModel } from '@/services/report/admaConclusion';
import type { SIRIConclusionModel } from '@/services/report/siriConclusion';

const siriModel: SIRIConclusionModel = {
  language: 'pl',
  executiveSummary: {
    headline: 'Procesy gotowe, technologia hamuje skalowanie.',
    k1_state: 'Ogólny poziom 2.4/5; najsilniejszy Process, najsłabszy Technology.',
    k2_meaning: 'Bez integracji IT/OT automatyzacja pozostanie punktowa.',
    k3_threeGaps: 'Trzy luki: integracja pionowa, łączność, inteligencja fabryki.',
    k4_whatFirst: 'Najpierw integracja pionowa — odblokowuje pozostałe wymiary.',
    k5_effect: 'Efekt fali 1: spójny przepływ danych w 6 miesięcy.',
    facts: {
      overallScore: 2.4,
      overallLevelTitle: 'Defined',
      strongestName: 'Shop Floor Process',
      strongestScore: 3.2,
      weakestName: 'Vertical Integration',
      weakestScore: 1.4,
      weakestGap: 2,
      assessedDimensions: 8,
      totalDimensions: 8,
    },
    confidence: 'high',
  },
  gapCards: [
    {
      dimensionId: 'VERTICAL_INTEGRATION',
      dimensionName: 'Integracja pionowa',
      buildingBlockName: 'Technology',
      current: 1.4,
      target: 3.4,
      gap: 2,
      currentLevelTitle: 'L1',
      targetLevelTitle: 'L3',
      whatIs: '...',
      whatItMeans: '...',
      whatToDo: '...',
      effect: '...',
    },
  ],
};

const admaModel: ADMAConclusionModel = {
  language: 'pl',
  executiveSummary: {
    headline: 'Fabryka poniżej progu FoF w 5 z 7 transformacji.',
    k1_state: 'Dojrzałość 2.8/5; najsilniejszy filar Technologia, najsłabszy Organizacja.',
    k2_meaning: 'Organizacja nie nadąża za wdrożoną technologią.',
    k3_threeGaps: 'Największe luki: T4, T6, T7.',
    k4_whatFirst: 'Najpierw T4 (organizacja oparta na danych).',
    k5_effect: 'Efekt: decyzje operacyjne z danych w 2 kwartały.',
    confidence: 'medium',
  } as ADMAConclusionModel['executiveSummary'],
  gapCards: [
    {
      dimensionId: 'D-ORG-1',
      dimensionName: 'Kultura danych',
      pillarName: 'Organizacja',
      current: 1.8,
      target: 4,
      gap: 2.2,
      currentLevelTitle: 'L1',
      targetLevelTitle: 'L4',
      whatIs: '...',
      whatItMeans: '...',
      whatToDo: '...',
      effect: '...',
    },
  ],
  fofRoad: {
    benchmark: 4,
    belowFoF: [
      {
        id: 'T4',
        name: 'Data-driven organisation',
        current: 1.8,
        fofBenchmark: 4,
        gapToFoF: 2.2,
        atOrAboveFoF: false,
      },
    ],
    atOrAboveFoF: [],
    all: [],
    summary: '5 z 7 transformacji poniżej FoF.',
  },
};

describe('buildSiriConclusionPayload', () => {
  it('maps the W1 verdict to a candidate payload with gap-card evidence', () => {
    const payload = buildSiriConclusionPayload(siriModel, {
      assessmentId: 'as-1',
      assessmentName: 'SIRI Apator',
      projectId: 'proj-1',
    });
    expect(payload).not.toBeNull();
    expect(payload!.sourceModule).toBe('assessment_siri');
    expect(payload!.status).toBe('candidate');
    expect(payload!.statement).toContain('Procesy gotowe');
    expect(payload!.statement).toContain('integracja pionowa');
    expect(payload!.confidenceLevel).toBe('high');
    expect(payload!.evidenceRefs).toEqual([
      { type: 'siri_dimension', ref: 'VERTICAL_INTEGRATION', excerpt: '1.4→3.4 (gap 2)' },
    ]);
    expect(payload!.sourceRefs[0]).toMatchObject({ type: 'assessment', id: 'as-1' });
    expect(payload!.recommendedNextAction).toContain('integracja pionowa');
  });

  it('returns null without a source assessment id or headline', () => {
    expect(buildSiriConclusionPayload(siriModel, { assessmentId: '' })).toBeNull();
    expect(buildSiriConclusionPayload(undefined, { assessmentId: 'as-1' })).toBeNull();
  });
});

describe('buildAdmaConclusionPayload', () => {
  it('maps the W1 verdict with gap-card + FoF-road evidence', () => {
    const payload = buildAdmaConclusionPayload(admaModel, {
      assessmentId: 'as-2',
      assessmentName: 'ADMA VTS',
    });
    expect(payload).not.toBeNull();
    expect(payload!.sourceModule).toBe('assessment_adma');
    expect(payload!.confidenceLevel).toBe('medium');
    expect(payload!.evidenceRefs).toEqual([
      { type: 'adma_dimension', ref: 'D-ORG-1', excerpt: '1.8→4 (gap 2.2)' },
      { type: 'adma_transformation', ref: 'T4', excerpt: '1.8 vs FoF 4 (gap 2.2)' },
    ]);
    expect(payload!.limits).toContain('FoF benchmark 4');
  });
});

describe('pushReportConclusion (fail-safe contract)', () => {
  it('pushes through Api.createConclusion', async () => {
    vi.mocked(Api.createConclusion).mockResolvedValueOnce({ ok: true });
    const payload = buildSiriConclusionPayload(siriModel, { assessmentId: 'as-1' });
    await expect(pushReportConclusion(payload)).resolves.toBe(true);
    expect(Api.createConclusion).toHaveBeenCalledWith(payload);
  });

  it('never rejects when the API fails — rendering is unaffected', async () => {
    vi.mocked(Api.createConclusion).mockRejectedValueOnce(new Error('network'));
    const payload = buildSiriConclusionPayload(siriModel, { assessmentId: 'as-1' });
    await expect(pushReportConclusion(payload)).resolves.toBe(false);
  });

  it('is a no-op for a null payload', async () => {
    vi.mocked(Api.createConclusion).mockClear();
    await expect(pushReportConclusion(null)).resolves.toBe(false);
    expect(Api.createConclusion).not.toHaveBeenCalled();
  });
});
