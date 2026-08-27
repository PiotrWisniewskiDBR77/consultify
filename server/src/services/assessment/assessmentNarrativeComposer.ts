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

export interface AggregateFinding {
  readonly unitId: string;
  readonly unitNamePL: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly evidenceCount: number;
  readonly recommendation: string;
  readonly expectedOutcome: string | null;
}

export interface ChapterAggregateNarrative {
  readonly introduction: string | null;
  readonly matrixCaption: string;
  readonly conclusion: string | null;
  readonly decisionLine: {
    readonly direction: string | null;
    readonly priority: string | null;
    readonly horizon: null;
    readonly successCondition: string | null;
  };
}

export interface ProgramAggregateNarrative {
  readonly executiveSummary: string | null;
  readonly criticalGaps: string | null;
  readonly finalConclusions: string | null;
  readonly decisionLine: ChapterAggregateNarrative['decisionLine'];
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

export function validateNarrativeNumbers(
  text: string,
  allowedNumbers: readonly (number | string)[]
): boolean {
  const allowed = new Set(allowedNumbers.map((value) => String(value)));
  return [...text.matchAll(/(?<![\p{L}\p{N}])\d+(?![\p{L}\p{N}])/gu)].every((match) =>
    allowed.has(match[0])
  );
}

function withinValidated(
  text: string,
  min: number,
  max: number,
  allowedNumbers: readonly (number | string)[]
): string | null {
  return validateNarrativeNumbers(text, allowedNumbers) ? within(text, min, max) : null;
}

function within(text: string, min: number, max: number): string | null {
  const words = countNarrativeWords(text);
  return words >= min && words <= max ? text : null;
}

export function composeChapterAggregateNarrative(input: {
  readonly axisId: number;
  readonly axisNamePL: string;
  readonly maxLevel: number;
  readonly totalAreas: number;
  readonly skippedCount: number;
  readonly findings: readonly AggregateFinding[];
  readonly frozenDate: string;
}): ChapterAggregateNarrative {
  if (input.findings.length === 0) {
    return {
      introduction: null,
      matrixCaption: `Tabela obejmuje ${input.totalAreas} obszarów osi ${input.axisId}. Kolumny poziomów pokazują skalę od 1 do ${input.maxLevel}; Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika z wielkości luki. Źródłem jest zamrożony Output z dnia ${input.frozenDate}.`,
      conclusion: null,
      decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
    };
  }
  const states = { evidenced: 0, incomplete: 0, declared: 0 };
  for (const finding of input.findings) {
    const state =
      finding.evidenceCount > 0
        ? 'evidenced'
        : finding.confidence === 'low'
          ? 'incomplete'
          : 'declared';
    states[state] += 1;
  }
  const current = input.findings.flatMap((finding) =>
    finding.currentLevel === null ? [] : [finding.currentLevel]
  );
  const target = input.findings.flatMap((finding) =>
    finding.targetLevel === null ? [] : [finding.targetLevel]
  );
  const gaps = input.findings.flatMap((finding) => (finding.gap === null ? [] : [finding.gap]));
  const maxGap = Math.max(...gaps);
  const allowedNumbers = [
    input.axisId,
    input.maxLevel,
    input.totalAreas,
    input.skippedCount,
    input.findings.length,
    states.evidenced,
    states.incomplete,
    states.declared,
    ...current,
    ...target,
    ...gaps,
    ...input.findings.map((finding) => finding.evidenceCount),
    ...input.frozenDate.split('-'),
  ];
  const leaders = [...input.findings]
    .filter((finding) => finding.gap === maxGap)
    .sort((left, right) => left.unitId.localeCompare(right.unitId));
  const introduction = withinValidated(
    `Oś ${input.axisId}, ${input.axisNamePL}, obejmuje ${input.totalAreas} obszarów. Oceniono ${input.findings.length} z ${input.totalAreas} obszarów, a liczba pominięć wynosi ${input.skippedCount}. Poziomy obecne mieszczą się od ${Math.min(...current)} do ${Math.max(...current)}, natomiast poziomy docelowe od ${Math.min(...target)} do ${Math.max(...target)}. Stan udokumentowany dotyczy ${states.evidenced} obszarów, stan niepełny ${states.incomplete}, a stan zadeklarowany ${states.declared}. Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}. Największą lukę ${maxGap} mają: ${leaders.map((finding) => `${finding.unitId} ${finding.unitNamePL}`).join(', ')}. Zapisane poziomy obszarów to: ${input.findings.map((finding) => `${finding.unitId} od ${finding.currentLevel ?? 'nieustalonego'} do ${finding.targetLevel ?? 'nieustalonego'}, luka ${finding.gap ?? 'nieustalona'}`).join('; ')}. Dane pochodzą z zamrożonego Outputu. Każdy stan dowodowy zachowuje znaczenie zapisane w kontrakcie i nie jest wzmacniany. Zestawienie nie dodaje benchmarku ani oceny rynkowej; pokazuje wyłącznie poziomy, luki, stany dowodowe i pominięcia zapisane dla tej osi.`,
    120,
    180,
    allowedNumbers
  );
  const matrixCaption = `Tabela obejmuje ${input.totalAreas} obszarów osi ${input.axisId}. Kolumny poziomów pokazują skalę od 1 do ${input.maxLevel}; Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika z wielkości luki. Źródłem jest zamrożony Output z dnia ${input.frozenDate}.`;
  const cited = [...input.findings]
    .sort(
      (left, right) =>
        (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
    )
    .slice(0, 3);
  const conclusion = withinValidated(
    `Na osi ${input.axisId} oceniono ${input.findings.length} z ${input.totalAreas} obszarów. Największa luka wynosi ${maxGap}, a liczba pominięć wynosi ${input.skippedCount}. ${cited
      .map(
        (finding) =>
          `${finding.unitId} ${finding.unitNamePL}: poziom obecny ${finding.currentLevel ?? 'nieustalony'}, poziom docelowy ${finding.targetLevel ?? 'nieustalony'}, luka ${finding.gap ?? 'nieustalona'}, pewność ${CONFIDENCE_PL[finding.confidence]}, liczba dowodów ${finding.evidenceCount}. Rekomendacja ${finding.unitId}: „${finding.recommendation}”${finding.expectedOutcome ? ` Oczekiwany rezultat ${finding.unitId}: „${finding.expectedOutcome}”` : ''}`
      )
      .join(
        ' '
      )} Zapisane poziomy i luki wynoszą: ${input.findings.map((finding) => `${finding.unitId}: ${finding.currentLevel ?? 'nieustalony'} do ${finding.targetLevel ?? 'nieustalony'}, luka ${finding.gap ?? 'nieustalona'}`).join('; ')}. Wnioski cytują rekomendacje z findingów i zachowują ich identyfikatory; nie dodają porównania rynkowego ani własnej diagnozy.`,
    180,
    260,
    allowedNumbers
  );
  const primary = leaders[0];
  return {
    introduction,
    matrixCaption,
    conclusion,
    decisionLine: {
      direction: `Skoncentrować działania na obszarze ${primary.unitId} o największej luce ${maxGap} na osi ${input.axisId}.`,
      priority: `Priorytet ${priorityForGap(maxGap)} wynika z największej luki ${maxGap} na osi ${input.axisId}.`,
      horizon: null,
      successCondition: primary.expectedOutcome
        ? `Warunek sukcesu dla ${primary.unitId}: ${withoutTerminalPeriod(primary.expectedOutcome)}.`
        : null,
    },
  };
}

export function composeProgramAggregateNarrative(input: {
  readonly axisCount: number;
  readonly totalAreas: number;
  readonly findings: readonly AggregateFinding[];
  readonly limitations: readonly string[];
}): ProgramAggregateNarrative {
  if (input.findings.length === 0) {
    return {
      executiveSummary: null,
      criticalGaps: null,
      finalConclusions: null,
      decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
    };
  }
  const gaps = input.findings.flatMap((finding) => (finding.gap === null ? [] : [finding.gap]));
  const maxGap = Math.max(...gaps);
  const critical = input.findings.filter((finding) => (finding.gap ?? 0) >= 3);
  const leaders = [...input.findings]
    .sort(
      (left, right) =>
        (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
    )
    .slice(0, 3);
  const evidenced = input.findings.filter((finding) => finding.evidenceCount > 0).length;
  const incomplete = input.findings.filter(
    (finding) => finding.evidenceCount === 0 && finding.confidence === 'low'
  ).length;
  const declared = input.findings.length - evidenced - incomplete;
  const allowedNumbers = [
    input.axisCount,
    input.totalAreas,
    input.findings.length,
    evidenced,
    incomplete,
    declared,
    critical.length,
    ...gaps,
    ...input.findings.flatMap((finding) => [
      finding.currentLevel ?? '',
      finding.targetLevel ?? '',
      finding.evidenceCount,
    ]),
  ];
  const executiveSummary = withinValidated(
    `Ocena obejmuje ${input.axisCount} osi i ${input.totalAreas} obszarów. Finding istnieje dla ${input.findings.length} obszarów. Stan udokumentowany dotyczy ${evidenced} obszarów, stan niepełny ${incomplete}, a stan zadeklarowany ${declared}. Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}, a liczba luk krytycznych wynosi ${critical.length}. Trzy pierwsze obszary po uporządkowaniu malejąco według luki to ${leaders.map((finding) => `${finding.unitId} ${finding.unitNamePL} z luką ${finding.gap}`).join(', ')}. Ich poziomy obecne to ${leaders.map((finding) => `${finding.unitId}: ${finding.currentLevel}`).join(', ')}, a docelowe ${leaders.map((finding) => `${finding.unitId}: ${finding.targetLevel}`).join(', ')}. Zestawienie opiera się na zamrożonym Outputcie, poziomach, lukach i stanach dowodowych. Jest to obraz policzalny, ograniczony do danych obecnych w zaakceptowanym kontrakcie raportu. Nie korzysta z benchmarku branżowego i nie dodaje oceny jakościowej poza zamrożonymi etykietami priorytetu oraz wiarygodności.`,
    120,
    150,
    allowedNumbers
  );
  const criticalGaps = withinValidated(
    `Liczba obszarów z luką co najmniej 3 wynosi ${critical.length}. Największa luka wynosi ${maxGap}. ${critical
      .slice(0, 3)
      .map(
        (finding) =>
          `${finding.unitId} ${finding.unitNamePL}, luka ${finding.gap}, rekomendacja: „${finding.recommendation}”`
      )
      .join(' ')} Dla tych obszarów zapisano poziomy obecne ${critical
      .slice(0, 3)
      .map((finding) => `${finding.unitId}: ${finding.currentLevel}`)
      .join(', ')} i docelowe ${critical
      .slice(0, 3)
      .map((finding) => `${finding.unitId}: ${finding.targetLevel}`)
      .join(
        ', '
      )}. Każdy cytat zachowuje treść zapisaną w findingu i jego identyfikator. Rekomendacje są cytowane z findingów bez parafrazy. Kolejność wynika wyłącznie z wielkości luki i identyfikatora obszaru; nie zawiera benchmarku ani prognozy.`,
    120,
    150,
    allowedNumbers
  );
  const selected = [...input.findings]
    .sort(
      (left, right) =>
        (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
    )
    .slice(0, 5);
  const finalConclusions = withinValidated(
    `W całym programie oceniono ${input.findings.length} z ${input.totalAreas} obszarów w ${input.axisCount} osiach. Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}, a liczba luk krytycznych wynosi ${critical.length}. Stan udokumentowany dotyczy ${evidenced} obszarów, niepełny ${incomplete}, a zadeklarowany ${declared}. ${selected
      .map(
        (finding) =>
          `${finding.unitId} ${finding.unitNamePL}: poziom obecny ${finding.currentLevel ?? 'nieustalony'}, docelowy ${finding.targetLevel ?? 'nieustalony'}, luka ${finding.gap ?? 'nieustalona'}; rekomendacja: „${finding.recommendation}”` +
          (finding.expectedOutcome ? `; oczekiwany rezultat: „${finding.expectedOutcome}”` : '')
      )
      .join(
        ' '
      )} Ograniczenia zamrożonego Outputu: ${input.limitations.map((limitation) => `„${limitation}”`).join('; ')}. Synteza nie dodaje porównań rynkowych, horyzontu czasowego ani prognozy. Wszystkie liczby pochodzą z findingów albo z policzalnych mianowników kontraktu.`,
    250,
    300,
    allowedNumbers
  );
  const primary = leaders[0];
  return {
    executiveSummary,
    criticalGaps,
    finalConclusions,
    decisionLine: {
      direction: `Skoncentrować program na obszarze ${primary.unitId} oraz pozostałych lukach o wartości ${maxGap}.`,
      priority: `Priorytet ${priorityForGap(maxGap)} wynika z największej luki ${maxGap} w całym programie.`,
      horizon: null,
      successCondition: primary.expectedOutcome
        ? `Warunek sukcesu dla ${primary.unitId}: ${withoutTerminalPeriod(primary.expectedOutcome)}.`
        : null,
    },
  };
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
