/**
 * MTG-1 rework etap 2 / DEC-596 (Wpis 54) — evidence harness for the REAL
 * `<MeetingHub>` (list, Menu 1/2/3 with the five lifecycle counters) and the
 * REAL `<MeetingObjectPage>` (SPEC-A card: agenda axis + lifecycle + chair/
 * scribe + relations + the sanctioned state-transition control). No component
 * is re-implemented; only the API boundary and `window.fetch` are fixtured,
 * with five Northwind meetings, one per lifecycle state, so the Menu 3
 * counters and the card's transition row are all visible. CLAUDE.md §7: the
 * supervisor screenshots this BEFORE the owner looks at anything.
 *
 * The `/lifecycle` stub MUTATES the in-memory meeting state and the card
 * reloads from `Api.getMeeting`, so a before/after transition capture is real
 * (not a second hard-coded fixture) — the same contract as the backend
 * `PATCH /api/meeting/:id/lifecycle` (SSOT stays the meeting record).
 *
 * URL: ?screen=mtg1-etap2&view=list|card[&meeting=<id>][&lang=en][&theme=light|dark]
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

const day = (offset: number, hour = 9): string => {
  const d = new Date('2026-09-15T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const plusMinutes = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

// The card meeting (also a list row): rich structural agenda, chair + scribe,
// participants with roles/RSVP, one initiative link and one decision link.
const PMO_START = day(0, 9);
const CARD_MEETING_ID = 'mtg-pmo-review';

interface FixtureMeeting {
  id: string;
  projectId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  attendees: string[];
  preRead: string[];
  agenda: string[];
  decisions: string[];
  followUps: Array<{ id: string; title: string; owner: string; status: string }>;
  status: string;
  lifecycleState: string;
  createdBy: string;
  chairUserId: string | null;
  scribeUserId: string | null;
}

const MEETINGS: FixtureMeeting[] = [
  {
    id: CARD_MEETING_ID,
    projectId: 'northwind-transformation-2026',
    title: 'Weekly PMO Review',
    startAt: PMO_START,
    endAt: plusMinutes(PMO_START, 60),
    location: 'Microsoft Teams',
    attendees: ['Cara Whitfield', 'Sam Almeida', 'Ola Grabowska', 'Claire Dubois'],
    preRead: ['Status deck — week 33.pdf'],
    agenda: [
      'Programme status round-up',
      'Packing line 2 pilot readiness',
      'Tooling budget release',
      'Open actions review',
    ],
    decisions: ['Release the spare-tooling budget (PLN 18,400)'],
    followUps: [],
    status: 'scheduled',
    lifecycleState: 'minutes_to_approve',
    createdBy: 'user-chair',
    chairUserId: 'user-chair',
    scribeUserId: 'user-scribe',
  },
  {
    id: 'mtg-steering',
    projectId: 'northwind-transformation-2026',
    title: 'Steering Committee',
    startAt: day(3, 14),
    endAt: plusMinutes(day(3, 14), 90),
    location: 'Warsaw — boardroom 2',
    attendees: ['Cara Whitfield', 'James Whitfield', 'Sam Almeida'],
    preRead: [],
    agenda: [],
    decisions: [],
    followUps: [],
    status: 'scheduled',
    lifecycleState: 'scheduled',
    createdBy: 'user-chair',
    chairUserId: 'user-chair',
    scribeUserId: null,
  },
  {
    id: 'mtg-portfolio',
    projectId: 'northwind-logistics',
    title: 'Portfolio Review',
    startAt: day(-1, 11),
    endAt: plusMinutes(day(-1, 11), 60),
    location: 'Microsoft Teams',
    attendees: ['Ola Grabowska', 'Martin Nowak', 'Claire Dubois'],
    preRead: [],
    agenda: [],
    decisions: [],
    followUps: [],
    status: 'scheduled',
    lifecycleState: 'in_progress',
    createdBy: 'user-lead',
    chairUserId: 'user-lead',
    scribeUserId: null,
  },
  {
    id: 'mtg-risk',
    projectId: 'northwind-transformation-2026',
    title: 'Risk & Escalation Sync',
    startAt: day(-3, 8),
    endAt: plusMinutes(day(-3, 8), 45),
    location: 'Zoom',
    attendees: ['Cara Whitfield', 'Ola Grabowska'],
    preRead: [],
    agenda: [],
    decisions: [],
    followUps: [],
    status: 'scheduled',
    lifecycleState: 'needs_actions',
    createdBy: 'user-chair',
    chairUserId: 'user-chair',
    scribeUserId: 'user-scribe',
  },
  {
    id: 'mtg-q2',
    projectId: null,
    title: 'Q2 Business Review',
    startAt: day(-20, 10),
    endAt: plusMinutes(day(-20, 10), 120),
    location: 'Warsaw — boardroom 1',
    attendees: ['James Whitfield', 'Cara Whitfield', 'Sam Almeida', 'Ola Grabowska', 'Claire Dubois'],
    preRead: [],
    agenda: [],
    decisions: [],
    followUps: [],
    status: 'completed',
    lifecycleState: 'closed',
    createdBy: 'user-organizer',
    chairUserId: 'user-organizer',
    scribeUserId: 'user-scribe',
  },
];

const MOCK_USERS = [
  { id: 'user-chair', firstName: 'Cara', lastName: 'Whitfield', email: 'cara.whitfield@northwind.example' },
  { id: 'user-scribe', firstName: 'Sam', lastName: 'Almeida', email: 'sam.almeida@northwind.example' },
  { id: 'user-lead', firstName: 'Ola', lastName: 'Grabowska', email: 'ola.grabowska@northwind.example' },
  { id: 'user-organizer', firstName: 'James', lastName: 'Whitfield', email: 'james.whitfield@northwind.example' },
];

const PARTICIPANTS = [
  {
    id: 'p-1', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID,
    participantKind: 'user' as const, userId: 'user-chair', email: 'cara.whitfield@northwind.example',
    displayName: 'Cara Whitfield', role: 'organizer' as const, invitationStatus: 'accepted' as const,
    deliveryStatus: 'sent' as const, respondedAt: day(-1, 7),
  },
  {
    id: 'p-2', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID,
    participantKind: 'user' as const, userId: 'user-scribe', email: 'sam.almeida@northwind.example',
    displayName: 'Sam Almeida', role: 'attendee' as const, invitationStatus: 'accepted' as const,
    deliveryStatus: 'sent' as const, respondedAt: day(-1, 8),
  },
  {
    id: 'p-3', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID,
    participantKind: 'user' as const, userId: 'user-lead', email: 'ola.grabowska@northwind.example',
    displayName: 'Ola Grabowska', role: 'attendee' as const, invitationStatus: 'tentative' as const,
    deliveryStatus: 'sent' as const, respondedAt: day(-1, 9),
  },
  {
    id: 'p-4', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID,
    participantKind: 'guest' as const, userId: null, email: 'claire.dubois@partner.example',
    displayName: 'Claire Dubois', role: 'optional' as const, invitationStatus: 'invited' as const,
    deliveryStatus: 'sent' as const, respondedAt: null,
  },
];

// Structural agenda for the card meeting — the axis of the card (DEC-596).
const AGENDA_ITEMS = [
  {
    id: 'ag-1', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID, position: 1,
    title: 'Programme status round-up', durationMinutes: 10, purpose: 'information',
    leadUserId: 'user-chair', preRead: ['Status deck — week 33.pdf'], initiativeId: null,
    decisionId: null, notes: '', createdAt: day(-2, 9), updatedAt: day(-2, 9),
  },
  {
    id: 'ag-2', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID, position: 2,
    title: 'Packing line 2 pilot readiness', durationMinutes: 20, purpose: 'discussion',
    leadUserId: 'user-lead', preRead: ['Changeover-time report W33.pdf'], initiativeId: 'init-smed',
    decisionId: null, notes: '', createdAt: day(-2, 9), updatedAt: day(-2, 9),
  },
  {
    id: 'ag-3', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID, position: 3,
    title: 'Tooling budget release', durationMinutes: 15, purpose: 'decision',
    leadUserId: 'user-chair', preRead: [], initiativeId: null, decisionId: 'dec-tooling',
    notes: '', createdAt: day(-2, 9), updatedAt: day(-2, 9),
  },
  {
    id: 'ag-4', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID, position: 4,
    title: 'Open actions review', durationMinutes: 10, purpose: 'information',
    leadUserId: 'user-scribe', preRead: [], initiativeId: null, decisionId: null,
    notes: '', createdAt: day(-2, 9), updatedAt: day(-2, 9),
  },
];

const INITIATIVES = [{ id: 'init-smed', title: 'Cut changeover time (SMED)' }];

const DECISION_RECORDS = [
  {
    id: 'dec-tooling', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID,
    statement: 'Release the spare-tooling budget (PLN 18,400)',
    rationale: 'Needed to hold the 2026-09-01 pilot date.', decidedBy: 'user-chair',
    decidedAt: day(-1, 10), status: 'recorded' as const, sourceKind: 'manual' as const,
    sourceNoteId: null, sourceIndex: null, createdBy: 'user-chair',
    createdAt: day(-1, 10), updatedAt: day(-1, 10),
  },
];

const FOLLOW_UP_RECORDS = [
  {
    id: 'fu-tooling', organizationId: 'org-northwind', meetingId: CARD_MEETING_ID,
    title: 'Order spare forming dies', owner: 'Ola Grabowska', ownerUserId: 'user-lead',
    dueAt: day(2, 12), status: 'open' as const, sourceKind: 'manual' as const,
    sourceNoteId: null, sourceIndex: null,
  },
];

// Mirror of the server transition table so the stub only accepts sanctioned
// moves (the real backend is the SSOT; this keeps the demo honest).
const TRANSITIONS: Record<string, string[]> = {
  scheduled: ['in_progress'],
  in_progress: ['minutes_to_approve'],
  minutes_to_approve: ['needs_actions', 'closed'],
  needs_actions: ['closed'],
  closed: [],
};

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
Api.listMeetingNotes = async () => ({ notes: [] }) as any;
Api.listMeetingParticipants = async (meetingId: string) =>
  ({ participants: meetingId === CARD_MEETING_ID ? PARTICIPANTS : [] }) as any;
Api.getUsers = async () => MOCK_USERS as any;
Api.getInitiatives = async () => INITIATIVES as any;
Api.listMeetingDecisionRecords = async (meetingId: string) =>
  ({ decisions: meetingId === CARD_MEETING_ID ? DECISION_RECORDS : [] }) as any;
Api.listMeetingFollowUpRecords = async (meetingId: string) =>
  ({ followUps: meetingId === CARD_MEETING_ID ? FOLLOW_UP_RECORDS : [] }) as any;
Api.getAIOperatorMeetingBrief = async () => ({
  prepSummary: 'Pilot ready; the only open risk is spare forming dies.',
  agendaGaps: [],
  followUpSuggestions: [],
}) as any;

// `window.fetch` boundary — the card reads the structural agenda and writes the
// lifecycle transition through raw fetch (meetingAgendaClient.ts), not `Api`.
const realFetch = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined;
(globalThis as any).fetch = async (input: any, init?: RequestInit) => {
  const url = String(typeof input === 'string' ? input : input?.url || '');
  const method = String(init?.method || 'GET').toUpperCase();

  if (url.includes('/agenda') && method === 'GET') {
    const id = url.split('/api/meeting/')[1]?.split('/')[0];
    return new Response(
      JSON.stringify({ agendaItems: id === CARD_MEETING_ID ? AGENDA_ITEMS : [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.includes('/lifecycle') && method === 'PATCH') {
    const id = url.split('/api/meeting/')[1]?.split('/')[0];
    const meeting = MEETINGS.find((m) => m.id === id);
    let nextState = '';
    try {
      nextState = JSON.parse(String(init?.body || '{}')).nextState || '';
    } catch {
      nextState = '';
    }
    const from = meeting?.lifecycleState || 'scheduled';
    if (!meeting || !(TRANSITIONS[from] || []).includes(nextState)) {
      return new Response(
        JSON.stringify({ code: 'MEETING_LIFECYCLE_TRANSITION_NOT_ALLOWED', from, to: nextState }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    meeting.lifecycleState = nextState; // real reload source for the after-shot
    return new Response(JSON.stringify({ lifecycleState: nextState }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/action-items/') && method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Backend-less harness: answer every OTHER `/api/*` call with a benign 200 so
  // the provider tree (OrgContext, FeatureFlagsContext) never logs a 404 — the
  // evidence gate requires `bledyKonsoli=0`. Non-API URLs (/locales, assets)
  // fall through to the real vite-served fetch.
  if (url.includes('/api/')) {
    if (url.includes('/organizations/current')) {
      return new Response(JSON.stringify({ organizations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/admin/flags')) {
      return new Response(JSON.stringify({ flags: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return realFetch
    ? realFetch(input as any, init)
    : (new Response(JSON.stringify({}), { status: 200 }) as any);
};

const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'card' ? 'card' : 'list';
const meetingId = params.get('meeting') || CARD_MEETING_ID;

const path = view === 'card' ? `/meetings/${meetingId}` : '/meetings';
window.history.replaceState({}, '', path);

export function Mtg1Etap2Screen(): React.ReactElement {
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

export default Mtg1Etap2Screen;
