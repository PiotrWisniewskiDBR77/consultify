import logger from '../../utils/Logger.js';
import KnowledgeBaseService from '../KnowledgeBaseService.js';

type SupportedKbLang = 'en' | 'pl';

export type HelpDocsCitation = {
  id: string;
  type: 'external';
  title: string;
  reference: string;
  link?: string;
  excerpt?: string;
};

export type HelpDocsContextResult = {
  systemInstructionAddon: string;
  citations: HelpDocsCitation[];
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string;
    categorySlug: string;
    categoryName: string;
    readingTimeMinutes: number;
  }>;
  isProductQuestion: boolean;
};

// ---------------------------------------------------------------------------
// In-memory TTL cache for KB retrieval results (short-lived, per-process)
// ---------------------------------------------------------------------------
const KB_CACHE_TTL_MS = 90_000; // 90 seconds
const KB_CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  result: HelpDocsContextResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(query: string, lang: string, moduleId: string | null): string {
  const q = query.toLowerCase().trim().slice(0, 120);
  return `${lang}::${moduleId || ''}::${q}`;
}

function getCached(key: string): HelpDocsContextResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: HelpDocsContextResult): void {
  if (cache.size >= KB_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { result, expiresAt: Date.now() + KB_CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Product / how-to intent detection
// ---------------------------------------------------------------------------
const PRODUCT_INTENT_PATTERNS_EN = [
  /\bhow (?:do|can|to|should)\b/i,
  /\bwhere (?:is|can|do)\b/i,
  /\bwhat (?:is|does|are)\b/i,
  /\bhelp (?:me|with)\b/i,
  /\bshow me\b/i,
  /\bexplain\b/i,
  /\bnavigat/i,
  /\btutorial\b/i,
  /\bguide\b/i,
  /\bworkflow\b/i,
  /\bstep[- ]?by[- ]?step\b/i,
  /\bfeature\b/i,
  /\bmodule\b/i,
  /\bsetting/i,
  /\bdashboard\b/i,
  /\bassessment\b/i,
  /\binitiative/i,
  /\broadmap\b/i,
  /\breport/i,
  /\bkpi\b/i,
];

const PRODUCT_INTENT_PATTERNS_PL = [
  /\bjak\b/i,
  /\bgdzie\b/i,
  /\bco to\b/i,
  /\bpomoc/i,
  /\bpokaz/i,
  /\bwyjaśnij/i,
  /\bnawigac/i,
  /\bporadnik/i,
  /\bprzewodnik/i,
  /\bkrok po kroku/i,
  /\bfunkcj/i,
  /\bmoduł/i,
  /\bustawien/i,
  /\bpanel/i,
  /\bocen/i,
  /\binicjatyw/i,
  /\braport/i,
];

export function isProductOrHowToQuery(text: string, lang?: SupportedKbLang): boolean {
  const patterns = lang === 'pl' ? PRODUCT_INTENT_PATTERNS_PL : PRODUCT_INTENT_PATTERNS_EN;
  const combined = [...patterns, ...(lang === 'pl' ? [] : PRODUCT_INTENT_PATTERNS_PL)];
  return combined.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Language helpers
// ---------------------------------------------------------------------------
function normalizeLang(lang?: string): SupportedKbLang {
  const base = String(lang || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];
  return base === 'pl' ? 'pl' : 'en';
}

function detectLangFromText(text: string): SupportedKbLang {
  const s = String(text || '');
  if (/[ąćęłńóśźż]/i.test(s)) return 'pl';
  if (/\b(jak|dlaczego|gdzie|kiedy|czy|pomoc|ustawienia)\b/i.test(s)) return 'pl';
  return 'en';
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const id = String(it.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

function safeSlice(text: string, maxChars: number): string {
  const t = String(text || '').trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

// ---------------------------------------------------------------------------
// Guardrails: sanitize AI-facing content to reduce hallucination surface
// ---------------------------------------------------------------------------
function sanitizeExcerpt(raw: string): string {
  const cleaned = raw
    .replace(/<[^>]+>/g, '') // strip HTML
    .replace(/!\[.*?\]\(.*?\)/g, '') // strip markdown images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links → text
    .replace(/#{1,6}\s*/g, '') // strip heading markers
    .replace(/\n{3,}/g, '\n\n'); // collapse excess newlines
  return cleaned.trim();
}

// Max total chars for all KB excerpts injected into system prompt
const MAX_TOTAL_KB_CHARS = 6000;

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------
export async function buildHelpDocsContext(opts: {
  query: string;
  language?: string;
  moduleId?: string | null;
  surface?: string;
  maxArticles?: number;
  maxCharsPerArticle?: number;
}): Promise<HelpDocsContextResult> {
  const query = String(opts.query || '').trim();
  const emptyResult: HelpDocsContextResult = {
    systemInstructionAddon: '',
    citations: [],
    articles: [],
    isProductQuestion: false,
  };

  if (!query) return emptyResult;

  const lang = opts.language ? normalizeLang(opts.language) : detectLangFromText(query);
  const moduleId = (opts.moduleId || '').trim() || null;
  const surface = (opts.surface || '').trim() || null;
  const maxArticles = Math.min(Math.max(opts.maxArticles || 3, 1), 5);
  const maxCharsPerArticle = Math.min(Math.max(opts.maxCharsPerArticle || 1400, 400), 3000);

  const isProduct = isProductOrHowToQuery(query, lang);

  // Check cache
  const ck = cacheKey(query, lang, moduleId);
  const cached = getCached(ck);
  if (cached) {
    logger.debug('[helpDocsContext] Cache HIT');
    return { ...cached, isProductQuestion: isProduct };
  }

  try {
    // Step 1: retrieve candidate articles (contextual + search + surface-bound)
    const [contextual, searched, surfaceBound] = await Promise.all([
      moduleId ? KnowledgeBaseService.getContextualArticles(moduleId, lang, maxArticles) : [],
      KnowledgeBaseService.searchArticles(query, lang, Math.max(8, maxArticles * 3)),
      surface ? KnowledgeBaseService.getArticlesForSurface(
        surface === 'chat' ? 'ai_recommendations' : surface,
        lang,
        { toolContext: moduleId || undefined, limit: maxArticles }
      ).catch(() => []) : [],
    ]);

    // P26-B: Surface-bound articles get priority, then contextual, then search
    const candidates = uniqById([
      ...(Array.isArray(surfaceBound) ? (surfaceBound as any[]) : []),
      ...(Array.isArray(contextual) ? (contextual as any[]) : []),
      ...(Array.isArray(searched) ? (searched as any[]) : []),
    ]).slice(0, maxArticles);

    if (candidates.length === 0) {
      const noDocsResult: HelpDocsContextResult = {
        systemInstructionAddon: isProduct
          ? '\n## HELP / KNOWLEDGE BASE\nNo matching documentation found for this query. ' +
            'If the user is asking about a product workflow or UI feature, respond: ' +
            '"Our documentation does not cover this topic yet. I\'ll do my best to help based on general platform knowledge."\n'
          : '',
        citations: [],
        articles: [],
        isProductQuestion: isProduct,
      };
      setCache(ck, noDocsResult);
      return noDocsResult;
    }

    // Step 2: load full article content for top candidates
    const fullArticles = await Promise.all(
      candidates.map(async (a: any) => {
        try {
          return await KnowledgeBaseService.getArticleBySlug(String(a.slug || ''), lang);
        } catch {
          return null;
        }
      })
    );

    const resolved = fullArticles.filter(Boolean) as any[];
    if (resolved.length === 0) {
      setCache(ck, emptyResult);
      return { ...emptyResult, isProductQuestion: isProduct };
    }

    const citations: HelpDocsCitation[] = resolved.map((a: any, idx: number) => {
      const link =
        a.category_slug && a.slug
          ? `/docs/${String(a.category_slug)}/${String(a.slug)}`
          : undefined;
      return {
        id: `kb_${String(a.id || idx + 1)}`,
        type: 'external',
        title: String(a.title || a.slug || 'Knowledge Base'),
        reference: `Docs • ${String(a.category_name || a.category_slug || 'Knowledge Base')}`,
        link,
        excerpt: safeSlice(String(a.summary || ''), 220),
      };
    });

    const articles = resolved.map((a: any) => ({
      id: String(a.id || ''),
      slug: String(a.slug || ''),
      title: String(a.title || ''),
      summary: String(a.summary || ''),
      categorySlug: String(a.category_slug || ''),
      categoryName: String(a.category_name || ''),
      readingTimeMinutes: Number(a.reading_time_minutes || 0),
    }));

    // Build snippets with guardrails (sanitize + budget chars)
    let totalChars = 0;
    const snippets = resolved
      .map((a: any, i: number) => {
        if (totalChars >= MAX_TOTAL_KB_CHARS) return '';

        const title = String(a.title || a.slug || 'Article');
        const slug = String(a.slug || '');
        const cat = String(a.category_name || a.category_slug || 'Knowledge Base');
        const summary = sanitizeExcerpt(safeSlice(String(a.summary || ''), 400));
        const rawContent = sanitizeExcerpt(String(a.content || ''));
        const budgetLeft = Math.max(0, MAX_TOTAL_KB_CHARS - totalChars);
        const content = safeSlice(rawContent, Math.min(maxCharsPerArticle, budgetLeft));

        totalChars += summary.length + content.length;

        return [
          `### [KB${i + 1}] ${title}`,
          `- slug: ${slug}`,
          `- category: ${cat}`,
          summary ? `- summary: ${summary}` : '',
          '',
          content ? `Excerpt:\n${content}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .filter(Boolean)
      .join('\n\n');

    const citationPolicy = isProduct
      ? [
          '- When answering about product workflows, UI features, or how-to questions, CITE the KB items inline as [KB1], [KB2], etc.',
          '- If docs partially cover the question, answer from docs and clearly mark what is NOT documented.',
          '- If docs do not cover the question at all, say: "Our documentation does not cover this topic yet." and then help from general platform knowledge.',
          '- NEVER invent documentation URLs or article titles that do not exist in the snippets above.',
        ]
      : [
          '- You may cite these KB items inline as [KB1], [KB2] when relevant.',
          '- If docs do not cover the question, say what is missing and propose next steps.',
        ];

    const systemInstructionAddon = [
      '',
      '## HELP / KNOWLEDGE BASE (product documentation)',
      'Use the documentation snippets below to answer product/how-to questions about Consultify/IRIS.',
      'Rules:',
      '- Prefer these docs over guesses when explaining UI behavior or workflows.',
      ...citationPolicy,
      '- NEVER fabricate feature names, menu paths, or settings that are not in these docs or your platform knowledge.',
      '',
      snippets,
    ].join('\n');

    const result: HelpDocsContextResult = {
      systemInstructionAddon,
      citations,
      articles,
      isProductQuestion: isProduct,
    };

    setCache(ck, result);
    return result;
  } catch (err: any) {
    logger.error(`[helpDocsContext] Failed to build context: ${err?.message}`);
    return { ...emptyResult, isProductQuestion: isProduct };
  }
}

export default { buildHelpDocsContext, isProductOrHowToQuery };
