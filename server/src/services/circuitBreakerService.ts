/**
 * Circuit Breaker Service (Consolidated)
 *
 * Unified Circuit Breaker implementation for external services.
 */

import * as DbPromise from '../utils/DbPromise.js';
import aiLogger from './ai/logger.js';

// Opt-in isolation seam for non-server harness scripts (deliverables live pilots
// under `node --import tsx`). When SKIP_DB_INIT=1, circuit-breaker persistence
// becomes in-memory only so the harness never opens a DB pool (no prod risk, no
// schema-check stall). No-op for normal app boot: flag unset → unchanged behavior.
const SKIP_DB_PERSIST =
  process.env.SKIP_DB_INIT === '1' ||
  process.env.SKIP_DB_INIT === 'true' ||
  process.env.SKIP_DB_INIT === 'yes';

type AlertsModule = {
  alerts?: {
    circuitClosed?: (name: string) => void;
    circuitOpen?: (name: string, failures: number, resetSeconds: number) => void;
  };
};

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

type CircuitConfig = {
  failureThreshold: number;
  successThreshold: number;
  resetTimeout: number;
  retryAttempts: number;
  retryBaseDelay: number;
  retryMaxDelay: number;
  persistenceEnabled: boolean;
  healthCheckFn?: () => Promise<void>;
};

type ExecuteOptions = Partial<CircuitConfig> & {
  retries?: number;
  timeout?: number;
};

export const STATES: Record<CircuitState, CircuitState> = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 60000,
  retryAttempts: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 30000,
  persistenceEnabled: false,
};

const circuits = new Map<string, EnhancedCircuitBreaker>();
const healthCheckIntervals = new Map<string, ReturnType<typeof setInterval>>();
const recoveryProgress = new Map<string, Array<ReturnType<typeof setTimeout>>>();

// Schema probe (SQLite): older DBs may not have `service` column.
let circuitBreakerHasServiceColumn: boolean | null = null;
const PROVIDER_ROTATION = new Map<string, string[]>([
  ['openai', ['anthropic', 'google']],
  ['anthropic', ['openai', 'google']],
  ['google', ['openai', 'anthropic']],
]);
const HEALTH_CHECK_CONFIG = {
  interval: 30000,
  timeout: 5000,
  minSuccessRate: 0.8,
  gradualRecoverySteps: 5,
};

let stateRestored = false;

let alertsModule: AlertsModule | null = null;
async function getAlerts() {
  if (!alertsModule) {
    try {
      const mod = await import('./ai/alerting.js');
      alertsModule = mod as AlertsModule;
    } catch {
      alertsModule = null;
    }
  }
  return alertsModule?.alerts || null;
}

type CircuitStatus = {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  threshold: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  nextAttemptTime: string | null;
  openedAt: string | null;
  cooldownRemaining: number | null;
  isFailing: boolean;
  lastError: string | null;
  totalStats: {
    successes: number;
    failures: number;
  };
};

type BreakerError = Error & {
  isCircuitOpen?: boolean;
  breakerName?: string;
  code?: string;
  originalError?: unknown;
};

export class CircuitBreaker {
  name: string;
  config: CircuitConfig;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
  nextAttemptTime: number | null;
  lastError: string | null;
  totalFailures: number;
  totalSuccesses: number;

  constructor(name: string, options: Partial<CircuitConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.openedAt = null;
    this.nextAttemptTime = null;
    this.lastError = null;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  canExecute(): { allowed: boolean; state: CircuitState; reason?: string } {
    const now = Date.now();

    switch (this.state) {
      case STATES.CLOSED:
        return { allowed: true, state: STATES.CLOSED };
      case STATES.OPEN:
        if (this.nextAttemptTime && now >= this.nextAttemptTime) {
          this.state = STATES.HALF_OPEN;
          this.successes = 0;
          aiLogger.info('CircuitBreaker', `Circuit [${this.name}] transitioning to HALF_OPEN`);
          return { allowed: true, state: STATES.HALF_OPEN };
        }
        if (this.nextAttemptTime) {
          const remainingCooldown = Math.ceil((this.nextAttemptTime - now) / 1000);
          return {
            allowed: false,
            state: STATES.OPEN,
            reason: `Circuit [${this.name}] is OPEN. Retry in ${remainingCooldown}s`,
          };
        }
        return { allowed: false, state: STATES.OPEN, reason: `Circuit [${this.name}] is OPEN.` };
      case STATES.HALF_OPEN:
        return { allowed: true, state: STATES.HALF_OPEN };
      default:
        return { allowed: true, state: STATES.CLOSED };
    }
  }

  async execute<T>(fn: () => Promise<T>, options: ExecuteOptions = {}): Promise<T> {
    const check = this.canExecute();
    if (!check.allowed) {
      const err = new Error(check.reason || `Circuit [${this.name}] is OPEN`) as BreakerError;
      err.isCircuitOpen = true;
      err.breakerName = this.name;
      err.code = 'CIRCUIT_OPEN';
      throw err;
    }

    const maxRetries = options.retries ?? this.config.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        await this.recordSuccess();
        return result;
      } catch (error: unknown) {
        lastError = error as Error;

        if (this._isSystemFailure(lastError)) {
          await this.recordFailure(lastError);
        }

        if (attempt === maxRetries || !this._isRetriable(lastError)) {
          break;
        }

        const newCheck = this.canExecute();
        if (!newCheck.allowed) {
          const circuitError = new Error(
            `Circuit [${this.name}] opened during retry: ${lastError.message}`
          ) as BreakerError;
          circuitError.code = 'CIRCUIT_OPENED';
          circuitError.originalError = lastError;
          circuitError.isCircuitOpen = true;
          throw circuitError;
        }

        const delay = Math.min(
          this.config.retryBaseDelay * Math.pow(2, attempt),
          this.config.retryMaxDelay
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        aiLogger.info(
          'CircuitBreaker',
          `Retrying [${this.name}] in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
        );
      }
    }

    throw lastError || new Error('Circuit breaker execution failed');
  }

  async recordSuccess(): Promise<void> {
    this.lastSuccessTime = Date.now();
    this.failures = 0;
    this.totalSuccesses++;

    // If we observe a real success while OPEN (e.g. via out-of-band health checks),
    // we must not stay OPEN forever. Promote to HALF_OPEN and close after the
    // configured success threshold.
    if (this.state === STATES.OPEN) {
      // Do NOT count this success twice. We reset HALF_OPEN counters and let the
      // standard HALF_OPEN branch increment once.
      this.state = STATES.HALF_OPEN;
      this.successes = 0;
      aiLogger.info(
        'CircuitBreaker',
        `Circuit [${this.name}] promoted OPEN → HALF_OPEN on success`
      );
    }

    if (this.state === STATES.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = STATES.CLOSED;
        this.openedAt = null;
        this.nextAttemptTime = null;

        aiLogger.info('CircuitBreaker', `Circuit [${this.name}] CLOSED after recovery`);

        const alerts = await getAlerts();
        if (alerts?.circuitClosed) {
          alerts.circuitClosed(this.name);
        }

        if (this.config.persistenceEnabled) {
          await this._persistState();
        }
      }
    }
  }

  async recordFailure(error: Error): Promise<void> {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.lastError = error.message || 'Unknown error';

    aiLogger.warn(
      'CircuitBreaker',
      `Failure recorded for [${this.name}] (${this.failures}/${this.config.failureThreshold})`,
      {
        error: this.lastError,
      }
    );

    if (this.state === STATES.HALF_OPEN || this.failures >= this.config.failureThreshold) {
      const wasHalfOpen = this.state === STATES.HALF_OPEN;
      this.state = STATES.OPEN;
      this.openedAt = Date.now();
      this.nextAttemptTime = this.openedAt + this.config.resetTimeout;

      const logMsg = wasHalfOpen
        ? `Circuit [${this.name}] REOPENED after half-open failure`
        : `Circuit [${this.name}] OPENED after ${this.failures} failures`;
      aiLogger.error('CircuitBreaker', logMsg);

      const alerts = await getAlerts();
      if (alerts?.circuitOpen) {
        alerts.circuitOpen(this.name, this.failures, this.config.resetTimeout / 1000);
      }

      if (this.config.persistenceEnabled) {
        await this._persistState();
      }
    }
  }

  async reset(): Promise<void> {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.nextAttemptTime = null;
    this.lastError = null;

    aiLogger.info('CircuitBreaker', `Circuit [${this.name}] manually reset to CLOSED`);

    if (this.config.persistenceEnabled) {
      await this._persistState();
    }
  }

  getStatus(): CircuitStatus {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      threshold: this.config.failureThreshold,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
      cooldownRemaining:
        this.state === STATES.OPEN && this.nextAttemptTime
          ? Math.max(0, this.nextAttemptTime - Date.now())
          : null,
      isFailing: this.state !== STATES.CLOSED,
      lastError: this.lastError,
      totalStats: {
        successes: this.totalSuccesses,
        failures: this.totalFailures,
      },
    };
  }

  _isSystemFailure(error: Error): boolean {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('budget') || (msg.includes('limit exceeded') && !msg.includes('rate limit')))
      return false;
    // Configuration errors should NOT open the circuit breaker.
    // Otherwise we spam alerts in dev/stage when keys are intentionally missing.
    if (msg.includes('missing key')) return false;
    if (msg.includes('no api key')) return false;
    if (msg.includes('api key missing')) return false;
    if (msg.includes('set ') && msg.includes('_api_key')) return false;
    if (msg.includes('unauthorized') || msg.includes('auth') || msg.includes('key invalid'))
      return false;
    if (msg.includes('validation') || msg.includes('invalid argument')) return false;
    if (msg.includes('not found') || msg.includes('404')) return false;
    return true;
  }

  _isRetriable(error: Error): boolean {
    const msg = (error.message || '').toLowerCase();
    // Don't retry configuration errors.
    if (msg.includes('missing key')) return false;
    if (msg.includes('no api key')) return false;
    if (msg.includes('api key missing')) return false;
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset'))
      return true;
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('503')) return true;
    if (msg.includes('server error') || msg.includes('500') || msg.includes('502')) return true;
    if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('404'))
      return false;
    return true;
  }

  async _persistState(): Promise<void> {
    if (SKIP_DB_PERSIST) return; // harness mode: in-memory only, never touch DB
    try {
      if (circuitBreakerHasServiceColumn === null) {
        try {
          const { default: databaseConfig } = await import('../config/DatabaseConfig.js');
          const isPostgres = databaseConfig.type === 'postgres';
          let cols: Array<{ name?: string }> = [];
          if (isPostgres) {
            const rows = await DbPromise.all<{ column_name: string }>(
              `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
              ['circuit_breaker_state'],
              { fallback: true }
            );
            cols = (rows || []).map((r) => ({ name: r.column_name }));
          } else {
            cols = (await DbPromise.all(`PRAGMA table_info(circuit_breaker_state)`, [], {
              fallback: true,
            })) as Array<{ name?: string }>;
          }
          circuitBreakerHasServiceColumn =
            Array.isArray(cols) &&
            cols.some((c: any) => String(c?.name || '').toLowerCase() === 'service');
        } catch {
          circuitBreakerHasServiceColumn = false;
        }
      }

      if (circuitBreakerHasServiceColumn) {
        await DbPromise.run(
          `
                        INSERT OR REPLACE INTO circuit_breaker_state 
                        (id, service, state, failures, last_failure, updated_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `,
          [
            this.name,
            this.name,
            this.state,
            this.failures,
            this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
          ],
          { fallback: true }
        );
      } else {
        await DbPromise.run(
          `
                        INSERT OR REPLACE INTO circuit_breaker_state
                        (id, state, failures, last_failure, updated_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `,
          [
            this.name,
            this.state,
            this.failures,
            this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
          ],
          { fallback: true }
        );
      }
    } catch (error: unknown) {
      // Silently ignore persistence errors - state is held in memory
    }
  }
}

export class EnhancedCircuitBreaker extends CircuitBreaker {
  healthCheckFn: (() => Promise<void>) | null;
  recoveryPercent: number;
  consecutiveHealthChecks: number;
  isRecovering: boolean;

  constructor(name: string, options: Partial<CircuitConfig> = {}) {
    super(name, options);
    this.healthCheckFn = options.healthCheckFn || null;
    this.recoveryPercent = 100;
    this.consecutiveHealthChecks = 0;
    this.isRecovering = false;
  }

  startHealthChecks(): void {
    if (healthCheckIntervals.has(this.name)) {
      return;
    }

    if (!this.healthCheckFn) {
      aiLogger.debug('CircuitBreaker', `No health check function for [${this.name}]`);
      return;
    }

    aiLogger.info('CircuitBreaker', `Starting health checks for [${this.name}]`);

    const interval = setInterval(async () => {
      try {
        const startTime = Date.now();
        await Promise.race([
          this.healthCheckFn ? this.healthCheckFn() : Promise.resolve(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_CONFIG.timeout)
          ),
        ]);

        const latency = Date.now() - startTime;
        this.consecutiveHealthChecks++;

        aiLogger.debug('CircuitBreaker', `Health check OK for [${this.name}] (${latency}ms)`);

        if (this.consecutiveHealthChecks >= 3 && this.state === STATES.HALF_OPEN) {
          this.beginGradualRecovery();
        }
      } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('CircuitBreaker', `Health check failed for [${this.name}]: ${err.message}`);
        this.consecutiveHealthChecks = 0;

        if (this.state === STATES.HALF_OPEN) {
          await this.recordFailure(err);
        }
      }
    }, HEALTH_CHECK_CONFIG.interval);

    healthCheckIntervals.set(this.name, interval);
  }

  stopHealthChecks(): void {
    const interval = healthCheckIntervals.get(this.name);
    if (interval) {
      clearInterval(interval);
      healthCheckIntervals.delete(this.name);
      aiLogger.info('CircuitBreaker', `Stopped health checks for [${this.name}]`);
    }
  }

  beginGradualRecovery(): void {
    if (this.isRecovering) return;

    this.isRecovering = true;
    this.recoveryPercent = 20;

    aiLogger.info(
      'CircuitBreaker',
      `Beginning gradual recovery for [${this.name}] at ${this.recoveryPercent}%`
    );

    const steps: Array<ReturnType<typeof setTimeout>> = [];
    const stepIncrement = Math.floor(80 / HEALTH_CHECK_CONFIG.gradualRecoverySteps);

    for (let i = 0; i < HEALTH_CHECK_CONFIG.gradualRecoverySteps; i++) {
      const stepTimeout = setTimeout(
        () => {
          if (this.state === STATES.CLOSED || this.state === STATES.HALF_OPEN) {
            this.recoveryPercent = Math.min(100, this.recoveryPercent + stepIncrement);
            aiLogger.info(
              'CircuitBreaker',
              `Recovery progress for [${this.name}]: ${this.recoveryPercent}%`
            );

            if (this.recoveryPercent >= 100) {
              this.completeRecovery();
            }
          }
        },
        (i + 1) * 10000
      );

      steps.push(stepTimeout);
    }

    recoveryProgress.set(this.name, steps);
  }

  completeRecovery(): void {
    this.isRecovering = false;
    this.recoveryPercent = 100;
    this.stopHealthChecks();

    const steps = recoveryProgress.get(this.name);
    if (steps) {
      steps.forEach(clearTimeout);
      recoveryProgress.delete(this.name);
    }

    aiLogger.info('CircuitBreaker', `Recovery complete for [${this.name}]`);
  }

  shouldAllowDuringRecovery(): boolean {
    if (!this.isRecovering || this.recoveryPercent >= 100) {
      return true;
    }
    return Math.random() * 100 < this.recoveryPercent;
  }

  override canExecute(): { allowed: boolean; state: CircuitState; reason?: string } {
    const baseCheck = super.canExecute();

    if (baseCheck.allowed && this.isRecovering) {
      if (!this.shouldAllowDuringRecovery()) {
        return {
          allowed: false,
          state: STATES.HALF_OPEN,
          reason: `Circuit [${this.name}] in recovery (${this.recoveryPercent}% traffic)`,
        };
      }
    }

    if (baseCheck.state === STATES.HALF_OPEN && !healthCheckIntervals.has(this.name)) {
      this.startHealthChecks();
    }

    return baseCheck;
  }

  override async recordSuccess(): Promise<void> {
    await super.recordSuccess();
    if (this.state === STATES.CLOSED && this.isRecovering) {
      this.completeRecovery();
    }
  }

  override async reset(): Promise<void> {
    await super.reset();
    this.completeRecovery();
    this.consecutiveHealthChecks = 0;
  }

  override getStatus(): CircuitStatus & {
    recoveryPercent: number;
    isRecovering: boolean;
    consecutiveHealthChecks: number;
    healthCheckActive: boolean;
  } {
    return {
      ...super.getStatus(),
      recoveryPercent: this.recoveryPercent,
      isRecovering: this.isRecovering,
      consecutiveHealthChecks: this.consecutiveHealthChecks,
      healthCheckActive: healthCheckIntervals.has(this.name),
    };
  }
}

export const CircuitBreakerService = {
  STATES,

  getBreaker: (name: string, options: Partial<CircuitConfig> = {}): EnhancedCircuitBreaker => {
    if (!circuits.has(name)) {
      circuits.set(name, new EnhancedCircuitBreaker(name, options));
    }
    return circuits.get(name) as EnhancedCircuitBreaker;
  },

  execute: async <T>(
    name: string,
    fn: () => Promise<T>,
    options: ExecuteOptions = {}
  ): Promise<T> => {
    const breaker = CircuitBreakerService.getBreaker(name, options);
    return breaker.execute(fn, options);
  },

  canExecute: (name: string) => {
    const breaker = circuits.get(name);
    return breaker ? breaker.canExecute() : { allowed: true, state: STATES.CLOSED };
  },

  recordSuccess: async (name: string): Promise<void> => {
    const breaker = circuits.get(name);
    if (breaker) await breaker.recordSuccess();
  },

  recordFailure: async (name: string, error: Error): Promise<void> => {
    const breaker = circuits.get(name);
    if (breaker) await breaker.recordFailure(error);
  },

  reset: async (name: string): Promise<void> => {
    const breaker = circuits.get(name);
    if (breaker) await breaker.reset();
  },

  getStatus: (name: string) => {
    const breaker = circuits.get(name);
    return breaker ? breaker.getStatus() : null;
  },

  getAllStatuses: (): CircuitStatus[] => {
    return Array.from(circuits.values()).map((breaker) => breaker.getStatus());
  },

  restoreStates: async (): Promise<void> => {
    if (stateRestored) return;
    if (SKIP_DB_PERSIST) {
      stateRestored = true; // harness mode: nothing persisted, start from in-memory defaults
      return;
    }

    try {
      // Check if table exists first to avoid error logs
      // Detect database type to use correct syntax
      const { default: databaseConfig } = await import('../config/DatabaseConfig.js');
      const isPostgres = databaseConfig.type === 'postgres';

      let tableExists = false;
      if (isPostgres) {
        // PostgreSQL: Check information_schema
        try {
          const result = await DbPromise.all<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
            ['circuit_breaker_state'],
            { fallback: true }
          );
          tableExists = parseInt(result?.[0]?.count || '0', 10) > 0;
        } catch {
          tableExists = false;
        }
      } else {
        // SQLite: use PRAGMA table_info
        try {
          const tableInfo = await DbPromise.all('PRAGMA table_info(circuit_breaker_state)', [], {
            fallback: true,
          });
          tableExists = Array.isArray(tableInfo) && tableInfo.length > 0;
        } catch {
          tableExists = false;
        }
      }

      if (!tableExists) {
        aiLogger.debug(
          'CircuitBreaker',
          'Table circuit_breaker_state not ready yet, skipping state restoration'
        );
        stateRestored = true; // Mark as restored to avoid repeated attempts
        return;
      }

      const rows = await DbPromise.all<{
        id: string;
        service: string;
        state: CircuitState;
        failures: number;
        last_failure?: string | null;
      }>('SELECT * FROM circuit_breaker_state WHERE state = ?', [STATES.OPEN], { fallback: true });

      const now = Date.now();
      for (const row of rows || []) {
        if (row.last_failure) {
          const openedAt = new Date(row.last_failure).getTime();
          const timeout = DEFAULT_CONFIG.resetTimeout;

          if (now - openedAt < timeout) {
            const breaker = CircuitBreakerService.getBreaker(row.service || row.id, {
              persistenceEnabled: true,
            });
            breaker.state = row.state;
            breaker.failures = row.failures;
            breaker.openedAt = openedAt;
            breaker.nextAttemptTime = openedAt + timeout;

            aiLogger.info('CircuitBreaker', `Restored OPEN state for [${row.service || row.id}]`);
          }
        }
      }
      stateRestored = true;
    } catch (error: unknown) {
      const err = error as Error;
      // Only log as warning if it's not a "table doesn't exist" error
      if (
        !err.message.includes('no such table') &&
        !err.message.includes('does not exist') &&
        !err.message.includes('relation') &&
        !err.message.includes('Database not initialized')
      ) {
        aiLogger.warn('CircuitBreaker', `Failed to restore states: ${err.message}`);
      } else {
        aiLogger.debug(
          'CircuitBreaker',
          'Table circuit_breaker_state not ready yet, skipping state restoration'
        );
      }
      stateRestored = true; // Mark as restored to avoid repeated attempts
    }
  },

  getFallbackProvider: (primaryProvider: string): string | null => {
    const fallbacks = PROVIDER_ROTATION.get(primaryProvider) || [];

    for (const fallback of fallbacks) {
      const breaker = circuits.get(fallback);
      if (!breaker || breaker.state === STATES.CLOSED) {
        aiLogger.info(
          'CircuitBreaker',
          `Using fallback provider [${fallback}] for [${primaryProvider}]`
        );
        return fallback;
      }
    }

    aiLogger.warn(
      'CircuitBreaker',
      `No healthy fallback provider available for [${primaryProvider}]`
    );
    return null;
  },

  executeWithRotation: async <T>(
    primaryProvider: string,
    createFn: (provider: string) => () => Promise<T>,
    options: ExecuteOptions = {}
  ): Promise<{ result: T; provider: string }> => {
    const providers = [primaryProvider, ...(PROVIDER_ROTATION.get(primaryProvider) || [])];
    let lastError: Error | null = null;

    for (const provider of providers) {
      const breaker = CircuitBreakerService.getBreaker(provider, options);
      const check = breaker.canExecute();

      if (!check.allowed) {
        aiLogger.info('CircuitBreaker', `Skipping [${provider}]: ${check.reason}`);
        continue;
      }

      try {
        const fn = createFn(provider);
        const result = await breaker.execute(fn, options);
        return { result, provider };
      } catch (error: unknown) {
        lastError = error as Error;
        aiLogger.warn('CircuitBreaker', `Provider [${provider}] failed: ${lastError.message}`);
      }
    }

    throw lastError || new Error('All providers unavailable');
  },

  setHealthCheck: (name: string, healthCheckFn: () => Promise<void>): void => {
    const breaker = CircuitBreakerService.getBreaker(name);
    breaker.healthCheckFn = healthCheckFn;
    aiLogger.info('CircuitBreaker', `Health check function set for [${name}]`);
  },

  getRecoveryStatuses: () => {
    return Array.from(circuits.values())
      .filter((breaker) => breaker instanceof EnhancedCircuitBreaker && breaker.isRecovering)
      .map((breaker) => ({
        name: breaker.name,
        recoveryPercent: breaker.recoveryPercent,
        consecutiveHealthChecks: breaker.consecutiveHealthChecks,
      }));
  },

  forceRecovery: (name: string): boolean => {
    const breaker = circuits.get(name);
    if (breaker && breaker.state === STATES.OPEN) {
      breaker.state = STATES.HALF_OPEN;
      breaker.startHealthChecks();
      aiLogger.info('CircuitBreaker', `Forced recovery started for [${name}]`);
      return true;
    }
    return false;
  },

  cleanup: (): void => {
    for (const [, interval] of healthCheckIntervals.entries()) {
      clearInterval(interval);
    }
    healthCheckIntervals.clear();

    for (const [, steps] of recoveryProgress.entries()) {
      steps.forEach(clearTimeout);
    }
    recoveryProgress.clear();
  },

  /**
   * GAP-AI-004: Auto recovery probes
   * Automatically attempts recovery for circuits that have been open
   * for longer than the reset timeout
   */
  runAutoRecoveryProbes: async (): Promise<{
    checked: number;
    recovered: number;
    stillOpen: number;
    errors: string[];
  }> => {
    const results = {
      checked: 0,
      recovered: 0,
      stillOpen: 0,
      errors: [] as string[],
    };

    for (const [name, breaker] of circuits.entries()) {
      results.checked++;

      // Only check OPEN circuits
      if (breaker.state !== STATES.OPEN) {
        continue;
      }

      // Check if enough time has passed since circuit opened
      const now = Date.now();
      const timeSinceOpen = breaker.openedAt ? now - breaker.openedAt : 0;

      if (timeSinceOpen < breaker.config.resetTimeout) {
        results.stillOpen++;
        continue;
      }

      // Attempt recovery probe
      try {
        aiLogger.info('CircuitBreaker', `Auto recovery probe for [${name}]`);

        // If there's a health check function, run it
        if (breaker.healthCheckFn) {
          await Promise.race([
            breaker.healthCheckFn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Probe timeout')), HEALTH_CHECK_CONFIG.timeout)
            ),
          ]);

          // Probe succeeded - transition to HALF_OPEN and start health checks
          breaker.state = STATES.HALF_OPEN;
          breaker.startHealthChecks();
          results.recovered++;
          aiLogger.info(
            'CircuitBreaker',
            `Auto recovery probe succeeded for [${name}] - transitioning to HALF_OPEN`
          );
        } else {
          // No health check function - just try transitioning
          breaker.state = STATES.HALF_OPEN;
          breaker.nextAttemptTime = now;
          results.recovered++;
          aiLogger.info(
            'CircuitBreaker',
            `Auto recovery for [${name}] - transitioning to HALF_OPEN (no health check fn)`
          );
        }
      } catch (error: unknown) {
        const err = error as Error;
        results.stillOpen++;
        results.errors.push(`${name}: ${err.message}`);
        aiLogger.warn('CircuitBreaker', `Auto recovery probe failed for [${name}]: ${err.message}`);
      }
    }

    if (results.recovered > 0 || results.errors.length > 0) {
      aiLogger.info(
        'CircuitBreaker',
        `Auto recovery probe complete: ${results.recovered} recovered, ${results.stillOpen} still open, ${results.errors.length} errors`
      );
    }

    return results;
  },

  /**
   * GAP-AI-004: Get all open circuits for monitoring
   */
  getOpenCircuits: (): Array<{
    name: string;
    openedAt: number | null;
    timeSinceOpen: number;
    lastError: string | null;
    hasHealthCheck: boolean;
  }> => {
    const now = Date.now();
    return Array.from(circuits.entries())
      .filter(([_, breaker]) => breaker.state === STATES.OPEN)
      .map(([name, breaker]) => ({
        name,
        openedAt: breaker.openedAt,
        timeSinceOpen: breaker.openedAt ? now - breaker.openedAt : 0,
        lastError: breaker.lastError,
        hasHealthCheck: !!breaker.healthCheckFn,
      }));
  },
};

export default CircuitBreakerService;
