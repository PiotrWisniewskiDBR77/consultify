/**
 * Presentation Benchmark Judge CLI (Epic H1, Sprint 16)
 *
 * Calls the LLM judge service for each requested deck, mapping the
 * results onto the Sprint 15 `DeckScoreInput[]` shape so they can be
 * piped directly into `run-monthly-benchmark.ts --input`.
 *
 * Usage:
 *   npx tsx server/scripts/run-benchmark-judge.ts \
 *     --deck-ids deck_a,deck_b \
 *     --organization-id org_123 \
 *     --output-file ./judge-scores.json \
 *     [--rubric-file ./custom-rubric.json] \
 *     [--quiet]
 *
 * Exit codes:
 *   0 — every requested deck was scored successfully
 *   1 — one or more decks were `unavailable` / `rate_limited` / `invalid_response`
 *   2 — argument or runtime error
 *
 * Adapter selection:
 *   1. If the project's `llmService` is importable AND at least one of
 *      OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / GOOGLE_AI_API_KEY
 *      is set, a thin wrapper around `llmService.call(...)` is used.
 *   2. Otherwise the script falls back to `noopLlmAdapter` and warns.
 *      No keys → no LLM call → graceful `unavailable`, NOT a crash.
 */

import * as fs from 'fs';
import * as path from 'path';

import { get as dbGet } from '../src/utils/DbPromise.js';
import {
  DEFAULT_RUBRICS,
  judgeDeckBenchmark,
  judgeResultToDeckScoreInput,
  noopLlmAdapter,
  type JudgeDeckInput,
  type JudgeResult,
  type JudgeRubric,
  type LlmJudgeAdapter,
} from '../src/services/presentationBenchmarkJudgeService.js';
import type { DeckScoreInput } from '../src/services/presentationBenchmarkScorecardService.js';

// ---------------------------------------------------------------------------
// CLI types
// ---------------------------------------------------------------------------

interface CliArgs {
  deckIds: string[];
  organizationId: string;
  outputFile: string;
  rubricFile: string | null;
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
  '--deck-ids',
  '--organization-id',
  '--output-file',
  '--rubric-file',
  '--quiet',
]);

const KNOWN_FLAG_PREFIXES = [
  '--deck-ids=',
  '--organization-id=',
  '--output-file=',
  '--rubric-file=',
  '--quiet=',
];

const EXIT_OK = 0;
const EXIT_PARTIAL = 1;
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

function parseArgs(argv: string[]): ParseOk | ParseErr {
  for (const token of argv) {
    if (token.startsWith('--') && !isKnownFlag(token)) {
      return { ok: false, error: `Unknown flag: ${token}` };
    }
  }

  const deckIdsRaw = getSingleFlagValue('deck-ids', argv);
  if (!deckIdsRaw) {
    return { ok: false, error: '--deck-ids is required (comma-separated list)' };
  }
  const deckIds = deckIdsRaw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (deckIds.length === 0) {
    return { ok: false, error: '--deck-ids must contain at least one id' };
  }

  const organizationId = getSingleFlagValue('organization-id', argv);
  if (!organizationId) return { ok: false, error: '--organization-id is required' };

  const outputFile = getSingleFlagValue('output-file', argv);
  if (!outputFile) return { ok: false, error: '--output-file is required' };

  const rubricFileRaw = getSingleFlagValue('rubric-file', argv);
  const rubricFile = rubricFileRaw && rubricFileRaw.length > 0 ? rubricFileRaw : null;

  const quiet = hasBareFlag('quiet', argv);

  return {
    ok: true,
    args: { deckIds, organizationId, outputFile, rubricFile, quiet },
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

function writeJsonFile(targetPath: string, payload: unknown): void {
  const abs = path.resolve(process.cwd(), targetPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function loadRubricFile(rubricFile: string): JudgeRubric[] | null {
  const abs = path.resolve(process.cwd(), rubricFile);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-benchmark-judge] Cannot read --rubric-file ${abs}: ${String(message)}`);
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      logError('[run-benchmark-judge] --rubric-file must contain a JSON array of JudgeRubric');
      return null;
    }
    return parsed as JudgeRubric[];
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-benchmark-judge] Invalid JSON in --rubric-file: ${String(message)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deck → JudgeDeckInput extraction (schema-tolerant)
// ---------------------------------------------------------------------------

interface DeckRow {
  id?: unknown;
  title?: unknown;
  template_id?: unknown;
  deck_json?: unknown;
  unified_json?: unknown;
  outline_json?: unknown;
}

function safeParseJson(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function asStringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function pickArray(obj: unknown, key: string): unknown[] {
  if (!obj || typeof obj !== 'object') return [];
  const v = (obj as Record<string, unknown>)[key];
  return Array.isArray(v) ? v : [];
}

/**
 * Schema-tolerant slide flattener. Handles unified_json (`{ slides: [...] }`),
 * deck_json (`{ slides: [...] }`), and outline_json (`{ sections: [...] }`)
 * variants and emits a generic `{ index, title, bullets }` shape suitable
 * for the judge prompt.
 */
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
    const title = asStringOr(
      content.title ?? content.headline ?? content.section_title ?? keyMessage,
      `Slide ${i + 1}`
    );
    const bullets = collectBullets(content, keyMessage);
    out.push({ index: i, title, bullets, layoutHint: intent });
  }
  if (out.length > 0) return out;

  const deckSlides = pickArray(deck, 'slides');
  for (let i = 0; i < deckSlides.length; i++) {
    const slide = deckSlides[i];
    if (!slide || typeof slide !== 'object') continue;
    const s = slide as Record<string, unknown>;
    const title = asStringOr(s.title ?? s.headline ?? s.heading, `Slide ${i + 1}`);
    const bullets = collectBullets(s, '');
    out.push({ index: i, title, bullets });
  }
  if (out.length > 0) return out;

  const outlineSections = pickArray(outline, 'sections');
  for (let i = 0; i < outlineSections.length; i++) {
    const section = outlineSections[i];
    if (!section || typeof section !== 'object') continue;
    const s = section as Record<string, unknown>;
    const title = asStringOr(s.title ?? s.heading, `Section ${i + 1}`);
    const bulletsRaw = Array.isArray(s.bullets)
      ? s.bullets
      : Array.isArray(s.points)
        ? s.points
        : [];
    const bullets = bulletsRaw.filter((b): b is string => typeof b === 'string');
    out.push({ index: i, title, bullets });
  }

  return out;
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

async function fetchDeckForJudge(
  deckId: string,
  organizationId: string
): Promise<{ status: 'ok' | 'not_found' | 'error'; deck?: JudgeDeckInput; reason?: string }> {
  let row: DeckRow | undefined;
  try {
    row = (await dbGet(
      `SELECT id, title, template_id, deck_json, unified_json, outline_json
         FROM presentation_decks
        WHERE id = ? AND organization_id = ?
        LIMIT 1`,
      [deckId, organizationId]
    )) as DeckRow | undefined;
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return { status: 'error', reason: `db_error: ${String(message)}` };
  }
  if (!row || !row.id) return { status: 'not_found' };

  const unified = safeParseJson(row.unified_json);
  const deckJson = safeParseJson(row.deck_json);
  const outline = safeParseJson(row.outline_json);

  const meta = (unified && typeof unified === 'object'
    ? ((unified as Record<string, unknown>).meta as Record<string, unknown>)
    : null) ?? null;

  const slideSummaries = extractSlideSummaries(unified, deckJson, outline);

  return {
    status: 'ok',
    deck: {
      deckId: String(row.id),
      deckTitle: typeof row.title === 'string' ? row.title : String(row.id),
      slideSummaries,
      brandKit: meta
        ? {
            primaryColor:
              typeof meta.brandColor === 'string' ? (meta.brandColor as string) : undefined,
            theme: typeof meta.template === 'string' ? (meta.template as string) : undefined,
          }
        : undefined,
      templateName: typeof row.template_id === 'string' ? row.template_id : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter resolution
// ---------------------------------------------------------------------------

function hasAnyLlmKey(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.OPENROUTER_API_KEY
  );
}

async function resolveLlmAdapter(): Promise<{
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
      return {
        adapter: noopLlmAdapter,
        source: 'noop',
        reason: 'llmService import did not expose .call(...)',
      };
    }

    const adapter: LlmJudgeAdapter = {
      async judge({ systemPrompt, userPrompt }) {
        try {
          // Tier shortcuts ('fast' | 'standard' | 'premium' | 'reasoning')
          // are resolved by the LLMService against the LLMConfig table.
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
          const modelId =
            (typeof (result as { modelId?: unknown }).modelId === 'string'
              ? (result as { modelId?: string }).modelId
              : undefined) ?? provider;

          if (!rawText) {
            // Empty text from the provider; surface as `unavailable` so the
            // judge service forwards a clean status. Non-empty but malformed
            // text is handled downstream by `parseJudgeResponse`.
            return { status: 'unavailable', reason: 'empty_text', modelId };
          }

          return { status: 'ok', rawText, modelId };
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
    return {
      adapter: noopLlmAdapter,
      source: 'noop',
      reason: `llmService import failed: ${String(message)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

interface DeckRunOutcome {
  deckId: string;
  deckTitle: string;
  status: JudgeResult['status'] | 'not_found' | 'fetch_error';
  reason?: string;
  modelId?: string;
  durationMs?: number;
  scoreInput?: DeckScoreInput;
}

function printSummary(args: CliArgs, outcomes: DeckRunOutcome[], adapterSource: string): void {
  const quiet = args.quiet;
  logLine(quiet, '');
  logLine(quiet, `Benchmark Judge Run — ${outcomes.length} deck(s) — adapter=${adapterSource}`);
  logLine(quiet, `Org: ${args.organizationId}`);
  logLine(quiet, '');
  const idCol = 24;
  logLine(
    quiet,
    `${'Deck'.padEnd(idCol)} | ${'Status'.padEnd(18)} | ${'Avg'.padStart(5)} | Reason / Model`
  );
  logLine(quiet, `${'-'.repeat(idCol)} | ${'-'.repeat(18)} | ----- | --------------`);

  for (const outcome of outcomes) {
    const idCell = outcome.deckId.length > idCol
      ? `${outcome.deckId.slice(0, idCol - 1)}…`
      : outcome.deckId.padEnd(idCol);
    const statusCell = outcome.status.padEnd(18);
    const avg = outcome.scoreInput
      ? (
          (outcome.scoreInput.contentQuality +
            outcome.scoreInput.visualDesign +
            outcome.scoreInput.longContextProcessing +
            outcome.scoreInput.apiAutomation +
            outcome.scoreInput.conversationalEditing) /
          5
        ).toFixed(2)
      : '  -  ';
    const trail = outcome.reason ?? outcome.modelId ?? '';
    logLine(quiet, `${idCell} | ${statusCell} | ${avg.padStart(5)} | ${trail}`);
  }
  logLine(quiet, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    logError(`[run-benchmark-judge] Argument error: ${parsed.error}`);
    return EXIT_ARG_ERROR;
  }
  const args = parsed.args;

  let rubrics: JudgeRubric[] = DEFAULT_RUBRICS;
  if (args.rubricFile) {
    const loaded = loadRubricFile(args.rubricFile);
    if (!loaded) return EXIT_ARG_ERROR;
    rubrics = loaded;
  }

  const adapterInfo = await resolveLlmAdapter();
  if (adapterInfo.source === 'noop') {
    logLine(
      args.quiet,
      `[run-benchmark-judge] WARNING: using noopLlmAdapter — ${adapterInfo.reason || 'no LLM client configured'}. Decks will report status=unavailable.`
    );
  } else {
    logLine(args.quiet, '[run-benchmark-judge] Real LLM adapter resolved (llmService).');
  }

  const outcomes: DeckRunOutcome[] = [];
  const scoreInputs: DeckScoreInput[] = [];

  for (const deckId of args.deckIds) {
    const fetched = await fetchDeckForJudge(deckId, args.organizationId);
    if (fetched.status !== 'ok' || !fetched.deck) {
      const status = fetched.status === 'not_found' ? 'not_found' : 'fetch_error';
      outcomes.push({
        deckId,
        deckTitle: deckId,
        status,
        reason: fetched.reason,
      });
      logError(`[run-benchmark-judge] Deck ${deckId}: ${status}${fetched.reason ? ` — ${fetched.reason}` : ''}`);
      continue;
    }

    const judge = await judgeDeckBenchmark({
      adapter: adapterInfo.adapter,
      deck: fetched.deck,
      rubrics,
    });
    const scoreInput = judgeResultToDeckScoreInput(judge, fetched.deck.deckId, fetched.deck.deckTitle);
    if (scoreInput) scoreInputs.push(scoreInput);

    outcomes.push({
      deckId: fetched.deck.deckId,
      deckTitle: fetched.deck.deckTitle,
      status: judge.status,
      reason: judge.reason,
      modelId: judge.modelId,
      durationMs: judge.durationMs,
      scoreInput: scoreInput ?? undefined,
    });
  }

  try {
    writeJsonFile(args.outputFile, scoreInputs);
    logLine(args.quiet, `[run-benchmark-judge] Wrote ${scoreInputs.length} DeckScoreInput row(s) to ${args.outputFile}`);
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-benchmark-judge] Failed to write output file: ${String(message)}`);
    return EXIT_ARG_ERROR;
  }

  printSummary(args, outcomes, adapterInfo.source);

  const allOk = outcomes.every((o) => o.status === 'ok');
  return allOk ? EXIT_OK : EXIT_PARTIAL;
}

async function main(): Promise<void> {
  let exitCode = EXIT_ARG_ERROR;
  try {
    exitCode = await run();
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-benchmark-judge] Unhandled failure: ${String(message)}`);
    exitCode = EXIT_ARG_ERROR;
  }
  // eslint-disable-next-line no-console
  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

void main();
