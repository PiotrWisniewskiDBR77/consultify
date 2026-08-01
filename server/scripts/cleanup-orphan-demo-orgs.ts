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
 *   - Only orgs whose id matches `${DEMO_ORG_ID}-session-%` are ever considered
 *     (pattern derived from the SAME env var demoSessionService uses). A
 *     belt-and-braces guard also refuses any target whose name is NOT the
 *     expected ephemeral name unless `--allow-any-name` is passed.
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
 * `${DEMO_ORG_ID}-session-<user>-<ts>`. The pattern MUST be derived from the same
 * env var: demo/staging examples set `DEMO_ORG_ID=atelier`, and a hardcoded
 * `demo-org-session-%` silently matched nothing there — a cleanup that reports
 * "already clean" while ephemeral orgs keep accumulating (OPS-DEMO-002 §5).
 */
const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'demo-org';
const ORG_ID_PATTERN = `${DEMO_ORG_ID}-session-%`;
const EXPECTED_NAME = process.env.DEMO_ORG_NAME || 'Atelier Toys';

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply') || argv.includes('--yes'),
    allowAnyName: argv.includes('--allow-any-name'),
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

  console.log('');
  console.log(`${colors.bold}K7 — cleanup orphan demo orgs (${ORG_ID_PATTERN})${colors.reset}`);
  log.info(`DB host: ${hostForLog}`);
  log.info(`Mode: ${args.apply ? `${colors.red}APPLY (destructive)${colors.reset}` : `${colors.green}DRY-RUN (no writes)${colors.reset}`}`);
  console.log('');

  const client = new Client({ connectionString: cs });
  await client.connect();
  try {
    // 1) Resolve targets.
    const limitSql = args.limit ? ` LIMIT ${args.limit}` : '';
    let targets = await q<{ id: string; name: string | null; created_at: string | null }>(
      client,
      `SELECT id, name, created_at FROM organizations
        WHERE id LIKE $1
        ORDER BY created_at NULLS LAST${limitSql}`,
      [ORG_ID_PATTERN]
    );

    if (!targets.length) {
      log.ok(`No organizations match ${ORG_ID_PATTERN}. Nothing to clean. (DB is already clean of K7 residue.)`);
      return;
    }

    // Never touch the curated base org itself, whatever the pattern matches.
    const selfReferential = targets.filter((t) => t.id === DEMO_ORG_ID);
    if (selfReferential.length) {
      throw new Error(
        `Refusing: the pattern matched the curated base org ${DEMO_ORG_ID} itself. Aborting to protect the demo dataset.`
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
    log.info(`Found ${colors.bold}${targets.length}${colors.reset} orphan org(s) matching ${ORG_ID_PATTERN}.`);
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
      criteria: { orgIdPattern: ORG_ID_PATTERN, expectedName: EXPECTED_NAME, limit: args.limit ?? null },
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
