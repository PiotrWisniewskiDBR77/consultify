import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ConnectorType =
  | 'csv'
  | 'google_sheets'
  | 'airtable'
  | 'postgresql'
  | 'jira'
  | 'webhook';

export interface FieldMapping {
  sourceField: string;
  targetField: string | null;
  transform?: 'trim' | 'uppercase' | 'lowercase' | 'date_format';
  transformArg?: string;
  inferredType?: string;
  createNew?: boolean;
}

export interface ConnectorConfig {
  type: ConnectorType;
  name: string;
  /* CSV / XLSX */
  fileData?: string;
  fileName?: string;
  /* Google Sheets */
  spreadsheetId?: string;
  apiKey?: string;
  sheetName?: string;
  /* Airtable */
  baseId?: string;
  apiToken?: string;
  tableName?: string;
  /* PostgreSQL */
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schema?: string;
  tableOrQuery?: string;
  /* Jira */
  domain?: string;
  email?: string;
  jiraApiToken?: string;
  jql?: string;
  project?: string;
  /* Webhook */
  webhookSecret?: string;
}

export interface Connector {
  id: string;
  workspaceId: string;
  tableId: string;
  type: ConnectorType;
  name: string;
  config: Record<string, unknown>;
  fieldMappings: FieldMapping[];
  schedule?: { interval: string; nextRun?: string } | null;
  lastRunStatus?: 'success' | 'failed' | 'running' | 'never';
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = 'running' | 'success' | 'failed';

export interface ConnectorRun {
  id: string;
  connectorId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  recordsFetched: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
  error?: string;
}

export interface AutoMapResult {
  mappings: FieldMapping[];
}

/* ------------------------------------------------------------------ */
/*  Query keys                                                         */
/* ------------------------------------------------------------------ */

const keys = {
  all: (wId: string) => ['connectors', wId] as const,
  detail: (wId: string, id: string) => ['connectors', wId, id] as const,
  runs: (wId: string, id: string) => ['connectors', wId, id, 'runs'] as const,
  scheduled: (wId: string) => ['connectors', wId, 'scheduled'] as const,
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useConnectors(workspaceId: string) {
  const qc = useQueryClient();
  const base = `/workspaces/${workspaceId}/connectors`;

  /* ---- Queries ---- */

  const listQuery = useQuery<Connector[]>({
    queryKey: keys.all(workspaceId),
    queryFn: () => Api.get(base),
    enabled: !!workspaceId,
  });

  const scheduledQuery = useQuery<Connector[]>({
    queryKey: keys.scheduled(workspaceId),
    queryFn: () => Api.get(`${base}/scheduled`),
    enabled: !!workspaceId,
  });

  /* ---- Mutations ---- */

  const createMutation = useMutation({
    mutationFn: (payload: {
      type: ConnectorType;
      name: string;
      tableId: string;
      config: Record<string, unknown>;
      fieldMappings: FieldMapping[];
      schedule?: { interval: string } | null;
      runNow?: boolean;
    }) => Api.post(base, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(workspaceId) });
      qc.invalidateQueries({ queryKey: keys.scheduled(workspaceId) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      Api.patch(`${base}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(workspaceId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Api.delete(`${base}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(workspaceId) });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => Api.post(`${base}/${id}/test`, {}),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => Api.post(`${base}/${id}/run`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: keys.runs(workspaceId, id) });
      qc.invalidateQueries({ queryKey: keys.all(workspaceId) });
    },
  });

  const autoMapMutation = useMutation<AutoMapResult, Error, { id: string; sourceFields: string[] }>(
    {
      mutationFn: ({ id, sourceFields }) => Api.post(`${base}/${id}/auto-map`, { sourceFields }),
    }
  );

  const scheduleMutation = useMutation({
    mutationFn: ({ id, interval }: { id: string; interval: string }) =>
      Api.post(`${base}/${id}/schedule`, { interval }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(workspaceId) });
      qc.invalidateQueries({ queryKey: keys.scheduled(workspaceId) });
    },
  });

  const unscheduleMutation = useMutation({
    mutationFn: (id: string) => Api.delete(`${base}/${id}/schedule`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all(workspaceId) });
      qc.invalidateQueries({ queryKey: keys.scheduled(workspaceId) });
    },
  });

  /* ---- Per-connector helpers ---- */

  const useRunHistory = useCallback(
    (connectorId: string) => ({
      queryKey: keys.runs(workspaceId, connectorId),
      queryFn: () => Api.get(`${base}/${connectorId}/runs`) as Promise<ConnectorRun[]>,
      enabled: !!connectorId,
    }),
    [workspaceId, base]
  );

  const testConnection = useCallback(
    async (
      config: Record<string, unknown>,
      type: ConnectorType
    ): Promise<{ ok: boolean; error?: string; fields?: string[] }> => {
      try {
        const res = await Api.post(`${base}/test-config`, { type, config });
        return res as { ok: boolean; error?: string; fields?: string[] };
      } catch (err: any) {
        return { ok: false, error: err?.message ?? 'Connection failed' };
      }
    },
    [base]
  );

  return useMemo(
    () => ({
      connectors: listQuery.data ?? [],
      isLoading: listQuery.isLoading,
      error: listQuery.error,
      scheduled: scheduledQuery.data ?? [],

      create: createMutation.mutateAsync,
      isCreating: createMutation.isPending,

      update: updateMutation.mutateAsync,
      remove: deleteMutation.mutateAsync,

      testById: testMutation.mutateAsync,
      isTesting: testMutation.isPending,

      testConnection,

      run: runMutation.mutateAsync,
      isRunning: runMutation.isPending,

      autoMap: autoMapMutation.mutateAsync,
      isAutoMapping: autoMapMutation.isPending,

      schedule: scheduleMutation.mutateAsync,
      unschedule: unscheduleMutation.mutateAsync,

      useRunHistory,
      refetch: listQuery.refetch,
    }),
    [
      listQuery,
      scheduledQuery,
      createMutation,
      updateMutation,
      deleteMutation,
      testMutation,
      runMutation,
      autoMapMutation,
      scheduleMutation,
      unscheduleMutation,
      testConnection,
      useRunHistory,
    ]
  );
}
