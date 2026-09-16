/**
 * MEETING-1 [U-51] evidence harness — REAL `MeetingObjectPage` in its REAL
 * shell (`StandardArtifactShell` → `NModeShell`); only the API boundary is
 * fixtured. CLAUDE.md §7: the supervisor screenshots this BEFORE the owner
 * looks at anything.
 *
 * Fixture mirrors the staging object the owner reviewed ("Weekly PMO Review",
 * org Northwind, EN): 4 participants with real names/roles/RSVP, an APPROVED
 * minutes proposal carrying 1 decision + 2 actions, and EMPTY
 * `meeting_decisions` / `meeting_follow_ups` registries — i.e. exactly the
 * "Decisions 0 / Follow-ups 0" split the owner reported, so the new
 * "N in minutes, not yet recorded" counter is visible on the screenshot.
 *
 * URL: ?screen=meeting-1-u51&section=details|minutes|decisions
 *      &lang=en|pl&theme=light|dark
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { MeetingObjectPage } from '../../src/components/Meeting/MeetingObjectPage';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const sectionParam = params.get('section') ?? 'details';
const section = ['details', 'minutes', 'decisions'].includes(sectionParam)
  ? sectionParam
  : 'details';

const meetingId = 'u51-weekly-pmo-review';

const meeting = {
  id: meetingId,
  projectId: 'northwind-transformation-2026',
  title: 'Weekly PMO Review',
  startAt: '2026-09-15T09:00:00.000Z',
  endAt: '2026-09-15T10:00:00.000Z',
  location: 'Microsoft Teams',
  // Legacy `attendees_json` — kept in the fixture ON PURPOSE: the card must
  // prefer `meeting_participants` over it, never the other way round.
  attendees: [
    'james.whitfield@northwind.example',
    'sofia.almeida@northwind.example',
    'martin.grabowski@northwind.example',
    'claire.dubois@northwind.example',
  ],
  preRead: ['Programme status pack — week 37'],
  agenda: ['Milestone status', 'Open blockers', 'Decision: pilot go/no-go'],
  decisions: [],
  followUps: [],
  status: 'completed',
  createdBy: 'user-james',
};

const participants = [
  {
    id: 'p-1',
    organizationId: 'org-northwind',
    meetingId,
    participantKind: 'user',
    userId: 'user-james',
    email: 'james.whitfield@northwind.example',
    displayName: 'James Whitfield',
    role: 'organizer',
    invitationStatus: 'accepted',
    deliveryStatus: 'sent',
    respondedAt: '2026-09-14T08:00:00.000Z',
  },
  {
    id: 'p-2',
    organizationId: 'org-northwind',
    meetingId,
    participantKind: 'user',
    userId: 'user-sofia',
    email: 'sofia.almeida@northwind.example',
    displayName: 'Sofia Almeida',
    role: 'attendee',
    invitationStatus: 'accepted',
    deliveryStatus: 'sent',
    respondedAt: '2026-09-14T09:10:00.000Z',
  },
  {
    id: 'p-3',
    organizationId: 'org-northwind',
    meetingId,
    participantKind: 'user',
    userId: 'user-martin',
    email: 'martin.grabowski@northwind.example',
    displayName: 'Martin Grabowski',
    role: 'attendee',
    invitationStatus: 'tentative',
    deliveryStatus: 'sent',
    respondedAt: null,
  },
  {
    id: 'p-4',
    organizationId: 'org-northwind',
    meetingId,
    participantKind: 'guest',
    userId: null,
    email: 'claire.dubois@northwind.example',
    // Guest with no display name — proves the e-mail fallback for the LABEL.
    displayName: '',
    role: 'optional',
    invitationStatus: 'no_response',
    deliveryStatus: 'pending',
    respondedAt: null,
  },
];

const notes = [
  {
    id: 'u51-note-1',
    source: 'heuristic' as const,
    summary:
      'Delivery is on plan for two of three workstreams; the integration workstream slipped by one week. The committee agreed to start the pilot once second-shift staffing is confirmed.',
    keyPoints: ['Integration workstream one week late', 'Second-shift staffing unconfirmed'],
    decisions: [{ decision: 'Start the pilot once second-shift staffing is confirmed' }],
    actionItems: [
      { task: 'Confirm second-shift staffing', owner: 'Sofia Almeida' },
      { task: 'Re-baseline the integration plan', owner: 'Martin Grabowski' },
    ],
    status: 'approved' as const,
    proposalId: null,
    decidedBy: 'user-james',
    decidedAt: '2026-09-15T10:20:00.000Z',
    materializedAt: null,
    createdAt: '2026-09-15T10:05:00.000Z',
  },
];

Api.getMeeting = async () => ({ meeting }) as any;
Api.listMeetingParticipants = async () => ({ participants }) as any;
Api.listMeetingNotes = async () => ({ notes }) as any;
Api.getUsers = async () =>
  [
    {
      id: 'user-james',
      firstName: 'James',
      lastName: 'Whitfield',
      email: 'james.whitfield@northwind.example',
    },
  ] as any;
// Empty registries ON PURPOSE — this is the measured staging state (U-51).
Api.listMeetingDecisionRecords = async () => ({ decisions: [] }) as any;
Api.listMeetingFollowUpRecords = async () => ({ followUps: [] }) as any;
Api.getAIOperatorMeetingBrief = async () =>
  ({
    prepSummary: 'Confirm second-shift staffing before the pilot decision.',
    agendaGaps: [],
    followUpSuggestions: [],
  }) as any;

window.history.replaceState(
  {},
  '',
  section === 'details' ? `/meetings/${meetingId}` : `/meetings/${meetingId}/${section}`
);

export function Meeting1U51Screen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div className="h-screen w-screen overflow-hidden bg-c-bg">
          <Routes>
            <Route path="/meetings/:meetingId" element={<MeetingObjectPage />} />
            <Route path="/meetings/:meetingId/minutes" element={<MeetingObjectPage />} />
            <Route path="/meetings/:meetingId/decisions" element={<MeetingObjectPage />} />
          </Routes>
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default Meeting1U51Screen;
