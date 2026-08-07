/**
 * Consultify Document Studio — Block-level Prose Generator (D11).
 *
 * Closes the core "world-class deliverable" gap: the deterministic
 * `documentContentGenerator.buildDocumentSchema` emits structured
 * *placeholder* prose ("Key message and recommended next step go
 * here…"). This module fills those prose-bearing blocks
 * (`paragraph`, `callout`, `bullet_list`, `numbered_list`) with
 * grounded, consulting-grade narrative produced by the real LLM
 * service (Teresa, via `aiService.generateChatResponse`).
 *
 * Doctrine / safety contract (mirrors `documentNarrativeRefiner.ts`):
 *   - This is an OPT-IN enrichment layer (`useLlm`). When disabled or on
 *     ANY failure path (AI freeze / `FEATURE_UNAVAILABLE`, empty
 *     response, invalid JSON, schema-violating response) it returns the
 *     deterministic schema UNCHANGED. No throw ever escapes.
 *   - It only REWRITES the text/items of existing prose blocks. It never
 *     adds, removes, or reorders blocks or sections, never changes block
 *     types, and never touches structured blocks (tables, charts, KPI
 *     strips, images, citations, footnotes).
 *   - Generation is grounded: the prompt carries the document intake,
 *     audience, register, language and the available source-pack titles,
 *     and instructs the model to flag any claim that goes beyond the
 *     provided sources rather than fabricating evidence.
 */

import { generateChatResponse } from '../aiService.js';
import { enforceBlockGrounding } from './documentBlockContentGenerator.js';
import type { DocumentGenerationWarningCollector } from './documentGenerationWarnings.js';
import {
  documentSourceRefEvidenceText,
  type DocumentIntake,
  type DocumentSchema,
  type DocumentSourceRef,
} from './documentStudioTypes.js';

/** Block types whose prose we enrich. Structured blocks are left alone. */
const PROSE_BLOCK_TYPES = new Set(['paragraph', 'callout', 'bullet_list', 'numbered_list']);

// 'standard' = tier rozwiązywany przez LLMConfigService (llmService.resolveModelConfig);
// dawne 'default' nie jest tierem, więc call padał natychmiast bez providera.
const MODEL_DEFAULT = 'standard';

// DOC-1 (E2E): dawniej JEDEN wielki prompt prosił model o WSZYSTKIE bloki naraz
// (np. 9 sekcji prozy + tabele GFM po polsku). Taka pojedyncza generacja regularnie
// przekraczała 30 s (twardy `timeoutMs: 30000` w aiService.generateChatResponse) →
// AbortSignal.timeout → „AI chat generation failed" → fail-soft oddawał placeholdery
// → brama anty-placeholder w docGenerationRuntime.startDoc rzucała „Generacja treści
// nie powiodła się". Sheet/deck działały, bo generują mniej na jedno wywołanie
// (arkusz = jedna zwięzła tabela; deck = per-slajd). Naprawa: chunking — dzielimy
// bloki na małe partie tak, by KAŻDE wywołanie LLM kończyło się grubo poniżej limitu
// 30 s, a partie puszczamy RÓWNOLEGLE (z ograniczoną współbieżnością), żeby łączny
// czas mieścił się w budżecie odpytywania statusu (~150 s). Cała generacja biegnie
// w tle (watchdog 8 min).
// Ile prose-bloków w jednej partii do modelu. Zmierzone empirycznie (repro E2E,
// polska proza konsultingowa + tabele GFM): partia 3 bloków bywała ~26 s i
// pojedyncze wywołania przekraczały limit 30 s. Partia 2 bloków to ~12–15 s —
// bezpieczny ~2× zapas do limitu.
const PROSE_BATCH_SIZE = 2;
/** Górny cap tokenów na jedną partię (bloki tabelaryczne bywają kosztowne). */
const MAX_TOKENS_PER_BATCH = 4096;
/** Budżet tokenów na blok w partii (tabele GFM potrzebują zapasu). */
const TOKENS_PER_BLOCK = 700;
/** Próby na jedną partię — jedno ponowienie łapie sporadyczny wolny/nieudany call. */
const MAX_BATCH_ATTEMPTS = 2;
/**
 * Ile partii leci równolegle. Sekwencyjnie 5–7 partii × ~15–25 s przekraczało
 * 150 s budżetu odpytywania (E2E: doc utykał w 'validating'). Współbieżność 4
 * ścina łączny czas do ~2 fal (~40–60 s) — bezpiecznie dla limitów/tokenów
 * providera, a każde wywołanie i tak jest osobno strzeżone (withGuards, breaker).
 */
const BATCH_CONCURRENCY = 4;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += Math.max(1, size)) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run `tasks` with at most `limit` in flight at once. Preserves no ordering
 * guarantees on completion; each task is self-contained (writes only its own
 * keys), so interleaving is safe. Never rejects — individual task rejections are
 * the task's own responsibility (ours swallow + record).
 */
async function runWithConcurrency(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let cursor = 0;
  const workers: Array<Promise<void>> = [];
  const worker = async (): Promise<void> => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      await tasks[idx]();
    }
  };
  const n = Math.max(1, Math.min(limit, tasks.length));
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
}

export interface GenerateBlockProseOptions {
  enable?: boolean;
  model?: string;
  maxTokens?: number;
  /**
   * A4 — optional generation-warnings collector. When provided, any
   * fallback path (LLM failure, empty / invalid response) records an
   * `llm_prose_fallback` warning so the degradation is visible to the
   * user instead of being swallowed by a `console.warn`. Passing
   * `undefined` is the legacy behaviour (no recording). NEVER changes
   * the fallback behaviour itself — the stubs are still returned.
   */
  warnings?: DocumentGenerationWarningCollector;
}

interface ProseTargetBlock {
  blockId: string;
  sectionTitle: string;
  sectionPurpose?: string;
  type: 'paragraph' | 'callout' | 'bullet_list' | 'numbered_list';
  /** 'text' for paragraph/callout, 'items' for the two list types. */
  kind: 'text' | 'items';
  placeholder: string;
}

interface LlmBlockProseResponse {
  blocks?: Array<{ blockId?: unknown; text?: unknown; items?: unknown }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function blockKind(type: string): 'text' | 'items' {
  return type === 'bullet_list' || type === 'numbered_list' ? 'items' : 'text';
}

function placeholderText(content: unknown, kind: 'text' | 'items'): string {
  if (!isRecord(content)) return '';
  if (kind === 'items') {
    return Array.isArray(content.items) ? content.items.map((i) => String(i)).join(' | ') : '';
  }
  return typeof content.text === 'string' ? content.text : '';
}

/** Collect every prose-bearing block in the schema as an LLM target. */
function collectTargets(schema: DocumentSchema): ProseTargetBlock[] {
  const targets: ProseTargetBlock[] = [];
  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (!PROSE_BLOCK_TYPES.has(block.type)) continue;
      const kind = blockKind(block.type);
      targets.push({
        blockId: block.blockId,
        sectionTitle: section.title,
        sectionPurpose: section.purpose,
        type: block.type as ProseTargetBlock['type'],
        kind,
        placeholder: placeholderText(block.content, kind),
      });
    }
  }
  return targets;
}

function buildSystemPrompt(schema: DocumentSchema): string {
  return [
    'You are a senior management consultant writing a client-grade deliverable.',
    `The document is a "${schema.documentType}" written for the audience: ${
      schema.audience.length > 0 ? schema.audience.join(', ') : 'internal stakeholders'
    }.`,
    `Communication register: ${schema.communicationRegister}. Density: ${schema.density}. Style: ${schema.languageStyle}.`,
    `Write in this language code: ${schema.language}.`,
    'Produce sharp, decision-oriented, MECE consulting prose — no filler, no hedging, no meta-commentary about being an AI.',
    // Format założeń (naprawa 2026-07-22): NIE prefiksuj zdań „Assumption:" —
    // to daje „Assumption: … Assumption: …" w każdym zdaniu (obserwacja z demo).
    // Oznaczaj TYLKO konkretną, niepopartą liczbę/procent/kwotę/datę/nazwaną wartość
    // inline w nawiasie, w języku dokumentu: „(założenie)" / „(assumption)".
    'Ground every factual claim in the provided sources. Write confident, decision-oriented consulting prose — do NOT hedge every sentence. When a SPECIFIC number, percentage, amount, date or named fact is NOT supported by the sources, mark just that value inline in parentheses in the document language — "(założenie)" for Polish, "(assumption)" for English (e.g. "redukcja błędów o 30% (założenie)"). Never prefix a whole sentence with "Assumption:" and never repeat the marker on consecutive sentences. Qualitative reasoning is stated plainly; if a section rests on a few key assumptions, you may name them once in a short lead-in, not sentence-by-sentence.',
    // Polish znacznika (naprawa 2026-07-22): w praktyce ten sam znacznik potrafił
    // powtórzyć się w kolejnych zdaniach akapitu przy tej samej wartości.
    'Within a single paragraph, mark the same or a closely related assumed value only once — write the following sentences in confident prose without repeating the marker, and do not mark a value that is derived directly from an assumption already marked earlier in the paragraph.',
    'For "text" blocks return a single tight paragraph. For "items" blocks return 2-5 crisp bullet points.',
    // N-9: tabelaryczne sekcje muszą dostać tabelę, nie samą prozę. Renderer
    // oddaje "text" verbatim, więc tabela GFM w polu "text" trafia do edytora.
    'TABLES: When a section is inherently tabular — scenario comparisons with costs/ROI, risk maps/matrices, quarterly roadmaps or schedules, KPI summaries, vendor/option comparisons, milestones — the "text" field MUST contain a valid GFM Markdown table (a header row like "| Col | Col |", a separator row "|---|---|", then data rows), optionally preceded by one short framing sentence. Use literal newlines inside the JSON string (\\n). Never wrap the table in code fences. Use prose for non-tabular sections.',
    'You MUST return strict JSON only, no markdown fence, in this exact shape: {"blocks":[{"blockId":"<id>","text":"<prose>"}|{"blockId":"<id>","items":["<bullet>", ...]}, ...]}.',
    'Return one entry per blockId you are given. Do not invent blockIds. Do not add commentary outside the JSON.',
  ].join(' ');
}

function buildUserPrompt(
  schema: DocumentSchema,
  intake: DocumentIntake,
  sourceRefs: DocumentSourceRef[],
  targets: ProseTargetBlock[]
): string {
  const sources =
    sourceRefs.length > 0
      ? sourceRefs
          .map((ref, i) => {
            const evidence = documentSourceRefEvidenceText(ref);
            return `[S${i + 1}] ${ref.sourceTitle ?? ref.sourceId ?? ref.sourceType ?? 'source'}${
              evidence ? `\nEvidence: ${evidence}` : ''
            }`;
          })
          .join('\n')
      : '(no source pack attached — write confident consulting prose; mark ONLY specific unsupported numbers/dates/named values inline with "(założenie)"/"(assumption)", do NOT prefix sentences with "Assumption:")';
  return [
    `Document title: ${schema.title}`,
    `Goal: ${schema.goal}`,
    `Brief / intake description: ${intake.description ?? ''}`,
    'Available sources:',
    sources,
    '',
    'Fill the prose for each of the following blocks. The "placeholder" is the current deterministic stub — replace it with grounded prose appropriate to the section. Honour the requested "kind" (text vs items).',
    JSON.stringify(
      targets.map((t) => ({
        blockId: t.blockId,
        section: t.sectionTitle,
        sectionPurpose: t.sectionPurpose,
        kind: t.kind,
        placeholder: t.placeholder,
      })),
      null,
      2
    ),
  ].join('\n');
}

function safeParseJson(raw: string): LlmBlockProseResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(fenceStripped);
    return isRecord(parsed) ? (parsed as LlmBlockProseResponse) : null;
  } catch {
    return null;
  }
}

/**
 * Apply optional LLM block-level prose generation to a deterministic
 * schema. ALWAYS returns a valid `DocumentSchema`: the input schema
 * unchanged on any failure path. The returned schema is a deep-cloned
 * copy when any block was rewritten, or the original reference when no
 * change was applied.
 */
export async function generateBlockProse(
  schema: DocumentSchema,
  intake: DocumentIntake,
  sourceRefs: DocumentSourceRef[],
  options: GenerateBlockProseOptions = {}
): Promise<DocumentSchema> {
  if (options.enable === false) return schema;
  const targets = collectTargets(schema);
  if (targets.length === 0) return schema;

  const model = options.model || MODEL_DEFAULT;
  const systemPrompt = buildSystemPrompt(schema);

  // DOC-1 fix: CHUNKING. Split targets into small batches so each LLM call
  // stays well under aiService's hard 30 s timeout. A caller-supplied
  // `options.maxTokens` (legacy explicit budget) forces a SINGLE call for
  // backwards-compatibility; otherwise we chunk. The batches run sequentially
  // — the whole generation is a background job (watchdog budget 8 min), so a
  // handful of ~10 s calls is safe, and no single call risks the abort.
  const batches = options.maxTokens ? [targets] : chunk(targets, PROSE_BATCH_SIZE);

  // Build a blockId -> generated payload map, restricted to known targets.
  const targetById = new Map(targets.map((t) => [t.blockId, t]));
  const generated = new Map<string, { text?: string; items?: string[] }>();
  // Any batch that failed (LLM error / unparseable / no usable entries) means
  // the document will still carry placeholders — record a SINGLE fallback
  // warning so the degradation stays visible (A4) and the caller's
  // anti-placeholder guard (DOC-2) can refuse to persist an orphan.
  let anyBatchDegraded = false;

  // Each batch is an independent task; they run with bounded concurrency so the
  // total wall-time stays within the caller's status-poll budget while every
  // single LLM call remains small enough to finish under the 30 s abort.
  const runBatch = async (batch: ProseTargetBlock[]): Promise<void> => {
    const maxTokens = options.maxTokens
      ? options.maxTokens
      : Math.min(MAX_TOKENS_PER_BATCH, Math.max(1024, batch.length * TOKENS_PER_BLOCK));
    const userPrompt = buildUserPrompt(schema, intake, sourceRefs, batch);
    const batchIds = new Set(batch.map((t) => t.blockId));

    let matchedInBatch = 0;
    for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS && matchedInBatch === 0; attempt++) {
      let response: { content: string };
      try {
        response = await generateChatResponse({
          systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          model,
          maxTokens,
        });
      } catch (err) {
        // Kontrakt: nigdy nie rzucamy — pojedyncza partia może paść (timeout /
        // transient), a pozostałe i tak wypełnią swoje bloki (częściowy sukces >
        // totalna porażka). Ponawiamy raz zanim uznamy partię za zdegradowaną.
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[DocumentBlockProse] LLM prose batch attempt ${attempt}/${MAX_BATCH_ATTEMPTS} failed (${batch.length} blocks): ${message}`
        );
        continue;
      }

      const parsed = safeParseJson(response.content);
      if (!parsed || !Array.isArray(parsed.blocks)) continue;

      for (const entry of parsed.blocks) {
        if (!isRecord(entry) || typeof entry.blockId !== 'string') continue;
        // Only accept ids that belong to THIS batch — protects against a model
        // that echoes stale ids from another batch's prompt.
        if (!batchIds.has(entry.blockId)) continue;
        const target = targetById.get(entry.blockId);
        if (!target) continue;
        if (target.kind === 'items') {
          if (!Array.isArray(entry.items)) continue;
          const items = entry.items
            .map((i) => (typeof i === 'string' ? i.trim() : ''))
            .filter((i) => i.length > 0);
          if (items.length === 0) continue;
          generated.set(entry.blockId, { items });
          matchedInBatch++;
        } else {
          if (typeof entry.text !== 'string') continue;
          const text = entry.text.trim();
          if (text.length === 0) continue;
          generated.set(entry.blockId, { text });
          matchedInBatch++;
        }
      }
    }
    // The batch did not fully fill (LLM error / empty / unparseable / wrong ids /
    // partial payload) — the unfilled blocks keep their deterministic stubs, so
    // the document is degraded. Marking on `< batch.length` (not just `=== 0`)
    // keeps this signal consistent with the caller's anti-placeholder gate, which
    // throws on ANY remaining stub.
    if (matchedInBatch < batch.length) anyBatchDegraded = true;
  };

  await runWithConcurrency(
    batches.map((batch) => () => runBatch(batch)),
    BATCH_CONCURRENCY
  );

  if (anyBatchDegraded) {
    // A4 — a batch degraded to stubs; keep the degradation visible. Records a
    // single 'llm_prose_fallback' regardless of how many batches failed.
    options.warnings?.record({
      code: 'llm_prose_fallback',
      scope: 'document',
      message:
        'LLM prose generation partially failed; some sections retained deterministic placeholders.',
    });
  }

  if (generated.size === 0) {
    // A4 — nothing at all mapped to a known prose target across all batches.
    // Same silent-degrade class: the deterministic stubs survive unchanged.
    if (!anyBatchDegraded) {
      options.warnings?.record({
        code: 'llm_prose_fallback',
        scope: 'document',
        message:
          'LLM prose response matched no document blocks; deterministic placeholders retained.',
      });
    }
    return schema;
  }

  // Deep clone so the caller's input schema is never mutated in place.
  const next = JSON.parse(JSON.stringify(schema)) as DocumentSchema;
  const groundingSource = [
    intake.title,
    intake.description,
    ...sourceRefs.map(documentSourceRefEvidenceText),
  ]
    .filter(Boolean)
    .join(' — ');
  for (const section of next.sections) {
    for (const block of section.blocks) {
      const payload = generated.get(block.blockId);
      if (!payload) continue;
      const content = isRecord(block.content) ? { ...block.content } : {};
      if (payload.items) {
        content.items = payload.items;
      } else if (payload.text !== undefined) {
        content.text = payload.text;
      }
      const guarded = enforceBlockGrounding(content, groundingSource);
      block.content = guarded.content;
      // The block is now grounded in (or explicitly flagged against) the
      // source pack, so it is no longer a bare structural assumption.
      block.isAssumption = guarded.changed || sourceRefs.length === 0;
      // N-9: a paragraph carrying a GFM table must NOT get the inline
      // "_[Assumption]_" suffix from the renderer — appended after the final
      // "| … |" row it breaks the row's table membership in marked. Concrete
      // table content is not a bare assumption, so clear the flag.
      if (
        !guarded.changed &&
        typeof guarded.content.text === 'string' &&
        /^\s*\|.*\|\s*$/m.test(guarded.content.text)
      ) {
        block.isAssumption = sourceRefs.length === 0;
      }
    }
  }
  return next;
}
