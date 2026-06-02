/**
 * Audit Integrity Check (Epic K3 closure) — CLI runner.
 *
 * Scans applied agent edits + successful exports for the given organization
 * and confirms each has a matching audit_event row within the
 * `AUDIT_LATENCY_BUDGET_MS` budget. Designed to run nightly (cron suggestion
 * `0 6 * * *`) and surface compliance regressions before they accumulate.
 *
 * Usage:
 *   npx tsx server/scripts/check-audit-integrity.ts \
 *     --organization-id org_123 \
 *     --window-days 7 \
 *     --report-file ./audit-integrity-report.json
 *
 * Optional flags:
 *   --quiet          Suppress stdout summary (still writes report file).
 *   --alert          When verdict is BLOCKED_P1, fire a synthetic governance
 *                    alert transition through `dispatchAlertsForTransition`.
 *                    OPT-IN — manual runs without `--alert` never fire alerts.
 *
 * Exit codes:
 *   0  PASS / PASS_WITH_P2
 *   1  BLOCKED_P1
 *   2  argument or runtime error
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  buildAuditIntegrityReport,
  type IntegrityCheckReport,
} from '../src/services/presentationAuditIntegrityService.js';
import { dispatchAlertsForTransition } from '../src/services/presentationGovernanceAlertService.js';
import logger from '../src/utils/Logger.js';

// ---------------------------------------------------------------------------
// CLI types
// ---------------------------------------------------------------------------

interface CliArgs {
  organizationId: string;
  windowDays: number;
  reportFile: string | null;
  quiet: boolean;
  alert: boolean;
}

interface ParseOk {
  ok: true;
  args: CliArgs;
}

interface ParseErr {
  ok: false;
  error: string;
}

const KNOWN_FLAGS = new Set([
  '--organization-id',
  '--window-days',
  '--report-file',
  '--quiet',
  '--alert',
]);

const KNOWN_FLAG_PREFIXES = [
  '--organization-id=',
  '--window-days=',
  '--report-file=',
  '--quiet=',
  '--alert=',
];

const EXIT_OK = 0;
const EXIT_BLOCKED = 1;
const EXIT_ARG_ERROR = 2;

const WINDOW_DAYS_MIN = 1;
const WINDOW_DAYS_MAX = 90;
const WINDOW_DAYS_DEFAULT = 7;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function isKnownFlag(token: string): boolean {
  if (KNOWN_FLAGS.has(token)) return true;
  for (const prefix of KNOWN_FLAG_PREFIXES) {
    if (token.startsWith(prefix)) return true;
  }
  return false;
}

function getSingleFlagValue(name: string, argv: string[]): string | null {
  const eq = `--${name}=`;
  const bare = `--${name}`;
  let last: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const entry = argv[i];
    if (entry === undefined) continue;
    if (entry.startsWith(eq)) {
      last = entry.slice(eq.length);
    } else if (entry === bare) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        last = next;
        i++;
      } else {
        last = '';
      }
    }
  }
  return last;
}

function hasBareFlag(name: string, argv: string[]): boolean {
  if (argv.includes(`--${name}`)) return true;
  return argv.includes(`--${name}=true`);
}

function parseArgs(argv: string[]): ParseOk | ParseErr {
  for (const token of argv) {
    if (token.startsWith('--') && !isKnownFlag(token)) {
      return { ok: false, error: `Unknown flag: ${token}` };
    }
  }

  const orgRaw = getSingleFlagValue('organization-id', argv);
  const organizationId = orgRaw === null ? '' : orgRaw.trim();
  if (organizationId.length === 0) {
    return { ok: false, error: '--organization-id is required' };
  }

  let windowDays = WINDOW_DAYS_DEFAULT;
  const windowRaw = getSingleFlagValue('window-days', argv);
  if (windowRaw !== null && windowRaw !== '') {
    const parsed = Number(windowRaw);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < WINDOW_DAYS_MIN ||
      parsed > WINDOW_DAYS_MAX
    ) {
      return {
        ok: false,
        error:
          `--window-days must be an integer in [${WINDOW_DAYS_MIN}..${WINDOW_DAYS_MAX}] ` +
          `(got "${windowRaw}")`,
      };
    }
    windowDays = parsed;
  }

  const reportFileRaw = getSingleFlagValue('report-file', argv);
  const reportFile =
    reportFileRaw !== null && reportFileRaw !== '' ? reportFileRaw : null;

  const quiet = hasBareFlag('quiet', argv);
  const alert = hasBareFlag('alert', argv);

  return {
    ok: true,
    args: { organizationId, windowDays, reportFile, quiet, alert },
  };
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function writeJsonFile(targetPath: string, payload: unknown): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function logLine(quiet: boolean, message: string): void {
  if (quiet) return;
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

function printSummary(quiet: boolean, args: CliArgs, report: IntegrityCheckReport): void {
  logLine(quiet, '');
  logLine(
    quiet,
    `Audit Integrity Check — ${args.organizationId} (window: ${args.windowDays}d)`
  );
  logLine(
    quiet,
    `Scanned: ${report.totals.agentEditsScanned} edits, ` +
      `${report.totals.exportsScanned} exports, ` +
      `${report.totals.auditEventsScanned} audit events`
  );
  logLine(quiet, `Issues:  ${report.totals.p1} P1, ${report.totals.p2} P2`);
  logLine(quiet, `Verdict: ${report.verdict}`);
  if (report.truncated) {
    logLine(quiet, `Note: issues list truncated to ${report.issues.length} entries.`);
  }
  if (report.warnings.length > 0) {
    logLine(quiet, `Warnings: ${report.warnings.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    logError(`[check-audit-integrity] Argument error: ${parsed.error}`);
    return EXIT_ARG_ERROR;
  }
  const args = parsed.args;

  const result = await buildAuditIntegrityReport({
    organizationId: args.organizationId,
    windowDays: args.windowDays,
  });

  if (result.status !== 'ok' || !result.report) {
    logError(
      `[check-audit-integrity] Storage error: ${result.reason ?? 'unknown'}`
    );
    return EXIT_ARG_ERROR;
  }

  const report = result.report;

  if (args.reportFile) {
    try {
      writeJsonFile(args.reportFile, report);
      logLine(args.quiet, `[check-audit-integrity] JSON report written: ${args.reportFile}`);
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[check-audit-integrity] Failed to write report file: ${String(message)}`);
    }
  }

  printSummary(args.quiet, args, report);

  // Opt-in P1 alert dispatch — manual runs without `--alert` NEVER fire.
  if (args.alert && report.verdict === 'BLOCKED_P1') {
    try {
      const summary = await dispatchAlertsForTransition({
        // Synthetic deckId — `dispatchAlertsForTransition` requires a string,
        // so we use a sentinel that downstream consumers can recognize as a
        // non-deck alert. The audit row records the same id verbatim.
        deckId: 'audit-integrity-check',
        deckTitle: 'Audit Integrity Check',
        fromVerdict: 'PASS',
        toVerdict: 'BLOCKED_P1',
        organizationId: args.organizationId,
        generatedAt: report.generatedAt,
      });
      logLine(
        args.quiet,
        `[check-audit-integrity] Alert dispatch: attempted=${summary.attempted} ` +
          `sent=${summary.sent} failed=${summary.failed} ` +
          `suppressed=${summary.suppressed} dryRun=${summary.dryRun}`
      );
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[check-audit-integrity] Alert dispatch failed: ${String(message)}`);
      logger.error('[check-audit-integrity] Alert dispatch failed', {
        organizationId: args.organizationId,
        error: String(message),
      });
    }
  }

  if (report.verdict === 'BLOCKED_P1') return EXIT_BLOCKED;
  return EXIT_OK;
}

async function main(): Promise<void> {
  let exitCode = EXIT_ARG_ERROR;
  try {
    exitCode = await run();
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[check-audit-integrity] Unhandled failure: ${String(message)}`);
    logger.error('[check-audit-integrity] Unhandled failure', { error: String(message) });
    exitCode = EXIT_ARG_ERROR;
  }
  process.exit(exitCode);
}

void main();
