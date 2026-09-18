/**
 * MTG-2b (DEC-607) — evidence harness for the REAL `MeetingObjectPage`
 * "Decyzje i działania" section, showing the two NEW organizer controls:
 *   · "Convert to task" on a follow-up record with NO linked task (`fu-open`) —
 *     the action→task funnel entry that writes `task_id` back so the protocol
 *     shows the task's return status;
 *   · the SAME control correctly ABSENT on a follow-up already linked to a task
 *     (`fu-linked`, `taskId` set) — the one-task-per-action gate, visible;
 *   · "Promote to register" on a decision record (P2) — lifts it into the
 *     unified `decisions` register.
 * Only the API boundary is fixtured; the component, shell and c-* tokens are
 * real. Theme via the app store + `.dark` class (NOT `emulateMedia`) — station
 * rule. Structure mirrors `meeting-1-u51.tsx` (same real page, real shell).
 *
 * URL: /meeting-mtg2b.html?lang=en&theme=light|dark
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { MeetingObjectPage } from '../../src/components/Meeting/MeetingObjectPage';
import { doneKey } from '../../src/components/Onboarding/useFirstRunOnboarding';
import { STORY_RAIL_DISMISSED_KEY } from '../../src/components/demo/storyRailStops';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';

import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
localStorage.setItem(doneKey('user-piotr-demo'), 'true');
localStorage.setItem(STORY_RAIL_DISMISSED_KEY, 'true');

const meetingId = 'mtg2b-qbr-3';

const meeting = {
  id: meetingId,
  projectId: 'northwind-transformation-2026',
  title: 'Quarterly Business Review — Northwind Transformation',
  startAt: '2026-07-01T14:00:00.000Z',
  endAt: '2026-07-01T15:30:00.000Z',
  location: 'Warsaw HQ · Room Kopernik + Teams',
  attendees: [],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  status: 'completed',
  lifecycleState: 'held',
  createdBy: 'user-constance',
};

// One recorded decision → the "Promote to register" (P2) control is visible.
const decisionRecords = [
  {
    id: 'decision-1',
    organizationId: 'org-northwind',
    meetingId,
    statement: 'Adopt a staged phase-2 rollout by region instead of a single big-bang release.',
    rationale:
      'A staged rollout validates the migration recovery plan on the first region before committing the rest, reducing the blast radius of the amber workstream.',
    decidedBy: 'Constance Chair',
    decidedAt: '2026-07-01T14:55:00.000Z',
    status: 'recorded',
    sourceKind: 'manual',
    sourceNoteId: null,
    sourceIndex: null,
    createdBy: 'user-constance',
    createdAt: '2026-07-01T15:00:00.000Z',
    updatedAt: '2026-07-01T15:00:00.000Z',
  },
];

// fu-open: no task yet → "Convert to task" shows. fu-linked: already a task →
// the convert control is correctly gone (one task per action).
const followUpRecords = [
  {
    id: 'fu-open',
    organizationId: 'org-northwind',
    meetingId,
    title: 'Draft the region-by-region phase-2 rollout sequence for the July gate',
    owner: 'Maria Kowalska',
    ownerUserId: 'user-maria',
    dueAt: '2026-07-15T17:00:00.000Z',
    status: 'open',
    sourceKind: 'manual',
    sourceNoteId: null,
    sourceIndex: null,
    taskId: null,
    agendaItemId: 'agenda-2',
  },
  {
    id: 'fu-linked',
    organizationId: 'org-northwind',
    meetingId,
    title: 'Re-baseline the data-migration plan and circulate the recovery schedule',
    owner: 'Daniel Osei',
    ownerUserId: 'user-daniel',
    dueAt: '2026-07-08T17:00:00.000Z',
    status: 'open',
    sourceKind: 'manual',
    sourceNoteId: null,
    sourceIndex: null,
    taskId: 'task-9001',
    agendaItemId: 'agenda-1',
  },
];

Api.getMeeting = async () => ({ meeting }) as any;
Api.listMeetingParticipants = async () => ({ participants: [] }) as any;
Api.listMeetingNotes = async () => ({ notes: [] }) as any;
Api.getUsers = async () => [] as any;
Api.listMeetingDecisionRecords = async () => ({ decisions: decisionRecords }) as any;
Api.listMeetingFollowUpRecords = async () => ({ followUps: followUpRecords }) as any;
Api.getAIOperatorMeetingBrief = async () =>
  ({ prepSummary: '', agendaGaps: [], followUpSuggestions: [] }) as any;

// The agenda axis reads via raw fetch; answer it (and any other /api/*) with an
// honest empty envelope so the capture carries no 4xx noise.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/')) {
    return new Response(JSON.stringify({ agendaItems: [], data: [], items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return realFetch(input as RequestInfo | URL, init);
}) as typeof window.fetch;

// Keep the query string: this runs at import time, BEFORE the entry reads
// ?lang/&theme — dropping it here silently forced every capture to light.
window.history.replaceState(
  {},
  '',
  `/meetings/${meetingId}/decisions${window.location.search}`
);

export function MeetingMtg2bScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div className="h-screen w-screen overflow-hidden bg-c-bg">
          <Routes>
            <Route path="/meetings/:meetingId" element={<MeetingObjectPage />} />
            <Route path="/meetings/:meetingId/decisions" element={<MeetingObjectPage />} />
          </Routes>
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default MeetingMtg2bScreen;
