/**
 * Day 237 evidence harness. It mounts the production MeetingHub,
 * MeetingObjectPage and Sidebar; only their API boundary receives fixtures.
 * URL: ?screen=day237-spotkania&view=list|object|member-sidebar|member-direct
 *      &state=pending|rejected|approved&theme=light|dark
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { MeetingHub } from '../../src/components/Meeting/MeetingHub';
import { MeetingObjectPage } from '../../src/components/Meeting/MeetingObjectPage';
import { Sidebar } from '../../src/components/navigation/Sidebar/Sidebar';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

type GovernanceState = 'pending' | 'rejected' | 'approved';
const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'list';
const governanceState: GovernanceState =
  params.get('state') === 'rejected' || params.get('state') === 'approved'
    ? params.get('state')
    : 'pending';
const isMember = view === 'member-sidebar' || view === 'member-direct';

if (isMember) {
  const currentUser = useAppStore.getState().currentUser;
  useAppStore.setState({
    currentUser: { ...currentUser, role: 'MEMBER', accessLevel: 'member' } as any,
    isDemoMode: false,
    isSidebarCollapsed: false,
  } as any);
}

const meetingId = `w3-meetings-${governanceState}`;
const meeting = {
  id: meetingId,
  projectId: 'pilot-transformacja-2026',
  title:
    governanceState === 'pending'
      ? 'Przegląd gotowości pilota — oczekuje na decyzję'
      : governanceState === 'rejected'
        ? 'Przegląd gotowości pilota — odrzucony protokół'
        : 'Przegląd gotowości pilota — zatwierdzony protokół',
  startAt: '2026-09-12T09:00:00.000Z',
  endAt: '2026-09-12T10:00:00.000Z',
  location: 'Sala Transformacji / Teams',
  attendees: ['Anna Kowalczyk', 'Marek Zieliński', 'Piotr Wiśniewski'],
  preRead: ['Pakiet gotowości pilota v3', 'Rejestr ryzyk operacyjnych'],
  agenda: ['Dowody gotowości', 'Ryzyka otwarte', 'Decyzja o uruchomieniu pilota'],
  decisions: [],
  followUps: [],
  status: 'completed',
  createdBy: 'owner-piotr',
};

const meetings = [
  meeting,
  {
    ...meeting,
    id: 'w3-meetings-next',
    title: 'Tygodniowy przegląd wdrożenia — stanowisko 2',
    startAt: '2026-09-19T09:00:00.000Z',
    endAt: '2026-09-19T10:30:00.000Z',
    status: 'scheduled',
  },
];

const noteStatus = governanceState === 'pending' ? 'proposed' : governanceState;
const notes = [
  {
    id: `note-${governanceState}`,
    source: 'ai' as const,
    summary:
      governanceState === 'rejected'
        ? 'Protokół odrzucono: brak potwierdzenia obsady drugiej zmiany.'
        : 'Zespół potwierdził gotowość techniczną; otwarte pozostaje ryzyko obsady drugiej zmiany.',
    keyPoints: ['Test przezbrojenia zakończony', 'Szkolenie ukończyły 2 z 3 zmian'],
    decisions: [{ decision: 'Uruchomić pilota po potwierdzeniu obsady drugiej zmiany' }],
    actionItems: [{ task: 'Potwierdzić obsadę drugiej zmiany', owner: 'Anna Kowalczyk' }],
    status: noteStatus as any,
    proposalId: `proposal-${governanceState}`,
    createdAt: '2026-09-12T10:05:00.000Z',
  },
];

Api.getMeetings = async () => ({ meetings }) as any;
Api.getMeeting = async () => ({ meeting }) as any;
Api.listMeetingNotes = async () => ({ notes }) as any;
Api.getUsers = async () =>
  [
    { id: 'owner-piotr', firstName: 'Piotr', lastName: 'Wiśniewski', email: 'piotr@example.test' },
  ] as any;
Api.listMeetingDecisionRecords = async () =>
  ({
    decisions:
      governanceState === 'approved'
        ? [
            {
              id: 'receipt-approved-1',
              organizationId: 'org-dbr77-demo',
              meetingId,
              statement: 'Uruchomić pilota po potwierdzeniu obsady drugiej zmiany',
              rationale: 'Dowody techniczne są kompletne.',
              status: 'recorded',
              sourceKind: 'approved_note',
              sourceNoteId: `note-${governanceState}`,
              createdAt: '2026-09-12T10:06:00.000Z',
              updatedAt: '2026-09-12T10:06:00.000Z',
            },
          ]
        : [],
  }) as any;
Api.listMeetingFollowUpRecords = async () => ({ followUps: [] }) as any;
Api.getAIOperatorMeetingBrief = async () =>
  ({
    prepSummary: 'Gotowość techniczna potwierdzona; wymagana decyzja właściciela.',
    agendaGaps: [],
    followUpSuggestions: [],
  }) as any;

window.history.replaceState(
  {},
  '',
  view === 'object' ? `/meetings/${meetingId}/decisions` : '/meetings'
);

function ProductSurface(): React.ReactElement {
  if (view === 'member-sidebar') {
    return (
      <div className="flex h-screen bg-c-bg">
        <Sidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl font-semibold text-c-text">MEMBER — menu pilotażowe</h1>
          <p className="mt-3 max-w-2xl text-c-text-secondary">
            Realny Sidebar dekoruje pozycję Spotkania dla roli MEMBER jako zablokowaną. Jest
            widoczna z kłódką, mimo że nie należy do PILOT_VISIBLE_MENU_IDS.
          </p>
        </main>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/meetings" element={<MeetingHub />} />
      <Route path="/meetings/:meetingId/decisions" element={<MeetingObjectPage />} />
    </Routes>
  );
}

export function Day237SpotkaniaScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div className="h-screen w-screen overflow-hidden bg-c-bg">
          <ProductSurface />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default Day237SpotkaniaScreen;
