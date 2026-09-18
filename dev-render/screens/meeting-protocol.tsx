/**
 * MTG-2a (DEC-607) — harness host for the REAL `MeetingProtocolViewer`, the
 * meeting protocol as an archetype-B Document, mounted inside the REAL app shell
 * (`AppProviders` + `MainLayout`) exactly as `MeetingProtocolPage` renders it on
 * `/meetings/:meetingId/protocol`. Only transport is stubbed (the harness has no
 * backend — `apiNoBackendPlugin` answers every `/api/*` with an honest 404), so
 * `window.fetch` returns the captured protocol preview envelope byte-for-byte for
 * the one URL the client reads (`GET /api/meeting/:id/protocol`).
 *
 * Theme via the app store + `.dark` class (NOT `emulateMedia`) — station rule.
 *
 * Two honest lifecycle states (W109b):
 *   case=draft     → nothing frozen yet: `publishedVersion=null`, the Approve
 *                    primary is wired, no errata panel.
 *   case=approved  → v1.0 published: `publishedVersion='1.0'`, the working view
 *                    is STILL a live draft (status 'draft', version '1.1'), the
 *                    Approve primary is gone and the errata panel is exposed.
 *
 * URL: /meeting-protocol.html?lang=en&theme=light|dark&case=draft|approved
 */
import React from 'react';

import { MeetingProtocolViewer } from '../../src/components/Meeting/MeetingProtocolViewer';
import { doneKey } from '../../src/components/Onboarding/useFirstRunOnboarding';
import { STORY_RAIL_DISMISSED_KEY } from '../../src/components/demo/storyRailStops';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { MainLayout } from '../../src/layouts/MainLayout';
import { AppProviders } from '../../src/providers/AppProviders';

import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
localStorage.setItem(doneKey('user-piotr-demo'), 'true');
localStorage.setItem(STORY_RAIL_DISMISSED_KEY, 'true');

const MEETING_ID = 'meeting-qbr-3';
const PROTOCOL_URL = `/api/meeting/${MEETING_ID}/protocol`;

const params = new URLSearchParams(window.location.search);
const approved = params.get('case') === 'approved';

const BLOCKS = [
  {
    kind: 'meta',
    title: 'Quarterly Business Review — Northwind Transformation',
    startAt: '2026-07-01T14:00:00.000Z',
    endAt: '2026-07-01T15:30:00.000Z',
    timezone: 'Europe/Warsaw',
    location: 'Warsaw HQ · Room Kopernik + Teams',
    meetingType: 'Steering committee',
    lifecycleState: 'held',
  },
  {
    kind: 'roles',
    chair: 'Constance Chair',
    scribe: 'Sam Scribe',
    approver: approved ? 'Constance Chair' : null,
  },
  {
    kind: 'attendance',
    accepted: ['Constance Chair', 'Sam Scribe', 'Daniel Osei', 'Maria Kowalska'],
    declined: ['Tom Async'],
    pending: ['Anna Pending'],
  },
  {
    kind: 'agenda',
    items: [
      {
        position: 1,
        title: 'Programme health and RAID summary',
        durationMinutes: 20,
        purpose: 'Confirm the transformation is on track for the Q3 gate',
        lead: 'Daniel Osei',
        notes: 'RAG amber on the data-migration workstream; recovery plan attached.',
      },
      {
        position: 2,
        title: 'Decision: scope of the phase-2 rollout',
        durationMinutes: 30,
        purpose: 'Approve or defer the phase-2 scope change',
        lead: 'Constance Chair',
        notes: '',
      },
      {
        position: 3,
        title: 'Actions and owners',
        durationMinutes: 15,
        purpose: 'Assign follow-ups with due dates',
        lead: 'Sam Scribe',
        notes: '',
      },
    ],
  },
  {
    kind: 'proceedings',
    points: [
      {
        position: 1,
        title: 'Programme health and RAID summary',
        notes:
          'Daniel reported the data-migration workstream is two weeks behind after the vendor freeze; the recovery plan re-baselines the Q3 gate without moving go-live.',
        decisionCount: 0,
        actionCount: 1,
      },
      {
        position: 2,
        title: 'Decision: scope of the phase-2 rollout',
        notes:
          'The committee weighed a big-bang phase-2 against a staged rollout by region and agreed the staged option carries materially lower delivery risk.',
        decisionCount: 1,
        actionCount: 1,
      },
      {
        position: 3,
        title: 'Actions and owners',
        notes: 'Owners confirmed for both follow-ups; next review at the July gate.',
        decisionCount: 0,
        actionCount: 1,
      },
    ],
  },
  {
    kind: 'decisions',
    items: [
      {
        statement: 'Adopt a staged phase-2 rollout by region instead of a single big-bang release.',
        rationale:
          'A staged rollout lets the programme validate the migration recovery plan on the first region before committing the rest, reducing the blast radius of the amber workstream.',
        owner: 'Daniel Osei',
        decisionType: 'Delivery approach',
        impact: 'Phase-2 timeline extends by three weeks; go-live date unchanged.',
        rejectedAlternative: 'Big-bang phase-2 release at the end of Q3.',
        decidedBy: 'Constance Chair',
        decidedAt: '2026-07-01T14:55:00.000Z',
        status: 'recorded',
      },
    ],
  },
  {
    kind: 'actions',
    items: [
      {
        title: 'Re-baseline the data-migration plan and circulate the recovery schedule',
        owner: 'Daniel Osei',
        dueAt: '2026-07-08T17:00:00.000Z',
        status: 'open',
        taskId: 'task-9001',
        taskStatus: 'in_progress',
        agendaItemTitle: 'Programme health and RAID summary',
      },
      {
        title: 'Draft the region-by-region phase-2 rollout sequence for the July gate',
        owner: 'Maria Kowalska',
        dueAt: '2026-07-15T17:00:00.000Z',
        status: 'open',
        taskId: null,
        taskStatus: null,
        agendaItemTitle: 'Decision: scope of the phase-2 rollout',
      },
    ],
  },
  {
    kind: 'footer',
    nextOccurrence: 'Monthly programme gate — 2026-07-29',
    versions: approved
      ? [
          {
            version: '1.0',
            status: 'approved',
            approvedAt: '2026-07-02T09:10:00.000Z',
            approvedBy: 'Constance Chair',
            errata: '',
          },
          { version: '1.1', status: 'draft', approvedAt: null, approvedBy: null, errata: '' },
        ]
      : [{ version: '1.0', status: 'draft', approvedAt: null, approvedBy: null, errata: '' }],
  },
];

const PREVIEW = {
  id: null,
  version: approved ? '1.1' : '1.0',
  // W109b: the working view is ALWAYS a live draft, even once v1.0 is frozen.
  status: 'draft',
  content: { meetingId: MEETING_ID, generatedAt: '2026-07-02T08:00:00.000Z', blocks: BLOCKS },
  publishedVersion: approved ? '1.0' : null,
  approvedByName: approved ? 'Constance Chair' : null,
  approvedAt: approved ? '2026-07-02T09:10:00.000Z' : null,
  errataNote: '',
  persisted: false,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(PROTOCOL_URL)) return jsonResponse({ protocol: PREVIEW }, 200);
  // Benign catch-all: OrgContext / admin-flags reach for raw fetch and would
  // otherwise auto-log a 404 (bledyKonsoli≠0). Answer an empty 200 envelope.
  if (url.includes('/api/')) {
    return jsonResponse({ data: [], items: [], organizations: [] }, 200);
  }
  return realFetch(input as RequestInfo | URL, init);
}) as typeof window.fetch;

export default function MeetingProtocolScreen() {
  return (
    <FeatureFlagsProvider showDevTools={false}>
      <AppProviders>
        <div className="h-screen min-h-0 bg-c-canvas text-c-text">
          <MainLayout breadcrumbs={['Meetings', 'Quarterly Business Review']} noPadding>
            <div className="h-full min-w-0" data-testid="meeting-protocol-page">
              <MeetingProtocolViewer
                meetingId={MEETING_ID}
                meetingTitle="Quarterly Business Review — Northwind Transformation"
                onClose={() => undefined}
              />
            </div>
          </MainLayout>
        </div>
      </AppProviders>
    </FeatureFlagsProvider>
  );
}
