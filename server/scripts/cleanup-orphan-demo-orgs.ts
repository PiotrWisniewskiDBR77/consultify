#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * K7 — Cleanup ephemeral orphan demo orgs (`demo-org-session-*` "Atelier Toys").
 *
 * Context (rejestr H6.11 STAGE-BLOCKER · decyzja Konstytucja §5 K7):
 *   The TROLLEY/demo database accumulated ~179 ephemeral organizations whose id
 *   looks like `demo-org-session-<hash>-<hash>` and whose name is "Atelier Toys".
 *   They are residue of QA/E2E probes that did NOT clean up after themselves
 *   ([[finding_179_orphan_atelier_toys_orgs_2026-07-12]]). They pollute the
 *   Super Admin customer lists and general org counts — "Dane demo = twarz
 *   produktu". Decision (Piotr, 2026-07-19): DELETE the `demo-org-session-*`
 *   clones, KEEP everything real (`atelier`, DBR77, named orgs).
 *
 * SAFETY MODEL (identical spirit to purge-incomplete-assessments.ts):
 *   - DRY-RUN BY DEFAULT. Prints exact target list + dependent-row counts and
 *     writes NOTHING. Pass `--apply` to actually delete.
 *   - `--apply` additionally REQUIRES `FORCE_PURGE=true` — a deliberate two-key
 *     gate so it can never delete by accident.
 *   - Refuses to run against a host that looks like PRODUCTION (centerbeam)
 *     unless `ALLOW_PROD=true` is ALSO set. demo/staging (TROLLEY) is the target.
 *   - Before any delete it writes a full JSON backup (org rows + every dependent
 *     row it will touch) under server/_backup/.
 *   - Only orgs whose id STARTS WITH `${DEMO_ORG_ID}-session-` are ever
 *     considered (prefix derived from the SAME env var demoSessionService uses).
 *     The match is a literal `left(id, char_length($1)) = $1`, NOT a `LIKE`
 *     pattern: `DEMO_ORG_ID` is operator-supplied and a `%` or `_` in it would
 *     silently widen a `LIKE` into a wildcard that matches unrelated orgs.
 *     A belt-and-braces guard also refuses any target whose name is NOT the
 *     expected ephemeral name unless `--allow-any-name` is passed.
 *   - `--run-id <uuid>` narrows the target to the SINGLE tenant created by one
 *     public-signup saga run (`demoSignupProvisioning.makeProvisionTenantOrgId`),
 *     matched with `=`. That is the exact handle logged as `runId` when a signup
 *     reports INCOMPLETE COMPENSATION.
 *   - The curated base org (`DEMO_ORG_ID`) is never a target, and orgs backing an
 *     ACTIVE unexpired `demo_sessions` row are skipped unless `--include-active`.
 *
 * FK topology (verified on pg18 parity dump 2026-07-19):
 *   organizations.id is referenced by 164 FKs — 129 ON DELETE CASCADE (auto),
 *   8 SET NULL (auto), and 27 NO ACTION (mostly billing / enterprise tables). The
 *   NO ACTION ones would BLOCK the org delete if any child rows exist, so this
 *   script deletes those NO-ACTION dependents first (after backing them up),
 *   then deletes the org rows and lets CASCADE/SET NULL handle the rest.
 *
 * Usage (demo/staging — operator supplies the demo connection string):
 *   cd server
 *   # 1) DRY-RUN (safe, default) — see exactly what would go:
 *   DATABASE_PUBLIC_URL="postgres://…trolley.proxy…/railway" \
 *     npx tsx scripts/cleanup-orphan-demo-orgs.ts
 *   # 2) APPLY (destructive — needs Piotr's OK on the dry-run list first):
 *   DATABASE_PUBLIC_URL="…" FORCE_PURGE=true \
 *     npx tsx scripts/cleanup-orphan-demo-orgs.ts --apply
 *   # 3) Reclaim ONE tenant left behind by a failed signup (runId from the
 *   #    "INCOMPLETE COMPENSATION" log line) — dry-run first, as always:
 *   DATABASE_PUBLIC_URL="…" \
 *     npx tsx scripts/cleanup-orphan-demo-orgs.ts --run-id 6f1c…-…
 *
 * NOTE: this script is intentionally NOT wired into any autorun/boot path. It is
 * an operator tool. It never runs as a side effect of anything.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};
const log = {
  info: (m: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${m}`),
  ok: (m: string) => console.log(`${colors.green}✓${colors.reset} ${m}`),
  warn: (m: string) => console.log(`${colors.yellow}⚠${colors.reset} ${m}`),
  err: (m: string) => console.log(`${colors.red}✗${colors.reset} ${m}`),
  step: (m: string) => console.log(`${colors.dim}  → ${m}${colors.reset}`),
};

/**
 * Session org ids are built by demoSessionService.makeSessionOrgId() as
 * `${DEMO_ORG_ID}-session-<user>-<ts>`, or by
 * demoSignupProvisioning.makeProvisionTenantOrgId() as
 * `${DEMO_ORG_ID}-session-run-<runId>`. The prefix MUST be derived from the same
 * env var: demo/staging examples set `DEMO_ORG_ID=atelier`, and a hardcoded
 * `demo-org-session-` silently matched nothing there — a cleanup that reports
 * "already clean" while ephemeral orgs keep accumulating (OPS-DEMO-002 §5).
 *
 * The prefix is compared literally (`left(id, char_length($1)) = $1`). It used to
 * be `id LIKE '${DEMO_ORG_ID}-session-%'` with the env var interpolated raw, so a
 * `DEMO_ORG_ID` containing `%` or `_` turned the guard into a wildcard.
 */
const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'demo-org';
const ORG_ID_PREFIX = `${DEMO_ORG_ID}-session-`;
const EXPECTED_NAME = process.env.DEMO_ORG_NAME || 'Atelier Toys';

/**
 * Mirror of `demoSignupProvisioning.makeProvisionTenantOrgId`. Duplicated rather
 * than imported: importing that module drags in the middleware / seed / token
 * services and a live DB handle, which an operator script must not need.
 */
function provisionTenantOrgId(runId: string): string {
  const compact = String(runId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'run';
  return `${DEMO_ORG_ID}-session-run-${compact}`;
}

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply') || argv.includes('--yes'),
    allowAnyName: argv.includes('--allow-any-name'),
    /**
     * Exact single-tenant mode: delete ONLY the tenant owned by one provisioning
     * run. Nothing else can ever be matched, because the id carries the full run
     * uuid and is compared with `=`.
     */
    runId: (() => {
      const i = argv.findIndex((a) => a === '--run-id');
      const v = i >= 0 ? String(argv[i + 1] || '').trim() : '';
      return v && !v.startsWith('--') ? v : undefined;
    })(),
    limit: (() => {
      const i = argv.findIndex((a) => a === '--limit');
      const n = i >= 0 ? Number(argv[i + 1]) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    /**
     * Keep orgs that still back an ACTIVE, unexpired `demo_sessions` row. Without
     * this the operator tool can delete the workspace of a prospect who is mid-demo.
     * Pass `--include-active` only for a deliberate full wipe.
     */
    includeActive: argv.includes('--include-active'),
  };
}

function resolveConnString(): string {
  const cs =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    '';
  if (!cs) {
    throw new Error(
      'No connection string. Set DATABASE_PUBLIC_URL (preferred for TROLLEY/demo) or DATABASE_URL.'
    );
  }
  return cs;
}

function assertNotProd(cs: string, apply: boolean) {
  const looksProd = /centerbeam/i.test(cs);
  if (looksProd && process.env.ALLOW_PROD !== 'true') {
    throw new Error(
      'Connection string looks like PRODUCTION (centerbeam). This tool targets demo/staging only.\n' +
        'Refusing. Set ALLOW_PROD=true only if you truly intend to touch production (you almost never do).'
    );
  }
  if (apply && process.env.FORCE_PURGE !== 'true') {
    throw new Error(
      '--apply requires FORCE_PURGE=true (two-key safety). Re-run with FORCE_PURGE=true once the dry-run list is approved.'
    );
  }
}

async function q<T = any>(c: any, sql: string, params: any[] = []): Promise<T[]> {
  const r = await c.query(sql, params);
  return r.rows as T[];
}

/** Tables with a NO ACTION / RESTRICT FK to organizations.id — must be cleared first. */
async function noActionDependentTables(
  c: any
): Promise<Array<{ table: string; column: string }>> {
  const rows = await q<{ table_name: string; column_name: string; delete_rule: string }>(
    c,
    `SELECT tc.table_name, kcu.column_name, rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
       JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'organizations'
        AND ccu.column_name = 'id'
        AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
      ORDER BY tc.table_name`
  );
  return rows.map((r) => ({ table: r.table_name, column: r.column_name }));
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const cs = resolveConnString();
  assertNotProd(cs, args.apply);

  const hostForLog = (() => {
    try {
      return new URL(cs).host;
    } catch {
      return '(unparsed)';
    }
  })();

  const targetOrgId = args.runId ? provisionTenantOrgId(args.runId) : undefined;
  const targetDescription = targetOrgId
    ? `exactly ${targetOrgId} (run ${args.runId})`
    : `id starting with "${ORG_ID_PREFIX}"`;

  console.log('');
  console.log(`${colors.bold}K7 — cleanup orphan demo orgs (${targetDescription})${colors.reset}`);
  log.info(`DB host: ${hostForLog}`);
  log.info(`Mode: ${args.apply ? `${colors.red}APPLY (destructive)${colors.reset}` : `${colors.green}DRY-RUN (no writes)${colors.reset}`}`);
  console.log('');

  const client = new Client({ connectionString: cs });
  await client.connect();
  try {
    // 1) Resolve targets.
    const limitSql = args.limit ? ` LIMIT ${args.limit}` : '';
    // No LIKE anywhere. `--run-id` matches one id with `=`; the sweep compares a
    // literal prefix, so `%`/`_` inside DEMO_ORG_ID cannot widen the match.
    // `id <> $2` keeps the curated base org out of the result set even if a
    // future id scheme were to make the prefix match it.
    let targets = targetOrgId
      ? await q<{ id: string; name: string | null; created_at: string | null }>(
          client,
          `SELECT id, name, created_at FROM organizations
            WHERE id = $1 AND id <> $2`,
          [targetOrgId, DEMO_ORG_ID]
        )
      : await q<{ id: string; name: string | null; created_at: string | null }>(
          client,
          `SELECT id, name, created_at FROM organizations
            WHERE left(id, char_length($1)) = $1 AND id <> $2
            ORDER BY created_at NULLS LAST${limitSql}`,
          [ORG_ID_PREFIX, DEMO_ORG_ID]
        );

    if (!targets.length) {
      log.ok(`No organizations match ${targetDescription}. Nothing to clean. (DB is already clean of K7 residue.)`);
      return;
    }

    // Belt and braces: the SQL already excludes it, so reaching this means the
    // targeting logic itself is broken and the run must not continue.
    const selfReferential = targets.filter((t) => t.id === DEMO_ORG_ID);
    if (selfReferential.length) {
      throw new Error(
        `Refusing: the target set contains the curated base org ${DEMO_ORG_ID} itself. Aborting to protect the demo dataset.`
      );
    }

    // Live-session guard: an org that still backs an active, unexpired demo session
    // belongs to somebody currently walking through the demo.
    let live = new Set<string>();
    if (!args.includeActive) {
      const hasSessions = await q<{ n: string }>(
        client,
        `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name = 'demo_sessions'`
      );
      if (Number(hasSessions[0]?.n || 0) > 0) {
        const activeRows = await q<{ session_org_id: string }>(
          client,
          `SELECT DISTINCT session_org_id
             FROM demo_sessions
            WHERE status = 'active'
              AND expires_at > $1
              AND session_org_id = ANY($2::text[])`,
          [new Date().toISOString(), targets.map((t) => t.id)]
        );
        live = new Set(activeRows.map((r) => r.session_org_id));
      }
      if (live.size) {
        log.warn(`Skipping ${live.size} org(s) with an ACTIVE unexpired demo session (use --include-active to override).`);
        targets = targets.filter((t) => !live.has(t.id));
      }
      if (!targets.length) {
        log.ok('Every matching org is still in an active demo session. Nothing to clean.');
        return;
      }
    }

    if (targetOrgId && targets.length !== 1) {
      throw new Error(
        `Refusing: --run-id must resolve to exactly one org, resolved ${targets.length}.`
      );
    }

    // Name guard.
    const wrongName = targets.filter((t) => (t.name || '') !== EXPECTED_NAME);
    if (wrongName.length && !args.allowAnyName) {
      log.err(
        `${wrongName.length} target(s) do NOT have the expected name "${EXPECTED_NAME}". ` +
          `Refusing (pass --allow-any-name to override after review). Examples:`
      );
      wrongName.slice(0, 10).forEach((t) => console.log(`   - ${t.id} | name=${JSON.stringify(t.name)}`));
      throw new Error('Name-guard tripped; aborting to protect real data.');
    }

    const ids = targets.map((t) => t.id);
    log.info(`Found ${colors.bold}${targets.length}${colors.reset} orphan org(s) matching ${targetDescription}.`);
    targets.slice(0, 15).forEach((t) => console.log(`   - ${t.id} | ${t.name} | ${t.created_at ?? '?'}`));
    if (targets.length > 15) log.step(`... and ${targets.length - 15} more`);
    console.log('');

    // 2) Count NO-ACTION dependents (the ones that would block the delete).
    const blockers = await noActionDependentTables(client);
    log.info(`Checking ${blockers.length} NO-ACTION/RESTRICT dependent table(s) that must be cleared first...`);
    const depCounts: Array<{ table: string; column: string; count: number }> = [];
    for (const b of blockers) {
      // eslint-disable-next-line no-await-in-loop
      const r = await q<{ n: string }>(
        client,
        `SELECT COUNT(*)::int AS n FROM "${b.table}" WHERE "${b.column}" = ANY($1::text[])`,
        [ids]
      );
      const n = Number(r[0]?.n || 0);
      if (n > 0) depCounts.push({ ...b, count: n });
    }
    if (depCounts.length) {
      log.warn(`NO-ACTION dependents present (will be deleted first, after backup):`);
      depCounts.forEach((d) => console.log(`   - ${d.table}.${d.column}: ${d.count}`));
    } else {
      log.ok('No NO-ACTION dependent rows — org rows can be deleted directly (CASCADE handles the rest).');
    }
    console.log('');

    // 3) DRY-RUN stops here.
    if (!args.apply) {
      log.ok('DRY-RUN complete. No changes made.');
      log.step('Review the target list above with Piotr, then re-run with: --apply FORCE_PURGE=true');
      return;
    }

    // 4) APPLY path — backup then delete inside a transaction.
    const backupDir = path.resolve(__dirname, '..', '_backup');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `k7-orphan-orgs-${stamp}.json`);

    const backup: any = {
      kind: 'k7-orphan-demo-orgs-backup',
      createdAt: new Date().toISOString(),
      hostname: os.hostname(),
      dbHost: hostForLog,
      criteria: {
        orgIdPrefix: targetOrgId ? null : ORG_ID_PREFIX,
        orgIdExact: targetOrgId ?? null,
        runId: args.runId ?? null,
        expectedName: EXPECTED_NAME,
        limit: args.limit ?? null,
      },
      organizations: await q(client, `SELECT * FROM organizations WHERE id = ANY($1::text[])`, [ids]),
      noActionDependents: {} as Record<string, any[]>,
    };
    for (const d of depCounts) {
      // eslint-disable-next-line no-await-in-loop
      backup.noActionDependents[`${d.table}.${d.column}`] = await q(
        client,
        `SELECT * FROM "${d.table}" WHERE "${d.column}" = ANY($1::text[])`,
        [ids]
      );
    }
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    log.ok(`Backup written: ${backupPath}`);

    await client.query('BEGIN');
    try {
      let deletedDeps = 0;
      for (const d of depCounts) {
        // eslint-disable-next-line no-await-in-loop
        const r = await client.query(
          `DELETE FROM "${d.table}" WHERE "${d.column}" = ANY($1::text[])`,
          [ids]
        );
        deletedDeps += r.rowCount || 0;
        log.step(`cleared ${r.rowCount || 0} from ${d.table}`);
      }
      const orgDel = await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [ids]);
      await client.query('COMMIT');
      log.ok(`Deleted ${orgDel.rowCount} org row(s) + ${deletedDeps} NO-ACTION dependent row(s). CASCADE handled the rest.`);
      log.step(`Restore from ${backupPath} if needed.`);
    } catch (e) {
      await client.query('ROLLBACK');
      log.err(`Delete failed, transaction rolled back: ${(e as Error).message}`);
      throw e;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  log.err(e.message || String(e));
  process.exit(1);
});
