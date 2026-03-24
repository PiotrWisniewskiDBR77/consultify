import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  V8ExecutionApi,
  type ExecutionProposalRecord,
  type ExecutionRunRecord,
  type ExecutionTransitionRecord,
} from '@/services/api/v8Execution';

export type {
  ExecutionRunState,
  ExecutionProposalStatus,
  ExecutionRunRecord,
  ExecutionProposalRecord,
  ExecutionTransitionRecord,
} from '@/services/api/v8Execution';

export const V8_EXECUTION_KEYS = {
  run: (runId: string) => ['v8', 'execution', 'run', runId] as const,
  proposals: (runId: string) => ['v8', 'execution', 'proposals', runId] as const,
  transitions: (runId: string) => ['v8', 'execution', 'transitions', runId] as const,
};

function invalidateRunScope(queryClient: ReturnType<typeof useQueryClient>, runId: string) {
  void queryClient.invalidateQueries({ queryKey: V8_EXECUTION_KEYS.run(runId) });
  void queryClient.invalidateQueries({ queryKey: V8_EXECUTION_KEYS.proposals(runId) });
  void queryClient.invalidateQueries({ queryKey: V8_EXECUTION_KEYS.transitions(runId) });
}

export function useV8ExecutionRun(runId: string | undefined) {
  return useQuery<ExecutionRunRecord>({
    queryKey: V8_EXECUTION_KEYS.run(runId ?? ''),
    queryFn: () => V8ExecutionApi.getRun(runId!),
    enabled: !!runId,
  });
}

export function useV8ExecutionProposals(runId: string | undefined) {
  return useQuery<ExecutionProposalRecord[]>({
    queryKey: V8_EXECUTION_KEYS.proposals(runId ?? ''),
    queryFn: () => V8ExecutionApi.getRunProposals(runId!),
    enabled: !!runId,
  });
}

export function useV8ExecutionTransitions(runId: string | undefined) {
  return useQuery<ExecutionTransitionRecord[]>({
    queryKey: V8_EXECUTION_KEYS.transitions(runId ?? ''),
    queryFn: () => V8ExecutionApi.getRunTransitions(runId!),
    enabled: !!runId,
  });
}

export function useV8SubmitExecutionReview() {
  const queryClient = useQueryClient();
  return useMutation<ExecutionRunRecord, Error, string>({
    mutationFn: (runId) => V8ExecutionApi.submitReview(runId),
    onSuccess: (run) => invalidateRunScope(queryClient, run.runId),
  });
}

export function useV8ApproveExecutionRun() {
  const queryClient = useQueryClient();
  return useMutation<ExecutionRunRecord, Error, { runId: string; reason?: string }>({
    mutationFn: ({ runId, reason }) => V8ExecutionApi.approveRun(runId, reason),
    onSuccess: (run) => invalidateRunScope(queryClient, run.runId),
  });
}

export function useV8RejectExecutionRun() {
  const queryClient = useQueryClient();
  return useMutation<ExecutionRunRecord, Error, { runId: string; reason: string }>({
    mutationFn: ({ runId, reason }) => V8ExecutionApi.rejectRun(runId, reason),
    onSuccess: (run) => invalidateRunScope(queryClient, run.runId),
  });
}
