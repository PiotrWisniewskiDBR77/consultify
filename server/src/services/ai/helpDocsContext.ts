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
};

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

export async function buildHelpDocsContext(opts: {
  query: string;
  language?: string;
  moduleId?: string | null;
  maxArticles?: number;
  maxCharsPerArticle?: number;
}): Promise<HelpDocsContextResult> {
  const query = String(opts.query || '').trim();
  if (!query) {
    return { systemInstructionAddon: '', citations: [], articles: [] };
  }

  const lang = opts.language ? normalizeLang(opts.language) : detectLangFromText(query);
  const moduleId = (opts.moduleId || '').trim() || null;
  const maxArticles = Math.min(Math.max(opts.maxArticles || 3, 1), 5);
  const maxCharsPerArticle = Math.min(Math.max(opts.maxCharsPerArticle || 1400, 400), 3000);

  // Step 1: retrieve candidate articles (contextual + search)
  const [contextual, searched] = await Promise.all([
    moduleId ? KnowledgeBaseService.getContextualArticles(moduleId, lang, maxArticles) : [],
    KnowledgeBaseService.searchArticles(query, lang, Math.max(8, maxArticles * 3)),
  ]);

  const candidates = uniqById([
    ...(Array.isArray(contextual) ? (contextual as any[]) : []),
    ...(Array.isArray(searched) ? (searched as any[]) : []),
  ]).slice(0, maxArticles);

  if (candidates.length === 0) {
    return { systemInstructionAddon: '', citations: [], articles: [] };
  }

  // Step 2: load full article content for top candidates (so we can inject relevant excerpts)
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
    return { systemInstructionAddon: '', citations: [], articles: [] };
  }

  const citations: HelpDocsCitation[] = resolved.map((a: any, idx: number) => {
    const link =
      a.category_slug && a.slug ? `/docs/${String(a.category_slug)}/${String(a.slug)}` : undefined;
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

  const snippets = resolved
    .map((a: any, i: number) => {
      const title = String(a.title || a.slug || 'Article');
      const slug = String(a.slug || '');
      const cat = String(a.category_name || a.category_slug || 'Knowledge Base');
      const summary = safeSlice(String(a.summary || ''), 400);
      const content = safeSlice(String(a.content || ''), maxCharsPerArticle);

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
    .join('\n\n');

  const systemInstructionAddon = [
    '',
    '## HELP / KNOWLEDGE BASE (product documentation)',
    'Use the documentation snippets below to answer product/how-to questions about Consultinity/IRIS.',
    'Rules:',
    '- Prefer these docs over guesses when explaining UI behavior or workflows.',
    '- If docs do not cover the question, say what is missing and propose next steps.',
    '- You may cite these KB items inline as [KB1], [KB2] when relevant.',
    '',
    snippets,
  ].join('\n');

  return { systemInstructionAddon, citations, articles };
}

export default { buildHelpDocsContext };
