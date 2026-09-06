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

/**
 * Skąd pochodzą findingi. Silnik narracji NAZYWA źródło w treści („Źródłem
 * jest…"), więc nie może mówić „zamrożony Output" o wyniku, który nigdy nie
 * przeszedł przez zamrożenie jądra — to byłoby zdanie nieprawdziwe w
 * dokumencie klienckim. Domyślnie `method-core`, żeby zachowanie istniejących
 * wywołań nie zmieniło się ani o słowo.
 */
export type NarrativeSourceKind = 'method-core' | 'legacy';

const SOURCE_PHRASE: Record<NarrativeSourceKind, { dopelniacz: string; miejscownik: string }> =
  Object.freeze({
    'method-core': { dopelniacz: 'zamrożonego Outputu', miejscownik: 'zamrożonym Outputcie' },
    legacy: { dopelniacz: 'zapisanej oceny', miejscownik: 'zapisanej ocenie' },
  });

/** Cytat rekomendacji z findingu albo uczciwe stwierdzenie jej braku. Magazyn
 * zastany nie niesie rekomendacji — pusty cudzysłów „" w dokumencie klienckim
 * byłby gorszy niż jawne „bez zapisanej rekomendacji". */
function cytatRekomendacji(recommendation: string): string {
  const trimmed = recommendation.trim();
  return trimmed ? `rekomendacja: „${trimmed}”` : 'bez zapisanej rekomendacji';
}

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
}): ChapterAggregateNarrative {
  const zrodlo = SOURCE_PHRASE[input.sourceKind ?? 'method-core'];
  if (input.findings.length === 0) {
    return {
      introduction: null,
      matrixCaption: `Tabela obejmuje ${input.totalAreas} obszarów osi ${input.axisId}. Kolumny poziomów pokazują skalę od 1 do ${input.maxLevel}; Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika z wielkości luki. Źródłem są dane ${zrodlo.dopelniacz} z dnia ${input.frozenDate}.`,
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
    `Oś ${input.axisId}, ${input.axisNamePL}, obejmuje ${input.totalAreas} obszarów. Oceniono ${input.findings.length} z ${input.totalAreas} obszarów, a liczba pominięć wynosi ${input.skippedCount}. Poziomy obecne mieszczą się od ${Math.min(...current)} do ${Math.max(...current)}, natomiast poziomy docelowe od ${Math.min(...target)} do ${Math.max(...target)}. Stan udokumentowany dotyczy ${states.evidenced} obszarów, stan niepełny ${states.incomplete}, a stan zadeklarowany ${states.declared}. Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}. Największą lukę ${maxGap} mają: ${leaders.map((finding) => `${finding.unitId} ${finding.unitNamePL}`).join(', ')}. Zapisane poziomy obszarów to: ${input.findings.map((finding) => `${finding.unitId} od ${finding.currentLevel ?? 'nieustalonego'} do ${finding.targetLevel ?? 'nieustalonego'}, luka ${finding.gap ?? 'nieustalona'}`).join('; ')}. Dane pochodzą z ${zrodlo.dopelniacz}. Każdy stan dowodowy zachowuje znaczenie zapisane w kontrakcie i nie jest wzmacniany. Zestawienie nie dodaje benchmarku ani oceny rynkowej; pokazuje wyłącznie poziomy, luki, stany dowodowe i pominięcia zapisane dla tej osi.`,
    120,
    180,
    allowedNumbers
  );
  const matrixCaption = `Tabela obejmuje ${input.totalAreas} obszarów osi ${input.axisId}. Kolumny poziomów pokazują skalę od 1 do ${input.maxLevel}; Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika z wielkości luki. Źródłem są dane ${zrodlo.dopelniacz} z dnia ${input.frozenDate}.`;
  const posortowane = [...input.findings].sort(
    (left, right) =>
      (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
  );
  const oknoWnioskow = OKNA[input.sourceKind ?? 'method-core'].chapterConclusion;
  const zbudujWnioski = (liczbaCytatow: number): string => {
    const cited = posortowane.slice(0, liczbaCytatow);
    return `Na osi ${input.axisId} oceniono ${input.findings.length} z ${input.totalAreas} obszarów. Największa luka wynosi ${maxGap}, a liczba pominięć wynosi ${input.skippedCount}. ${cited
      .map(
        (finding) =>
          `${finding.unitId} ${finding.unitNamePL}: poziom obecny ${finding.currentLevel ?? 'nieustalony'}, poziom docelowy ${finding.targetLevel ?? 'nieustalony'}, luka ${finding.gap ?? 'nieustalona'}, pewność ${CONFIDENCE_PL[finding.confidence]}, liczba dowodów ${finding.evidenceCount}. ${finding.recommendation.trim() ? `Rekomendacja ${finding.unitId}: „${finding.recommendation.trim()}”` : `Obszar ${finding.unitId} nie ma zapisanej rekomendacji`}.${finding.expectedOutcome ? ` Oczekiwany rezultat ${finding.unitId}: „${finding.expectedOutcome}”.` : ''}`
      )
      .join(
        ' '
      )} Zapisane poziomy i luki wynoszą: ${input.findings.map((finding) => `${finding.unitId}: ${finding.currentLevel ?? 'nieustalony'} do ${finding.targetLevel ?? 'nieustalony'}, luka ${finding.gap ?? 'nieustalona'}`).join('; ')}. Wnioski cytują treść zapisaną w findingach i zachowują ich identyfikatory; nie dodają porównania rynkowego ani własnej diagnozy.`;
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
  readonly sourceKind?: NarrativeSourceKind;
}): ProgramAggregateNarrative {
  const zrodlo = SOURCE_PHRASE[input.sourceKind ?? 'method-core'];
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
    `Ocena obejmuje ${input.axisCount} osi i ${input.totalAreas} obszarów. Finding istnieje dla ${input.findings.length} obszarów. Stan udokumentowany dotyczy ${evidenced} obszarów, stan niepełny ${incomplete}, a stan zadeklarowany ${declared}. Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}, a liczba luk krytycznych wynosi ${critical.length}. Trzy pierwsze obszary po uporządkowaniu malejąco według luki to ${leaders.map((finding) => `${finding.unitId} ${finding.unitNamePL} z luką ${finding.gap}`).join(', ')}. Ich poziomy obecne to ${leaders.map((finding) => `${finding.unitId}: ${finding.currentLevel}`).join(', ')}, a docelowe ${leaders.map((finding) => `${finding.unitId}: ${finding.targetLevel}`).join(', ')}. Zestawienie opiera się na ${zrodlo.miejscownik}, poziomach, lukach i stanach dowodowych. Jest to obraz policzalny, ograniczony do danych obecnych w zaakceptowanym kontrakcie raportu. Nie korzysta z benchmarku branżowego i nie dodaje oceny jakościowej poza zamrożonymi etykietami priorytetu oraz wiarygodności.`,
    120,
    150,
    allowedNumbers
  );
  const oknoLuk = OKNA[input.sourceKind ?? 'method-core'].criticalGaps;
  const posortowaneKrytyczne = [...critical].sort(
    (left, right) =>
      (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
  );
  const zbudujLuki = (liczbaCytatow: number): string => {
    const wybrane = posortowaneKrytyczne.slice(0, liczbaCytatow);
    return `Liczba obszarów z luką co najmniej 3 wynosi ${critical.length}. Największa luka wynosi ${maxGap}. ${wybrane
      .map(
        (finding) =>
          `${finding.unitId} ${finding.unitNamePL}, luka ${finding.gap}, ${cytatRekomendacji(finding.recommendation)}.`
      )
      .join(' ')} Dla tych obszarów zapisano poziomy obecne ${wybrane
      .map((finding) => `${finding.unitId}: ${finding.currentLevel}`)
      .join(', ')} i docelowe ${wybrane
      .map((finding) => `${finding.unitId}: ${finding.targetLevel}`)
      .join(
        ', '
      )}. Każdy cytat zachowuje treść zapisaną w findingu i jego identyfikator. Treść jest cytowana z findingów bez parafrazy. Kolejność wynika wyłącznie z wielkości luki i identyfikatora obszaru; nie zawiera benchmarku ani prognozy.`;
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
    (left, right) =>
      (right.gap ?? -1) - (left.gap ?? -1) || left.unitId.localeCompare(right.unitId)
  );
  const usableLimitations = input.limitations.filter(usable);
  const limitationsClause = usableLimitations.length
    ? ` Ograniczenia ${zrodlo.dopelniacz}: ${usableLimitations.map((limitation) => `„${limitation}”`).join('; ')}.`
    : '';
  const oknoSyntezy = OKNA[input.sourceKind ?? 'method-core'].finalConclusions;
  const zbudujSyntze = (liczbaCytatow: number): string => {
    const selected = posortowaneWszystkie.slice(0, liczbaCytatow);
    return `W całym programie oceniono ${input.findings.length} z ${input.totalAreas} obszarów w ${input.axisCount} osiach. Luki mieszczą się od ${Math.min(...gaps)} do ${Math.max(...gaps)}, a liczba luk krytycznych wynosi ${critical.length}. Stan udokumentowany dotyczy ${evidenced} obszarów, niepełny ${incomplete}, a zadeklarowany ${declared}. ${selected
      .map(
        (finding) =>
          `${finding.unitId} ${finding.unitNamePL}: poziom obecny ${finding.currentLevel ?? 'nieustalony'}, docelowy ${finding.targetLevel ?? 'nieustalony'}, luka ${finding.gap ?? 'nieustalona'}; ${cytatRekomendacji(finding.recommendation)}` +
          (finding.expectedOutcome ? `; oczekiwany rezultat: „${finding.expectedOutcome}”` : '') +
          '.'
      )
      .join(
        ' '
      )}${limitationsClause} Synteza nie dodaje porównań rynkowych, horyzontu czasowego ani prognozy. Wszystkie liczby pochodzą z findingów albo z policzalnych mianowników kontraktu.`;
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

  const assessorNote = usable(context.assessorNote) ? context.assessorNote.trim() : null;
  if (assessorNote) {
    facts.push(`Notatka oceniającego: ${assessorNote}`);
    sourceFields.push('levelNotes');
  }

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
