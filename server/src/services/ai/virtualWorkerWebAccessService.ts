import logger from '../../utils/Logger.js';
import { RuntimeWebSearchService } from './runtimeWebSearchService.js';
import type { VirtualWorkerProfile } from './virtualWorkerService.js';
import {
  filterResults,
  getCached,
  getDefaultPolicy,
  getEffectiveWebSearchPolicy,
  sanitizeQuery,
  setCache,
  type WebSearchPolicy,
} from './webSearchGovernance.js';
import { detectWebSearchIntent, type WebSearchIntent } from './webSearchIntentDetector.js';

type JsonRecord = Record<string, unknown>;

export interface WorkerWebAccessPolicy {
  internetEnabled: boolean;
  autoSearch: boolean;
  allowUserToggle: boolean;
  searchDepth: 'basic' | 'advanced';
  maxResults: number;
  domainAllowlist: string[] | null;
  domainDenylist: string[];
  maxCitations: number;
  maxContentChars: number;
  onlyFreshTopics: boolean;
  reason?: string;
}

export interface WorkerWebCitation {
  id: string;
  type: 'external';
  title: string;
  reference: string;
  link: string;
  excerpt: string;
}

export interface WorkerWebAccessResult {
  policy: WorkerWebAccessPolicy;
  intent: WebSearchIntent | null;
  used: boolean;
  reason?: string;
  queries: string[];
  citations: WorkerWebCitation[];
  answers: string[];
  results: Array<Record<string, unknown>>;
  systemInstructionAddon: string;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getWorkerPolicySource(profile?: VirtualWorkerProfile | null): JsonRecord {
  const retrievalPolicy = asRecord(profile?.retrieval_policy);
  const channelPolicy = asRecord(profile?.channel_policy);
  const workerWebPolicy = asRecord(retrievalPolicy.web_search);
  if (Object.keys(workerWebPolicy).length > 0) return workerWebPolicy;
  return asRecord(channelPolicy.web_access);
}

export function extractWorkerWebAccessPolicy(
  profile?: VirtualWorkerProfile | null
): WorkerWebAccessPolicy {
  const base = getDefaultPolicy();
  const source = getWorkerPolicySource(profile);

  return {
    internetEnabled: toBoolean(source.internetEnabled, false),
    autoSearch: toBoolean(source.autoSearch, false),
    allowUserToggle: toBoolean(source.allowUserToggle, true),
    searchDepth: source.searchDepth === 'advanced' ? 'advanced' : 'basic',
    maxResults: Math.max(1, Math.min(10, toNumber(source.maxResults, 5))),
    domainAllowlist:
      source.domainAllowlist === null
        ? null
        : Array.isArray(source.domainAllowlist)
          ? toStringArray(source.domainAllowlist)
          : base.domainAllowlist,
    domainDenylist: [...new Set([...base.domainDenylist, ...toStringArray(source.domainDenylist)])],
    maxCitations: Math.max(1, Math.min(12, toNumber(source.maxCitations, base.maxCitations))),
    maxContentChars: Math.max(
      500,
      Math.min(12000, toNumber(source.maxContentChars, base.maxContentChars))
    ),
    onlyFreshTopics: toBoolean(source.onlyFreshTopics, false),
  };
}

export function mergeWorkerWebAccessPolicy(args: {
  workerPolicy: WorkerWebAccessPolicy;
  orgPolicy?: WebSearchPolicy | null;
  requireOrgPolicy?: boolean;
}): WorkerWebAccessPolicy {
  const { workerPolicy, orgPolicy, requireOrgPolicy = true } = args;

  if (!workerPolicy.internetEnabled) {
    return {
      ...workerPolicy,
      internetEnabled: false,
      reason: workerPolicy.reason || 'Disabled in worker profile',
    };
  }

  if (requireOrgPolicy && !orgPolicy) {
    return {
      ...workerPolicy,
      internetEnabled: false,
      reason: 'Organization web policy unavailable',
    };
  }

  if (requireOrgPolicy && orgPolicy && !orgPolicy.internetEnabled) {
    return {
      ...workerPolicy,
      internetEnabled: false,
      reason: orgPolicy.reason || 'Internet disabled by organization policy',
    };
  }

  return {
    ...workerPolicy,
    internetEnabled: true,
    domainAllowlist:
      workerPolicy.domainAllowlist && workerPolicy.domainAllowlist.length > 0
        ? workerPolicy.domainAllowlist
        : (orgPolicy?.domainAllowlist ?? null),
    domainDenylist: [
      ...new Set([...(orgPolicy?.domainDenylist || []), ...workerPolicy.domainDenylist]),
    ],
    maxCitations: Math.min(
      workerPolicy.maxCitations,
      orgPolicy?.maxCitations || workerPolicy.maxCitations
    ),
    maxContentChars: Math.min(
      workerPolicy.maxContentChars,
      orgPolicy?.maxContentChars || workerPolicy.maxContentChars
    ),
  };
}

function shouldAutoSearchForWorker(
  message: string,
  workerPolicy: WorkerWebAccessPolicy,
  forceSearch: boolean
): boolean {
  if (forceSearch) return true;
  if (!workerPolicy.autoSearch) return false;
  if (!workerPolicy.onlyFreshTopics) return true;
  return /\b(latest|newest|recent|current|today|2025|2026|najnowsz|aktualn|dzisiaj|bieżąc)\b/i.test(
    message
  );
}

export function isDbr77ProductTruthQuery(message: string): boolean {
  const q = String(message || '').toLowerCase();
  const mentionsDbrProduct =
    /\bdbr77\b|\bdbr\b|\bconsultify\b|\bmarketplace\b|\biris\b|\bvector\b|\bdigital twin\b|\biiot\b/.test(
      q
    );
  if (!mentionsDbrProduct) return false;
  const externalResearchIntent =
    /\b(konkurenc|competitor|competition|rynek|market|trend|aktualn|bieżąc|current|latest|najnowsz|news|raport|report|usa|polsk|poland|benchmark)\b/i.test(
      q
    );
  return !externalResearchIntent;
}

export async function buildWorkerWebAccessResult(args: {
  message: string;
  locale?: string;
  profile?: VirtualWorkerProfile | null;
  workerSlug?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  userEnabledWebSearch?: boolean;
  historyLength?: number;
}): Promise<WorkerWebAccessResult> {
  const workerPolicy = extractWorkerWebAccessPolicy(args.profile);
  const orgPolicy = args.organizationId
    ? await getEffectiveWebSearchPolicy(args.organizationId, args.projectId || undefined)
    : null;
  const effectivePolicy = mergeWorkerWebAccessPolicy({
    workerPolicy,
    orgPolicy,
    requireOrgPolicy: Boolean(args.organizationId),
  });

  const userRequestedSearch = Boolean(args.userEnabledWebSearch) && effectivePolicy.allowUserToggle;
  const searchIntent = detectWebSearchIntent(args.message, {
    userEnabledWebSearch: userRequestedSearch,
    historyLength: args.historyLength ?? 0,
  });
  const productTruthQuery = isDbr77ProductTruthQuery(args.message);
  const shouldSearch =
    !productTruthQuery &&
    effectivePolicy.internetEnabled &&
    (shouldAutoSearchForWorker(args.message, effectivePolicy, userRequestedSearch) ||
      (searchIntent.shouldSearch && (userRequestedSearch || effectivePolicy.autoSearch)));

  if (!shouldSearch) {
    return {
      policy: effectivePolicy,
      intent: searchIntent,
      used: false,
      reason: effectivePolicy.internetEnabled
        ? productTruthQuery
          ? 'DBR77 product truth uses governed knowledge, not web research'
          : 'No worker web-search trigger for this message'
        : effectivePolicy.reason || 'Internet disabled',
      queries: [],
      citations: [],
      answers: [],
      results: [],
      systemInstructionAddon: '',
    };
  }

  const webSearch = new RuntimeWebSearchService();
  const baseQueries =
    searchIntent.queries.length > 0
      ? searchIntent.queries
      : [String(args.message || '').slice(0, 150)];
  const queries = baseQueries.slice(0, 3);
  const cacheNamespace = args.organizationId || `public:${String(args.workerSlug || 'worker')}`;
  const answers: string[] = [];
  const rawResults: Array<Record<string, unknown>> = [];

  for (const query of queries) {
    try {
      const cleanQuery = sanitizeQuery(query);
      const cached = getCached(cacheNamespace, cleanQuery, args.locale);
      const response =
        cached ||
        (await webSearch.search(cleanQuery, {
          maxResults: Math.min(effectivePolicy.maxResults, effectivePolicy.maxCitations),
          includeNews: true,
          searchDepth:
            effectivePolicy.searchDepth === 'advanced' ? 'advanced' : searchIntent.searchDepth,
          language: args.locale,
        }));
      const resultRows = Array.isArray((response as any)?.results) ? (response as any).results : [];
      const filtered = filterResults(resultRows, effectivePolicy);
      rawResults.push(...(filtered as Array<Record<string, unknown>>));
      if (typeof (response as any)?.answer === 'string' && (response as any).answer.trim()) {
        answers.push(String((response as any).answer).trim());
      }
      if (!cached) {
        setCache(
          cacheNamespace,
          cleanQuery,
          { ...(response as any), query: cleanQuery, results: filtered },
          args.locale
        );
      }
    } catch (error) {
      logger.debug('[VWWebAccess] Query failed', {
        workerSlug: args.workerSlug || null,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const seenUrls = new Set<string>();
  const dedupedResults = rawResults.filter((result) => {
    const url = String(result.url || '').trim();
    if (!url || seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });

  const citations = dedupedResults
    .filter((result) => result.url && result.title)
    .slice(0, effectivePolicy.maxCitations)
    .map(
      (result, index) =>
        ({
          id: `worker_web_${index + 1}`,
          type: 'external',
          title: String(result.title || ''),
          reference: String(result.url || ''),
          link: String(result.url || ''),
          excerpt: String(result.snippet || result.content || '').slice(0, 500),
        }) satisfies WorkerWebCitation
    );

  if (citations.length === 0) {
    return {
      policy: effectivePolicy,
      intent: searchIntent,
      used: false,
      reason: 'No safe web results available',
      queries,
      citations: [],
      answers,
      results: dedupedResults,
      systemInstructionAddon: '',
    };
  }

  const sourcesText = citations
    .map(
      (citation, index) => `[${index + 1}] ${citation.title}\n${citation.link}\n${citation.excerpt}`
    )
    .join('\n\n');
  const answerText =
    answers.length > 0 ? `\n\n## WEB SEARCH SYNTHESIS\n${answers.join('\n\n')}` : '';

  return {
    policy: effectivePolicy,
    intent: searchIntent,
    used: true,
    queries,
    citations,
    answers,
    results: dedupedResults,
    systemInstructionAddon:
      `## GOVERNED WEB SOURCES\n${sourcesText}${answerText}\n\nRules:\n` +
      '- Use web sources only when they materially improve freshness or factual grounding.\n' +
      '- Cite web sources inline with [1], [2] when using them.\n' +
      '- If the web sources conflict with governed product knowledge, say so explicitly and keep both views separated.\n',
  };
}
