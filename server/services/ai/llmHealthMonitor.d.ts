declare namespace _default {
    export { llmHealthMonitor };
    export { LLMHealthMonitor };
    export { HealthStatus };
    export { ErrorCategory };
    export { ErrorMessages };
}
export default _default;
export const llmHealthMonitor: LLMHealthMonitor;
export class LLMHealthMonitor {
    healthCache: Map<any, any>;
    lastCheckTime: string | null;
    checkInterval: number;
    listeners: any[];
    onHealthChange(callback: any): void;
    notifyListeners(provider: any, oldStatus: any, newStatus: any): void;
    categorizeError(provider: any, statusCode: any, responseBody: any): string;
    tryParseJSON(str: any): any;
    testProvider(providerConfig: any): Promise<{
        provider: any;
        providerId: any;
        status: string;
        errorCategory: null;
        error: null;
        rawError: null;
        responseTime: number;
        lastCheck: string;
        modelInfo: any;
        statusCode?: undefined;
    } | {
        provider: any;
        providerId: any;
        status: string;
        errorCategory: string;
        error: {
            title: string;
            description: string;
            action: string;
        };
        rawError: any;
        statusCode: any;
        responseTime: number;
        lastCheck: string;
        modelInfo?: undefined;
    } | {
        provider: any;
        providerId: any;
        status: string;
        errorCategory: string;
        error: {
            title: string;
            description: string;
            action: string;
        };
        rawError: any;
        responseTime: number;
        lastCheck: string;
        modelInfo?: undefined;
        statusCode?: undefined;
    }>;
    makeTestRequest(provider: any, apiKey: any, modelId: any): Promise<any>;
    checkAllProviders(providers: any): Promise<({
        id: any;
        provider: any;
        providerId: any;
        status: string;
        errorCategory: null;
        error: null;
        rawError: null;
        responseTime: number;
        lastCheck: string;
        modelInfo: any;
        statusCode?: undefined;
    } | {
        id: any;
        provider: any;
        providerId: any;
        status: string;
        errorCategory: string;
        error: {
            title: string;
            description: string;
            action: string;
        };
        rawError: any;
        statusCode: any;
        responseTime: number;
        lastCheck: string;
        modelInfo?: undefined;
    } | {
        id: any;
        provider: any;
        providerId: any;
        status: string;
        errorCategory: string;
        error: {
            title: string;
            description: string;
            action: string;
        };
        rawError: any;
        responseTime: number;
        lastCheck: string;
        modelInfo?: undefined;
        statusCode?: undefined;
    })[]>;
    getCachedStatus(providerId: any): any;
    getAllCachedStatuses(): any[];
    getSummary(): {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
        lastCheck: string | null;
    };
}
export namespace HealthStatus {
    let HEALTHY: string;
    let DEGRADED: string;
    let UNHEALTHY: string;
    let UNKNOWN: string;
}
export namespace ErrorCategory {
    export let AUTH_INVALID: string;
    export let AUTH_EXPIRED: string;
    export let QUOTA_EXCEEDED: string;
    export let RATE_LIMITED: string;
    export let INSUFFICIENT_FUNDS: string;
    export let MODEL_DEPRECATED: string;
    export let MODEL_NOT_FOUND: string;
    export let SERVICE_DOWN: string;
    export let TIMEOUT: string;
    export let NETWORK_ERROR: string;
    let UNKNOWN_1: string;
    export { UNKNOWN_1 as UNKNOWN };
}
export const ErrorMessages: {
    [ErrorCategory.AUTH_INVALID]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.AUTH_EXPIRED]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.QUOTA_EXCEEDED]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.RATE_LIMITED]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.INSUFFICIENT_FUNDS]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.MODEL_DEPRECATED]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.MODEL_NOT_FOUND]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.SERVICE_DOWN]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.TIMEOUT]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.NETWORK_ERROR]: {
        title: string;
        description: string;
        action: string;
    };
    [ErrorCategory.UNKNOWN]: {
        title: string;
        description: string;
        action: string;
    };
};
//# sourceMappingURL=llmHealthMonitor.d.ts.map