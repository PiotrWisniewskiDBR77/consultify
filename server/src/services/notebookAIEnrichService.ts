/**
 * notebookAIEnrichService — AI continuous enrichment for Living Notebook (M04, Agent 3).
 *
 * After a page is saved, `enrichPage(pageId)` runs cheap, deterministic enrichment:
 *   1. AUTO-TAGS  — heuristic keyword extraction from title + content_text, merged
 *                   (non-destructively) into the page's existing `tags_json`.
 *   2. TOPIC LINKS — delegates to notebookTopicService.deriveTopicsForPage (Agent 1)
 *                   which derives + pins topics. Imported lazily inside a try/catch so
 *                   this service degrades gracefully if the topic module is unavailable.
 *
 * Design notes:
 *   - Pure heuristics (no LLM call) → fast, free, safe to run on every save. An LLM
 *     pass can be layered later (see TODO) without changing the call site contract.
 *   - NEVER throws to the caller: enrichment is best-effort. The CTO wires this into
 *     the save-path (NotebookContent scheduleSave → after save). A failed enrich must
 *     not fail the save. All failures are caught and reported in the result.
 *   - Idempotent: re-running on the same content produces the same tags/topics.
 */

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export interface EnrichPageResult {
  pageId: string;
  /** Tags added by this run (not already present). */
  addedTags: string[];
  /** Full tag set on the page after enrichment. */
  tags: string[];
  /** Topic candidates derived (name/slug/score); empty if topic module unavailable. */
  topics: Array<{ name: string; slug: string; score: number }>;
  /** True when topic derivation ran; false when skipped/unavailable. */
  topicsLinked: boolean;
  /** Non-fatal degradation reasons (e.g. 'topic-service-unavailable'). */
  degraded: string[];
}

export interface EnrichPageOptions {
  /** Max heuristic tags to add. Default 5. */
  maxTags?: number;
  /** When false, skip the topic-derivation step. Default true. */
  deriveTopics?: boolean;
  /** Persist derived topic pins. Default true (passed through to the topic service). */
  persistTopics?: boolean;
}

// Bilingual (PL/EN) stopword set — short, high-frequency words that never make good
// tags. Kept local so this module has no cross-service coupling for the tag path.
const STOPWORDS = new Set<string>([
  // EN
  'this',
  'that',
  'with',
  'from',
  'have',
  'will',
  'your',
  'their',
  'about',
  'which',
  'there',
  'would',
  'could',
  'should',
  'these',
  'those',
  'into',
  'than',
  'then',
  'them',
  'they',
  'what',
  'when',
  'where',
  'while',
  'been',
  'were',
  'also',
  'such',
  'some',
  'more',
  'most',
  'other',
  'only',
  'over',
  'after',
  'before',
  'because',
  // PL
  'jest',
  'sie',
  'nie',
  'tego',
  'tych',
  'jako',
  'oraz',
  'przez',
  'dla',
  'jest',
  'aby',
  'czy',
  'lub',
  'ale',
  'bardzo',
  'tylko',
  'jakie',
  'ktore',
  'ktory',
  'ktora',
  'mozna',
  'bedzie',
  'jego',
  'jej',
  'ich',
  'ten',
  'tam',
  'tutaj',
  'wiec',
  'taki',
]);

/**
 * Extract heuristic auto-tags from a note's title + body.
 * Pure function — exported for unit testing.
 *
 * Title words weigh more than body words; the top-N distinct keywords (by weighted
 * frequency, length >= 4, not a stopword, not purely numeric) become tags.
 */
export function deriveAutoTags(input: {
  title?: string | null;
  contentText?: string | null;
  max?: number;
}): string[] {
  const max = Math.max(1, Math.min(input.max ?? 5, 10));
  const freq = new Map<string, number>();

  const ingest = (text: string, weight: number) => {
    const words = String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .replace(/ł/g, 'l')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + weight);
    }
  };

  ingest(input.title ?? '', 3);
  ingest(String(input.contentText ?? '').slice(0, 4000), 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);

  // TODO(LLM): optionally call modelRouter+llmService to extract higher-order tags
  // and merge (dedupe) with these heuristic ones. Kept off the hot path for now.
}

/** Parse a `tags_json` column value into a string[] (tolerant of legacy formats). */
function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* fall through to CSV */
    }
    if (s.includes(','))
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    return [s];
  }
  return [];
}

/**
 * Enrich a single notebook page after save: auto-tag + suggest topic links.
 * Best-effort and non-throwing — returns a result describing what happened.
 *
 * CTO wire-in (save-path): call without awaiting the caller's response, e.g.
 *   void notebookAIEnrichService.enrichPage(pageId).catch(() => {});
 */
export async function enrichPage(
  pageId: string,
  options: EnrichPageOptions = {}
): Promise<EnrichPageResult> {
  const result: EnrichPageResult = {
    pageId,
    addedTags: [],
    tags: [],
    topics: [],
    topicsLinked: false,
    degraded: [],
  };

  if (!pageId) {
    result.degraded.push('missing-page-id');
    return result;
  }

  // 1) Load the page.
  let page: any = null;
  try {
    page = await queryHelpers.queryOne<any>(
      `SELECT id, organization_id, title, content_text, tags_json
         FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
  } catch (err: any) {
    logger.warn(`[NotebookEnrich] page load failed for ${pageId}: ${err?.message || err}`);
    result.degraded.push('page-load-failed');
    return result;
  }
  if (!page) {
    result.degraded.push('page-not-found');
    return result;
  }

  // 2) Auto-tags — merge heuristic keywords into existing tags (non-destructive).
  const existingTags = parseTags(page.tags_json);
  const existingLower = new Set(existingTags.map((t) => t.toLowerCase()));
  const auto = deriveAutoTags({
    title: page.title,
    contentText: page.content_text,
    max: options.maxTags ?? 5,
  });
  const addedTags = auto.filter((t) => !existingLower.has(t.toLowerCase()));
  const mergedTags = [...existingTags, ...addedTags];

  if (addedTags.length > 0) {
    try {
      // M02-018: do NOT bump `updated_at` here. This fire-and-forget job runs
      // asynchronously right after every content save (see the call site's
      // `void enrichPage(id).catch(() => {})`), which races the client's very
      // next autosave. Before this fix, a successful edit handed the client an
      // `updatedAt` token that this background job could invalidate within
      // milliseconds — turning the client's own immediately-following,
      // perfectly legitimate autosave into a false 409 "modified elsewhere"
      // conflict, even though nothing the user did conflicted with anything.
      // Reproduced by a real create->edit->autosave->read-back cycle test
      // (tests/integration/m02c-notebook-legacy-conflict.realdb.test.ts).
      // Auto-tags are explicitly documented above as a non-destructive,
      // best-effort merge; they do not need to participate in the optimistic-
      // concurrency version a human editor is racing against.
      await queryHelpers.queryRun(`UPDATE notebook_pages SET tags_json = ? WHERE id = ?`, [
        JSON.stringify(mergedTags),
        pageId,
      ]);
      result.addedTags = addedTags;
    } catch (err: any) {
      logger.warn(`[NotebookEnrich] tag persist failed for ${pageId}: ${err?.message || err}`);
      result.degraded.push('tag-persist-failed');
    }
  }
  result.tags = result.addedTags.length > 0 ? mergedTags : existingTags;

  // 3) Topic links — delegate to Agent 1's notebookTopicService. Lazy import inside
  //    try/catch so a missing/incomplete topic module degrades instead of throwing.
  if (options.deriveTopics !== false) {
    try {
      const topicService = await import('./notebookTopicService.js');
      const derive = (topicService as any).deriveTopicsForPage;
      if (typeof derive === 'function') {
        const derived = await derive(pageId, {
          orgId: page.organization_id ? String(page.organization_id) : undefined,
          persist: options.persistTopics !== false,
          source: 'ai',
        });
        result.topics = Array.isArray(derived)
          ? derived.map((d: any) => ({
              name: String(d?.name ?? ''),
              slug: String(d?.slug ?? ''),
              score: Number(d?.score ?? 0),
            }))
          : [];
        result.topicsLinked = true;
      } else {
        // TODO-STUB: Agent 1 topic module present but deriveTopicsForPage not exported.
        result.degraded.push('topic-derive-not-implemented');
      }
    } catch (err: any) {
      logger.warn(
        `[NotebookEnrich] topic derivation skipped for ${pageId}: ${err?.message || err}`
      );
      result.degraded.push('topic-service-unavailable');
    }
  }

  return result;
}

const notebookAIEnrichService = { enrichPage, deriveAutoTags };
export default notebookAIEnrichService;
