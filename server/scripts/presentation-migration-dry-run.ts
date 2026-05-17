/**
 * Presentation pipeline migration dry-run CLI.
 *
 * Read-only entry point that prints a deterministic impact report for
 * the requested presentation migrations and (optionally) writes the
 * full report JSON to disk for the deploy PR audit trail.
 *
 *   npx tsx server/scripts/presentation-migration-dry-run.ts \
 *     --migrations 760,767 \
 *     --organization-id org_123 \
 *     --estimated-deck-count 1500 \
 *     --report-file ./migration-dry-run.json
 *
 * Exit codes:
 *   0 — recommendation `PROCEED`
 *   0 — recommendation `PROCEED_WITH_REVIEW` (warning printed; CI may
 *       opt to fail by setting `PRESENTATION_MIGRATION_FAIL_ON_REVIEW=1`)
 *   1 — recommendation `BLOCK`
 *
 * The CLI is read-only — it never connects to the database and never
 * mutates state. The companion runbook is
 * `docs/operations/PRESENTATION_MIGRATION_RUNBOOK.md`.
 */

import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import {
  buildDryRunReport,
  type DryRunImpactRow,
  type DryRunReport,
  listCatalogIds,
  PRESENTATION_MIGRATION_CATALOG,
} from '../src/services/presentationMigrationDryRunService.js';

interface ParsedArgs {
  migrations: string[];
  organizationIds: string[];
  estimatedDeckCount: number | null;
  estimatedTemplateCount: number | null;
  reportFile: string | null;
  quiet: boolean;
  rollbackCheck: boolean;
  help: boolean;
}

function readArgValue(name: string, argv: string[]): string | null {
  const flagEq = `--${name}=`;
  const flag = `--${name}`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === flag) {
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) return next;
      return '';
    }
    if (a.startsWith(flagEq)) {
      return a.slice(flagEq.length);
    }
  }
  return null;
}

function hasFlag(name: string, argv: string[]): boolean {
  return argv.includes(`--${name}`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const help = hasFlag('help', argv) || hasFlag('h', argv) || argv.length === 0;

  const migrationsRaw = readArgValue('migrations', argv) ?? '';
  const migrations = migrationsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const orgRaw = readArgValue('organization-id', argv);
  const organizationIds = orgRaw
    ? orgRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const deckCountRaw = readArgValue('estimated-deck-count', argv);
  const templateCountRaw = readArgValue('estimated-template-count', argv);
  const reportFile = readArgValue('report-file', argv);

  const estimatedDeckCount =
    deckCountRaw != null && deckCountRaw !== '' && Number.isFinite(Number(deckCountRaw))
      ? Number(deckCountRaw)
      : null;
  const estimatedTemplateCount =
    templateCountRaw != null &&
    templateCountRaw !== '' &&
    Number.isFinite(Number(templateCountRaw))
      ? Number(templateCountRaw)
      : null;

  return {
    migrations,
    organizationIds,
    estimatedDeckCount,
    estimatedTemplateCount,
    reportFile: reportFile && reportFile.length > 0 ? reportFile : null,
    quiet: hasFlag('quiet', argv),
    rollbackCheck: hasFlag('rollback-check', argv),
    help,
  };
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + ' '.repeat(width - value.length);
}

function formatRows(rows: DryRunImpactRow[]): string {
  if (rows.length === 0) return '(no migrations requested)';
  const headers = ['ID', 'CATEGORY', 'RISK', 'ROWS', 'DURATION_S', 'REVERSIBLE', 'BLOCKERS'];
  const widths = [44, 16, 5, 10, 12, 11, 7];
  const lines: string[] = [];
  lines.push(headers.map((h, i) => pad(h, widths[i])).join('  '));
  lines.push(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    lines.push(
      [
        pad(row.migrationId, widths[0]),
        pad(row.category, widths[1]),
        pad(row.riskTier, widths[2]),
        pad(String(row.estimatedRowsAffected), widths[3]),
        pad(String(row.estimatedDurationSeconds), widths[4]),
        pad(row.rollbackPossible ? 'yes' : 'NO', widths[5]),
        pad(String(row.blockers.length), widths[6]),
      ].join('  ')
    );
  }
  return lines.join('\n');
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Presentation migration dry-run CLI',
      '',
      'Usage:',
      '  npx tsx server/scripts/presentation-migration-dry-run.ts \\',
      '    --migrations 760,767 \\',
      '    --organization-id org_123 \\',
      '    --estimated-deck-count 1500 \\',
      '    [--estimated-template-count 50] \\',
      '    [--report-file ./migration-dry-run.json] \\',
      '    [--rollback-check] [--quiet]',
      '',
      'Args:',
      '  --migrations             Comma-separated migration ids (without .sql).',
      '                           Use a numeric prefix (e.g. "760") or full id',
      '                           (e.g. "760_presentation_legacy_normalization").',
      '  --organization-id        Optional comma-separated org scope.',
      '  --estimated-deck-count   Optional integer; drives row/duration estimates.',
      '  --estimated-template-count Optional integer.',
      '  --report-file            Optional path; writes the full JSON report.',
      '  --rollback-check         Same dry-run with extra rollback validation pass.',
      '  --quiet                  Suppress stdout (useful for CI).',
      '',
      'Exit codes: 0 = PROCEED / PROCEED_WITH_REVIEW (unless',
      'PRESENTATION_MIGRATION_FAIL_ON_REVIEW=1), 1 = BLOCK or fatal error.',
      '',
      'Known catalog ids:',
      ...listCatalogIds().map((id) => `  - ${id}`),
    ].join('\n')
  );
}

/**
 * Resolve a user-supplied migration token (e.g. `760` or
 * `760_presentation_legacy_normalization`) to a canonical catalog id.
 * Unknown tokens are returned as-is so the dry-run report surfaces them
 * as blockers.
 */
function resolveMigrationToken(token: string): string {
  const known = listCatalogIds();
  if (known.includes(token)) return token;
  const numericPrefix = token.match(/^\d+/)?.[0];
  if (!numericPrefix) return token;
  const matched = known.find((id) => id.startsWith(`${numericPrefix}_`));
  return matched ?? token;
}

function buildRollbackChecklist(report: DryRunReport): string[] {
  const out: string[] = [];
  for (const row of report.impact) {
    const entry = PRESENTATION_MIGRATION_CATALOG.find((e) => e.id === row.migrationId);
    if (!entry) {
      out.push(`- [ ] ${row.migrationId}: UNKNOWN — review required (no catalog entry)`);
      continue;
    }
    out.push(
      `- [ ] ${entry.id}: rollback strategy = ${entry.rollbackStrategy}` +
        (entry.reversible ? '' : ' (NOT REVERSIBLE — manual review required)')
    );
  }
  return out;
}

function main(): number {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.help && args.migrations.length === 0) {
    printHelp();
    return 0;
  }

  if (args.migrations.length === 0) {
    if (!args.quiet) {
      // eslint-disable-next-line no-console
      console.error('Error: --migrations is required (comma-separated ids).');
    }
    return 1;
  }

  const resolvedIds = args.migrations.map(resolveMigrationToken);
  const report = buildDryRunReport({
    migrationIds: resolvedIds,
    organizationIds: args.organizationIds.length > 0 ? args.organizationIds : undefined,
    estimatedDeckCount: args.estimatedDeckCount ?? undefined,
    estimatedTemplateCount: args.estimatedTemplateCount ?? undefined,
  });

  if (args.reportFile) {
    try {
      const fullPath = resolvePath(process.cwd(), args.reportFile);
      writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf8');
      if (!args.quiet) {
        // eslint-disable-next-line no-console
        console.log(`Wrote dry-run report → ${fullPath}`);
      }
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error(
        `Failed to write report file: ${err instanceof Error ? err.message : String(err)}`
      );
      return 1;
    }
  }

  if (!args.quiet) {
    // eslint-disable-next-line no-console
    console.log('Presentation Migration Dry-Run Report');
    // eslint-disable-next-line no-console
    console.log(`Generated: ${report.generatedAt}`);
    // eslint-disable-next-line no-console
    console.log(
      `Scope: ${
        report.scope.organizationIds === 'global'
          ? 'global'
          : report.scope.organizationIds.join(',')
      }`
    );
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(formatRows(report.impact));
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(
      `Totals: migrations=${report.totals.migrations}, P0=${report.totals.p0}, ` +
        `P1=${report.totals.p1}, P2=${report.totals.p2}, ` +
        `reversible=${report.totals.reversibleCount}, non-reversible=${report.totals.nonReversibleCount}`
    );
    if (report.blockers.length > 0) {
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('Blockers:');
      for (const b of report.blockers) {
        // eslint-disable-next-line no-console
        console.log(`  - ${b}`);
      }
    }
    if (args.rollbackCheck) {
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('Rollback validation pass:');
      for (const line of buildRollbackChecklist(report)) {
        // eslint-disable-next-line no-console
        console.log(`  ${line}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(`Recommendation: ${report.recommendation}`);
    if (report.recommendation === 'PROCEED_WITH_REVIEW') {
      // eslint-disable-next-line no-console
      console.log(
        'Note: PROCEED_WITH_REVIEW — backend lead + ops sign-off required before apply.'
      );
    }
  }

  if (report.recommendation === 'BLOCK') return 1;
  if (
    report.recommendation === 'PROCEED_WITH_REVIEW' &&
    process.env.PRESENTATION_MIGRATION_FAIL_ON_REVIEW === '1'
  ) {
    return 1;
  }
  return 0;
}

try {
  const code = main();
  process.exit(code);
} catch (err: unknown) {
  // eslint-disable-next-line no-console
  console.error('Fatal error in presentation-migration-dry-run:', err);
  process.exit(1);
}
