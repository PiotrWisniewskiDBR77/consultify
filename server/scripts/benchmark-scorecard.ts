#!/usr/bin/env tsx
/**
 * Consulting Benchmark Scorecard (Consultify Bench, Blok E / HP-21, task E5)
 *
 * Reads run result JSON files written by `run-consulting-benchmark.ts` under
 * `benchmark/results/<corpusHash>/<runId>.json` and renders a single
 * Markdown quality card to `benchmark/SCORECARD.md`: pass-rate overall / per
 * domain / per archetype, average of the 5 scale dimensions, N graded vs
 * ungraded, run date, corpus hash — plus a fixed "CZEGO NIE TWIERDZIMY"
 * section so the card can never be over-read as more than it is.
 *
 * ZERO FABRICATION (mirrors the runner's own discipline):
 *   - No run files found at all -> the card says "no graded runs yet",
 *     nothing else. No numbers are invented.
 *   - A run exists but 0 tasks were graded -> the card shows that run's real
 *     metadata (run id, corpus hash, date) with an explicit "n/a (0 graded)"
 *     pass rate — never a fabricated percentage.
 *   - Every number rendered is read verbatim from the run file's own
 *     `scorecard` block (already computed once, by the runner) — this
 *     script does not recompute pass/fail from raw outcomes, so there is a
 *     single source of truth for "what counts as graded".
 *
 * This script picks the MOST RECENT run (by `timestamp`) across every
 * corpus-hash subdirectory as the headline card, and lists any other
 * available runs underneath purely for context (never blended into the
 * headline numbers — a card must describe ONE run, not an average of runs
 * against possibly-different corpora).
 *
 * Usage:
 *   npx tsx server/scripts/benchmark-scorecard.ts \
 *     [--results-dir benchmark/results] \
 *     [--output benchmark/SCORECARD.md] \
 *     [--quiet]
 *
 * Exit codes:
 *   0 — card written successfully (including the "no graded runs yet" card
 *       when zero run files exist — that is a valid, honest output, not an
 *       error)
 *   2 — argument error or failure to write the output file
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

// ---------------------------------------------------------------------------
// Types (mirror the `rawRun` shape written by run-consulting-benchmark.ts)
// ---------------------------------------------------------------------------

export type ConsultingDimensionKey =
  | 'answerFirst'
  | 'meceStructure'
  | 'grounding'
  | 'actionability'
  | 'evidenceDiscipline';

export const SCORECARD_DIMENSIONS: ReadonlyArray<{ key: ConsultingDimensionKey; label: string }> = [
  { key: 'answerFirst', label: 'Answer-first' },
  { key: 'meceStructure', label: 'MECE structure' },
  { key: 'grounding', label: 'Grounding' },
  { key: 'actionability', label: 'Actionability' },
  { key: 'evidenceDiscipline', label: 'Evidence discipline' },
];

export interface GroupBreakdown {
  total: number;
  pass: number;
  fail: number;
  ungraded: number;
}

export interface RunScorecard {
  totalTasks: number;
  gradedTasks: number;
  ungradedTasks: number;
  passCount: number;
  failCount: number;
  passRatePct: number | null;
  averageDimensions: Record<string, number> | null;
  byArchetype: Record<string, GroupBreakdown>;
  byDomain: Record<string, GroupBreakdown>;
}

export interface RunResultFile {
  runId: string;
  corpusHash: string;
  timestamp: string;
  tier?: string;
  adapterSource?: 'real' | 'noop';
  taskCount: number;
  scorecard: RunScorecard;
}

export interface LoadedRun {
  filePath: string;
  run: RunResultFile;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  resultsDir: string;
  outputPath: string;
  quiet: boolean;
}

const DEFAULT_RESULTS_DIR = path.join('benchmark', 'results');
const DEFAULT_OUTPUT_PATH = path.join('benchmark', 'SCORECARD.md');

const EXIT_OK = 0;
const EXIT_ERROR = 2;

const KNOWN_FLAGS = new Set(['--results-dir', '--output', '--quiet']);

function getSingleFlagValue(name: string, argv: string[]): string | null {
  const eq = `--${name}=`;
  const bare = `--${name}`;
  let last: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const entry = argv[i];
    if (entry === undefined) continue;
    if (entry.startsWith(eq)) last = entry.slice(eq.length);
    else if (entry === bare) {
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
  const bare = `--${name}`;
  return argv.includes(bare) || argv.includes(`${bare}=true`);
}

function isKnownFlag(token: string): boolean {
  if (KNOWN_FLAGS.has(token)) return true;
  for (const flag of KNOWN_FLAGS) {
    if (token.startsWith(`${flag}=`)) return true;
  }
  return false;
}

export function parseScorecardArgs(argv: string[]): { ok: true; args: CliArgs } | { ok: false; error: string } {
  for (const token of argv) {
    if (token.startsWith('--') && !isKnownFlag(token)) {
      return { ok: false, error: `Unknown flag: ${token}` };
    }
  }
  return {
    ok: true,
    args: {
      resultsDir: getSingleFlagValue('results-dir', argv) || DEFAULT_RESULTS_DIR,
      outputPath: getSingleFlagValue('output', argv) || DEFAULT_OUTPUT_PATH,
      quiet: hasBareFlag('quiet', argv),
    },
  };
}

// ---------------------------------------------------------------------------
// I/O: find + tolerantly load run result files
// ---------------------------------------------------------------------------

export function findResultFiles(rootDir: string): string[] {
  const abs = path.resolve(process.cwd(), rootDir);
  if (!fs.existsSync(abs)) return [];
  let entries: string[];
  try {
    entries = fs.readdirSync(abs, { recursive: true }) as string[];
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(abs, entry))
    .filter((full) => {
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

function safeGroupBreakdown(value: unknown): GroupBreakdown {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  return { total: n(v.total), pass: n(v.pass), fail: n(v.fail), ungraded: n(v.ungraded) };
}

function safeGroupMap(value: unknown): Record<string, GroupBreakdown> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, GroupBreakdown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = safeGroupBreakdown(v);
  }
  return out;
}

function safeAverageDimensions(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object') return null;
  const out: Record<string, number> = {};
  let any = false;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v;
      any = true;
    }
  }
  return any ? out : null;
}

/**
 * Tolerantly parses one run result file. Never throws — an unreadable or
 * malformed file is skipped (returns null); it does not abort the whole
 * scorecard render (one corrupt run file must not hide every other run).
 */
export function loadRunResultFile(filePath: string): RunResultFile | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const runId = typeof obj.runId === 'string' ? obj.runId : '';
  const corpusHash = typeof obj.corpusHash === 'string' ? obj.corpusHash : '';
  const timestamp = typeof obj.timestamp === 'string' ? obj.timestamp : '';
  if (!runId || !corpusHash || !timestamp) return null;

  const scorecardRaw = (obj.scorecard && typeof obj.scorecard === 'object' ? obj.scorecard : {}) as Record<
    string,
    unknown
  >;
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

  const scorecard: RunScorecard = {
    totalTasks: n(scorecardRaw.totalTasks),
    gradedTasks: n(scorecardRaw.gradedTasks),
    ungradedTasks: n(scorecardRaw.ungradedTasks),
    passCount: n(scorecardRaw.passCount),
    failCount: n(scorecardRaw.failCount),
    passRatePct:
      typeof scorecardRaw.passRatePct === 'number' && Number.isFinite(scorecardRaw.passRatePct)
        ? scorecardRaw.passRatePct
        : null,
    averageDimensions: safeAverageDimensions(scorecardRaw.averageDimensions),
    byArchetype: safeGroupMap(scorecardRaw.byArchetype),
    byDomain: safeGroupMap(scorecardRaw.byDomain),
  };

  return {
    runId,
    corpusHash,
    timestamp,
    tier: typeof obj.tier === 'string' ? obj.tier : undefined,
    adapterSource: obj.adapterSource === 'real' || obj.adapterSource === 'noop' ? obj.adapterSource : undefined,
    taskCount: n(obj.taskCount),
    scorecard,
  };
}

export function loadAllRuns(resultsDir: string): LoadedRun[] {
  const files = findResultFiles(resultsDir);
  const out: LoadedRun[] = [];
  for (const filePath of files) {
    const run = loadRunResultFile(filePath);
    if (run) out.push({ filePath, run });
  }
  return out;
}

/** Latest by ISO timestamp descending; ties broken by filePath for determinism. */
export function pickLatestRun(runs: LoadedRun[]): LoadedRun | null {
  if (runs.length === 0) return null;
  const sorted = [...runs].sort((a, b) => {
    const byTime = b.run.timestamp.localeCompare(a.run.timestamp);
    if (byTime !== 0) return byTime;
    return a.filePath.localeCompare(b.filePath);
  });
  return sorted[0] ?? null;
}

// ---------------------------------------------------------------------------
// Rendering (pure — no I/O, never throws)
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function groupPassRate(g: GroupBreakdown): string {
  const graded = g.pass + g.fail;
  return graded > 0 ? pct((g.pass / graded) * 100) : 'n/a';
}

function renderGroupTable(title: string, groups: Record<string, GroupBreakdown>): string[] {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push('');
  const keys = Object.keys(groups).sort();
  if (keys.length === 0) {
    lines.push('_(no data)_');
    lines.push('');
    return lines;
  }
  lines.push('| | Total | Pass | Fail | Ungraded | Pass rate (graded) |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const key of keys) {
    const g = groups[key];
    lines.push(`| ${key} | ${g.total} | ${g.pass} | ${g.fail} | ${g.ungraded} | ${groupPassRate(g)} |`);
  }
  lines.push('');
  return lines;
}

const NOT_CLAIMED_SECTION = [
  '## Czego nie twierdzimy',
  '',
  '- **Brak porównań konkurencyjnych.** Ta karta nie mówi, jak Consultify wypada na tle innych',
  '  narzędzi/konsultantów AI (McKinsey Lilli, Harvey, generic GPT-wrappery) — nie mamy takiego',
  '  pomiaru równoległego.',
  '- **Brak baseline\'u ludzkiego.** Nie porównujemy z odpowiedzią realnego konsultanta na te same',
  '  zadania — pass-rate poniżej odnosi się WYŁĄCZNIE do rubryki tego benchmarku, nie do jakości',
  '  "na tle człowieka".',
  '- **Charakter wewnętrzny, regresyjny.** To narzędzie do wyłapywania REGRESJI między wersjami',
  '  produktu (ten sam korpus, ten sam sędzia, w czasie) — nie certyfikat jakości ani twierdzenie',
  '  marketingowe.',
  '- **Sędzia to LLM, nie audytor.** Werdykty PASS/FAIL i oceny 1–5 pochodzą z modelu-sędziego',
  '  (patrz `consultingBenchmarkJudgeService.ts`) — podlegają jego własnym ograniczeniom i wariancji,',
  '  nie są niezależnie zweryfikowane przez eksperta co do każdego zadania.',
  '',
].join('\n');

/**
 * Renders the full scorecard Markdown. `latest` is the run the headline
 * numbers describe; `otherRuns` are listed underneath for context ONLY
 * (never blended into the headline numbers — see module header).
 */
export function renderScorecardMarkdown(
  latest: LoadedRun | null,
  otherRuns: LoadedRun[],
  opts?: { generatedAt?: string }
): string {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();
  const lines: string[] = [];

  lines.push('# Consulting Benchmark Scorecard');
  lines.push('');
  lines.push(`_Generated: ${generatedAt}_`);
  lines.push('');

  if (!latest) {
    lines.push('**No graded runs yet.**');
    lines.push('');
    lines.push(
      'No run result files were found under the results directory. Run ' +
        '`npx tsx server/scripts/run-consulting-benchmark.ts` (optionally with `--generate`) ' +
        'to produce one, then re-run this script.'
    );
    lines.push('');
    lines.push(NOT_CLAIMED_SECTION);
    return `${lines.join('\n')}\n`;
  }

  const sc = latest.run.scorecard;

  lines.push('## Latest run');
  lines.push('');
  lines.push(`- Run id: \`${latest.run.runId}\``);
  lines.push(`- Run date: ${latest.run.timestamp}`);
  lines.push(`- Corpus hash: \`${latest.run.corpusHash}\``);
  if (latest.run.tier) lines.push(`- Judge model tier: \`${latest.run.tier}\``);
  if (latest.run.adapterSource) lines.push(`- Judge adapter: ${latest.run.adapterSource}`);
  lines.push(`- Tasks in corpus for this run: ${latest.run.taskCount}`);
  lines.push('');

  lines.push('## Overall');
  lines.push('');
  lines.push(`- Graded: ${sc.gradedTasks} / ${sc.totalTasks} (ungraded: ${sc.ungradedTasks})`);
  lines.push(
    sc.passRatePct === null
      ? `- Pass rate: n/a (0 graded tasks — nothing fabricated)`
      : `- Pass rate: ${pct(sc.passRatePct)} (${sc.passCount}/${sc.gradedTasks} graded, PASS all-criteria verdict)`
  );
  lines.push('');

  lines.push('## Average of the 5 quality dimensions (1.0–5.0 scale)');
  lines.push('');
  if (!sc.averageDimensions) {
    lines.push('_n/a — 0 graded tasks, no dimension scores to average._');
    lines.push('');
  } else {
    lines.push('| Dimension | Average |');
    lines.push('| --- | ---: |');
    for (const dim of SCORECARD_DIMENSIONS) {
      const value = sc.averageDimensions[dim.key];
      lines.push(`| ${dim.label} | ${typeof value === 'number' ? value.toFixed(2) : 'n/a'} |`);
    }
    lines.push('');
  }

  lines.push(...renderGroupTable('Pass rate per archetype', sc.byArchetype));
  lines.push(...renderGroupTable('Pass rate per domain', sc.byDomain));

  if (otherRuns.length > 0) {
    lines.push('## Other available runs (context only — not blended into the numbers above)');
    lines.push('');
    lines.push('| Run id | Date | Corpus hash | Graded | Pass rate |');
    lines.push('| --- | --- | --- | ---: | ---: |');
    const sorted = [...otherRuns].sort((a, b) => b.run.timestamp.localeCompare(a.run.timestamp));
    for (const { run } of sorted) {
      const rate = run.scorecard.passRatePct === null ? 'n/a' : pct(run.scorecard.passRatePct);
      lines.push(
        `| \`${run.runId}\` | ${run.timestamp} | \`${run.corpusHash}\` | ${run.scorecard.gradedTasks}/${run.scorecard.totalTasks} | ${rate} |`
      );
    }
    lines.push('');
  }

  lines.push(NOT_CLAIMED_SECTION);

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function logLine(quiet: boolean, message: string): void {
  if (quiet) return;
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

export async function runScorecard(argv: string[]): Promise<number> {
  const parsed = parseScorecardArgs(argv);
  if (!parsed.ok) {
    logError(`[benchmark-scorecard] Argument error: ${parsed.error}`);
    return EXIT_ERROR;
  }
  const args = parsed.args;

  const runs = loadAllRuns(args.resultsDir);
  const latest = pickLatestRun(runs);
  const others = latest ? runs.filter((r) => r.filePath !== latest.filePath) : [];

  const markdown = renderScorecardMarkdown(latest, others);

  try {
    const abs = path.resolve(process.cwd(), args.outputPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, markdown, 'utf8');
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[benchmark-scorecard] Failed to write ${args.outputPath}: ${String(message)}`);
    return EXIT_ERROR;
  }

  if (!latest) {
    logLine(
      args.quiet,
      `[benchmark-scorecard] No run files found under "${args.resultsDir}" — wrote "no graded runs yet" card to ${args.outputPath}.`
    );
  } else {
    const sc = latest.run.scorecard;
    logLine(
      args.quiet,
      `[benchmark-scorecard] Wrote ${args.outputPath} from run "${latest.run.runId}" ` +
        `(${sc.gradedTasks}/${sc.totalTasks} graded, pass rate ${sc.passRatePct === null ? 'n/a' : pct(sc.passRatePct)}). ` +
        `${others.length} other run(s) found.`
    );
  }

  return EXIT_OK;
}

const isMainModule = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] || '').href;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  runScorecard(process.argv.slice(2))
    .then((exitCode) => {
      // eslint-disable-next-line no-console
      console.log(`Exit code: ${exitCode}`);
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[benchmark-scorecard] Unhandled failure: ${String(message)}`);
      process.exit(EXIT_ERROR);
    });
}
