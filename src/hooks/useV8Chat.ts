/**
 * useV8Chat Hooks
 * React Query hooks for V8 Chat operations: snapshots, handoffs.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { V8ChatApi } from '@/services/api/v8';

export const V8_CHAT_KEYS = {
  snapshots: (conversationId: string) => ['v8', 'chat', 'snapshots', conversationId] as const,
  snapshot: (snapshotId: string) => ['v8', 'chat', 'snapshot', snapshotId] as const,
  handoffs: (conversationId: string) => ['v8', 'chat', 'handoffs', conversationId] as const,
};

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useV8Snapshots(conversationId: string | undefined) {
  return useQuery({
    queryKey: V8_CHAT_KEYS.snapshots(conversationId ?? ''),
    queryFn: () => V8ChatApi.getSnapshotsByConversation(conversationId!),
    enabled: !!conversationId,
  });
}

export function useV8Snapshot(snapshotId: string | undefined) {
  return useQuery({
    queryKey: V8_CHAT_KEYS.snapshot(snapshotId ?? ''),
    queryFn: () => V8ChatApi.getSnapshot(snapshotId!),
    enabled: !!snapshotId,
  });
}

export function useV8Handoffs(conversationId: string | undefined) {
  return useQuery({
    queryKey: V8_CHAT_KEYS.handoffs(conversationId ?? ''),
    queryFn: () => V8ChatApi.getHandoffs(conversationId!),
    enabled: !!conversationId,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useV8CaptureSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => V8ChatApi.captureSnapshot(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v8', 'chat', 'snapshots'] });
    },
  });
}

export function useV8CreateHandoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => V8ChatApi.createHandoff(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v8', 'chat', 'handoffs'] });
    },
  });
}
