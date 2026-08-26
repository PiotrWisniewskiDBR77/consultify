/**
 * U9 — Harness dla REALNEGO `AuditReportDocumentView` (NAPRAWA 2, panel
 * ekspercki 2026-08-26): pełny widok treści raportu audytu, ekran-artefakt
 * SPEC-A (archetyp B „Dokument"), otwierany dziś z `AuditReportsTab` przez
 * `StandardPreview`'s `onOpenFull` → `/audit-programs/reports/:reportId`.
 *
 * `AuditReportDocumentView` przyjmuje `reportId` WPROST jako props (nie przez
 * `useParams`), więc ten harness — inaczej niż
 * `audyty-warsztat-kryterium.tsx` — NIE musi przełączać `BrowserRouter` na
 * konkretną trasę; montuje komponent bezpośrednio (wzorzec
 * `audyty-piec-powierzchni.tsx`).
 *
 * `Api.get`/`Api.post` — podmiana singletona, jak każdy inny harness audytów
 * w tym katalogu. Kształt mocków ściśle odpowiada kontraktowi
 * `auditsMethodApi.ts` (`unwrapEnvelope` wymaga `{success:true, data}`).
 *
 * DANE: Metalpol Sp. z o.o., ZAK-8.4.1/8.4.2, UST-2026-014/015/016 — te same
 * tożsamości co `audyty-piec-powierzchni.tsx` (Findings) i
 * `audyty-warsztat-kryterium.tsx` (CriterionWorkspace), żeby zrzuty trzech
 * ekranów audytów były wzajemnie spójne.
 *
 * R1 (panel powtórny DEC-117): `AuditReportDocumentView` domyślnie renderuje
 * `report.payload`, nie `/presentation` — mock musi więc nosić OBA dokumenty:
 * `FULL_PAYLOAD` (13 sekcji, `renderAuditReport`, `reportStore.payload`) i
 * `DOCUMENT` (8-sekcyjny deck, `renderPresentationView`, serwowany pod
 * `/presentation`, ładowany leniwie dopiero po przełączeniu trybu w Menu 1).
 * Te same tożsamości ustaleń/kryteriów w obu, żeby zrzut dowodził spójności.
 *
 * URL PARAMS
 *   ?theme=light|dark
 *   ?status=draft|in_review|approved|published   (default: approved — pokazuje
 *       oba przyciski Menu1/panelu w naturalnym, "następnym kroku" stanie)
 */
import React from 'react';

import { AuditReportDocumentView } from '../../src/components/Audit/method/AuditReportDocumentView';
import type {
  AuditCriterionSummary,
  AuditEvidenceSummary,
  AuditProgramDetail,
  AuditReportDocument,
  AuditReportStatus,
  AuditReportSummary,
} from '../../src/components/Audit/method/auditsMethodApi';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, auditsFiveSurfacesV1: true })
  );
} catch {
  // ignore
}
try {
  localStorage.setItem('ff.audits_findings_and_report_view', '1');
} catch {
  // ignore
}

const qp = new URLSearchParams(window.location.search);
const VALID_STATUSES: AuditReportStatus[] = ['draft', 'in_review', 'approved', 'published', 'superseded'];
const STATUS: AuditReportStatus = (VALID_STATUSES as string[]).includes(qp.get('status') || '')
  ? (qp.get('status') as AuditReportStatus)
  : 'approved';

const PROGRAM_ID = 'prog-metalpol-zakupy';
const REPORT_ID = 'rep-metalpol-q3-2026';
const AUDITEE_ID = 'user-magdalena-zielinska';
const AUDITOR_ID = 'user-pawel-nowak';

// R1 (panel powtórny DEC-117): `AuditReportDocumentView` domyślnie renderuje
// `report.payload` — TEN dokument, dokładnie kształt `renderAuditReport`
// (`server/src/services/audits/reportRenderer.ts:428`, 13 sekcji). Te same
// tożsamości Metalpol/UST-2026-014..016/ZAK-8.4.1-2 co `DOCUMENT` (deck)
// niżej, żeby oba tryby (Pełny raport / Widok dla zarządu) opowiadały SPÓJNĄ
// historię tego samego audytu — kluczowe dla zrzutu dowodzącego, że oba
// tryby to naprawdę ten sam byt widziany dwoma rendererami.
const FULL_PAYLOAD: AuditReportDocument = {
  reportKind: 'audit_report',
  generatedAt: '2026-09-10T10:00:00Z',
  sections: [
    {
      id: 'executive_summary',
      title: 'Streszczenie zarządcze',
      kind: 'text',
      content:
        'Audyt zidentyfikował 3 ustalenia: 1 o istotności wysokiej, 1 o istotności średniej, 1 o istotności niskiej. Audyt wykonano wg pakietu audytowego (klasyfikacja: zweryfikowana, źródło: Procedura QMS Elmax Industries, wyd. 4), obejmując 24 kryteriów. Zespół audytowy liczył 2 osoby.',
    },
    {
      id: 'scope',
      title: 'Zakres i cele',
      kind: 'keyValue',
      content: {
        scopeText: 'Zakład Ostrów Wlkp. — proces Zakupy i zaopatrzenie, kwalifikacja i nadzór nad dostawcami krytycznymi.',
        scopeJson: null,
        objectives: 'Ocena zgodności procesu zakupowego z procedurą P-ZAK-02.',
      },
    },
    {
      id: 'methodology',
      title: 'Metodyka',
      kind: 'text',
      content:
        'Audyt wykonano wg pakietu audytowego (klasyfikacja: zweryfikowana, źródło: Procedura QMS Elmax Industries, wyd. 4), obejmując 24 kryteriów. Zespół audytowy liczył 2 osoby.',
    },
    {
      id: 'limitations',
      title: 'Ograniczenia',
      kind: 'list',
      content: ['Nie zidentyfikowano istotnych ograniczeń zakresu ani dostępu do dowodów.'],
    },
    {
      id: 'overall_conclusion',
      title: 'Wniosek ogólny',
      kind: 'text',
      content: 'Audyt zidentyfikował 3 ustalenia: 1 o istotności wysokiej, 1 o istotności średniej, 1 o istotności niskiej.',
    },
    {
      id: 'findings_by_severity',
      title: 'Ustalenia wg istotności',
      kind: 'group',
      content: [
        {
          key: 'high',
          items: [
            {
              id: 'find-ust-2026-014',
              referenceCode: 'UST-2026-014',
              statement: 'Brak oceny okresowej za 2025 dla 5 z 17 dostawców klasy A.',
              criterionId: 'crit-metalpol-zak-8-4-1',
              classification: 'nonconforming',
              severity: 'high',
              objectiveEvidence: ['evid-d1', 'evid-d2'],
              contradictingEvidence: [],
              status: 'remediation_in_progress',
              rootCause: 'Brak mechanizmu przypominającego w module SRM o zbliżającym się terminie oceny okresowej.',
              rootCauseConfirmed: true,
              residualRisk: null,
              ownerUserId: AUDITEE_ID,
            },
          ],
        },
        {
          key: 'medium',
          items: [
            {
              id: 'find-ust-2026-016',
              referenceCode: 'UST-2026-016',
              statement: 'Brak zapisu kwalifikacji wstępnej dla nowego dostawcy przed złożeniem pierwszego zamówienia.',
              criterionId: 'crit-metalpol-zak-8-4-1',
              classification: 'nonconforming',
              severity: 'medium',
              objectiveEvidence: ['evid-d1'],
              contradictingEvidence: [],
              status: 'closed',
              rootCause: 'Brak mechanizmu przypominającego w module SRM o zbliżającym się terminie oceny/kwalifikacji.',
              rootCauseConfirmed: true,
              residualRisk: 'Niskie — działanie korygujące zweryfikowane jako skuteczne.',
              ownerUserId: AUDITEE_ID,
            },
          ],
        },
        {
          key: 'low',
          items: [
            {
              id: 'find-ust-2026-015',
              referenceCode: 'UST-2026-015',
              statement: 'Zamówienia złożone u dostawcy spoza zatwierdzonej listy (AVL) bez zapisu odstępstwa.',
              criterionId: 'crit-metalpol-zak-8-4-2',
              classification: 'observation',
              severity: 'low',
              objectiveEvidence: [],
              contradictingEvidence: [],
              status: 'draft',
              rootCause: null,
              rootCauseConfirmed: false,
              residualRisk: null,
              ownerUserId: null,
            },
          ],
        },
      ],
    },
    {
      id: 'findings_by_area',
      title: 'Ustalenia wg obszaru/procesu',
      kind: 'group',
      content: [
        {
          key: 'Kwalifikacja i ocena okresowa dostawców krytycznych',
          items: [
            {
              id: 'find-ust-2026-014',
              referenceCode: 'UST-2026-014',
              statement: 'Brak oceny okresowej za 2025 dla 5 z 17 dostawców klasy A.',
              criterionId: 'crit-metalpol-zak-8-4-1',
              classification: 'nonconforming',
              severity: 'high',
              objectiveEvidence: ['evid-d1', 'evid-d2'],
              contradictingEvidence: [],
              status: 'remediation_in_progress',
              rootCause: 'Brak mechanizmu przypominającego w module SRM o zbliżającym się terminie oceny okresowej.',
              rootCauseConfirmed: true,
              residualRisk: null,
              ownerUserId: AUDITEE_ID,
            },
            {
              id: 'find-ust-2026-016',
              referenceCode: 'UST-2026-016',
              statement: 'Brak zapisu kwalifikacji wstępnej dla nowego dostawcy przed złożeniem pierwszego zamówienia.',
              criterionId: 'crit-metalpol-zak-8-4-1',
              classification: 'nonconforming',
              severity: 'medium',
              objectiveEvidence: ['evid-d1'],
              contradictingEvidence: [],
              status: 'closed',
              rootCause: 'Brak mechanizmu przypominającego w module SRM o zbliżającym się terminie oceny/kwalifikacji.',
              rootCauseConfirmed: true,
              residualRisk: 'Niskie — działanie korygujące zweryfikowane jako skuteczne.',
              ownerUserId: AUDITEE_ID,
            },
          ],
        },
        {
          key: 'Nadzór nad dostawcami procesów zlecanych na zewnątrz',
          items: [
            {
              id: 'find-ust-2026-015',
              referenceCode: 'UST-2026-015',
              statement: 'Zamówienia złożone u dostawcy spoza zatwierdzonej listy (AVL) bez zapisu odstępstwa.',
              criterionId: 'crit-metalpol-zak-8-4-2',
              classification: 'observation',
              severity: 'low',
              objectiveEvidence: [],
              contradictingEvidence: [],
              status: 'draft',
              rootCause: null,
              rootCauseConfirmed: false,
              residualRisk: null,
              ownerUserId: null,
            },
          ],
        },
      ],
    },
    {
      id: 'objective_evidence_references',
      title: 'Odniesienia do obiektywnych dowodów',
      kind: 'table',
      content: [
        {
          findingId: 'find-ust-2026-014',
          evidenceIds: ['evid-d1', 'evid-d2'],
          evidenceTitles: [
            'Karty oceny okresowej dostawców klasy A — 2025 (12 z 17)',
            'Eksport SRM — daty ostatniej oceny wszystkich dostawców klasy A',
          ],
        },
        {
          findingId: 'find-ust-2026-016',
          evidenceIds: ['evid-d1'],
          evidenceTitles: ['Karty oceny okresowej dostawców klasy A — 2025 (12 z 17)'],
        },
        { findingId: 'find-ust-2026-015', evidenceIds: [], evidenceTitles: [] },
      ],
    },
    {
      id: 'systemic_conclusions',
      title: 'Wnioski systemowe',
      kind: 'list',
      content: [
        {
          theme: 'Wspólna przyczyna źródłowa: brak automatycznego przypomnienia w module SRM',
          findingIds: ['find-ust-2026-014', 'find-ust-2026-016'],
          description:
            'Dwa ustalenia (UST-2026-014, UST-2026-016) mają tę samą znormalizowaną przyczynę źródłową — brak mechanizmu przypominającego w module SRM o zbliżającym się terminie oceny/kwalifikacji dostawcy.',
        },
      ],
    },
    {
      id: 'corrective_action_plan',
      title: 'Plan działań korygujących',
      kind: 'table',
      content: [
        {
          id: 'act-korygujace-01',
          findingId: 'find-ust-2026-014',
          actionKind: 'corrective_action',
          title:
            'Wdrożyć automatyczne przypomnienie w module SRM 30 dni przed upływem terminu oceny okresowej dostawcy klasy A',
          ownerUserId: AUDITEE_ID,
          dueDate: '2026-09-15',
          status: 'approved',
        },
        {
          id: 'act-korygujace-02',
          findingId: 'find-ust-2026-016',
          actionKind: 'corrective_action',
          title: 'Zablokować możliwość złożenia zamówienia w module SRM bez zapisanej kwalifikacji wstępnej',
          ownerUserId: AUDITEE_ID,
          dueDate: '2026-09-01',
          status: 'verified',
        },
      ],
    },
    {
      id: 'verification_plan',
      title: 'Plan weryfikacji',
      kind: 'table',
      content: [
        {
          id: 'ver-01',
          correctiveActionId: 'act-korygujace-02',
          findingId: 'find-ust-2026-016',
          verificationKind: 'effectiveness',
          method: 'Ponowna próba na losowej próbie 5 zamówień z września 2026.',
          plannedDate: '2026-09-20',
          performedAt: '2026-09-22',
          result: 'effective',
        },
        {
          id: 'ver-02',
          correctiveActionId: 'act-korygujace-01',
          findingId: 'find-ust-2026-014',
          verificationKind: 'implementation',
          method: 'Przegląd konfiguracji modułu SRM.',
          plannedDate: '2026-09-20',
          performedAt: null,
          result: null,
        },
      ],
    },
    {
      id: 'appendices',
      title: 'Załączniki',
      kind: 'group',
      content: {
        team: [
          { id: 'team-1', userId: 'user-piotr-demo', role: 'lead_auditor', independenceDeclared: true, assignedAt: '2026-07-15T00:00:00Z' },
          { id: 'team-2', userId: AUDITOR_ID, role: 'auditor', independenceDeclared: true, assignedAt: '2026-07-15T00:00:00Z' },
        ],
        evidenceRegister: [
          {
            id: 'evid-d1',
            title: 'Karty oceny okresowej dostawców klasy A — 2025 (12 z 17)',
            evidenceKind: 'document',
            criterionId: 'crit-metalpol-zak-8-4-1',
            materialId: null,
            materialVersion: null,
            contentHash: null,
            sourceSystem: null,
            sufficiency: 'sufficient',
            reliability: 'reliable',
            supportsConformity: false,
          },
          {
            id: 'evid-d2',
            title: 'Eksport SRM — daty ostatniej oceny wszystkich dostawców klasy A',
            evidenceKind: 'system_export',
            criterionId: 'crit-metalpol-zak-8-4-1',
            materialId: null,
            materialVersion: null,
            contentHash: null,
            sourceSystem: 'SRM',
            sufficiency: 'sufficient',
            reliability: 'reliable',
            supportsConformity: false,
          },
        ],
      },
    },
    {
      id: 'traceability_matrix',
      title: 'Macierz traceability',
      kind: 'table',
      content: [
        {
          id: 'trace-find-ust-2026-014',
          criterionId: 'crit-metalpol-zak-8-4-1',
          criterionRef: 'ZAK-8.4.1',
          criterionTitle: 'Kwalifikacja i ocena okresowa dostawców krytycznych',
          evidenceIds: ['evid-d1', 'evid-d2'],
          evidenceTitles: [
            'Karty oceny okresowej dostawców klasy A — 2025 (12 z 17)',
            'Eksport SRM — daty ostatniej oceny wszystkich dostawców klasy A',
          ],
          testPerformed: 'Próba 17 dostawców klasy A — porównanie kart oceny z eksportem SRM.',
          testResult: 'partial',
          auditorConclusion: 'Kryterium spełnione częściowo — mechanizm istnieje, ale nie jest utrzymywany w cyklu rocznym.',
          findingId: 'find-ust-2026-014',
          findingStatement: 'Brak oceny okresowej za 2025 dla 5 z 17 dostawców klasy A.',
          actionIds: ['act-korygujace-01'],
          actionTitles: ['Wdrożyć automatyczne przypomnienie w module SRM 30 dni przed upływem terminu oceny okresowej dostawcy klasy A'],
          verificationIds: ['ver-02'],
          verificationResults: [null],
        },
        {
          id: 'trace-find-ust-2026-016',
          criterionId: 'crit-metalpol-zak-8-4-1',
          criterionRef: 'ZAK-8.4.1',
          criterionTitle: 'Kwalifikacja i ocena okresowa dostawców krytycznych',
          evidenceIds: ['evid-d1'],
          evidenceTitles: ['Karty oceny okresowej dostawców klasy A — 2025 (12 z 17)'],
          testPerformed: 'Próba 5 zamówień nowych dostawców — sprawdzenie zapisu kwalifikacji wstępnej.',
          testResult: 'fail',
          auditorConclusion: 'Kryterium niespełnione dla jednego nowego dostawcy — brak zapisu kwalifikacji przed pierwszym zamówieniem.',
          findingId: 'find-ust-2026-016',
          findingStatement: 'Brak zapisu kwalifikacji wstępnej dla nowego dostawcy przed złożeniem pierwszego zamówienia.',
          actionIds: ['act-korygujace-02'],
          actionTitles: ['Zablokować możliwość złożenia zamówienia w module SRM bez zapisanej kwalifikacji wstępnej'],
          verificationIds: ['ver-01'],
          verificationResults: ['effective'],
        },
        {
          id: 'trace-find-ust-2026-015',
          criterionId: 'crit-metalpol-zak-8-4-2',
          criterionRef: 'ZAK-8.4.2',
          criterionTitle: 'Nadzór nad dostawcami procesów zlecanych na zewnątrz',
          evidenceIds: [],
          evidenceTitles: [],
          testPerformed: 'Przegląd rejestru zamówień Q3 2026 pod kątem zgodności z listą AVL.',
          testResult: 'fail',
          auditorConclusion: 'Obserwacja — brak formalnego zapisu odstępstwa dla zamówień poza AVL, praktyka nieudokumentowana.',
          findingId: 'find-ust-2026-015',
          findingStatement: 'Zamówienia złożone u dostawcy spoza zatwierdzonej listy (AVL) bez zapisu odstępstwa.',
          actionIds: [],
          actionTitles: [],
          verificationIds: [],
          verificationResults: [],
        },
      ],
    },
  ],
};

let reportStore: AuditReportSummary = {
  id: REPORT_ID,
  programId: PROGRAM_ID,
  programName: 'Metalpol Sp. z o.o. — Audyt wewnętrzny 2026/Q3 (Zakupy)',
  reportKind: 'audit_report',
  version: 1,
  title: 'Raport z audytu wewnętrznego 2026/Q3 — Metalpol Sp. z o.o. (Zakupy)',
  status: STATUS,
  language: 'pl',
  audience: 'Zarząd',
  confidentiality: 'Poufne',
  approvedAt: STATUS === 'approved' || STATUS === 'published' ? '2026-09-10T10:00:00Z' : null,
  publishedAt: STATUS === 'published' ? '2026-09-12T08:00:00Z' : null,
  updatedAt: '2026-09-10T10:00:00Z',
  payload: FULL_PAYLOAD as unknown as Record<string, unknown>,
};

const PROGRAM_DETAIL: AuditProgramDetail = {
  id: PROGRAM_ID,
  name: 'Metalpol Sp. z o.o. — Audyt wewnętrzny 2026/Q3 (Zakupy)',
  packId: 'pack-qms-elmax',
  packTitle: 'Audyt systemu zarządzania jakością — procedura QMS Elmax',
  packVersion: 3,
  lifecycleState: 'findings_review',
  applicableCriteria: 24,
  concludedCriteria: 9,
  openFindings: 2,
  leadAuditorId: 'user-piotr-demo',
  leadAuditorName: 'Piotr Wiśniewski',
  plannedStart: '2026-07-15',
  plannedEnd: '2026-09-30',
  updatedAt: '2026-09-10T10:00:00Z',
  objective: 'Ocena zgodności procesu zakupowego z procedurą P-ZAK-02.',
  scopeText: 'Zakład Ostrów Wlkp. — proces Zakupy i zaopatrzenie.',
  projectId: null,
  members: [],
};

const CRITERIA: AuditCriterionSummary[] = [
  {
    id: 'crit-metalpol-zak-8-4-1',
    programId: PROGRAM_ID,
    parentId: null,
    ordinal: 12,
    refCode: 'ZAK-8.4.1',
    title: 'Kwalifikacja i ocena okresowa dostawców krytycznych',
    applicable: true,
    conformityStatus: 'nonconforming',
    workStatus: 'concluded',
    evidenceCount: 3,
    findingCount: 2,
    children: [],
  },
  {
    id: 'crit-metalpol-zak-8-4-2',
    programId: PROGRAM_ID,
    parentId: null,
    ordinal: 13,
    refCode: 'ZAK-8.4.2',
    title: 'Nadzór nad dostawcami procesów zlecanych na zewnątrz',
    applicable: true,
    conformityStatus: 'nonconforming',
    workStatus: 'concluded',
    evidenceCount: 1,
    findingCount: 1,
    children: [],
  },
];

const EVIDENCE: AuditEvidenceSummary[] = [
  {
    id: 'evid-d1',
    programId: PROGRAM_ID,
    criterionId: 'crit-metalpol-zak-8-4-1',
    evidenceKind: 'document',
    title: 'Karty oceny okresowej dostawców klasy A — 2025 (12 z 17)',
  },
  {
    id: 'evid-d2',
    programId: PROGRAM_ID,
    criterionId: 'crit-metalpol-zak-8-4-1',
    evidenceKind: 'system_export',
    title: 'Eksport SRM — daty ostatniej oceny wszystkich dostawców klasy A',
  },
];

// Dokładnie kształt `renderPresentationView` (`reportRenderer.ts:661`) —
// osiem sekcji, `reportKind: 'presentation'`, `generatedAt: null` zawsze
// (renderer nigdy nie czyta zegara).
const DOCUMENT: AuditReportDocument = {
  reportKind: 'presentation',
  generatedAt: null,
  sections: [
    {
      id: 'conclusion',
      title: 'Konkluzja',
      kind: 'text',
      // NAPRAWA 1 (fix-pass 2026-08-26): mock trzymał surowy enum EN
      // `VERIFIED` wprost w treści — dokładnie ta wartość `output.meta.
      // packClassification` (`server/src/services/audits/reportRenderer.ts`,
      // `buildMethodology`'s `packInfo`), tłumaczona teraz przez
      // `PACK_CLASSIFICATION_LABELS`/`packClassificationLabel()` w tym samym
      // pliku — mock trzyma się tego samego słownika PL, żeby zrzut ekranu
      // nigdy nie pokazywał surowego klucza.
      content:
        'Audyt zidentyfikował 3 ustalenia: 1 o istotności wysokiej, 1 o istotności średniej, 1 o istotności niskiej. Audyt wykonano wg pakietu audytowego (klasyfikacja: zweryfikowana, źródło: Procedura QMS Elmax Industries, wyd. 4), obejmując 24 kryteriów. Zespół audytowy liczył 2 osoby.',
    },
    {
      id: 'systemic_themes',
      title: 'Tematy systemowe',
      kind: 'list',
      content: [
        {
          theme: 'Wspólna przyczyna źródłowa: brak automatycznego przypomnienia w module srm',
          findingIds: ['find-ust-2026-014', 'find-ust-2026-016'],
          description:
            'Dwa ustalenia (UST-2026-014, UST-2026-016) mają tę samą znormalizowaną przyczynę źródłową — brak mechanizmu przypominającego w module SRM o zbliżającym się terminie oceny/kwalifikacji dostawcy.',
        },
      ],
    },
    {
      id: 'findings_distribution',
      title: 'Rozkład ustaleń',
      kind: 'table',
      content: [
        { severity: 'informational', count: 0 },
        { severity: 'low', count: 1 },
        { severity: 'medium', count: 1 },
        { severity: 'high', count: 1 },
        { severity: 'critical', count: 0 },
      ],
    },
    {
      id: 'critical_findings',
      title: 'Ustalenia krytyczne',
      kind: 'list',
      content: [],
    },
    {
      id: 'critical_evidence',
      title: 'Dowody krytyczne',
      kind: 'list',
      content: [
        {
          id: 'evid-d2',
          title: 'Eksport SRM — daty ostatniej oceny wszystkich dostawców klasy A',
          evidenceKind: 'system_export',
          criterionId: 'crit-metalpol-zak-8-4-1',
        },
      ],
    },
    {
      id: 'remediation_priorities',
      title: 'Priorytety naprawy',
      kind: 'table',
      content: [
        {
          id: 'act-korygujace-01',
          findingId: 'find-ust-2026-014',
          actionKind: 'corrective_action',
          title:
            'Wdrożyć automatyczne przypomnienie w module SRM 30 dni przed upływem terminu oceny okresowej dostawcy klasy A',
          ownerUserId: AUDITEE_ID,
          dueDate: '2026-09-15',
          status: 'approved',
        },
        {
          id: 'act-korygujace-02',
          findingId: 'find-ust-2026-016',
          actionKind: 'corrective_action',
          title: 'Zablokować możliwość złożenia zamówienia w module SRM bez zapisanej kwalifikacji wstępnej',
          ownerUserId: AUDITEE_ID,
          dueDate: '2026-09-01',
          status: 'verified',
        },
      ],
    },
    {
      id: 'timeline',
      title: 'Oś czasu',
      kind: 'table',
      content: [
        {
          id: 'act-korygujace-02',
          findingId: 'find-ust-2026-016',
          actionKind: 'corrective_action',
          title: 'Zablokować możliwość złożenia zamówienia w module SRM bez zapisanej kwalifikacji wstępnej',
          ownerUserId: AUDITEE_ID,
          dueDate: '2026-09-01',
          status: 'verified',
        },
        {
          id: 'act-korygujace-01',
          findingId: 'find-ust-2026-014',
          actionKind: 'corrective_action',
          title:
            'Wdrożyć automatyczne przypomnienie w module SRM 30 dni przed upływem terminu oceny okresowej dostawcy klasy A',
          ownerUserId: AUDITEE_ID,
          dueDate: '2026-09-15',
          status: 'approved',
        },
      ],
    },
    {
      id: 'accountabilities',
      title: 'Odpowiedzialności',
      kind: 'table',
      content: [
        {
          ownerUserId: AUDITEE_ID,
          findingIds: ['find-ust-2026-014', 'find-ust-2026-015', 'find-ust-2026-016'],
          actionIds: ['act-korygujace-01', 'act-korygujace-02'],
        },
      ],
    },
  ],
};

function envelope<T>(data: T): { data: { success: true; data: T } } {
  return { data: { success: true, data } };
}

const originalGet = Api.get.bind(Api);
const originalPost = Api.post.bind(Api);

Api.get = (async (url: string, ...rest: unknown[]) => {
  if (!url.startsWith('/audits/')) return (originalGet as any)(url, ...rest);
  const path = url.split('?')[0];

  if (path === `/audits/reports/${REPORT_ID}/presentation`) return envelope(DOCUMENT);
  if (path === `/audits/reports/${REPORT_ID}`) return envelope(reportStore);
  if (path === `/audits/programs/${PROGRAM_ID}`) return envelope(PROGRAM_DETAIL);
  if (path === '/audits/criteria') return envelope({ criteria: CRITERIA });
  if (path === '/audits/evidence') return envelope(EVIDENCE);

  return (originalGet as any)(url, ...rest);
}) as typeof Api.get;

Api.post = (async (url: string, data: any) => {
  if (!url.startsWith('/audits/')) return (originalPost as any)(url, data);

  if (url === `/audits/reports/${REPORT_ID}/approve`) {
    reportStore = { ...reportStore, status: 'approved', approvedAt: new Date().toISOString() };
    return envelope(reportStore);
  }
  if (url === `/audits/reports/${REPORT_ID}/publish`) {
    reportStore = { ...reportStore, status: 'published', publishedAt: new Date().toISOString() };
    return envelope(reportStore);
  }

  return (originalPost as any)(url, data);
}) as typeof Api.post;

const originalGetUsers = Api.getUsers.bind(Api);
Api.getUsers = (async () => [
  { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'Wiśniewski' },
  { id: AUDITOR_ID, firstName: 'Paweł', lastName: 'Nowak' },
  { id: AUDITEE_ID, firstName: 'Magdalena', lastName: 'Zielińska' },
]) as typeof originalGetUsers;

export function AudytyRaportDokumentScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <div style={{ height: '100vh', overflow: 'auto' }} data-testid="audyty-raport-dokument-dev-render">
          <AuditReportDocumentView reportId={REPORT_ID} />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default AudytyRaportDokumentScreen;
