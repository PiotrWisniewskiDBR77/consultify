declare namespace _default {
    export { AIHealthMonitor };
    export { healthMonitor };
    export { providerStatus };
}
export default _default;
export class AIHealthMonitor {
    isRunning: boolean;
    checkInterval: NodeJS.Timeout | null;
    lastCheck: {
        timestamp: string;
        duration: number;
        overall: string;
        checks: never[];
        repairs: never[];
        alerts: never[];
    } | null;
    consecutiveFailures: number;
    repairAttempts: Map<any, any>;
    listeners: any[];
    _initialized: boolean;
    ensureInitialized(): Promise<void>;
    /**
     * Start periodic health monitoring
     */
    start(intervalMs?: number): Promise<void>;
    /**
     * Stop health monitoring
     */
    stop(): void;
    /**
     * Run full diagnostics
     */
    runDiagnostics(): Promise<{
        timestamp: string;
        duration: number;
        overall: string;
        checks: never[];
        repairs: never[];
        alerts: never[];
    }>;
    _lastAlertTime: {} | undefined;
    /**
     * Check database connectivity
     */
    checkDatabase(): Promise<{
        name: string;
        healthy: boolean;
        canRepair: boolean;
        message: string;
        duration: number;
    }>;
    /**
     * Check if required tables exist
     */
    checkRequiredTables(): Promise<{
        name: string;
        healthy: boolean;
        canRepair: boolean;
        missingTables: never[];
        message: string;
        duration: number;
    }>;
    /**
     * Check LLM provider availability (basic connectivity)
     */
    checkLLMProviders(): Promise<{
        name: string;
        healthy: boolean;
        canRepair: boolean;
        providers: {};
        message: string;
        duration: number;
    }>;
    /**
     * Get environment variable key for provider
     */
    getProviderEnvKey(provider: any): any;
    /**
     * Check system resources
     */
    checkResources(): Promise<{
        name: string;
        healthy: boolean;
        canRepair: boolean;
        message: string;
        duration: number;
    }>;
    /**
     * Attempt to repair a failed check
     */
    attemptRepair(check: any): Promise<{
        check: any;
        success: boolean;
        action: null;
        message: string;
    }>;
    /**
     * Create missing tables
     */
    repairMissingTables(missingTables: any): Promise<void>;
    /**
     * Register alert listener
     */
    onAlert(callback: any): void;
    /**
     * Notify all listeners of an alert
     */
    notifyListeners(alert: any): void;
    /**
     * Get current health status
     */
    getStatus(): {
        isRunning: boolean;
        lastCheck: {
            timestamp: string;
            duration: number;
            overall: string;
            checks: never[];
            repairs: never[];
            alerts: never[];
        } | null;
        consecutiveFailures: number;
        providers: {
            openai: {
                healthy: boolean;
                failures: number;
                lastCheck: null;
                lastError: null;
            };
            anthropic: {
                healthy: boolean;
                failures: number;
                lastCheck: null;
                lastError: null;
            };
            google: {
                healthy: boolean;
                failures: number;
                lastCheck: null;
                lastError: null;
            };
            deepseek: {
                healthy: boolean;
                failures: number;
                lastCheck: null;
                lastError: null;
            };
            ollama: {
                healthy: boolean;
                failures: number;
                lastCheck: null;
                lastError: null;
            };
        };
    };
    /**
     * Get provider status
     */
    getProviderStatus(providerName: any): any;
    /**
     * Mark provider as failed (called by LLM service on error)
     */
    markProviderFailed(providerName: any, error: any): Promise<void>;
    /**
     * Mark provider as healthy (called by LLM service on success)
     */
    markProviderHealthy(providerName: any): void;
    /**
     * Get best available provider
     */
    getBestProvider(): string | null;
}
export const healthMonitor: AIHealthMonitor;
export namespace providerStatus {
    namespace openai {
        let healthy: boolean;
        let failures: number;
        let lastCheck: null;
        let lastError: null;
    }
    namespace anthropic {
        let healthy_1: boolean;
        export { healthy_1 as healthy };
        let failures_1: number;
        export { failures_1 as failures };
        let lastCheck_1: null;
        export { lastCheck_1 as lastCheck };
        let lastError_1: null;
        export { lastError_1 as lastError };
    }
    namespace google {
        let healthy_2: boolean;
        export { healthy_2 as healthy };
        let failures_2: number;
        export { failures_2 as failures };
        let lastCheck_2: null;
        export { lastCheck_2 as lastCheck };
        let lastError_2: null;
        export { lastError_2 as lastError };
    }
    namespace deepseek {
        let healthy_3: boolean;
        export { healthy_3 as healthy };
        let failures_3: number;
        export { failures_3 as failures };
        let lastCheck_3: null;
        export { lastCheck_3 as lastCheck };
        let lastError_3: null;
        export { lastError_3 as lastError };
    }
    namespace ollama {
        let healthy_4: boolean;
        export { healthy_4 as healthy };
        let failures_4: number;
        export { failures_4 as failures };
        let lastCheck_4: null;
        export { lastCheck_4 as lastCheck };
        let lastError_4: null;
        export { lastError_4 as lastError };
    }
}
//# sourceMappingURL=healthMonitor.d.ts.map