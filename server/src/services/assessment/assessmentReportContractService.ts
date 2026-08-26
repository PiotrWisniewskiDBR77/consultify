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
  async build(organizationId: string, sessionId: string) {
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
    const output = outputs[0] ?? null;
    const skipReasons = await assessmentSkipReasonService.listActive(organizationId, sessionId);
    const skipByUnit = new Map<string, AssessmentSkipReason>();
    for (const reason of skipReasons) skipByUnit.set(reason.unitId, reason);
    const findingByUnit = new Map(
      (output?.findings ?? []).map((finding) => [finding.unitId, finding])
    );

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
            const skip = skipByUnit.get(area.id);
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
              skipped: Boolean(skip),
              skipCode: skip?.skipCode ?? null,
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
          const skip = skipByUnit.get(area.id);
          return {
            unitId: area.id,
            content: null,
            minWords: 110,
            maxWords: 170,
            microstructure: AREA_MICROSTRUCTURE,
            skipped: Boolean(skip),
            skipCode: skip?.skipCode ?? null,
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
