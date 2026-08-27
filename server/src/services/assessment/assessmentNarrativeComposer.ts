import type { MethodFindingRecord } from '../../method-core/outputs/MethodOutputService.js';
import {
  EVIDENCE_STATE_PL,
  priorityForGap,
  resolveDrdLevelLabelPL,
} from './assessmentDrdReportSchemaService.js';

export const CONFIDENCE_PL = Object.freeze({
  low: 'niska',
  medium: 'średnia',
  high: 'wysoka',
} as const);

export interface AssessmentNarrativeProvenance {
  readonly unitId: string;
  readonly sourceFields: readonly string[];
  readonly answerRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly sourceLocators: readonly string[];
}

export interface AreaNarrativeContext {
  readonly axisId: number;
  readonly evidenceState: keyof typeof EVIDENCE_STATE_PL;
  readonly skipped?: boolean;
}

export interface ComposedAreaNarrative {
  readonly text: string;
  readonly kind: 'full' | 'factual_short';
  readonly wordCount: number;
  readonly provenance: AssessmentNarrativeProvenance;
}

const TECHNICAL_MARKER = /\[demo-seed\]|Treść merytoryczna nie pochodzi z bazy/iu;

function usable(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && !TECHNICAL_MARKER.test(value ?? '');
}

function withoutTerminalPeriod(value: string): string {
  return value.trim().replace(/\.$/u, '');
}

export function countNarrativeWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

function addOptional(
  sentences: string[],
  sourceFields: string[],
  field: string,
  value: string | null,
  prefix: string
): void {
  if (!usable(value)) return;
  sentences.push(`${prefix}: ${value.trim()}`);
  sourceFields.push(field);
}

export function composeAreaNarrative(
  finding: MethodFindingRecord | null,
  context: AreaNarrativeContext
): ComposedAreaNarrative | null {
  if (!finding || context.skipped) return null;

  const currentLabel =
    finding.currentLevel === null
      ? null
      : resolveDrdLevelLabelPL(context.axisId, finding.currentLevel);
  const targetLabel =
    finding.targetLevel === null
      ? null
      : resolveDrdLevelLabelPL(context.axisId, finding.targetLevel);
  const evidenceCount = finding.supportingEvidence.length;
  const contradictionCount = finding.contradictingEvidence.length;
  const sourceFields = ['currentLevel', 'targetLevel', 'gap', 'confidence', 'supportingEvidence'];
  const facts = [
    `Stan faktyczny: poziom obecny ${finding.currentLevel ?? 'nieustalony'}${currentLabel ? ` — ${currentLabel}` : ''}; liczba dowodów: ${evidenceCount}.`,
    `Ocena i wiarygodność: pewność ${CONFIDENCE_PL[finding.confidence]}, stan dowodów ${EVIDENCE_STATE_PL[context.evidenceState]}${contradictionCount > 0 ? `, liczba dowodów przeciwnych: ${contradictionCount}` : ''}.`,
  ];
  if (contradictionCount > 0) sourceFields.push('contradictingEvidence');

  if (!usable(finding.businessMeaning) || !usable(finding.recommendation)) {
    facts.push(
      `Luka: ${finding.gap ?? 'nieustalona'}; priorytet: ${priorityForGap(finding.gap)}; poziom docelowy ${finding.targetLevel ?? 'nieustalony'}${targetLabel ? ` — ${targetLabel}` : ''}.`,
      `Brak treści wymaganej do pełnego komentarza: ${[
        !usable(finding.businessMeaning) ? 'znaczenie dla przedsiębiorstwa' : null,
        !usable(finding.recommendation) ? 'najbliższy krok' : null,
      ]
        .filter(Boolean)
        .join(' oraz ')}.`
    );
    const text = facts.join(' ');
    return {
      text,
      kind: 'factual_short',
      wordCount: countNarrativeWords(text),
      provenance: {
        unitId: finding.unitId,
        sourceFields,
        answerRefs: [finding.id],
        evidenceRefs: [
          ...finding.supportingEvidence.map((evidence) => evidence.evidenceId),
          ...finding.contradictingEvidence.map((evidence) => evidence.evidenceId),
        ],
        sourceLocators: [...finding.sourceLocators],
      },
    };
  }

  facts.push(`Znaczenie dla przedsiębiorstwa: ${finding.businessMeaning.trim()}`);
  sourceFields.push('businessMeaning');
  const gapParts = [
    `poziom docelowy ${finding.targetLevel ?? 'nieustalony'}${targetLabel ? ` — ${targetLabel}` : ''}`,
    `luka ${finding.gap ?? 'nieustalona'}`,
    `priorytet ${priorityForGap(finding.gap)}`,
  ];
  if (usable(finding.riskOrOpportunity)) {
    gapParts.push(withoutTerminalPeriod(finding.riskOrOpportunity));
    sourceFields.push('riskOrOpportunity');
  }
  if (usable(finding.priorityRationale)) {
    gapParts.push(withoutTerminalPeriod(finding.priorityRationale));
    sourceFields.push('priorityRationale');
  }
  facts.push(`Luka i sens poziomu docelowego: ${gapParts.join('; ')}.`);

  facts.push(`Najbliższy krok: ${finding.recommendation.trim()}`);
  sourceFields.push('recommendation');
  addOptional(facts, sourceFields, 'prerequisite', finding.prerequisite, 'Warunek');
  addOptional(
    facts,
    sourceFields,
    'expectedOutcome',
    finding.expectedOutcome,
    'Oczekiwany rezultat'
  );
  addOptional(
    facts,
    sourceFields,
    'rootCauseHypothesis',
    finding.rootCauseHypothesis,
    'Hipoteza przyczyny'
  );

  const text = facts.join(' ');
  if (countNarrativeWords(text) > 170) return null;
  return {
    text,
    kind: 'full',
    wordCount: countNarrativeWords(text),
    provenance: {
      unitId: finding.unitId,
      sourceFields,
      answerRefs: [finding.id],
      evidenceRefs: [
        ...finding.supportingEvidence.map((evidence) => evidence.evidenceId),
        ...finding.contradictingEvidence.map((evidence) => evidence.evidenceId),
      ],
      sourceLocators: [...finding.sourceLocators],
    },
  };
}
