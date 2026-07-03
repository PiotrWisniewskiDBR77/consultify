/**
 * SIRI/ADMA report conclusion → Conclusions layer push (CONCLUSION_LAYER e2e
 * wiring, OXFORD #41).
 *
 * The SIRI and ADMA report templates build deterministic W1 conclusion models
 * (`siriConclusion.ts` / `admaConclusion.ts`: verdict headline, K1→K4 blocks,
 * top-3 gap cards) but rendered them and threw them away — the Conclusions
 * layer never saw them. This module maps those models to the generic
 * `POST /api/conclusions` ingest payload and pushes fail-safe: a push failure
 * must never break report rendering.
 *
 * PURE builders (`buildSiriConclusionPayload` / `buildAdmaConclusionPayload`)
 * are exported separately so tests can pin the mapping without network.
 */

import { Api } from '../api';

import type { ADMAConclusionModel } from './admaConclusion';
import type { SIRIConclusionModel } from './siriConclusion';

export interface ReportConclusionSource {
  /** Assessment (or report) id the conclusion is derived from. */
  assessmentId: string;
  assessmentName?: string | null;
  projectId?: string | null;
}

export interface ReportConclusionPayload {
  title: string;
  statement: string;
  sourceModule: string;
  sourceRefs: Array<{ type: string; id: string; title?: string | null; url?: string | null }>;
  confidenceLevel: string;
  limits: string;
  evidenceRefs: Array<{ type: string; ref: string; excerpt?: string | null }>;
  recommendedNextAction: string | null;
  status: 'candidate';
  projectId?: string | null;
  contextSummary: string;
}

const gapCardEvidence = (
  cards: Array<{ dimensionId: string; current: number; target: number; gap: number }>,
  refType: string
) =>
  cards.map((card) => ({
    type: refType,
    ref: card.dimensionId,
    excerpt: `${card.current}→${card.target} (gap ${card.gap})`,
  }));

/** PURE: SIRI W1 conclusion model → ingest payload (null when nothing to persist). */
export function buildSiriConclusionPayload(
  model: SIRIConclusionModel | null | undefined,
  source: ReportConclusionSource
): ReportConclusionPayload | null {
  const exec = model?.executiveSummary;
  if (!exec?.headline || !source.assessmentId) return null;

  const statement = [exec.headline, exec.k1_state, exec.k2_meaning, exec.k4_whatFirst]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  return {
    title: `SIRI — ${source.assessmentName || exec.headline}`.slice(0, 180),
    statement,
    sourceModule: 'assessment_siri',
    sourceRefs: [
      {
        type: 'assessment',
        id: source.assessmentId,
        title: source.assessmentName || null,
        url: `/assessment?assessmentId=${encodeURIComponent(source.assessmentId)}`,
      },
    ],
    confidenceLevel: exec.confidence,
    limits: `Deterministic SIRI conclusion; ${exec.facts.assessedDimensions}/${exec.facts.totalDimensions} dimensions assessed. Numbers engine-exact; validate targets with the sponsor.`,
    evidenceRefs: gapCardEvidence(model?.gapCards || [], 'siri_dimension'),
    recommendedNextAction: exec.k4_whatFirst || null,
    status: 'candidate',
    projectId: source.projectId ?? null,
    contextSummary: exec.k3_threeGaps || exec.k1_state || '',
  };
}

/** PURE: ADMA W1 conclusion model → ingest payload (null when nothing to persist). */
export function buildAdmaConclusionPayload(
  model: ADMAConclusionModel | null | undefined,
  source: ReportConclusionSource
): ReportConclusionPayload | null {
  const exec = model?.executiveSummary;
  if (!exec?.headline || !source.assessmentId) return null;

  const statement = [exec.headline, exec.k1_state, exec.k2_meaning, exec.k4_whatFirst]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  const fofEvidence = (model?.fofRoad?.belowFoF || []).slice(0, 7).map((item) => ({
    type: 'adma_transformation',
    ref: item.id,
    excerpt: `${item.current ?? '?'} vs FoF ${item.fofBenchmark} (gap ${item.gapToFoF ?? '?'})`,
  }));

  return {
    title: `ADMA — ${source.assessmentName || exec.headline}`.slice(0, 180),
    statement,
    sourceModule: 'assessment_adma',
    sourceRefs: [
      {
        type: 'assessment',
        id: source.assessmentId,
        title: source.assessmentName || null,
        url: `/assessment?assessmentId=${encodeURIComponent(source.assessmentId)}`,
      },
    ],
    confidenceLevel: exec.confidence,
    limits: `Deterministic ADMA conclusion vs FoF benchmark ${model?.fofRoad?.benchmark ?? 4}. Numbers engine-exact; validate targets with the sponsor.`,
    evidenceRefs: [
      ...gapCardEvidence(model?.gapCards || [], 'adma_dimension'),
      ...fofEvidence,
    ],
    recommendedNextAction: exec.k4_whatFirst || null,
    status: 'candidate',
    projectId: source.projectId ?? null,
    contextSummary: exec.k3_threeGaps || exec.k1_state || '',
  };
}

/**
 * Fail-safe push: never throws, never rejects — report rendering must not be
 * affected by a Conclusions-layer failure. Returns true when persisted.
 */
export async function pushReportConclusion(
  payload: ReportConclusionPayload | null
): Promise<boolean> {
  if (!payload) return false;
  try {
    await Api.createConclusion(payload);
    return true;
  } catch {
    return false;
  }
}
