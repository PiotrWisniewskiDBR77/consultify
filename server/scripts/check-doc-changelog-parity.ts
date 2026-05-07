/**
 * CI gate: Doc-vs-Changelog parity check (Sprint 16 closure of L3 future work).
 *
 * Closes the "Doc-vs-Changelog parity" item that was explicitly listed as future work
 * in `docs/governance/DOCUMENTATION_CHANGE_CONTROL.md` § 7.
 *
 * Companion to the existing `check-doc-change-control.ts` which validates the
 * changelog itself. This script validates that the controlled doc and its paired
 * changelog stay in sync (no drift in either direction).
 *
 * Run:
 *   npx tsx server/scripts/check-doc-changelog-parity.ts \
 *     --controlled-docs "docs/product/PRESENTATION_RBAC_MATRIX.md,docs/product/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md" \
 *     --changelog-dir docs/governance \
 *     --since 2026-04-01
 *
 * Args:
 *   --controlled-docs   Comma-separated. When omitted, the default list is read
 *                       from `docs/governance/DOC_OWNER_REGISTRY.md` via the
 *                       Sprint 15 `parseOwnerRegistry` helper.
 *   --changelog-dir     Default `docs/governance`.
 *   --since             ISO date (YYYY-MM-DD). Default = today minus 30 days.
 *                       Docs whose changelog's latest entry is before --since are
 *                       still checked but their result is informational only
 *                       (we don't fail PRs on long-untouched docs).
 *   --report-file       JSON report path.
 *   --quiet             Suppress per-file table; only print summary line.
 *
 * Exit codes:
 *   0 — all PASS or PASS_WITH_WARNINGS.
 *   1 — any FAIL.
 *   2 — argument or runtime error.
 *
 * Behavior:
 *   - Read doc + changelog from disk.
 *   - Use `git log -1 --format=%H -- <changelogPath>` to find the SHA of the
 *     last commit that touched the changelog. Then `git show <sha>:<docPath>`
 *     gives us the doc snapshot at that point in time. Both calls are best-
 *     effort: failure (no git, no history, missing file) falls back to
 *     `docContentAtChangelog = null`, which the service treats as a first-run
 *     baseline (informational only when --since precedes the earliest history).
 *   - Never modifies any file.
 *
 * Reference:
 *   docs/governance/DOCUMENTATION_CHANGE_CONTROL.md § 7
 *   server/src/services/docChangelogParityService.ts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parseOwnerRegistry } from '../src/services/docChangeControlValidatorService.js';
import {
  compareDocVsChangelog,
  expectedChangelogPath,
  extractLatestChangelogDate,
  type ParityCheckResult,
} from '../src/services/docChangelogParityService.js';

type ParsedArgs = {
  controlledDocs: string[];
  changelogDir: string;
  since: string;
  reportFile: string | null;
  quiet: boolean;
};

type FileVerdict = {
  docPath: string;
  changelogPath: string;
  verdict: ParityCheckResult['verdict'];
  errors: number;
  warnings: number;
  changelogLastEntryDate: string | null;
  withinSinceWindow: boolean;
};

type RunReport = {
  generatedAt: string;
  changelogDir: string;
  since: string;
  totals: {
    files: number;
    pass: number;
    passWithWarnings: number;
    fail: number;
    skipped: number;
  };
  gitAvailable: boolean;
  files: Array<
    FileVerdict & {
      issues: ParityCheckResult['issues'];
    }
  >;
};

const EXIT_OK = 0;
const EXIT_BLOCKED = 1;
const EXIT_ARG_ERROR = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CHANGELOG_DIR = 'docs/governance';
const DEFAULT_SINCE_WINDOW_DAYS = 30;

function logLine(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------

function getFlagValue(argv: string[], name: string): string | null {
  const longEq = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i] ?? '';
    if (cur.startsWith(longEq)) {
      return cur.slice(longEq.length);
    }
    if (cur === `--${name}`) {
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) {
        return next;
      }
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

function defaultSinceIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - DEFAULT_SINCE_WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): ParsedArgs {
  const docsArg = getFlagValue(argv, 'controlled-docs');
  const controlledDocs =
    docsArg && docsArg.length > 0
      ? docsArg
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

  const dirArg = getFlagValue(argv, 'changelog-dir');
  const changelogDir = dirArg && dirArg.length > 0 ? dirArg : DEFAULT_CHANGELOG_DIR;

  const sinceArg = getFlagValue(argv, 'since');
  let since = defaultSinceIso();
  if (sinceArg && sinceArg.length > 0) {
    if (!ISO_DATE.test(sinceArg)) {
      throw new Error(`--since must be ISO date (YYYY-MM-DD); got: ${sinceArg}`);
    }
    since = sinceArg;
  }

  const reportFileArg = getFlagValue(argv, 'report-file');
  const reportFile = reportFileArg && reportFileArg.length > 0 ? reportFileArg : null;

  const quiet = hasBooleanFlag(argv, 'quiet');

  return { controlledDocs, changelogDir, since, reportFile, quiet };
}

// ---------------------------------------------------------------------------
// filesystem helpers (read-only, never throw)
// ---------------------------------------------------------------------------

function readSafe(filePath: string): string | null {
  try {
    const abs = path.resolve(process.cwd(), filePath);
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function fileMtimeIso(filePath: string): string | null {
  try {
    const abs = path.resolve(process.cwd(), filePath);
    const stat = fs.statSync(abs);
    return stat.mtime.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function loadDefaultControlledDocsFromRegistry(changelogDir: string): string[] {
  const registryPath = path.join(changelogDir, 'DOC_OWNER_REGISTRY.md');
  const content = readSafe(registryPath);
  if (content === null) return [];
  const rows = parseOwnerRegistry(content);
  return rows.map((r) => r.docPath).filter((p) => p.length > 0 && /\.md$/i.test(p));
}

// ---------------------------------------------------------------------------
// git helpers (best-effort, never throw)
// ---------------------------------------------------------------------------

function isGitAvailable(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function lastCommitShaForPath(filePath: string): string | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%H', '--', filePath], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function showAtSha(sha: string, filePath: string): string | null {
  try {
    const out = execFileSync('git', ['show', `${sha}:${filePath}`], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });
    return typeof out === 'string' ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// table printing
// ---------------------------------------------------------------------------

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function printTable(rows: FileVerdict[], quiet: boolean): void {
  if (quiet || rows.length === 0) return;
  const colDoc = Math.max('DOC'.length, ...rows.map((r) => r.docPath.length));
  const colVerdict = Math.max('VERDICT'.length, ...rows.map((r) => r.verdict.length));
  const colErr = Math.max('ERR'.length, 3);
  const colWarn = Math.max('WARN'.length, 3);
  const colDate = Math.max('LAST_ENTRY'.length, 10);

  logLine(
    `${pad('DOC', colDoc)}  ${pad('VERDICT', colVerdict)}  ${pad('ERR', colErr)}  ${pad('WARN', colWarn)}  ${pad('LAST_ENTRY', colDate)}`,
  );
  logLine(
    `${'-'.repeat(colDoc)}  ${'-'.repeat(colVerdict)}  ${'-'.repeat(colErr)}  ${'-'.repeat(colWarn)}  ${'-'.repeat(colDate)}`,
  );
  for (const r of rows) {
    const dateCol = r.changelogLastEntryDate ?? '(none)';
    logLine(
      `${pad(r.docPath, colDoc)}  ${pad(r.verdict, colVerdict)}  ${pad(String(r.errors), colErr)}  ${pad(String(r.warnings), colWarn)}  ${pad(dateCol, colDate)}`,
    );
  }
}

function writeReportFile(targetPath: string, report: RunReport): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function summarizeIssues(result: ParityCheckResult): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const issue of result.issues) {
    if (issue.severity === 'error') errors++;
    else warnings++;
  }
  return { errors, warnings };
}

function main(): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`[check-doc-changelog-parity] Argument error: ${message}`);
    return EXIT_ARG_ERROR;
  }

  let docPaths = args.controlledDocs;
  if (docPaths.length === 0) {
    docPaths = loadDefaultControlledDocsFromRegistry(args.changelogDir);
    if (docPaths.length === 0) {
      logError(
        `[check-doc-changelog-parity] No controlled docs supplied and DOC_OWNER_REGISTRY.md is empty or unreadable in ${args.changelogDir}.`,
      );
      return EXIT_ARG_ERROR;
    }
  }

  const gitAvailable = isGitAvailable();

  const fileVerdicts: FileVerdict[] = [];
  const reportFiles: RunReport['files'] = [];

  let pass = 0;
  let passWithWarnings = 0;
  let fail = 0;
  let skipped = 0;

  for (const docPath of docPaths) {
    const changelogPath = expectedChangelogPath(docPath, args.changelogDir);
    const docContent = readSafe(docPath) ?? '';
    const changelogContent = readSafe(changelogPath) ?? '';

    let docContentAtChangelog: string | null = null;
    if (gitAvailable) {
      const sha = lastCommitShaForPath(changelogPath);
      if (sha !== null) {
        docContentAtChangelog = showAtSha(sha, docPath);
      }
    }

    if (!gitAvailable && docContentAtChangelog === null) {
      const docMtime = fileMtimeIso(docPath);
      const changelogMtime = fileMtimeIso(changelogPath);
      if (docMtime !== null && changelogMtime !== null && docMtime <= changelogMtime) {
        docContentAtChangelog = docContent;
      }
    }

    const changelogLastEntryDate = extractLatestChangelogDate(changelogContent);

    const result = compareDocVsChangelog({
      docPath,
      changelogPath,
      docContent,
      docContentAtChangelog,
      changelogContent,
      changelogLastEntryDate,
    });

    const withinSinceWindow =
      changelogLastEntryDate === null ? true : changelogLastEntryDate >= args.since;

    let effectiveVerdict: ParityCheckResult['verdict'] = result.verdict;
    if (!withinSinceWindow && result.verdict === 'FAIL') {
      effectiveVerdict = 'PASS_WITH_WARNINGS';
    }

    const issueSummary = summarizeIssues(result);

    if (effectiveVerdict === 'PASS') pass++;
    else if (effectiveVerdict === 'PASS_WITH_WARNINGS') passWithWarnings++;
    else fail++;

    if (!withinSinceWindow) skipped++;

    const fv: FileVerdict = {
      docPath,
      changelogPath,
      verdict: effectiveVerdict,
      errors: issueSummary.errors,
      warnings: issueSummary.warnings,
      changelogLastEntryDate,
      withinSinceWindow,
    };
    fileVerdicts.push(fv);
    reportFiles.push({ ...fv, issues: result.issues });
  }

  const runReport: RunReport = {
    generatedAt: new Date().toISOString(),
    changelogDir: args.changelogDir,
    since: args.since,
    totals: {
      files: fileVerdicts.length,
      pass,
      passWithWarnings,
      fail,
      skipped,
    },
    gitAvailable,
    files: reportFiles,
  };

  if (args.reportFile) {
    try {
      writeReportFile(args.reportFile, runReport);
      if (!args.quiet) {
        logLine(`[check-doc-changelog-parity] Report written: ${args.reportFile}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`[check-doc-changelog-parity] Failed to write report: ${message}`);
    }
  }

  printTable(fileVerdicts, args.quiet);

  logLine(
    `Doc-vs-Changelog parity: ${runReport.totals.files} doc(s) — ${pass} PASS, ${passWithWarnings} PASS_WITH_WARNINGS, ${fail} FAIL (since: ${args.since}, git: ${gitAvailable ? 'available' : 'unavailable — informational mode'}, downgraded by --since: ${skipped}).`,
  );

  return fail > 0 ? EXIT_BLOCKED : EXIT_OK;
}

let exitCode = EXIT_OK;
try {
  exitCode = main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logError(`[check-doc-changelog-parity] Fatal error: ${message}`);
  exitCode = EXIT_ARG_ERROR;
}

process.exit(exitCode);
