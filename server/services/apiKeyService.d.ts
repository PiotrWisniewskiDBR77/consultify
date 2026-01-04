/**
 * API Key Service
 *
 * Manages API keys for M2M integration:
 * - Key generation and validation
 * - Scope-based permissions
 * - Rate limiting
 * - Usage tracking
 */
declare module 'bcrypt' {
    function hash(data: string, saltRounds: number): Promise<string>;
    function compare(data: string, encrypted: string): Promise<boolean>;
}
export interface ApiKeyScopes {
    'read:users': string;
    'write:users': string;
    'delete:users': string;
    'read:organizations': string;
    'write:organizations': string;
    'read:projects': string;
    'write:projects': string;
    'delete:projects': string;
    'read:assessments': string;
    'write:assessments': string;
    'read:initiatives': string;
    'write:initiatives': string;
    'read:tasks': string;
    'write:tasks': string;
    'read:reports': string;
    'export:reports': string;
    'use:ai': string;
    'read:ai_usage': string;
    'admin:billing': string;
    'admin:audit': string;
    'admin:settings': string;
    'manage:webhooks': string;
}
export interface CreateApiKeyData {
    organizationId: string;
    userId?: string | null;
    name: string;
    description?: string;
    scopes?: string[];
    keyType?: 'org' | 'user' | 'service';
    rateLimitPerMinute?: number;
    rateLimitPerDay?: number;
    allowedIps?: string[];
    expiresAt?: string | null;
    createdBy: string;
}
export interface ApiKeyResult {
    id: string;
    key: string;
    keyPrefix: string;
    name: string;
    scopes: string[];
    expiresAt: string | null;
}
export interface ValidatedApiKey {
    id: string;
    organizationId: string;
    userId: string | null;
    name: string;
    keyType: string;
    scopes: string[];
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
    allowedIps: string[];
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
    key?: ValidatedApiKey;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining?: number;
    retryAfter?: number;
}
export interface UsageLogData {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent?: string;
    requestsRemaining: number;
    errorCode?: string;
    errorMessage?: string;
}
export interface GetKeysOptions {
    userId?: string;
    includeRevoked?: boolean;
}
export interface ApiKeyRecord {
    id: string;
    organization_id: string;
    user_id: string | null;
    name: string;
    description: string;
    key_prefix: string;
    key_type: string;
    scopes: string[];
    rate_limit_per_minute: number;
    rate_limit_per_day: number;
    allowed_ips: string[];
    last_used_at: string;
    usage_count: number;
    expires_at: string;
    is_active: number;
    created_at: string;
    isActive: boolean;
}
export interface UsageStatistics {
    usage: Array<{
        date: string;
        requests: number;
        avg_response_time: number;
        successful: number;
        failed: number;
    }>;
    totals: {
        total_requests: number;
        avg_response_time: number;
        total_errors: number;
    };
    endpoints: Array<{
        endpoint: string;
        method: string;
        count: number;
    }>;
}
export interface UpdateApiKeyData {
    name?: string;
    description?: string;
    scopes?: string[];
    rateLimitPerMinute?: number;
    rateLimitPerDay?: number;
    allowedIps?: string[];
    expiresAt?: string;
}
export interface ApiKeyServiceInterface {
    getAvailableScopes: () => ApiKeyScopes;
    createKey: (data: CreateApiKeyData) => Promise<ApiKeyResult>;
    validateKey: (plainKey: string) => Promise<ValidationResult>;
    hasScope: (key: ValidatedApiKey, requiredScope: string) => boolean;
    checkRateLimit: (keyId: string, type?: 'minute' | 'day') => Promise<RateLimitResult>;
    logUsage: (keyId: string, data: UsageLogData) => Promise<void>;
    getKeys: (organizationId: string, options?: GetKeysOptions) => Promise<ApiKeyRecord[]>;
    getKeyUsage: (keyId: string, days?: number) => Promise<UsageStatistics>;
    updateKey: (keyId: string, updates: UpdateApiKeyData, updatedBy: string) => Promise<{
        success: boolean;
        message?: string;
    }>;
    revokeKey: (keyId: string, revokedBy: string, reason?: string | null) => Promise<{
        success: boolean;
    }>;
    regenerateKey: (keyId: string, regeneratedBy: string) => Promise<ApiKeyResult>;
}
declare const ApiKeyService: ApiKeyServiceInterface;
export default ApiKeyService;
//# sourceMappingURL=apiKeyService.d.ts.map