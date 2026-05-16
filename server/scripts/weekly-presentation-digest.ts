/**
 * Weekly Presentation Telemetry Digest
 *
 * Aggregates the last-7-day proposal lifecycle, exports, and governance
 * verdicts per organization across the presentation surface, then emits a
 * compact stdout summary plus optional JSON and Markdown reports.
 *
 * Schema-tolerant: when a backing table is missing or a query fails, the
 * affected org's report still emits with `warnings` and zero totals. The
 * script never throws.
 *
 * See `docs/operations/PRESENTATION_WEEKLY_DIGEST.md` for the full runbook,
 * cron suggestion, and CI integration notes.
 *
 * Usage:
 *   npx tsx server/scripts/weekly-presentation-digest.ts \
 *     --organization-id <id> [--organization-id <id2> | --organization-id "id1,id2"] \
 *     [--days 7] \
 *     [--end <ISO>] \
 *     [--report-file out/digest.json] \
 *     [--markdown-file out/digest.md] \
 *     [--dry-run] \
 *     [--quiet] \
 *     [--fail-on-blocked]
 */

import * as fs from 'fs';
import * as path from 'path';

import { all as dbAll } from '../src/utils/DbPromise.js';
import logger from '../src/utils/Logger.js';
import {
  buildPresentationGovernanceCard,
  type GovernanceVerdict,
} from '../src/services/presentationGovernanceCardService.js';
import { buildPresentationRuntimeRollup } from '../src/services/presentationRuntimeRollupService.js';
import {
  buildWeeklyDigest,
  digestToMarkdown,
  type DigestInput,
  type DigestInputAgentOp,
  type DigestInputDeck,
  type DigestInputExport,
  type DigestInputGovernanceVerdict,
  type DigestInputRuntimeEvent,
  type DigestReport,
} from '../src/services/presentationWeeklyDigestService.js';

// ---------------------------------------------------------------------------
// CLI types
// ---------------------------------------------------------------------------

interface CliArgs {
  organizationIds: string[];
  days: number;
  endIso: string;
  reportFile: string | null;
  markdownFile: string | null;
  dryRun: boolean;
  quiet: boolean;
  failOnBlocked: boolean;
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
  '--days',
  '--end',
  '--report-file',
  '--markdown-file',
  '--dry-run',
  '--quiet',
  '--fail-on-blocked',
]);

const KNOWN_FLAG_PREFIXES = [
  '--organization-id=',
  '--days=',
  '--end=',
  '--report-file=',
  '--markdown-file=',
  '--dry-run=',
  '--quiet=',
  '--fail-on-blocked=',
];

const DECK_QUERY_LIMIT = 500;
const GOVERNANCE_DECK_LIMIT = 50;
const EXIT_OK = 0;
const EXIT_BLOCKED = 1;
const EXIT_ARG_ERROR = 2;

// ---------------------------------------------------------------------------
// Argument parsing — supports `--flag value`, `--flag=value`, repeated flags,
// and comma-separated values for --organization-id.
// ---------------------------------------------------------------------------

function collectFlagValues(name: string, argv: string[]): string[] {
  const eq = `--${name}=`;
  const bare = `--${name}`;
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const entry = argv[i];
    if (entry === undefined) continue;
    if (entry.startsWith(eq)) {
      values.push(entry.slice(eq.length));
    } else if (entry === bare) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        values.push(next);
        i++;
      } else {
        values.push('');
      }
    }
  }
  return values;
}

function getSingleFlagValue(name: string, argv: string[]): string | null {
  const values = collectFlagValues(name, argv);
  if (values.length === 0) return null;
  const last = values[values.length - 1];
  return last === undefined ? null : last;
}

function hasBareFlag(name: string, argv: string[]): boolean {
  const bare = `--${name}`;
  if (argv.includes(bare)) return true;
  const eq = `--${name}=true`;
  return argv.includes(eq);
}

function isKnownFlag(token: string): boolean {
  if (KNOWN_FLAGS.has(token)) return true;
  for (const prefix of KNOWN_FLAG_PREFIXES) {
    if (token.startsWith(prefix)) return true;
  }
  return false;
}

function parseArgs(argv: string[]): ParseOk | ParseErr {
  for (const token of argv) {
    if (token.startsWith('--') && !isKnownFlag(token)) {
      return { ok: false, error: `Unknown flag: ${token}` };
    }
  }

  const orgRaw = collectFlagValues('organization-id', argv);
  if (orgRaw.length === 0) {
    return { ok: false, error: '--organization-id is required (repeat or comma-separated)' };
  }
  const seen = new Set<string>();
  const organizationIds: string[] = [];
  for (const raw of orgRaw) {
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (trimmed.length === 0 || seen.has(trimmed)) continue;
      seen.add(trimmed);
      organizationIds.push(trimmed);
    }
  }
  if (organizationIds.length === 0) {
    return { ok: false, error: '--organization-id resolved to an empty list' };
  }

  let days = 7;
  const daysRaw = getSingleFlagValue('days', argv);
  if (daysRaw !== null && daysRaw !== '') {
    const parsed = Number(daysRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      return { ok: false, error: `--days must be an integer between 1 and 365 (got "${daysRaw}")` };
    }
    days = parsed;
  }

  const endRaw = getSingleFlagValue('end', argv);
  let endIso = new Date().toISOString();
  if (endRaw !== null && endRaw !== '') {
    const parsed = Date.parse(endRaw);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: `--end must be an ISO date string (got "${endRaw}")` };
    }
    endIso = new Date(parsed).toISOString();
  }

  const reportFileRaw = getSingleFlagValue('report-file', argv);
  const reportFile = reportFileRaw !== null && reportFileRaw !== '' ? reportFileRaw : null;

  const markdownFileRaw = getSingleFlagValue('markdown-file', argv);
  const markdownFile =
    markdownFileRaw !== null && markdownFileRaw !== '' ? markdownFileRaw : null;

  const dryRun = hasBareFlag('dry-run', argv);
  const quiet = hasBareFlag('quiet', argv);
  const failOnBlocked = hasBareFlag('fail-on-blocked', argv);

  return {
    ok: true,
    args: {
      organizationIds,
      days,
      endIso,
      reportFile,
      markdownFile,
      dryRun,
      quiet,
      failOnBlocked,
    },
  };
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function isSchemaMissingError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message ?? error ?? '');
  return (
    message.includes('no such table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('Database not initialized')
  );
}

function pushWarning(target: string[], code: string): void {
  if (!target.includes(code)) target.push(code);
}

function writeJsonFile(targetPath: string, payload: unknown): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeTextFile(targetPath: string, payload: string): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, payload.endsWith('\n') ? payload : `${payload}\n`, 'utf8');
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

// ---------------------------------------------------------------------------
// Data fetchers — each is wrapped in try/catch by the caller and never throws
// out of the top-level run loop.
// ---------------------------------------------------------------------------

interface DeckRow {
  id?: unknown;
  title?: unknown;
  updated_at?: unknown;
  confidentiality_level?: unknown;
}

interface RuntimeEventRow {
  id?: unknown;
  organization_id?: unknown;
  deck_id?: unknown;
  event_type?: unknown;
  status?: unknown;
  created_at?: unknown;
}

interface ExportRow {
  deck_id?: unknown;
  status?: unknown;
  format?: unknown;
  created_at?: unknown;
}

interface AgentOpRow {
  deck_id?: unknown;
  status?: unknown;
  operation_type?: unknown;
  created_at?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

async function fetchDecks(orgId: string, warnings: string[]): Promise<DigestInputDeck[]> {
  try {
    const rows = await dbAll<DeckRow>(
      `SELECT id, title, updated_at, confidentiality_level
       FROM presentation_decks
       WHERE organization_id = ?
       ORDER BY updated_at DESC
       LIMIT ${DECK_QUERY_LIMIT}`,
      [orgId],
      { fallback: false }
    );
    return rows.map((row) => ({
      id: asString(row.id),
      title: asString(row.title) || asString(row.id),
      updatedAt: row.updated_at == null ? null : asString(row.updated_at),
    }));
  } catch (error) {
    pushWarning(warnings, isSchemaMissingError(error) ? 'schema_missing:presentation_decks' : 'query_failed:presentation_decks');
    return [];
  }
}

async function fetchRuntimeEventRows(
  orgId: string,
  windowStartIso: string,
  windowEndIso: string,
  warnings: string[]
): Promise<RuntimeEventRow[]> {
  try {
    return await dbAll<RuntimeEventRow>(
      `SELECT id, organization_id, deck_id, event_type, status, created_at
       FROM presentation_runtime_events
       WHERE organization_id = ?
         AND created_at >= ?
         AND created_at < ?`,
      [orgId, windowStartIso, windowEndIso],
      { fallback: false }
    );
  } catch (error) {
    pushWarning(
      warnings,
      isSchemaMissingError(error)
        ? 'schema_missing:presentation_runtime_events'
        : 'query_failed:presentation_runtime_events'
    );
    return [];
  }
}

function toRuntimeEvents(rows: RuntimeEventRow[]): DigestInputRuntimeEvent[] {
  const out: DigestInputRuntimeEvent[] = [];
  for (const row of rows) {
    out.push({
      deckId: asString(row.deck_id),
      eventType: asString(row.event_type),
      createdAt: asString(row.created_at),
    });
  }
  return out;
}

async function fetchExports(
  orgId: string,
  windowStartIso: string,
  windowEndIso: string,
  warnings: string[]
): Promise<DigestInputExport[]> {
  try {
    const rows = await dbAll<ExportRow>(
      `SELECT deck_id, status, format, created_at
       FROM presentation_export_records
       WHERE organization_id = ?
         AND created_at >= ?
         AND created_at < ?`,
      [orgId, windowStartIso, windowEndIso],
      { fallback: false }
    );
    return rows.map((row) => ({
      deckId: asString(row.deck_id),
      status: asString(row.status),
      format: asString(row.format),
      createdAt: asString(row.created_at),
    }));
  } catch (error) {
    pushWarning(
      warnings,
      isSchemaMissingError(error)
        ? 'schema_missing:presentation_export_records'
        : 'query_failed:presentation_export_records'
    );
    return [];
  }
}

async function fetchAgentOps(
  orgId: string,
  windowStartIso: string,
  windowEndIso: string,
  warnings: string[]
): Promise<DigestInputAgentOp[]> {
  try {
    const rows = await dbAll<AgentOpRow>(
      `SELECT deck_id, status, operation_type, created_at
       FROM presentation_ai_operations
       WHERE organization_id = ?
         AND created_at >= ?
         AND created_at < ?`,
      [orgId, windowStartIso, windowEndIso],
      { fallback: false }
    );
    return rows.map((row) => ({
      deckId: asString(row.deck_id),
      status: asString(row.status),
      operationType: asString(row.operation_type),
      createdAt: asString(row.created_at),
    }));
  } catch (error) {
    pushWarning(
      warnings,
      isSchemaMissingError(error)
        ? 'schema_missing:presentation_ai_operations'
        : 'query_failed:presentation_ai_operations'
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Governance verdicts — derived from runtime telemetry only (no quality DB
// access). Always partial — emits `governance_coverage_partial` warning so
// downstream consumers know to cross-check the full Governance Card.
// ---------------------------------------------------------------------------

function deriveGovernanceVerdicts(
  decks: DigestInputDeck[],
  runtimeEventRows: RuntimeEventRow[],
  windowDays: number,
  windowEnd: Date,
  warnings: string[]
): DigestInputGovernanceVerdict[] {
  if (decks.length === 0) return [];

  pushWarning(warnings, 'governance_coverage_partial');

  const candidates = decks.slice(0, GOVERNANCE_DECK_LIMIT);
  const eventsByDeck = new Map<string, RuntimeEventRow[]>();
  for (const row of runtimeEventRows) {
    const deckId = asString(row.deck_id);
    if (!deckId) continue;
    const list = eventsByDeck.get(deckId);
    if (list) list.push(row);
    else eventsByDeck.set(deckId, [row]);
  }

  const out: DigestInputGovernanceVerdict[] = [];
  for (const deck of candidates) {
    const deckRows = eventsByDeck.get(deck.id) || [];
    let verdict: GovernanceVerdict;
    try {
      const rollup = buildPresentationRuntimeRollup({
        rows: deckRows.map((row) => ({
          id: asString(row.id),
          organization_id: asString(row.organization_id),
          deck_id: asString(row.deck_id),
          user_id: null,
          event_type: asString(row.event_type),
          status: row.status == null ? null : asString(row.status),
          scope: null,
          created_at: asString(row.created_at),
        })),
        windowDays,
        now: windowEnd,
      });
      const card = buildPresentationGovernanceCard({
        deckId: deck.id,
        qualityReport: null,
        telemetryRollup: rollup,
        now: windowEnd,
      });
      verdict = card.overallVerdict;
    } catch {
      verdict = 'INCONCLUSIVE';
    }
    out.push({ deckId: deck.id, verdict });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-organization processor
// ---------------------------------------------------------------------------

interface OrgPayload {
  report: DigestReport;
  markdown: string;
}

async function processOrganization(args: CliArgs, orgId: string): Promise<OrgPayload> {
  const warnings: string[] = [];
  const windowEnd = new Date(args.endIso);
  const windowStart = new Date(windowEnd.getTime() - args.days * 86_400_000);
  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();

  const [decks, runtimeEventRows, exportsRows, agentOps] = await Promise.all([
    fetchDecks(orgId, warnings),
    fetchRuntimeEventRows(orgId, windowStartIso, windowEndIso, warnings),
    fetchExports(orgId, windowStartIso, windowEndIso, warnings),
    fetchAgentOps(orgId, windowStartIso, windowEndIso, warnings),
  ]);

  const runtimeEvents = toRuntimeEvents(runtimeEventRows);

  const governanceVerdicts = deriveGovernanceVerdicts(
    decks,
    runtimeEventRows,
    args.days,
    windowEnd,
    warnings
  );

  const input: DigestInput = {
    organizationId: orgId,
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    decks,
    runtimeEvents,
    exports: exportsRows,
    agentOps,
    governanceVerdicts,
  };

  const report = buildWeeklyDigest(input);
  for (const code of warnings) {
    if (!report.warnings.includes(code)) report.warnings.push(code);
  }

  const markdown = digestToMarkdown(report);
  return { report, markdown };
}

// ---------------------------------------------------------------------------
// Stdout summary
// ---------------------------------------------------------------------------

function printOrgSummary(quiet: boolean, payload: OrgPayload): void {
  const { report } = payload;
  logLine(quiet, '');
  logLine(quiet, `Organization: ${report.organizationId}`);
  logLine(quiet, `- Window: ${report.windowStart} -> ${report.windowEnd}`);
  logLine(quiet, `- Decks: ${report.totals.decks}`);
  logLine(
    quiet,
    `- Proposals: created=${report.totals.proposalsCreated} applied=${report.totals.proposalsApplied} rejected=${report.totals.proposalsRejected} reverted=${report.totals.proposalsReverted}`
  );
  logLine(
    quiet,
    `- Exports: attempted=${report.totals.exportsAttempted} succeeded=${report.totals.exportsSucceeded} blocked=${report.totals.exportsBlocked}`
  );
  logLine(
    quiet,
    `- Governance: pass=${report.totals.governance.pass} pass_p2=${report.totals.governance.passWithP2} blocked_p1=${report.totals.governance.blockedP1} blocked_p0=${report.totals.governance.blockedP0} inconclusive=${report.totals.governance.inconclusive}`
  );
  if (report.topBlockedDecks.length > 0) {
    logLine(
      quiet,
      `- Blocked decks: ${report.topBlockedDecks.map((d) => `${d.deckId}=${d.verdict}`).join(', ')}`
    );
  }
  if (report.warnings.length > 0) {
    logLine(quiet, `- Warnings: ${report.warnings.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    logError(`[weekly-presentation-digest] Argument error: ${parsed.error}`);
    return EXIT_ARG_ERROR;
  }
  const args = parsed.args;

  if (args.dryRun) {
    logLine(args.quiet, '[weekly-presentation-digest] Dry-run mode (no writes planned beyond reports anyway).');
  }

  const payloads: OrgPayload[] = [];
  for (const orgId of args.organizationIds) {
    try {
      const payload = await processOrganization(args, orgId);
      payloads.push(payload);
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[weekly-presentation-digest] Failed for org ${orgId}: ${String(message)}`);
      logger.error('[weekly-presentation-digest] Org processing failure', {
        organizationId: orgId,
        error: String(message),
      });
      const fallbackReport: DigestReport = {
        organizationId: orgId,
        windowStart: new Date(new Date(args.endIso).getTime() - args.days * 86_400_000).toISOString(),
        windowEnd: new Date(args.endIso).toISOString(),
        totals: {
          decks: 0,
          proposalsCreated: 0,
          proposalsApplied: 0,
          proposalsRejected: 0,
          proposalsReverted: 0,
          exportsAttempted: 0,
          exportsBlocked: 0,
          exportsSucceeded: 0,
          governance: { pass: 0, passWithP2: 0, blockedP1: 0, blockedP0: 0, inconclusive: 0 },
        },
        topActiveDecks: [],
        topBlockedDecks: [],
        warnings: ['org_processing_failure'],
      };
      payloads.push({ report: fallbackReport, markdown: digestToMarkdown(fallbackReport) });
    }
  }

  const aggregateReport = {
    generatedAt: new Date().toISOString(),
    windowDays: args.days,
    windowEnd: args.endIso,
    organizations: payloads.map((p) => p.report),
  };

  if (args.reportFile) {
    try {
      writeJsonFile(args.reportFile, aggregateReport);
      logLine(args.quiet, `[weekly-presentation-digest] JSON report written: ${args.reportFile}`);
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[weekly-presentation-digest] Failed to write JSON report: ${String(message)}`);
    }
  }

  if (args.markdownFile) {
    try {
      const md = payloads.map((p) => p.markdown).join('\n---\n\n');
      writeTextFile(args.markdownFile, md);
      logLine(args.quiet, `[weekly-presentation-digest] Markdown report written: ${args.markdownFile}`);
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[weekly-presentation-digest] Failed to write Markdown report: ${String(message)}`);
    }
  }

  for (const payload of payloads) {
    printOrgSummary(args.quiet, payload);
  }

  if (args.failOnBlocked) {
    const hasP0 = payloads.some((p) =>
      p.report.topBlockedDecks.some((deck) => deck.verdict === 'BLOCKED_P0')
    );
    if (hasP0) {
      logError('[weekly-presentation-digest] Exiting non-zero: BLOCKED_P0 governance verdicts present.');
      return EXIT_BLOCKED;
    }
  }

  return EXIT_OK;
}

async function main(): Promise<void> {
  let exitCode = EXIT_BLOCKED;
  try {
    exitCode = await run();
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[weekly-presentation-digest] Unhandled failure: ${String(message)}`);
    logger.error('[weekly-presentation-digest] Unhandled failure', { error: String(message) });
    exitCode = EXIT_BLOCKED;
  }
  // eslint-disable-next-line no-console
  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

void main();
