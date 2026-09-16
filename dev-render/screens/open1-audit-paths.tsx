/** OPEN-1 screenshot harness: real Audit list components with English fixtures. */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import type {
  AuditCriterionSummary,
  AuditProgramSummary,
  AuditProposalSummary,
} from '../../src/components/Audit/method/auditsMethodApi';
import { AuditInitiativesTab } from '../../src/components/Audit/method/tabs/AuditInitiativesTab';
import { AuditProcessesTab } from '../../src/components/Audit/method/tabs/AuditProcessesTab';

const PROGRAM_ID = 'open1-program-cnc';
const PACK_ID = 'open1-pack-cnc';
const PROGRAM: AuditProgramSummary = {
  id: PROGRAM_ID,
  name: 'CNC process governance audit',
  packId: PACK_ID,
  packTitle: 'CNC process governance pack',
  packVersion: 1,
  lifecycleState: 'fieldwork',
  applicableCriteria: 1,
  concludedCriteria: 0,
  openFindings: 0,
  leadAuditorId: 'user-alex',
  leadAuditorName: 'Alex Morgan',
  plannedStart: '2026-09-01T00:00:00Z',
  plannedEnd: '2026-10-15T00:00:00Z',
  updatedAt: '2026-09-16T08:00:00Z',
};

const CRITERIA = [
  {
    id: 'open1-program-criterion-cnc-1',
    programId: PROGRAM_ID,
    packCriterionId: 'open1-pack-criterion-cnc-1',
    parentId: null,
    ordinal: 1,
    refCode: 'CNC.1',
    nodeKind: 'criterion',
    title: 'Machine configuration changes are authorised',
    requirementText: 'Every CNC configuration change has an owner and approval.',
    auditQuestion: 'Show the approval for the latest CNC configuration change.',
    expectedEvidence: [],
    mandatory: true,
    applicable: true,
    conformityStatus: 'not_tested',
    workStatus: 'open',
    evidenceCount: 0,
    findingCount: 0,
    children: [],
  },
] as AuditCriterionSummary[];

let proposals: AuditProposalSummary[] = [
  {
    id: 'open1-proposal-1',
    programId: PROGRAM_ID,
    programName: PROGRAM.name,
    title: 'Introduce quarterly CNC access reviews',
    sourceFindingIds: ['finding-cnc-1'],
    priority: 'high',
    status: 'draft',
    registeredInitiativeId: null,
    updatedAt: '2026-09-16T08:00:00Z',
  },
];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method || 'GET').toUpperCase();
  if (url.includes(`/audits/programs/${PROGRAM_ID}/lifecycle`)) {
    return json({ success: true, data: { state: 'fieldwork', allowed: [{ state: 'findings_review', blockers: [] }] } });
  }
  if (url.includes(`/audits/programs/${PROGRAM_ID}/coverage`)) {
    return json({ success: true, data: { applicableTotal: 1, concludedTotal: 0, evidenceInsufficientTotal: 0 } });
  }
  if (url.includes('/audits/criteria')) {
    return json({ success: true, data: { criteria: CRITERIA } });
  }
  if (url.includes(`/audits/programs/${PROGRAM_ID}`)) {
    return json({ success: true, data: { program: PROGRAM } });
  }
  if (url.includes('/audits/proposals') && method === 'GET') {
    return json({ success: true, data: { proposals, total: proposals.length } });
  }
  if (url.includes('/audits/proposals/open1-proposal-1/register') && method === 'POST') {
    proposals = proposals.map((proposal) =>
      proposal.id === 'open1-proposal-1'
        ? {
            ...proposal,
            status: 'registered',
            registeredInitiativeId: 'initiative-cnc-access-reviews',
            updatedAt: '2026-09-16T08:05:00Z',
          }
        : proposal
    );
    return json({ success: true, data: proposals[0] });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function Open1AuditPathsScreen(): React.ReactElement {
  const view = new URLSearchParams(window.location.search).get('view') || 'sessions';
  return (
    <MemoryRouter initialEntries={['/audit-programs']}>
      <main className="h-screen bg-c-bg p-8 text-c-text">
        <div className="mx-auto h-full max-w-[1440px] overflow-hidden rounded-xl border border-c-border bg-c-surface">
          {view === 'initiatives' ? (
            <AuditInitiativesTab
              isPolish={false}
              programNameById={new Map([[PROGRAM_ID, PROGRAM.name]])}
            />
          ) : (
            <AuditProcessesTab
              programs={[PROGRAM]}
              loading={false}
              error={null}
              onRetry={() => {}}
              isPolish={false}
              onProgramChanged={() => {}}
              packTitleById={new Map([[PACK_ID, PROGRAM.packTitle || 'CNC process governance pack']])}
              userNameById={new Map([['user-alex', 'Alex Morgan']])}
            />
          )}
        </div>
      </main>
    </MemoryRouter>
  );
}
