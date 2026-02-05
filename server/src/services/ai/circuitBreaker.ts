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
  initialize()
    .then(() => {
      // GAP-AI-004: Register health check probes for each LLM provider
      registerProviderHealthChecks();
    })
    .catch((error) => {
      const err = error as Error;
      logger.warn('[CircuitBreaker] Auto-init failed:', err.message);
    });
}, 3000); // Wait 3 seconds for database initialization

/**
 * GAP-AI-004: Register lightweight health check functions for LLM providers.
 * These are used by the circuit breaker's auto-recovery probes to verify
 * that a provider is reachable before transitioning from OPEN → HALF_OPEN.
 */
function registerProviderHealthChecks(): void {
  // OpenAI health probe: list models (fast, ~200ms)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim().length > 0) {
    CircuitBreakerService.setHealthCheck('openai', async () => {
      const res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`OpenAI health check failed: ${res.status}`);
    });
    aiLogger.info('CircuitBreaker', 'Health check registered for [openai]');
  }

  // Google/Gemini health probe: list models
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0) {
    CircuitBreakerService.setHealthCheck('google', async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`,
        { method: 'GET', signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Gemini health check failed: ${res.status}`);
    });
    aiLogger.info('CircuitBreaker', 'Health check registered for [google]');
  }

  // Anthropic health probe: simple messages endpoint (HEAD-like, will return 400 without body but proves connectivity)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.trim().length > 0) {
    CircuitBreakerService.setHealthCheck('anthropic', async () => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        signal: AbortSignal.timeout(5000),
      });
      // 200 or 429 both indicate the API is reachable
      if (res.status >= 500) throw new Error(`Anthropic health check failed: ${res.status}`);
    });
    aiLogger.info('CircuitBreaker', 'Health check registered for [anthropic]');
  }
}

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
