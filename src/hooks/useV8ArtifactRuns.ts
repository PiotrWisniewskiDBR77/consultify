import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ArtifactRunPlanningEnvelope,
  type ArtifactRunRecord,
  ArtifactRunsApi,
  type CreateArtifactRunFromChatParams,
  type MaterializeArtifactRunParams,
} from '@/services/api/artifactRuns';

export type {
  ArtifactFamily,
  ArtifactPlanOutputType,
  ArtifactRunPlan,
  ArtifactRunPlanningEnvelope,
  ArtifactRunRecord,
  ArtifactRunStatus,
  CreateArtifactRunFromChatParams,
  MaterializeArtifactRunParams,
} from '@/services/api/artifactRuns';

export const V8_ARTIFACT_RUN_KEYS = {
  run: (runId: string) => ['v8', 'artifact-run', runId] as const,
};

export function useV8ArtifactRun(runId: string | undefined) {
  return useQuery<ArtifactRunRecord>({
    queryKey: V8_ARTIFACT_RUN_KEYS.run(runId ?? ''),
    queryFn: () => ArtifactRunsApi.getRun(runId!),
    enabled: !!runId,
  });
}

export function useV8CreateArtifactRunFromChat() {
  const queryClient = useQueryClient();
  return useMutation<ArtifactRunPlanningEnvelope, Error, CreateArtifactRunFromChatParams>({
    mutationFn: (params) => ArtifactRunsApi.createFromChat(params),
    onSuccess: (result) => {
      queryClient.setQueryData(V8_ARTIFACT_RUN_KEYS.run(result.run.runId), result.run);
    },
  });
}

export function useV8AcceptArtifactRunPlan() {
  const queryClient = useQueryClient();
  return useMutation<ArtifactRunRecord, Error, string>({
    mutationFn: (runId) => ArtifactRunsApi.acceptPlan(runId),
    onSuccess: (run) => {
      queryClient.setQueryData(V8_ARTIFACT_RUN_KEYS.run(run.runId), run);
    },
  });
}

export function useV8RetryArtifactRun() {
  const queryClient = useQueryClient();
  return useMutation<ArtifactRunRecord, Error, string>({
    mutationFn: (runId) => ArtifactRunsApi.retry(runId),
    onSuccess: (run) => {
      queryClient.setQueryData(V8_ARTIFACT_RUN_KEYS.run(run.runId), run);
    },
  });
}

export function useV8MaterializeArtifactRun() {
  const queryClient = useQueryClient();
  return useMutation<
    ArtifactRunRecord,
    Error,
    { runId: string; params: MaterializeArtifactRunParams }
  >({
    mutationFn: ({ runId, params }) => ArtifactRunsApi.materialize(runId, params),
    onSuccess: (run) => {
      queryClient.setQueryData(V8_ARTIFACT_RUN_KEYS.run(run.runId), run);
    },
  });
}
