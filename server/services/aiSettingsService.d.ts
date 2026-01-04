export class AISettingsService extends BaseService {
    getSuperAdminSettings(): Promise<{
        id: any;
        defaultProvider: any;
        fallbackChain: any;
        circuitBreakerConfig: any;
        globalTokenLimit: any;
        globalRateLimit: any;
        maxContextWindowSize: any;
        maxTokensPerRequest: any;
        piiDetectionSensitivity: any;
        requireEncryption: boolean;
        dataResidency: any;
        createdAt: any;
        updatedAt: any;
        updatedBy: any;
    } | null>;
    updateSuperAdminSettings(settings: any, actorId: any, actorRole: any, ipAddress?: null, userAgent?: null): Promise<{
        id: any;
        defaultProvider: any;
        fallbackChain: any;
        circuitBreakerConfig: any;
        globalTokenLimit: any;
        globalRateLimit: any;
        maxContextWindowSize: any;
        maxTokensPerRequest: any;
        piiDetectionSensitivity: any;
        requireEncryption: boolean;
        dataResidency: any;
        createdAt: any;
        updatedAt: any;
        updatedBy: any;
    } | null>;
    getOrgSettings(organizationId: any): Promise<{
        organizationId: any;
        policyLevel?: any;
        maxPolicyLevel?: any;
        defaultProactivityMode?: any;
        activeRoles?: any;
        defaultRole?: any;
        enabledModelIds?: any;
        maxAICallsPerDay?: any;
        maxTokensPerMonth?: any;
        monthlyBudgetUSD?: any;
        hardLimitUSD?: any;
        freezeOnLimit?: boolean | undefined;
        webSearchEnabled?: boolean | undefined;
        artifactsEnabled?: boolean | undefined;
        thinkingStepsEnabled?: boolean | undefined;
        focusModesEnabled?: boolean | undefined;
        voiceEnabled?: boolean | undefined;
        auditAllRequests?: boolean | undefined;
        auditPolicyChanges?: boolean | undefined;
        createdAt?: any;
        updatedAt?: any;
        updatedBy?: any;
    } | null>;
    updateOrgSettings(organizationId: any, settings: any, actorId: any, actorRole: any, ipAddress?: null, userAgent?: null): Promise<{
        organizationId: any;
        policyLevel?: any;
        maxPolicyLevel?: any;
        defaultProactivityMode?: any;
        activeRoles?: any;
        defaultRole?: any;
        enabledModelIds?: any;
        maxAICallsPerDay?: any;
        maxTokensPerMonth?: any;
        monthlyBudgetUSD?: any;
        hardLimitUSD?: any;
        freezeOnLimit?: boolean | undefined;
        webSearchEnabled?: boolean | undefined;
        artifactsEnabled?: boolean | undefined;
        thinkingStepsEnabled?: boolean | undefined;
        focusModesEnabled?: boolean | undefined;
        voiceEnabled?: boolean | undefined;
        auditAllRequests?: boolean | undefined;
        auditPolicyChanges?: boolean | undefined;
        createdAt?: any;
        updatedAt?: any;
        updatedBy?: any;
    } | null>;
    getUserSettings(userId: any): Promise<{
        userId: any;
        responseStyle?: any;
        writingTone?: any;
        preferredLanguage?: any;
        codeExplanations?: boolean | undefined;
        showSources?: boolean | undefined;
        proactivityMode?: any;
        modelTemperature?: any;
        maxTokens?: any;
        topP?: any;
        frequencyPenalty?: any;
        presencePenalty?: any;
        systemInstructions?: any;
        visibleModelIds?: any;
        selectedTier?: any;
        preferredModelId?: any;
        enablePiiRedaction?: boolean | undefined;
        dataRetentionPolicy?: any;
        shareUsageAnalytics?: boolean | undefined;
        contextRetention?: any;
        autoSuggestions?: boolean | undefined;
        createdAt?: any;
        updatedAt?: any;
    } | null>;
    updateUserSettings(userId: any, settings: any): Promise<{
        userId: any;
        responseStyle?: any;
        writingTone?: any;
        preferredLanguage?: any;
        codeExplanations?: boolean | undefined;
        showSources?: boolean | undefined;
        proactivityMode?: any;
        modelTemperature?: any;
        maxTokens?: any;
        topP?: any;
        frequencyPenalty?: any;
        presencePenalty?: any;
        systemInstructions?: any;
        visibleModelIds?: any;
        selectedTier?: any;
        preferredModelId?: any;
        enablePiiRedaction?: boolean | undefined;
        dataRetentionPolicy?: any;
        shareUsageAnalytics?: boolean | undefined;
        contextRetention?: any;
        autoSuggestions?: boolean | undefined;
        createdAt?: any;
        updatedAt?: any;
    } | null>;
    getEffectiveSettings(userId: any, organizationId: any): Promise<{
        policyLevel: any;
        proactivityMode: string;
        proactivityBehavior: any;
        responseStyle: any;
        writingTone: any;
        preferredLanguage: any;
        modelTemperature: any;
        maxTokens: number;
        topP: any;
        frequencyPenalty: any;
        presencePenalty: any;
        systemInstructions: any;
        preferredModelId: any;
        selectedTier: any;
        availableModelIds: any;
        webSearchEnabled: boolean | undefined;
        artifactsEnabled: boolean | undefined;
        thinkingStepsEnabled: boolean | undefined;
        focusModesEnabled: boolean | undefined;
        voiceEnabled: boolean | undefined;
        enablePiiRedaction: boolean | undefined;
        dataRetentionPolicy: any;
        maxAICallsPerDay: any;
        maxTokensPerMonth: any;
        _sources: {
            superadmin: {
                id: any;
                updatedAt: any;
            };
            org: {
                organizationId: any;
                updatedAt: any;
            };
            user: {
                userId: any;
                updatedAt: any;
            };
        };
    }>;
    logAudit({ level, actorId, actorRole, targetId, settingKey, oldValue, newValue, ipAddress, userAgent }: {
        level: any;
        actorId: any;
        actorRole: any;
        targetId: any;
        settingKey: any;
        oldValue: any;
        newValue: any;
        ipAddress: any;
        userAgent: any;
    }): Promise<{
        id: string;
    }>;
    getAuditLog({ level, targetId, actorId, limit, offset }?: {
        limit?: number | undefined;
        offset?: number | undefined;
    }): Promise<any>;
    getAvailableModels(userId: any, organizationId: any): Promise<any>;
    getUserCostHistory(userId: any, period?: string): Promise<{
        period: string;
        totalCost: number;
        totalRequests: number;
        totalTokens: number;
        avgCostPerRequest: number;
        byTier: any[];
        daily: any;
    }>;
    getOrgUserTiers(organizationId: any): Promise<any>;
    assignUserTier(organizationId: any, userId: any, tier: any): Promise<{
        userId: any;
        tier: any;
        success: boolean;
    }>;
    getOrgCostAttribution(organizationId: any, period?: string): Promise<{
        period: string;
        totalCost: number;
        avgCostPerRequest: number;
        totalRequests: number;
        totalTokens: number;
        attribution: any;
    }>;
    generateComplianceReport(organizationId: any, standard: any, format?: string): Promise<{
        id: string;
        organizationId: any;
        standard: any;
        generatedAt: string;
        status: string;
        summary: {
            total: any;
            compliant: any;
            partial: any;
            nonCompliant: any;
            score: number;
        };
        checks: any;
        findings: any;
        auditSummary: {
            totalChanges: any;
            lastChange: any;
        };
    } | {
        data: string;
        id: string;
        organizationId: any;
        standard: any;
        generatedAt: string;
        status: string;
        summary: {
            total: any;
            compliant: any;
            partial: any;
            nonCompliant: any;
            score: number;
        };
        checks: any;
        findings: any;
        auditSummary: {
            totalChanges: any;
            lastChange: any;
        };
    } | {
        data: Buffer<ArrayBuffer>;
        id: string;
        organizationId: any;
        standard: any;
        generatedAt: string;
        status: string;
        summary: {
            total: any;
            compliant: any;
            partial: any;
            nonCompliant: any;
            score: number;
        };
        checks: any;
        findings: any;
        auditSummary: {
            totalChanges: any;
            lastChange: any;
        };
    }>;
}
export default aiSettingsService;
import BaseService from './BaseService.js';
declare const aiSettingsService: AISettingsService;
//# sourceMappingURL=aiSettingsService.d.ts.map