#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * QD3 — sweep DANGLING demo-clone residue (rows whose `organization_id` still
 * points at an `ateliertoys-demo-session-*` clone that no longer has an
 * `organizations` row).
 *
 * WHY THIS EXISTS (measured 2026-09-18 on a `pg_restore` copy of the staging
 * dump, evidence/qd3-sieroty-20260918/):
 *   `cleanup-orphan-demo-orgs.ts` (K7) and `organizationLifecycleService` both
 *   start from an `organizations` row. Once that row is gone they find nothing —
 *   K7's second pass prints "DB is already clean" while 23 331 rows across 127
 *   dead clone ids are still on disk. Those rows live in tables that hold an
 *   `organization_id` column WITHOUT a declared FK to `organizations`
 *   (work_signal_runs, work_signals, artifact_lineage_events,
 *   artifact_lineage_receipts, v8_artifact_origin_links, …), so no CASCADE ever
 *   reaches them. This tool is the missing second half: it sweeps by VALUE, not
 *   by org row.
 *
 * SAFETY MODEL (same two-key spirit as K7):
 *   - DRY-RUN BY DEFAULT: prints the per-table plan and writes nothing.
 *   - `--apply` additionally requires `FORCE_PURGE=true`.
 *   - Refuses a connection string that looks like PRODUCTION (centerbeam) unless
 *     `ALLOW_PROD=true` is also set.
 *   - Only rows whose id starts LITERALLY with `${DEMO_ORG_ID}-session-` are
 *     candidates (`left(col::text, char_length($1)) = $1`, never a LIKE with an
 *     interpolated env var), AND whose id has no `organizations` row. A clone
 *     that still HAS an org row is left alone by default — that is K7 / the
 *     lifecycle service's job (`--include-live-orgs` overrides, and then only
 *     after the same literal-prefix test).
 *   - `organizations` itself is never a target table.
 *   - Tables carrying a BEFORE DELETE trigger (append-only audit log
 *     `results_writer_observations`) are SKIPPED and REPORTED, never forced:
 *     deleting from them is a policy decision, not an operator reflex.
 *   - Every deleted row is streamed to a JSONL backup under `server/_backup/`
 *     BEFORE the transaction commits; the whole run is one transaction, so a
 *     failure leaves the database exactly as it was.
 *   - Idempotent by construction: the candidate predicate is "dangling clone
 *     row", which is false for every row the previous pass deleted. A second
 *     pass must report 0 — that is the acceptance test, not a hope.
 *
 * Usage:
 *   cd server
 *   # 1) DRY-RUN
 *   DATABASE_PUBLIC_URL="postgres://…/railway" DEMO_ORG_ID=ateliertoys-demo \
 *     npx tsx scripts/cleanup-orphan-demo-residue.ts
 *   # 2) APPLY
 *   DATABASE_PUBLIC_URL="…" DEMO_ORG_ID=ateliertoys-demo FORCE_PURGE=true \
 *     npx tsx scripts/cleanup-orphan-demo-residue.ts --apply
 *
 * NOT wired into any boot/autorun path. Operator tool only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { discoverOrganizationScopedColumns } from '../src/services/organizationLifecycleService.js';

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

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'demo-org';
const ORG_ID_PREFIX = `${DEMO_ORG_ID}-session-`;
const BATCH = (() => {
  const n = Number(process.env.RESIDUE_BATCH || 5000);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50000) : 5000;
})();

function qi(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply') || argv.includes('--yes'),
    includeLiveOrgs: argv.includes('--include-live-orgs'),
  };
}

function resolveConnString(): string {
  const cs = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || '';
  if (!cs) {
    throw new Error('No connection string. Set DATABASE_PUBLIC_URL (preferred) or DATABASE_URL.');
  }
  return cs;
}

function assertNotProd(cs: string, apply: boolean) {
  if (/centerbeam/i.test(cs) && process.env.ALLOW_PROD !== 'true') {
    throw new Error(
      'Connection string looks like PRODUCTION (centerbeam). Refusing. Set ALLOW_PROD=true only if that is really the intent.'
    );
  }
  if (apply && process.env.FORCE_PURGE !== 'true') {
    throw new Error('--apply requires FORCE_PURGE=true (two-key safety).');
  }
}

/** Tables whose rows are immutable by trigger — swept nowhere, reported always. */
async function appendOnlyTables(c: any, tables: string[]): Promise<Map<string, string[]>> {
  const blocked = new Map<string, string[]>();
  for (const t of tables) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query(
      `SELECT tgname FROM pg_trigger
        WHERE tgrelid = $1::regclass AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE '%BEFORE DELETE%'
        ORDER BY tgname`,
      [`public.${t}`]
    );
    if (r.rowCount) blocked.set(t, r.rows.map((x: any) => x.tgname));
  }
  return blocked;
}

function candidateWhere(kolumna: string, includeLiveOrgs: boolean, tabela: string): string {
  const col = `${qi(tabela)}.${qi(kolumna)}::text`;
  const literalPrefix = `left(${col}, char_length($1)) = $1`;
  return includeLiveOrgs
    ? literalPrefix
    : `${literalPrefix} AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ${col})`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  console.log(`${colors.bold}QD3 — sweep dangling demo-clone residue (prefix "${ORG_ID_PREFIX}")${colors.reset}`);
  log.info(`DB host: ${hostForLog}`);
  log.info(`Mode: ${args.apply ? `${colors.red}APPLY (destructive)${colors.reset}` : `${colors.green}DRY-RUN (no writes)${colors.reset}`}`);
  log.info(`Scope: ${args.includeLiveOrgs ? 'ALL clone-prefixed rows (--include-live-orgs)' : 'only rows whose clone org row is GONE (dangling)'}`);
  console.log('');

  const client = new Client({ connectionString: cs });
  await client.connect();
  try {
    const scoped: Array<{ tabela: string; kolumna: string; typ: string }> =
      await discoverOrganizationScopedColumns(client);
    log.info(`Organization-scoped columns discovered: ${scoped.length}`);

    const plan: Array<{ tabela: string; kolumna: string; typ: string; n: number }> = [];
    for (const k of scoped) {
      // eslint-disable-next-line no-await-in-loop
      const r = await client.query(
        `SELECT count(*)::int AS n FROM ${qi(k.tabela)} ${qi(k.tabela)} WHERE ${candidateWhere(k.kolumna, args.includeLiveOrgs, k.tabela)}`,
        [ORG_ID_PREFIX]
      );
      const n = Number(r.rows[0]?.n || 0);
      if (n > 0) plan.push({ ...k, n });
    }

    if (!plan.length) {
      log.ok('No dangling clone residue found. Nothing to sweep (2nd pass = 0 is the expected idempotent result).');
      return;
    }

    const blocked = await appendOnlyTables(client, [...new Set(plan.map((p) => p.tabela))]);
    const sweepable = plan.filter((p) => !blocked.has(p.tabela));
    const skipped = plan.filter((p) => blocked.has(p.tabela));

    log.info(`Tables with residue: ${new Set(plan.map((p) => p.tabela)).size}, rows: ${plan.reduce((a, b) => a + b.n, 0)}`);
    sweepable.forEach((p) => console.log(`   - ${p.tabela}.${p.kolumna} (${p.typ}): ${p.n}`));
    if (skipped.length) {
      log.warn(`SKIPPED — append-only (BEFORE DELETE trigger), needs a CTO policy decision, never forced:`);
      skipped.forEach((p) =>
        console.log(`   - ${p.tabela}.${p.kolumna}: ${p.n} row(s), trigger(s): ${(blocked.get(p.tabela) || []).join(', ')}`)
      );
    }
    console.log('');

    if (!args.apply) {
      log.ok('DRY-RUN complete. No changes made.');
      log.step(`Sweepable rows: ${sweepable.reduce((a, b) => a + b.n, 0)}. Re-run with: --apply FORCE_PURGE=true`);
      return;
    }

    if (!sweepable.length) {
      log.warn('Nothing sweepable (every residue table is append-only). No changes made.');
      return;
    }

    const backupDir = path.resolve(__dirname, '..', '_backup', `qd3-residue-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    fs.mkdirSync(backupDir, { recursive: true });
    log.info(`Backup dir: ${backupDir}`);

    await client.query('BEGIN');
    const deleted: Record<string, number> = {};
    let total = 0;
    try {
      for (const p of sweepable) {
        const file = path.join(backupDir, `${p.tabela}.${p.kolumna}.jsonl`);
        const ws = fs.createWriteStream(file, { flags: 'a' });
        let n = 0;
        for (;;) {
          // ctid batch keeps memory bounded and every row lands in the backup
          // file before the transaction commits.
          // eslint-disable-next-line no-await-in-loop
          const r = await client.query(
            `DELETE FROM ${qi(p.tabela)}
              WHERE ctid IN (
                SELECT ${qi(p.tabela)}.ctid FROM ${qi(p.tabela)}
                 WHERE ${candidateWhere(p.kolumna, args.includeLiveOrgs, p.tabela)}
                 LIMIT ${BATCH})
              RETURNING *`,
            [ORG_ID_PREFIX]
          );
          const rows = r.rows as any[];
          for (const row of rows) ws.write(JSON.stringify(row) + '\n');
          n += rows.length;
          if (rows.length < BATCH) break;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((res, rej) => ws.end((e?: any) => (e ? rej(e) : res())));
        deleted[`${p.tabela}.${p.kolumna}`] = n;
        total += n;
        log.step(`deleted ${n} from ${p.tabela}`);
      }

      // Readback INSIDE the transaction: proof, not a promise.
      const leftovers: string[] = [];
      for (const p of sweepable) {
        // eslint-disable-next-line no-await-in-loop
        const r = await client.query(
          `SELECT count(*)::int AS n FROM ${qi(p.tabela)} ${qi(p.tabela)} WHERE ${candidateWhere(p.kolumna, args.includeLiveOrgs, p.tabela)}`,
          [ORG_ID_PREFIX]
        );
        if (Number(r.rows[0]?.n || 0) > 0) leftovers.push(`${p.tabela}.${p.kolumna}=${r.rows[0].n}`);
      }
      if (leftovers.length) {
        throw new Error(`SWEEP_NOT_PROVEN: residue still present after delete: ${leftovers.join(', ')}`);
      }

      await client.query('COMMIT');
      fs.writeFileSync(
        path.join(backupDir, 'receipt.json'),
        JSON.stringify(
          {
            operation: 'cleanup-orphan-demo-residue',
            dbHost: hostForLog,
            prefix: ORG_ID_PREFIX,
            includeLiveOrgs: args.includeLiveOrgs,
            committedAt: new Date().toISOString(),
            deleted,
            totalDeleted: total,
            skippedAppendOnly: skipped.map((p) => ({ table: p.tabela, column: p.kolumna, rows: p.n, triggers: blocked.get(p.tabela) })),
            rollback: 'Re-insert the JSONL rows into a restored copy; this receipt is evidence, not a restore tool.',
          },
          null,
          2
        )
      );
      log.ok(`COMMITTED: deleted ${total} dangling residue row(s) across ${Object.keys(deleted).length} table.column pair(s).`);
      if (skipped.length) log.warn(`Left behind on purpose: ${skipped.reduce((a, b) => a + b.n, 0)} append-only row(s).`);
      log.step(`Backup: ${backupDir}`);
    } catch (e) {
      await client.query('ROLLBACK');
      log.err(`Sweep failed, transaction rolled back: ${(e as Error).message}`);
      throw e;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  log.err(e?.message || String(e));
  process.exit(1);
});
