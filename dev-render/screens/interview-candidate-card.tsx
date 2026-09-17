/**
 * dev-render host — ST-2 (DEC-540 / U-09), etap 1: Interview candidate card.
 *
 * Mounts the REAL production <InterviewCandidateInbox /> (the exact component
 * wired into the InterviewHub "Initiatives" tab behind VITE_ST2_CANDIDATE_CARD)
 * inside a representative Interview shell frame. Nothing about the card/inbox is
 * re-implemented here.
 *
 * The inbox fetches GET /api/initiatives/candidates?status=pending and shows a
 * candidate ONLY to its author (+ADMIN). The mock below returns three interview
 * candidates: two authored by the signed-in user (rendered) and one authored by
 * someone else (filtered out — the author-only visibility rule made visible).
 * The approve action stubs POST .../:id/accept with the persisted receipt shape.
 *
 * URL: ?screen=interview-candidate-card  &lang=en|pl  &theme=light|dark
 */
import React from 'react';

import { InterviewCandidateInbox } from '../../src/components/Interview/InterviewCandidateInbox';
import { useAppStore } from '../../src/store/useAppStore';

const CURRENT_USER_ID = 'user-author-1';

useAppStore.setState({
  currentUser: {
    id: CURRENT_USER_ID,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr@dbr77.com',
    role: 'MEMBER',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    organizationId: 'org-northwind',
  } as any,
  currentOrganization: {
    id: 'org-northwind',
    name: 'Northwind',
  } as any,
});

const NOW = Date.now();
const hoursAgo = (n: number) => new Date(NOW - n * 3600000).toISOString();

const CANDIDATES = [
  {
    id: 'cand-changeover-1',
    title: 'Packing line changeover standard work',
    rationale:
      'Interview with the packing lead surfaced a recurring 40-minute changeover with no documented standard; captured as an initiative candidate.',
    sourceType: 'interview_insight_finding',
    sourceId: 'finding-88',
    status: 'pending',
    createdBy: CURRENT_USER_ID,
    createdAt: hoursAgo(5),
  },
  {
    id: 'cand-scrap-2',
    title: 'Reduce scrap on the welding cell',
    rationale:
      'Two interviewees independently flagged welding-cell scrap as the top weekly loss driver.',
    sourceType: 'interview_submission',
    sourceId: 'sub-14',
    status: 'pending',
    createdBy: CURRENT_USER_ID,
    createdAt: hoursAgo(9),
  },
  {
    // Authored by someone else — must NOT render for the signed-in member.
    id: 'cand-other-3',
    title: 'Another users candidate (must stay hidden)',
    rationale: 'This candidate belongs to a different author and is filtered out.',
    sourceType: 'interview_insight',
    sourceId: 'ins-3',
    status: 'pending',
    createdBy: 'user-someone-else',
    createdAt: hoursAgo(11),
  },
];

// Stub the network the inbox uses: candidate list + the accept endpoint.
(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = String(input);
  const method = String(init?.method ?? 'GET').toUpperCase();
  if (method === 'POST' && url.includes('/accept')) {
    return new Response(
      JSON.stringify({
        accepted: true,
        receiptPersisted: true,
        initiativeId: 'init-new-1',
        filled: true,
        payload: {},
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (url.includes('/initiatives/candidates')) {
    return new Response(JSON.stringify({ candidates: CANDIDATES, total: CANDIDATES.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const InterviewCandidateCardScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-c-background">
      {/* Representative Interview shell frame (module bar + tab strip). */}
      <header className="border-b border-c-border bg-c-surface px-4 py-3">
        <div className="text-[15px] font-semibold text-c-text">Interview</div>
        <div className="text-[12px] text-c-text-muted">
          Interview › Initiatives · approved interview sessions
        </div>
        <nav className="mt-2 flex items-center gap-4 text-[13px]">
          <span className="text-c-text-muted">Sessions</span>
          <span className="border-b-2 border-c-accent pb-1 font-medium text-c-text">
            Initiatives
          </span>
          <span className="text-c-text-muted">Insights</span>
        </nav>
      </header>

      {/* The real in-module candidate inbox, exactly as mounted in the tab. */}
      <InterviewCandidateInbox onApproved={() => undefined} />

      <div className="px-4 text-[12px] text-c-text-muted">
        The Initiatives list below the inbox is unchanged; approving a candidate materializes it as
        a draft initiative via the existing accept endpoint (no jump to the Initiatives module).
      </div>
    </div>
  );
};

export default InterviewCandidateCardScreen;
