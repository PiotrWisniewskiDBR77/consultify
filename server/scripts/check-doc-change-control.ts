/**
 * CI gate: Documentation Change Control validator (Epic L3 closure).
 *
 * Runs `validateChangelogContent` against every CHANGELOG_*.md file in a directory
 * (default `docs/governance`) or against an explicit list of doc paths.
 *
 * Run:
 *   npx tsx server/scripts/check-doc-change-control.ts \
 *     --changelog-dir docs/governance \
 *     --doc-paths docs/product/PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md \
 *     --report-file ./doc-control-report.json
 *
 * Args:
 *   --changelog-dir   Default `docs/governance`.
 *   --doc-paths       Comma-separated list of doc paths. Each must have a matching
 *                     CHANGELOG_<basename>.md inside the changelog dir.
 *                     If omitted, every CHANGELOG_*.md in the dir is scanned.
 *   --report-file     Optional JSON report path.
 *   --quiet           Suppress per-file table; only print summary line.
 *   --since           Optional ISO date (YYYY-MM-DD). When set, only entries on/after
 *                     that date are validated; older entries are stripped before validation.
 *
 * Exit codes:
 *   0 — all PASS or PASS_WITH_WARNINGS.
 *   1 — any FAIL.
 *   2 — argument or runtime error.
 *
 * Reference:
 *   docs/governance/DOCUMENTATION_CHANGE_CONTROL.md
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  parseOwnerRegistry,
  validateChangelogContent,
  type ChangelogValidationReport,
  type ParsedChangelogEntry,
} from '../src/services/docChangeControlValidatorService.js';

type ParsedArgs = {
  changelogDir: string;
  docPaths: string[];
  reportFile: string | null;
  quiet: boolean;
  since: string | null;
};

type FileVerdict = {
  changelogPath: string;
  verdict: ChangelogValidationReport['verdict'];
  errors: number;
  warnings: number;
  totalEntries: number;
  consideredEntries: number;
};

type RunReport = {
  generatedAt: string;
  changelogDir: string;
  since: string | null;
  totals: {
    files: number;
    pass: number;
    passWithWarnings: number;
    fail: number;
  };
  files: Array<
    FileVerdict & {
      issues: ChangelogValidationReport['issues'];
    }
  >;
  ownerRegistryRows: number;
};

const EXIT_OK = 0;
const EXIT_BLOCKED = 1;
const EXIT_ARG_ERROR = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function logLine(message: string): void {
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

function parseArgs(argv: string[]): ParsedArgs {
  const dirArg = getFlagValue(argv, 'changelog-dir');
  const changelogDir = dirArg && dirArg.length > 0 ? dirArg : 'docs/governance';

  const docPathsArg = getFlagValue(argv, 'doc-paths');
  const docPaths =
    docPathsArg && docPathsArg.length > 0
      ? docPathsArg
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

  const reportFileArg = getFlagValue(argv, 'report-file');
  const reportFile = reportFileArg && reportFileArg.length > 0 ? reportFileArg : null;

  const quiet = hasBooleanFlag(argv, 'quiet');

  const sinceArg = getFlagValue(argv, 'since');
  let since: string | null = null;
  if (sinceArg && sinceArg.length > 0) {
    if (!ISO_DATE.test(sinceArg)) {
      throw new Error(`--since must be ISO date (YYYY-MM-DD); got: ${sinceArg}`);
    }
    since = sinceArg;
  }

  return { changelogDir, docPaths, reportFile, quiet, since };
}

function basenameNoExt(p: string): string {
  const base = path.basename(p);
  return base.replace(/\.md$/i, '');
}

function changelogPathForDoc(changelogDir: string, docPath: string): string {
  const base = basenameNoExt(docPath);
  const fileName = `CHANGELOG_${base}.md`;
  return path.join(changelogDir, fileName);
}

function listChangelogFiles(changelogDir: string): string[] {
  const abs = path.resolve(process.cwd(), changelogDir);
  if (!fs.existsSync(abs)) return [];
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^CHANGELOG_.+\.md$/i.test(entry.name)) continue;
    files.push(path.join(changelogDir, entry.name));
  }
  files.sort();
  return files;
}

function readSafe(filePath: string): string | null {
  try {
    const abs = path.resolve(process.cwd(), filePath);
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function filterEntriesSince(
  entries: ParsedChangelogEntry[],
  since: string | null,
): ParsedChangelogEntry[] {
  if (since === null) return entries;
  return entries.filter((e) => e.date.length > 0 && e.date >= since);
}

function summarizeReport(report: ChangelogValidationReport): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of report.issues) {
    if (issue.severity === 'error') errors++;
    else warnings++;
  }
  return { errors, warnings };
}

function reconstructForSinceWindow(
  filePath: string,
  rawContent: string,
  since: string | null,
): ChangelogValidationReport {
  if (since === null) {
    return validateChangelogContent(rawContent, filePath);
  }
  const fullReport = validateChangelogContent(rawContent, filePath);
  const filtered = filterEntriesSince(fullReport.entries, since);
  if (filtered.length === fullReport.entries.length) {
    return fullReport;
  }
  const synthetic = filtered.map(serializeEntryAsMarkdown).join('\n\n---\n\n');
  const wrapped =
    synthetic.length > 0 ? `# Changelog (since ${since})\n\n---\n\n${synthetic}\n` : '';
  return validateChangelogContent(wrapped, filePath);
}

function serializeEntryAsMarkdown(entry: ParsedChangelogEntry): string {
  const lines: string[] = [];
  lines.push(`## ${entry.date} — ${entry.author}`);
  lines.push('');
  if (entry.doc) lines.push(`**Doc:** ${entry.doc}`);
  if (entry.riskTier) lines.push(`**Risk tier:** ${entry.riskTier}`);
  if (entry.rationale.length > 0) {
    lines.push(`**Rationale:**`);
    lines.push(entry.rationale);
    lines.push('');
  }
  if (entry.impactNote.length > 0) {
    lines.push(`**Impact note:**`);
    lines.push(entry.impactNote);
    lines.push('');
  }
  if (entry.reviewer.length > 0) lines.push(`**Reviewer:** ${entry.reviewer}`);
  if (entry.linkedPr.length > 0) lines.push(`**Linked PR / ticket:** ${entry.linkedPr}`);
  if (entry.diffSummary.length > 0) {
    lines.push('');
    lines.push(`**Diff summary:**`);
    for (const b of entry.diffSummary) lines.push(`- ${b}`);
  }
  return lines.join('\n');
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function printTable(rows: FileVerdict[], quiet: boolean): void {
  if (quiet || rows.length === 0) return;
  const colFile = Math.max('FILE'.length, ...rows.map((r) => r.changelogPath.length));
  const colVerdict = Math.max('VERDICT'.length, ...rows.map((r) => r.verdict.length));
  const colErr = Math.max('ERR'.length, 3);
  const colWarn = Math.max('WARN'.length, 3);
  const colEntries = Math.max('ENTRIES'.length, 7);

  logLine(
    `${pad('FILE', colFile)}  ${pad('VERDICT', colVerdict)}  ${pad('ERR', colErr)}  ${pad('WARN', colWarn)}  ${pad('ENTRIES', colEntries)}`,
  );
  logLine(
    `${'-'.repeat(colFile)}  ${'-'.repeat(colVerdict)}  ${'-'.repeat(colErr)}  ${'-'.repeat(colWarn)}  ${'-'.repeat(colEntries)}`,
  );
  for (const r of rows) {
    const entriesCol = `${r.consideredEntries}/${r.totalEntries}`;
    logLine(
      `${pad(r.changelogPath, colFile)}  ${pad(r.verdict, colVerdict)}  ${pad(String(r.errors), colErr)}  ${pad(String(r.warnings), colWarn)}  ${pad(entriesCol, colEntries)}`,
    );
  }
}

function writeReportFile(targetPath: string, report: RunReport): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function tryReadOwnerRegistry(changelogDir: string): number {
  const candidate = path.join(changelogDir, 'DOC_OWNER_REGISTRY.md');
  const content = readSafe(candidate);
  if (content === null) return 0;
  return parseOwnerRegistry(content).length;
}

function main(): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`[check-doc-change-control] Argument error: ${message}`);
    return EXIT_ARG_ERROR;
  }

  let targetChangelogPaths: string[] = [];
  if (args.docPaths.length > 0) {
    targetChangelogPaths = args.docPaths.map((d) => changelogPathForDoc(args.changelogDir, d));
  } else {
    targetChangelogPaths = listChangelogFiles(args.changelogDir);
    if (targetChangelogPaths.length === 0) {
      logError(
        `[check-doc-change-control] No CHANGELOG_*.md files found in ${args.changelogDir}.`,
      );
      return EXIT_ARG_ERROR;
    }
  }

  const fileVerdicts: FileVerdict[] = [];
  const reportFiles: RunReport['files'] = [];

  let pass = 0;
  let passWithWarnings = 0;
  let fail = 0;

  for (const changelogPath of targetChangelogPaths) {
    const content = readSafe(changelogPath);
    if (content === null) {
      const placeholder: ChangelogValidationReport = validateChangelogContent('', changelogPath);
      fail++;
      const summary = summarizeReport(placeholder);
      const fv: FileVerdict = {
        changelogPath,
        verdict: 'FAIL',
        errors: summary.errors,
        warnings: summary.warnings,
        totalEntries: 0,
        consideredEntries: 0,
      };
      fileVerdicts.push(fv);
      reportFiles.push({ ...fv, issues: placeholder.issues });
      continue;
    }

    const fullReport = validateChangelogContent(content, changelogPath);
    const filteredReport = reconstructForSinceWindow(changelogPath, content, args.since);
    const summary = summarizeReport(filteredReport);

    if (filteredReport.verdict === 'PASS') pass++;
    else if (filteredReport.verdict === 'PASS_WITH_WARNINGS') passWithWarnings++;
    else fail++;

    const fv: FileVerdict = {
      changelogPath,
      verdict: filteredReport.verdict,
      errors: summary.errors,
      warnings: summary.warnings,
      totalEntries: fullReport.entries.length,
      consideredEntries: filteredReport.entries.length,
    };
    fileVerdicts.push(fv);
    reportFiles.push({ ...fv, issues: filteredReport.issues });
  }

  const ownerRegistryRows = tryReadOwnerRegistry(args.changelogDir);

  const runReport: RunReport = {
    generatedAt: new Date().toISOString(),
    changelogDir: args.changelogDir,
    since: args.since,
    totals: {
      files: fileVerdicts.length,
      pass,
      passWithWarnings,
      fail,
    },
    files: reportFiles,
    ownerRegistryRows,
  };

  if (args.reportFile) {
    try {
      writeReportFile(args.reportFile, runReport);
      if (!args.quiet) {
        logLine(`[check-doc-change-control] Report written: ${args.reportFile}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`[check-doc-change-control] Failed to write report: ${message}`);
    }
  }

  printTable(fileVerdicts, args.quiet);

  logLine(
    `Documentation Change Control: ${runReport.totals.files} file(s) — ${pass} PASS, ${passWithWarnings} PASS_WITH_WARNINGS, ${fail} FAIL (registry rows: ${ownerRegistryRows}).`,
  );

  return fail > 0 ? EXIT_BLOCKED : EXIT_OK;
}

let exitCode = EXIT_OK;
try {
  exitCode = main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logError(`[check-doc-change-control] Fatal error: ${message}`);
  exitCode = EXIT_ARG_ERROR;
}

process.exit(exitCode);
