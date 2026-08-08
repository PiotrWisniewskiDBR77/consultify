import { AsyncLocalStorage } from 'node:async_hooks';

import type { PgTransactionClient } from './queryHelpers.js';

/**
 * Owner-service transaction pinning (U02).
 *
 * PROBLEM: the owner modules (Report Builder, Presentations, Artifact Registry)
 * reach for the process-wide pooled DB handle and issue independent autocommit
 * statements. When an orchestrator such as the Transformation final-output
 * publisher runs inside its own `withPgTransaction`, those owner writes commit
 * on a DIFFERENT physical connection — so a later rollback of the orchestrator
 * leaves half-created native artifacts behind, and a concurrent reader can see
 * owner rows that the manifest never acknowledged.
 *
 * FIX: the orchestrator donates its pinned `PgTransactionClient` into an
 * AsyncLocalStorage context. While that context is active every owner query
 * runs on the caller's transaction, so one COMMIT/ROLLBACK covers owner rows,
 * registry rows and the manifest. Outside the context the owner services keep
 * their existing pooled behaviour verbatim.
 *
 * This mirrors `withProposalGovernanceClient` in
 * `server/src/services/v8/agentProposalGovernanceService.ts`, generalised so
 * every owner module uses one implementation instead of three copies.
 */
export interface PinnedClientContext {
  /**
   * Bind this owner module to a transaction the caller already owns. The caller
   * remains responsible for BEGIN/COMMIT/ROLLBACK. Re-entrant for the same
   * client; throws when a second, different client is interleaved on the same
   * async context (that would silently split one logical write across two
   * transactions).
   */
  withClient<T>(client: PgTransactionClient, fn: () => Promise<T>): Promise<T>;
  /** The pinned client, or null when running on the pooled handle. */
  current(): PgTransactionClient | null;
  /** True while a caller transaction is pinned. */
  isPinned(): boolean;
  /** The pinned client, or throw. For code paths that must never escape the transaction. */
  require(): PgTransactionClient;
}

export function createPinnedClientContext(name: string): PinnedClientContext {
  const storage = new AsyncLocalStorage<PgTransactionClient>();

  return {
    withClient<T>(client: PgTransactionClient, fn: () => Promise<T>): Promise<T> {
      const existing = storage.getStore();
      // Declared Promise<T>, so a conflict must REJECT rather than throw
      // synchronously — otherwise a caller's `.catch()` never sees it.
      if (existing && existing !== client)
        return Promise.reject(new Error(`${name}_transaction_client_conflict`));
      if (existing) return fn();
      return storage.run(client, fn);
    },
    current(): PgTransactionClient | null {
      return storage.getStore() ?? null;
    },
    isPinned(): boolean {
      return storage.getStore() !== undefined;
    },
    require(): PgTransactionClient {
      const client = storage.getStore();
      if (!client) throw new Error(`${name}_transaction_context_missing`);
      return client;
    },
  };
}
