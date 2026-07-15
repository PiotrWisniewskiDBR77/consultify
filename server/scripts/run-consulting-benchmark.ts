/**
 * Consulting Benchmark Runner (Consultify Bench, Blok E / HP-18…21, task E1)
 *
 * Analog of `run-benchmark-judge.ts`: glob task bank -> judge -> versioned
 * JSON out + scorecard. See PROJEKT_BENCHMARK.md §1.1/§1.3/§1.4 for the spec.
 *
 * Usage:
 *   npx tsx server/scripts/run-consulting-benchmark.ts \
 *     [--tasks benchmark/tasks/**\/*.json] \
 *     [--task-ids drd-1A3-001,drd-1A3-002] \
 *     [--lang pl|en] \
 *     [--archetype diagnostic|synthetic|real-anon] \
 *     [--output-dir benchmark/results] \
 *     [--run-id my-run-001] \
 *     [--generate] [--max-tasks 5] \
 *     [--quiet]
 *
 * `--generate` (E4): for every task WITHOUT a pre-collected `modelAnswer`,
 * calls the real PRODUCT LLM path (`generateChatResponse` from
 * `server/src/services/aiService.ts` — the same function real routes use,
 * e.g. `documentBlockProseGenerator.ts` / `docGenerationRuntime.ts`) with a
 * prompt built EXCLUSIVELY via `buildProductPromptPayload(task)` (never the
 * raw task — see ANTI-CONTAMINATION below). Generated answers are cached to
 * `benchmark/answers/<corpusHash>/<taskId>.json` (never written into
 * `benchmark/tasks/**`, never committed — see .gitignore) and reused on
 * subsequent runs so re-running the same corpus doesn't re-spend money.
 * `--max-tasks N` (default 5) caps how many NEW generations (cache misses)
 * happen in a single invocation — a cost/time safety valve, not a limit on
 * how many tasks get judged (cached answers don't count against it). Without
 * `--generate`, tasks with no modelAnswer are reported `no_model_answer`
 * exactly as before (E1-E3 behaviour, unchanged).
 *
 * Exit codes:
 *   0 — every task that had a model answer was graded (status 'ok'); PASS/FAIL
 *       verdict content does NOT affect the exit code (that is scorecard, not
 *       run-health, territory)
 *   1 — one or more tasks were ungraded (unavailable / rate_limited /
 *       invalid_response / timeout / no_model_answer)
 *   2 — argument or runtime error, or zero task files found
 *
 * TASK FILE SHAPE (working assumption pending E2/E3's task-bank generators):
 *   A JSON file under `benchmark/tasks/**` matching `JudgeTaskInput` (see
 *   `consultingBenchmarkJudgeService.ts`) plus optional `version`,
 *   `provenance`, `sourceRef` metadata. `modelAnswer` is OPTIONAL on disk —
 *   most task-bank entries won't carry one (E2/E3 emit prompt+context+
 *   criteria only, never a canned answer). See "Product answer resolution"
 *   below for how a modelAnswer is obtained per task.
 *
 * ANTI-CONTAMINATION (PROJEKT_BENCHMARK.md §4.3): this runner is a judge-only
 * harness. It reads goldNotes/binaryCriteria/scaleRubrics from the task file
 * for GRADING only. The model-under-test call (`--generate`) builds its
 * prompt EXCLUSIVELY via `buildProductPromptPayload(task)` — never the raw
 * task object (which carries goldNotes/criteria) — enforced in `run()` below.
 *
 * Adapter selection (judge LLM, same convention as run-benchmark-judge.ts):
 *   1. If the project's `llmService` is importable AND at least one of
 *      OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / GOOGLE_AI_API_KEY /
 *      OPENROUTER_API_KEY is set, a thin wrapper around `llmService.call(...)`
 *      is used, tier via BENCHMARK_JUDGE_MODEL_TIER (default 'standard').
 *   2. Otherwise falls back to `noopLlmAdapter` and warns. No keys → no LLM
 *      call → every task reports status=unavailable, NOT a crash, NOT a
 *      fabricated score (§4.2: never report a flaky/absent judge as a real
 *      low pass-rate).
 *
 * Same key-presence gate applies to `--generate`: no keys → a clear one-line
 * warning is printed, generation is skipped for every task (they fall back
 * to `no_model_answer`), never a crash, never a fabricated answer.
 *
 * COST WARNING: `--generate` makes REAL, BILLED LLM calls (tier via
 * BENCHMARK_GENERATE_MODEL_TIER, default 'premium' — the same tier the
 * product uses for its highest-stakes generations, e.g. initiative/decision
 * drafting). Keep `--max-tasks` low for exploratory runs; the full 100-task
 * corpus is ~100 premium-tier calls if the answer cache is empty.
 *
 * ENVIRONMENT NOTE: `--generate` imports the real `aiService.ts`/`llmService.ts`
 * product path, which (by tier-string convention, e.g. `{ id: 'premium' }`)
 * resolves the active provider via `LLMConfigService`, which reads the DB.
 * That means `--generate` needs the SAME environment a real server process
 * needs — notably `DATABASE_URL` — not just an LLM API key. Running it with
 * no `DATABASE_URL` at all hits `DatabaseConfig.ts`'s own hard
 * `process.exit(1)` (pre-existing product behaviour, not introduced here).
 * This is expected to be a non-issue on staging/demo (where DATABASE_URL is
 * always set); it was not independently re-verified end-to-end against a
 * live provider from a bare local shell (no reachable DB / no real keys in
 * this sandbox — see the script's own `--generate`-with-no-keys smoke path,
 * which IS verified and prints a clean warning with no crash).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  buildProductPromptPayload,
  DEFAULT_CONSULTING_RUBRICS,
  judgeConsultingTask,
  noopLlmAdapter,
  type BinaryCriterion,
  type ConsultingRubric,
  type JudgeResult,
  type JudgeTaskInput,
  type LlmJudgeAdapter,
} from '../src/services/consultingBenchmarkJudgeService.js';

// ---------------------------------------------------------------------------
// CLI types
// ---------------------------------------------------------------------------

interface CliArgs {
  tasksGlobRoot: string;
  taskIds: string[] | null;
  lang: 'pl' | 'en' | null;
  archetype: 'diagnostic' | 'synthetic' | 'real-anon' | null;
  outputDir: string;
  runId: string;
  quiet: boolean;
  /** E4: invoke the real product LLM path for tasks with no modelAnswer. */
  generate: boolean;
  /** E4: cap on NEW generations (cache misses) in this invocation. Cost safety valve. */
  maxTasks: number;
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
  '--tasks',
  '--task-ids',
  '--lang',
  '--archetype',
  '--output-dir',
  '--run-id',
  '--quiet',
  '--generate',
  '--max-tasks',
]);

const KNOWN_FLAG_PREFIXES = KNOWN_FLAGS.size
  ? Array.from(KNOWN_FLAGS, (f) => `${f}=`)
  : [];

const EXIT_OK = 0;
const EXIT_PARTIAL = 1;
const EXIT_ARG_ERROR = 2;

const DEFAULT_TASKS_ROOT = path.join('benchmark', 'tasks');
const DEFAULT_OUTPUT_DIR = path.join('benchmark', 'results');
const DEFAULT_ANSWERS_DIR = path.join('benchmark', 'answers');

/** E4 cost safety valve default: cap on NEW (cache-miss) generations per invocation. */
const DEFAULT_MAX_GENERATE_TASKS = 5;

/** E4: product tier used for the model-under-test call — same convention as
 * BENCHMARK_JUDGE_MODEL_TIER, but a distinct env var since judge and
 * generation are different calls with potentially different cost profiles.
 * Defaults to 'premium' — the tier the product uses for its highest-stakes
 * generations (initiative/decision drafting, presentation layouts). */
function generateModelTier(): string {
  return process.env.BENCHMARK_GENERATE_MODEL_TIER || 'premium';
}

/** E4: hard wall-clock cap for one generation call (defense in depth on top
 * of aiService.ts's own internal 30s timeout). */
function generateTimeoutMs(): number {
  const raw = Number(process.env.BENCHMARK_GENERATE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60_000;
}

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

function defaultRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv: string[]): ParseOk | ParseErr {
  for (const token of argv) {
    if (token.startsWith('--') && !isKnownFlag(token)) {
      return { ok: false, error: `Unknown flag: ${token}` };
    }
  }

  const tasksGlobRoot = getSingleFlagValue('tasks', argv) || DEFAULT_TASKS_ROOT;

  const taskIdsRaw = getSingleFlagValue('task-ids', argv);
  const taskIds = taskIdsRaw
    ? taskIdsRaw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : null;

  const langRaw = getSingleFlagValue('lang', argv);
  if (langRaw && langRaw !== 'pl' && langRaw !== 'en') {
    return { ok: false, error: `--lang must be 'pl' or 'en', got: ${langRaw}` };
  }
  const lang = (langRaw as 'pl' | 'en' | null) ?? null;

  const archetypeRaw = getSingleFlagValue('archetype', argv);
  if (
    archetypeRaw &&
    archetypeRaw !== 'diagnostic' &&
    archetypeRaw !== 'synthetic' &&
    archetypeRaw !== 'real-anon'
  ) {
    return { ok: false, error: `--archetype invalid: ${archetypeRaw}` };
  }
  const archetype = (archetypeRaw as CliArgs['archetype']) ?? null;

  const outputDir = getSingleFlagValue('output-dir', argv) || DEFAULT_OUTPUT_DIR;
  const runId = getSingleFlagValue('run-id', argv) || defaultRunId();
  const quiet = hasBareFlag('quiet', argv);
  const generate = hasBareFlag('generate', argv);

  const maxTasksRaw = getSingleFlagValue('max-tasks', argv);
  let maxTasks = DEFAULT_MAX_GENERATE_TASKS;
  if (maxTasksRaw !== null && maxTasksRaw !== '') {
    const parsed = Number(maxTasksRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, error: `--max-tasks must be a non-negative integer, got: ${maxTasksRaw}` };
    }
    maxTasks = parsed;
  }

  return {
    ok: true,
    args: { tasksGlobRoot, taskIds, lang, archetype, outputDir, runId, quiet, generate, maxTasks },
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

// ---------------------------------------------------------------------------
// Task bank loading (glob JSON from repo — NOT the DB; PROJEKT_BENCHMARK §1.3)
// ---------------------------------------------------------------------------

interface TaskFileRecord {
  filePath: string;
  taskId: string;
  version?: string;
  provenance?: string;
  sourceRef?: string;
  task: JudgeTaskInput;
}

function findJsonFiles(rootDir: string): string[] {
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

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeBinaryCriteriaFromFile(value: unknown): BinaryCriterion[] {
  if (!Array.isArray(value)) return [];
  const out: BinaryCriterion[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : null;
    if (!id) continue;
    out.push({
      id,
      description: safeString(e.description),
      guidance: safeString(e.guidance),
    });
  }
  return out;
}

function safeScaleRubricsFromFile(value: unknown): ConsultingRubric[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value as ConsultingRubric[];
}

/**
 * Parses one task-bank JSON file into a `TaskFileRecord`. Tolerant: a
 * malformed file is skipped (logged), never throws, never crashes the run.
 */
function loadTaskFile(filePath: string): TaskFileRecord | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-consulting-benchmark] Cannot read ${filePath}: ${String(message)}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-consulting-benchmark] Invalid JSON in ${filePath}: ${String(message)}`);
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    logError(`[run-consulting-benchmark] Skipping ${filePath}: top-level value is not an object`);
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const taskId = safeString(obj.taskId ?? obj.id);
  const prompt = safeString(obj.prompt);
  if (!taskId || !prompt) {
    logError(
      `[run-consulting-benchmark] Skipping ${filePath}: missing required "taskId"/"id" or "prompt"`
    );
    return null;
  }

  const task: JudgeTaskInput = {
    taskId,
    prompt,
    context: typeof obj.context === 'string' ? obj.context : undefined,
    modelAnswer: safeString(obj.modelAnswer),
    binaryCriteria: safeBinaryCriteriaFromFile(obj.binaryCriteria ?? obj.rubric),
    scaleRubrics: safeScaleRubricsFromFile(obj.scaleRubrics),
    goldNotes: typeof obj.goldNotes === 'string' ? obj.goldNotes : undefined,
    archetype:
      obj.archetype === 'diagnostic' || obj.archetype === 'synthetic' || obj.archetype === 'real-anon'
        ? obj.archetype
        : undefined,
    domain: typeof obj.domain === 'string' ? obj.domain : undefined,
    lang: obj.lang === 'pl' || obj.lang === 'en' ? obj.lang : undefined,
  };

  return {
    filePath,
    taskId,
    version: typeof obj.version === 'string' ? obj.version : undefined,
    provenance: typeof obj.provenance === 'string' ? obj.provenance : undefined,
    sourceRef: typeof obj.sourceRef === 'string' ? obj.sourceRef : undefined,
    task,
  };
}

function loadTaskBank(args: CliArgs): TaskFileRecord[] {
  const files = findJsonFiles(args.tasksGlobRoot);
  const records: TaskFileRecord[] = [];
  for (const file of files) {
    const record = loadTaskFile(file);
    if (!record) continue;
    if (args.taskIds && !args.taskIds.includes(record.taskId)) continue;
    if (args.lang && record.task.lang && record.task.lang !== args.lang) continue;
    if (args.archetype && record.task.archetype && record.task.archetype !== args.archetype) continue;
    records.push(record);
  }
  return records;
}

/** Stable hash of the loaded task bank content — embedded in every result so
 * runs against a changed corpus are never silently compared as equivalent. */
function computeCorpusHash(records: TaskFileRecord[]): string {
  const hash = crypto.createHash('sha256');
  const sorted = [...records].sort((a, b) => a.taskId.localeCompare(b.taskId));
  for (const r of sorted) {
    hash.update(r.taskId);
    hash.update('|');
    hash.update(JSON.stringify(r.task));
    hash.update('|');
  }
  return hash.digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Product answer resolution
// ---------------------------------------------------------------------------

/**
 * E4: wires a real call into the product LLM path — `generateChatResponse`
 * from `server/src/services/aiService.ts`, the SAME function real routes use
 * (document generation/refinement, assessment initiative drafting, the
 * prompt-assistant route) — using ONLY `buildProductPromptPayload(task)` as
 * the input (never the raw task, which carries goldNotes/binaryCriteria; see
 * PROJEKT_BENCHMARK.md §4.3 / the module header ANTI-CONTAMINATION note).
 *
 * A task file MAY carry a pre-collected `modelAnswer` (e.g. captured from a
 * prior manual or scripted product run) — that always wins over generation.
 * Tasks with neither a `modelAnswer` nor `--generate` are reported
 * `no_model_answer` — skipped, never crashing, never inventing an answer.
 */

type GenerationStatus = 'ok' | 'unavailable' | 'timeout' | 'rate_limited';

interface GenerationOutcome {
  status: GenerationStatus;
  text?: string;
  reason?: string;
  durationMs?: number;
}

/** Sanitizes a taskId into a safe filename component (defense in depth — task
 * ids are expected to already be filesystem-safe, e.g. "drd-4C7-051"). */
function sanitizeForFilename(id: string): string {
  return id.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'task';
}

function answerCachePath(answersDir: string, corpusHash: string, taskId: string): string {
  return path.join(answersDir, corpusHash, `${sanitizeForFilename(taskId)}.json`);
}

/** Loads a previously generated answer from the local cache, if present and
 * non-empty. Cache misses / corrupt files are treated the same as "no cache"
 * — never throws, never blocks the run. */
function loadCachedAnswer(answersDir: string, corpusHash: string, taskId: string): string | null {
  const abs = path.resolve(process.cwd(), answerCachePath(answersDir, corpusHash, taskId));
  if (!fs.existsSync(abs)) return null;
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
    return answer.length > 0 ? answer : null;
  } catch {
    return null;
  }
}

function timeoutGuard<T>(promise: Promise<T>, ms: number): Promise<T | { __timedOut: true }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ __timedOut: true });
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        // Errors are surfaced by the caller's own try/catch around `promise`;
        // this branch only exists so the timer always gets cleared.
        if (settled) return;
        settled = true;
        clearTimeout(timer);
      }
    );
  });
}

/**
 * Calls the product's real LLM path with EXACTLY the firewalled payload
 * (`{ prompt, context }`) — never the raw task. Never throws: every failure
 * mode (missing import, empty response, rate limit, timeout, provider error)
 * is returned as a typed `GenerationOutcome`, matching the judge service's
 * own never-throws discipline.
 */
async function generateProductAnswer(
  payload: { prompt: string; context?: string }
): Promise<GenerationOutcome> {
  const startedAt = Date.now();

  let generateChatResponse: (params: {
    systemPrompt?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    maxTokens?: number;
  }) => Promise<{ content: string }>;

  try {
    const mod = await import(/* @vite-ignore */ '../src/services/aiService.js');
    const fn = (mod as { generateChatResponse?: unknown }).generateChatResponse;
    if (typeof fn !== 'function') {
      return {
        status: 'unavailable',
        reason: 'aiService import did not expose generateChatResponse(...)',
        durationMs: Date.now() - startedAt,
      };
    }
    generateChatResponse = fn as typeof generateChatResponse;
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return {
      status: 'unavailable',
      reason: `aiService import failed: ${String(message)}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const userContent = payload.context
    ? `${payload.prompt}\n\n---\nContext:\n${payload.context}`
    : payload.prompt;

  try {
    const guarded = await timeoutGuard(
      generateChatResponse({
        systemPrompt:
          'You are a senior management consultant answering a client task directly and concretely. Use only the information given in the task and context; never invent facts, figures, or sources.',
        messages: [{ role: 'user', content: userContent }],
        model: generateModelTier(),
        maxTokens: 2000,
      }),
      generateTimeoutMs()
    );
    if ((guarded as { __timedOut?: true }).__timedOut) {
      return {
        status: 'timeout',
        reason: `generation exceeded ${generateTimeoutMs()}ms`,
        durationMs: Date.now() - startedAt,
      };
    }
    const text = String((guarded as { content: string }).content || '').trim();
    if (!text) {
      return { status: 'unavailable', reason: 'empty_response', durationMs: Date.now() - startedAt };
    }
    return { status: 'ok', text, durationMs: Date.now() - startedAt };
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    const lower = String(message).toLowerCase();
    if (lower.includes('rate') || lower.includes('429') || lower.includes('quota')) {
      return { status: 'rate_limited', reason: String(message), durationMs: Date.now() - startedAt };
    }
    if (lower.includes('timeout') || lower.includes('aborted')) {
      return { status: 'timeout', reason: String(message), durationMs: Date.now() - startedAt };
    }
    return { status: 'unavailable', reason: String(message), durationMs: Date.now() - startedAt };
  }
}

// ---------------------------------------------------------------------------
// Judge LLM adapter resolution (same convention as run-benchmark-judge.ts)
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
  tier: string;
}> {
  const tier = process.env.BENCHMARK_JUDGE_MODEL_TIER || 'standard';

  if (!hasAnyLlmKey()) {
    return {
      adapter: noopLlmAdapter,
      source: 'noop',
      reason: 'no LLM API keys present in environment',
      tier,
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
        tier,
      };
    }

    const adapter: LlmJudgeAdapter = {
      async judge({ systemPrompt, userPrompt }) {
        try {
          const result = await (llmService as {
            call: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
          }).call({
            type: 'text',
            modelConfig: { id: tier },
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

    return { adapter, source: 'real', tier };
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return {
      adapter: noopLlmAdapter,
      source: 'noop',
      reason: `llmService import failed: ${String(message)}`,
      tier,
    };
  }
}

// ---------------------------------------------------------------------------
// Result / scorecard shapes
// ---------------------------------------------------------------------------

interface TaskRunOutcome {
  taskId: string;
  status: JudgeResult['status'] | 'no_model_answer';
  archetype?: string;
  domain?: string;
  verdict?: 'PASS' | 'FAIL';
  failedCriteria?: string[];
  aggregate?: JudgeResult['aggregate'];
  rationale?: string;
  modelId?: string;
  durationMs?: number;
  reason?: string;
}

interface ScorecardSummary {
  totalTasks: number;
  gradedTasks: number;
  ungradedTasks: number;
  passCount: number;
  failCount: number;
  passRatePct: number | null; // null when gradedTasks === 0 — never fabricate a rate
  averageDimensions: Record<string, number> | null;
  byArchetype: Record<string, { total: number; pass: number; fail: number; ungraded: number }>;
  byDomain: Record<string, { total: number; pass: number; fail: number; ungraded: number }>;
}

function buildScorecard(outcomes: TaskRunOutcome[]): ScorecardSummary {
  const graded = outcomes.filter((o) => o.status === 'ok' && o.verdict);
  const passCount = graded.filter((o) => o.verdict === 'PASS').length;
  const failCount = graded.filter((o) => o.verdict === 'FAIL').length;

  const dimSums: Record<string, number> = {};
  const dimKeys = ['answerFirst', 'meceStructure', 'grounding', 'actionability', 'evidenceDiscipline'];
  for (const key of dimKeys) dimSums[key] = 0;
  let dimCount = 0;
  for (const o of graded) {
    if (!o.aggregate) continue;
    dimCount++;
    for (const key of dimKeys) {
      dimSums[key] += (o.aggregate as unknown as Record<string, number>)[key] ?? 0;
    }
  }
  const averageDimensions =
    dimCount > 0
      ? Object.fromEntries(dimKeys.map((k) => [k, Math.round((dimSums[k] / dimCount) * 100) / 100]))
      : null;

  const byArchetype: ScorecardSummary['byArchetype'] = {};
  const byDomain: ScorecardSummary['byDomain'] = {};
  for (const o of outcomes) {
    const archKey = o.archetype ?? 'unknown';
    const domKey = o.domain ?? 'unknown';
    byArchetype[archKey] ??= { total: 0, pass: 0, fail: 0, ungraded: 0 };
    byDomain[domKey] ??= { total: 0, pass: 0, fail: 0, ungraded: 0 };
    byArchetype[archKey].total++;
    byDomain[domKey].total++;
    if (o.status === 'ok' && o.verdict === 'PASS') {
      byArchetype[archKey].pass++;
      byDomain[domKey].pass++;
    } else if (o.status === 'ok' && o.verdict === 'FAIL') {
      byArchetype[archKey].fail++;
      byDomain[domKey].fail++;
    } else {
      byArchetype[archKey].ungraded++;
      byDomain[domKey].ungraded++;
    }
  }

  return {
    totalTasks: outcomes.length,
    gradedTasks: graded.length,
    ungradedTasks: outcomes.length - graded.length,
    passCount,
    failCount,
    passRatePct: graded.length > 0 ? Math.round((passCount / graded.length) * 1000) / 10 : null,
    averageDimensions,
    byArchetype,
    byDomain,
  };
}

function printSummary(
  args: CliArgs,
  outcomes: TaskRunOutcome[],
  scorecard: ScorecardSummary,
  adapterSource: string,
  tier: string,
  corpusHash: string
): void {
  const quiet = args.quiet;
  logLine(quiet, '');
  logLine(
    quiet,
    `Consulting Benchmark Run — ${outcomes.length} task(s) — adapter=${adapterSource} tier=${tier} corpus=${corpusHash}`
  );
  logLine(quiet, '');
  const idCol = 26;
  logLine(quiet, `${'Task'.padEnd(idCol)} | ${'Status'.padEnd(18)} | Verdict | Reason / Model`);
  logLine(quiet, `${'-'.repeat(idCol)} | ${'-'.repeat(18)} | ------- | --------------`);
  for (const o of outcomes) {
    const idCell = o.taskId.length > idCol ? `${o.taskId.slice(0, idCol - 1)}…` : o.taskId.padEnd(idCol);
    const statusCell = o.status.padEnd(18);
    const verdictCell = (o.verdict ?? '-').padEnd(7);
    const trail = o.reason ?? o.modelId ?? '';
    logLine(quiet, `${idCell} | ${statusCell} | ${verdictCell} | ${trail}`);
  }
  logLine(quiet, '');
  logLine(
    quiet,
    scorecard.passRatePct === null
      ? `Pass rate: n/a (0 graded tasks — ${scorecard.ungradedTasks} ungraded, nothing fabricated)`
      : `Pass rate: ${scorecard.passRatePct}% (${scorecard.passCount}/${scorecard.gradedTasks} graded; ${scorecard.ungradedTasks} ungraded)`
  );
  logLine(quiet, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    logError(`[run-consulting-benchmark] Argument error: ${parsed.error}`);
    return EXIT_ARG_ERROR;
  }
  const args = parsed.args;

  const records = loadTaskBank(args);
  if (records.length === 0) {
    logLine(
      args.quiet,
      `[run-consulting-benchmark] No task files found under "${args.tasksGlobRoot}" (task bank not populated yet — see E2/E3). Nothing to run.`
    );
    return EXIT_ARG_ERROR;
  }

  const corpusHash = computeCorpusHash(records);
  const adapterInfo = await resolveLlmAdapter();
  if (adapterInfo.source === 'noop') {
    logLine(
      args.quiet,
      `[run-consulting-benchmark] WARNING: using noopLlmAdapter — ${adapterInfo.reason || 'no LLM client configured'}. Tasks will report status=unavailable.`
    );
  } else {
    logLine(args.quiet, `[run-consulting-benchmark] Real LLM adapter resolved (tier=${adapterInfo.tier}).`);
  }

  // E4: generation gate. Same key-presence check as the judge adapter, same
  // env vars, checked ONCE up front so the warning is printed exactly once
  // (not once per task) — "jasny komunikat" per the anti-fabrication rule.
  const genHasKeys = hasAnyLlmKey();
  const genTier = generateModelTier();
  let generateBudgetRemaining = args.maxTasks;
  let generationAttempted = 0;
  let generationSucceeded = 0;
  let generationCacheHits = 0;

  if (args.generate) {
    if (!genHasKeys) {
      logLine(
        args.quiet,
        `[run-consulting-benchmark] --generate requested but NO LLM API keys found in env ` +
          `(checked OPENAI_API_KEY/ANTHROPIC_API_KEY/GEMINI_API_KEY/GOOGLE_AI_API_KEY/OPENROUTER_API_KEY). ` +
          `Generation SKIPPED for every task — they will report status=no_model_answer. ` +
          `Set one of these keys and re-run with --generate to exercise the product path.`
      );
    } else {
      logLine(
        args.quiet,
        `[run-consulting-benchmark] --generate enabled: tier=${genTier} max-new-generations-this-run=${args.maxTasks}`
      );
    }
  }

  const outcomes: TaskRunOutcome[] = [];

  for (const record of records) {
    let modelAnswer =
      record.task.modelAnswer && record.task.modelAnswer.trim().length > 0
        ? record.task.modelAnswer.trim()
        : '';
    let unresolvedStatus: GenerationStatus | null = null;
    let unresolvedReason: string | undefined;

    if (!modelAnswer && args.generate) {
      const cached = loadCachedAnswer(DEFAULT_ANSWERS_DIR, corpusHash, record.taskId);
      if (cached) {
        modelAnswer = cached;
        generationCacheHits++;
        logLine(
          args.quiet,
          `[run-consulting-benchmark] ${record.taskId}: using cached generated answer (${DEFAULT_ANSWERS_DIR}/${corpusHash}/…)`
        );
      } else if (!genHasKeys) {
        unresolvedReason = 'no LLM API keys — generation skipped (see --generate warning above)';
      } else if (generateBudgetRemaining <= 0) {
        unresolvedReason = `--max-tasks (${args.maxTasks}) generation budget exhausted this run`;
      } else {
        generationAttempted++;
        generateBudgetRemaining--;
        logLine(
          args.quiet,
          `[run-consulting-benchmark] ${record.taskId}: generating product answer (${generationAttempted}/${args.maxTasks})…`
        );
        // Firewall: the ONLY thing the model-under-test sees is {prompt, context}.
        const payload = buildProductPromptPayload(record.task);
        const gen = await generateProductAnswer(payload);
        if (gen.status === 'ok' && gen.text) {
          modelAnswer = gen.text;
          generationSucceeded++;
          try {
            writeJsonFile(answerCachePath(DEFAULT_ANSWERS_DIR, corpusHash, record.taskId), {
              taskId: record.taskId,
              corpusHash,
              tier: genTier,
              generatedAt: new Date().toISOString(),
              promptPayload: payload,
              answer: gen.text,
              durationMs: gen.durationMs,
            });
          } catch (error) {
            const message = (error as { message?: unknown })?.message ?? String(error);
            logError(
              `[run-consulting-benchmark] ${record.taskId}: failed to cache generated answer (continuing): ${String(message)}`
            );
          }
          logLine(
            args.quiet,
            `[run-consulting-benchmark] ${record.taskId}: generated OK (${gen.durationMs}ms), cached.`
          );
        } else {
          unresolvedStatus = gen.status;
          unresolvedReason = gen.reason ?? 'generation_failed';
          logError(
            `[run-consulting-benchmark] ${record.taskId}: generation FAILED status=${gen.status} reason=${unresolvedReason}`
          );
        }
      }
    }

    if (!modelAnswer) {
      outcomes.push({
        taskId: record.taskId,
        status: unresolvedStatus ?? 'no_model_answer',
        archetype: record.task.archetype,
        domain: record.task.domain,
        reason:
          unresolvedReason ??
          'task file has no pre-collected modelAnswer (pass --generate to invoke the product path)',
      });
      continue;
    }

    const taskForJudge: JudgeTaskInput = { ...record.task, modelAnswer };
    const judge = await judgeConsultingTask({
      adapter: adapterInfo.adapter,
      task: taskForJudge,
      scaleRubrics: taskForJudge.scaleRubrics ?? DEFAULT_CONSULTING_RUBRICS,
    });

    outcomes.push({
      taskId: record.taskId,
      status: judge.status,
      archetype: record.task.archetype,
      domain: record.task.domain,
      verdict: judge.verdict,
      failedCriteria: judge.failedCriteria,
      aggregate: judge.aggregate,
      rationale: judge.rationale,
      modelId: judge.modelId,
      durationMs: judge.durationMs,
      reason: judge.reason,
    });
  }

  if (args.generate) {
    logLine(
      args.quiet,
      `[run-consulting-benchmark] Generation summary: ${generationSucceeded}/${generationAttempted} succeeded, ` +
        `${generationCacheHits} served from cache, budget was ${args.maxTasks} new generation(s).`
    );
  }

  const scorecard = buildScorecard(outcomes);

  const rawRun = {
    runId: args.runId,
    corpusHash,
    timestamp: new Date().toISOString(),
    tier: adapterInfo.tier,
    adapterSource: adapterInfo.source,
    taskCount: records.length,
    outcomes,
    scorecard,
  };

  const outFile = path.join(args.outputDir, corpusHash, `${args.runId}.json`);
  try {
    writeJsonFile(outFile, rawRun);
    logLine(args.quiet, `[run-consulting-benchmark] Wrote run result to ${outFile}`);
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-consulting-benchmark] Failed to write output file: ${String(message)}`);
    return EXIT_ARG_ERROR;
  }

  printSummary(args, outcomes, scorecard, adapterInfo.source, adapterInfo.tier, corpusHash);

  const allGraded = outcomes.every((o) => o.status === 'ok');
  return allGraded ? EXIT_OK : EXIT_PARTIAL;
}

async function main(): Promise<void> {
  let exitCode = EXIT_ARG_ERROR;
  try {
    exitCode = await run();
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`[run-consulting-benchmark] Unhandled failure: ${String(message)}`);
    exitCode = EXIT_ARG_ERROR;
  }
  // eslint-disable-next-line no-console
  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

void main();
