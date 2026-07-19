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
 * scaffolding, never a real customer org. It is DRY-RUN by default (logs the
 * candidate set and returns 0) and only deletes when `DEMO_CLEANUP_ENABLED` is
 * explicitly truthy. Deletion reuses the proven children-first (FK-aware)
 * `deleteDemoDatasetForOrganization` purger and runs per-org inside a
 * transaction, with a hard per-run cap.
 *
 * SAFE-DELETE criterion — an org is a candidate ONLY when ALL hold:
 *   1. Its id matches the ephemeral demo-session pattern
 *      (`<demoOrgId>-session-%` / `demo-org-session-%`) — real orgs get UUIDs,
 *      the base demo org keeps its bare id and is excluded by the `-session-`
 *      suffix.
 *   2. `organization_type = 'DEMO'` (belt-and-suspenders; session orgs are
 *      always seeded as DEMO — see demoSeedService.upsertOrg).
 *   3. `billing_status` is not a paying state (never touch anything that pays).
 *   4. EXPIRED: created_at older than the TTL (default 24h — the demo-session
 *      lifetime) OR its demo_session is expired/ended OR its demo_session_tenant
 *      TTL has elapsed. The created_at fallback also reclaims orphans whose
 *      session row is already gone.
 *   5. ZERO real human members — no `users` row on the org whose email is NOT a
 *      known seed/test domain. (Session tenant orgs normally have no users at
 *      all; any real user is a hard STOP.)
 *   6. Not in the whitelist (base demo org id + name, `atelier`, `dbr77`, plus
 *      anything in `DEMO_CLEANUP_WHITELIST`).
 *
 * Enterprise SaaS Architecture — TypeScript Backend.
 */

import { resolveDemoPolicy } from '../config/demoPolicy.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { SEED_EMAIL_DOMAINS } from '../utils/superadminSeedFilter.js';
import { deleteDemoDatasetForOrganization } from './demo/demoSeedService.js';

// ==========================================
// CONFIG
// ==========================================

const DEFAULT_TTL_HOURS = 24; // demo-session lifetime (DEMO_SESSION_DURATION_MS)
const DEFAULT_PER_RUN_LIMIT = 50;

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
  return parseBool(env.DEMO_CLEANUP_ENABLED);
}

function ttlHours(env: NodeJS.ProcessEnv): number {
  return parsePositiveInt(env.DEMO_CLEANUP_TTL_HOURS, DEFAULT_TTL_HOURS);
}

function perRunLimit(env: NodeJS.ProcessEnv): number {
  return parsePositiveInt(env.DEMO_CLEANUP_LIMIT, DEFAULT_PER_RUN_LIMIT);
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
  const patterns = new Set<string>([`${policy.demoOrgId}-session-%`, 'demo-org-session-%']);
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

  // (4) expiry: created_at older than TTL (always available)…
  const cutoffIso = new Date(Date.now() - ttlHours(env) * 60 * 60 * 1000).toISOString();
  const expiryClauses: string[] = ['o.created_at < ?'];
  params.push(cutoffIso);

  // …plus linked demo_session / demo_session_tenant expiry when those tables exist.
  const nowIso = new Date().toISOString();
  if (await DbPromise.tableExists('demo_sessions')) {
    expiryClauses.push(
      `EXISTS (SELECT 1 FROM demo_sessions ds
               WHERE ds.session_org_id = o.id
                 AND (ds.expires_at < ? OR LOWER(COALESCE(ds.status,'')) = 'ended'))`
    );
    params.push(nowIso);
  }
  if (await DbPromise.tableExists('demo_session_tenants')) {
    expiryClauses.push(
      `EXISTS (SELECT 1 FROM demo_session_tenants dt
               WHERE dt.tenant_org_id = o.id AND dt.ttl_expires_at < ?)`
    );
    params.push(nowIso);
  }

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

  const sql = `
    SELECT o.id, o.name, o.organization_type, o.created_at
    FROM organizations o
    WHERE (${idClause})
      AND COALESCE(o.organization_type, '') = 'DEMO'
      AND LOWER(COALESCE(o.billing_status, '')) NOT IN ('paid', 'active', 'past_due')
      AND (${expiryClauses.join(' OR ')})
      AND ${realMemberGuard}
    ORDER BY o.created_at ASC NULLS FIRST
    LIMIT ${Math.max(1, Math.floor(limit))}
  `;

  const rows = await DbPromise.all<DemoCleanupCandidate>(sql, params, { fallback: true });

  // (6) whitelist filter (id + name) in app code — cheap and readable.
  const whitelist = buildWhitelist(env);
  return (rows || []).filter((r) => {
    const idL = String(r.id ?? '').toLowerCase();
    const nameL = String(r.name ?? '').toLowerCase();
    return !whitelist.has(idL) && !whitelist.has(nameL);
  });
}

// ==========================================
// CLEANUP
// ==========================================

/**
 * Reclaim expired demo scaffolding.
 * @returns number of demo orgs actually deleted (0 in dry-run).
 */
export async function cleanupExpiredDemos(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const enabled = isEnabled(env);
  const limit = perRunLimit(env);

  const candidates = await findExpiredDemoCandidates(limit, env);

  if (candidates.length === 0) {
    logger.info('[DemoService] cleanupExpiredDemos: no expired demo orgs to reclaim');
    return 0;
  }

  const idList = candidates.map((c) => c.id);
  logger.info(
    `[DemoService] cleanupExpiredDemos: ${candidates.length} expired demo org(s) ` +
      `[mode=${enabled ? 'DELETE' : 'DRY-RUN'}, limit=${limit}] -> ${idList.join(', ')}`
  );

  if (!enabled) {
    logger.warn(
      '[DemoService] DRY-RUN — set DEMO_CLEANUP_ENABLED=true to actually delete. Nothing removed.'
    );
    return 0;
  }

  let deleted = 0;
  for (const candidate of candidates) {
    try {
      // deleteDemoDatasetForOrganization removes children first and the org row
      // last (FK-aware). Wrap the whole per-org purge in a transaction so a
      // failure mid-way rolls back cleanly and never leaves a half-deleted org.
      await DbPromise.run('BEGIN', [], { fallback: true });
      await deleteDemoDatasetForOrganization(candidate.id);
      await DbPromise.run('COMMIT', [], { fallback: true });
      deleted += 1;
      logger.info(`[DemoService] reclaimed demo org ${candidate.id} (${candidate.name ?? '—'})`);
    } catch (error: unknown) {
      try {
        await DbPromise.run('ROLLBACK', [], { fallback: true });
      } catch {
        /* rollback best-effort */
      }
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
