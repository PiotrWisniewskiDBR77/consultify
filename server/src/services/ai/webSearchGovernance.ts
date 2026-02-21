/**
 * Web Search Governance (T118)
 * Enforces internetEnabled policy, domain allowlist/denylist, SSRF safety, cache.
 */
import logger from '../../utils/Logger.js';

const SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/0\.0\.0\.0/,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/169\.254\./,
];

const DEFAULT_DOMAIN_DENYLIST = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co'];

const searchCache = new Map<string, { result: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CITATIONS = 8;
const MAX_CONTENT_CHARS = 5000;

export interface WebSearchPolicy {
  internetEnabled: boolean;
  domainAllowlist: string[] | null;
  domainDenylist: string[];
  maxCitations: number;
  maxContentChars: number;
  reason?: string;
}

export function getDefaultPolicy(): WebSearchPolicy {
  return {
    internetEnabled: false,
    domainAllowlist: null,
    domainDenylist: DEFAULT_DOMAIN_DENYLIST,
    maxCitations: MAX_CITATIONS,
    maxContentChars: MAX_CONTENT_CHARS,
  };
}

export async function getEffectiveWebSearchPolicy(
  organizationId: string,
  projectId?: string
): Promise<WebSearchPolicy> {
  const policy = getDefaultPolicy();
  try {
    const { default: AIPolicyEngine } = await import('../../services/aiPolicyEngine.js');
    const effective = await AIPolicyEngine.getEffectivePolicy(
      organizationId,
      projectId || undefined
    );
    policy.internetEnabled = !!effective?.internetEnabled;
    if (effective?.regulatoryModeEnabled) {
      policy.internetEnabled = false;
      policy.reason = 'Regulatory mode active — internet disabled';
    }
  } catch {
    policy.internetEnabled = false;
    policy.reason = 'Policy engine unavailable — defaulting to restricted';
  }
  if (!process.env.TAVILY_API_KEY) {
    policy.internetEnabled = false;
    policy.reason = 'TAVILY_API_KEY not configured';
  }
  return policy;
}

export function isUrlSafe(
  url: string,
  policy: WebSearchPolicy
): { safe: boolean; reason?: string } {
  for (const pattern of SSRF_BLOCKED_PATTERNS) {
    if (pattern.test(url)) return { safe: false, reason: 'SSRF: private network blocked' };
  }
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (policy.domainDenylist.some((d) => hostname === d || hostname.endsWith('.' + d))) {
      return { safe: false, reason: `Domain denied: ${hostname}` };
    }
    if (
      policy.domainAllowlist &&
      !policy.domainAllowlist.some((d) => hostname === d || hostname.endsWith('.' + d))
    ) {
      return {
        safe: false,
        reason: `Domain not on allowlist: ${hostname}`,
      };
    }
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }
  return { safe: true };
}

export function sanitizeQuery(query: string): string {
  let clean = query;
  clean = clean.replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, '[EMAIL]');
  clean = clean.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
  clean = clean.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CC]');
  return clean.slice(0, 500);
}

export function filterResults(
  results: Array<{ url?: string; content?: string; [k: string]: unknown }>,
  policy: WebSearchPolicy
): Array<{ url?: string; content?: string; [k: string]: unknown }> {
  return results
    .filter((r) => {
      if (!r?.url) return false;
      const check = isUrlSafe(r.url, policy);
      if (!check.safe) {
        logger.debug(`[WebSearchGov] Filtered result: ${check.reason}`);
        return false;
      }
      return true;
    })
    .slice(0, policy.maxCitations)
    .map((r) => ({
      ...r,
      content: r.content ? r.content.slice(0, policy.maxContentChars) : r.content,
      raw_content: undefined,
    }));
}

function cacheKey(orgId: string, query: string, lang?: string): string {
  return `${orgId}:${query.toLowerCase().trim()}:${lang || 'en'}`;
}

export function getCached(orgId: string, query: string, lang?: string): unknown | null {
  const key = cacheKey(orgId, query, lang);
  const entry = searchCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.result;
  if (entry) searchCache.delete(key);
  return null;
}

export function setCache(orgId: string, query: string, result: unknown, lang?: string): void {
  const key = cacheKey(orgId, query, lang);
  searchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  if (searchCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of searchCache) {
      if (v.expiresAt < now) searchCache.delete(k);
    }
  }
}

export default {
  getEffectiveWebSearchPolicy,
  isUrlSafe,
  sanitizeQuery,
  filterResults,
  getCached,
  setCache,
  getDefaultPolicy,
};
