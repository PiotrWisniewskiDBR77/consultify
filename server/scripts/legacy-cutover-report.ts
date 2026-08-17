#!/usr/bin/env tsx
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T15 — the zero-writer / parity report.
 *
 * The report is GENERATED, not written by hand, for one reason: a hand-written
 * table drifts from the runtime the day after it is written, and this lane
 * exists precisely because status documents drifted from what the server does.
 * Every row here is derived from three machine-readable sources:
 *
 *   1. `server/src/services/legacyCutover/registry*` — the writers the running
 *      server actually guards, and the state each is in. A writer that is not
 *      in the registry is not guarded, and the report says so.
 *   2. `docs/.../inventory/*.json` — the evidence-anchored inventory, which is
 *      broader than the registry: it includes writers no guard covers yet.
 *   3. Optionally, `legacy_cutover_usage_events` — the observed traffic. Pass
 *      `--database-url` to include it. Without it the report states plainly
 *      that no telemetry window was read, rather than implying zero usage.
 *
 * The distinction in point 3 is the whole point of the exercise: an empty
 * telemetry table and an unread telemetry table look identical in a spreadsheet
 * and mean opposite things.
 *
 * Usage:
 *   tsx server/scripts/legacy-cutover-report.ts [--database-url postgres://...] [--out <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EVIDENCE_DIR = path.join(
  REPO_ROOT,
  'docs/program/evidence/closure/codex/CLAUDE-NEXT-LEGACY-CUTOVER'
);
const INVENTORY_DIR = path.join(EVIDENCE_DIR, 'inventory');

type WriterState = 'disabled' | 'protected' | 'observed' | 'owner-blocked';

interface RegistryWriterRow {
  configKey: string;
  domain: string;
  writerId: string;
  method: string;
  pathSource: string;
  state: WriterState;
  successor: string | null;
  legacyTable: string | null;
  reason: string;
  rollbackEnv: string;
  rollbackWritersEnv: string;
}

interface TelemetryRow {
  domain: string;
  writer_id: string | null;
  access_kind: string;
  tenants: string;
  observations: string;
}

function parseArgs(argv: string[]): { databaseUrl?: string; out: string } {
  let databaseUrl: string | undefined;
  let out = EVIDENCE_DIR;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--database-url') databaseUrl = argv[index + 1];
    if (argv[index] === '--out') out = path.resolve(argv[index + 1] || out);
  }
  return { databaseUrl, out };
}

async function loadRegistry(): Promise<RegistryWriterRow[]> {
  const rows: RegistryWriterRow[] = [];
  const registryModule = await import('../src/services/legacyCutover/registry.js');
  const registries: Record<string, any> = { ...(registryModule.CUTOVER_REGISTRY || {}) };

  // Per-domain registry files are optional; a missing one means that domain has
  // no guard yet, which the report must show rather than hide.
  const perDomainDir = path.join(REPO_ROOT, 'server/src/services/legacyCutover/registry');
  if (fs.existsSync(perDomainDir)) {
    for (const file of fs.readdirSync(perDomainDir).filter((name) => name.endsWith('.ts')).sort()) {
      const imported: Record<string, any> = await import(
        path.join(perDomainDir, file).replace(/\.ts$/, '.js')
      );
      // Deduplicate by object identity: a module that exports the same config
      // both as a named const and as its default would otherwise be counted
      // twice and every one of its writers would appear twice in the report.
      const seen = new Set<unknown>();
      for (const [exportName, value] of Object.entries(imported)) {
        if (value && typeof value === 'object' && Array.isArray((value as any).writers)) {
          if (seen.has(value)) continue;
          seen.add(value);
          registries[`${path.basename(file, '.ts')}:${exportName}`] = value;
        }
      }
    }
  }

  for (const [configKey, config] of Object.entries(registries)) {
    for (const writer of config.writers || []) {
      rows.push({
        configKey,
        domain: config.domain,
        writerId: writer.writerId,
        method: writer.method,
        pathSource: String(writer.path),
        state: writer.state,
        successor: writer.successor ?? null,
        legacyTable: writer.legacyTable ?? null,
        reason: writer.reason,
        rollbackEnv: config.rollbackEnv,
        rollbackWritersEnv: config.rollbackWritersEnv,
      });
    }
  }
  return rows.sort((a, b) => a.writerId.localeCompare(b.writerId));
}

function loadInventory(): Record<string, any> {
  const inventories: Record<string, any> = {};
  if (!fs.existsSync(INVENTORY_DIR)) return inventories;
  for (const file of fs.readdirSync(INVENTORY_DIR).filter((name) => name.endsWith('.json'))) {
    inventories[path.basename(file, '.json')] = JSON.parse(
      fs.readFileSync(path.join(INVENTORY_DIR, file), 'utf8')
    );
  }
  return inventories;
}

async function loadTelemetry(databaseUrl: string): Promise<TelemetryRow[]> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<TelemetryRow>(
      `SELECT domain, writer_id, access_kind,
              count(DISTINCT organization_id) FILTER (WHERE tenant_resolution = 'resolved')::text AS tenants,
              count(*)::text AS observations
         FROM legacy_cutover_usage_events
        GROUP BY domain, writer_id, access_kind
        ORDER BY domain, writer_id, access_kind`
    );
    return result.rows;
  } finally {
    await pool.end();
  }
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function render(params: {
  registry: RegistryWriterRow[];
  inventories: Record<string, any>;
  telemetry: TelemetryRow[] | null;
  generatedFromSha: string;
}): string {
  const { registry, inventories, telemetry, generatedFromSha } = params;
  const counts = registry.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.state] = (accumulator[row.state] || 0) + 1;
    return accumulator;
  }, {});

  const inventoryTotals = Object.entries(inventories)
    .map(([domain, data]) => ({
      domain,
      writers: (data.writers || []).length,
      readers: (data.readers || []).length,
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  const lines: string[] = [];
  lines.push('# Legacy cutover — zero-writer / parity report');
  lines.push('');
  lines.push(`Generated from \`${generatedFromSha}\` by \`server/scripts/legacy-cutover-report.ts\`.`);
  lines.push('Do not edit by hand — re-run the script.');
  lines.push('');

  lines.push('## Telemetry window');
  if (!telemetry) {
    lines.push('');
    lines.push(
      'NO TELEMETRY WINDOW WAS READ. This report was generated without `--database-url`, so it makes'
    );
    lines.push(
      'no claim about observed usage. An unread telemetry table and an empty one are not the same thing,'
    );
    lines.push('and no writer may be retired on the strength of this run alone.');
  } else if (telemetry.length === 0) {
    lines.push('');
    lines.push(
      'The telemetry table was read and contained no observations. On a fresh database this means the'
    );
    lines.push(
      'window has not started yet — it is NOT evidence that the writers are unused in a deployed'
    );
    lines.push('environment.');
  } else {
    lines.push('');
    lines.push('| domain | writer | access kind | tenants | observations |');
    lines.push('| --- | --- | --- | ---: | ---: |');
    for (const row of telemetry) {
      lines.push(
        `| ${row.domain} | ${row.writer_id || '_(unmatched traffic)_'} | ${row.access_kind} | ${row.tenants} | ${row.observations} |`
      );
    }
  }
  lines.push('');

  lines.push('## Guarded writers');
  lines.push('');
  lines.push(
    `disabled ${counts.disabled || 0} · protected ${counts.protected || 0} · observed ${counts.observed || 0} · owner-blocked ${counts['owner-blocked'] || 0} — ${registry.length} total.`
  );
  lines.push('');
  lines.push('| writer | domain | method | router-local path | state | canonical successor | legacy table | rollback lever | reason |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of registry) {
    lines.push(
      `| ${row.writerId} | ${row.domain} | ${row.method} | \`${escapePipes(row.pathSource)}\` | ${row.state} | ${row.successor ? `\`${escapePipes(row.successor)}\`` : '_none_' } | ${row.legacyTable || '_n/a_'} | \`${row.rollbackWritersEnv}\` | ${escapePipes(row.reason)} |`
    );
  }
  lines.push('');

  lines.push('## Inventory coverage');
  lines.push('');
  lines.push(
    'The two columns are counted differently and neither contains the other. The inventory records'
  );
  lines.push(
    'writers no guard covers yet; the registry records writers found while wiring the guards that the'
  );
  lines.push(
    'inventory had not enumerated separately (the Partner sibling routers, the economics surface).'
  );
  lines.push('Where guarded exceeds inventoried, the registry found more than the sweep did.');
  lines.push('');
  lines.push('| domain | writers inventoried | readers inventoried | writers guarded |');
  lines.push('| --- | ---: | ---: | ---: |');
  let inventoriedWriters = 0;
  for (const entry of inventoryTotals) {
    const guarded = registry.filter(
      (row) => row.domain.toLowerCase() === entry.domain.toLowerCase()
    ).length;
    inventoriedWriters += entry.writers;
    lines.push(`| ${entry.domain} | ${entry.writers} | ${entry.readers} | ${guarded} |`);
  }
  lines.push(`| **total** | **${inventoriedWriters}** | **${inventoryTotals.reduce((sum, entry) => sum + entry.readers, 0)}** | **${registry.length}** |`);
  lines.push('');

  lines.push('## Rules this report is generated under');
  lines.push('');
  lines.push('- A writer is `disabled` only if the running code refuses it by default.');
  lines.push('- A `successor` is a handler found in code that performs the equivalent canonical write.');
  lines.push('- No writer is retired on the strength of a ripgrep for callers, or of a passing test suite.');
  lines.push('- Every writer that is NOT disabled carries a state and a reason in the table above.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const { databaseUrl, out } = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry();
  const inventories = loadInventory();
  const telemetry = databaseUrl ? await loadTelemetry(databaseUrl) : null;

  const generatedFromSha =
    process.env.CUTOVER_REPORT_SHA ||
    (await import('node:child_process'))
      .execSync('git rev-parse HEAD', { cwd: REPO_ROOT })
      .toString()
      .trim();

  fs.mkdirSync(out, { recursive: true });
  const markdown = render({ registry, inventories, telemetry, generatedFromSha });
  fs.writeFileSync(path.join(out, 'ZERO_WRITER_PARITY_REPORT.md'), markdown);
  fs.writeFileSync(
    path.join(out, 'ZERO_WRITER_PARITY_REPORT.json'),
    `${JSON.stringify(
      {
        generatedFromSha,
        telemetryWindowRead: Boolean(databaseUrl),
        registry,
        inventoryTotals: Object.entries(inventories).map(([domain, data]: [string, any]) => ({
          domain,
          writers: (data.writers || []).length,
          readers: (data.readers || []).length,
        })),
        telemetry,
      },
      null,
      2
    )}\n`
  );
  process.stdout.write(
    `report written to ${out} (${registry.length} guarded writers, telemetry ${databaseUrl ? 'read' : 'NOT read'})\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error)}\n`);
  process.exit(1);
});
