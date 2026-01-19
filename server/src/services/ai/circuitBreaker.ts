/**
 * Circuit Breaker for LLM Providers
 *
 * Backward-compatible API over CircuitBreakerService.
 */

import logger from '../../utils/Logger.js';
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
  persistenceEnabled: true,
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
    ...options,
  });
  return breaker.execute(fn, options);
}

export async function initialize(): Promise<void> {
  try {
    // Wait for database to be initialized before restoring states
    // Import here to avoid circular dependency
    const { getDatabaseAsync } = await import('../../database/Database.js');
    try {
      await getDatabaseAsync();
    } catch (dbError) {
      // Database might not be ready yet, wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await getDatabaseAsync();
    }

    await CircuitBreakerService.restoreStates();
    aiLogger.info('CircuitBreaker', 'LLM circuit breakers initialized');
  } catch (error: unknown) {
    const err = error as Error;
    // Don't log as error if it's just a database initialization issue
    if (err.message.includes('Database not initialized')) {
      aiLogger.debug('CircuitBreaker', 'Database not ready yet, will retry later');
    } else {
      aiLogger.warn('CircuitBreaker', `Initialization warning: ${err.message}`);
    }
  }
}

// Delay initialization to allow database to initialize first
setTimeout(() => {
  initialize().catch((error) => {
    const err = error as Error;
    logger.warn('[CircuitBreaker] Auto-init failed:', err.message);
  });
}, 3000); // Wait 3 seconds for database initialization

export default {
  STATE,
  canExecute,
  recordSuccess,
  recordFailure,
  reset,
  getStatus,
  execute,
  initialize,
  CircuitBreakerService,
};
