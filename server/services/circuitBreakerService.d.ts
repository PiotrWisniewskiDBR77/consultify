export namespace STATES {
    let CLOSED: string;
    let OPEN: string;
    let HALF_OPEN: string;
}
/**
 * Circuit Breaker Class
 */
export class CircuitBreaker {
    constructor(name: any, options?: {});
    name: any;
    config: {
        failureThreshold: number;
        successThreshold: number;
        resetTimeout: number;
        retryAttempts: number;
        retryBaseDelay: number;
        retryMaxDelay: number;
        persistenceEnabled: boolean;
    };
    state: string;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
    openedAt: number | null;
    nextAttemptTime: number | null;
    lastError: any;
    totalFailures: number;
    totalSuccesses: number;
    /**
     * Check if circuit allows request
     */
    canExecute(): {
        allowed: boolean;
        state: string;
        reason?: undefined;
    } | {
        allowed: boolean;
        state: string;
        reason: string;
    };
    /**
     * Execute a function within the circuit breaker with optional retry
     */
    execute(fn: any, options?: {}): Promise<any>;
    /**
     * Record a successful request
     */
    recordSuccess(): Promise<void>;
    /**
     * Record a failed request
     */
    recordFailure(error: any): Promise<void>;
    /**
     * Reset circuit to closed state (admin function)
     */
    reset(): Promise<void>;
    /**
     * Get status information
     */
    getStatus(): {
        name: any;
        state: string;
        failures: number;
        successes: number;
        threshold: number;
        lastFailureTime: string | null;
        lastSuccessTime: string | null;
        nextAttemptTime: string | null;
        openedAt: string | null;
        cooldownRemaining: number | null;
        isFailing: boolean;
        lastError: any;
        totalStats: {
            successes: number;
            failures: number;
        };
    };
    /**
     * Determine if an error should trip the breaker
     */
    _isSystemFailure(error: any): boolean;
    /**
     * Determine if an error is retriable
     */
    _isRetriable(error: any): boolean;
    /**
     * Persist state to database
     */
    _persistState(): Promise<void>;
}
/**
 * Extended Circuit Breaker with Auto-Recovery
 */
export class EnhancedCircuitBreaker extends CircuitBreaker {
    healthCheckFn: any;
    recoveryPercent: number;
    consecutiveHealthChecks: number;
    isRecovering: boolean;
    /**
     * Start health check probes when entering HALF_OPEN
     */
    startHealthChecks(): void;
    /**
     * Stop health checks
     */
    stopHealthChecks(): void;
    /**
     * Begin gradual traffic recovery
     */
    beginGradualRecovery(): void;
    /**
     * Complete the recovery process
     */
    completeRecovery(): void;
    /**
     * Check if request should be allowed during recovery
     */
    shouldAllowDuringRecovery(): boolean;
    /**
     * Get extended status with recovery info
     */
    getStatus(): {
        recoveryPercent: number;
        isRecovering: boolean;
        consecutiveHealthChecks: number;
        healthCheckActive: boolean;
        name: any;
        state: string;
        failures: number;
        successes: number;
        threshold: number;
        lastFailureTime: string | null;
        lastSuccessTime: string | null;
        nextAttemptTime: string | null;
        openedAt: string | null;
        cooldownRemaining: number | null;
        isFailing: boolean;
        lastError: any;
        totalStats: {
            successes: number;
            failures: number;
        };
    };
}
export namespace CircuitBreakerService {
    export { STATES };
    export function getBreaker(name: any, options?: {}): any;
    export function execute(name: any, fn: any, options?: {}): Promise<any>;
    export function canExecute(name: any): any;
    export function recordSuccess(name: any): Promise<void>;
    export function recordFailure(name: any, error: any): Promise<void>;
    export function reset(name: any): Promise<void>;
    export function getStatus(name: any): any;
    export function getAllStatuses(): any[];
    export function restoreStates(): Promise<void>;
    export function getFallbackProvider(primaryProvider: any): string | null;
    export function executeWithRotation(primaryProvider: any, createFn: any, options?: {}): Promise<{
        result: any;
        provider: any;
    }>;
    export function setHealthCheck(name: any, healthCheckFn: any): void;
    export function getRecoveryStatuses(): {
        name: any;
        recoveryPercent: any;
        consecutiveHealthChecks: any;
    }[];
    export function forceRecovery(name: any): boolean;
    export function cleanup(): void;
}
export default CircuitBreakerService;
//# sourceMappingURL=circuitBreakerService.d.ts.map