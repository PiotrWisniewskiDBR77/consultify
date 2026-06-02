/**
 * Monthly Presentation Benchmark Runner (Epic H1)
 *
 * Reads a JSON file with per-deck judge scores for the DBR77/VTS reference
 * pool, computes the monthly scorecard via
 * `presentationBenchmarkScorecardService.computeBenchmarkScorecard`, renders
 * a deterministic Markdown report, and (optionally) persists the run to
 * `presentation_benchmark_runs`.
 *
 * Schema-tolerant: when the DB or the backing table is unavailable, the
 * compute + render path still succeeds. Persistence is opt-in via
 * `--persist`. The script never throws — failures are reported on stderr
 * and surfaced via exit code.
 *
 * Usage:
 *   npx tsx server/scripts/run-monthly-benchmark.ts \
 *     --organization-id org_123 \
 *     --run-label 2026-05 \
 *     --reference-set DBR77+VTS \
 *     --input ./scores.json \
 *     [--report-file ./monthly-benchmark-2026-05.json] \
 *     [--markdown-file ./monthly-benchmark-2026-05.md] \
 *     [--reported-by piotr@dbr77.com] \
 *     [--persist] \
 *     [--quiet]
 *
 * Exit codes:
 *   0 — PASS or PASS_WITH_WARNINGS
 *   1 — BLOCK verdict
 *   2 — argument or runtime error
 *
 * See `docs/operations/PRESENTATION_MONTHLY_BENCHMARK_OPERATIONS.md` for the
 * full runbook, cron suggestion, and failure-mode notes.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  BENCHMARK_DIMENSIONS,
  computeBenchmarkScorecard,
  fetchPriorBenchmarkRun,
  persistBenchmarkRun,
  renderBenchmarkScorecardMarkdown,
  type BenchmarkRunRecord,
  type DeckScoreInput,
} from '../src/services/presentationBenchmarkScorecardService.js';
import {
  DEFAULT_RUBRICS,
  judgeDeckBenchmark,
  judgeResultToDeckScoreInput,
  noopLlmAdapter,
  type JudgeDeckInput,
  type JudgeResult,
  type LlmJudgeAdapter,
} from '../src/services/presentationBenchmarkJudgeService.js';
import { get as dbGet } from '../src/utils/DbPromise.js';

// ---------------------------------------------------------------------------
// CLI types
// ---------------------------------------------------------------------------

interface CliArgs {
  organizationId: string;
  runLabel: string;
  referenceSet: string;
  /** Required unless `--judge` is set; in that case the judge produces inputs. */
  inputFile: string | null;
  /** Comma-separated deck IDs to score via the LLM judge. */
  judgeDeckIds: string[];
  reportFile: string | null;
  markdownFile: string | null;
  reportedBy: string | null;
  notes: string | null;
  persist: boolean;
  quiet: boolean;
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
  '--run-label',
  '--reference-set',
  '--input',
  '--judge',
  '--report-file',
  '--markdown-file',
  '--reported-by',
  '--notes',
  '--persist',
  '--quiet',
]);

const KNOWN_FLAG_PREFIXES = [
  '--organization-id=',
  '--run-label=',
  '--reference-set=',
  '--input=',
  '--judge=',
  '--report-file=',
  '--markdown-file=',
  '--reported-by=',
  '--notes=',
  '--persist=',
  '--quiet=',
];

const EXIT_OK = 0;
const EXIT_BLOCK = 1;
const EXIT_ARG_ERROR = 2;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

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
  if (argv.includes(bare)) return true;
  return argv.includes(`--${name}=true`);
}

function isKnownFlag(token: string): boolean {
  if (KNOWN_FLAGS.has(token)) return true;
  for (const prefix of KNOWN_FLAG_PREFIXES) {
    if (token.startsWith(prefix)) return true;
  }
  return false;
}

const RUN_LABEL_RE = /^\d{4}-\d{2}$/;

function parseArgs(argv: string[]): ParseOk | ParseErr {
  for (const token of argv) {
    if (token.startsWith('--') && !isKnownFlag(token)) {
      return { ok: false, error: `Unknown flag: ${token}` };
    }
  }

  const organizationId = getSingleFlagValue('organization-id', argv);
  if (!organizationId) return { ok: false, error: '--organization-id is required' };

  const runLabel = getSingleFlagValue('run-label', argv);
  if (!runLabel) return { ok: false, error: '--run-label is required' };
  if (!RUN_LABEL_RE.test(runLabel)) {
    return { ok: false, error: `--run-label must match YYYY-MM (got "${runLabel}")` };
  }

  const inputFileRaw = getSingleFlagValue('input', argv);
  const judgeRaw = getSingleFlagValue('judge', argv);
  const judgeDeckIds = judgeRaw
    ? judgeRaw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

  const inputFile = inputFileRaw && inputFileRaw.length > 0 ? inputFileRaw : null;
  if (!inputFile && judgeDeckIds.length === 0) {
    return {
      ok: false,
      error: '--input is required unless --judge is set with at least one deck id',
    };
  }

  const referenceSetRaw = getSingleFlagValue('reference-set', argv);
  const referenceSet =
    referenceSetRaw && referenceSetRaw.trim().length > 0 ? referenceSetRaw.trim() : 'DBR77+VTS';

  const reportFileRaw = getSingleFlagValue('report-file', argv);
  const reportFile = reportFileRaw && reportFileRaw.length > 0 ? reportFileRaw : null;

  const markdownFileRaw = getSingleFlagValue('markdown-file', argv);
  const markdownFile = markdownFileRaw && markdownFileRaw.length > 0 ? markdownFileRaw : null;

  const reportedByRaw = getSingleFlagValue('reported-by', argv);
  const reportedBy = reportedByRaw && reportedByRaw.length > 0 ? reportedByRaw : null;

  const notesRaw = getSingleFlagValue('notes', argv);
  const notes = notesRaw && notesRaw.length > 0 ? notesRaw : null;

  const persist = hasBareFlag('persist', argv);
  const quiet = hasBareFlag('quiet', argv);

  return {
    ok: true,
    args: {
      organizationId,
      runLabel,
      referenceSet,
      inputFile,
      judgeDeckIds,
      reportFile,
      markdownFile,
      reportedBy,
      notes,
      persist,
      quiet,
    },
  };
}

// ---------------------------------------------------------------------------
// I/O helpers
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

// ---------------------------------------------------------------------------
// Judge integration (Sprint 16, opt-in via --judge)
// ---------------------------------------------------------------------------

interface JudgeOutcome {
  deckId: string;
  deckTitle: string;
  result: JudgeResult;
}

function safeParseDeckJson(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function pickArray(obj: unknown, key: string): unknown[] {
  if (!obj || typeof obj !== 'object') return [];
  const v = (obj as Record<string, unknown>)[key];
  return Array.isArray(v) ? v : [];
}

function collectBullets(source: Record<string, unknown>, fallbackText: string): string[] {
  const candidates: unknown[] = [];
  for (const key of [
    'bullets',
    'points',
    'key_findings',
    'messages',
    'left_items',
    'right_items',
    'items',
    'recommendations',
  ]) {
    const v = source[key];
    if (Array.isArray(v)) candidates.push(...v);
  }
  const flattened: string[] = [];
  for (const c of candidates) {
    if (typeof c === 'string') flattened.push(c);
    else if (c && typeof c === 'object') {
      const obj = c as Record<string, unknown>;
      const text = obj.text ?? obj.title ?? obj.message ?? obj.description;
      if (typeof text === 'string') flattened.push(text);
    }
  }
  if (flattened.length === 0 && fallbackText) flattened.push(fallbackText);
  return flattened;
}

function extractSlideSummaries(
  unified: unknown,
  deck: unknown,
  outline: unknown
): JudgeDeckInput['slideSummaries'] {
  const out: JudgeDeckInput['slideSummaries'] = [];

  const unifiedSlides = pickArray(unified, 'slides');
  for (let i = 0; i < unifiedSlides.length; i++) {
    const slide = unifiedSlides[i];
    if (!slide || typeof slide !== 'object') continue;
    const s = slide as Record<string, unknown>;
    const intent = typeof s.intent === 'string' ? s.intent : 'slide';
    const keyMessage = typeof s.key_message === 'string' ? s.key_message : '';
    const content = (s.content && typeof s.content === 'object'
      ? (s.content as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const title =
      (typeof content.title === 'string' && content.title) ||
      (typeof content.headline === 'string' && content.headline) ||
      (typeof content.section_title === 'string' && content.section_title) ||
      keyMessage ||
      `Slide ${i + 1}`;
    out.push({
      index: i,
      title: String(title),
      bullets: collectBullets(content, keyMessage),
      layoutHint: intent,
    });
  }
  if (out.length > 0) return out;

  const deckSlides = pickArray(deck, 'slides');
  for (let i = 0; i < deckSlides.length; i++) {
    const slide = deckSlides[i];
    if (!slide || typeof slide !== 'object') continue;
    const s = slide as Record<string, unknown>;
    const title =
      (typeof s.title === 'string' && s.title) ||
      (typeof s.headline === 'string' && s.headline) ||
      `Slide ${i + 1}`;
    out.push({ index: i, title: String(title), bullets: collectBullets(s, '') });
  }
  if (out.length > 0) return out;

  const outlineSections = pickArray(outline, 'sections');
  for (let i = 0; i < outlineSections.length; i++) {
    const section = outlineSections[i];
    if (!section || typeof section !== 'object') continue;
    const s = section as Record<string, unknown>;
    const title =
      (typeof s.title === 'string' && s.title) ||
      (typeof s.heading === 'string' && s.heading) ||
      `Section ${i + 1}`;
    const bulletsRaw = Array.isArray(s.bullets)
      ? s.bullets
      : Array.isArray(s.points)
        ? s.points
        : [];
    out.push({
      index: i,
      title: String(title),
      bullets: bulletsRaw.filter((b): b is string => typeof b === 'string'),
    });
  }

  return out;
}

async function fetchJudgeDeck(
  deckId: string,
  organizationId: string
): Promise<JudgeDeckInput | null> {
  try {
    const row = (await dbGet(
      `SELECT id, title, template_id, deck_json, unified_json, outline_json
         FROM presentation_decks
        WHERE id = ? AND organization_id = ?
        LIMIT 1`,
      [deckId, organizationId]
    )) as
      | {
          id?: unknown;
          title?: unknown;
          template_id?: unknown;
          deck_json?: unknown;
          unified_json?: unknown;
          outline_json?: unknown;
        }
      | undefined;
    if (!row || !row.id) return null;
    const unified = safeParseDeckJson(row.unified_json);
    const deck = safeParseDeckJson(row.deck_json);
    const outline = safeParseDeckJson(row.outline_json);
    return {
      deckId: String(row.id),
      deckTitle: typeof row.title === 'string' ? row.title : String(row.id),
      slideSummaries: extractSlideSummaries(unified, deck, outline),
      templateName: typeof row.template_id === 'string' ? row.template_id : undefined,
    };
  } catch {
    return null;
  }
}

function hasAnyLlmKey(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.OPENROUTER_API_KEY
  );
}

async function resolveJudgeAdapter(): Promise<{
  adapter: LlmJudgeAdapter;
  source: 'real' | 'noop';
  reason?: string;
}> {
  if (!hasAnyLlmKey()) {
    return {
      adapter: noopLlmAdapter,
      source: 'noop',
      reason: 'no LLM API keys present in environment',
    };
  }
  try {
    const mod = await import(/* @vite-ignore */ '../src/services/ai/llmService.js');
    const llmService = (mod as { llmService?: unknown }).llmService;
    if (!llmService || typeof (llmService as { call?: unknown }).call !== 'function') {
      return { adapter: noopLlmAdapter, source: 'noop', reason: 'llmService.call missing' };
    }
    const adapter: LlmJudgeAdapter = {
      async judge({ systemPrompt, userPrompt }) {
        try {
          const result = await (llmService as {
            call: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
          }).call({
            type: 'text',
            modelConfig: { id: process.env.BENCHMARK_JUDGE_MODEL_TIER || 'standard' },
            systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0,
            maxTokens: 1500,
            cache: false,
          });
          const rawText =
            (typeof result.text === 'string' && result.text) ||
            (typeof result.content === 'string' && result.content) ||
            '';
          const provider = typeof result.provider === 'string' ? result.provider : undefined;
          if (!rawText) return { status: 'unavailable', reason: 'empty_text', modelId: provider };
          return { status: 'ok', rawText, modelId: provider };
        } catch (error) {
          const message = (error as { message?: unknown })?.message ?? String(error);
          const lower = String(message).toLowerCase();
          if (lower.includes('rate') || lower.includes('429') || lower.includes('quota')) {
            return { status: 'rate_limited', reason: String(message) };
          }
          if (lower.includes('timeout') || lower.includes('aborted')) {
            return { status: 'timeout', reason: String(message) };
          }
          return { status: 'unavailable', reason: String(message) };
        }
      },
    };
    return { adapter, source: 'real' };
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return { adapter: noopLlmAdapter, source: 'noop', reason: `llmService import failed: ${String(message)}` };
  }
}

async function runJudgeForDecks(
  args: CliArgs
): Promise<{ decks: DeckScoreInput[]; outcomes: JudgeOutcome[]; adapterSource: 'real' | 'noop' }> {
  const adapterInfo = await resolveJudgeAdapter();
  if (adapterInfo.source === 'noop') {
    logLine(
      args.quiet,
      `[run-monthly-benchmark] --judge requested but no LLM adapter available — ${adapterInfo.reason || 'noop adapter'}. Decks will report status=unavailable.`
    );
  } else {
    logLine(args.quiet, '[run-monthly-benchmark] --judge: real LLM adapter resolved (llmService).');
  }

  const decks: DeckScoreInput[] = [];
  const outcomes: JudgeOutcome[] = [];

  for (const deckId of args.judgeDeckIds) {
    const deck = await fetchJudgeDeck(deckId, args.organizationId);
    if (!deck) {
      const result: JudgeResult = {
        status: 'unavailable',
        reason: 'deck not found in presentation_decks',
      };
      outcomes.push({ deckId, deckTitle: deckId, result });
      continue;
    }
    const result = await judgeDeckBenchmark({
      adapter: adapterInfo.adapter,
      deck,
      rubrics: DEFAULT_RUBRICS,
    });
    outcomes.push({ deckId: deck.deckId, deckTitle: deck.deckTitle, result });
    const mapped = judgeResultToDeckScoreInput(result, deck.deckId, deck.deckTitle);
    if (mapped) decks.push(mapped);
  }

  return { decks, outcomes, adapterSource: adapterInfo.source };
}

function readDeckScores(inputFile: string): { ok: true; decks: DeckScoreInput[] } | { ok: false; error: string } {
  const abs = path.resolve(process.cwd(), inputFile);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return { ok: false, error: `Cannot read --input file ${abs}: ${String(message)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return { ok: false, error: `Invalid JSON in --input file: ${String(message)}` };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: '--input must contain a JSON array of DeckScoreInput' };
  }

  return { ok: true, decks: parsed as DeckScoreInput[] };
}

function writeJsonFile(targetPath: string, payload: unknown): void {
  const abs = path.resolve(process.cwd(), targetPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeTextFile(targetPath: string, payload: string): void {
  const abs = path.resolve(process.cwd(), targetPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, payload.endsWith('\n') ? payload : `${payload}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Stdout summary
// ---------------------------------------------------------------------------

function printSummary(args: CliArgs, record: BenchmarkRunRecord): void {
  const quiet = args.quiet;
  logLine(quiet, '');
  logLine(quiet, `Monthly Benchmark - ${record.runLabel}`);
  logLine(quiet, `Organization: ${record.organizationId}`);
  logLine(quiet, `Reference set: ${record.referenceSet}`);
  logLine(quiet, `Decks scored: ${record.totalDecksScored}`);
  logLine(quiet, `Verdict: ${record.verdict}`);
  logLine(quiet, '');

  const dimColumn = 28;
  logLine(
    quiet,
    `${'Dimension'.padEnd(dimColumn)} | ${'Current'.padStart(7)} | ${'Prior'.padStart(7)} | ${'Delta'.padStart(7)} | Status`
  );
  logLine(quiet, `${'-'.repeat(dimColumn)} | ------- | ------- | ------- | ------`);

  for (const dim of BENCHMARK_DIMENSIONS) {
    const current = record.scores[dim] ?? 0;
    const status =
      current >= 4 ? 'OK' : current >= 3.5 ? '~' : 'FAIL';
    let priorCell = '   -   ';
    let deltaCell = '   -   ';
    if (record.deltaVsPrior && Number.isFinite(record.deltaVsPrior[dim])) {
      const delta = record.deltaVsPrior[dim];
      const prior = Math.round((current - delta) * 100) / 100;
      priorCell = prior.toFixed(2).padStart(7);
      const sign = delta > 0 ? '+' : '';
      deltaCell = `${sign}${delta.toFixed(2)}`.padStart(7);
    }
    logLine(
      quiet,
      `${dim.padEnd(dimColumn)} | ${current.toFixed(2).padStart(7)} | ${priorCell} | ${deltaCell} | ${status}`
    );
  }
  logLine(quiet, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    logError(`[run-monthly-benchmark] Argument error: ${parsed.error}`);
    return EXIT_ARG_ERROR;
  }
  const args = parsed.args;

  let decks: DeckScoreInput[] = [];
  let judgeOutcomes: JudgeOutcome[] = [];
  let judgeAdapterSource: 'real' | 'noop' | null = null;

  if (args.judgeDeckIds.length > 0) {
    const judgeRun = await runJudgeForDecks(args);
    decks = judgeRun.decks;
    judgeOutcomes = judgeRun.outcomes;
    judgeAdapterSource = judgeRun.adapterSource;

    if (decks.length === 0) {
      // CRITICAL: when --judge is set without an LLM adapter (or the
      // adapter returned no usable scores), exit gracefully instead of
      // letting the scorecard pipeline produce a misleading BLOCK on an
      // empty deck list.
      logError(
        '[run-monthly-benchmark] --judge produced no usable DeckScoreInput rows (every deck reported a non-ok status). Skipping scorecard compute.'
      );
      // Still emit the audit side-channel so operators can inspect why.
      if (args.reportFile) {
        const sideChannel = `${args.reportFile}.judge.json`;
        try {
          writeJsonFile(sideChannel, { adapterSource: judgeAdapterSource, outcomes: judgeOutcomes });
          logLine(args.quiet, `[run-monthly-benchmark] Judge audit written: ${sideChannel}`);
        } catch (error) {
          const message = (error as { message?: unknown })?.message ?? String(error);
          logError(`[run-monthly-benchmark] Failed to write judge audit: ${String(message)}`);
        }
      }
      return EXIT_BLOCK;
    }
  } else {
    if (!args.inputFile) {
      logError('[run-monthly-benchmark] --input is required when --judge is not set.');
      return EXIT_ARG_ERROR;
    }
    const decksResult = readDeckScores(args.inputFile);
    if (!decksResult.ok) {
      logError(`[run-monthly-benchmark] ${decksResult.error}`);
      return EXIT_ARG_ERROR;
    }
    decks = decksResult.decks;
  }

  let priorRun: BenchmarkRunRecord | null = null;
  try {
    priorRun = await fetchPriorBenchmarkRun(args.organizationId, args.runLabel, args.referenceSet);
  } catch {
    priorRun = null;
  }

  const record = computeBenchmarkScorecard({
    organizationId: args.organizationId,
    runLabel: args.runLabel,
    referenceSet: args.referenceSet,
    reportedBy: args.reportedBy ?? undefined,
    notes: args.notes ?? undefined,
    decks,
    priorRun,
  });

  record.createdAt = new Date().toISOString();

  if (args.reportFile) {
    try {
      writeJsonFile(args.reportFile, record);
      logLine(args.quiet, `[run-monthly-benchmark] JSON report written: ${args.reportFile}`);
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[run-monthly-benchmark] Failed to write JSON report: ${String(message)}`);
    }

    if (judgeOutcomes.length > 0) {
      // Side-channel audit file with full per-dimension rationale per deck.
      // Path is `<report-file>.judge.json` so it stays grouped with the
      // primary report and is easy to discover in operator workflows.
      const sideChannel = `${args.reportFile}.judge.json`;
      try {
        writeJsonFile(sideChannel, {
          adapterSource: judgeAdapterSource,
          rubric: DEFAULT_RUBRICS,
          outcomes: judgeOutcomes,
        });
        logLine(args.quiet, `[run-monthly-benchmark] Judge audit written: ${sideChannel}`);
      } catch (error) {
        const message = (error as { message?: unknown })?.message ?? String(error);
        logError(`[run-monthly-benchmark] Failed to write judge audit: ${String(message)}`);
      }
    }
  }

  if (args.markdownFile) {
    try {
      const md = renderBenchmarkScorecardMarkdown(record);
      writeTextFile(args.markdownFile, md);
      logLine(args.quiet, `[run-monthly-benchmark] Markdown report written: ${args.markdownFile}`);
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[run-monthly-benchmark] Failed to write Markdown report: ${String(message)}`);
    }
  }

  if (args.persist) {
    try {
      const result = await persistBenchmarkRun(record);
      if (result.status === 'ok') {
        logLine(args.quiet, `[run-monthly-benchmark] Persisted run to presentation_benchmark_runs (id=${result.id || 'n/a'}).`);
      } else if (result.status === 'duplicate') {
        logLine(
          args.quiet,
          `[run-monthly-benchmark] Run already exists for org=${args.organizationId} label=${args.runLabel} — skipping insert (duplicate).`
        );
      } else {
        logError(
          `[run-monthly-benchmark] Persist skipped: storage_error (${result.reason || 'unknown'}). Re-run with backing migration applied.`
        );
      }
    } catch (error) {
      const message = (error as { message?: unknown })?.message ?? String(error);
      logError(`[run-monthly-benchmark] Persist failed: ${String(message)}`);
    }
  } else {
    logLine(args.quiet, '[run-monthly-benchmark] Dry-run mode (use --persist to write to DB).');
  }

  printSummary(args, record);

  if (record.verdict === 'BLOCK') return EXIT_BLOCK;
  return EXIT_OK;
}

async function main(): Promise<void> {
  let exitCode = EXIT_ARG_ERROR;
  try {
    exitCode = await run();
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-monthly-benchmark] Unhandled failure: ${String(message)}`);
    exitCode = EXIT_ARG_ERROR;
  }
  // eslint-disable-next-line no-console
  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

void main();
