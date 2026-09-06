import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import { Api } from '@/services/api';

import { ChatTableProposalCard, type SchemaProposal } from '../ChatTableProposalCard';
import { ExecutionProposalMessage } from '../ExecutionProposalMessage';
import { GovernedChatHandoffCard } from '../GovernedChatHandoffCard';
import { GovernedInitiativeHandoffCard } from '../GovernedInitiativeHandoffCard';
import { TeresaProposalCard } from '../TeresaProposalCard';

const lifecycle = vi.hoisted(() => ({ state: undefined as string | undefined }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : _key,
  }),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  executeSchemaProposal: vi.fn(),
  rejectSchemaProposal: vi.fn(),
  refineSchemaProposal: vi.fn(),
  getSchemaProposal: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getTeresaProposal: vi.fn(),
    approveTeresaProposal: vi.fn(),
    rejectTeresaProposal: vi.fn(),
    executeTeresaProposal: vi.fn(),
    undoTeresaProposal: vi.fn(),
  },
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ isAdmin: false, isSuperAdmin: false }),
}));

vi.mock('../../../store/useProposalLifecycleStore', () => ({
  useProposalLifecycle: () => (lifecycle.state ? { lifecycleState: lifecycle.state } : undefined),
}));

vi.mock('@/store/portfolioSlice', () => ({
  usePortfolioStore: { getState: () => ({ triggerRefresh: vi.fn() }) },
}));

vi.mock('../TrustPanel', () => ({ TrustPanel: () => null }));

const schemaProposal = (status: string): SchemaProposal => ({
  id: 'schema-proposal-1',
  intent: 'create_table',
  confidence: 0.9,
  summary: 'Create a governed table',
  operations: [],
  warnings: [],
  status,
});

const teresaProposal = (state: 'proposal' | 'completed') => ({
  proposalId: 'teresa-proposal-1',
  contractId: 'teresa_copilot_v1',
  title: 'Prepare initiative draft',
  summary: 'Proposal prepared for Initiatives.',
  state,
  approvalState: state === 'completed' ? ('completed' as const) : ('awaiting_review' as const),
  allowedActions:
    state === 'completed'
      ? (['undo', 'navigate'] as const)
      : (['approve', 'reject', 'navigate'] as const),
  targetModule: 'initiatives',
  targetLabel: 'Initiatives',
  handoffIntent: 'create',
  previewLines: ['Problem statement'],
  auditCount: 1,
  resultRef: state === 'completed' ? 'initiative-1' : null,
  degraded: null,
});

const governedProposal = (state: 'pending' | 'materialized') => ({
  proposalId: 'governed-proposal-1',
  producerRecordId: 'message-1',
  sourceContentHash: 'a'.repeat(64),
  sourceVersion: 1,
  targetKind: 'document' as const,
  payload: { messageId: 'message-1', suggestedTitle: 'Pinned strategy' },
  state,
  decidedAt: state === 'pending' ? null : '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T08:00:00.000Z',
});

describe('day371 proposal-card family remount behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycle.state = undefined;
    vi.mocked(Api.getTeresaProposal).mockResolvedValue(teresaProposal('proposal'));
  });

  it('ChatTableProposalCard shows the live executed proposal after remount with stale metadata', async () => {
    vi.mocked(TablePlatformApi.getSchemaProposal).mockResolvedValue(schemaProposal('executed'));
    const first = render(
      <ChatTableProposalCard proposal={schemaProposal('pending')} onStatusChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    first.unmount();

    render(<ChatTableProposalCard proposal={schemaProposal('pending')} onStatusChange={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText('Table created successfully!')).toBeInTheDocument()
    );
    expect(TablePlatformApi.getSchemaProposal).toHaveBeenCalledWith('schema-proposal-1');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('TeresaProposalCard shows a completed proposal after remount', () => {
    const first = render(<TeresaProposalCard proposal={teresaProposal('proposal') as any} />);
    expect(screen.getByText('Do zatwierdzenia')).toBeInTheDocument();
    first.unmount();

    render(<TeresaProposalCard proposal={teresaProposal('completed') as any} />);
    expect(screen.getByText('Wykonane')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('TeresaProposalCard refreshes live state after remount with the same stale proposal', async () => {
    const staleProposal = teresaProposal('proposal');
    vi.mocked(Api.getTeresaProposal).mockResolvedValue(teresaProposal('completed'));

    const first = render(<TeresaProposalCard proposal={staleProposal as any} />);
    expect(screen.getByText('Do zatwierdzenia')).toBeInTheDocument();
    first.unmount();

    render(<TeresaProposalCard proposal={staleProposal as any} />);
    await waitFor(() => expect(screen.getByText('Wykonane')).toBeInTheDocument());
    expect(Api.getTeresaProposal).toHaveBeenCalledWith('teresa-proposal-1');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('ChatTableProposalCard treats the typed already-executed conflict as executed', async () => {
    vi.mocked(TablePlatformApi.getSchemaProposal).mockResolvedValue(schemaProposal('pending'));
    vi.mocked(TablePlatformApi.executeSchemaProposal).mockRejectedValue({
      status: 409,
      data: { code: 'PROPOSAL_ALREADY_EXECUTED' },
    });
    const onStatusChange = vi.fn();
    render(
      <ChatTableProposalCard proposal={schemaProposal('pending')} onStatusChange={onStatusChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() =>
      expect(screen.getByText('Table created successfully!')).toBeInTheDocument()
    );
    expect(onStatusChange).toHaveBeenCalledWith('executed');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ExecutionProposalMessage prefers the live executed lifecycle after remount', () => {
    const msg = {
      id: 'message-1',
      role: 'assistant',
      content: 'Execute the governed plan',
      type: 'execution_proposal',
      metadata: { proposalId: 'execution-proposal-1', lifecycleState: 'pending_review' },
    } as any;
    const first = render(<ExecutionProposalMessage msg={msg} onApprove={vi.fn()} />);
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    first.unmount();

    lifecycle.state = 'executed';
    render(<ExecutionProposalMessage msg={msg} onApprove={vi.fn()} />);
    expect(screen.getByText('Executed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('GovernedChatHandoffCard shows a materialized proposal after remount', () => {
    const handlers = { onApprove: vi.fn(), onReject: vi.fn(), onMaterialize: vi.fn() };
    const first = render(
      <GovernedChatHandoffCard proposal={governedProposal('pending')} {...handlers} />
    );
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    first.unmount();

    render(<GovernedChatHandoffCard proposal={governedProposal('materialized')} {...handlers} />);
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('GovernedInitiativeHandoffCard shows an already adopted handoff after remount', async () => {
    const pendingProps = {
      initiativeId: 'initiative-1',
      title: 'Chat draft',
      onOpenInitiative: vi.fn(),
      onAdopted: vi.fn(),
    };
    let adopted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/initiatives/initiative-1') {
        return {
          ok: true,
          json: async () => ({
            projectId: 'project-1',
            ownerExecutionId: 'owner-1',
            problemStatement: 'Measured problem',
          }),
        } as Response;
      }
      if (url === '/api/initiatives/runtime-v1/adoptions/chat-draft' && init?.method === 'POST') {
        adopted = true;
        return {
          ok: true,
          json: async () => ({ response: { initiativeId: 'initiative-1' } }),
        } as Response;
      }
      if (
        url ===
        '/api/initiatives/runtime-v1/command-receipts/chat-draft-adopt%3Ainitiative-1/read-back'
      ) {
        return {
          ok: adopted,
          status: adopted ? 200 : 404,
          json: async () =>
            adopted ? { readBackState: 'CONFIRMED' } : { error: { code: 'NOT_FOUND' } },
        } as Response;
      }
      if (
        url ===
        '/api/initiatives/runtime-v1/command-receipts/chat-draft-adopt%3Ainitiative-hidden/read-back'
      ) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { code: 'NOT_FOUND' } }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = render(<GovernedInitiativeHandoffCard {...pendingProps} />);
    expect(screen.getByText('Awaiting consent')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/initiatives/runtime-v1/command-receipts/chat-draft-adopt%3Ainitiative-1/read-back',
        { credentials: 'include' }
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check before handoff' }));
    await screen.findByRole('button', { name: 'Pass to execution' });
    fireEvent.click(screen.getByRole('button', { name: 'Pass to execution' }));
    await screen.findByText('Adopted');
    expect(
      JSON.parse(
        String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body)
      )
    ).toMatchObject({ clientRequestId: 'chat-draft-adopt:initiative-1' });
    first.unmount();

    const remounted = render(<GovernedInitiativeHandoffCard {...pendingProps} />);
    await screen.findByText('Adopted');
    expect(screen.queryByRole('button', { name: 'Check before handoff' })).not.toBeInTheDocument();

    remounted.unmount();
    render(<GovernedInitiativeHandoffCard {...pendingProps} initiativeId="initiative-hidden" />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/initiatives/runtime-v1/command-receipts/chat-draft-adopt%3Ainitiative-hidden/read-back',
        { credentials: 'include' }
      )
    );
    expect(screen.getByText('Awaiting consent')).toBeInTheDocument();
  });
});
