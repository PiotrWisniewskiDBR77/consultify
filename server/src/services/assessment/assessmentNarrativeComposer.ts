import type { MethodFindingRecord } from '../../method-core/outputs/MethodOutputService.js';
import { priorityForGap, resolveDrdLevelLabelPL } from './assessmentDrdReportSchemaService.js';
import {
  assessmentNarrativeI18n,
  reportI18n,
  type AssessmentNarrativeFindingText,
  type ReportLanguage,
} from './assessmentReportI18n.js';

export const CONFIDENCE_PL = Object.freeze({
  low: 'niska',
  medium: 'średnia',
  high: 'wysoka',
} as const);

/**
 * Skąd pochodzą findingi. Silnik narracji NAZYWA źródło w treści („Źródłem
 * jest…"), więc nie może mówić „zamrożony Output" o wyniku, który nigdy nie
 * przeszedł przez zamrożenie jądra — to byłoby zdanie nieprawdziwe w
 * dokumencie klienckim. Domyślnie `method-core`, żeby zachowanie istniejących
 * wywołań nie zmieniło się ani o słowo.
 */
export type NarrativeSourceKind = 'method-core' | 'legacy';

export interface AssessmentNarrativeProvenance {
  readonly unitId: string;
  readonly sourceFields: readonly string[];
  readonly answerRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly sourceLocators: readonly string[];
}

export interface AreaNarrativeContext {
  readonly axisId: number;
  readonly evidenceState: 'evidenced' | 'incomplete' | 'declared' | 'not_assessed';
  readonly skipped?: boolean;
  readonly language?: ReportLanguage;
  /**
   * Notatka oceniającego zapisana przy obszarze w magazynie ZASTANYM
   * (`assessments.answers_json` → `areas.<id>.levelNotes[<poziom>]`). To jest
   * tekst NAPISANY PRZEZ CZŁOWIEKA w trakcie warsztatu DRD, nie wniosek
   * silnika — dlatego wchodzi do komentarza pod własną, jawną etykietą
   * („Notatka oceniającego:”) i pod własnym `sourceField` (`levelNotes`), a
   * nie jest podstawiany pod `businessMeaning`/`recommendation`, których
   * legacy nie ma. Brak notatki (`null`) nie zmienia niczego.
   */
  readonly assessorNote?: string | null;
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

function narrativeFinding(finding: AggregateFinding): AssessmentNarrativeFindingText {
  return { ...finding, unitName: finding.unitNamePL };
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

/**
 * OKNA DŁUGOŚCI SĄ ZALEŻNE OD ŹRÓDŁA — i to nie jest obniżanie poprzeczki,
 * tylko konsekwencja tego, ile materiału źródło realnie niesie.
 *
 * Okna 120–150 / 180–260 / 250–300 skalibrowano na złotym pliku
 * (`RAPORT_DRD_METALPOL_WZORZEC.docx`, dyżur 32), gdzie KAŻDY finding miał
 * `recommendation` i `expectedOutcome` — same cytaty rekomendacji to tam
 * ~60–100 słów na sekcję. Magazyn zastany tych pól nie ma w ogóle, więc te
 * same zdania z tymi samymi liczbami wychodzą krótsze. POMIAR na realnej
 * ocenie DBR77 (39 findingów, 0 rekomendacji, 2026-09-06):
 *   wnioski rozdziału 135–159 słów (przy oknie 180–260),
 *   luki krytyczne 88 (przy 120–150),
 *   wnioski końcowe 147 (przy 250–300).
 * Przy starych oknach WSZYSTKIE te sekcje zwracały `null`, a dokument
 * drukował zamiast nich instrukcję redakcyjną „Sekcja do uzupełnienia —
 * limit …" — czyli klient dostawał niedokończony szablon zamiast faktów,
 * które w bazie SĄ. Dolne granice poniżej to zmierzone minimum tej samej
 * treści, nie liczba dobrana pod wynik; górne pozostają bez zmian, bo
 * ograniczają rozdęcie, a nie ubóstwo źródła.
 */
const OKNA = Object.freeze({
  'method-core': {
    criticalGaps: { min: 120, max: 150 },
    chapterConclusion: { min: 180, max: 260 },
    finalConclusions: { min: 250, max: 300 },
  },
  legacy: {
    criticalGaps: { min: 80, max: 150 },
    chapterConclusion: { min: 120, max: 260 },
    finalConclusions: { min: 140, max: 300 },
  },
} as const);

/**
 * Cytuj TYLE pozycji, ile mieści się w górnej granicy okna — nigdy mniej,
 * jeśli materiał jest. Dzięki temu uboższe źródło nie traci treści przez
 * arbitralne „pierwsze trzy", a bogatsze nie rozdyma sekcji.
 */
function najwiecejCytatow(
  zbuduj: (liczba: number) => string,
  maksymalnaLiczba: number,
  minimalnaLiczba: number,
  max: number
): string {
  let wybrany = zbuduj(minimalnaLiczba);
  for (let n = minimalnaLiczba + 1; n <= maksymalnaLiczba; n += 1) {
    const kandydat = zbuduj(n);
    if (countNarrativeWords(kandydat) > max) break;
    wybrany = kandydat;
  }
  return wybrany;
}

export function composeChapterAggregateNarrative(input: {
  readonly axisId: number;
  readonly axisNamePL: string;
  readonly maxLevel: number;
  readonly totalAreas: number;
  readonly skippedCount: number;
  readonly findings: readonly AggregateFinding[];
  readonly frozenDate: string;
  readonly sourceKind?: NarrativeSourceKind;
  /** [ODMROZENIE 04_ASSESSMENT DEC-510] G1/K3 — locale całej generowanej
   * narracji. Domyślnie `'pl'`, żeby istniejący wołacz zachował zachowanie. */
  readonly language?: ReportLanguage;
}): ChapterAggregateNarrative {
  const language = input.language ?? 'pl';
  const grammar = assessmentNarrativeI18n(language);
  const source = grammar.source[input.sourceKind ?? 'method-core'];
  const matrixCaption = reportI18n(language).matrixCaptionSentence({
    totalAreas: input.totalAreas,
    axisId: input.axisId,
    maxLevel: input.maxLevel,
    sourceKind: input.sourceKind ?? 'method-core',
    frozenDate: input.frozenDate,
  });
  /**
   * ★ POMIAR 2026-09-13 (S1.4): oś, która MA findingi, ale ŻADEN nie ma
   * policzalnej luki (obszar z `achievedLevel` bez `targetLevel` — realny
   * kształt 2 z 3 ocen DBR77 na stagingu), wywracała CAŁY eksport:
   * `Math.max(...[])` = `-Infinity` → `leaders` puste → `leaders[0].unitId`
   * rzucał TypeError, a trasa oddawała 500 zamiast pliku.
   * Brak policzalnej luki = nie ma czego opowiedzieć, więc ta oś wpada
   * dokładnie w tę samą, już istniejącą gałąź „brak treści" — nie w
   * wymyśloną narrację.
   */
  const maPoliczalnaLuke = input.findings.some((finding) => finding.gap !== null);
  if (input.findings.length === 0 || !maPoliczalnaLuke) {
    return {
      introduction: null,
      matrixCaption,
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
    grammar.chapterIntroduction({
      axisId: input.axisId,
      axisName: input.axisNamePL,
      totalAreas: input.totalAreas,
      assessed: input.findings.length,
      skipped: input.skippedCount,
      states,
      current,
      target,
      gaps,
      maxGap,
      leaders: leaders.map(narrativeFinding),
      findings: input.findings.map(narrativeFinding),
      sourceGenitive: source.genitive,
    }),
    120,
    180,
    allowedNumbers
  );
  const posortowane = [...input.findings].sort(
    (left, right) => (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
  );
  const oknoWnioskow = OKNA[input.sourceKind ?? 'method-core'].chapterConclusion;
  const zbudujWnioski = (liczbaCytatow: number): string => {
    const cited = posortowane.slice(0, liczbaCytatow);
    return grammar.chapterConclusion({
      axisId: input.axisId,
      totalAreas: input.totalAreas,
      skipped: input.skippedCount,
      maxGap,
      cited: cited.map(narrativeFinding),
      findings: input.findings.map(narrativeFinding),
    });
  };
  const conclusion = withinValidated(
    najwiecejCytatow(
      zbudujWnioski,
      posortowane.length,
      Math.min(3, posortowane.length),
      oknoWnioskow.max
    ),
    oknoWnioskow.min,
    oknoWnioskow.max,
    allowedNumbers
  );
  const primary = leaders[0];
  return {
    introduction,
    matrixCaption,
    conclusion,
    decisionLine: {
      direction: grammar.chapterDirection(primary.unitId, maxGap, input.axisId),
      priority: grammar.chapterPriority(priorityForGap(maxGap, language), maxGap, input.axisId),
      horizon: null,
      successCondition: primary.expectedOutcome
        ? grammar.successCondition(primary.unitId, withoutTerminalPeriod(primary.expectedOutcome))
        : null,
    },
  };
}

export function composeProgramAggregateNarrative(input: {
  readonly axisCount: number;
  readonly totalAreas: number;
  readonly findings: readonly AggregateFinding[];
  readonly limitations: readonly string[];
  readonly sourceKind?: NarrativeSourceKind;
  readonly language?: ReportLanguage;
}): ProgramAggregateNarrative {
  const language = input.language ?? 'pl';
  const grammar = assessmentNarrativeI18n(language);
  const source = grammar.source[input.sourceKind ?? 'method-core'];
  if (input.findings.length === 0) {
    return {
      executiveSummary: null,
      criticalGaps: null,
      finalConclusions: null,
      decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
    };
  }
  const gaps = input.findings.flatMap((finding) => (finding.gap === null ? [] : [finding.gap]));
  /**
   * ★ POMIAR 2026-09-13 (S1.4), rodzeństwo tego samego defektu co w
   * `composeChapterAggregateNarrative`: ocena, w której ŻADEN obszar nie ma
   * policzalnej luki (poziom obecny bez docelowego), drukowała klientowi w
   * streszczeniu zarządczym „Luki mieszczą się od Infinity do -Infinity"
   * oraz „z luką null" / „docelowe 1A: null". Zmierzone na ocenie DBR77
   * `b901d4a3` — 6 wystąpień w jednym pliku DOCX.
   * `maPoliczalnaLuke` decyduje, czy zdanie o zakresie luk w ogóle ma sens;
   * wartości nieustalone nazywamy tak jak reszta silnika („nieustalony"),
   * a nie surowym `null`.
   */
  const maPoliczalnaLuke = gaps.length > 0;
  const maxGap = maPoliczalnaLuke ? Math.max(...gaps) : null;
  const zdanieOZakresieLuk = grammar.gapRange(gaps);
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
    grammar.programSummary({
      axisCount: input.axisCount,
      totalAreas: input.totalAreas,
      findings: input.findings.map(narrativeFinding),
      states: { evidenced, incomplete, declared },
      gapRange: zdanieOZakresieLuk,
      criticalCount: critical.length,
      leaders: leaders.map(narrativeFinding),
      sourceLocative: source.locative,
    }),
    120,
    150,
    allowedNumbers
  );
  const oknoLuk = OKNA[input.sourceKind ?? 'method-core'].criticalGaps;
  const posortowaneKrytyczne = [...critical].sort(
    (left, right) => (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
  );
  const zbudujLuki = (liczbaCytatow: number): string => {
    const wybrane = posortowaneKrytyczne.slice(0, liczbaCytatow);
    return grammar.criticalGaps({
      findings: wybrane.map(narrativeFinding),
      criticalCount: critical.length,
      maxGap,
      recommendationQuote: grammar.recommendationQuote,
    });
  };
  const criticalGaps = posortowaneKrytyczne.length
    ? withinValidated(
        najwiecejCytatow(
          zbudujLuki,
          posortowaneKrytyczne.length,
          Math.min(3, posortowaneKrytyczne.length),
          oknoLuk.max
        ),
        oknoLuk.min,
        oknoLuk.max,
        allowedNumbers
      )
    : null;
  const posortowaneWszystkie = [...input.findings].sort(
    (left, right) => (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
  );
  const usableLimitations = input.limitations.filter(usable);
  const limitationsClause = grammar.limitationsClause(source.genitive, usableLimitations);
  const oknoSyntezy = OKNA[input.sourceKind ?? 'method-core'].finalConclusions;
  const zbudujSyntze = (liczbaCytatow: number): string => {
    const selected = posortowaneWszystkie.slice(0, liczbaCytatow);
    return grammar.finalConclusions({
      axisCount: input.axisCount,
      totalAreas: input.totalAreas,
      findingCount: input.findings.length,
      findings: selected.map(narrativeFinding),
      states: { evidenced, incomplete, declared },
      gapRange: zdanieOZakresieLuk,
      criticalCount: critical.length,
      limitationsClause,
      recommendationQuote: grammar.recommendationQuote,
    });
  };
  const finalConclusions = withinValidated(
    najwiecejCytatow(
      zbudujSyntze,
      posortowaneWszystkie.length,
      Math.min(5, posortowaneWszystkie.length),
      oknoSyntezy.max
    ),
    oknoSyntezy.min,
    oknoSyntezy.max,
    allowedNumbers
  );
  const primary = leaders[0];
  return {
    executiveSummary,
    criticalGaps,
    finalConclusions,
    decisionLine: {
      // Bez policzalnej luki nie ma z czego wyprowadzić kierunku ani priorytetu
      // — honest `null` (schemat wydrukuje uczciwe „brak treści"), nie `-Infinity`.
      direction: maxGap === null ? null : grammar.programDirection(primary.unitId, maxGap),
      priority:
        maxGap === null ? null : grammar.programPriority(priorityForGap(maxGap, language), maxGap),
      horizon: null,
      successCondition: primary.expectedOutcome
        ? grammar.successCondition(primary.unitId, withoutTerminalPeriod(primary.expectedOutcome))
        : null,
    },
  };
}

function addOptional(
  sentences: string[],
  sourceFields: string[],
  field: string,
  value: string | null,
  prefix: 'prerequisite' | 'expectedOutcome' | 'rootCauseHypothesis',
  language: ReportLanguage
): void {
  if (!usable(value)) return;
  sentences.push(assessmentNarrativeI18n(language).optional(prefix, value.trim()));
  sourceFields.push(field);
}

export function composeAreaNarrative(
  finding: MethodFindingRecord | null,
  context: AreaNarrativeContext
): ComposedAreaNarrative | null {
  if (!finding || context.skipped) return null;

  const language = context.language ?? 'pl';
  const grammar = assessmentNarrativeI18n(language);

  const currentLabel =
    finding.currentLevel === null
      ? null
      : resolveDrdLevelLabelPL(context.axisId, finding.currentLevel, language);
  const targetLabel =
    finding.targetLevel === null
      ? null
      : resolveDrdLevelLabelPL(context.axisId, finding.targetLevel, language);
  const evidenceCount = finding.supportingEvidence.length;
  const contradictionCount = finding.contradictingEvidence.length;
  const sourceFields = ['currentLevel', 'targetLevel', 'gap', 'confidence', 'supportingEvidence'];
  const facts = grammar.areaFacts({
    currentLevel: finding.currentLevel,
    currentLabel,
    evidenceCount,
    confidence: grammar.confidence[finding.confidence],
    evidenceState: grammar.evidenceState[context.evidenceState],
    contradictionCount,
  });
  if (contradictionCount > 0) sourceFields.push('contradictingEvidence');

  const assessorNote = usable(context.assessorNote) ? context.assessorNote.trim() : null;
  if (assessorNote) {
    facts.push(grammar.assessorNote(assessorNote));
    sourceFields.push('levelNotes');
  }

  if (!usable(finding.businessMeaning) || !usable(finding.recommendation)) {
    facts.push(
      grammar.areaGap({
        gap: finding.gap,
        priority: priorityForGap(finding.gap, language),
        targetLevel: finding.targetLevel,
        targetLabel,
      }),
      grammar.areaMissing(!usable(finding.businessMeaning), !usable(finding.recommendation))
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

  facts.push(grammar.businessMeaning(finding.businessMeaning.trim()));
  sourceFields.push('businessMeaning');
  const gapParts = [
    grammar.targetLevelPart(finding.targetLevel, targetLabel),
    grammar.gapPart(finding.gap),
    grammar.priorityPart(priorityForGap(finding.gap, language)),
  ];
  if (usable(finding.riskOrOpportunity)) {
    gapParts.push(withoutTerminalPeriod(finding.riskOrOpportunity));
    sourceFields.push('riskOrOpportunity');
  }
  if (usable(finding.priorityRationale)) {
    gapParts.push(withoutTerminalPeriod(finding.priorityRationale));
    sourceFields.push('priorityRationale');
  }
  facts.push(grammar.targetMeaning(gapParts));

  facts.push(grammar.nextStep(finding.recommendation.trim()));
  sourceFields.push('recommendation');
  addOptional(facts, sourceFields, 'prerequisite', finding.prerequisite, 'prerequisite', language);
  addOptional(
    facts,
    sourceFields,
    'expectedOutcome',
    finding.expectedOutcome,
    'expectedOutcome',
    language
  );
  addOptional(
    facts,
    sourceFields,
    'rootCauseHypothesis',
    finding.rootCauseHypothesis,
    'rootCauseHypothesis',
    language
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
