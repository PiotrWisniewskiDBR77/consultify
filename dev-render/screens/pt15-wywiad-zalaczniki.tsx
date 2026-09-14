/**
 * Dev-render: P-T15 (uwaga testera XV) — USUWANIE ZAŁĄCZNIKÓW w panelu
 * odpowiedzi Wywiadu, w POWŁOCE `<InterviewWorkspace>` (runtime
 * `single_question`).
 *
 * PO CO (CLAUDE.md §7): tester zgłosił „brak możliwości usuwania dodanych
 * załączników". Premisa zmierzona na linii: kosz/krzyżyk BYŁY w DOM, ale z
 * atrybutem `disabled` i `cursor-not-allowed`, a komponent nie miał żadnego
 * wołacza usuwania — mimo że trasa `DELETE /interview/evidence/:id` i
 * `handleDeleteEvidence` w workspace istniały od dawna. Ten ekran pokazuje
 * PRZED/PO na tym samym pytaniu i tym samym załączniku.
 *
 * Pytanie startowe ma DWA załączniki: plik (chip z koszem) i obraz
 * (miniatura z krzyżykiem w rogu) — obie ścieżki kasowania naraz.
 *
 * Atrapa `Api.delete` kasuje lokalnie i zwraca sukces, więc zrzut PO pokazuje
 * realny skutek (lista odświeżona), a nie samą aktywność przycisku.
 *
 * URL: ?screen=pt15-wywiad-zalaczniki[&lang=pl|en][&theme=light|dark]
 */

import React from 'react';

import { InterviewWorkspace } from '../../src/components/Interview/InterviewWorkspace';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const SESSION_ID = 'pt15-wywiad-zalaczniki';

const MOCK_SESSION = {
  id: SESSION_ID,
  organizationId: 'org-dbr77-demo',
  projectId: 'proj-dbr77-spawalnia',
  name: 'Wywiad diagnostyczny — robotyzacja spawalni, Metalpol Kielce',
  ownerId: 'user-piotr-demo',
  status: 'in_progress',
  progress: {},
  totalQuestions: 14,
  answeredQuestions: 9,
  runtimeModeDefault: 'single_question',
  startedAt: '2026-07-06T09:15:00Z',
  lastActivityAt: '2026-07-20T16:42:00Z',
  templateName: 'Diagnoza gotowości do automatyzacji (DRD v3)',
  summaryFacts: [],
  summaryGaps: [],
  summaryConstraints: [],
  summaryPainPoints: [],
};

const RAW_QUESTIONS = [
  {
    id: 'q-str-1',
    category: 'strategy',
    questionText: 'Jaki jest cel biznesowy stojący za robotyzacją spawalni?',
    answerText:
      'Zarząd zakontraktował na 2027 r. dwa duże zlecenia OEM (ramy podwozi, ok. 42 tys. szt./rok).',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'q-str-2',
    category: 'strategy',
    questionText: 'Kto jest sponsorem projektu i jaki ma mandat decyzyjny?',
    answerText: 'Sponsor: Marek Zieliński, Dyrektor Operacyjny — mandat do 1,8 mln zł.',
    status: 'answered',
    confidenceScore: 4,
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: 'q-str-3',
    category: 'strategy',
    questionText: 'Jakie są kryteria sukcesu wdrożenia z perspektywy zarządu i jak będą mierzone?',
    answerText: '',
    status: 'not_started',
    confidenceScore: 0,
    isRequired: true,
    sortOrder: 3,
  },
  {
    id: 'q-ops-1',
    category: 'operations',
    questionText: 'Jak wygląda obecny przebieg procesu spawania?',
    answerText: 'Pobranie z buforowego regału → pozycjonowanie → spawanie MAG → kontrola.',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 1,
  },
];

const MOCK_QUESTIONS = RAW_QUESTIONS.map((q) => ({
  ...q,
  sessionId: SESSION_ID,
  answerType: 'text',
  allowVoice: true,
  allowFileUpload: true,
  allowUrl: true,
  allowContextNote: true,
  answeredBy: q.status === 'answered' ? 'user-piotr-demo' : undefined,
  answeredAt: q.status === 'answered' ? '2026-07-20T16:42:00Z' : undefined,
  tags: [],
  isTemplate: false,
}));

const MOCK_CONTEXT = {
  companyName: 'Metalpol Kielce Sp. z o.o.',
  industry: 'Konstrukcje stalowe / poddostawca motoryzacyjny',
  companySize: 'Średnie przedsiębiorstwo',
  location: 'Kielce, woj. świętokrzyskie',
  employeeCount: 212,
  annualRevenue: '148 mln zł (2025)',
};

const MOCK_SUMMARY = { facts: [], gaps: [], constraints: [], painPoints: [] };
const MOCK_LINKED_ITEMS: unknown[] = [];
const MOCK_NOTES: unknown[] = [];
/**
 * Dwa załączniki przypięte do pytania, które panel otwiera domyślnie (`q-str-3` —
 * pierwsze BEZ odpowiedzi) — chip pliku i
 * miniatura obrazu. `questionId` musi się zgadzać, bo panel odpowiedzi
 * filtruje dowody po bieżącym pytaniu (`currentEvidence`).
 * Zero prefiksu `seed_` — inaczej produkt chowa pozycję jako dane zasiewowe.
 */
const PLIK_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4fekWVsQwtCQAn5udweuBergAAAAASUVORK5CYII=';

let MOCK_EVIDENCE: Array<Record<string, unknown>> = [
  {
    id: 'ev-plik-1',
    sessionId: SESSION_ID,
    questionId: 'q-str-3',
    category: 'strategy',
    evidenceType: 'file',
    evidenceRole: 'supporting',
    name: 'kontrakt-OEM-2027.pdf',
    title: 'kontrakt-OEM-2027.pdf',
    mimeType: 'application/pdf',
    fileType: 'application/pdf',
    fileSize: 184320,
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-20T16:40:00Z',
    createdAt: '2026-07-20T16:40:00Z',
  },
  {
    id: 'ev-obraz-1',
    sessionId: SESSION_ID,
    questionId: 'q-str-3',
    category: 'strategy',
    evidenceType: 'file',
    evidenceRole: 'supporting',
    name: 'layout-spawalni.png',
    title: 'layout-spawalni.png',
    url: PLIK_1PX,
    mimeType: 'image/png',
    fileType: 'image/png',
    fileSize: 45120,
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-20T16:41:00Z',
    createdAt: '2026-07-20T16:41:00Z',
  },
];

V8InterviewApi.getSession = (async () => ({
  session: MOCK_SESSION,
})) as unknown as typeof V8InterviewApi.getSession;

/**
 * `Api.delete` bez backendu: kasuje w atrapie i oddaje sukces. Dzięki temu
 * zrzut PO dowodzi SKUTKU (chip znika z listy), a nie samego kliknięcia.
 */
const realApiDelete = Api.delete.bind(Api);
Api.delete = (async (url: string, ...reszta: unknown[]) => {
  const dopasowanie = /\/interview\/evidence\/([^/?]+)/.exec(url);
  if (dopasowanie) {
    MOCK_EVIDENCE = MOCK_EVIDENCE.filter((item) => item.id !== dopasowanie[1]);
    return { success: true };
  }
  return (realApiDelete as (u: string, ...r: unknown[]) => unknown)(url, ...reszta);
}) as typeof Api.delete;

const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url.includes(`/interview/sessions/${SESSION_ID}/questions`)) return MOCK_QUESTIONS;
  if (url.includes(`/interview/sessions/${SESSION_ID}/notes`)) return MOCK_NOTES;
  if (url.includes(`/interview/sessions/${SESSION_ID}/evidence`)) return MOCK_EVIDENCE;
  if (url.includes(`/interview/sessions/${SESSION_ID}/summary`)) return MOCK_SUMMARY;
  if (url.includes(`/interview/sessions/${SESSION_ID}/linked-items`)) return MOCK_LINKED_ITEMS;
  if (url.includes('/interview/context')) return MOCK_CONTEXT;
  if (url.includes(`/interview/sessions/${SESSION_ID}`)) return MOCK_SESSION;
  return realApiGet(url);
}) as typeof Api.get;

const g = window as unknown as { __PT15_WYWIAD_ZALACZNIKI_FETCH__?: boolean };
const __tenEkran =
  new URLSearchParams(window.location.search).get('screen') === 'pt15-wywiad-zalaczniki';
if (__tenEkran && !g.__PT15_WYWIAD_ZALACZNIKI_FETCH__) {
  g.__PT15_WYWIAD_ZALACZNIKI_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/interview/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function Pt15WywiadZalacznikiScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <InterviewWorkspace
            key={`interview-${SESSION_ID}`}
            sessionId={SESSION_ID}
            projectId="proj-dbr77-spawalnia"
            onClose={() => {}}
            onComplete={() => {}}
            onSessionChange={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default Pt15WywiadZalacznikiScreen;
