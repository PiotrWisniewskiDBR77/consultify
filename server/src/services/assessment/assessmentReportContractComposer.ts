/**
 * assessmentReportContractComposer — CZYSTA kompozycja `assessment-report-contract-v1`.
 *
 * ★ PO CO TO ISTNIEJE. `assessmentReportContractService.build()` robiło dwie
 * rzeczy naraz: (1) zbierało dane z jądra metodycznego (`method_sessions`,
 * `method_outputs`, `method_events`, `organizations`, `projects`, `users`),
 * (2) składało z nich kontrakt raportu. Skutkiem było to, że raport DOCX
 * potrafił powstać WYŁĄCZNIE z oceny zamrożonej w jądrze — a pomiar z
 * 2026-09-06 (ten sam, który opisuje `src/components/assessment/
 * assessmentOutputProjection.ts`) pokazał, że 10 z 11 realnych ocen
 * właściciela leży w magazynie ZASTANYM (`assessments.answers_json`), a na
 * stanowisku lokalnym jądro ma DOKŁADNIE ZERO sesji i zero outputów.
 *
 * Ten plik wyciąga krok (2) — składanie — do jednej czystej funkcji bez I/O,
 * bez zegara i bez losowości. Dzięki temu ten sam, jeden silnik raportu
 * obsługuje OBA magazyny: jądro (`assessmentReportContractService`) i zastany
 * (`assessmentLegacyReportContractService`). Nie ma tu ani jednej nowej
 * liczby ani zdania: wszystko pochodzi z findingów wejściowych i ze struktury
 * DRD.
 */
import DRD_STRUCTURE from '../../data/drdStructure.js';
import type { MethodFindingRecord } from '../../method-core/outputs/MethodOutputService.js';
import {
  composeAreaNarrative,
  composeChapterAggregateNarrative,
  composeProgramAggregateNarrative,
} from './assessmentNarrativeComposer.js';
import type { AssessmentSkipReason } from './assessmentSkipReasonService.js';

export const AREA_MICROSTRUCTURE = [
  'stan_faktyczny',
  'ocena_i_wiarygodnosc',
  'znaczenie_dla_przedsiebiorstwa',
  'luka_i_sens_targetu',
  'najblizszy_krok',
] as const;

/** Skąd przyszły findingi — to jedyne pole, które dokument drukuje wprost,
 * żeby czytelnik wiedział, czy ma przed sobą zamrożony wynik jądra, czy
 * projekcję oceny prowadzonej w warsztacie DRD. */
export type ReportContractSourceKind = 'method-core' | 'legacy';

export interface ReportContractInput {
  readonly sessionId: string;
  readonly outputId: string | null;
  readonly revision: number;
  readonly generatedAt: string;
  readonly methodVersion: string;
  readonly sourceKind: ReportContractSourceKind;
  readonly sessionLabel: {
    readonly displayName: string | null;
    readonly source: 'project' | 'assessment' | null;
    readonly projectId: string | null;
  };
  readonly businessProfile: string | null;
  readonly employment: string | null;
  readonly assessmentPeriod: string | null;
  readonly assessor: string | null;
  readonly clientSponsor: string | null;
  readonly findings: readonly MethodFindingRecord[];
  readonly limitations: readonly string[];
  readonly skipReasons: readonly AssessmentSkipReason[];
  /** Notatki oceniającego per obszar (magazyn zastany: `levelNotes`). Klucz =
   * `unitId`. Pole jawnie oznaczone jako notatka, nie jako wniosek silnika. */
  readonly assessorNotes?: Readonly<Record<string, string>>;
}

export function composeReportContract(input: ReportContractInput) {
  const skipsByUnit = new Map<string, AssessmentSkipReason[]>();
  for (const reason of input.skipReasons) {
    const existing = skipsByUnit.get(reason.unitId);
    if (existing) existing.push(reason);
    else skipsByUnit.set(reason.unitId, [reason]);
  }
  const findingByUnit = new Map(input.findings.map((finding) => [finding.unitId, finding]));

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
      skipCode: skips.length === 1 ? skips[0].skipCode : null,
      skips,
    };
  };

  const programNarrative = composeProgramAggregateNarrative({
    axisCount: DRD_STRUCTURE.length,
    totalAreas: DRD_STRUCTURE.reduce((sum, axis) => sum + axis.areas.length, 0),
    findings: input.findings.map((finding) => {
      const area = DRD_STRUCTURE.flatMap((axis) => axis.areas).find(
        (candidate) => candidate.id === finding.unitId
      );
      return {
        unitId: finding.unitId,
        unitNamePL: area?.namePL ?? finding.unitName,
        currentLevel: finding.currentLevel,
        targetLevel: finding.targetLevel,
        gap: finding.gap,
        confidence: finding.confidence,
        evidenceCount: finding.supportingEvidence.length,
        recommendation: finding.recommendation,
        expectedOutcome: finding.expectedOutcome,
      };
    }),
    limitations: input.limitations,
    sourceKind: input.sourceKind,
  });

  return {
    contractVersion: 'assessment-report-contract-v1' as const,
    sessionId: input.sessionId,
    outputId: input.outputId,
    revision: input.revision,
    generatedAt: input.generatedAt,
    methodVersion: input.methodVersion,
    sourceKind: input.sourceKind,
    sessionLabel: input.sessionLabel,
    businessProfile: input.businessProfile,
    employment: input.employment,
    assessmentPeriod: input.assessmentPeriod,
    assessor: input.assessor,
    clientSponsor: input.clientSponsor,
    executiveSummary: programNarrative.executiveSummary,
    criticalGaps: programNarrative.criticalGaps,
    finalConclusions: programNarrative.finalConclusions,
    programDecisionLine: programNarrative.decisionLine,
    chapters: DRD_STRUCTURE.map((axis) => {
      const axisFindings = axis.areas.flatMap((area) => {
        const finding = findingByUnit.get(area.id);
        return finding
          ? [
              {
                unitId: finding.unitId,
                unitNamePL: area.namePL ?? area.name,
                currentLevel: finding.currentLevel,
                targetLevel: finding.targetLevel,
                gap: finding.gap,
                confidence: finding.confidence,
                evidenceCount: finding.supportingEvidence.length,
                recommendation: finding.recommendation,
                expectedOutcome: finding.expectedOutcome,
              },
            ]
          : [];
      });
      const aggregateNarrative = composeChapterAggregateNarrative({
        axisId: axis.id,
        axisNamePL: axis.namePL ?? axis.name,
        maxLevel: axis.levelCount,
        totalAreas: axis.areas.length,
        skippedCount: axis.areas.filter((area) => (skipsByUnit.get(area.id) ?? []).length > 0)
          .length,
        findings: axisFindings,
        frozenDate: new Date(input.generatedAt).toISOString().slice(0, 10),
        sourceKind: input.sourceKind,
      });
      return {
        axisId: axis.id,
        axisName: axis.name,
        axisNamePL: axis.namePL,
        maxLevel: axis.levelCount,
        introduction: { content: aggregateNarrative.introduction, minWords: 120, maxWords: 180 },
        matrix: {
          caption: { content: aggregateNarrative.matrixCaption, minWords: 30, maxWords: 60 },
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
          const evidenceState = finding
            ? finding.supportingEvidence.length > 0
              ? ('evidenced' as const)
              : finding.confidence === 'low'
                ? ('incomplete' as const)
                : ('declared' as const)
            : ('not_assessed' as const);
          const narrative = composeAreaNarrative(finding ?? null, {
            axisId: axis.id,
            evidenceState,
            skipped: skipInfo.skipped,
            assessorNote: input.assessorNotes?.[area.id] ?? null,
          });
          return {
            unitId: area.id,
            content: narrative?.text ?? null,
            minWords: 110,
            maxWords: 170,
            microstructure: AREA_MICROSTRUCTURE,
            skipped: skipInfo.skipped,
            skipCode: skipInfo.skipCode,
            skips: skipInfo.skips,
            answerRefs: narrative?.provenance.answerRefs ?? (finding ? [finding.id] : []),
            evidenceRefs:
              narrative?.provenance.evidenceRefs ??
              finding?.supportingEvidence.map((evidence) => evidence.evidenceId) ??
              [],
            sourceLocators: narrative?.provenance.sourceLocators ?? finding?.sourceLocators ?? [],
            sourceFields: narrative?.provenance.sourceFields ?? [],
            narrativeKind: narrative?.kind ?? null,
            uncertainty: evidenceState,
          };
        }),
        conclusion: {
          content: aggregateNarrative.conclusion,
          minWords: 180,
          maxWords: 260,
          decisionLine: {
            ...aggregateNarrative.decisionLine,
          },
        },
      };
    }),
  };
}
