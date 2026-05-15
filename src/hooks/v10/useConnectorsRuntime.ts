import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ConnectorsAuthCompleteResponse,
  type ConnectorsAuthStartResponse,
  type ConnectorsCatalogResponse,
  type ConnectorsFetchResponse,
  type ConnectorsReadSourceResponse,
  ConnectorsRuntimeApi,
  type ConnectorsSearchResponse,
  type ConnectorsSessionListResponse,
  type ConnectorsSessionMutationResponse,
  type ConnectorsTokenRefreshResponse,
} from '@/services/api/v10';
import { isConnectorsFederatedSearchEnabled } from '@/utils/v10/connectorsFederatedSearchFlag';
import { isConnectorsRegistryEnabled } from '@/utils/v10/connectorsRegistryFlag';
import { isConnectorsTokenRefreshRevocationEnabled } from '@/utils/v10/connectorsTokenRefreshRevocationFlag';
import { isConnectorsUserDisconnectEnabled } from '@/utils/v10/connectorsUserDisconnectFlag';
import { isPipelinesConnectorsIngestPipelineEnabled } from '@/utils/v10/pipelinesConnectorsIngestPipelineFlag';

export type {
  ConnectorsCatalogItem,
  ConnectorsCatalogResponse,
  ConnectorsFetchRequest,
  ConnectorsFetchResponse,
  ConnectorsReadSourceResponse,
  ConnectorsSearchResponse,
  ConnectorsSessionListResponse,
  ConnectorsSessionRecord,
} from '@/services/api/v10';

export interface ConnectorsRuntimeCapabilities {
  readonly enabled: boolean;
  readonly catalog: boolean;
  readonly sessions: boolean;
  readonly fetch: boolean;
  readonly search: boolean;
  readonly readSource: boolean;
  readonly connect: boolean;
  readonly completeAuth: boolean;
  readonly refreshTokens: boolean;
  readonly disconnect: boolean;
}

export interface UseConnectorsRuntimeOptions {
  readonly enabled?: boolean;
  readonly persona?: string | null;
  readonly includePlanned?: boolean;
}

export const V10_CONNECTORS_RUNTIME_KEYS = {
  catalog: (persona: string | null | undefined, includePlanned: boolean) =>
    [
      'v10',
      'connectors-runtime',
      'catalog',
      persona ?? 'all',
      includePlanned ? 'planned' : 'available',
    ] as const,
  sessions: () => ['v10', 'connectors-runtime', 'sessions'] as const,
} as const;

function createCapabilityError(capability: string): Error {
  return new Error(`Connectors Runtime capability "${capability}" is disabled.`);
}

export function buildConnectorsRuntimeCapabilities(
  options: UseConnectorsRuntimeOptions = {}
): ConnectorsRuntimeCapabilities {
  const baseEnabled = options.enabled ?? true;
  const registryEnabled = baseEnabled && isConnectorsRegistryEnabled();
  const pipelineEnabled = baseEnabled && isPipelinesConnectorsIngestPipelineEnabled();
  const searchEnabled = pipelineEnabled && isConnectorsFederatedSearchEnabled();
  const refreshEnabled = pipelineEnabled && isConnectorsTokenRefreshRevocationEnabled();
  const disconnectEnabled = pipelineEnabled && isConnectorsUserDisconnectEnabled();

  return {
    enabled: registryEnabled || pipelineEnabled,
    catalog: registryEnabled,
    sessions: pipelineEnabled,
    fetch: pipelineEnabled,
    search: searchEnabled,
    readSource: searchEnabled,
    connect: pipelineEnabled,
    completeAuth: pipelineEnabled,
    refreshTokens: refreshEnabled,
    disconnect: disconnectEnabled,
  };
}

export function useConnectorsRuntime(options: UseConnectorsRuntimeOptions = {}) {
  const queryClient = useQueryClient();
  const persona = options.persona ?? null;
  const includePlanned = options.includePlanned ?? true;
  const capabilities = buildConnectorsRuntimeCapabilities(options);

  const catalogQuery = useQuery<ConnectorsCatalogResponse>({
    queryKey: V10_CONNECTORS_RUNTIME_KEYS.catalog(persona, includePlanned),
    queryFn: () => {
      if (!capabilities.catalog) throw createCapabilityError('catalog');
      return ConnectorsRuntimeApi.listCatalog({ persona, includePlanned });
    },
    enabled: capabilities.catalog,
  });

  const sessionsQuery = useQuery<ConnectorsSessionListResponse>({
    queryKey: V10_CONNECTORS_RUNTIME_KEYS.sessions(),
    queryFn: () => {
      if (!capabilities.sessions) throw createCapabilityError('sessions');
      return ConnectorsRuntimeApi.listSessions();
    },
    enabled: capabilities.sessions,
  });

  const refreshRuntimeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: V10_CONNECTORS_RUNTIME_KEYS.catalog(persona, includePlanned),
      }),
      queryClient.invalidateQueries({ queryKey: V10_CONNECTORS_RUNTIME_KEYS.sessions() }),
    ]);
  };

  const fetchMutation = useMutation<ConnectorsFetchResponse, Error, { url: string; now?: string }>({
    mutationFn: async (payload) => {
      if (!capabilities.fetch) throw createCapabilityError('fetch');
      return ConnectorsRuntimeApi.fetch(payload);
    },
  });

  const searchMutation = useMutation<
    ConnectorsSearchResponse,
    Error,
    { query: string; connectorIds?: string[]; limit?: number }
  >({
    mutationFn: async (payload) => {
      if (!capabilities.search) throw createCapabilityError('search');
      return ConnectorsRuntimeApi.search(payload);
    },
  });

  const readSourceMutation = useMutation<
    ConnectorsReadSourceResponse,
    Error,
    { connectorId: string; sourceId: string }
  >({
    mutationFn: async (payload) => {
      if (!capabilities.readSource) throw createCapabilityError('read_source');
      return ConnectorsRuntimeApi.readSource(payload);
    },
  });

  const connectMutation = useMutation<
    ConnectorsSessionMutationResponse | ConnectorsAuthStartResponse,
    Error,
    { connectorId: string; requiresAuth: boolean; requestedScopes?: string[] }
  >({
    mutationFn: async ({ connectorId, requiresAuth, requestedScopes }) => {
      if (!capabilities.connect) throw createCapabilityError('connect');
      return requiresAuth
        ? ConnectorsRuntimeApi.startAuth(connectorId, { requestedScopes })
        : ConnectorsRuntimeApi.connectConnector(connectorId, { requestedScopes });
    },
    onSuccess: refreshRuntimeQueries,
  });

  const completeAuthMutation = useMutation<
    ConnectorsAuthCompleteResponse,
    Error,
    {
      connectorId: string;
      challengeId?: string;
      authorizationCode?: string;
      result?: 'authorized' | 'denied' | 'failed';
      errorCode?: string;
      errorMessage?: string;
    }
  >({
    mutationFn: async ({ connectorId, ...payload }) => {
      if (!capabilities.completeAuth) throw createCapabilityError('complete_auth');
      return ConnectorsRuntimeApi.completeAuth(connectorId, payload);
    },
    onSuccess: refreshRuntimeQueries,
  });

  const refreshTokensMutation = useMutation<
    ConnectorsTokenRefreshResponse,
    Error,
    { connectorId: string; reason?: string }
  >({
    mutationFn: async ({ connectorId, reason }) => {
      if (!capabilities.refreshTokens) throw createCapabilityError('refresh_tokens');
      return ConnectorsRuntimeApi.refreshTokens(connectorId, { reason });
    },
    onSuccess: refreshRuntimeQueries,
  });

  const disconnectMutation = useMutation<
    ConnectorsSessionMutationResponse,
    Error,
    { connectorId: string; reason?: string }
  >({
    mutationFn: async ({ connectorId, reason }) => {
      if (!capabilities.disconnect) throw createCapabilityError('disconnect');
      return ConnectorsRuntimeApi.disconnectConnector(connectorId, { reason });
    },
    onSuccess: refreshRuntimeQueries,
  });

  const isWorking =
    fetchMutation.isPending ||
    searchMutation.isPending ||
    readSourceMutation.isPending ||
    connectMutation.isPending ||
    completeAuthMutation.isPending ||
    refreshTokensMutation.isPending ||
    disconnectMutation.isPending;
  const isLoading = catalogQuery.isLoading || sessionsQuery.isLoading;
  const isFetching = catalogQuery.isFetching || sessionsQuery.isFetching;

  return {
    capabilities,
    isEnabled: capabilities.enabled,
    isWorking,
    isLoading,
    isFetching,
    catalogQuery,
    sessionsQuery,
    fetch: fetchMutation.mutateAsync,
    search: searchMutation.mutateAsync,
    readSource: readSourceMutation.mutateAsync,
    connect: connectMutation.mutateAsync,
    completeAuth: completeAuthMutation.mutateAsync,
    refreshTokens: refreshTokensMutation.mutateAsync,
    disconnect: disconnectMutation.mutateAsync,
    fetchMutation,
    searchMutation,
    readSourceMutation,
    connectMutation,
    completeAuthMutation,
    refreshTokensMutation,
    disconnectMutation,
    refetchCatalog: catalogQuery.refetch,
    refetchSessions: sessionsQuery.refetch,
  };
}
