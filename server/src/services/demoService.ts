/**
 * Demo Service — REAL implementation (was a dead lazy wrapper).
 *
 * Root cause of the growing orphan-org problem (REJESTR T7b-1): the trial cron
 * (`TrialCron.cleanupExpiredDemos`) called an empty wrapper — the implementation
 * NEVER existed — so every demo toggle minted a fresh per-session tenant org
 * (`demo-org-session-<user>-<ts>`, type `DEMO`) that was never reclaimed. They
 * accumulate forever.
 *
 * `cleanupExpiredDemos()` reclaims ONLY provably-ephemeral, expired demo
 * scaffolding, never a real customer org. It is opt-in through
 * `ENABLE_DEMO_SANDBOX_TTL=true`. Deletion reuses the proven children-first (FK-aware)
 * `deleteDemoDatasetForOrganization` purger and runs per-org inside a
 * transaction, with a hard per-run cap of three tenants.
 *
 * SAFE-DELETE criterion — an org is a candidate ONLY when ALL hold:
 *   1. Its id matches the ephemeral demo-session pattern
 *      (`<demoOrgId>-session-%` / `demo-org-session-%`) — real orgs get UUIDs,
 *      the base demo org keeps its bare id and is excluded by the `-session-`
 *      suffix.
 *   2. `organization_type = 'DEMO'` (belt-and-suspenders; session orgs are
 *      always seeded as DEMO — see demoSeedService.upsertOrg).
 *   3. `billing_status` is not a paying state (never touch anything that pays).
 *   4. `created_at` is older than the absolute TTL (default 24h). Session state
 *      never shortens that minimum lifetime.
 *   5. ZERO real human members — no `users` row on the org whose email is NOT a
 *      known seed/test domain. (Session tenant orgs normally have no users at
 *      all; any real user is a hard STOP.)
 *   6. Not in the whitelist (base demo org id + name, `atelier`, `dbr77`, plus
 *      anything in `DEMO_CLEANUP_WHITELIST`).
 *
 * Enterprise SaaS Architecture — TypeScript Backend.
 */

import { resolveDemoPolicy } from '../config/demoPolicy.js';
import {
  type PinnedTransactionClient,
  withPinnedPostgresTransaction,
} from '../database/PostgresDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { SEED_EMAIL_DOMAINS } from '../utils/superadminSeedFilter.js';
import { deleteDemoDatasetForOrganization } from './demo/demoSeedService.js';

// ==========================================
// CONFIG
// ==========================================

const DEFAULT_TTL_HOURS = 24; // demo-session lifetime (DEMO_SESSION_DURATION_MS)
const MAX_PER_RUN_LIMIT = 3;

function parseBool(value: unknown): boolean {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isEnabled(env: NodeJS.ProcessEnv): boolean {
  // Data deletion is opt-in. Missing, empty and malformed values stay OFF.
  return parseBool(env.ENABLE_DEMO_SANDBOX_TTL);
}

function ttlHours(env: NodeJS.ProcessEnv): number {
  return parsePositiveInt(env.DEMO_CLEANUP_TTL_HOURS, DEFAULT_TTL_HOURS);
}

function perRunLimit(env: NodeJS.ProcessEnv): number {
  return Math.min(MAX_PER_RUN_LIMIT, parsePositiveInt(env.DEMO_CLEANUP_LIMIT, MAX_PER_RUN_LIMIT));
}

/**
 * Lower-cased whitelist of org ids AND org names that must NEVER be reclaimed.
 * Always protects the canonical demo org (id + name) plus the branded fixtures
 * `atelier` / `dbr77`; extendable via `DEMO_CLEANUP_WHITELIST` (comma list).
 */
function buildWhitelist(env: NodeJS.ProcessEnv): Set<string> {
  const policy = resolveDemoPolicy(env);
  const values = [
    policy.demoOrgId,
    policy.demoOrgName,
    policy.defaultDemoOrgId,
    policy.defaultDemoOrgName,
    'atelier',
    'atelier toys',
    'dbr77',
    'dbr77 sp. z o.o.',
    ...String(env.DEMO_CLEANUP_WHITELIST ?? '')
      .split(',')
      .map((s) => s.trim()),
  ];
  return new Set(values.map((v) => v.toLowerCase()).filter((v) => v.length > 0));
}

/** Ephemeral demo-session org id LIKE patterns (deduped). */
function ephemeralIdPatterns(env: NodeJS.ProcessEnv): string[] {
  const policy = resolveDemoPolicy(env);
  const patterns = new Set<string>([
    // Current session tenants: <brand>-demo-session-<user>-<timestamp>.
    '%-demo-session-%',
    // Compatibility with tenants minted by the older demo service.
    `${policy.demoOrgId}-session-%`,
    'demo-org-session-%',
  ]);
  return [...patterns];
}

// ==========================================
// CANDIDATE SELECTION
// ==========================================

export interface DemoCleanupCandidate {
  id: string;
  name: string | null;
  organization_type: string | null;
  created_at: string | null;
}

/**
 * Compute the SAFE set of expired-demo candidates (already whitelist-filtered),
 * capped at `limit`. Pure read — never mutates.
 */
export async function findExpiredDemoCandidates(
  limit: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<DemoCleanupCandidate[]> {
  const params: unknown[] = [];

  // (1) ephemeral id patterns
  const idPatterns = ephemeralIdPatterns(env);
  const idClause = idPatterns.map(() => `o.id LIKE ?`).join(' OR ');
  idPatterns.forEach((p) => params.push(p));

  // (4) Absolute TTL: session state may never shorten the minimum lifetime.
  const cutoffIso = new Date(Date.now() - ttlHours(env) * 60 * 60 * 1000).toISOString();
  params.push(cutoffIso);

  // (5) zero REAL human members — block if any non-seed-domain user is attached.
  const seedUserClause = SEED_EMAIL_DOMAINS.map(() => `LOWER(COALESCE(u.email,'')) LIKE ?`).join(
    ' OR '
  );
  const realMemberGuard = `NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u.organization_id = o.id
        AND NOT (${seedUserClause})
    )`;
  SEED_EMAIL_DOMAINS.forEach((d) => params.push(`%@${d.toLowerCase()}`));

  // Apply the whitelist before LIMIT. Filtering it in application code after
  // LIMIT allowed a protected tenant to consume a batch slot and made cleanup
  // silently process fewer than the configured maximum.
  const whitelist = [...buildWhitelist(env)];
  const whitelistPlaceholders = whitelist.map(() => '?').join(', ');
  params.push(...whitelist, ...whitelist);

  const sql = `
    SELECT o.id, o.name, o.organization_type, o.created_at
    FROM organizations o
    WHERE (${idClause})
      AND COALESCE(o.organization_type, '') = 'DEMO'
      AND LOWER(COALESCE(o.billing_status, '')) NOT IN ('paid', 'active', 'past_due')
      AND o.created_at < ?
      AND ${realMemberGuard}
      AND LOWER(o.id) NOT IN (${whitelistPlaceholders})
      AND LOWER(COALESCE(o.name, '')) NOT IN (${whitelistPlaceholders})
    ORDER BY o.created_at ASC NULLS FIRST
    LIMIT ${Math.max(1, Math.floor(limit))}
  `;

  const rows = await DbPromise.all<DemoCleanupCandidate>(sql, params, { fallback: false });

  return rows || [];
}

// ==========================================
// CLEANUP
// ==========================================

export interface DemoCleanupHooks {
  /** Test seam: change safety state after discovery but before the lock/re-check. */
  beforeCandidateTransaction?: (candidate: DemoCleanupCandidate) => void | Promise<void>;
  /** Test seam: collect executed steps or inject a deterministic mid-purge fault. */
  afterDeleteStep?: (table: string, organizationId: string) => void | Promise<void>;
}

async function lockAndRecheckCandidate(
  tx: PinnedTransactionClient,
  organizationId: string,
  env: NodeJS.ProcessEnv
): Promise<DemoCleanupCandidate | null> {
  const params: unknown[] = [organizationId];
  const idPatterns = ephemeralIdPatterns(env);
  const idClause = idPatterns.map(() => `o.id LIKE ?`).join(' OR ');
  params.push(...idPatterns);
  params.push(new Date(Date.now() - ttlHours(env) * 60 * 60 * 1000).toISOString());

  const seedUserClause = SEED_EMAIL_DOMAINS.map(() => `LOWER(COALESCE(u.email,'')) LIKE ?`).join(
    ' OR '
  );
  params.push(...SEED_EMAIL_DOMAINS.map((domain) => `%@${domain.toLowerCase()}`));

  const whitelist = [...buildWhitelist(env)];
  const whitelistPlaceholders = whitelist.map(() => '?').join(', ');
  params.push(...whitelist, ...whitelist);

  return tx.queryOne<DemoCleanupCandidate>(
    `SELECT o.id, o.name, o.organization_type, o.created_at
     FROM organizations o
     WHERE o.id = ?
       AND (${idClause})
       AND COALESCE(o.organization_type, '') = 'DEMO'
       AND LOWER(COALESCE(o.billing_status, '')) NOT IN ('paid', 'active', 'past_due')
       AND o.created_at < ?
       AND NOT EXISTS (
         SELECT 1 FROM users u
         WHERE u.organization_id = o.id
           AND NOT (${seedUserClause})
       )
       AND LOWER(o.id) NOT IN (${whitelistPlaceholders})
       AND LOWER(COALESCE(o.name, '')) NOT IN (${whitelistPlaceholders})
     FOR UPDATE OF o`,
    params
  );
}

/**
 * Reclaim expired demo scaffolding.
 * @returns number of demo orgs actually deleted (0 in dry-run).
 */
export async function cleanupExpiredDemos(
  env: NodeJS.ProcessEnv = process.env,
  hooks: DemoCleanupHooks = {}
): Promise<number> {
  const enabled = isEnabled(env);
  if (!enabled) {
    logger.info('[DemoService] TTL cleanup OFF; set ENABLE_DEMO_SANDBOX_TTL=true to enable it.');
    return 0;
  }

  const limit = perRunLimit(env);
  const candidates = await findExpiredDemoCandidates(limit, env);

  if (candidates.length === 0) {
    logger.info('[DemoService] cleanupExpiredDemos: no expired demo orgs to reclaim');
    return 0;
  }

  const idList = candidates.map((c) => c.id);
  logger.info(
    `[DemoService] cleanupExpiredDemos: ${candidates.length} expired demo org(s) ` +
      `[mode=DELETE, limit=${limit}] -> ${idList.join(', ')}`
  );

  let deleted = 0;
  for (const candidate of candidates) {
    try {
      await hooks.beforeCandidateTransaction?.(candidate);
      const reclaimed = await withPinnedPostgresTransaction(async (tx) => {
        // Repeat every safety predicate under a row lock immediately before
        // deletion. PostgreSQL FK inserts must also take a lock on this row,
        // so a new member cannot slip between this check and organization DELETE.
        const locked = await lockAndRecheckCandidate(tx, candidate.id, env);
        if (!locked) return false;

        await deleteDemoDatasetForOrganization(candidate.id, {
          tx,
          afterDeleteStep: (table) => hooks.afterDeleteStep?.(table, candidate.id),
        });
        const survivor = await tx.queryOne<{ id: string }>(
          `SELECT id FROM organizations WHERE id = ?`,
          [candidate.id]
        );
        if (survivor) throw new Error(`Organization ${candidate.id} survived cleanup`);
        return true;
      });
      if (reclaimed) {
        deleted += 1;
        logger.info(`[DemoService] reclaimed demo org ${candidate.id} (${candidate.name ?? '—'})`);
      } else {
        logger.warn(`[DemoService] skipped demo org ${candidate.id}: safety re-check failed`);
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[DemoService] failed to reclaim demo org ${candidate.id}: ${err.message}`);
    }
  }

  logger.info(
    `[DemoService] cleanupExpiredDemos: reclaimed ${deleted}/${candidates.length} demo org(s)`
  );
  return deleted;
}

// ==========================================
// EXPORTS (default object mirrors the DemoService contract TrialCron reads)
// ==========================================

const demoService = {
  cleanupExpiredDemos,
  findExpiredDemoCandidates,
};

export default demoService;
