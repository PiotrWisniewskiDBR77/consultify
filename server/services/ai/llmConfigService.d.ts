export const llmConfigService: LLMConfigService;
export default llmConfigService;
declare class LLMConfigService extends BaseService {
    providerCache: Map<any, any>;
    cacheExpiry: number;
    cacheTTL: number;
    healthStatus: Map<any, any>;
    initialized: boolean;
    /**
     * Initialize the service - should be called on server startup
     */
    initialize(): Promise<void>;
    /**
     * Ensure llm_providers and organization_llm_settings tables exist
     */
    ensureTableExists(): Promise<void>;
    /**
     * Migrate table to add new columns
     */
    migrateTable(): Promise<void>;
    /**
     * Get API key from environment, checking all aliases
     * @param {string} providerId - Provider identifier
     * @returns {string|null} API key or null
     */
    getApiKeyFromEnv(providerId: string): string | null;
    /**
     * Sync database providers with environment variables and code definitions
     * Enforces active/inactive state based on env vars
     */
    syncDatabaseWithEnv(): Promise<void>;
    /**
     * Clear the provider cache
     */
    clearCache(): void;
    /**
     * Update a provider's tier
     * @param {string} providerId
     * @param {string} tier
     */
    updateProviderTier(providerId: string, tier: string): Promise<boolean>;
    /**
     * Get provider from database by provider type
     */
    getProviderFromDb(providerId: any): Promise<any>;
    /**
     * Get provider by ID from database
     */
    getProviderById(id: any): Promise<any>;
    /**
     * Update provider in database
     */
    updateProviderInDb(providerId: any, updates: any): Promise<any>;
    /**
     * Create provider in database
     */
    createProviderInDb(provider: any): Promise<any>;
    /**
     * Get providers for a specific organization (including enabled/disabled status)
     */
    getOrganizationProviders(organizationId: any): Promise<any[]>;
    /**
     * Toggle provider enabled status for an organization
     */
    toggleOrganizationProvider(organizationId: any, providerId: any, isEnabled: any): Promise<{
        success: boolean;
    }>;
    /**
     * Get all active providers from database
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Array>} Array of provider configurations
     */
    getAllProviders(useCache?: boolean): Promise<any[]>;
    /**
     * Get provider configuration by provider type
     * @param {string} providerId - Provider identifier (e.g., 'openai', 'google')
     * @returns {Promise<Object|null>} Provider configuration or null
     */
    getProviderConfig(providerId: string): Promise<Object | null>;
    /**
     * Get default provider
     * @returns {Promise<Object|null>} Default provider configuration
     */
    getDefaultProvider(): Promise<Object | null>;
    /**
     * Enrich database row with provider definitions
     */
    enrichProviderConfig(dbRow: any): any;
    /**
     * Get fallback chain for a tier
     * @param {string} tier - Tier level (BUDGET, STANDARD, PREMIUM, REASONING)
     * @returns {Promise<Array>} Ordered array of provider IDs
     */
    getFallbackChain(tier?: string): Promise<any[]>;
    /**
     * Get next fallback provider
     * @param {Array} excludeProviders - Providers to exclude (already tried)
     * @param {string} tier - Requested tier
     * @returns {Promise<Object|null>} Next provider to try
     */
    getNextFallback(excludeProviders?: any[], tier?: string): Promise<Object | null>;
}
import BaseService from '../BaseService.js';
//# sourceMappingURL=llmConfigService.d.ts.map