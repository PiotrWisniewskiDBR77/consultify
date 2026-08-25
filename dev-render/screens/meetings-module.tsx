/**
 * MOD06 MEETINGS — etap 2 dev-render host for the REAL `<MeetingHub>` (list)
 * and `<MeetingObjectPage>` (object card, 3 sections) — no re-implementation,
 * both are the real production components fed mock data only.
 *
 * `Api` is a plain exported object (`export const Api = {...}`), so
 * reassigning methods patches the same singleton every module imports
 * (pattern from dev-render/screens/decision-record.tsx /
 * dev-render/screens/melscanvas-workspace.tsx) — simpler and less fragile
 * than intercepting `window.fetch` for a surface this small.
 *
 * URL: ?screen=meetings-module[&lang=pl|en][&theme=light|dark]
 *   &view=list|object      which real component to mount (default: list)
 *   &tab=details|minutes|decisions   object-card section (default: details;
 *                          only meaningful when &view=object)
 *
 * Fixture: one rich meeting (`meeting-1`, NordFood SMED line rollout —
 * same fictional client used across the other dev-render fixtures) with a
 * full Szczegóły/Protokół/Decyzje set, plus 3 more list rows for a realistic
 * table (varied lifecycle: scheduled / completed / past-needs-update).
 * `meeting-1`'s governed notes deliberately mix both DTO shapes
 * (string vs {decision}/{task,owner}) and one note with empty
 * decisions/actionItems, so the Protokół section's honest "—" rendering and
 * its real-content rendering are both visible in the same screenshot set.
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { MeetingHub } from '../../src/components/Meeting/MeetingHub';
import { MeetingObjectPage } from '../../src/components/Meeting/MeetingObjectPage';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const hoursAgo = (h: number): string => new Date(Date.now() - h * 3600_000).toISOString();
const hoursFromNow = (h: number): string => new Date(Date.now() + h * 3600_000).toISOString();

const MEETING_1 = {
  id: 'meeting-1',
  projectId: 'proj-nordfood-smed',
  title: 'Przegląd wdrożenia SMED — linia pakowania 2',
  startAt: hoursFromNow(26),
  endAt: hoursFromNow(27.5),
  location: 'NordFood — hala B, sala Konferencyjna 2 / Teams',
  attendees: [
    'Anna Kowalczyk (Kierownik produkcji)',
    'Marek Zieliński (Właściciel procesu)',
    'Katarzyna Nowak (Utrzymanie ruchu)',
    'Piotr Wiśniewski (DBR77 — doradca)',
  ],
  preRead: [
    'Raport czasu przezbrojenia — tydzień 33',
    'Zdjęcia stanowiska 2 przed/po pilotażu',
  ],
  agenda: [
    'Status działań z poprzedniego przeglądu',
    'Gotowość do pilotażu na stanowisku 2',
    'Ryzyka: dostępność zapasowych matryc',
    'Decyzja: termin startu pilotażu',
  ],
  decisions: [
    'Zatwierdzono budżet doposażenia stanowiska 2 (18 400 PLN)',
    'Przesunięto start pilotażu o tydzień — do 2026-09-01',
  ],
  followUps: [
    { id: 'fu-1', title: 'Zamówić zapasowe matryce', owner: 'Katarzyna Nowak', status: 'open' },
    { id: 'fu-2', title: 'Rozesłać zaktualizowaną checklistę SMED', owner: 'Anna Kowalczyk', status: 'done' },
  ],
  status: 'scheduled',
};

const MEETING_2 = {
  id: 'meeting-2',
  projectId: 'proj-nordfood-smed',
  title: 'Warsztat mapowania strat OEE',
  startAt: hoursAgo(96),
  endAt: hoursAgo(94.5),
  location: 'NordFood — hala A',
  attendees: ['Marek Zieliński (Właściciel procesu)', 'Piotr Wiśniewski (DBR77 — doradca)'],
  preRead: [],
  agenda: ['Przegląd 6 dużych strat', 'Priorytetyzacja wg wpływu na OEE'],
  decisions: ['Priorytet nr 1: czas przezbrojenia (44% strat)'],
  followUps: [{ id: 'fu-3', title: 'Uzupełnić rejestr strat za sierpień', owner: 'Marek Zieliński', status: 'done' }],
  status: 'completed',
};

// Past end time, status never flipped to 'completed' — exercises the
// "Past — needs update" lifecycle chip (deriveMeetingLifecycle).
const MEETING_3 = {
  id: 'meeting-3',
  projectId: null,
  title: 'Spotkanie zarządu — status Q3',
  startAt: hoursAgo(30),
  endAt: hoursAgo(29),
  location: 'Zoom',
  attendees: ['Zarząd NordFood', 'Piotr Wiśniewski (DBR77 — doradca)'],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  status: 'scheduled',
};

const MEETING_4 = {
  id: 'meeting-4',
  projectId: 'proj-nordfood-logistics',
  title: 'Kickoff — segment Logistics',
  startAt: hoursFromNow(120),
  endAt: hoursFromNow(121),
  location: 'NordFood — biuro Logistyki',
  attendees: ['Zespół Logistics'],
  preRead: [],
  agenda: ['Zakres diagnozy', 'Harmonogram'],
  decisions: [],
  followUps: [],
  status: 'scheduled',
};

const MEETINGS = [MEETING_1, MEETING_2, MEETING_3, MEETING_4];

// Governed AI notes for meeting-1 (Api.listMeetingNotes) — mixes both DTO
// shapes for decisions/actionItems (string vs {decision}/{task,owner}) and
// includes one note with empty decisions to exercise the honest "—".
const MEETING_1_NOTES = [
  {
    id: 'note-1',
    source: 'ai' as const,
    summary:
      'Zespół potwierdził gotowość do pilotażu na stanowisku 2; główne ryzyko: brak zapasowych matryc formujących.',
    keyPoints: ['Czas przezbrojenia spadł z 42 do 27 minut', 'Operatorzy przeszkoleni na 2 z 3 zmian'],
    decisions: ['Pilotaż startuje 2026-09-01', { decision: 'Backup matryc zamawiamy do końca tygodnia' }],
    actionItems: [
      { task: 'Zamówić zapasowe matryce', owner: 'Katarzyna Nowak' },
      'Zaktualizować checklistę SMED',
    ],
    status: 'approved' as const,
    proposalId: 'proposal-1',
    createdAt: hoursAgo(20),
  },
  {
    id: 'note-2',
    source: 'heuristic' as const,
    summary: 'Wstępna notatka z warsztatu — do zatwierdzenia.',
    keyPoints: [],
    decisions: [],
    actionItems: [{ task: 'Przygotować raport czasu przezbrojenia', owner: 'Marek Zieliński' }],
    status: 'proposed' as const,
    proposalId: 'proposal-2',
    createdAt: hoursAgo(3),
  },
];

Api.getMeetings = async () => ({ meetings: MEETINGS }) as any;
Api.getMeeting = async (meetingId: string) => {
  const meeting = MEETINGS.find((m) => m.id === meetingId);
  if (!meeting) {
    const err: any = new Error('Meeting not found');
    err.status = 404;
    throw err;
  }
  return { meeting } as any;
};
Api.listMeetingNotes = async (meetingId: string) =>
  ({ notes: meetingId === MEETING_1.id ? MEETING_1_NOTES : [] }) as any;
// Not part of this screenshot pass but harmless to stub so a stray click in
// the list preview pane doesn't hit the (absent) dev-render backend.
Api.getAIOperatorMeetingBrief = async () => ({
  prepSummary: 'Zespół gotowy do pilotażu; jedyne otwarte ryzyko to zapasowe matryce.',
  agendaGaps: [],
  followUpSuggestions: [],
});

const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'object' ? 'object' : 'list';
const tab = params.get('tab') === 'minutes' || params.get('tab') === 'decisions' ? params.get('tab') : 'details';

const path =
  view === 'object'
    ? tab === 'details'
      ? `/meetings/${MEETING_1.id}`
      : `/meetings/${MEETING_1.id}/${tab}`
    : '/meetings';
window.history.replaceState({}, '', path);

export function MeetingsModuleScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <Routes>
            <Route path="/meetings" element={<MeetingHub />} />
            <Route path="/meetings/:meetingId" element={<MeetingObjectPage />} />
            <Route path="/meetings/:meetingId/minutes" element={<MeetingObjectPage />} />
            <Route path="/meetings/:meetingId/decisions" element={<MeetingObjectPage />} />
            <Route path="/meetings/:meetingId/notes/:noteId" element={<MeetingObjectPage />} />
          </Routes>
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default MeetingsModuleScreen;
