/**
 * dev-render host for `<InterviewWorkspace>` in `single_question` runtime
 * mode — i.e. the `dedicated_question_workspace` presentation
 * (src/components/Interview/InterviewWorkspace.tsx ~L3362), which renders
 * the header progress bar fixed in 153-crimson-naprawa (check-triada.sh
 * --all gate restoration, 2026-08-31): the answered/total question progress
 * fill was `bg-c-accent` (crimson #85182F, decorative), swapped to
 * `bg-c-success` to match the sibling progress-fill convention already used
 * in InterviewHub.tsx.
 *
 * karta-interview.tsx (the existing evidence screen for this component)
 * deliberately sets `runtimeModeDefault: 'task_list'` to render the OTHER
 * presentation (`n_mode_shell`) — see its own header comment. This is a
 * SEPARATE, minimal screen (own SESSION_ID, own fetch-router guard) so it
 * does not touch that existing evidence screen or its registration.
 *
 * URL: ?screen=interview-progressbar-153[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { InterviewWorkspace } from '../../src/components/Interview/InterviewWorkspace';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const SESSION_ID = 'interview-progressbar-153-check';

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
const MOCK_EVIDENCE: unknown[] = [];

V8InterviewApi.getSession = (async () => ({
  session: MOCK_SESSION,
})) as unknown as typeof V8InterviewApi.getSession;

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

const g = window as unknown as { __INTERVIEW_PROGRESSBAR_153_FETCH__?: boolean };
const __tenEkran =
  new URLSearchParams(window.location.search).get('screen') === 'interview-progressbar-153';
if (__tenEkran && !g.__INTERVIEW_PROGRESSBAR_153_FETCH__) {
  g.__INTERVIEW_PROGRESSBAR_153_FETCH__ = true;
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

export function InterviewProgressbar153Screen(): React.ReactElement {
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

export default InterviewProgressbar153Screen;
