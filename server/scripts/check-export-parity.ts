/**
 * CI gate: Cross-format presentation export parity check (Epic F1).
 *
 * Purpose:
 *   Computes the parity report for one or more decks via the same pure-logic
 *   service that powers the `/decks/:deckId/export-parity` API endpoint.
 *   Aggregates per-deck verdicts into a global verdict, prints a concise
 *   summary table to stdout, optionally writes a JSON report to disk, and
 *   exits non-zero when any deck fails parity.
 *
 * Usage:
 *   npx tsx server/scripts/check-export-parity.ts \
 *     --deck-ids "deck_a,deck_b,deck_c" \
 *     --organization-id "org_123" \
 *     [--report-file "./parity-report.json"] \
 *     [--quiet]
 *
 * Exit codes:
 *   0 — PASS or PASS_WITH_WARNINGS
 *   1 — FAIL (any deck has critical parity issues)
 *   2 — argument or runtime error
 *
 * References:
 *   docs/testing/PRESENTATION_EXPORT_PARITY.md
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  buildParityReportForDeck,
  type ParityCheckReport,
  type ParityVerdict,
} from '../src/services/presentationExportParityService.js';

const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_ARG_ERROR = 2;

interface ParsedArgs {
  deckIds: string[];
  organizationId: string;
  reportFile: string | null;
  quiet: boolean;
}

interface DeckEntry {
  deckId: string;
  status: 'ok' | 'not_found' | 'storage_error';
  verdict: ParityVerdict | 'UNKNOWN';
  reason?: string;
  report?: ParityCheckReport;
}

interface AggregateReport {
  checkedAt: string;
  organizationId: string;
  totals: {
    checked: number;
    pass: number;
    warning: number;
    fail: number;
    unknown: number;
  };
  globalVerdict: ParityVerdict | 'UNKNOWN';
  decks: DeckEntry[];
}

function logInfo(message: string, quiet: boolean): void {
  if (quiet) return;
  // eslint-disable-next-line no-console
  console.log(message);
}

function logAlways(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

function getFlagValue(argv: string[], name: string): string | null {
  const longEq = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i] ?? '';
    if (cur.startsWith(longEq)) return cur.slice(longEq.length);
    if (cur === `--${name}`) {
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) return next;
      return '';
    }
  }
  return null;
}

function hasBooleanFlag(argv: string[], name: string): boolean {
  const value = getFlagValue(argv, name);
  if (value == null) return false;
  if (value === '' || value.toLowerCase() === 'true') return true;
  return false;
}

function parseArgs(argv: string[]): ParsedArgs {
  const deckIdsCsv = getFlagValue(argv, 'deck-ids');
  if (!deckIdsCsv) {
    throw new Error('Missing required arg: --deck-ids "id1,id2"');
  }
  const deckIds = deckIdsCsv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (deckIds.length === 0) {
    throw new Error('Argument --deck-ids resolved to an empty list. Provide at least one deck id.');
  }
  const organizationId = getFlagValue(argv, 'organization-id');
  if (!organizationId) {
    throw new Error('Missing required arg: --organization-id "org_xxx"');
  }
  const reportFileArg = getFlagValue(argv, 'report-file');
  const reportFile = reportFileArg && reportFileArg.length > 0 ? reportFileArg : null;
  const quiet = hasBooleanFlag(argv, 'quiet');
  return { deckIds, organizationId, reportFile, quiet };
}

function aggregate(args: ParsedArgs, entries: DeckEntry[]): AggregateReport {
  const totals = { checked: entries.length, pass: 0, warning: 0, fail: 0, unknown: 0 };
  for (const entry of entries) {
    if (entry.status !== 'ok') {
      totals.unknown++;
      continue;
    }
    if (entry.verdict === 'PASS') totals.pass++;
    else if (entry.verdict === 'PASS_WITH_WARNINGS') totals.warning++;
    else if (entry.verdict === 'FAIL') totals.fail++;
    else totals.unknown++;
  }
  let globalVerdict: ParityVerdict | 'UNKNOWN' = 'PASS';
  if (totals.fail > 0 || totals.unknown > 0) globalVerdict = 'FAIL';
  else if (totals.warning > 0) globalVerdict = 'PASS_WITH_WARNINGS';
  return {
    checkedAt: new Date().toISOString(),
    organizationId: args.organizationId,
    totals,
    globalVerdict,
    decks: entries,
  };
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value;
  return value + ' '.repeat(width - value.length);
}

function printSummary(report: AggregateReport, quiet: boolean): void {
  if (quiet) return;
  logAlways('');
  logAlways('Cross-format export parity report');
  logAlways(`  organization: ${report.organizationId}`);
  logAlways(`  checked_at:   ${report.checkedAt}`);
  logAlways(`  global:       ${report.globalVerdict}`);
  logAlways(
    `  totals:       checked=${report.totals.checked} pass=${report.totals.pass} warning=${report.totals.warning} fail=${report.totals.fail} unknown=${report.totals.unknown}`
  );
  logAlways('');
  logAlways(
    `  ${pad('deck_id', 32)} ${pad('verdict', 22)} ${pad('crit', 5)} ${pad('warn', 5)} ${pad('info', 5)} reason`
  );
  logAlways(`  ${'-'.repeat(32)} ${'-'.repeat(22)} ${'-'.repeat(5)} ${'-'.repeat(5)} ${'-'.repeat(5)} ${'-'.repeat(40)}`);
  for (const entry of report.decks) {
    const deckCol = pad(entry.deckId.slice(0, 32), 32);
    const verdictCol = pad(entry.verdict, 22);
    const crit = pad(String(entry.report?.summary.critical ?? '-'), 5);
    const warn = pad(String(entry.report?.summary.warning ?? '-'), 5);
    const info = pad(String(entry.report?.summary.info ?? '-'), 5);
    const reason = entry.reason || (entry.status === 'ok' ? '' : entry.status);
    logAlways(`  ${deckCol} ${verdictCol} ${crit} ${warn} ${info} ${reason}`);
  }
  logAlways('');
}

function writeReportFile(report: AggregateReport, reportFile: string): void {
  const abs = path.resolve(process.cwd(), reportFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(report, null, 2), 'utf8');
}

async function main(): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    logError(`[parity] ${(err as Error).message}`);
    logError(
      'Usage: npx tsx server/scripts/check-export-parity.ts --deck-ids "id1,id2" --organization-id "org_x" [--report-file path] [--quiet]'
    );
    return EXIT_ARG_ERROR;
  }

  logInfo(
    `[parity] Checking ${args.deckIds.length} deck(s) for organization ${args.organizationId}`,
    args.quiet
  );

  const entries: DeckEntry[] = [];
  for (const deckId of args.deckIds) {
    try {
      const result = await buildParityReportForDeck(deckId, args.organizationId);
      if (result.status === 'ok' && result.report) {
        entries.push({
          deckId,
          status: 'ok',
          verdict: result.report.verdict,
          report: result.report,
        });
      } else if (result.status === 'not_found') {
        entries.push({
          deckId,
          status: 'not_found',
          verdict: 'UNKNOWN',
          reason: 'deck_not_found',
        });
      } else {
        entries.push({
          deckId,
          status: 'storage_error',
          verdict: 'UNKNOWN',
          reason: result.reason || 'storage_error',
        });
      }
    } catch (err) {
      entries.push({
        deckId,
        status: 'storage_error',
        verdict: 'UNKNOWN',
        reason: `runtime_error:${(err as Error).message?.slice(0, 120) || 'unknown'}`,
      });
    }
  }

  const report = aggregate(args, entries);
  printSummary(report, args.quiet);

  if (args.reportFile) {
    try {
      writeReportFile(report, args.reportFile);
      logInfo(`[parity] Report written to ${args.reportFile}`, args.quiet);
    } catch (err) {
      logError(`[parity] Failed to write report file: ${(err as Error).message}`);
      return EXIT_ARG_ERROR;
    }
  }

  if (report.globalVerdict === 'FAIL') return EXIT_FAIL;
  return EXIT_OK;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logError(`[parity] Unhandled error: ${(err as Error).message}`);
    process.exit(EXIT_ARG_ERROR);
  });
