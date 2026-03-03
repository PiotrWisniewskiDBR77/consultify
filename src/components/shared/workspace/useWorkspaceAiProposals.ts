import { useCallback, useMemo, useState } from 'react';

import type { WorkspaceAiProposal, WorkspaceAiProposalStatus } from './types';

type UpdateFn<TPayload> = (
  prev: WorkspaceAiProposal<TPayload>
) => WorkspaceAiProposal<TPayload> | null;

export function useWorkspaceAiProposals<TPayload>() {
  const [proposals, setProposals] = useState<WorkspaceAiProposal<TPayload>[]>([]);

  const pending = useMemo(() => proposals.filter((p) => p.status === 'pending'), [proposals]);

  const addProposal = useCallback((p: WorkspaceAiProposal<TPayload>) => {
    setProposals((prev) => [p, ...prev]);
  }, []);

  const updateProposal = useCallback((id: string, fn: UpdateFn<TPayload>) => {
    setProposals((prev) =>
      prev
        .map((p) => (p.id === id ? fn(p) : p))
        .filter(Boolean) as WorkspaceAiProposal<TPayload>[]
    );
  }, []);

  const setStatus = useCallback((id: string, status: WorkspaceAiProposalStatus) => {
    updateProposal(id, (p) => ({ ...p, status }));
  }, [updateProposal]);

  const clearAll = useCallback(() => setProposals([]), []);

  return { proposals, pending, addProposal, updateProposal, setStatus, clearAll };
}

