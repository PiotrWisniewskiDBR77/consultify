import DRD_STRUCTURE from '../../data/drdStructure.js';
import { methodOutputService } from '../../method-core/outputs/index.js';
import * as DbPromise from '../../utils/DbPromise.js';
import {
  AssessmentSkipReasonError,
  assessmentSkipReasonService,
  type AssessmentSkipReason,
} from './assessmentSkipReasonService.js';

const AREA_MICROSTRUCTURE = [
  'stan_faktyczny',
  'ocena_i_wiarygodnosc',
  'znaczenie_dla_przedsiebiorstwa',
  'luka_i_sens_targetu',
  'najblizszy_krok',
] as const;

export class AssessmentReportContractService {
  async build(organizationId: string, sessionId: string, outputId?: string) {
    const session = await DbPromise.get<{
      id: string;
      method_pack_version: string;
      created_at: string;
    }>(
      `SELECT id, method_pack_version, created_at FROM method_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, organizationId],
      { fallback: false }
    );
    if (!session) throw new AssessmentSkipReasonError('SESSION_NOT_FOUND', 404);

    const outputs = await methodOutputService.listOutputsBySession(organizationId, sessionId);
    const output = outputId
      ? await methodOutputService.getOutput(organizationId, outputId)
      : (outputs[0] ?? null);
    if (outputId && (!output || output.sessionId !== sessionId)) {
      throw new AssessmentSkipReasonError('REPORT_REVISION_NOT_FOUND', 404);
    }
    const skipReasons =
      outputId && output
        ? await assessmentSkipReasonService.listActiveAsOf(
            organizationId,
            sessionId,
            output.frozenAt
          )
        : await assessmentSkipReasonService.listActive(organizationId, sessionId);
    // FIX-2 (P1-2, nadzorca 2026-08-26): skip decisions are per-question
    // (unitId + questionId), never per-area. Group every active decision for
    // an area instead of collapsing to one arbitrary record — a single
    // skipped question must not make the whole area read as fully skipped.
    const skipsByUnit = new Map<string, AssessmentSkipReason[]>();
    for (const reason of skipReasons) {
      const existing = skipsByUnit.get(reason.unitId);
      if (existing) existing.push(reason);
      else skipsByUnit.set(reason.unitId, [reason]);
    }
    const findingByUnit = new Map(
      (output?.findings ?? []).map((finding) => [finding.unitId, finding])
    );

    // Area-level `skipped` is a true aggregate: true only when every
    // assessable slot of the area (one per canonical axis level, the same
    // bound already enforced on write by INVALID_UNIT_OR_LEVEL) has an
    // active skip decision. A partial skip keeps `skipped: false` and
    // surfaces the full per-question list so the consumer can see exactly
    // which questions were skipped and with which code.
    const areaSkipInfo = (
      axis: (typeof DRD_STRUCTURE)[number],
      area: (typeof DRD_STRUCTURE)[number]['areas'][number]
    ) => {
      const areaSkips = skipsByUnit.get(area.id) ?? [];
      const skips = areaSkips.map((reason) => ({
        questionId: reason.questionId,
        skipCode: reason.skipCode,
      }));
      const distinctLevelsSkipped = new Set(areaSkips.map((reason) => reason.level)).size;
      const allSkipped = areaSkips.length > 0 && distinctLevelsSkipped >= axis.levelCount;
      return {
        skipped: allSkipped,
        // Deterministic single code only when exactly one question is
        // skipped; never arbitrarily pick among multiple different codes.
        skipCode: skips.length === 1 ? skips[0].skipCode : null,
        skips,
      };
    };

    return {
      contractVersion: 'assessment-report-contract-v1',
      sessionId,
      outputId: output?.id ?? null,
      revision: output?.outputVersion ?? 0,
      generatedAt: output?.frozenAt ?? session.created_at,
      methodVersion: output?.methodPackVersion ?? session.method_pack_version,
      chapters: DRD_STRUCTURE.map((axis) => ({
        axisId: axis.id,
        axisName: axis.name,
        axisNamePL: axis.namePL,
        maxLevel: axis.levelCount,
        introduction: { content: null, minWords: 120, maxWords: 180 },
        matrix: {
          caption: { content: null, minWords: 30, maxWords: 60 },
          areas: axis.areas.map((area) => {
            const finding = findingByUnit.get(area.id);
            const skipInfo = areaSkipInfo(axis, area);
            const currentLevel = finding?.currentLevel ?? null;
            const targetLevel = finding?.targetLevel ?? null;
            return {
              unitId: area.id,
              unitName: area.name,
              unitNamePL: area.namePL,
              currentLevel,
              targetLevel,
              gap:
                currentLevel === null || targetLevel === null ? null : targetLevel - currentLevel,
              skipped: skipInfo.skipped,
              skipCode: skipInfo.skipCode,
              skips: skipInfo.skips,
              evidenceState: finding
                ? finding.supportingEvidence.length > 0
                  ? 'evidenced'
                  : finding.confidence === 'low'
                    ? 'incomplete'
                    : 'declared'
                : 'not_assessed',
            };
          }),
        },
        areaComments: axis.areas.map((area) => {
          const finding = findingByUnit.get(area.id);
          const skipInfo = areaSkipInfo(axis, area);
          return {
            unitId: area.id,
            content: null,
            minWords: 110,
            maxWords: 170,
            microstructure: AREA_MICROSTRUCTURE,
            skipped: skipInfo.skipped,
            skipCode: skipInfo.skipCode,
            skips: skipInfo.skips,
            answerRefs: finding ? [finding.id] : [],
            evidenceRefs: finding?.supportingEvidence.map((evidence) => evidence.evidenceId) ?? [],
            sourceLocators: finding?.sourceLocators ?? [],
            uncertainty: finding
              ? finding.supportingEvidence.length > 0
                ? 'evidenced'
                : finding.confidence === 'low'
                  ? 'incomplete'
                  : 'declared'
              : 'not_assessed',
          };
        }),
        conclusion: {
          content: null,
          minWords: 180,
          maxWords: 260,
          decisionLine: {
            direction: null,
            priority: null,
            horizon: null,
            successCondition: null,
          },
        },
      })),
    };
  }
}

export const assessmentReportContractService = new AssessmentReportContractService();
