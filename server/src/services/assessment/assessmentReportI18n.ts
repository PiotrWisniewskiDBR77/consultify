/**
 * assessmentReportI18n — SŁOWNIK en/pl dla STAŁYCH napisów raportu z oceny
 * (S1.4b, DEC-461: raport domyślnie po angielsku, po polsku tylko gdy
 * język użytkownika/organizacji = pl).
 *
 * ★ CO TU JEST, A CZEGO NIE MA. Ten słownik pokrywa WYŁĄCZNIE strukturę
 * dokumentu — nagłówki sekcji, etykiety tabel, okładkę, placeholdery i
 * komunikaty statusu ("nie oceniono", "pominięto"). Świadomie NIE pokrywa
 * treści narracyjnej (streszczenie zarządcze, wnioski rozdziałów, komentarze
 * obszarów) — ta treść pochodzi z `assessmentNarrativeComposer.ts`, który
 * pisze deterministyczną prozę PO POLSKU niezależnie od `language`. Tłumaczenie
 * WŁASNEJ prozy silnika to osobny, znacznie większy zakres (i nie jest to
 * "treść odpowiedzi użytkownika", ale i tak jest to inna decyzja produktowa niż
 * "trzy małe naprawy" S1.4b) — patrz raport S1.4b, sekcja "Co zostaje do
 * decyzji".
 *
 * JEDNO MIEJSCE: każdy konsument (schemat DOCX, okładka DOCX, model
 * PPTX/PDF) czyta z TEGO pliku, żeby dwa renderowane pliki tej samej oceny
 * nie mogły się rozjechać etykietą.
 */

export type ReportLanguage = 'pl' | 'en';

export function normalizeReportLanguage(value: unknown): ReportLanguage {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

/**
 * Data długa ("13 września 2026" / "13 September 2026") — JEDNO miejsce dla
 * DOCX (okładka), PPTX/PDF (slajd okładki) i kontraktu (assessmentPeriod).
 * Przed S1.4b trzy pliki trzymały własną parę formatterów
 * `Intl.DateTimeFormat('pl-PL'/'en-GB', …)`; skonsolidowane tu, żeby dwa
 * wyrenderowane pliki tej samej oceny nie mogły pokazać dwóch różnych
 * formatów tej samej daty.
 */
const REPORT_DATE_LOCALE: Record<ReportLanguage, string> = { pl: 'pl-PL', en: 'en-GB' };
const REPORT_DATE_FORMATTERS: Record<ReportLanguage, Intl.DateTimeFormat> = {
  pl: new Intl.DateTimeFormat(REPORT_DATE_LOCALE.pl, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  en: new Intl.DateTimeFormat(REPORT_DATE_LOCALE.en, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
};
export function formatReportDate(date: Date, language: ReportLanguage): string {
  return REPORT_DATE_FORMATTERS[language].format(date);
}

export interface AssessmentNarrativeFindingText {
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly evidenceCount: number;
  readonly recommendation: string;
  readonly expectedOutcome: string | null;
}

interface NarrativeStateCounts {
  readonly evidenced: number;
  readonly incomplete: number;
  readonly declared: number;
}

interface NarrativeGrammar {
  readonly confidence: Readonly<Record<AssessmentNarrativeFindingText['confidence'], string>>;
  readonly evidenceState: Readonly<
    Record<'evidenced' | 'incomplete' | 'declared' | 'not_assessed', string>
  >;
  readonly source: Readonly<
    Record<'method-core' | 'legacy', { genitive: string; locative: string }>
  >;
  readonly unset: { masculine: string; feminine: string; genitive: string };
  recommendationQuote(recommendation: string): string;
  chapterIntroduction(params: {
    axisId: number;
    axisName: string;
    totalAreas: number;
    assessed: number;
    skipped: number;
    states: NarrativeStateCounts;
    current: readonly number[];
    target: readonly number[];
    gaps: readonly number[];
    maxGap: number;
    leaders: readonly AssessmentNarrativeFindingText[];
    findings: readonly AssessmentNarrativeFindingText[];
    sourceGenitive: string;
  }): string;
  chapterConclusion(params: {
    axisId: number;
    totalAreas: number;
    skipped: number;
    maxGap: number;
    cited: readonly AssessmentNarrativeFindingText[];
    findings: readonly AssessmentNarrativeFindingText[];
  }): string;
  gapRange(gaps: readonly number[]): string;
  programSummary(params: {
    axisCount: number;
    totalAreas: number;
    findings: readonly AssessmentNarrativeFindingText[];
    states: NarrativeStateCounts;
    gapRange: string;
    criticalCount: number;
    leaders: readonly AssessmentNarrativeFindingText[];
    sourceLocative: string;
  }): string;
  criticalGaps(params: {
    findings: readonly AssessmentNarrativeFindingText[];
    criticalCount: number;
    maxGap: number | null;
    recommendationQuote: (recommendation: string) => string;
  }): string;
  limitationsClause(sourceGenitive: string, limitations: readonly string[]): string;
  finalConclusions(params: {
    axisCount: number;
    totalAreas: number;
    findingCount: number;
    findings: readonly AssessmentNarrativeFindingText[];
    states: NarrativeStateCounts;
    gapRange: string;
    criticalCount: number;
    limitationsClause: string;
    recommendationQuote: (recommendation: string) => string;
  }): string;
  chapterDirection(unitId: string, maxGap: number, axisId: number): string;
  chapterPriority(priority: string, maxGap: number, axisId: number): string;
  programDirection(unitId: string, maxGap: number): string;
  programPriority(priority: string, maxGap: number): string;
  successCondition(unitId: string, outcome: string): string;
  areaFacts(params: {
    currentLevel: number | null;
    currentLabel: string | null;
    evidenceCount: number;
    confidence: string;
    evidenceState: string;
    contradictionCount: number;
  }): string[];
  assessorNote(note: string): string;
  areaGap(params: {
    gap: number | null;
    priority: string;
    targetLevel: number | null;
    targetLabel: string | null;
  }): string;
  areaMissing(missingBusinessMeaning: boolean, missingRecommendation: boolean): string;
  businessMeaning(value: string): string;
  targetLevelPart(level: number | null, label: string | null): string;
  gapPart(gap: number | null): string;
  priorityPart(priority: string): string;
  targetMeaning(parts: readonly string[]): string;
  nextStep(value: string): string;
  optional(
    prefix: 'prerequisite' | 'expectedOutcome' | 'rootCauseHypothesis',
    value: string
  ): string;
}

const narrativePl: NarrativeGrammar = {
  confidence: { low: 'niska', medium: 'średnia', high: 'wysoka' },
  evidenceState: {
    evidenced: 'udokumentowane',
    incomplete: 'niepełne',
    declared: 'zadeklarowane',
    not_assessed: 'nieocenione',
  },
  source: {
    'method-core': { genitive: 'zamrożonego Outputu', locative: 'zamrożonym Outputcie' },
    legacy: { genitive: 'zapisanej oceny', locative: 'zapisanej ocenie' },
  },
  unset: { masculine: 'nieustalony', feminine: 'nieustalona', genitive: 'nieustalonego' },
  recommendationQuote: (value) =>
    value.trim() ? `rekomendacja: „${value.trim()}”` : 'bez zapisanej rekomendacji',
  chapterIntroduction: (p) =>
    `Oś ${p.axisId}, ${p.axisName}, obejmuje ${p.totalAreas} obszarów. Oceniono ${p.assessed} z ${p.totalAreas} obszarów, a liczba pominięć wynosi ${p.skipped}. Poziomy obecne mieszczą się od ${Math.min(...p.current)} do ${Math.max(...p.current)}, natomiast poziomy docelowe od ${Math.min(...p.target)} do ${Math.max(...p.target)}. Stan udokumentowany dotyczy ${p.states.evidenced} obszarów, stan niepełny ${p.states.incomplete}, a stan zadeklarowany ${p.states.declared}. Luki mieszczą się od ${Math.min(...p.gaps)} do ${Math.max(...p.gaps)}. Największą lukę ${p.maxGap} mają: ${p.leaders.map((f) => `${f.unitId} ${f.unitName}`).join(', ')}. Zapisane poziomy obszarów to: ${p.findings.map((f) => `${f.unitId} od ${f.currentLevel ?? 'nieustalonego'} do ${f.targetLevel ?? 'nieustalonego'}, luka ${f.gap ?? 'nieustalona'}`).join('; ')}. Dane pochodzą z ${p.sourceGenitive}. Każdy stan dowodowy zachowuje znaczenie zapisane w kontrakcie i nie jest wzmacniany. Zestawienie nie dodaje benchmarku ani oceny rynkowej; pokazuje wyłącznie poziomy, luki, stany dowodowe i pominięcia zapisane dla tej osi.`,
  chapterConclusion: (p) =>
    `Na osi ${p.axisId} oceniono ${p.findings.length} z ${p.totalAreas} obszarów. Największa luka wynosi ${p.maxGap}, a liczba pominięć wynosi ${p.skipped}. ${p.cited.map((f) => `${f.unitId} ${f.unitName}: poziom obecny ${f.currentLevel ?? 'nieustalony'}, poziom docelowy ${f.targetLevel ?? 'nieustalony'}, luka ${f.gap ?? 'nieustalona'}, pewność ${narrativePl.confidence[f.confidence]}, liczba dowodów ${f.evidenceCount}. ${f.recommendation.trim() ? `Rekomendacja ${f.unitId}: „${f.recommendation.trim()}”` : `Obszar ${f.unitId} nie ma zapisanej rekomendacji`}.${f.expectedOutcome ? ` Oczekiwany rezultat ${f.unitId}: „${f.expectedOutcome}”.` : ''}`).join(' ')} Zapisane poziomy i luki wynoszą: ${p.findings.map((f) => `${f.unitId}: ${f.currentLevel ?? 'nieustalony'} do ${f.targetLevel ?? 'nieustalony'}, luka ${f.gap ?? 'nieustalona'}`).join('; ')}. Wnioski cytują treść zapisaną w findingach i zachowują ich identyfikatory; nie dodają porównania rynkowego ani własnej diagnozy.`,
  gapRange: (gaps) =>
    gaps.length
      ? `Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}`
      : 'Żaden obszar nie ma policzalnej luki',
  programSummary: (p) =>
    `Ocena obejmuje ${p.axisCount} osi i ${p.totalAreas} obszarów. Finding istnieje dla ${p.findings.length} obszarów. Stan udokumentowany dotyczy ${p.states.evidenced} obszarów, stan niepełny ${p.states.incomplete}, a stan zadeklarowany ${p.states.declared}. ${p.gapRange}, a liczba luk krytycznych wynosi ${p.criticalCount}. Trzy pierwsze obszary po uporządkowaniu malejąco według luki to ${p.leaders.map((f) => `${f.unitId} ${f.unitName} z luką ${f.gap ?? 'nieustaloną'}`).join(', ')}. Ich poziomy obecne to ${p.leaders.map((f) => `${f.unitId}: ${f.currentLevel ?? 'nieustalony'}`).join(', ')}, a docelowe ${p.leaders.map((f) => `${f.unitId}: ${f.targetLevel ?? 'nieustalony'}`).join(', ')}. Zestawienie opiera się na ${p.sourceLocative}, poziomach, lukach i stanach dowodowych. Jest to obraz policzalny, ograniczony do danych obecnych w zaakceptowanym kontrakcie raportu. Nie korzysta z benchmarku branżowego i nie dodaje oceny jakościowej poza zamrożonymi etykietami priorytetu oraz wiarygodności.`,
  criticalGaps: (p) =>
    `Liczba obszarów z luką co najmniej 3 wynosi ${p.criticalCount}. Największa luka wynosi ${p.maxGap}. ${p.findings.map((f) => `${f.unitId} ${f.unitName}, luka ${f.gap}, ${p.recommendationQuote(f.recommendation)}.`).join(' ')} Dla tych obszarów zapisano poziomy obecne ${p.findings.map((f) => `${f.unitId}: ${f.currentLevel}`).join(', ')} i docelowe ${p.findings.map((f) => `${f.unitId}: ${f.targetLevel}`).join(', ')}. Każdy cytat zachowuje treść zapisaną w findingu i jego identyfikator. Treść jest cytowana z findingów bez parafrazy. Kolejność wynika wyłącznie z wielkości luki i identyfikatora obszaru; nie zawiera benchmarku ani prognozy.`,
  limitationsClause: (source, values) =>
    values.length
      ? ` Ograniczenia ${source}: ${values.map((value) => `„${value}”`).join('; ')}.`
      : '',
  finalConclusions: (p) =>
    `W całym programie oceniono ${p.findingCount} z ${p.totalAreas} obszarów w ${p.axisCount} osiach. ${p.gapRange}, a liczba luk krytycznych wynosi ${p.criticalCount}. Stan udokumentowany dotyczy ${p.states.evidenced} obszarów, niepełny ${p.states.incomplete}, a zadeklarowany ${p.states.declared}. ${p.findings.map((f) => `${f.unitId} ${f.unitName}: poziom obecny ${f.currentLevel ?? 'nieustalony'}, docelowy ${f.targetLevel ?? 'nieustalony'}, luka ${f.gap ?? 'nieustalona'}; ${p.recommendationQuote(f.recommendation)}${f.expectedOutcome ? `; oczekiwany rezultat: „${f.expectedOutcome}”` : ''}.`).join(' ')}${p.limitationsClause} Synteza nie dodaje porównań rynkowych, horyzontu czasowego ani prognozy. Wszystkie liczby pochodzą z findingów albo z policzalnych mianowników kontraktu.`,
  chapterDirection: (id, gap, axis) =>
    `Skoncentrować działania na obszarze ${id} o największej luce ${gap} na osi ${axis}.`,
  chapterPriority: (priority, gap, axis) =>
    `Priorytet ${priority} wynika z największej luki ${gap} na osi ${axis}.`,
  programDirection: (id, gap) =>
    `Skoncentrować program na obszarze ${id} oraz pozostałych lukach o wartości ${gap}.`,
  programPriority: (priority, gap) =>
    `Priorytet ${priority} wynika z największej luki ${gap} w całym programie.`,
  successCondition: (id, outcome) => `Warunek sukcesu dla ${id}: ${outcome}.`,
  areaFacts: (p) => [
    `Stan faktyczny: poziom obecny ${p.currentLevel ?? 'nieustalony'}${p.currentLabel ? ` — ${p.currentLabel}` : ''}; liczba dowodów: ${p.evidenceCount}.`,
    `Ocena i wiarygodność: pewność ${p.confidence}, stan dowodów ${p.evidenceState}${p.contradictionCount > 0 ? `, liczba dowodów przeciwnych: ${p.contradictionCount}` : ''}.`,
  ],
  assessorNote: (note) => `Notatka oceniającego: ${note}`,
  areaGap: (p) =>
    `Luka: ${p.gap ?? 'nieustalona'}; priorytet: ${p.priority}; poziom docelowy ${p.targetLevel ?? 'nieustalony'}${p.targetLabel ? ` — ${p.targetLabel}` : ''}.`,
  areaMissing: (business, recommendation) =>
    `Brak treści wymaganej do pełnego komentarza: ${[business ? 'znaczenie dla przedsiębiorstwa' : null, recommendation ? 'najbliższy krok' : null].filter(Boolean).join(' oraz ')}.`,
  businessMeaning: (value) => `Znaczenie dla przedsiębiorstwa: ${value}`,
  targetLevelPart: (level, label) =>
    `poziom docelowy ${level ?? 'nieustalony'}${label ? ` — ${label}` : ''}`,
  gapPart: (gap) => `luka ${gap ?? 'nieustalona'}`,
  priorityPart: (priority) => `priorytet ${priority}`,
  targetMeaning: (parts) => `Luka i sens poziomu docelowego: ${parts.join('; ')}.`,
  nextStep: (value) => `Najbliższy krok: ${value}`,
  optional: (prefix, value) =>
    `${prefix === 'prerequisite' ? 'Warunek' : prefix === 'expectedOutcome' ? 'Oczekiwany rezultat' : 'Hipoteza przyczyny'}: ${value}`,
};

const narrativeEn: NarrativeGrammar = {
  confidence: { low: 'low', medium: 'medium', high: 'high' },
  evidenceState: {
    evidenced: 'evidenced',
    incomplete: 'incomplete',
    declared: 'declared',
    not_assessed: 'not assessed',
  },
  source: {
    'method-core': {
      genitive: 'the frozen methodology core Output',
      locative: 'the frozen methodology core Output',
    },
    legacy: { genitive: 'the recorded assessment', locative: 'the recorded assessment' },
  },
  unset: { masculine: 'not established', feminine: 'not established', genitive: 'not established' },
  recommendationQuote: (value) =>
    value.trim() ? `recommendation: “${value.trim()}”` : 'no recommendation recorded',
  chapterIntroduction: (p) =>
    `Axis ${p.axisId}, ${p.axisName}, covers ${p.totalAreas} areas. ${p.assessed} of ${p.totalAreas} areas were assessed, with ${p.skipped} skipped. Current levels range from ${Math.min(...p.current)} to ${Math.max(...p.current)}, while target levels range from ${Math.min(...p.target)} to ${Math.max(...p.target)}. The evidenced state applies to ${p.states.evidenced} areas, the incomplete state to ${p.states.incomplete}, and the declared state to ${p.states.declared}. Gaps range from ${Math.min(...p.gaps)} to ${Math.max(...p.gaps)}. The largest gap, ${p.maxGap}, occurs in: ${p.leaders.map((f) => `${f.unitId} ${f.unitName}`).join(', ')}. Recorded area levels are: ${p.findings.map((f) => `${f.unitId} from ${f.currentLevel ?? 'not established'} to ${f.targetLevel ?? 'not established'}, gap ${f.gap ?? 'not established'}`).join('; ')}. The data comes from ${p.sourceGenitive}. Each evidence state retains the meaning recorded in the contract and is not strengthened. This summary adds no benchmark or market assessment; it shows only the levels, gaps, evidence states, and omissions recorded for this axis.`,
  chapterConclusion: (p) =>
    `On axis ${p.axisId}, ${p.findings.length} of ${p.totalAreas} areas were assessed. The largest gap is ${p.maxGap}, with ${p.skipped} areas skipped. ${p.cited.map((f) => `${f.unitId} ${f.unitName}: current level ${f.currentLevel ?? 'not established'}, target level ${f.targetLevel ?? 'not established'}, gap ${f.gap ?? 'not established'}, confidence ${narrativeEn.confidence[f.confidence]}, evidence count ${f.evidenceCount}. ${f.recommendation.trim() ? `Recommendation ${f.unitId}: “${f.recommendation.trim()}”` : `Area ${f.unitId} has no recorded recommendation`}.${f.expectedOutcome ? ` Expected outcome ${f.unitId}: “${f.expectedOutcome}”.` : ''}`).join(' ')} Recorded levels and gaps are: ${p.findings.map((f) => `${f.unitId}: ${f.currentLevel ?? 'not established'} to ${f.targetLevel ?? 'not established'}, gap ${f.gap ?? 'not established'}`).join('; ')}. These conclusions quote the content recorded in the findings and retain their identifiers; they add no market comparison or independent diagnosis.`,
  gapRange: (gaps) =>
    gaps.length
      ? `Gaps range from ${Math.min(...gaps)} to ${Math.max(...gaps)}`
      : 'No area has a measurable gap',
  programSummary: (p) =>
    `The assessment covers ${p.axisCount} axes and ${p.totalAreas} areas. A finding exists for ${p.findings.length} areas. The evidenced state applies to ${p.states.evidenced} areas, the incomplete state to ${p.states.incomplete}, and the declared state to ${p.states.declared}. ${p.gapRange}, and there are ${p.criticalCount} critical gaps. The first three areas in descending gap order are ${p.leaders.map((f) => `${f.unitId} ${f.unitName} with a gap of ${f.gap ?? 'not established'}`).join(', ')}. Their current levels are ${p.leaders.map((f) => `${f.unitId}: ${f.currentLevel ?? 'not established'}`).join(', ')}, and their target levels are ${p.leaders.map((f) => `${f.unitId}: ${f.targetLevel ?? 'not established'}`).join(', ')}. The summary is based on ${p.sourceLocative}, levels, gaps, and evidence states. It is a measurable view limited to data present in the accepted report contract. It uses no industry benchmark and adds no qualitative judgement beyond the frozen priority and confidence labels.`,
  criticalGaps: (p) =>
    `There are ${p.criticalCount} areas with a gap of at least 3. The largest gap is ${p.maxGap}. ${p.findings.map((f) => `${f.unitId} ${f.unitName}, gap ${f.gap}, ${p.recommendationQuote(f.recommendation)}.`).join(' ')} Recorded current levels for these areas are ${p.findings.map((f) => `${f.unitId}: ${f.currentLevel}`).join(', ')}, and target levels are ${p.findings.map((f) => `${f.unitId}: ${f.targetLevel}`).join(', ')}. Every quotation retains the content stored in the finding and its identifier. Finding content is quoted without paraphrase. Ordering follows only gap size and area identifier; it contains no benchmark or forecast.`,
  limitationsClause: (source, values) =>
    values.length
      ? ` Limitations of ${source}: ${values.map((value) => `“${value}”`).join('; ')}.`
      : '',
  finalConclusions: (p) =>
    `Across the programme, ${p.findingCount} of ${p.totalAreas} areas were assessed in ${p.axisCount} axes. ${p.gapRange}, and there are ${p.criticalCount} critical gaps. The evidenced state applies to ${p.states.evidenced} areas, the incomplete state to ${p.states.incomplete}, and the declared state to ${p.states.declared}. ${p.findings.map((f) => `${f.unitId} ${f.unitName}: current level ${f.currentLevel ?? 'not established'}, target level ${f.targetLevel ?? 'not established'}, gap ${f.gap ?? 'not established'}; ${p.recommendationQuote(f.recommendation)}${f.expectedOutcome ? `; expected outcome: “${f.expectedOutcome}”` : ''}.`).join(' ')}${p.limitationsClause} This synthesis adds no market comparisons, time horizon, or forecast. Every number comes from the findings or measurable denominators in the contract.`,
  chapterDirection: (id, gap, axis) =>
    `Focus action on area ${id}, which has the largest gap of ${gap} on axis ${axis}.`,
  chapterPriority: (priority, gap, axis) =>
    `${priority} priority follows from the largest gap of ${gap} on axis ${axis}.`,
  programDirection: (id, gap) =>
    `Focus the programme on area ${id} and the remaining gaps of ${gap}.`,
  programPriority: (priority, gap) =>
    `${priority} priority follows from the largest gap of ${gap} across the programme.`,
  successCondition: (id, outcome) => `Success condition for ${id}: ${outcome}.`,
  areaFacts: (p) => [
    `Current state: current level ${p.currentLevel ?? 'not established'}${p.currentLabel ? ` — ${p.currentLabel}` : ''}; evidence count: ${p.evidenceCount}.`,
    `Assessment and confidence: confidence ${p.confidence}, evidence state ${p.evidenceState}${p.contradictionCount > 0 ? `, contradicting evidence count: ${p.contradictionCount}` : ''}.`,
  ],
  assessorNote: (note) => `Assessor note: ${note}`,
  areaGap: (p) =>
    `Gap: ${p.gap ?? 'not established'}; priority: ${p.priority}; target level ${p.targetLevel ?? 'not established'}${p.targetLabel ? ` — ${p.targetLabel}` : ''}.`,
  areaMissing: (business, recommendation) =>
    `Content required for a full comment is missing: ${[business ? 'business meaning' : null, recommendation ? 'next step' : null].filter(Boolean).join(' and ')}.`,
  businessMeaning: (value) => `Business meaning: ${value}`,
  targetLevelPart: (level, label) =>
    `target level ${level ?? 'not established'}${label ? ` — ${label}` : ''}`,
  gapPart: (gap) => `gap ${gap ?? 'not established'}`,
  priorityPart: (priority) => `priority ${priority}`,
  targetMeaning: (parts) => `Gap and rationale for the target level: ${parts.join('; ')}.`,
  nextStep: (value) => `Next step: ${value}`,
  optional: (prefix, value) =>
    `${prefix === 'prerequisite' ? 'Prerequisite' : prefix === 'expectedOutcome' ? 'Expected outcome' : 'Root-cause hypothesis'}: ${value}`,
};

export const ASSESSMENT_NARRATIVE_I18N: Record<ReportLanguage, NarrativeGrammar> = {
  pl: narrativePl,
  en: narrativeEn,
};

export function assessmentNarrativeI18n(language: ReportLanguage): NarrativeGrammar {
  return ASSESSMENT_NARRATIVE_I18N[language];
}

export interface ReportI18nShape {
  reportTitle: string;
  clientMissing: string;
  executiveSummary: string;
  criticalGaps: string;
  finalConclusions: string;
  appendix: string;
  methodologyAppendix: string;
  notAssessed: string;
  decisionLineLabel: string;
  programDecisionHeading: string;
  purposeSummary: string;
  purposeChapter: (index: number, total: number, axisId: number) => string;
  purposeSynthesis: string;
  purposeAppendix: string;
  axisSummaryCaption: string;

  /** [ODMROZENIE 04_ASSESSMENT DEC-510] G1/K3 — podpis matrycy jest częścią
   * wspólnego słownika raportu. Wariant PL pozostaje kopią 1:1 starego
   * literału z kompozytora. */
  matrixCaptionSentence: (params: {
    totalAreas: number;
    axisId: number;
    maxLevel: number;
    sourceKind: 'method-core' | 'legacy';
    frozenDate: string;
  }) => string;

  /** Okładkowe „Zatrudnienie”: 340 osób / 340 employees. Liczebnik polski ma
   * własną odmianę (1 osoba / 2 osoby / 5 osób), angielski tylko l.mn. */
  coverEmploymentValue: (count: number) => string;

  radarTitle: string;
  radarSeriesCurrent: string;
  radarSeriesTarget: string;
  radarCaption: string;

  axisSummaryHeaders: readonly [string, string, string, string];
  axisColumn: string;

  matrixHeading: string;
  matrixAreaColumn: string;
  matrixGapColumn: string;
  matrixPriorityColumn: string;
  areasHeading: string;

  decisionFieldColumn: string;
  decisionContentColumn: string;
  decisionDirection: string;
  decisionPriority: string;
  decisionHorizon: string;
  decisionSuccessCondition: string;
  horizonPlaceholder: string;
  chapterConclusionHeading: string;

  gapRegisterHeaders: readonly [string, string, string, string, string];
  gapRegisterCaption: string;

  methodologyScope: (axisCount: number, areaCount: number) => string;
  methodologyAxesHeaders: readonly [string, string, string, string];
  methodologyAxesCaption: string;
  methodologySourceHeading: string;
  methodologySourceLegacy: (methodVersion: string, sessionId: string) => string;
  methodologySourceCore: (revision: number, methodVersion: string, sessionId: string) => string;
  methodologyHonesty: string;
  methodologyName: string;
  /** `contract.methodVersion` dla oceny ZASTANEJ (legacy) — jedyny fixed-string
   * przekazywany dziś w `ReportContractInput.methodVersion` z magazynu
   * zastanego (jądro metodyczne podaje własną wersję paczki, poza zakresem).
   * S1.4b: wcześniej zaszyte na sztywno PO POLSKU w
   * `assessmentLegacyReportContractService.ts`, wyciekało do angielskich
   * eksportów przez `methodologySourceLegacy`/deck "Methodology:" bullet. */
  legacyMethodVersionLabel: string;

  /** Jedyne `limitations[]` oceny ZASTANEJ — zdanie wstawiane dotąd na sztywno
   * PO POLSKU w `assessmentLegacyReportContractService.ts`. Silnik narracji
   * cytuje je dosłownie do `finalConclusions`, więc w raporcie EN wyciekało 6
   * polskich diakrytyków. Rodzeństwo długu `legacyMethodVersionLabel` — DEC-461/R1. */
  legacyLimitation: string;

  sectionPlaceholder: string;
  areaNotAssessedSentence: (unitId: string) => string;
  areaCommentPlaceholder: (unitId: string) => string;
  skipNoticeWhole: (labels: string) => string;
  skipNoticePartial: (items: string) => string;
  signatureLine: (params: {
    currentLevel: number | null;
    currentLabel: string;
    targetLevel: number | null;
    targetLabel: string;
    gap: number | null;
    priority: string;
    evidence: string;
  }) => string;

  priorityCritical: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityMaintain: string;
  priorityDash: string;

  evidenceEvidenced: string;
  evidenceIncomplete: string;
  evidenceDeclared: string;
  evidenceNotAssessed: string;

  skipOutsideOperatingModel: string;
  skipOutsideEngagementScope: string;
  skipDeferredToNextRevision: string;
  skipReplacedByOtherSolution: string;

  coverKicker2: string;
  coverMissing: string;
  coverClient: string;
  coverBusinessProfile: string;
  coverEmployment: string;
  coverAssessmentPeriod: string;
  coverAssessor: string;
  coverClientSponsor: string;
  coverMethodology: string;
  coverSessionSignature: string;
  coverIssuedDate: string;
  coverAssessmentUpdatedSuffix: (date: string) => string;

  deckReportKicker: string;
  deckMethodologyBullet: (methodVersion: string) => string;
  deckIssuedBullet: (date: string) => string;
  deckScopeBullet: (axisCount: number, areaCount: number) => string;
  deckAgendaKicker: string;
  deckAgendaItems: readonly string[];
  deckContextKicker: string;
  deckContextTitle: string;
  deckContextHeaders: readonly [string, string];
  deckContextOrganization: string;
  deckContextSubject: string;
  deckContextBusinessProfile: string;
  deckContextEmployment: string;
  deckContextAssessmentPeriod: string;
  deckContextAssessor: string;
  deckContextSourceLabel: string;
  deckContextSourceLegacy: string;
  deckContextSourceCore: string;
  deckContextCoverageLabel: string;
  deckContextCoverage: (assessed: number, total: number) => string;
  deckNoDataInAssessment: string;
  deckOverallKicker: string;
  deckOverallTitle: string;
  deckSeriesCurrent: string;
  deckSeriesTarget: string;
  deckOverallTakeaway: (critical: number, total: number) => string;
  deckAxisOf: (axisId: number, total: number) => string;
  deckAxisStatCaption: (assessed: number, total: number) => string;
  deckAxisMaxGap: (gap: number | string) => string;
  deckAxisCriticalCount: (count: number) => string;
  deckAxisTableHeaders: readonly [string, string, string, string];
  deckAxisTakeawayNoGaps: string;
  deckAxisTakeawayPriority: (priority: string) => string;
  deckGapRegisterKicker: string;
  deckGapRegisterTitle: string;
  deckGapRegisterHeaders: readonly [string, string, string, string];
  deckGapRegisterTakeaway: (total: number, shown: number) => string;
  deckGapRegisterLevelPrefix: string;
  deckPrioritiesKicker: string;
  deckPrioritiesTitle: string;
  deckPrioritiesHeaders: readonly [string, string];
  deckPrioritiesDirectionMissing: string;
  deckPrioritiesPriorityMissing: string;
  deckPrioritiesRecommendationLegacy: string;
  deckPrioritiesRecommendationCore: string;
  deckNextStepsKicker: string;
  deckNextStepsTitle: string;
  deckNextStepsConfirm: (count: number) => string;
  deckNextStepsFillMissing: (count: number) => string;
  deckNextStepsAllCovered: string;
  deckNextStepsOwner: string;
  deckNextStepsHorizon: string;
  deckNextStepsApprove: string;
  deckTitle: (client: string) => string;
  deckConfidentiality: (client: string) => string;
  deckClientMissing: string;
  deckNoAreasFallbackRow: readonly [string, string, string, string];
  deckPdfSubject: string;
}

const pl: ReportI18nShape = {
  reportTitle: 'Raport z oceny dojrzałości cyfrowej',
  clientMissing: '[Nazwa klienta do uzupełnienia]',
  executiveSummary: 'Streszczenie zarządcze',
  criticalGaps: 'Luki krytyczne i rekomendacja główna',
  finalConclusions: 'Wnioski końcowe',
  appendix: 'Załącznik A. Rejestr luk',
  methodologyAppendix: 'Załącznik B. Nota metodyczna',
  notAssessed: 'Oś nie została oceniona.',
  decisionLineLabel: 'LINIA DECYZYJNA',
  programDecisionHeading: 'Linia decyzyjna programu',
  purposeSummary: 'STRESZCZENIE',
  purposeChapter: (index, total, axisId) =>
    `Rozdział ${index} z ${total} · oś ${axisId} struktury DRD`,
  purposeSynthesis: 'SYNTEZA',
  purposeAppendix: 'ZAŁĄCZNIK',
  axisSummaryCaption: 'Zestawienie siedmiu osi DRD.',
  matrixCaptionSentence: ({ totalAreas, axisId, maxLevel, sourceKind, frozenDate }) =>
    `Tabela obejmuje ${totalAreas} obszarów osi ${axisId}. Kolumny poziomów pokazują skalę od 1 do ${maxLevel}; Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika z wielkości luki. Źródłem są dane ${sourceKind === 'legacy' ? 'zapisanej oceny' : 'zamrożonego Outputu'} z dnia ${frozenDate}.`,
  coverEmploymentValue: (count) => {
    const abs = Math.abs(Math.trunc(count));
    if (abs === 1) return '1 osoba';
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    const plural = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'osoby' : 'osób';
    return `${abs} ${plural}`;
  },

  radarTitle: 'Profil dojrzałości DRD',
  radarSeriesCurrent: 'Poziom obecny · stan oceny',
  radarSeriesTarget: 'Poziom docelowy · horyzont docelowy',
  radarCaption: 'Profil dojrzałości cyfrowej według siedmiu osi DRD.',

  axisSummaryHeaders: ['Oś', 'Obecny', 'Docelowy', 'Luki krytyczne'],
  axisColumn: 'Oś',

  matrixHeading: 'Matryca poziomów dojrzałości',
  matrixAreaColumn: 'Obszar',
  matrixGapColumn: 'Luka',
  matrixPriorityColumn: 'Priorytet',
  areasHeading: 'Ocena obszarów',

  decisionFieldColumn: 'Pole',
  decisionContentColumn: 'Treść',
  decisionDirection: 'Kierunek',
  decisionPriority: 'Priorytet',
  decisionHorizon: 'Horyzont',
  decisionSuccessCondition: 'Warunek sukcesu',
  horizonPlaceholder: 'Nie określono — brak źródła w danych.',
  chapterConclusionHeading: 'Wnioski rozdziału',

  gapRegisterHeaders: ['Obszar', 'Oś', 'Priorytet', 'Luka', 'Poziom docelowy'],
  gapRegisterCaption: 'Rejestr luk posortowany malejąco według wielkości luki.',

  methodologyScope: (axisCount, areaCount) =>
    `Ocena została przeprowadzona według struktury DRD: ${axisCount} osi i ${areaCount} obszarów. Każdy obszar ma zapisany poziom obecny i poziom docelowy na skali własnej dla swojej osi. Luka jest różnicą poziomu docelowego i obecnego; priorytet wynika wyłącznie z wielkości luki i nie jest oceną ekspercką. Kolumna „Obecny" i „Docelowy" w zestawieniu osi to średnia poziomów obszarów tej osi wyrażona jako procent maksymalnego poziomu osi.`,
  methodologyAxesHeaders: ['Oś', 'Nazwa', 'Liczba obszarów', 'Skala poziomów'],
  methodologyAxesCaption: 'Struktura metodyki DRD użyta w tej ocenie.',
  methodologySourceHeading: 'Źródło danych i ograniczenia',
  methodologySourceLegacy: (methodVersion, sessionId) =>
    `Źródłem wyniku jest ocena prowadzona w warsztacie DRD (magazyn zastany), nie zamrożony Output jądra metodycznego. Oznacza to, że poziomy zostały zadeklarowane przez oceniającego i nie mają załączonych dowodów; kolumna stanu dowodowego w całym raporcie przyjmuje wartość „zadeklarowane". Wersja metodyki zapisana przy tej ocenie: ${methodVersion}. Sygnatura oceny: ${sessionId}.`,
  methodologySourceCore: (revision, methodVersion, sessionId) =>
    `Źródłem wyniku jest zamrożony Output jądra metodycznego, rewizja ${revision}. Stan dowodowy każdego obszaru wynika z liczby dowodów zapisanych przy findingu. Wersja paczki metodycznej: ${methodVersion}. Sygnatura sesji: ${sessionId}.`,
  methodologyHonesty:
    'Raport nie zawiera porównania z rynkiem, prognozy ani horyzontu czasowego — te dane nie istnieją w ocenie i nie zostały dopisane. Obszar bez zapisanego poziomu jest oznaczony jako nieoceniony, a nie jako poziom zerowy.',
  methodologyName: 'Digital Pathfinder — metodyka oceny dojrzałości cyfrowej DRD',
  legacyMethodVersionLabel:
    'DRD 7 osi / 39 obszarów (ocena zastana — bez przypiętej wersji paczki)',
  legacyLimitation:
    'Wynik pochodzi z oceny prowadzonej w warsztacie DRD (magazyn zastany), nie z zamrożonego Outputu jądra metodycznego — poziomy są zadeklarowane, bez załączonych dowodów.',

  sectionPlaceholder:
    'Brak treści w tej sekcji — ocena nie zawiera danych, z których dałoby się ją napisać.',
  areaNotAssessedSentence: (unitId) => `Obszaru ${unitId} nie oceniono — brak danych źródłowych.`,
  areaCommentPlaceholder: (unitId) => `Komentarz obszaru ${unitId} nie został przygotowany.`,
  skipNoticeWhole: (labels) => `Obszar pominięty w ocenie — kod: ${labels}.`,
  skipNoticePartial: (items) => `Pominięte pytania: ${items}.`,
  signatureLine: ({
    currentLevel,
    currentLabel,
    targetLevel,
    targetLabel,
    gap,
    priority,
    evidence,
  }) =>
    `Poziom obecny: ${currentLevel ?? '—'} (${currentLevel ? currentLabel : '—'}) · Poziom docelowy: ${targetLevel ?? '—'} (${targetLevel ? targetLabel : '—'}) · Luka: ${gap ?? '—'} · Priorytet: ${priority} · Dowody: ${evidence}`,

  priorityCritical: 'Krytyczny',
  priorityHigh: 'Wysoki',
  priorityMedium: 'Średni',
  priorityMaintain: 'Utrzymanie',
  priorityDash: '—',

  evidenceEvidenced: 'udokumentowane',
  evidenceIncomplete: 'niepełne',
  evidenceDeclared: 'zadeklarowane',
  evidenceNotAssessed: 'nieocenione',

  skipOutsideOperatingModel: 'poza modelem operacyjnym',
  skipOutsideEngagementScope: 'poza zakresem zlecenia',
  skipDeferredToNextRevision: 'odroczone do kolejnej rewizji',
  skipReplacedByOtherSolution: 'zastąpione innym rozwiązaniem',

  coverKicker2: 'OCENA DOJRZAŁOŚCI CYFROWEJ · DIGITAL PATHFINDER',
  coverMissing: 'Do uzupełnienia — dane nie są zapisane w sesji oceny.',
  coverClient: 'Klient',
  coverBusinessProfile: 'Profil działalności',
  coverEmployment: 'Zatrudnienie',
  coverAssessmentPeriod: 'Okres oceny',
  coverAssessor: 'Oceniający',
  coverClientSponsor: 'Sponsor po stronie klienta',
  coverMethodology: 'Metodyka',
  coverSessionSignature: 'Sygnatura sesji',
  coverIssuedDate: 'Data wydania',
  coverAssessmentUpdatedSuffix: (date) => ` · Ocena zaktualizowana: ${date}`,

  deckReportKicker: 'Raport z oceny dojrzałości cyfrowej',
  deckMethodologyBullet: (methodVersion) => `Metodyka: ${methodVersion}`,
  deckIssuedBullet: (date) => `Data wydania: ${date}`,
  deckScopeBullet: (axisCount, areaCount) => `Zakres: ${axisCount} osi, ${areaCount} obszarów`,
  deckAgendaKicker: 'Plan prezentacji',
  deckAgendaItems: [
    'Kontekst oceny i źródło danych',
    'Wynik ogólny — profil siedmiu osi',
    'Oś po osi: co zmierzono i gdzie jest luka',
    'Rejestr luk — obszary o największym dystansie',
    'Priorytety wynikające z luk',
    'Następne kroki',
  ],
  deckContextKicker: 'Kontekst',
  deckContextTitle: 'Skąd pochodzi ten wynik',
  deckContextHeaders: ['Pole', 'Wartość'],
  deckContextOrganization: 'Organizacja',
  deckContextSubject: 'Przedmiot oceny',
  deckContextBusinessProfile: 'Profil działalności',
  deckContextEmployment: 'Zatrudnienie',
  deckContextAssessmentPeriod: 'Okres oceny',
  deckContextAssessor: 'Oceniający',
  deckContextSourceLabel: 'Źródło wyniku',
  deckContextSourceLegacy:
    'Ocena prowadzona w warsztacie DRD — poziomy zadeklarowane, bez załączonych dowodów',
  deckContextSourceCore: 'Zamrożony Output jądra metodycznego',
  deckContextCoverageLabel: 'Pokrycie',
  deckContextCoverage: (assessed, total) => `${assessed} z ${total} obszarów ma zapisany poziom`,
  deckNoDataInAssessment: 'Brak danych w ocenie',
  deckOverallKicker: 'Wynik ogólny',
  deckOverallTitle: 'Profil dojrzałości na siedmiu osiach',
  deckSeriesCurrent: 'Poziom obecny',
  deckSeriesTarget: 'Poziom docelowy',
  deckOverallTakeaway: (critical, total) =>
    `Luk krytycznych (dystans co najmniej 3 poziomy): ${critical} z ${total} zmierzonych obszarów.`,
  deckAxisOf: (axisId, total) => `Oś ${axisId} z ${total}`,
  deckAxisStatCaption: (assessed, total) =>
    `Poziom obecny wobec docelowego; oceniono ${assessed} z ${total} obszarów.`,
  deckAxisMaxGap: (gap) => `Największa luka na osi: ${gap}`,
  deckAxisCriticalCount: (count) => `Obszary z luką co najmniej 3: ${count}`,
  deckAxisTableHeaders: ['Obszar', 'Ob.', 'Doc.', 'Luka'],
  deckAxisTakeawayNoGaps: 'Brak zmierzonych luk na tej osi.',
  deckAxisTakeawayPriority: (priority) => `Priorytet osi: ${priority}.`,
  deckGapRegisterKicker: 'Macierz DRD',
  deckGapRegisterTitle: 'Obszary o największej luce',
  deckGapRegisterHeaders: ['Obszar', 'Oś', 'Luka', 'Poziom docelowy'],
  deckGapRegisterTakeaway: (total, shown) =>
    `Rejestr obejmuje ${total} obszarów ze zmierzoną luką; pokazano ${shown} największych.`,
  deckGapRegisterLevelPrefix: 'poziom',
  deckPrioritiesKicker: 'Priorytety',
  deckPrioritiesTitle: 'Co wynika z rozkładu luk',
  deckPrioritiesHeaders: ['Priorytet', 'Liczba obszarów'],
  deckPrioritiesDirectionMissing: 'Kierunek: brak danych w ocenie',
  deckPrioritiesPriorityMissing: 'Priorytet: brak danych w ocenie',
  deckPrioritiesRecommendationLegacy:
    'Rekomendacje per obszar nie zostały zapisane w tej ocenie — priorytet wynika wyłącznie z wielkości luki.',
  deckPrioritiesRecommendationCore:
    'Rekomendacje per obszar pochodzą z findingów zamrożonego Outputu.',
  deckNextStepsKicker: 'Następne kroki',
  deckNextStepsTitle: 'Od wyniku do działania',
  deckNextStepsConfirm: (count) =>
    `Potwierdzić poziomy w ${count} obszarach z luką co najmniej 3 i uzupełnić dowody.`,
  deckNextStepsFillMissing: (count) =>
    `Uzupełnić ${count} obszarów bez zapisanego poziomu albo świadomie je pominąć z uzasadnieniem.`,
  deckNextStepsAllCovered:
    'Wszystkie obszary metodyki mają zapisany poziom — zakres oceny jest zamknięty.',
  deckNextStepsOwner: 'Przypisać właściciela do każdego obszaru o priorytecie krytycznym.',
  deckNextStepsHorizon: 'Ustalić horyzont czasowy — ocena go nie zawiera i nie jest tu dopisywany.',
  deckNextStepsApprove: 'Zatwierdzić raport i przenieść luki do rejestru inicjatyw.',
  deckTitle: (client) => `Raport z oceny dojrzałości cyfrowej — ${client}`,
  deckConfidentiality: (client) => `Poufne — ${client}`,
  deckClientMissing: 'Klient do uzupełnienia',
  deckNoAreasFallbackRow: ['Brak zmierzonych obszarów', '—', '—', '—'],
  deckPdfSubject: 'Raport z oceny dojrzałości cyfrowej DRD',
};

const en: ReportI18nShape = {
  reportTitle: 'Digital Maturity Assessment Report',
  clientMissing: '[Client name to be completed]',
  executiveSummary: 'Executive Summary',
  criticalGaps: 'Critical Gaps and Main Recommendation',
  finalConclusions: 'Final Conclusions',
  appendix: 'Appendix A. Gap Register',
  methodologyAppendix: 'Appendix B. Methodology Note',
  notAssessed: 'This axis was not assessed.',
  decisionLineLabel: 'DECISION LINE',
  programDecisionHeading: 'Program decision line',
  purposeSummary: 'SUMMARY',
  purposeChapter: (index, total, axisId) =>
    `Chapter ${index} of ${total} · axis ${axisId} of the DRD structure`,
  purposeSynthesis: 'SYNTHESIS',
  purposeAppendix: 'APPENDIX',
  axisSummaryCaption: 'Summary of the seven DRD axes.',
  matrixCaptionSentence: ({ totalAreas, axisId, maxLevel, sourceKind, frozenDate }) =>
    `The table covers ${totalAreas} areas of axis ${axisId}. The level columns show the scale from 1 to ${maxLevel}; Gap is the difference between the target level and the current level, and Priority follows from the size of the gap. The data comes from the ${sourceKind === 'legacy' ? 'recorded assessment' : 'frozen methodology core output'} of ${frozenDate}.`,
  coverEmploymentValue: (count) => {
    const abs = Math.abs(Math.trunc(count));
    return abs === 1 ? '1 employee' : `${abs} employees`;
  },

  radarTitle: 'DRD Maturity Profile',
  radarSeriesCurrent: 'Current level · assessment state',
  radarSeriesTarget: 'Target level · target horizon',
  radarCaption: 'Digital maturity profile across the seven DRD axes.',

  axisSummaryHeaders: ['Axis', 'Current', 'Target', 'Critical gaps'],
  axisColumn: 'Axis',

  matrixHeading: 'Maturity level matrix',
  matrixAreaColumn: 'Area',
  matrixGapColumn: 'Gap',
  matrixPriorityColumn: 'Priority',
  areasHeading: 'Area assessment',

  decisionFieldColumn: 'Field',
  decisionContentColumn: 'Content',
  decisionDirection: 'Direction',
  decisionPriority: 'Priority',
  decisionHorizon: 'Horizon',
  decisionSuccessCondition: 'Success condition',
  horizonPlaceholder: 'Not specified — no source in the data.',
  chapterConclusionHeading: 'Chapter conclusions',

  gapRegisterHeaders: ['Area', 'Axis', 'Priority', 'Gap', 'Target level'],
  gapRegisterCaption: 'Gap register sorted in descending order of gap size.',

  methodologyScope: (axisCount, areaCount) =>
    `The assessment was carried out using the DRD structure: ${axisCount} axes and ${areaCount} areas. Each area has a recorded current level and target level on a scale specific to its axis. The gap is the difference between the target and current level; priority follows solely from the size of the gap and is not an expert judgement. The "Current" and "Target" columns in the axis summary are the average of that axis's area levels, expressed as a percentage of the axis's maximum level.`,
  methodologyAxesHeaders: ['Axis', 'Name', 'Number of areas', 'Level scale'],
  methodologyAxesCaption: 'DRD methodology structure used in this assessment.',
  methodologySourceHeading: 'Data source and limitations',
  methodologySourceLegacy: (methodVersion, sessionId) =>
    `The result comes from an assessment run in the DRD workshop (legacy store), not from a frozen method-core Output. This means the levels were declared by the assessor without attached evidence; the evidence-state column throughout the report reads "declared". Methodology version recorded with this assessment: ${methodVersion}. Assessment signature: ${sessionId}.`,
  methodologySourceCore: (revision, methodVersion, sessionId) =>
    `The result comes from a frozen method-core Output, revision ${revision}. The evidence state of each area follows from the number of evidence items recorded against the finding. Method pack version: ${methodVersion}. Session signature: ${sessionId}.`,
  methodologyHonesty:
    'The report does not contain a market comparison, a forecast, or a time horizon — this data does not exist in the assessment and was not added. An area with no recorded level is marked as not assessed, never as a zero level.',
  methodologyName: 'Digital Pathfinder — DRD digital maturity assessment methodology',
  legacyMethodVersionLabel:
    'DRD 7 axes / 39 areas (legacy-store assessment — no method-pack version pinned)',
  legacyLimitation:
    'The result comes from an assessment run in the DRD workshop (legacy store), not from a frozen method-core Output — the levels are declared, without attached evidence.',

  sectionPlaceholder:
    'No content in this section — the assessment does not contain the data needed to write it.',
  areaNotAssessedSentence: (unitId) => `Area ${unitId} was not assessed — no source data.`,
  areaCommentPlaceholder: (unitId) => `The comment for area ${unitId} was not prepared.`,
  skipNoticeWhole: (labels) => `Area skipped in the assessment — code: ${labels}.`,
  skipNoticePartial: (items) => `Skipped questions: ${items}.`,
  signatureLine: ({
    currentLevel,
    currentLabel,
    targetLevel,
    targetLabel,
    gap,
    priority,
    evidence,
  }) =>
    `Current level: ${currentLevel ?? '—'} (${currentLevel ? currentLabel : '—'}) · Target level: ${targetLevel ?? '—'} (${targetLevel ? targetLabel : '—'}) · Gap: ${gap ?? '—'} · Priority: ${priority} · Evidence: ${evidence}`,

  priorityCritical: 'Critical',
  priorityHigh: 'High',
  priorityMedium: 'Medium',
  priorityMaintain: 'Maintain',
  priorityDash: '—',

  evidenceEvidenced: 'evidenced',
  evidenceIncomplete: 'incomplete',
  evidenceDeclared: 'declared',
  evidenceNotAssessed: 'not assessed',

  skipOutsideOperatingModel: 'outside the operating model',
  skipOutsideEngagementScope: 'outside the engagement scope',
  skipDeferredToNextRevision: 'deferred to the next revision',
  skipReplacedByOtherSolution: 'replaced by another solution',

  coverKicker2: 'DIGITAL MATURITY ASSESSMENT · DIGITAL PATHFINDER',
  coverMissing: 'To be completed — not recorded in the assessment session.',
  coverClient: 'Client',
  coverBusinessProfile: 'Business profile',
  coverEmployment: 'Employment',
  coverAssessmentPeriod: 'Assessment period',
  coverAssessor: 'Assessor',
  coverClientSponsor: 'Client-side sponsor',
  coverMethodology: 'Methodology',
  coverSessionSignature: 'Session signature',
  coverIssuedDate: 'Issued',
  coverAssessmentUpdatedSuffix: (date) => ` · Assessment updated: ${date}`,

  deckReportKicker: 'Digital Maturity Assessment Report',
  deckMethodologyBullet: (methodVersion) => `Methodology: ${methodVersion}`,
  deckIssuedBullet: (date) => `Issued: ${date}`,
  deckScopeBullet: (axisCount, areaCount) => `Scope: ${axisCount} axes, ${areaCount} areas`,
  deckAgendaKicker: 'Presentation plan',
  deckAgendaItems: [
    'Assessment context and data source',
    'Overall result — seven-axis profile',
    'Axis by axis: what was measured and where the gap is',
    'Gap register — areas with the largest distance',
    'Priorities arising from the gaps',
    'Next steps',
  ],
  deckContextKicker: 'Context',
  deckContextTitle: 'Where this result comes from',
  deckContextHeaders: ['Field', 'Value'],
  deckContextOrganization: 'Organization',
  deckContextSubject: 'Subject of assessment',
  deckContextBusinessProfile: 'Business profile',
  deckContextEmployment: 'Employment',
  deckContextAssessmentPeriod: 'Assessment period',
  deckContextAssessor: 'Assessor',
  deckContextSourceLabel: 'Result source',
  deckContextSourceLegacy:
    'Assessment run in the DRD workshop — levels declared, no attached evidence',
  deckContextSourceCore: 'Frozen method-core Output',
  deckContextCoverageLabel: 'Coverage',
  deckContextCoverage: (assessed, total) => `${assessed} of ${total} areas have a recorded level`,
  deckNoDataInAssessment: 'No data in the assessment',
  deckOverallKicker: 'Overall result',
  deckOverallTitle: 'Maturity profile across seven axes',
  deckSeriesCurrent: 'Current level',
  deckSeriesTarget: 'Target level',
  deckOverallTakeaway: (critical, total) =>
    `Critical gaps (distance of at least 3 levels): ${critical} of ${total} measured areas.`,
  deckAxisOf: (axisId, total) => `Axis ${axisId} of ${total}`,
  deckAxisStatCaption: (assessed, total) =>
    `Current level against target; ${assessed} of ${total} areas assessed.`,
  deckAxisMaxGap: (gap) => `Largest gap on this axis: ${gap}`,
  deckAxisCriticalCount: (count) => `Areas with a gap of at least 3: ${count}`,
  deckAxisTableHeaders: ['Area', 'Cur.', 'Tgt.', 'Gap'],
  deckAxisTakeawayNoGaps: 'No measured gaps on this axis.',
  deckAxisTakeawayPriority: (priority) => `Axis priority: ${priority}.`,
  deckGapRegisterKicker: 'DRD matrix',
  deckGapRegisterTitle: 'Areas with the largest gap',
  deckGapRegisterHeaders: ['Area', 'Axis', 'Gap', 'Target level'],
  deckGapRegisterTakeaway: (total, shown) =>
    `The register covers ${total} areas with a measured gap; ${shown} largest shown.`,
  deckGapRegisterLevelPrefix: 'level',
  deckPrioritiesKicker: 'Priorities',
  deckPrioritiesTitle: 'What the gap distribution shows',
  deckPrioritiesHeaders: ['Priority', 'Number of areas'],
  deckPrioritiesDirectionMissing: 'Direction: no data in the assessment',
  deckPrioritiesPriorityMissing: 'Priority: no data in the assessment',
  deckPrioritiesRecommendationLegacy:
    'Per-area recommendations were not recorded in this assessment — priority follows solely from gap size.',
  deckPrioritiesRecommendationCore:
    'Per-area recommendations come from the frozen Output findings.',
  deckNextStepsKicker: 'Next steps',
  deckNextStepsTitle: 'From result to action',
  deckNextStepsConfirm: (count) =>
    `Confirm the levels in ${count} areas with a gap of at least 3 and add supporting evidence.`,
  deckNextStepsFillMissing: (count) =>
    `Fill in ${count} areas with no recorded level, or deliberately skip them with a stated reason.`,
  deckNextStepsAllCovered:
    'Every area in the methodology has a recorded level — the assessment scope is closed.',
  deckNextStepsOwner: 'Assign an owner to every area with critical priority.',
  deckNextStepsHorizon:
    'Set a time horizon — the assessment does not contain one and none is added here.',
  deckNextStepsApprove: 'Approve the report and move the gaps into the initiative register.',
  deckTitle: (client) => `Digital Maturity Assessment Report — ${client}`,
  deckConfidentiality: (client) => `Confidential — ${client}`,
  deckClientMissing: 'Client to be completed',
  deckNoAreasFallbackRow: ['No measured areas', '—', '—', '—'],
  deckPdfSubject: 'DRD Digital Maturity Assessment Report',
};

export const REPORT_I18N: Record<ReportLanguage, ReportI18nShape> = { pl, en };

export function reportI18n(language: ReportLanguage): ReportI18nShape {
  return REPORT_I18N[language];
}
