import * as cheerio from 'cheerio';

import logger from '../../utils/Logger.js';
import {
  type TavilySearchOptions,
  type TavilySearchResponse,
  type TavilySearchResult,
  TavilyWebSearchService,
} from './tavilyWebSearchService.js';

export type RuntimeWebSearchProvider = 'tavily' | 'duckduckgo';

export type RuntimeWebSearchOptions = TavilySearchOptions & {
  language?: string;
};

export type RuntimeWebSearchResult = TavilySearchResult;

export type RuntimeWebSearchResponse = TavilySearchResponse & {
  provider: RuntimeWebSearchProvider;
};

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDuckDuckGoHref(href: string): string {
  const raw = String(href || '').trim();
  if (!raw) return '';
  const absolute = raw.startsWith('//') ? `https:${raw}` : raw;

  try {
    const parsed = new URL(absolute, 'https://duckduckgo.com');
    const encodedTarget = parsed.searchParams.get('uddg');
    if (encodedTarget) {
      return decodeURIComponent(encodedTarget);
    }
    return parsed.toString();
  } catch {
    return absolute;
  }
}

function isResultUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (!hostname) return false;
    if (hostname === 'duckduckgo.com' || hostname.endsWith('.duckduckgo.com')) return false;
    return true;
  } catch {
    return false;
  }
}

class DuckDuckGoWebSearchService {
  async search(
    query: string,
    options: RuntimeWebSearchOptions = {}
  ): Promise<RuntimeWebSearchResponse> {
    const maxResults = Math.max(1, Math.min(10, options.maxResults ?? 8));
    const language = String(options.language || 'en').split('-')[0] || 'en';
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=${encodeURIComponent(
      `${language}-en`
    )}`;

    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!resp.ok) {
      const raw = await resp.text().catch(() => '');
      logger.warn('[DuckDuckGo] Search failed', {
        status: resp.status,
        statusText: resp.statusText,
        raw: raw.slice(0, 500),
      });
      throw new Error(`DuckDuckGo search failed: HTTP ${resp.status} ${resp.statusText}`);
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const results: RuntimeWebSearchResult[] = [];
    const seenUrls = new Set<string>();

    $('.result').each((_: number, element: any) => {
      if (results.length >= maxResults) return;
      const container = $(element);
      const linkEl = container.find('a.result__a, .result__title a, a.result-link').first();
      const title = cleanText(linkEl.text());
      const urlValue = normalizeDuckDuckGoHref(String(linkEl.attr('href') || ''));
      const snippet = cleanText(
        container.find('.result__snippet, .result-snippet, .result__extras__url').first().text()
      );

      if (!title || !isResultUrl(urlValue) || seenUrls.has(urlValue)) return;
      seenUrls.add(urlValue);
      results.push({
        title,
        url: urlValue,
        snippet: snippet || undefined,
      });
    });

    if (results.length === 0) {
      $('a[href]').each((_: number, element: any) => {
        if (results.length >= maxResults) return;
        const linkEl = $(element);
        const title = cleanText(linkEl.text());
        const urlValue = normalizeDuckDuckGoHref(String(linkEl.attr('href') || ''));
        const snippet = cleanText(linkEl.parent().text()).replace(title, '').trim();

        if (!title || !isResultUrl(urlValue) || seenUrls.has(urlValue)) return;
        seenUrls.add(urlValue);
        results.push({
          title,
          url: urlValue,
          snippet: snippet || undefined,
        });
      });
    }

    return {
      provider: 'duckduckgo',
      query,
      results,
    };
  }
}

export function getRuntimeWebSearchProvider(): RuntimeWebSearchProvider {
  return process.env.TAVILY_API_KEY?.trim() ? 'tavily' : 'duckduckgo';
}

export function getRuntimeWebSearchStatus(): {
  available: boolean;
  provider: RuntimeWebSearchProvider;
  tavilyConfigured: boolean;
} {
  return {
    available: true,
    provider: getRuntimeWebSearchProvider(),
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY?.trim()),
  };
}

export class RuntimeWebSearchService {
  async search(
    query: string,
    options: RuntimeWebSearchOptions = {}
  ): Promise<RuntimeWebSearchResponse> {
    const provider = getRuntimeWebSearchProvider();
    if (provider === 'tavily') {
      const response = await new TavilyWebSearchService(process.env.TAVILY_API_KEY || '').search(
        query,
        options
      );
      return {
        ...response,
        provider,
      };
    }

    return new DuckDuckGoWebSearchService().search(query, options);
  }
}

export default RuntimeWebSearchService;
