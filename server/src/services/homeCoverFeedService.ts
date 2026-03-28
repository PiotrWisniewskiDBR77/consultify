type Cached<T> = { at: number; value: T };

export type HomeCoverNewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt?: string;
  summary?: string;
};

export type HomeCoverTip = {
  id: string;
  titleEn: string;
  titlePl: string;
  bodyEn: string;
  bodyPl: string;
  tags?: string[];
};

const FEEDS: Array<{ source: string; url: string }> = [
  // Use OpenRSS wrappers for feeds that sometimes block bots.
  { source: 'OpenAI', url: 'https://openrss.org/openai.com/news/rss.xml' },
  { source: 'Anthropic', url: 'https://openrss.org/www.anthropic.com/news' },
  { source: 'Google AI', url: 'https://blog.google/technology/ai/rss/' },
  { source: 'AWS ML', url: 'https://aws.amazon.com/blogs/machine-learning/feed/' },
  { source: 'Microsoft AI', url: 'https://www.microsoft.com/en-us/ai/blog/feed/' },
];

const FEED_CACHE = new Map<string, Cached<HomeCoverNewsItem[]>>();
const FEED_CACHE_MS = 20 * 60 * 1000;

const TIPS_APP: HomeCoverTip[] = [
  {
    id: 'app-tip-triage-5min',
    titleEn: 'Do a 5‑minute triage',
    titlePl: 'Zrób 5‑min triage',
    bodyEn: 'Open Inbox, clear one blocker, and convert one idea into a concrete next step.',
    bodyPl: 'Wejdź do Inbox, zdejmij jeden blocker i zamień jeden pomysł w konkretny next step.',
    tags: ['flow', 'daily'],
  },
  {
    id: 'app-tip-close-decision-loop',
    titleEn: 'Close one decision loop',
    titlePl: 'Domknij jedną pętlę decyzji',
    bodyEn:
      'Pick the hottest decision and produce a one‑page decision note before you ask for approval.',
    bodyPl: 'Wybierz najgorętszą decyzję i przygotuj one‑pager, zanim poprosisz o approval.',
    tags: ['governance', 'decision'],
  },
  {
    id: 'app-tip-timebox',
    titleEn: 'Timebox the next move',
    titlePl: 'Zatimeboxuj kolejny ruch',
    bodyEn: 'If a task is due soon, timebox 25–45 minutes and define “done for today”.',
    bodyPl: 'Jeśli zadanie jest blisko terminu, ustaw 25–45 minut i zdefiniuj „done na dziś”.',
    tags: ['execution'],
  },
];

const TIPS_AI_PLAYBOOK: HomeCoverTip[] = [
  {
    id: 'ai-playbook-decision-question',
    titleEn: 'Start from the decision question',
    titlePl: 'Zacznij od pytania decyzyjnego',
    bodyEn: 'AI is useful when it improves a decision or a workflow step—name the decision first.',
    bodyPl: 'AI ma sens, gdy poprawia decyzję albo krok workflow — nazwij decyzję jako pierwszą.',
    tags: ['strategy', 'framing'],
  },
  {
    id: 'ai-playbook-baseline',
    titleEn: 'Baseline before you optimize',
    titlePl: 'Baseline zanim optymalizujesz',
    bodyEn: 'Pick one metric, define “before”, and collect 1–2 weeks of baseline evidence.',
    bodyPl: 'Wybierz jedną metrykę, zdefiniuj „before” i zbierz 1–2 tygodnie baseline evidence.',
    tags: ['measurement'],
  },
  {
    id: 'ai-playbook-hitl',
    titleEn: 'Design human‑in‑the‑loop',
    titlePl: 'Zaprojektuj human‑in‑the‑loop',
    bodyEn: 'Define who approves outputs, what exceptions look like, and when to stop.',
    bodyPl: 'Zdefiniuj kto zatwierdza outputy, jak wyglądają wyjątki i kiedy przerwać.',
    tags: ['risk', 'governance'],
  },
];

function getDaySeed(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.abs(diffDays);
}

export function pickTipOfDay(now: Date): { appTip: HomeCoverTip; aiPlaybookTip: HomeCoverTip } {
  const seed = getDaySeed(now);
  const appTip = TIPS_APP[seed % TIPS_APP.length];
  const aiPlaybookTip = TIPS_AI_PLAYBOOK[seed % TIPS_AI_PLAYBOOK.length];
  return { appTip, aiPlaybookTip };
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1');
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return null;
  return decodeEntities(stripCdata(String(m[1] || '')).trim());
}

function extractAtomLink(entryXml: string): string | null {
  const m = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return m ? String(m[1]).trim() : null;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Many feeds block empty UA; keep it simple and honest.
        'User-Agent': 'ConsultifyHome/1.0 (+https://consultify.local)',
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseFeedXml(xml: string, source: string, perFeedLimit: number): HomeCoverNewsItem[] {
  const x = xml || '';
  const isAtom = /<feed[\s>]/i.test(x) && /<entry[\s>]/i.test(x);

  const blocks = isAtom
    ? x.match(/<entry[\s\S]*?<\/entry>/gi) || []
    : x.match(/<item[\s\S]*?<\/item>/gi) || [];

  const items: HomeCoverNewsItem[] = [];
  for (const b of blocks.slice(0, perFeedLimit)) {
    const title = extractTag(b, 'title') || '';
    const url = isAtom ? extractAtomLink(b) : extractTag(b, 'link');
    const publishedAt =
      extractTag(b, 'pubDate') ||
      extractTag(b, 'published') ||
      extractTag(b, 'updated') ||
      undefined;
    const rawSummary =
      extractTag(b, 'description') || extractTag(b, 'summary') || extractTag(b, 'content') || '';
    const summary = rawSummary ? stripHtml(rawSummary).slice(0, 220) : undefined;

    if (!title || !url) continue;
    items.push({
      id: `${source}:${url}`,
      title: stripHtml(title).slice(0, 180),
      source,
      url,
      publishedAt,
      summary,
    });
  }

  return items;
}

export async function getAiNews(now = new Date(), limit = 6): Promise<HomeCoverNewsItem[]> {
  const perFeedLimit = 3;
  const results: HomeCoverNewsItem[] = [];

  const cached = FEED_CACHE.get('all');
  if (cached && now.getTime() - cached.at < FEED_CACHE_MS) {
    return cached.value.slice(0, limit);
  }

  const settled = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const cache = FEED_CACHE.get(f.url);
      if (cache && now.getTime() - cache.at < FEED_CACHE_MS) return cache.value;

      const xml = await fetchText(f.url, 4500);
      const items = parseFeedXml(xml, f.source, perFeedLimit);
      FEED_CACHE.set(f.url, { at: now.getTime(), value: items });
      return items;
    })
  );

  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) results.push(...s.value);
  }

  // Best-effort sort by published date if parseable, otherwise keep stable.
  results.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
    if (Number.isFinite(tb)) return 1;
    if (Number.isFinite(ta)) return -1;
    return a.source.localeCompare(b.source);
  });

  const final = results.slice(0, limit);
  FEED_CACHE.set('all', { at: now.getTime(), value: final });
  return final;
}
