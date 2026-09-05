import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  useProposalLifecycle: () =>
    lifecycle.state ? { lifecycleState: lifecycle.state } : undefined,
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
    lifecycle.state = undefined;
  });

  it('ChatTableProposalCard shows an already executed proposal after remount', () => {
    const first = render(
      <ChatTableProposalCard proposal={schemaProposal('pending')} onStatusChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    first.unmount();

    render(
      <ChatTableProposalCard proposal={schemaProposal('executed')} onStatusChange={vi.fn()} />
    );
    expect(screen.getByText('Table created successfully!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('TeresaProposalCard shows a completed proposal after remount', () => {
    const first = render(<TeresaProposalCard proposal={teresaProposal('proposal') as any} />);
    expect(screen.getByText('Proposal ready')).toBeInTheDocument();
    first.unmount();

    render(<TeresaProposalCard proposal={teresaProposal('completed') as any} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
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

  it('GovernedInitiativeHandoffCard shows an already adopted handoff after remount', () => {
    const pendingProps = {
      initiativeId: 'initiative-1',
      title: 'Chat draft',
      onOpenInitiative: vi.fn(),
      onAdopted: vi.fn(),
    };
    const first = render(<GovernedInitiativeHandoffCard {...pendingProps} />);
    expect(screen.getByText('Awaiting consent')).toBeInTheDocument();
    first.unmount();

    render(<GovernedInitiativeHandoffCard {...({ ...pendingProps, state: 'adopted' } as any)} />);
    expect(screen.getByText('Adopted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check before handoff' })).not.toBeInTheDocument();
  });
});
