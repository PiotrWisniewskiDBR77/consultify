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
import type { DocumentGenerationWarningCollector } from './documentGenerationWarnings.js';
import type { DocumentIntake, DocumentSchema, DocumentSourceRef } from './documentStudioTypes.js';

/** Block types whose prose we enrich. Structured blocks are left alone. */
const PROSE_BLOCK_TYPES = new Set(['paragraph', 'callout', 'bullet_list', 'numbered_list']);

// 'standard' = tier rozwiązywany przez LLMConfigService (llmService.resolveModelConfig);
// dawne 'default' nie jest tierem, więc call padał natychmiast bez providera.
const MODEL_DEFAULT = 'standard';
const MAX_TOKENS_DEFAULT = 4096;

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
    'Ground every factual claim in the provided sources. When a claim is NOT supported by the sources, phrase it as an explicit assumption (e.g. prefix "Assumption:") rather than asserting it as fact.',
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
          .map(
            (ref, i) =>
              `[S${i + 1}] ${ref.sourceTitle ?? ref.sourceId ?? ref.sourceType ?? 'source'}`
          )
          .join('\n')
      : '(no source pack attached — flag all non-trivial claims as assumptions)';
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

  // Scale token budget with block count: tables take ~400-600 tokens each.
  // Cap at 8192 to stay within provider limits.
  const dynamicMaxTokens =
    options.maxTokens ?? Math.min(8192, Math.max(MAX_TOKENS_DEFAULT, targets.length * 550));

  let response: { content: string };
  try {
    response = await generateChatResponse({
      systemPrompt: buildSystemPrompt(schema),
      messages: [{ role: 'user', content: buildUserPrompt(schema, intake, sourceRefs, targets) }],
      model: options.model || MODEL_DEFAULT,
      maxTokens: dynamicMaxTokens,
    });
  } catch (err) {
    // Kontrakt: nigdy nie rzucamy — ale porażka nie może być niewidzialna w logach
    // (silnik prozy padał po cichu i nikt tego nie zauważył).
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[DocumentBlockProse] LLM prose generation failed, returning stubs: ${message}`);
    // A4 — record the degradation so it is visible to the user, not just
    // in server logs. Behaviour unchanged: the deterministic stubs are
    // still returned.
    options.warnings?.record({
      code: 'llm_prose_fallback',
      scope: 'document',
      message: `LLM prose generation failed; deterministic placeholders retained (${message}).`,
    });
    return schema;
  }

  const parsed = safeParseJson(response.content);
  if (!parsed || !Array.isArray(parsed.blocks)) {
    // A4 — the call succeeded but returned an unusable payload (empty /
    // invalid JSON / wrong shape). This is the same silent degrade path:
    // record it.
    options.warnings?.record({
      code: 'llm_prose_fallback',
      scope: 'document',
      message: 'LLM prose response was empty or unparseable; deterministic placeholders retained.',
    });
    return schema;
  }

  // Build a blockId -> generated payload map, restricted to known targets.
  const targetById = new Map(targets.map((t) => [t.blockId, t]));
  const generated = new Map<string, { text?: string; items?: string[] }>();
  for (const entry of parsed.blocks) {
    if (!isRecord(entry) || typeof entry.blockId !== 'string') continue;
    const target = targetById.get(entry.blockId);
    if (!target) continue;
    if (target.kind === 'items') {
      if (!Array.isArray(entry.items)) continue;
      const items = entry.items
        .map((i) => (typeof i === 'string' ? i.trim() : ''))
        .filter((i) => i.length > 0);
      if (items.length === 0) continue;
      generated.set(entry.blockId, { items });
    } else {
      if (typeof entry.text !== 'string') continue;
      const text = entry.text.trim();
      if (text.length === 0) continue;
      generated.set(entry.blockId, { text });
    }
  }

  if (generated.size === 0) {
    // A4 — parsed JSON carried no entries that mapped to a known prose
    // target. Same silent-degrade class: the deterministic stubs survive.
    options.warnings?.record({
      code: 'llm_prose_fallback',
      scope: 'document',
      message:
        'LLM prose response matched no document blocks; deterministic placeholders retained.',
    });
    return schema;
  }

  // Deep clone so the caller's input schema is never mutated in place.
  const next = JSON.parse(JSON.stringify(schema)) as DocumentSchema;
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
      block.content = content;
      // The block is now grounded in (or explicitly flagged against) the
      // source pack, so it is no longer a bare structural assumption.
      if (sourceRefs.length > 0) {
        block.isAssumption = false;
      }
      // N-9: a paragraph carrying a GFM table must NOT get the inline
      // "_[Assumption]_" suffix from the renderer — appended after the final
      // "| … |" row it breaks the row's table membership in marked. Concrete
      // table content is not a bare assumption, so clear the flag.
      if (typeof content.text === 'string' && /^\s*\|.*\|\s*$/m.test(content.text)) {
        block.isAssumption = false;
      }
    }
  }
  return next;
}
