/**
 * Circuit Breaker for LLM Providers
 *
 * Backward-compatible API over CircuitBreakerService.
 */

import CircuitBreakerService, { STATES } from '../circuitBreakerService.js';
import { aiLogger } from './logger.js';

export const STATE = STATES;

const LLM_CONFIG = {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeout: 60000,
    retryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    persistenceEnabled: true
};

export function canExecute(providerId: string) {
    const breaker = CircuitBreakerService.getBreaker(providerId, LLM_CONFIG);
    return breaker.canExecute();
}

export async function recordSuccess(providerId: string): Promise<void> {
    await CircuitBreakerService.recordSuccess(providerId);
}

export async function recordFailure(providerId: string, error: Error): Promise<void> {
    await CircuitBreakerService.recordFailure(providerId, error);
}

export async function reset(providerId: string): Promise<void> {
    await CircuitBreakerService.reset(providerId);
}

export function getStatus(): Record<string, unknown> {
    return CircuitBreakerService.getAllStatuses().reduce<Record<string, unknown>>((acc, status) => {
        acc[status.name] = status;
        return acc;
    }, {});
}

export async function execute<T>(
    providerId: string,
    fn: () => Promise<T>,
    options: Record<string, unknown> = {}
): Promise<T> {
    const breaker = CircuitBreakerService.getBreaker(providerId, {
        ...LLM_CONFIG,
        ...options
    });
    return breaker.execute(fn, options);
}

export async function initialize(): Promise<void> {
    try {
        await CircuitBreakerService.restoreStates();
        aiLogger.info('CircuitBreaker', 'LLM circuit breakers initialized');
    } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('CircuitBreaker', `Initialization warning: ${err.message}`);
    }
}

setImmediate(() => {
    initialize().catch(error => {
        const err = error as Error;
        console.warn('[CircuitBreaker] Auto-init failed:', err.message);
    });
});

export default {
    STATE,
    canExecute,
    recordSuccess,
    recordFailure,
    reset,
    getStatus,
    execute,
    initialize,
    CircuitBreakerService
};
