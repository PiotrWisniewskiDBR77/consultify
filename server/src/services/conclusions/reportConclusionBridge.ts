/**
 * Assessment report → Conclusion bridge (CONCLUSION_LAYER e2e wiring, OXFORD #41).
 *
 * The DRD client report already produces a full ConclusionOutput-shaped
 * executive summary (verdict paragraphs + confidence + limits + engine-exact
 * evidence refs — see `server/src/services/report/drdConclusionContract.ts`),
 * but until this bridge it was rendered into HTML and thrown away — the
 * Conclusions layer never saw it. This module:
 *   - `buildDrdReportConclusion` — PURE: maps a generated DrdReportModel to a
 *     Conclusion candidate payload (numbers stay engine-exact; evidence refs
 *     carried through 1:1).
 *   - `safePersistDrdReportConclusion` — fail-safe persist via
 *     `conclusionService.createConclusion`; a Conclusion write failure MUST NOT
 *     break report generation.
 *
 * SIRI/ADMA conclusion models live client-side (src/services/report/
 * siriConclusion.ts / admaConclusion.ts); they push through the analogous
 * client bridge (src/services/report/conclusionPush.ts → POST /api/conclusions).
 */

import { conclusionService } from './ConclusionService.js';

import type { DrdReportModel } from '../report/drdReportModel.js';
import type { ArtifactRef, CreateConclusionParams, EvidenceRef } from './ConclusionService.js';

export interface DrdReportConclusionSource {
  reportId: string;
  reportTitle?: string | null;
  projectId?: string | null;
}

export interface DrdReportConclusionCandidate {
  title: string;
  statement: string;
  sourceModule: 'assessment_drd';
  sourceRefs: ArtifactRef[];
  confidenceLevel: string;
  limits: string;
  evidenceRefs: EvidenceRef[];
  recommendedNextAction: string | null;
  status: 'candidate';
  contextSummary: string;
}

/**
 * PURE mapping of a generated DRD report model to a Conclusion candidate.
 * Returns null when the model has no executive-summary prose (nothing to
 * persist as a conclusion).
 */
export function buildDrdReportConclusion(
  model: DrdReportModel,
  source: DrdReportConclusionSource
): DrdReportConclusionCandidate | null {
  const summary = model?.executiveSummary;
  const paragraphs = Array.isArray(summary?.paragraphs)
    ? summary.paragraphs.filter((p) => typeof p === 'string' && p.trim().length > 0)
    : [];
  if (paragraphs.length === 0) return null;

  const statement = paragraphs.join('\n\n').slice(0, 4000);
  const evidenceRefs: EvidenceRef[] = (summary.evidence || []).map((ref) => ({
    type: ref.type,
    ref: ref.ref,
    excerpt: ref.excerpt ?? null,
  }));

  // First gap card = highest-priority gap → its "what to do" narrative is the
  // recommended next action.
  const firstGap = model.gapCards?.[0];
  const recommendedNextAction = firstGap
    ? `${firstGap.areaName}: ${firstGap.narrative.paragraphs?.[0] || ''}`.trim().slice(0, 500) ||
      null
    : null;

  const orgName = model.meta?.organizationName || 'Organization';
  const title = (
    source.reportTitle || `DRD Report — ${orgName}`
  ).slice(0, 180);

  return {
    title,
    statement,
    sourceModule: 'assessment_drd',
    sourceRefs: [
      {
        type: 'assessment_report',
        id: source.reportId,
        title: source.reportTitle || null,
        url: `/assessment?reportId=${encodeURIComponent(source.reportId)}`,
      },
    ],
    confidenceLevel: summary.confidence || 'insufficient',
    limits: summary.limits || 'No limits provided.',
    evidenceRefs,
    recommendedNextAction,
    status: 'candidate',
    contextSummary: `${orgName} — overall ${model.overall?.actual ?? '?'}→${model.overall?.target ?? '?'} (${model.credibility?.completionPercent ?? 0}% assessed, narrative: ${summary.narrative}).`,
  };
}

interface ConclusionWriter {
  createConclusion(params: CreateConclusionParams): Promise<void>;
}

/**
 * Fail-safe persist of the DRD report's executive conclusion. Never throws —
 * report generation always completes even when the Conclusions layer is down.
 */
export async function safePersistDrdReportConclusion(
  params: {
    organizationId: string;
    actorUserId: string;
    model: DrdReportModel;
    source: DrdReportConclusionSource;
  },
  options?: {
    writer?: ConclusionWriter;
    logger?: { warn: (msg: string, meta?: unknown) => void };
  }
): Promise<boolean> {
  try {
    const candidate = buildDrdReportConclusion(params.model, params.source);
    if (!candidate) return false;
    const writer = options?.writer ?? conclusionService;
    await writer.createConclusion({
      organizationId: params.organizationId,
      projectId: params.source.projectId ?? null,
      title: candidate.title,
      statement: candidate.statement,
      sourceModule: candidate.sourceModule,
      sourceRefs: candidate.sourceRefs,
      confidenceLevel: candidate.confidenceLevel,
      limits: candidate.limits,
      evidenceRefs: candidate.evidenceRefs,
      recommendedNextAction: candidate.recommendedNextAction,
      status: candidate.status,
      createdBy: params.actorUserId,
      contextSummary: candidate.contextSummary,
    });
    return true;
  } catch (error) {
    try {
      options?.logger?.warn('[ReportConclusionBridge] Failed to persist DRD report conclusion', {
        reportId: params.source.reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      /* even logging must not throw */
    }
    return false;
  }
}
