/**
 * Table Platform API Adapter Hook
 * React Query hooks wrapping the table platform API client.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as tablePlatformApi from '@/services/api/tablePlatform.api';

const QUERY_KEYS = {
  bases: (workspaceId: string) => ['tablePlatform', 'bases', workspaceId] as const,
  base: (baseId: string) => ['tablePlatform', 'base', baseId] as const,
  table: (tableId: string) => ['tablePlatform', 'table', tableId] as const,
  records: (tableId: string, options?: { viewId?: string; cursor?: string }) =>
    ['tablePlatform', 'records', tableId, options?.viewId, options?.cursor] as const,
  record: (recordId: string) => ['tablePlatform', 'record', recordId] as const,
};

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useBases(workspaceId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.bases(workspaceId ?? ''),
    queryFn: () => tablePlatformApi.listBases(workspaceId!),
    enabled: !!workspaceId && (options?.enabled ?? true),
  });
}

export function useBase(baseId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.base(baseId ?? ''),
    queryFn: () => tablePlatformApi.getBase(baseId!),
    enabled: !!baseId && (options?.enabled ?? true),
  });
}

export function useTable(tableId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.table(tableId ?? ''),
    queryFn: () => tablePlatformApi.getTable(tableId!),
    enabled: !!tableId && (options?.enabled ?? true),
  });
}

export function useRecords(
  tableId: string | undefined,
  opts?: { viewId?: string; pageSize?: number; cursor?: string; filters?: any; sorts?: any[] },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: QUERY_KEYS.records(tableId ?? '', { viewId: opts?.viewId, cursor: opts?.cursor }),
    queryFn: () => tablePlatformApi.listRecords(tableId!, opts),
    enabled: !!tableId && (options?.enabled ?? true),
  });
}

export function useRecord(recordId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.record(recordId ?? ''),
    queryFn: () => tablePlatformApi.getRecord(recordId!),
    enabled: !!recordId && (options?.enabled ?? true),
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useCreateBase(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) => tablePlatformApi.createBase(workspaceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'bases', workspaceId] });
    },
  });
}

export function useCreateTable(baseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; description?: string }) =>
      tablePlatformApi.createTable(baseId, params.name, params.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'base', baseId] });
      queryClient.invalidateQueries({ queryKey: ['tablePlatform'] });
    },
  });
}

export function useCreateField(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; fieldType: string; options?: any }) =>
      tablePlatformApi.createField(tableId, params.name, params.fieldType, params.options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'table', tableId] });
      queryClient.invalidateQueries({ queryKey: ['tablePlatform'] });
    },
  });
}

export function useUpdateField(fieldId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { name?: string; options?: any }) =>
      tablePlatformApi.updateField(fieldId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform'] });
    },
  });
}

export function useCreateView(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; viewType?: string; config?: any }) =>
      tablePlatformApi.createView(tableId, params.name, params.viewType, params.config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'table', tableId] });
      queryClient.invalidateQueries({ queryKey: ['tablePlatform'] });
    },
  });
}

export function useUpdateView(viewId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { name?: string; config?: any; visibleFieldIds?: string[] }) =>
      tablePlatformApi.updateView(viewId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform'] });
    },
  });
}

export function useCreateRecord(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => tablePlatformApi.createRecord(tableId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'records', tableId] });
    },
  });
}

export function useUpdateRecord(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => tablePlatformApi.updateRecord(recordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'record', recordId] });
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'records'] });
    },
  });
}

export function useDeleteRecord(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tablePlatformApi.deleteRecord(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'record', recordId] });
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'records'] });
    },
  });
}

export function useBatchRecords(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      operations: Array<{ type: string; recordId?: string; data?: Record<string, unknown> }>
    ) => tablePlatformApi.batchRecords(tableId, operations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablePlatform', 'records', tableId] });
    },
  });
}

// ============================================================================
// ADAPTER FACADE
// ============================================================================

/** Adapter exposing both raw API and hook-based access */
export const tablePlatformAdapter = {
  /** Raw API functions for imperative use */
  api: tablePlatformApi,
  /** Query keys for cache invalidation */
  queryKeys: QUERY_KEYS,
};
