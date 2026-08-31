import React from 'react';

import { ExecutionProposalMessage } from '@/components/AIChat/ExecutionProposalMessage';

export default function Day207WriteProposalScreen(): React.ReactElement {
  const message = {
    id: 'day207-message',
    role: 'assistant',
    type: 'execution_proposal',
    content: 'Create task: Prepare the customer workshop brief',
    timestamp: new Date('2026-08-31T08:00:00Z'),
    metadata: {
      proposalId: 'day207-proposal',
      runId: 'day207-run',
      lifecycleState: 'pending_review',
      planSummary: 'Create task: Prepare the customer workshop brief',
      stepCount: 1,
      risk: 'low',
      steps: [{ id: 'write', label: 'create_task' }],
    },
  } as any;

  return (
    <main className="min-h-screen bg-c-bg px-8 py-12 text-c-text">
      <section className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">
            Teresa · same-turn WRITE proposal
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Review before anything changes</h1>
          <p className="mt-2 text-sm text-c-text-secondary">
            The requested task is still a proposal. No project record has been changed.
          </p>
        </div>
        <ExecutionProposalMessage
          msg={message}
          onApprove={() => undefined}
          onReject={() => undefined}
          onInspect={() => undefined}
        />
      </section>
    </main>
  );
}
