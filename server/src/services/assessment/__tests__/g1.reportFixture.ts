/**
 * [ODMROZENIE WSPOLNE DEC-461] Wspólne fixture raportu oceny dla dwóch plików
 * testowych: `g1.reportLanguage.test.ts` (kontrakt + DOCX) i
 * `g1.reportPdfText.test.ts` (PPTX + PDF).
 *
 * ★ Dlaczego osobny moduł, a nie import z pliku `.test.ts`: zaimportowanie
 * fixture'u z pliku testowego zarejestrowałoby jego `describe`/`it` w drugim
 * procesie vitest, czyli odtworzyłoby dokładnie ten warunek, który te pliki
 * rozdzielają (jednoczesne załadowanie dwóch kopii natywnego canvas/Skia).
 * Ten moduł nie importuje żadnego renderera ani `pdf-parse`.
 */
import type { AssessmentReportContract } from '../assessmentDrdReportSchemaService.js';
import {
  composeReportContract,
  type ReportContractInput,
} from '../assessmentReportContractComposer.js';
import { formatEmployeeCount } from '../assessmentReportContractService.js';
import { reportI18n } from '../assessmentReportI18n.js';

export const POLSKIE_DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu;

export const AXIS_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Fixture „Northwind-like" = DOKŁADNY kształt oceny, na której padł pomiar 92.
 *
 * ★ ZWERYFIKOWANE NA DOWODZIE, nie założone: w realnym `report.docx`
 * Northwind (`v2/s14nw/report.docx`) sekcja „Executive Summary" drukuje
 * „No content in this section…", a matryca ma same „—". Ocena NIE MA
 * findingów przeniesionych do kontraktu — dlatego cała proza kompozytora
 * zwraca `null`, a jedynym polskim tekstem w dokumencie zostaje podpis pod
 * matrycą (7 × 13 znaków) i okładkowe „340 osób" (1 znak). 92 razem.
 *
 * Wszystkie dane fixture'u są po angielsku (oceniający, etykieta sesji,
 * okres), więc KAŻDY polski ogonek w wyniku pochodzi z generatora, nie
 * z danych.
 */
export function wejscieBezLuk(overrides: Partial<ReportContractInput> = {}): ReportContractInput {
  return {
    sessionId: 'assess-g1-nw',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-14T09:00:00.000Z',
    assessmentUpdatedAt: '2026-09-06T10:42:05.393Z',
    methodVersion: 'DRD assessment (recorded)',
    sourceKind: 'legacy',
    language: 'en',
    sessionLabel: {
      displayName: 'Operational Excellence Programme',
      source: 'project',
      projectId: null,
    },
    businessProfile: 'Manufacturing',
    employment: formatEmployeeCount(340, 'en'),
    assessmentPeriod: '7 August 2026',
    assessor: 'James Whitfield',
    clientSponsor: null,
    findings: [],
    limitations: [],
    skipReasons: [],
    assessorNotes: {},
    ...overrides,
  };
}

export function kontrakt(overrides: Partial<ReportContractInput> = {}): AssessmentReportContract {
  return composeReportContract(wejscieBezLuk(overrides)) as unknown as AssessmentReportContract;
}

/** K3 / W73 — kontrakt z findingami po jednej na każdą oś (7 osi). */
export function zFindingami(language: 'pl' | 'en' = 'en'): AssessmentReportContract {
  return kontrakt({
    language,
    findings: AXIS_IDS.map((axisId) => ({
      id: `legacy:assess-g1-nw:${axisId}A`,
      outputId: 'legacy:assess-g1-nw',
      unitId: `${axisId}A`,
      unitName: `Area ${axisId}A`,
      currentLevel: 2,
      targetLevel: 5,
      gap: 3,
      supportingEvidence: [],
      contradictingEvidence: [],
      businessMeaning: '',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: '',
      prerequisite: null,
      expectedOutcome: null,
      kpiProposal: null,
      confidence: 'medium' as const,
      priorityRationale: null,
      sourceLocators: [],
      createdAt: '2026-09-06T06:29:09.104Z',
    })),
  });
}

/** R1 / DEC-461 — kontrakt z niepustym `limitations` (ścieżka legacy). */
export function zOgraniczeniem(language: 'pl' | 'en'): AssessmentReportContract {
  return kontrakt({
    language,
    limitations: [reportI18n(language).legacyLimitation],
    findings: AXIS_IDS.map((axisId) => ({
      id: `legacy:assess-r1:${axisId}A`,
      outputId: 'legacy:assess-r1',
      unitId: `${axisId}A`,
      unitName: `Area ${axisId}A`,
      currentLevel: 2,
      targetLevel: 5,
      gap: 3,
      supportingEvidence: [],
      contradictingEvidence: [],
      businessMeaning: '',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: '',
      prerequisite: null,
      expectedOutcome: null,
      kpiProposal: null,
      confidence: 'medium' as const,
      priorityRationale: null,
      sourceLocators: [],
      createdAt: '2026-09-06T06:29:09.104Z',
    })),
  });
}
