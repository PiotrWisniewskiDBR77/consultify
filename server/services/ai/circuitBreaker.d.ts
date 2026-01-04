/**
 * Check if circuit allows request (legacy API)
 */
export function canExecute(providerId: any): any;
/**
 * Record a successful request (legacy API)
 */
export function recordSuccess(providerId: any): Promise<void>;
/**
 * Record a failed request (legacy API)
 */
export function recordFailure(providerId: any, error: any): Promise<void>;
/**
 * Reset circuit to closed state (legacy API)
 */
export function reset(providerId: any): Promise<void>;
/**
 * Get status of all circuits (legacy API)
 */
export function getStatus(): any;
/**
 * Execute function with circuit breaker and retry logic (legacy API)
 */
export function execute(providerId: any, fn: any, options?: {}): Promise<any>;
/**
 * Initialize circuit breaker - restore states from database
 */
export function initialize(): Promise<void>;
export const STATE: {
    CLOSED: string;
    OPEN: string;
    HALF_OPEN: string;
};
declare namespace _default {
    export { STATE };
    export { canExecute };
    export { recordSuccess };
    export { recordFailure };
    export { reset };
    export { getStatus };
    export { execute };
    export { initialize };
    export { CircuitBreakerService };
}
export default _default;
import { CircuitBreakerService } from '../circuitBreakerService.js';
export { CircuitBreakerService };
//# sourceMappingURL=circuitBreaker.d.ts.map