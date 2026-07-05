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

function getProviderOverrides(providerId: string): Partial<typeof LLM_CONFIG> {
  const id = String(providerId || '').toLowerCase();
  // OpenRouter is an aggregator and can have transient upstream/model failures.
  // Keep it "available" longer and retry sooner before blocking traffic.
  if (id === 'openrouter') {
    return {
      failureThreshold: 12,
      resetTimeout: 10_000,
      retryAttempts: 1,
    };
  }
  return {};
}

function getBreakerConfig(providerId: string, options: Record<string, unknown> = {}) {
  return {
    ...LLM_CONFIG,
    ...getProviderOverrides(providerId),
    ...options,
  };
}

function shouldIgnoreFailure(providerId: string, error: Error): boolean {
  const id = String(providerId || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  // For OpenRouter we do NOT want to "brick" the provider by opening the circuit
  // on auth/account errors. Calls will still fail, but the provider remains selectable
  // and can recover immediately after key/account fixes without waiting for cooldown.
  if (id === 'openrouter') {
    if (msg.includes('user not found')) return true;
    if (msg.includes('unauthorized') || msg.includes('forbidden')) return true;
    if (msg.includes('invalid api key') || msg.includes('key invalid') || msg.includes('auth'))
      return true;
    if (msg.includes('http 401') || msg.includes('http 403')) return true;
  }
  return false;
}

export function canExecute(providerId: string) {
  const breaker = CircuitBreakerService.getBreaker(providerId, getBreakerConfig(providerId));
  return breaker.canExecute();
}

export async function recordSuccess(providerId: string): Promise<void> {
  await CircuitBreakerService.recordSuccess(providerId);
}

export async function recordFailure(providerId: string, error: Error): Promise<void> {
  if (shouldIgnoreFailure(providerId, error)) {
    aiLogger.warn(
      'CircuitBreaker',
      `Ignoring failure for [${String(providerId)}]: ${String(error?.message || '').slice(0, 200)}`
    );
    return;
  }
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
  const breaker = CircuitBreakerService.getBreaker(
    providerId,
    getBreakerConfig(providerId, options)
  );
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

// Opt-in isolation seam for non-server harness scripts (e.g. deliverables live
// pilots run under plain `node --import tsx`). When SKIP_DB_INIT=1 is set, we do
// NOT schedule the auto-init that opens a DB pool + restores breaker state from
// the database. This prevents the harness from (a) connecting to whatever
// DATABASE_URL resolves to and (b) stalling on a schema-check SLOW QUERY that
// eats the LLM abort budget. No-op for normal app boot: the flag is unset, so
// the original behavior (3s delayed initialize) is preserved exactly.
const SKIP_DB_INIT =
  process.env.SKIP_DB_INIT === '1' ||
  process.env.SKIP_DB_INIT === 'true' ||
  process.env.SKIP_DB_INIT === 'yes';

if (!SKIP_DB_INIT) {
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
} else {
  logger.warn('[CircuitBreaker] SKIP_DB_INIT set — skipping DB-backed auto-init (harness mode)');
}

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

  // OpenRouter health probe: list models
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey && openrouterKey.trim().length > 0) {
    CircuitBreakerService.setHealthCheck('openrouter', async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${openrouterKey}`,
      };
      // Optional OpenRouter attribution headers (recommended; some deployments enforce them).
      const referer =
        process.env.OPENROUTER_SITE_URL ||
        process.env.SITE_URL ||
        process.env.PUBLIC_URL ||
        process.env.APP_URL;
      const title =
        process.env.OPENROUTER_APP_NAME || process.env.APP_NAME || process.env.npm_package_name;
      if (referer) headers['HTTP-Referer'] = String(referer);
      if (title) headers['X-Title'] = String(title);

      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`OpenRouter health check failed: ${res.status}`);
    });
    aiLogger.info('CircuitBreaker', 'Health check registered for [openrouter]');
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
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
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
