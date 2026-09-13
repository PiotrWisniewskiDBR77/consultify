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
  pl: new Intl.DateTimeFormat(REPORT_DATE_LOCALE.pl, { day: 'numeric', month: 'long', year: 'numeric' }),
  en: new Intl.DateTimeFormat(REPORT_DATE_LOCALE.en, { day: 'numeric', month: 'long', year: 'numeric' }),
};
export function formatReportDate(date: Date, language: ReportLanguage): string {
  return REPORT_DATE_FORMATTERS[language].format(date);
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
  purposeChapter: (index, total, axisId) => `Rozdział ${index} z ${total} · oś ${axisId} struktury DRD`,
  purposeSynthesis: 'SYNTEZA',
  purposeAppendix: 'ZAŁĄCZNIK',
  axisSummaryCaption: 'Zestawienie siedmiu osi DRD.',

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
  legacyMethodVersionLabel: 'DRD 7 osi / 39 obszarów (ocena zastana — bez przypiętej wersji paczki)',

  sectionPlaceholder: 'Brak treści w tej sekcji — ocena nie zawiera danych, z których dałoby się ją napisać.',
  areaNotAssessedSentence: (unitId) => `Obszaru ${unitId} nie oceniono — brak danych źródłowych.`,
  areaCommentPlaceholder: (unitId) => `Komentarz obszaru ${unitId} nie został przygotowany.`,
  skipNoticeWhole: (labels) => `Obszar pominięty w ocenie — kod: ${labels}.`,
  skipNoticePartial: (items) => `Pominięte pytania: ${items}.`,
  signatureLine: ({ currentLevel, currentLabel, targetLevel, targetLabel, gap, priority, evidence }) =>
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
  deckPrioritiesRecommendationCore: 'Rekomendacje per obszar pochodzą z findingów zamrożonego Outputu.',
  deckNextStepsKicker: 'Następne kroki',
  deckNextStepsTitle: 'Od wyniku do działania',
  deckNextStepsConfirm: (count) =>
    `Potwierdzić poziomy w ${count} obszarach z luką co najmniej 3 i uzupełnić dowody.`,
  deckNextStepsFillMissing: (count) =>
    `Uzupełnić ${count} obszarów bez zapisanego poziomu albo świadomie je pominąć z uzasadnieniem.`,
  deckNextStepsAllCovered: 'Wszystkie obszary metodyki mają zapisany poziom — zakres oceny jest zamknięty.',
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
  purposeChapter: (index, total, axisId) => `Chapter ${index} of ${total} · axis ${axisId} of the DRD structure`,
  purposeSynthesis: 'SYNTHESIS',
  purposeAppendix: 'APPENDIX',
  axisSummaryCaption: 'Summary of the seven DRD axes.',

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
  legacyMethodVersionLabel: 'DRD 7 axes / 39 areas (legacy-store assessment — no method-pack version pinned)',

  sectionPlaceholder: 'No content in this section — the assessment does not contain the data needed to write it.',
  areaNotAssessedSentence: (unitId) => `Area ${unitId} was not assessed — no source data.`,
  areaCommentPlaceholder: (unitId) => `The comment for area ${unitId} was not prepared.`,
  skipNoticeWhole: (labels) => `Area skipped in the assessment — code: ${labels}.`,
  skipNoticePartial: (items) => `Skipped questions: ${items}.`,
  signatureLine: ({ currentLevel, currentLabel, targetLevel, targetLabel, gap, priority, evidence }) =>
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
  deckContextSourceLegacy: 'Assessment run in the DRD workshop — levels declared, no attached evidence',
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
  deckPrioritiesRecommendationCore: 'Per-area recommendations come from the frozen Output findings.',
  deckNextStepsKicker: 'Next steps',
  deckNextStepsTitle: 'From result to action',
  deckNextStepsConfirm: (count) =>
    `Confirm the levels in ${count} areas with a gap of at least 3 and add supporting evidence.`,
  deckNextStepsFillMissing: (count) =>
    `Fill in ${count} areas with no recorded level, or deliberately skip them with a stated reason.`,
  deckNextStepsAllCovered: 'Every area in the methodology has a recorded level — the assessment scope is closed.',
  deckNextStepsOwner: 'Assign an owner to every area with critical priority.',
  deckNextStepsHorizon: 'Set a time horizon — the assessment does not contain one and none is added here.',
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
