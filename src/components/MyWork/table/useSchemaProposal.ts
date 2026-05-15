/**
 * useSchemaProposal — manages Chat-to-Schema proposal lifecycle.
 * Supports generate, execute, reject, refine, undo, redo + proposal history.
 */

import { useCallback, useState } from 'react';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

export interface ProposalHistoryEntry {
  id: string;
  intent: string;
  summary: string;
  status: string;
  timestamp: string;
}

export interface UseSchemaProposalReturn {
  proposal: unknown | null;
  loading: boolean;
  error: string | null;
  executionResult: unknown | null;
  proposalHistory: ProposalHistoryEntry[];
  generateProposal: (
    workspaceId: string,
    message: string,
    existingSchema?: unknown,
    language?: string,
    companyContext?: { workspaceName?: string; moduleName?: string; existingTableNames?: string[] }
  ) => Promise<void>;
  executeProposal: (approvedOperationIds?: string[]) => Promise<unknown>;
  rejectProposal: (reason?: string) => Promise<void>;
  refineProposal: (message: string) => Promise<void>;
  undoProposal: () => Promise<void>;
  redoProposal: () => Promise<void>;
  clearProposal: () => void;
  clearError: () => void;
}

function extractHistoryEntry(raw: unknown, status: string): ProposalHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.proposalId ?? '');
  if (!id) return null;
  return {
    id,
    intent: String(r.intent ?? 'unknown'),
    summary: String(r.summary ?? ''),
    status,
    timestamp: String(r.created_at ?? new Date().toISOString()),
  };
}

function normalizeSchemaError(err: unknown): string {
  const fallback = err instanceof Error ? err.message : 'Table schema operation failed';
  const status = Number((err as any)?.status ?? 0);
  const serverData = (err as any)?.data as Record<string, unknown> | undefined;
  const rawMessage = String(serverData?.error ?? fallback);
  const lower = rawMessage.toLowerCase();

  if (
    status === 403 &&
    (lower.includes('insufficient role') ||
      lower.includes('required role') ||
      lower.includes('permission'))
  ) {
    return 'Missing schema role. Required one of: base_owner, schema_editor.';
  }
  if (lower.includes('workspaceid is required') || lower.includes('workspace id is required')) {
    return 'Table builder needs an active Idea workspace before generating a schema.';
  }
  if (lower.includes('table platform') && lower.includes('disabled')) {
    return 'Table Platform is disabled by feature flag in this environment.';
  }
  return fallback;
}

export function useSchemaProposal(): UseSchemaProposalReturn {
  const [proposal, setProposal] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<unknown | null>(null);
  const [proposalHistory, setProposalHistory] = useState<ProposalHistoryEntry[]>([]);

  const addToHistory = useCallback((raw: unknown, status: string) => {
    const entry = extractHistoryEntry(raw, status);
    if (entry) {
      setProposalHistory((prev) => [entry, ...prev.filter((h) => h.id !== entry.id)]);
    }
  }, []);

  const getProposalId = useCallback((): string | null => {
    const p = proposal as { id?: string; proposalId?: string } | null;
    return p?.id ?? p?.proposalId ?? null;
  }, [proposal]);

  const generateProposal = useCallback(
    async (
      workspaceId: string,
      message: string,
      existingSchema?: unknown,
      language?: string,
      companyContext?: {
        workspaceName?: string;
        moduleName?: string;
        existingTableNames?: string[];
      }
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      setExecutionResult(null);
      try {
        const result = await TablePlatformApi.generateSchemaProposal(
          workspaceId,
          message,
          existingSchema,
          language,
          companyContext
        );
        setProposal(result);
        addToHistory(result, 'pending');
      } catch (err) {
        setError(normalizeSchemaError(err));
        setProposal(null);
      } finally {
        setLoading(false);
      }
    },
    [addToHistory]
  );

  const executeProposal = useCallback(
    async (approvedOperationIds?: string[]): Promise<unknown> => {
      const pid = getProposalId();
      if (!pid) throw new Error('No proposal loaded');
      setLoading(true);
      setError(null);
      try {
        const result = await TablePlatformApi.executeSchemaProposal(pid, approvedOperationIds);
        addToHistory(proposal, 'executed');
        setExecutionResult(result);
        return result;
      } catch (err) {
        setError(normalizeSchemaError(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [proposal, getProposalId, addToHistory]
  );

  const rejectProposal = useCallback(
    async (reason?: string): Promise<void> => {
      const pid = getProposalId();
      if (!pid) return;
      setLoading(true);
      setError(null);
      try {
        await TablePlatformApi.rejectSchemaProposal(pid, reason);
        addToHistory(proposal, 'rejected');
        setProposal(null);
        setExecutionResult(null);
      } catch (err) {
        setError(normalizeSchemaError(err));
      } finally {
        setLoading(false);
      }
    },
    [proposal, getProposalId, addToHistory]
  );

  const refineProposal = useCallback(
    async (message: string): Promise<void> => {
      const pid = getProposalId();
      if (!pid) return;
      setLoading(true);
      setError(null);
      try {
        const result = await TablePlatformApi.refineSchemaProposal(pid, message);
        setProposal(result);
        addToHistory(result, 'refined');
      } catch (err) {
        setError(normalizeSchemaError(err));
      } finally {
        setLoading(false);
      }
    },
    [getProposalId, addToHistory]
  );

  const undoProposal = useCallback(async (): Promise<void> => {
    const pid = getProposalId();
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      await TablePlatformApi.undoSchemaProposal(pid);
      addToHistory(proposal, 'undone');
      setExecutionResult(null);
      setProposal(null);
    } catch (err) {
      setError(normalizeSchemaError(err));
    } finally {
      setLoading(false);
    }
  }, [proposal, getProposalId, addToHistory]);

  const redoProposal = useCallback(async (): Promise<void> => {
    const pid = getProposalId();
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await TablePlatformApi.redoSchemaProposal(pid);
      addToHistory(proposal, 'redone');
      setExecutionResult(result);
    } catch (err) {
      setError(normalizeSchemaError(err));
    } finally {
      setLoading(false);
    }
  }, [proposal, getProposalId, addToHistory]);

  const clearProposal = useCallback(() => {
    setProposal(null);
    setError(null);
    setExecutionResult(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    proposal,
    loading,
    error,
    executionResult,
    proposalHistory,
    generateProposal,
    executeProposal,
    rejectProposal,
    refineProposal,
    undoProposal,
    redoProposal,
    clearProposal,
    clearError,
  };
}
