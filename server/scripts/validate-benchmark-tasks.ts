#!/usr/bin/env tsx
/**
 * Consulting Benchmark Task Bank Validator (Consultify Bench, Blok E / E2+E3)
 *
 * Schema-checks every task-bank JSON file under `benchmark/tasks/**` against
 * the shape `run-consulting-benchmark.ts` / `consultingBenchmarkJudgeService.ts`
 * expect, AND enforces the anti-contamination invariant from
 * PROJEKT_BENCHMARK.md §4.3: the `prompt`/`context` the model-under-test sees
 * (via `buildProductPromptPayload`) must never contain the gold material
 * (`goldNotes` / `binaryCriteria` descriptions & guidance) — otherwise the
 * benchmark is worthless (the model would "know the test").
 *
 * Checks per file:
 *   1. Valid JSON, top-level object.
 *   2. Required fields present with correct types: taskId (or id), prompt
 *      (non-empty string).
 *   3. archetype (if present) is one of 'diagnostic' | 'synthetic' | 'real-anon'.
 *   4. lang (if present) is 'pl' | 'en'.
 *   5. binaryCriteria (if present) is an array of { id, description, guidance }
 *      with non-empty unique ids within the file.
 *   6. goldNotes (if present) is a string.
 *   7. taskId is unique across the whole task bank.
 *   8. Anti-contamination: no 8-consecutive-word sequence from goldNotes or
 *      from any binaryCriteria description/guidance appears verbatim inside
 *      prompt+context (case-insensitive). This is a heuristic leakage guard,
 *      not a proof of independence — it catches literal copy-paste
 *      contamination, which is the realistic failure mode when authoring
 *      task files by hand or by script.
 *
 * Exit codes:
 *   0 — all files valid, zero contamination hits
 *   1 — one or more schema violations or contamination hits found
 *   2 — argument/runtime error (e.g. task root not found)
 *
 * Usage:
 *   npx tsx server/scripts/validate-benchmark-tasks.ts [--tasks benchmark/tasks] [--quiet]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const VALID_ARCHETYPES = new Set(['diagnostic', 'synthetic', 'real-anon']);
const VALID_LANGS = new Set(['pl', 'en']);

// Word-window size for the anti-contamination substring scan. 8 consecutive
// words is long enough that any hit is almost certainly a real copy-paste
// leak, not shared domain vocabulary (numbers, single terms, short phrases).
const CONTAMINATION_WINDOW_WORDS = 8;

interface Violation {
  file: string;
  rule: string;
  detail: string;
}

function findJsonFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { recursive: true }) as string[];
  return entries
    .filter((e) => e.toLowerCase().endsWith('.json'))
    .map((e) => path.join(rootDir, e))
    .filter((full) => {
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[""'']/g, '"')
    .replace(/[^a-z0-9ąćęłńóśźż$%.\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Returns every contiguous window of `size` words, joined by single spaces. */
function windows(words: string[], size: number): string[] {
  if (words.length < size) return [];
  const out: string[] = [];
  for (let i = 0; i <= words.length - size; i++) {
    out.push(words.slice(i, i + size).join(' '));
  }
  return out;
}

function validateFile(filePath: string, seenTaskIds: Map<string, string>): Violation[] {
  const violations: Violation[] = [];
  const rel = path.relative(REPO_ROOT, filePath);

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    violations.push({ file: rel, rule: 'readable', detail: String((error as Error).message) });
    return violations;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    violations.push({ file: rel, rule: 'valid-json', detail: String((error as Error).message) });
    return violations;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    violations.push({ file: rel, rule: 'top-level-object', detail: 'top-level value is not an object' });
    return violations;
  }

  const obj = parsed as Record<string, unknown>;

  // --- taskId / id ---
  const taskId = obj.taskId ?? obj.id;
  if (!isNonEmptyString(taskId)) {
    violations.push({ file: rel, rule: 'taskId-required', detail: 'missing non-empty "taskId"/"id"' });
  } else {
    const existing = seenTaskIds.get(taskId);
    if (existing) {
      violations.push({
        file: rel,
        rule: 'taskId-unique',
        detail: `duplicate taskId "${taskId}" also used by ${existing}`,
      });
    } else {
      seenTaskIds.set(taskId, rel);
    }
  }

  // --- prompt ---
  if (!isNonEmptyString(obj.prompt)) {
    violations.push({ file: rel, rule: 'prompt-required', detail: 'missing non-empty "prompt"' });
  }

  // --- context (optional but must be string if present) ---
  if (obj.context !== undefined && typeof obj.context !== 'string') {
    violations.push({ file: rel, rule: 'context-type', detail: '"context" must be a string when present' });
  }

  // --- archetype ---
  if (obj.archetype !== undefined && !VALID_ARCHETYPES.has(String(obj.archetype))) {
    violations.push({
      file: rel,
      rule: 'archetype-enum',
      detail: `"archetype" must be one of diagnostic|synthetic|real-anon, got: ${String(obj.archetype)}`,
    });
  }

  // --- lang ---
  if (obj.lang !== undefined && !VALID_LANGS.has(String(obj.lang))) {
    violations.push({
      file: rel,
      rule: 'lang-enum',
      detail: `"lang" must be one of pl|en, got: ${String(obj.lang)}`,
    });
  }

  // --- binaryCriteria ---
  const criteriaRaw = obj.binaryCriteria ?? obj.rubric;
  let criteria: Array<{ id: string; description: string; guidance: string }> = [];
  if (criteriaRaw !== undefined) {
    if (!Array.isArray(criteriaRaw)) {
      violations.push({ file: rel, rule: 'binaryCriteria-array', detail: '"binaryCriteria" must be an array' });
    } else {
      const seenIds = new Set<string>();
      criteriaRaw.forEach((entry, idx) => {
        if (!entry || typeof entry !== 'object') {
          violations.push({
            file: rel,
            rule: 'binaryCriteria-entry-object',
            detail: `binaryCriteria[${idx}] is not an object`,
          });
          return;
        }
        const e = entry as Record<string, unknown>;
        if (!isNonEmptyString(e.id)) {
          violations.push({
            file: rel,
            rule: 'binaryCriteria-id-required',
            detail: `binaryCriteria[${idx}] missing non-empty "id"`,
          });
        } else if (seenIds.has(e.id)) {
          violations.push({
            file: rel,
            rule: 'binaryCriteria-id-unique-within-file',
            detail: `duplicate binaryCriteria id "${e.id}" within ${rel}`,
          });
        } else {
          seenIds.add(e.id);
        }
        if (!isNonEmptyString(e.description)) {
          violations.push({
            file: rel,
            rule: 'binaryCriteria-description-required',
            detail: `binaryCriteria[${idx}] ("${String(e.id)}") missing non-empty "description"`,
          });
        }
        if (e.guidance !== undefined && typeof e.guidance !== 'string') {
          violations.push({
            file: rel,
            rule: 'binaryCriteria-guidance-type',
            detail: `binaryCriteria[${idx}] ("${String(e.id)}") "guidance" must be a string when present`,
          });
        }
        criteria.push({
          id: isNonEmptyString(e.id) ? e.id : `#${idx}`,
          description: isNonEmptyString(e.description) ? e.description : '',
          guidance: isNonEmptyString(e.guidance) ? (e.guidance as string) : '',
        });
      });
      // Recommend 2-4 criteria per the task-bank spec (E2/E3 instructions);
      // this is a warning-level rule, not a hard failure, since a pure
      // scale-graded task with 0 binary criteria is technically valid per
      // gradeAllPass's vacuous-PASS semantics.
      if (criteria.length > 6) {
        violations.push({
          file: rel,
          rule: 'binaryCriteria-count-suspicious',
          detail: `${criteria.length} binaryCriteria — expected roughly 2-4 per task bank spec`,
        });
      }
    }
  }

  // --- goldNotes ---
  if (obj.goldNotes !== undefined && typeof obj.goldNotes !== 'string') {
    violations.push({ file: rel, rule: 'goldNotes-type', detail: '"goldNotes" must be a string when present' });
  }

  // --- sourceRef / provenance / version (soft — warn only if entirely absent) ---
  if (obj.provenance !== undefined && typeof obj.provenance !== 'string') {
    violations.push({ file: rel, rule: 'provenance-type', detail: '"provenance" must be a string when present' });
  }

  // ---------------------------------------------------------------------
  // Anti-contamination scan: prompt+context must not contain any literal
  // 8-word window from goldNotes or from any binaryCriteria
  // description/guidance.
  // ---------------------------------------------------------------------
  const promptContext = `${isNonEmptyString(obj.prompt) ? obj.prompt : ''} ${
    typeof obj.context === 'string' ? obj.context : ''
  }`;
  const haystack = ` ${normalizeWords(promptContext).join(' ')} `;

  const goldSources: Array<{ label: string; text: string }> = [];
  if (typeof obj.goldNotes === 'string' && obj.goldNotes.trim()) {
    goldSources.push({ label: 'goldNotes', text: obj.goldNotes });
  }
  for (const c of criteria) {
    if (c.description) goldSources.push({ label: `binaryCriteria[${c.id}].description`, text: c.description });
    if (c.guidance) goldSources.push({ label: `binaryCriteria[${c.id}].guidance`, text: c.guidance });
  }

  for (const source of goldSources) {
    const sourceWindows = windows(normalizeWords(source.text), CONTAMINATION_WINDOW_WORDS);
    for (const w of sourceWindows) {
      if (haystack.includes(` ${w} `)) {
        violations.push({
          file: rel,
          rule: 'anti-contamination',
          detail: `${source.label} shares an ${CONTAMINATION_WINDOW_WORDS}-word sequence with prompt/context: "${w}"`,
        });
        break; // one hit per source is enough to fail the file; avoid noisy duplicates
      }
    }
  }

  return violations;
}

function parseArgs(argv: string[]): { tasksRoot: string; quiet: boolean } {
  let tasksRoot = path.join(REPO_ROOT, 'benchmark', 'tasks');
  let quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--tasks' && argv[i + 1]) {
      tasksRoot = path.resolve(REPO_ROOT, argv[i + 1]);
      i++;
    } else if (tok?.startsWith('--tasks=')) {
      tasksRoot = path.resolve(REPO_ROOT, tok.slice('--tasks='.length));
    } else if (tok === '--quiet') {
      quiet = true;
    }
  }
  return { tasksRoot, quiet };
}

function main(): number {
  const { tasksRoot, quiet } = parseArgs(process.argv.slice(2));
  const files = findJsonFiles(tasksRoot);

  if (files.length === 0) {
    console.error(`[validate-benchmark-tasks] No JSON files found under ${tasksRoot}`);
    return 2;
  }

  const seenTaskIds = new Map<string, string>();
  const allViolations: Violation[] = [];
  for (const file of files) {
    allViolations.push(...validateFile(file, seenTaskIds));
  }

  if (!quiet) {
    console.log(`[validate-benchmark-tasks] Checked ${files.length} task file(s) under ${path.relative(REPO_ROOT, tasksRoot)}`);
  }

  if (allViolations.length === 0) {
    if (!quiet) console.log('[validate-benchmark-tasks] PASS — 0 schema violations, 0 contamination hits.');
    return 0;
  }

  const byRule = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const list = byRule.get(v.rule) ?? [];
    list.push(v);
    byRule.set(v.rule, list);
  }

  console.error(`[validate-benchmark-tasks] FAIL — ${allViolations.length} violation(s):`);
  for (const [rule, list] of byRule) {
    console.error(`\n  Rule: ${rule} (${list.length})`);
    for (const v of list) {
      console.error(`    - ${v.file}: ${v.detail}`);
    }
  }

  return 1;
}

process.exit(main());
