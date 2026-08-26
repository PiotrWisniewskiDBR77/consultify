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
      content:
        'Audyt zidentyfikował 3 ustalenia: 1 o istotności wysokiej, 1 o istotności średniej, 1 o istotności niskiej. Audyt wykonano wg pakietu audytowego (klasyfikacja: VERIFIED, źródło: Procedura QMS Elmax Industries, wyd. 4), obejmując 24 kryteriów. Zespół audytowy liczył 2 osoby.',
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
