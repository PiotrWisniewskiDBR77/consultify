import { useCallback, useState } from 'react';

export interface AIProposalOp {
  action: 'create' | 'delete' | 'connect' | 'move' | 'update_label';
  target_id?: string;
  params?: Record<string, unknown>;
}

export interface AIProposal {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  prompt: string;
  summary: string;
  operations: AIProposalOp[];
  risk_flags: string[];
  validation_before: { valid: boolean; issue_count: number };
  validation_after: { valid: boolean; issue_count: number };
  readback_before: string;
  readback_after: string;
  created_at: string;
}

interface UseProcessFlowAIProposalOpts {
  processId: string | null;
}

export function useProcessFlowAIProposal({ processId }: UseProcessFlowAIProposalOpts) {
  const [activeProposal, setActiveProposal] = useState<AIProposal | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProposal = useCallback(
    async (prompt: string) => {
      if (!processId) return;
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`/api/v8/process-flow/${processId}/ai-proposals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveProposal(data);
        } else {
          setError('Failed to create AI proposal');
        }
      } catch {
        setError('Network error');
      } finally {
        setIsGenerating(false);
      }
    },
    [processId]
  );

  const resolveProposal = useCallback(
    async (action: 'accept' | 'reject') => {
      if (!activeProposal?.id || !processId) return;
      try {
        const res = await fetch(`/api/v8/process-flow/ai-proposals/${activeProposal.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          setActiveProposal(null);
        }
      } catch {
        setError('Failed to resolve proposal');
      }
    },
    [activeProposal, processId]
  );

  const dismiss = useCallback(() => setActiveProposal(null), []);

  return { activeProposal, isGenerating, error, createProposal, resolveProposal, dismiss };
}
