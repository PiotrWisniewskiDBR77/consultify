import type { SourceUsed } from './types.js';

type CacheEntry = { ts: number; value: SourceUsed[] };
const WEB_CACHE_TTL_MS = 10 * 60 * 1000;
const WEB_CACHE_MAX = 200;
const webCache = new Map<string, CacheEntry>();

function cacheKey(args: {
  agentId: string;
  language: string;
  query: string;
  maxResults: number;
}): string {
  return `${args.agentId}|${args.language}|${args.maxResults}|${args.query.slice(0, 800)}`;
}

function getCached(key: string): SourceUsed[] | null {
  const e = webCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > WEB_CACHE_TTL_MS) {
    webCache.delete(key);
    return null;
  }
  return e.value;
}

function setCached(key: string, value: SourceUsed[]) {
  if (webCache.size >= WEB_CACHE_MAX) {
    let oldestKey: string | null = null;
    let oldestTs = Number.POSITIVE_INFINITY;
    for (const [k, v] of webCache.entries()) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) webCache.delete(oldestKey);
  }
  webCache.set(key, { ts: Date.now(), value });
}

function domainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export async function retrieveAgentAuditWebSources(args: {
  enabled: boolean;
  agentId: string;
  query: string;
  language?: string;
  maxResults?: number;
}): Promise<SourceUsed[]> {
  const enabled = args.enabled === true;
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!enabled || !apiKey) return [];

  const language = (args.language || 'en').split('-')[0];
  const maxResults = Math.max(1, Math.min(6, args.maxResults ?? 4));
  const key = cacheKey({ agentId: args.agentId, language, query: args.query, maxResults });
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const { TavilyWebSearchService } = await import('../tavilyWebSearchService.js');
    const svc = new (TavilyWebSearchService as any)(apiKey);
    const resp = await svc.search(args.query, { maxResults, includeNews: true });
    const sources: SourceUsed[] = (resp?.results || [])
      .map((r: any) => {
        const url = String(r?.url || '').trim();
        if (!url) return null;
        return {
          type: 'web_source' as const,
          url,
          title: r?.title ? String(r.title).trim().slice(0, 140) : undefined,
          domain: domainFromUrl(url),
        } satisfies SourceUsed;
      })
      .filter(Boolean) as SourceUsed[];

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniq = sources.filter((s) => {
      if (s.type !== 'web_source') return false;
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    const final = uniq.slice(0, 6);
    setCached(key, final);
    return final;
  } catch {
    return [];
  }
}
