/**
 * W4 — Harness dla REALNEGO `CriterionWorkspace` (ekran roboczy audytora dla
 * jednego kryterium: `CriterionChain` + `EvidencePanel` + `FindingPanel` +
 * `RemediationPanel` + `TeresaProposalCard`, klient `workspaceApi.ts`).
 * Nikt jeszcze tego ekranu nie widział — ten harness montuje go z mock-danymi,
 * żeby nadzorca sesji mógł zrobić zrzuty PRZED pokazaniem właścicielowi
 * (CLAUDE.md #7).
 *
 * Wzorzec 1:1 z `dev-render/screens/audyty-piec-powierzchni.tsx`: montujemy
 * REALNY komponent wewnątrz REALNEGO `AppProviders` (BrowserRouter już tam
 * jest), seedujemy sesję demo (`seedRealisticSession` — `currentUser.id` na
 * stałe `user-piotr-demo`) i podmieniamy `Api.get`/`Api.post`/`Api.patch` —
 * `Api` jest zwykłym eksportowanym obiektem, więc podmiana metody patchuje
 * singleton, którego `workspaceApi.ts` używa do KAŻDEGO wywołania
 * `/audits/*`. Kształt mocków ściśle odpowiada kontraktowi `workspaceApi.ts`
 * (`Api.get(url)` → `{ data: <ciało> }`, `unwrapEnvelope()` rozpakowuje).
 *
 * `CriterionWorkspace` czyta `programId`/`criterionId` przez `useParams`
 * (patrz `__tests__/CriterionWorkspace.test.tsx` — trasa realna:
 * `/audit-programs/method/:programId/criteria/:criterionId`), więc ten
 * harness NIE może po prostu wyrenderować komponentu wprost — musi
 * przełączyć jedyny `BrowserRouter` z `AppProviders` na tę trasę przez
 * `useNavigate()` (wzorzec z `dev-render/screens/deck-artifact.tsx`), a
 * potem zamontować `<Routes><Route path="..." element={<CriterionWorkspace />} />`.
 *
 * DANE: kryterium „Rejestracja zgłoszenia" (wymaganie: „Zgłoszenie jest
 * rejestrowane w ciągu jednego dnia roboczego", źródło: „Procedura obsługi
 * zgłoszeń, pkt 3.1") — audyt WEWNĘTRZNEGO procesu obsługi zgłoszeń, bez
 * żadnego odniesienia do normy ISO/IATF (wymóg prawny programu, patrz
 * `audyty-piec-powierzchni.tsx` — pakiet `VERIFIED_NORMATIVE` z tego samego
 * powodu nazywa się „procedura QMS klienta", nie „ISO 9001").
 *
 * URL PARAMS
 *   ?theme=light|dark             (obsługiwane globalnie przez main.tsx)
 *   ?role=auditee|auditor|lead_auditor|reviewer|action_owner
 *       Rola JEDYNEGO członka programu = `currentUser` (Piotr, na stałe
 *       `user-piotr-demo` z `seedRealisticSession`). Widoczność KAŻDEJ akcji
 *       zależy wyłącznie od `capabilitiesForRoles([role])`
 *       (mirror `ROLE_CAPABILITIES` w `workspaceApi.ts`):
 *         auditee      → evidence.submit, criterion.respond_as_auditee,
 *                         finding.respond_as_management, action.propose,
 *                         action.report_implementation, ai.propose (BEZ commit)
 *         auditor      → perform_test, conclude, evidence.review,
 *                         finding.draft/update, verification.perform,
 *                         ai.propose + ai.commit (BEZ finding.review!)
 *         lead_auditor → prawie wszystko (assign, test, conclude, evidence
 *                         review, finding review/close, action.approve,
 *                         verification, ai.propose + commit)
 *         reviewer     → evidence.review, finding.review/close,
 *                         action.approve, verification — BEZ ai.propose
 *                         (Teresa pokazuje komunikat „wymaga uprawnienia")
 *         action_owner → action.report_implementation, evidence.submit,
 *                         ai.propose — najbardziej okrojona rola (brak testu,
 *                         wniosku, recenzji dowodu/ustalenia, weryfikacji)
 *   ?stage=fresh|evidence|tested|finding|remediation|closed
 *       Moment w łańcuchu 18 ogniw (kumulatywnie — każdy kolejny stage
 *       zawiera treść poprzednich):
 *         fresh       — nic nie zrobione (workStatus 'open', wszystko puste)
 *         evidence    — dowód dostarczony, jeszcze NIE zrecenzowany
 *         tested      — procedura/próba/test wykonane, wynik 'fail', dowód
 *                       zrecenzowany jako PRZECZĄCY (supportsConformity:false
 *                       — nigdy chowany, kanon EvidencePanel)
 *         finding     — wniosek wyciągnięty (nonconforming), ustalenie
 *                       utworzone (status 'draft' — recenzja jeszcze możliwa
 *                       dla lead_auditor/reviewer)
 *         remediation — ustalenie potwierdzone, korekta + działanie
 *                       korygujące w toku (jedno 'implemented', jedno
 *                       'approved'), odpowiedź właściciela obszaru złożona
 *         closed      — działanie korygujące zweryfikowane jako skuteczne
 *                       (przez osobę INNĄ niż właściciel działania — kanon
 *                       niezależnego weryfikatora), ustalenie zamknięte
 *       Ustalenie jest automatycznie ZAZNACZANE (symulowany klik pierwszego
 *       wiersza w `FindingPanel`) dla stage ∈ {finding, remediation, closed},
 *       żeby `RemediationPanel` był widoczny bez ręcznej interakcji.
 *   ?state=loading|error|forbidden
 *       Nadpisuje `stage` — `GET /audits/criteria/:id`:
 *         loading    — nigdy się nie rozwiązuje (LoadingState)
 *         error      — odrzuca 503 (ErrorState, komunikat serwerowy)
 *         forbidden  — odrzuca 403 + `members` zwraca [] (użytkownik nie
 *                      jest członkiem programu) — UWAGA: `CriterionWorkspace`
 *                      NIE MA osobnej gałęzi na 403, renderuje się przez tę
 *                      samą generyczną `ErrorState` co `error` — to jest
 *                      wierne odwzorowanie realnego kodu, nie defekt tego
 *                      harnessu (opisane też w raporcie robotnika).
 *   ?teresa=1
 *       Po zamontowaniu i wczytaniu danych harness symuluje klik „Zapytaj
 *       Teresę" na KAŻDEJ widocznej `TeresaProposalCard` (jest ich do dwóch:
 *       „wyjaśnij kryterium" zawsze, „zredaguj ustalenie" wewnątrz
 *       `FindingPanel` zawsze) — pokazuje podgląd przed/po, uzasadnienie,
 *       pewność i źródła. Jeśli aktywna rola nie ma `ai.propose` (reviewer),
 *       przycisku nie ma i karta pokazuje komunikat o braku uprawnienia —
 *       uczciwy render, nie ukrywany.
 */
import React, { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';

import { CriterionWorkspace } from '../../src/components/Audit/method/workspace/CriterionWorkspace';
import type {
  ActionKind,
  ActionStatus,
  AiTargetType,
  AuditRole,
  ConformityStatus,
  CriterionDetail,
  EvidenceKind,
  TestResult,
  WorkspaceAiProposal,
  WorkspaceCorrectiveAction,
  WorkspaceCriterion,
  WorkspaceEvidence,
  WorkspaceFinding,
  WorkspaceFindingDetail,
  WorkspaceManagementResponse,
  WorkspaceProgramMember,
  WorkspaceVerification,
} from '../../src/components/Audit/method/workspace/workspaceApi';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, auditsFiveSurfacesV1: true })
  );
} catch {
  // ignore
}

const CURRENT_USER_ID = 'user-piotr-demo'; // z seedRealisticSession — stałe dla całego harnessu
const AUDITOR_ID = 'user-marek-audytor';
const AUDITEE_ID = 'user-jan-kowalski';

const PROGRAM_ID = 'prog-crm-obsluga-zgloszen';
const CRITERION_ID = 'crit-rejestracja-zgloszenia';
const ROUTE_PATH = `/audit-programs/method/${PROGRAM_ID}/criteria/${CRITERION_ID}`;

const VALID_ROLES: AuditRole[] = ['auditee', 'auditor', 'lead_auditor', 'reviewer', 'action_owner'];
const VALID_STAGES = ['fresh', 'evidence', 'tested', 'finding', 'remediation', 'closed'] as const;
type Stage = (typeof VALID_STAGES)[number];
const RANK: Record<Stage, number> = { fresh: 0, evidence: 1, tested: 2, finding: 3, remediation: 4, closed: 5 };

const qp = new URLSearchParams(window.location.search);
const ROLE: AuditRole = (VALID_ROLES as string[]).includes(qp.get('role') || '')
  ? (qp.get('role') as AuditRole)
  : 'lead_auditor';
const STAGE: Stage = (VALID_STAGES as readonly string[]).includes(qp.get('stage') || '')
  ? (qp.get('stage') as Stage)
  : 'finding';
const RANKN = RANK[STAGE];
const STATE = qp.get('state') || 'default'; // loading|error|forbidden|default
const TERESA_ON = qp.get('teresa') === '1';

// ---------------------------------------------------------------------------
// Kryterium — łączy się jeden do jednego z realistycznym audytem procesu
// obsługi zgłoszeń (BEZ odniesienia do ISO/IATF — norma zewnętrzna nie jest
// tu przedmiotem, przedmiotem jest WEWNĘTRZNA procedura klienta).
// ---------------------------------------------------------------------------

const EXPECTED_EVIDENCE = [
  {
    kind: 'system_export' as EvidenceKind,
    description: 'Eksport rejestru zgłoszeń z systemu ticketowego za wybrany miesiąc (data wpłynięcia i data rejestracji)',
    mandatory: true,
  },
  {
    kind: 'screenshot' as EvidenceKind,
    description: 'Zrzut ekranu potwierdzający znacznik czasu rejestracji przykładowego zgłoszenia',
    mandatory: false,
  },
];

function buildCriterion(): WorkspaceCriterion {
  const auditeeResponded = RANKN >= RANK.evidence;
  const tested = RANKN >= RANK.tested;
  const concluded = RANKN >= RANK.finding;

  const workStatus =
    RANKN >= RANK.finding ? 'concluded' : RANKN >= RANK.tested ? 'tested' : RANKN >= RANK.evidence ? 'evidence_received' : 'open';

  return {
    id: CRITERION_ID,
    programId: PROGRAM_ID,
    organizationId: 'org-dbr77-demo',
    refCode: 'OBS-3.1',
    title: 'Rejestracja zgłoszenia',
    requirementText: 'Zgłoszenie jest rejestrowane w ciągu jednego dnia roboczego od wpłynięcia.',
    sourceReference: 'Procedura obsługi zgłoszeń, pkt 3.1',
    auditQuestion:
      'Czy każde zgłoszenie klienta trafiające do zespołu obsługi jest rejestrowane w systemie ticketowym w ciągu jednego dnia roboczego od wpłynięcia?',
    expectedEvidence: EXPECTED_EVIDENCE,
    auditProcedure:
      'Porównanie znacznika czasu wpłynięcia zgłoszenia ze znacznikiem czasu jego rejestracji w systemie ticketowym, na próbie zgłoszeń z jednego miesiąca kalendarzowego.',
    samplingGuidance:
      'Min. 12 zgłoszeń z jednego miesiąca, w tym zgłoszenia wpływające w piątki po południu i przed dniami wolnymi od pracy.',
    applicable: true,
    notApplicableReason: null,
    assignedAuditorId: AUDITOR_ID,
    assignedAuditeeId: AUDITEE_ID,
    auditeeResponse: auditeeResponded
      ? 'Wszystkie zgłoszenia są rejestrowane przez konsultanta pierwszej linii bezpośrednio w momencie odebrania telefonu lub maila. Wyjątkiem są zgłoszenia wpływające po godzinach pracy — te są rejestrowane następnego dnia roboczego rano.'
      : null,
    auditeeRespondedBy: auditeeResponded ? AUDITEE_ID : null,
    auditeeRespondedAt: auditeeResponded ? '2026-08-05T09:40:00Z' : null,
    procedurePerformed: tested
      ? 'Porównano datę/godzinę wpłynięcia zgłoszenia (znacznik z bramki mailowej / call center) z datą/godziną utworzenia rekordu w systemie ticketowym dla próby 12 zgłoszeń z lipca 2026.'
      : null,
    sampleDescription: tested
      ? '12 zgłoszeń wylosowanych z rejestru lipca 2026, w tym 3 zgłoszenia wpływające w piątek po południu.'
      : null,
    testPerformed: tested
      ? 'Dla każdego zgłoszenia w próbie policzono liczbę dni roboczych między wpłynięciem a rejestracją w systemie.'
      : null,
    testResult: tested ? ('fail' as TestResult) : null,
    auditorNote: null,
    auditorConclusion: concluded
      ? 'Trzy z dwunastu próbkowanych zgłoszeń (25%) zostały zarejestrowane później niż jeden dzień roboczy od wpłynięcia — wymóg pkt 3.1 procedury nie jest spełniany w sposób systematyczny.'
      : null,
    conformityStatus: concluded ? ('nonconforming' as ConformityStatus) : ('not_tested' as ConformityStatus),
    concludedBy: concluded ? AUDITOR_ID : null,
    concludedAt: concluded ? '2026-08-07T11:00:00Z' : null,
    workStatus,
    createdAt: '2026-07-20T08:00:00Z',
    updatedAt: concluded ? '2026-08-07T11:00:00Z' : tested ? '2026-08-06T16:00:00Z' : auditeeResponded ? '2026-08-05T09:40:00Z' : '2026-07-20T08:00:00Z',
  };
}

function buildEvidence(): WorkspaceEvidence[] {
  if (RANKN < RANK.evidence) return [];
  const reviewed = RANKN >= RANK.tested;
  const item: WorkspaceEvidence = {
    id: 'evid-114',
    programId: PROGRAM_ID,
    criterionId: CRITERION_ID,
    requestId: null,
    evidenceKind: 'system_export',
    title: 'Eksport rejestru zgłoszeń — lipiec 2026',
    description: 'Pełny eksport CSV z systemu ticketowego, 214 zgłoszeń, z datami wpłynięcia i rejestracji.',
    externalReference: null,
    contentSnapshot: null,
    providedBy: AUDITEE_ID,
    providedAt: '2026-08-05T10:15:00Z',
    capturedAt: '2026-08-05T10:15:00Z',
    sufficiency: reviewed ? 'sufficient' : 'unknown',
    reliability: reviewed ? 'reliable' : 'unknown',
    currencyStatus: reviewed ? 'current' : 'unknown',
    supportsConformity: reviewed ? false : null, // dowód PRZECZĄCY — nigdy chowany (kanon EvidencePanel)
    reviewNote: reviewed
      ? 'Dowód potwierdza rejestrację, ale ujawnia opóźnienia w 3 z 12 próbkowanych zgłoszeń.'
      : null,
    accepted: reviewed ? true : null,
    acceptedBy: reviewed ? AUDITOR_ID : null,
    acceptedAt: reviewed ? '2026-08-06T09:00:00Z' : null,
    rejectionReason: null,
    createdAt: '2026-08-05T10:15:00Z',
    updatedAt: reviewed ? '2026-08-06T09:00:00Z' : '2026-08-05T10:15:00Z',
  };
  return [item];
}

function buildFinding(): { finding: WorkspaceFinding | null; detail: WorkspaceFindingDetail | null } {
  if (RANKN < RANK.finding) return { finding: null, detail: null };

  const status = RANKN === RANK.finding ? 'draft' : RANKN === RANK.remediation ? 'remediation_in_progress' : 'closed';

  const correction: WorkspaceCorrectiveAction = {
    id: 'act-korekcja-01',
    findingId: 'find-obs31-01',
    actionKind: 'correction' as ActionKind,
    title: 'Ręczna rejestracja trzech zaległych zgłoszeń (#REF-2201, #REF-2244, #REF-2291) w systemie',
    description: null,
    ownerUserId: AUDITEE_ID,
    dueDate: '2026-08-08',
    status: 'implemented' as ActionStatus,
    approvedBy: AUDITOR_ID,
    implementedAt: '2026-08-08T10:00:00Z',
    implementedBy: AUDITEE_ID,
    createdBy: AUDITEE_ID,
  };
  const correctiveAction: WorkspaceCorrectiveAction = {
    id: 'act-korygujace-01',
    findingId: 'find-obs31-01',
    actionKind: 'corrective_action' as ActionKind,
    title: 'Wdrożyć automatyczne powiadomienie w systemie ticketowym po 18 godzinach bez rejestracji zgłoszenia',
    description: null,
    ownerUserId: AUDITEE_ID,
    dueDate: '2026-08-25',
    status: (RANKN >= RANK.closed ? 'verified' : 'approved') as ActionStatus,
    approvedBy: AUDITOR_ID,
    implementedAt: RANKN >= RANK.closed ? '2026-08-20T14:00:00Z' : null,
    implementedBy: RANKN >= RANK.closed ? AUDITEE_ID : null,
    createdBy: AUDITOR_ID,
  };

  const correctiveActions: WorkspaceCorrectiveAction[] = RANKN >= RANK.remediation ? [correction, correctiveAction] : [];

  const verifications: WorkspaceVerification[] =
    RANKN >= RANK.closed
      ? [
          {
            id: 'ver-01',
            correctiveActionId: correctiveAction.id,
            findingId: 'find-obs31-01',
            verificationKind: 'effectiveness',
            performedAt: '2026-09-05T09:00:00Z',
            performedBy: AUDITOR_ID, // NIE właściciel działania — kanon niezależnego weryfikatora
            evidenceId: null,
            result: 'effective',
            note: 'Sprawdzono rejestr zgłoszeń za wrzesień 2026 — 0 przypadków przekroczenia terminu w próbie 15 zgłoszeń.',
          },
        ]
      : [];

  const managementResponses: WorkspaceManagementResponse[] =
    RANKN >= RANK.remediation
      ? [
          {
            id: 'resp-01',
            findingId: 'find-obs31-01',
            position: 'accept',
            statement: 'Zgadzamy się z ustaleniem. Wdrożymy automatyczne powiadomienie w systemie ticketowym.',
            respondedBy: AUDITEE_ID,
            respondedAt: '2026-08-07T15:00:00Z',
            status: 'submitted',
          },
        ]
      : [];

  const finding: WorkspaceFinding = {
    id: 'find-obs31-01',
    programId: PROGRAM_ID,
    criterionId: CRITERION_ID,
    referenceCode: 'F-2026-014',
    statement:
      'Trzy z dwunastu próbkowanych zgłoszeń (25%) zostały zarejestrowane w systemie później niż jeden dzień roboczy od wpłynięcia, niezgodnie z pkt 3.1 procedury obsługi zgłoszeń.',
    requirementText: 'Zgłoszenie jest rejestrowane w ciągu jednego dnia roboczego od wpłynięcia.',
    conditionText: 'Zgłoszenia #REF-2201, #REF-2244, #REF-2291 zarejestrowano odpowiednio 2, 2 i 3 dni robocze po wpłynięciu.',
    gapText: 'Brak mechanizmu przypominającego / eskalacji dla zgłoszeń wpływających poza godzinami szczytu (piątek po południu, przed dniami wolnymi).',
    objectiveEvidence: ['Eksport rejestru zgłoszeń — lipiec 2026 (D-114)'],
    contradictingEvidence: [],
    classification: 'nonconforming',
    severity: 'medium',
    recommendation: 'Wprowadzić automatyczne powiadomienie dla konsultanta, gdy zgłoszenie zbliża się do limitu jednego dnia roboczego bez rejestracji.',
    rootCause:
      RANKN >= RANK.remediation
        ? 'Brak automatycznego przypomnienia w systemie ticketowym dla zgłoszeń wpływających po godzinach szczytu — rejestracja zależy wyłącznie od pamięci konsultanta.'
        : null,
    rootCauseMethod: RANKN >= RANK.remediation ? '5 x Dlaczego' : null,
    rootCauseConfirmed: RANKN >= RANK.remediation,
    status,
    ownerUserId: AUDITEE_ID,
    authorId: AUDITOR_ID, // ŚWIADOMIE różny od CURRENT_USER_ID — inaczej isOwnFinding chowałby przyciski recenzji dla KAŻDEJ roli
    reviewedBy: RANKN >= RANK.remediation ? AUDITOR_ID : null,
    aiProposed: false,
    residualRisk: null,
    residualRiskNote: null,
    closedAt: RANKN >= RANK.closed ? '2026-09-05T09:30:00Z' : null,
    closureNote:
      RANKN >= RANK.closed
        ? 'Działanie korygujące potwierdzone jako skuteczne w próbie kontrolnej z września 2026. Ustalenie zamknięte.'
        : null,
    createdAt: '2026-08-07T11:05:00Z',
    updatedAt: RANKN >= RANK.closed ? '2026-09-05T09:30:00Z' : RANKN >= RANK.remediation ? '2026-08-20T14:00:00Z' : '2026-08-07T11:05:00Z',
  };

  const detail: WorkspaceFindingDetail = { ...finding, managementResponses, correctiveActions, verifications };
  return { finding, detail };
}

const CRITERION = buildCriterion();
const EVIDENCE: WorkspaceEvidence[] = buildEvidence();
const { finding: FINDING, detail: FINDING_DETAIL } = buildFinding();
const FINDINGS: WorkspaceFinding[] = FINDING ? [FINDING] : [];

// Kopie mutowalne — POST/PATCH z ekranu (kliknięcia nadzorcy) modyfikują TE
// zmienne, więc harness zostaje użyteczny do eksploracji, nie tylko do
// jednego zrzutu startowego.
let criterionStore: WorkspaceCriterion = { ...CRITERION };
let evidenceStore: WorkspaceEvidence[] = [...EVIDENCE];
let findingsStore: WorkspaceFinding[] = [...FINDINGS];
let findingDetailStore: Record<string, WorkspaceFindingDetail> = FINDING_DETAIL ? { [FINDING_DETAIL.id]: { ...FINDING_DETAIL } } : {};
const aiProposals: Record<string, WorkspaceAiProposal> = {};
let aiCounter = 0;

// ---------------------------------------------------------------------------
// Teresa — propozycje realistyczne per intencja, ZAWSZE ze źródłami (kanon:
// propozycja bez źródeł nigdy nie ma aktywnego „Zastosuj").
// ---------------------------------------------------------------------------

function makeAiProposal(targetType: AiTargetType, targetId: string | null, intent: string): WorkspaceAiProposal {
  const id = `ai-${++aiCounter}`;
  if (intent === 'explain_criterion') {
    return {
      id,
      programId: PROGRAM_ID,
      targetType,
      targetId,
      intent,
      proposal: {},
      preview: {
        field: 'wyjaśnienie',
        before: null,
        after:
          'Kryterium wymaga, aby każde zgłoszenie od klienta zostało wprowadzone do rejestru w systemie ticketowym w ciągu jednego dnia roboczego od wpłynięcia — liczy się data/godzina UTWORZENIA rekordu w systemie, nie data odczytania zgłoszenia przez pracownika.',
      },
      rationale: 'Wyjaśnienie oparte wyłącznie na treści procedury źródłowej — nie zawiera interpretacji wykraczającej poza dokument.',
      confidence: 0.86,
      sources: [
        {
          id: 'src-proc-31',
          excerpt: 'Procedura obsługi zgłoszeń, pkt 3.1: „Zgłoszenie musi zostać zarejestrowane w systemie w ciągu 1 dnia roboczego od wpłynięcia."',
        },
      ],
      status: 'pending',
      decidedAt: null,
      committedAt: null,
    };
  }
  if (intent === 'draft_finding') {
    return {
      id,
      programId: PROGRAM_ID,
      targetType,
      targetId,
      intent,
      proposal: {},
      preview: {
        field: 'statement',
        before: '',
        after:
          'Zgłoszenie #REF-2291 zostało zarejestrowane w systemie dopiero trzeciego dnia roboczego od wpłynięcia (wpłynęło 2026-08-03, zarejestrowano 2026-08-06), niezgodnie z pkt 3.1 procedury obsługi zgłoszeń (rejestracja w ciągu 1 dnia roboczego).',
      },
      rationale: 'Zaproponowano na podstawie eksportu rejestru zgłoszeń (dowód D-114) — trzy z dwunastu próbkowanych zgłoszeń przekroczyły termin jednego dnia roboczego.',
      confidence: 0.74,
      sources: [
        {
          id: 'evid-114',
          excerpt: 'Eksport rejestru zgłoszeń — wiersz #REF-2291: wpłynięcie 2026-08-03 09:12, rejestracja 2026-08-06 14:03.',
        },
      ],
      status: 'pending',
      decidedAt: null,
      committedAt: null,
    };
  }
  return {
    id,
    programId: PROGRAM_ID,
    targetType,
    targetId,
    intent,
    proposal: {},
    preview: { field: 'treść', before: null, after: 'Propozycja Teresy dla tego zadania.' },
    rationale: null,
    confidence: null,
    sources: [],
    status: 'pending',
    decidedAt: null,
    committedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Api.get/post/patch — podmiana singletona (wzorzec `audyty-piec-powierzchni.tsx`).
// ---------------------------------------------------------------------------

function envelope<T>(data: T): { data: T } {
  return { data };
}

function httpError(message: string, status: number): never {
  throw Object.assign(new Error(message), { status });
}

function toCriterionDetail(): CriterionDetail {
  return {
    criterion: criterionStore,
    evidence: evidenceStore.map((e) => ({
      id: e.id,
      evidenceKind: e.evidenceKind,
      title: e.title,
      accepted: e.accepted,
      supportsConformity: e.supportsConformity,
      createdAt: e.createdAt,
    })),
    evidenceRequests: [],
    findings: findingsStore.map((f) => ({
      id: f.id,
      statement: f.statement,
      classification: f.classification,
      severity: f.severity,
      status: f.status,
    })),
  };
}

const originalGet = Api.get.bind(Api);
const originalPost = Api.post.bind(Api);
const originalPatch = Api.patch.bind(Api);

Api.get = (async (url: string, ...rest: unknown[]) => {
  if (!url.startsWith('/audits/')) return (originalGet as any)(url, ...rest);

  const path = url.split('?')[0];

  const members = path.match(/^\/audits\/programs\/([^/]+)\/members$/);
  if (members) {
    if (STATE === 'forbidden') return envelope({ members: [] as WorkspaceProgramMember[] });
    return envelope({ members: [{ userId: CURRENT_USER_ID, name: 'Piotr Wiśniewski', memberRole: ROLE }] });
  }

  const criterionDetail = path.match(/^\/audits\/criteria\/([^/]+)$/);
  if (criterionDetail) {
    if (STATE === 'loading') return new Promise(() => {}); // nigdy się nie rozwiąże
    if (STATE === 'error') httpError('Serwer audytów chwilowo niedostępny (503).', 503);
    if (STATE === 'forbidden') httpError('Nie masz dostępu do tego kryterium — nie jesteś przypisany do tego programu audytowego.', 403);
    return envelope(toCriterionDetail());
  }

  if (path === '/audits/evidence') {
    return envelope({ evidence: evidenceStore, total: evidenceStore.length });
  }
  if (path === '/audits/evidence/requests') {
    return envelope({ requests: [], total: 0 });
  }
  if (path === '/audits/findings') {
    return envelope({ items: findingsStore, total: findingsStore.length });
  }
  const findingDetail = path.match(/^\/audits\/findings\/([^/]+)$/);
  if (findingDetail) {
    const id = decodeURIComponent(findingDetail[1]);
    return envelope(findingDetailStore[id] ?? null);
  }
  const aiPreview = path.match(/^\/audits\/ai\/proposals\/([^/]+)\/preview$/);
  if (aiPreview) {
    return envelope(aiProposals[decodeURIComponent(aiPreview[1])] ?? null);
  }

  return (originalGet as any)(url, ...rest);
}) as typeof Api.get;

Api.post = (async (url: string, data: any) => {
  if (!url.startsWith('/audits/')) return (originalPost as any)(url, data);

  const auditeeResponse = url.match(/^\/audits\/criteria\/([^/]+)\/auditee-response$/);
  if (auditeeResponse) {
    criterionStore = {
      ...criterionStore,
      auditeeResponse: data?.text ?? criterionStore.auditeeResponse,
      auditeeRespondedBy: CURRENT_USER_ID,
      auditeeRespondedAt: new Date().toISOString(),
      workStatus: criterionStore.workStatus === 'open' ? 'evidence_received' : criterionStore.workStatus,
    };
    return envelope(criterionStore);
  }

  const test = url.match(/^\/audits\/criteria\/([^/]+)\/test$/);
  if (test) {
    criterionStore = {
      ...criterionStore,
      procedurePerformed: data?.procedurePerformed ?? criterionStore.procedurePerformed,
      sampleDescription: data?.sampleDescription ?? criterionStore.sampleDescription,
      testPerformed: data?.testPerformed ?? criterionStore.testPerformed,
      testResult: data?.testResult ?? criterionStore.testResult,
      workStatus: 'tested',
    };
    return envelope(criterionStore);
  }

  const conclude = url.match(/^\/audits\/criteria\/([^/]+)\/conclude$/);
  if (conclude) {
    criterionStore = {
      ...criterionStore,
      auditorConclusion: data?.auditorConclusion ?? criterionStore.auditorConclusion,
      conformityStatus: data?.conformityStatus ?? criterionStore.conformityStatus,
      concludedBy: CURRENT_USER_ID,
      concludedAt: new Date().toISOString(),
      workStatus: 'concluded',
    };
    return envelope(criterionStore);
  }

  if (url === '/audits/evidence') {
    const item: WorkspaceEvidence = {
      id: `evid-demo-${Date.now()}`,
      programId: data?.programId ?? PROGRAM_ID,
      criterionId: data?.criterionId ?? CRITERION_ID,
      requestId: data?.requestId ?? null,
      evidenceKind: data?.kind ?? 'document',
      title: data?.title ?? 'Nowy dowód',
      description: data?.description ?? null,
      externalReference: data?.externalReference ?? null,
      contentSnapshot: data?.contentSnapshot ?? null,
      providedBy: CURRENT_USER_ID,
      providedAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
      sufficiency: 'unknown',
      reliability: 'unknown',
      currencyStatus: 'unknown',
      supportsConformity: null,
      reviewNote: null,
      accepted: null,
      acceptedBy: null,
      acceptedAt: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    evidenceStore = [item, ...evidenceStore];
    return envelope(item);
  }

  const evidenceReview = url.match(/^\/audits\/evidence\/([^/]+)\/review$/);
  if (evidenceReview) {
    const id = decodeURIComponent(evidenceReview[1]);
    evidenceStore = evidenceStore.map((e) =>
      e.id === id
        ? {
            ...e,
            ...data,
            acceptedBy: data?.accepted !== undefined ? CURRENT_USER_ID : e.acceptedBy,
            acceptedAt: data?.accepted !== undefined ? new Date().toISOString() : e.acceptedAt,
            updatedAt: new Date().toISOString(),
          }
        : e
    );
    return envelope(evidenceStore.find((e) => e.id === id));
  }

  if (url === '/audits/findings') {
    const id = `find-demo-${Date.now()}`;
    const created: WorkspaceFinding = {
      id,
      programId: data?.programId ?? PROGRAM_ID,
      criterionId: data?.criterionId ?? CRITERION_ID,
      referenceCode: `F-2026-DEMO`,
      statement: data?.statement ?? '',
      requirementText: data?.requirementText ?? null,
      conditionText: data?.conditionText ?? null,
      gapText: data?.gapText ?? null,
      objectiveEvidence: data?.objectiveEvidence ?? [],
      contradictingEvidence: data?.contradictingEvidence ?? [],
      classification: data?.classification ?? 'nonconforming',
      severity: data?.severity ?? 'medium',
      recommendation: data?.recommendation ?? null,
      rootCause: null,
      rootCauseMethod: null,
      rootCauseConfirmed: false,
      status: 'draft',
      ownerUserId: data?.ownerUserId ?? null,
      authorId: CURRENT_USER_ID,
      reviewedBy: null,
      aiProposed: false,
      residualRisk: null,
      residualRiskNote: null,
      closedAt: null,
      closureNote: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    findingsStore = [created, ...findingsStore];
    findingDetailStore[id] = { ...created, managementResponses: [], correctiveActions: [], verifications: [] };
    return envelope(created);
  }

  const findingReview = url.match(/^\/audits\/findings\/([^/]+)\/review$/);
  if (findingReview) {
    const id = decodeURIComponent(findingReview[1]);
    const decision = data?.decision;
    const nextStatus = decision === 'confirm' ? 'confirmed' : decision === 'send_back' ? 'draft' : 'rejected';
    findingsStore = findingsStore.map((f) => (f.id === id ? { ...f, status: nextStatus, reviewedBy: CURRENT_USER_ID } : f));
    if (findingDetailStore[id]) findingDetailStore[id] = { ...findingDetailStore[id], status: nextStatus, reviewedBy: CURRENT_USER_ID };
    return envelope(findingsStore.find((f) => f.id === id));
  }

  const findingResponse = url.match(/^\/audits\/findings\/([^/]+)\/response$/);
  if (findingResponse) {
    const id = decodeURIComponent(findingResponse[1]);
    const response: WorkspaceManagementResponse = {
      id: `resp-demo-${Date.now()}`,
      findingId: id,
      position: data?.position ?? 'accept',
      statement: data?.statement ?? '',
      respondedBy: CURRENT_USER_ID,
      respondedAt: new Date().toISOString(),
      status: 'submitted',
    };
    if (findingDetailStore[id]) {
      findingDetailStore[id] = {
        ...findingDetailStore[id],
        status: 'response_pending',
        managementResponses: [...findingDetailStore[id].managementResponses, response],
      };
    }
    return envelope(response);
  }

  const acceptRisk = url.match(/^\/audits\/findings\/([^/]+)\/accept-risk$/);
  if (acceptRisk) {
    const id = decodeURIComponent(acceptRisk[1]);
    findingsStore = findingsStore.map((f) => (f.id === id ? { ...f, status: 'risk_accepted', residualRiskNote: data?.note ?? null } : f));
    if (findingDetailStore[id]) findingDetailStore[id] = { ...findingDetailStore[id], status: 'risk_accepted', residualRiskNote: data?.note ?? null };
    return envelope(findingsStore.find((f) => f.id === id));
  }

  const closeFinding = url.match(/^\/audits\/findings\/([^/]+)\/close$/);
  if (closeFinding) {
    const id = decodeURIComponent(closeFinding[1]);
    findingsStore = findingsStore.map((f) => (f.id === id ? { ...f, status: 'closed', closedAt: new Date().toISOString(), closureNote: data?.note ?? null } : f));
    if (findingDetailStore[id])
      findingDetailStore[id] = { ...findingDetailStore[id], status: 'closed', closedAt: new Date().toISOString(), closureNote: data?.note ?? null };
    return envelope(findingsStore.find((f) => f.id === id));
  }

  if (url === '/audits/actions') {
    const findingId = data?.findingId;
    const action: WorkspaceCorrectiveAction = {
      id: `act-demo-${Date.now()}`,
      findingId,
      actionKind: data?.actionKind ?? 'corrective_action',
      title: data?.title ?? '',
      description: data?.description ?? null,
      ownerUserId: data?.ownerUserId ?? null,
      dueDate: data?.dueDate ?? null,
      status: 'proposed',
      approvedBy: null,
      implementedAt: null,
      implementedBy: null,
      createdBy: CURRENT_USER_ID,
    };
    if (findingDetailStore[findingId]) {
      findingDetailStore[findingId] = {
        ...findingDetailStore[findingId],
        correctiveActions: [...findingDetailStore[findingId].correctiveActions, action],
      };
    }
    return envelope(action);
  }

  const approveAction = url.match(/^\/audits\/actions\/([^/]+)\/approve$/);
  if (approveAction) {
    const id = decodeURIComponent(approveAction[1]);
    for (const key of Object.keys(findingDetailStore)) {
      findingDetailStore[key] = {
        ...findingDetailStore[key],
        correctiveActions: findingDetailStore[key].correctiveActions.map((a) =>
          a.id === id ? { ...a, status: 'approved', approvedBy: CURRENT_USER_ID } : a
        ),
      };
    }
    return envelope({});
  }

  const rejectAction = url.match(/^\/audits\/actions\/([^/]+)\/reject$/);
  if (rejectAction) {
    const id = decodeURIComponent(rejectAction[1]);
    for (const key of Object.keys(findingDetailStore)) {
      findingDetailStore[key] = {
        ...findingDetailStore[key],
        correctiveActions: findingDetailStore[key].correctiveActions.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)),
      };
    }
    return envelope({});
  }

  const implementation = url.match(/^\/audits\/actions\/([^/]+)\/implementation$/);
  if (implementation) {
    const id = decodeURIComponent(implementation[1]);
    for (const key of Object.keys(findingDetailStore)) {
      findingDetailStore[key] = {
        ...findingDetailStore[key],
        correctiveActions: findingDetailStore[key].correctiveActions.map((a) =>
          a.id === id ? { ...a, status: 'implemented', implementedAt: new Date().toISOString(), implementedBy: CURRENT_USER_ID } : a
        ),
      };
    }
    return envelope({});
  }

  if (url === '/audits/actions/verifications') {
    const findingId = data?.findingId;
    const verification: WorkspaceVerification = {
      id: `ver-demo-${Date.now()}`,
      correctiveActionId: data?.correctiveActionId ?? null,
      findingId,
      verificationKind: data?.verificationKind ?? 'effectiveness',
      performedAt: null,
      performedBy: null,
      evidenceId: null,
      result: null,
      note: null,
    };
    if (findingDetailStore[findingId]) {
      findingDetailStore[findingId] = {
        ...findingDetailStore[findingId],
        verifications: [...findingDetailStore[findingId].verifications, verification],
      };
    }
    return envelope(verification);
  }

  const performVerification = url.match(/^\/audits\/actions\/verifications\/([^/]+)\/perform$/);
  if (performVerification) {
    const id = decodeURIComponent(performVerification[1]);
    for (const key of Object.keys(findingDetailStore)) {
      findingDetailStore[key] = {
        ...findingDetailStore[key],
        verifications: findingDetailStore[key].verifications.map((v) =>
          v.id === id ? { ...v, result: data?.result ?? v.result, performedAt: new Date().toISOString(), performedBy: CURRENT_USER_ID } : v
        ),
      };
    }
    return envelope({});
  }

  if (url === '/audits/ai/intent') {
    const p = makeAiProposal(data?.targetType, data?.targetId ?? null, data?.intent);
    aiProposals[p.id] = p;
    return envelope(p);
  }
  const decide = url.match(/^\/audits\/ai\/proposals\/([^/]+)\/decide$/);
  if (decide) {
    const id = decodeURIComponent(decide[1]);
    const p = aiProposals[id];
    if (p) {
      p.status = data?.decision === 'accept' ? 'accepted' : 'rejected';
      p.decidedAt = new Date().toISOString();
    }
    return envelope(p ?? null);
  }
  const commit = url.match(/^\/audits\/ai\/proposals\/([^/]+)\/commit$/);
  if (commit) {
    const id = decodeURIComponent(commit[1]);
    const p = aiProposals[id];
    if (p) p.committedAt = new Date().toISOString();
    return envelope(p ?? null);
  }

  return (originalPost as any)(url, data);
}) as typeof Api.post;

Api.patch = (async (url: string, data: any) => {
  if (!url.startsWith('/audits/')) return (originalPatch as any)(url, data);

  const updateFinding = url.match(/^\/audits\/findings\/([^/]+)$/);
  if (updateFinding) {
    const id = decodeURIComponent(updateFinding[1]);
    findingsStore = findingsStore.map((f) => (f.id === id ? { ...f, ...data } : f));
    if (findingDetailStore[id]) findingDetailStore[id] = { ...findingDetailStore[id], ...data };
    return envelope(findingsStore.find((f) => f.id === id));
  }

  return (originalPatch as any)(url, data);
}) as typeof Api.patch;

// ---------------------------------------------------------------------------
// Symulowane interakcje po zamontowaniu: zaznaczenie ustalenia (żeby
// `RemediationPanel` był widoczny bez ręcznego klikania) i `?teresa=1`
// (klik „Zapytaj Teresę" na każdej widocznej karcie). Wzorzec z
// `dev-render/screens/audyty-drd-report.tsx` (querySelector + .click()).
// ---------------------------------------------------------------------------

function AutoInteractions(): null {
  useEffect(() => {
    let cancelled = false;
    let findingClicked = false;
    let teresaAsked = 0;

    const tick = () => {
      if (cancelled) return;

      if (RANKN >= RANK.finding && !findingClicked) {
        const row = document.querySelector('[data-testid="finding-panel"] tbody tr');
        if (row) {
          (row as HTMLElement).click();
          findingClicked = true;
        }
      }

      if (TERESA_ON && teresaAsked < 2) {
        const buttons = Array.from(
          document.querySelectorAll('[data-testid="teresa-proposal-card"] button')
        ) as HTMLButtonElement[];
        const askButtons = buttons.filter((b) => (b.textContent || '').trim() === 'Zapytaj Teresę');
        for (const b of askButtons) {
          b.click();
          teresaAsked += 1;
        }
      }
    };

    const interval = window.setInterval(tick, 400);
    const stop = window.setTimeout(() => window.clearInterval(interval), 7000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// Ekran — przełącza jedyny BrowserRouter z AppProviders na realną trasę
// `/audit-programs/method/:programId/criteria/:criterionId`, żeby
// `useParams` w `CriterionWorkspace` się rozwiązał (wzorzec `deck-artifact.tsx`).
// ---------------------------------------------------------------------------

function AudytyWarsztatKryteriumRoutes(): React.ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(ROUTE_PATH, { replace: true });
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/audit-programs/method/:programId/criteria/:criterionId" element={<CriterionWorkspace />} />
      </Routes>
      <AutoInteractions />
    </>
  );
}

export function AudytyWarsztatKryteriumScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <div style={{ height: '100vh', overflow: 'auto' }} data-testid="audyty-warsztat-kryterium-dev-render">
          <AudytyWarsztatKryteriumRoutes />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default AudytyWarsztatKryteriumScreen;
