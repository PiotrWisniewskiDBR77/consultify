import { z } from 'zod';

export const ConnectorsFetchRequestSchema = z.object({
  url: z.string().trim().min(1),
  now: z.string().trim().min(1).optional(),
});

export type ConnectorsFetchRequest = z.infer<typeof ConnectorsFetchRequestSchema>;

export const ConnectorsRuntimeScopeSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  userRole: z.string().trim().min(1).nullable().optional(),
});

export type ConnectorsRuntimeScope = z.infer<typeof ConnectorsRuntimeScopeSchema>;

export type ConnectorsRuntimeStatus = 'succeeded' | 'fallback';
export type ConnectorsRuntimeEndpointState =
  | 'ok'
  | 'missing_endpoint'
  | 'not_implemented'
  | 'backend_error';
export type ConnectorsConnectorKind = 'external' | 'virtual' | 'manual';
export type ConnectorsConnectorAvailability = 'available' | 'planned';
export type ConnectorsConnectorWave = 'wave_a' | 'wave_b' | 'wave_c';
export type ConnectorsConnectorAuthStrategy =
  | 'oauth2_pkce'
  | 'oauth2_device_code'
  | 'api_key'
  | 'service_account'
  | 'manual_upload'
  | 'none';
export type ConnectorsConnectorCategory =
  | 'knowledge_base'
  | 'communication'
  | 'storage'
  | 'productivity'
  | 'finance'
  | 'security'
  | 'manual_input';
export type ConnectorsConnectorCapabilityFlag =
  | 'search'
  | 'read_doc'
  | 'list_recent'
  | 'sync_delta'
  | 'acl_probe'
  | 'webhook_ingest'
  | 'write_doc'
  | 'write_message'
  | 'send_email'
  | 'create_ticket'
  | 'calendar_read';

export interface ConnectorsFetchResponse {
  readonly requestId: string;
  readonly now: string;
  readonly url: string;
  readonly status: ConnectorsRuntimeStatus;
  readonly endpointState: ConnectorsRuntimeEndpointState;
  readonly httpStatus: number | null;
  readonly snippet: string;
}

export interface ConnectorsCatalogItem {
  readonly id: string;
  readonly kind: ConnectorsConnectorKind;
  readonly availability: ConnectorsConnectorAvailability;
  readonly wave: ConnectorsConnectorWave;
  readonly name: string;
  readonly description: string;
  readonly category: ConnectorsConnectorCategory;
  readonly authStrategy: ConnectorsConnectorAuthStrategy;
  readonly capabilities: readonly ConnectorsConnectorCapabilityFlag[];
  readonly readScopes: readonly string[];
  readonly writeScopes: readonly string[];
  readonly aliases: readonly string[];
  readonly recommendedPersonas: readonly string[];
  readonly entrySurfaces: readonly string[];
  readonly enabledByDefault: boolean;
  readonly recommended: boolean;
}

export interface ConnectorsCatalogSummary {
  readonly total: number;
  readonly available: number;
  readonly planned: number;
  readonly external: number;
  readonly manual: number;
  readonly virtual: number;
}

export interface ConnectorsCatalogResponse {
  readonly generatedAt: string;
  readonly persona: string | null;
  readonly connectors: readonly ConnectorsCatalogItem[];
  readonly summary: ConnectorsCatalogSummary;
}

export interface ConnectorsCatalogDetailResponse {
  readonly generatedAt: string;
  readonly connector: ConnectorsCatalogItem;
}

export const ConnectorsSessionConnectRequestSchema = z.object({
  requestedScopes: z.array(z.string().trim().min(1)).default([]).optional(),
  mode: z.enum(['manual', 'oauth_stub']).optional(),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export const ConnectorsSessionDisconnectRequestSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export const ConnectorsAuthStartRequestSchema = z.object({
  requestedScopes: z.array(z.string().trim().min(1)).default([]).optional(),
  redirectUri: z.string().trim().url().optional(),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export const ConnectorsAuthCompleteRequestSchema = z.object({
  challengeId: z.string().trim().min(1).optional(),
  authorizationCode: z.string().trim().min(1).optional(),
  result: z.enum(['authorized', 'denied', 'failed']).optional(),
  accessToken: z.string().trim().min(1).optional(),
  refreshToken: z.string().trim().min(1).optional(),
  expiresAt: z.string().trim().min(1).optional(),
  refreshExpiresAt: z.string().trim().min(1).optional(),
  errorCode: z.string().trim().min(1).max(120).optional(),
  errorMessage: z.string().trim().min(1).max(300).optional(),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export type ConnectorsSessionConnectRequest = z.infer<typeof ConnectorsSessionConnectRequestSchema>;
export type ConnectorsSessionDisconnectRequest = z.infer<typeof ConnectorsSessionDisconnectRequestSchema>;
export type ConnectorsAuthStartRequest = z.infer<typeof ConnectorsAuthStartRequestSchema>;
export type ConnectorsAuthCompleteRequest = z.infer<typeof ConnectorsAuthCompleteRequestSchema>;

export const ConnectorsSearchRequestSchema = z.object({
  query: z.string().trim().min(1),
  connectorIds: z.array(z.string().trim().min(1)).default([]).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export const ConnectorsReadSourceRequestSchema = z.object({
  connectorId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export type ConnectorsSearchRequest = z.infer<typeof ConnectorsSearchRequestSchema>;
export type ConnectorsReadSourceRequest = z.infer<typeof ConnectorsReadSourceRequestSchema>;

export const ConnectorsTokenRefreshRequestSchema = z.object({
  reason: z.string().trim().min(1).max(120).optional(),
  scope: ConnectorsRuntimeScopeSchema.optional(),
});

export type ConnectorsTokenRefreshRequest = z.infer<typeof ConnectorsTokenRefreshRequestSchema>;

export type ConnectorsSessionStatus = 'connected' | 'pending' | 'needs_reauth' | 'disconnected';
export type ConnectorsSessionMode = 'manual' | 'oauth_stub';

export interface ConnectorsSessionRecord {
  readonly sessionId: string;
  readonly connectorId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly userRole: string | null;
  readonly status: ConnectorsSessionStatus;
  readonly mode: ConnectorsSessionMode;
  readonly availability: ConnectorsConnectorAvailability;
  readonly readScopes: readonly string[];
  readonly writeScopes: readonly string[];
  readonly requestedScopes: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastConnectedAt: string | null;
  readonly lastDisconnectedAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorMessage: string | null;
  readonly tokenStatus: 'missing' | 'stored' | 'revoked';
  readonly tokenExpiresAt: string | null;
  readonly tokenLastRotatedAt: string | null;
  readonly connector: ConnectorsCatalogItem;
}

export interface ConnectorsSessionListResponse {
  readonly generatedAt: string;
  readonly sessions: readonly ConnectorsSessionRecord[];
  readonly summary: {
    readonly total: number;
    readonly connected: number;
    readonly pending: number;
    readonly needsReauth: number;
    readonly disconnected: number;
  };
}

export interface ConnectorsSessionMutationResponse {
  readonly generatedAt: string;
  readonly session: ConnectorsSessionRecord;
}

export type ConnectorsAuthChallengeStatus = 'pending' | 'completed' | 'denied' | 'failed' | 'expired';

export interface ConnectorsAuthChallenge {
  readonly challengeId: string;
  readonly connectorId: string;
  readonly sessionId: string;
  readonly authStrategy: ConnectorsConnectorAuthStrategy;
  readonly status: ConnectorsAuthChallengeStatus;
  readonly state: string;
  readonly authorizeUrl: string;
  readonly redirectUri: string | null;
  readonly requestedScopes: readonly string[];
  readonly pkceRequired: boolean;
  readonly expiresAt: string;
  readonly completedAt: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

export interface ConnectorsAuthStartResponse {
  readonly generatedAt: string;
  readonly challenge: ConnectorsAuthChallenge;
  readonly session: ConnectorsSessionRecord;
}

export interface ConnectorsAuthCompleteResponse {
  readonly generatedAt: string;
  readonly challenge: ConnectorsAuthChallenge;
  readonly session: ConnectorsSessionRecord;
}

export interface ConnectorsSourceRef {
  readonly sourceId: string;
  readonly connectorId: string;
  readonly vendorType: string;
  readonly vendorId: string;
  readonly title: string;
  readonly uri: string;
  readonly snippet: string;
  readonly mimeType: string;
  readonly lastModifiedAt: string;
  readonly freshnessAt: string;
  readonly aclFingerprint: string;
  readonly accessConfidence: 'high' | 'medium' | 'low';
}

export interface ConnectorsSearchDiagnostic {
  readonly connectorId: string;
  readonly status:
    | 'searched'
    | 'skipped'
    | 'not_supported'
    | 'needs_connection'
    | 'needs_reauth'
    | 'not_implemented';
  readonly reason: string | null;
}

export interface ConnectorsSearchResponse {
  readonly generatedAt: string;
  readonly query: string;
  readonly sources: readonly ConnectorsSourceRef[];
  readonly diagnostics: readonly ConnectorsSearchDiagnostic[];
}

export interface ConnectorsReadSourceResponse {
  readonly generatedAt: string;
  readonly source: ConnectorsSourceRef;
  readonly content: string;
}

export interface ConnectorsTokenRefreshResponse {
  readonly generatedAt: string;
  readonly session: ConnectorsSessionRecord;
  readonly tokenStatus: 'stored' | 'revoked';
  readonly tokenExpiresAt: string | null;
  readonly tokenLastRotatedAt: string | null;
}

