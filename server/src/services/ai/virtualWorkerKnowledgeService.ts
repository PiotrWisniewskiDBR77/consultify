/**
 * Virtual Worker Knowledge Service
 *
 * Generalized knowledge retrieval for any virtual worker.
 * Uses governed knowledge pills first, then RAG-scoped docs, then static fallbacks.
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import ragService from '../ragService.js';
import { evaluateRetrievalPolicyDecision } from './chatPolicyGateway.js';
import {
  getWorkerBySlug,
  type KnowledgeAssignment,
  type KnowledgePill,
  listKnowledgeAssignments,
  listKnowledgePills,
} from './virtualWorkerService.js';

type DocRow = {
  id?: string;
  filename?: string;
  metadata?: string | Record<string, unknown> | null;
};

type DocMeta = {
  product_slug?: string;
  pill_id?: string;
  language?: string;
};

type IndexedDoc = {
  id: string;
  filename: string;
  productSlug: string;
  pillId: string | null;
  language: string | null;
};

type RagHit = {
  content: string;
  source: string;
  similarity: number;
  documentId?: string;
  productSlug: string;
  language: string | null;
  pillId?: string | null;
  sectionKey?: string | null;
};

type AssignedPill = {
  pill: KnowledgePill;
  assignment: KnowledgeAssignment;
};

export type WorkerKnowledgeResult = {
  contextText: string;
  matchedProducts: string[];
  primaryProducts: string[];
  sources: string[];
  usedPillIds: string[];
  usedPillSections: string[];
  fallbackReason?: string | null;
};

const PRODUCT_ORDER = [
  'consultify',
  'vector',
  'dbr77',
  'iris',
  'digital-twin',
  'iiot',
  'marketplace',
] as const;

/** Always retrieve full DBR77 portfolio context (pills + RAG) for these workers. */
const WORKER_SLUGS_FULL_PORTFOLIO = new Set(['anna', 'teresa']);

const PRODUCT_MATCHERS: Record<string, RegExp[]> = {
  consultify: [/\bconsultify\b/i, /\bconsultinity\b/i],
  vector: [/\bvector\b/i, /\bllm\b/i, /\blarge language model\b/i],
  dbr77: [/\bdbr77\b/i, /\bdbr\b/i],
  iris: [/\biris\b/i],
  'digital-twin': [/\bdigital twin\b/i, /\bdigital-twin\b/i],
  iiot: [/\biiot\b/i, /\bindustrial iot\b/i],
  marketplace: [/\bmarketplace\b/i],
};

const PRODUCT_FALLBACK_CONTEXTS: Record<string, string> = {
  consultify: `Product: Consultify
Consultify is the main public product priority. It is an AI-powered platform for structured digital transformation work: diagnosis, roadmap building, initiatives, execution support, ROI logic, and reporting. Anna should default to explaining Consultify first, especially for value, adoption, demo, trial, workflow, onboarding, and business impact questions.`,
  vector: `Product: DBR77 Vector
DBR77 Vector is the DBR77 proprietary LLM and industrial reasoning layer. It is positioned as a domain-trained model for factory transformation, industrial operations, digital transformation, deployment flexibility, and enterprise-grade security. In Anna conversations, Vector should be explained mainly as the intelligence layer that can support Consultify and the broader DBR ecosystem.`,
  dbr77: `Company: DBR77
DBR77 is the organization behind a portfolio of industrial and transformation products, including Consultify, DBR77 Vector, IRIS, Digital Twin, IIoT and Marketplace. Do not describe DBR77 itself as only a technology ecosystem; separate the company from its individual products and platforms.`,
  iris: `Product: IRIS
IRIS is the DBR77 intelligence engine for industrial risk scoring, anomaly detection and predictive maintenance. It processes real-time signals from IIoT and Digital Twin to surface operational insights for factory and supply-chain leaders.`,
  'digital-twin': `Product: Digital Twin
DBR77 Digital Twin creates a virtual replica of physical factory processes, enabling simulation, scenario planning and optimization without disrupting production. It integrates with IIoT data and IRIS analytics.`,
  iiot: `Product: IIoT
DBR77 IIoT is the Industrial Internet of Things connectivity layer that collects real-time sensor and machine data from production lines, feeding it into Digital Twin, IRIS and the broader DBR77 analytics stack.`,
  marketplace: `Product: Marketplace
DBR77 Marketplace is the curated catalog of pre-built transformation modules, integrations and partner solutions that organizations can plug into their Consultify-managed transformation programs.`,
};

function parseMeta(raw: DocRow['metadata']): DocMeta {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as DocMeta;
  try {
    return JSON.parse(String(raw)) as DocMeta;
  } catch {
    return {};
  }
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function safeSlice(text: string, maxChars: number): string {
  const value = String(text || '').trim();
  return value.length <= maxChars
    ? value
    : `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function normalizeLanguage(value?: string | null): 'pl' | 'en' | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('pl')) return 'pl';
  if (normalized.startsWith('en')) return 'en';
  return null;
}

function resolveKnowledgeLanguage(locale?: string): 'pl' | 'en' {
  return normalizeLanguage(locale) === 'pl' ? 'pl' : 'en';
}

export function detectProducts(query: string): string[] {
  const matched: string[] = [];
  for (const product of PRODUCT_ORDER) {
    if ((PRODUCT_MATCHERS[product] || []).some((pattern) => pattern.test(query)))
      matched.push(product);
  }
  return matched;
}

function prioritizeProducts(explicitProducts: string[], baseProducts: string[]): string[] {
  return explicitProducts.length > 0
    ? uniq([...explicitProducts, ...baseProducts])
    : uniq(baseProducts);
}

export function isDbR77PortfolioQuestion(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const mentionsDbR = /\bdbr77\b/.test(q) || /\bdbr\b/.test(q);
  // Do not treat the assistant name "Anna" as narrowing the topic — users often
  // address Anna while asking about the full DBR77 portfolio ("Anna, jakie macie produkty?").
  const mentionsConsultifyOrDbR = /\bconsultify\b/.test(q) || mentionsDbR;
  const portfolioKeywords =
    /\bportfolio\b/.test(q) ||
    /\bekosystem\b/.test(q) ||
    /\bprodukty\b/.test(q) ||
    /\bprodukt\b/.test(q) ||
    /\boferta\b/.test(q) ||
    /\bco macie\b/.test(q) ||
    /\bjakie.*(produkty|produkt)\b/.test(q) ||
    /\bjakie znasz\b/.test(q) ||
    /\bco oferujecie\b/.test(q) ||
    /\bwhat.*offer\b/.test(q) ||
    /\bwhat products\b/.test(q) ||
    /\byour products\b/.test(q) ||
    /\bwasze produkty\b/.test(q) ||
    /\bwhat do you (have|know)\b/.test(q) ||
    /\btell me about your\b/.test(q) ||
    /\bopowiedz.*o.*produk\b/.test(q) ||
    /\bprzedstaw.*ofert\b/.test(q);
  return (mentionsDbR && portfolioKeywords) || (portfolioKeywords && !mentionsConsultifyOrDbR);
}

function splitDocsByLanguagePreference(
  docs: IndexedDoc[],
  locale?: string
): { preferredLanguage: 'pl' | 'en'; preferredDocs: IndexedDoc[]; fallbackDocs: IndexedDoc[] } {
  const preferredLanguage = resolveKnowledgeLanguage(locale);
  const preferredDocs: IndexedDoc[] = [];
  const fallbackDocs: IndexedDoc[] = [];

  for (const doc of docs) {
    const language = normalizeLanguage(doc.language);
    if (!language || language === preferredLanguage) preferredDocs.push(doc);
    else fallbackDocs.push(doc);
  }

  return { preferredLanguage, preferredDocs, fallbackDocs };
}

function dedupeHits(hits: RagHit[]): RagHit[] {
  const seen = new Set<string>();
  const out: RagHit[] = [];
  for (const hit of hits) {
    const key = `${hit.productSlug}::${hit.source}::${hit.content.slice(0, 180)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function scoreLanguagePreference(language: string | null, preferredLanguage: 'pl' | 'en'): number {
  const normalized = normalizeLanguage(language);
  if (normalized === preferredLanguage) return 0;
  if (!normalized) return 1;
  return 2;
}

function tokenizeQuery(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9ąćęłńóśźż-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

async function safeListWorkerPills(workerId: string): Promise<KnowledgePill[]> {
  try {
    if (typeof listKnowledgePills !== 'function') return [];
    return await listKnowledgePills({ workerId });
  } catch {
    return [];
  }
}

async function loadWorkerDocs(
  assignments: KnowledgeAssignment[]
): Promise<{ docs: IndexedDoc[]; weightMap: Map<string, number> }> {
  const productSlugs = assignments.filter((a) => a.product_slug).map((a) => a.product_slug!);
  const docIds = assignments.filter((a) => a.knowledge_doc_id).map((a) => a.knowledge_doc_id!);
  const pillIds = assignments.filter((a) => a.knowledge_pill_id).map((a) => a.knowledge_pill_id!);
  const weightMap = new Map<string, number>();

  for (const assignment of assignments) {
    if (assignment.product_slug) weightMap.set(assignment.product_slug, assignment.priority_weight);
  }

  const rows = (await dbAll(
    `SELECT id, filename, metadata
     FROM knowledge_docs
     WHERE source_type IN ('product_pill', 'tool_pack')`,
    [],
    { fallback: true } as any
  )) as DocRow[];

  const docs: IndexedDoc[] = [];
  for (const row of rows || []) {
    const meta = parseMeta(row.metadata);
    const id = String(row.id || '').trim();
    const filename = String(row.filename || '').trim();
    const productSlug = String(meta.product_slug || '').trim();
    if (!id || !filename) continue;
    const hasScopedFilters = productSlugs.length > 0 || docIds.length > 0 || pillIds.length > 0;
    const matchesScopedFilter =
      (productSlug && productSlugs.includes(productSlug)) ||
      docIds.includes(id) ||
      (meta.pill_id ? pillIds.includes(String(meta.pill_id)) : false);
    if (hasScopedFilters && !matchesScopedFilter) {
      continue;
    }

    docs.push({
      id,
      filename,
      productSlug: productSlug || 'unknown',
      pillId: meta.pill_id ? String(meta.pill_id) : null,
      language: meta.language ? String(meta.language) : null,
    });
  }

  return { docs, weightMap };
}

async function searchScoped(query: string, docs: IndexedDoc[], limit: number): Promise<RagHit[]> {
  if (docs.length === 0) return [];
  const docById = new Map(docs.map((doc) => [doc.id, doc]));
  // FIX-2 (dyżur 210): deliberately NOT threading a userId here. Virtual
  // workers run under a synthetic identity (`buildWorkerKnowledgeContext`
  // above calls the policy gateway with `userId: 'worker:' + workerSlug`),
  // not a real human requester — the card explicitly forbids fabricating an
  // identity to fill this slot. The docs searched here always come from
  // `WHERE source_type IN ('product_pill', 'tool_pack')` — never
  // `scope='user'` Vault-private documents — so there is nothing for the
  // owner-aware exception in `appendKnowledgeDocAccessFilter` to unlock here.
  const results = await ragService.searchRelevantChunks(query, {
    limit,
    minSimilarity: 0.15,
    documentIds: docs.map((doc) => doc.id),
  });

  return results
    .map((result) => {
      const doc = result.documentId ? docById.get(String(result.documentId)) : null;
      if (!doc) return null;
      return {
        content: String(result.content || '').trim(),
        source: doc.filename,
        similarity: Number(result.similarity || 0),
        documentId: doc.id,
        productSlug: doc.productSlug,
        language: doc.language,
        pillId: doc.pillId,
      } satisfies RagHit;
    })
    .filter((hit) => Boolean(hit?.content)) as RagHit[];
}

function selectSections(
  pill: KnowledgePill,
  assignment: KnowledgeAssignment
): Array<{ key: string; title: string; content: string }> {
  const sections = pill.current_version?.sections || [];
  const selectedKeys = new Set(assignment.section_keys || []);
  return sections
    .filter((section) => {
      if (assignment.usage_mode === 'selected_sections' && selectedKeys.size > 0) {
        return selectedKeys.has(section.section_key);
      }
      return true;
    })
    .map((section) => ({
      key: section.section_key,
      title: section.title || section.section_key,
      content: section.content,
    }));
}

function searchPillHits(
  query: string,
  assignedPills: AssignedPill[],
  primaryProducts: string[]
): { primaryHits: RagHit[]; fallbackOnlyHits: RagHit[] } {
  const tokens = tokenizeQuery(query);
  const primaryHits: RagHit[] = [];
  const fallbackOnlyHits: RagHit[] = [];

  for (const { pill, assignment } of assignedPills) {
    const sections = selectSections(pill, assignment);
    for (const section of sections) {
      const corpus =
        `${pill.title} ${pill.summary || ''} ${section.title} ${section.content}`.toLowerCase();
      const tokenMatches = tokens.reduce(
        (count, token) => count + (corpus.includes(token) ? 1 : 0),
        0
      );
      const productBoost = pill.product_slug && primaryProducts.includes(pill.product_slug) ? 1 : 0;
      const coverage = tokens.length > 0 ? tokenMatches / tokens.length : 0.25;
      const score = Math.min(
        0.99,
        coverage + productBoost * 0.2 + assignment.priority_weight * 0.08
      );
      const excerpt =
        assignment.max_context_chars && assignment.max_context_chars > 0
          ? safeSlice(section.content, assignment.max_context_chars)
          : safeSlice(section.content, 1400);

      const hit: RagHit = {
        content: `${pill.title} / ${section.title}\n${excerpt}`,
        source: `pill:${pill.slug}#${section.key}`,
        similarity: score,
        productSlug: pill.product_slug || assignment.product_slug || 'unknown',
        language: pill.language || null,
        pillId: pill.id,
        sectionKey: section.key,
      };

      if (assignment.usage_mode === 'fallback_only') fallbackOnlyHits.push(hit);
      else if (tokens.length === 0 || tokenMatches > 0 || assignment.usage_mode === 'full_pill') {
        primaryHits.push(hit);
      }
    }
  }

  return {
    primaryHits: primaryHits.sort((a, b) => b.similarity - a.similarity),
    fallbackOnlyHits: fallbackOnlyHits.sort((a, b) => b.similarity - a.similarity),
  };
}

function buildFallbackHits(primaryProducts: string[]): RagHit[] {
  return primaryProducts.flatMap((product) => {
    const context = PRODUCT_FALLBACK_CONTEXTS[product];
    return context
      ? [
          {
            content: context,
            source: `${product}-fallback`,
            similarity: 0.5,
            productSlug: product,
            language: null,
          },
        ]
      : [];
  });
}

function buildContextText(
  hits: RagHit[],
  defaultProduct?: string
): { contextText: string; sources: string[]; usedPillIds: string[]; usedPillSections: string[] } {
  if (hits.length === 0) {
    return {
      contextText:
        'No indexed knowledge was found for this worker. Stay conservative and use only verified public claims.',
      sources: [],
      usedPillIds: [],
      usedPillSections: [],
    };
  }

  const sections: string[] = [
    'WORKER KNOWLEDGE CONTEXT',
    defaultProduct
      ? `- Priority: default to ${defaultProduct}-first answers.`
      : '- Answer based on the knowledge context below.',
    '- Mention other products only when the user asks directly or when they help explain the primary product.',
  ];
  const sources: string[] = [];
  const pillIds: string[] = [];
  const sectionKeys: string[] = [];

  for (const hit of hits) {
    sections.push(
      `[product=${hit.productSlug} | source=${hit.source} | relevance=${hit.similarity.toFixed(2)}]\n${safeSlice(hit.content, 1400)}`
    );
    sources.push(hit.source);
    if (hit.pillId) pillIds.push(hit.pillId);
    if (hit.sectionKey) sectionKeys.push(hit.sectionKey);
  }

  return {
    contextText: sections.join('\n\n'),
    sources: uniq(sources),
    usedPillIds: uniq(pillIds),
    usedPillSections: uniq(sectionKeys),
  };
}

export async function buildWorkerKnowledgeContext(opts: {
  workerSlug: string;
  query: string;
  locale?: string;
  limit?: number;
}): Promise<WorkerKnowledgeResult> {
  const POLICY_REFUSED_RESULT: WorkerKnowledgeResult = {
    contextText: 'Policy gateway refused this query.',
    matchedProducts: [],
    primaryProducts: [],
    sources: [],
    usedPillIds: [],
    usedPillSections: [],
    fallbackReason: 'policy_refused',
  };

  try {
    const { decision } = await evaluateRetrievalPolicyDecision({
      consumerClass: 'worker',
      query: opts.query,
      organizationId: 'system',
      userId: 'worker:' + opts.workerSlug,
    });
    logger.info(
      `[VWKnowledge] Policy decision: outcome=${decision.outcome}, allowed=${decision.allowed}`
    );
    if (!decision.allowed) {
      return POLICY_REFUSED_RESULT;
    }
  } catch (gatewayError: unknown) {
    logger.warn(
      '[VWKnowledge] Policy gateway failed, blocking retrieval (fail-closed):',
      gatewayError instanceof Error ? gatewayError.message : String(gatewayError)
    );
    return POLICY_REFUSED_RESULT;
  }

  const originalQuery = String(opts.query || '').trim();
  const preferredLanguage = resolveKnowledgeLanguage(opts.locale);
  const worker = await getWorkerBySlug(opts.workerSlug);

  if (!worker) {
    logger.warn(`[VWKnowledge] Worker not found: ${opts.workerSlug}`);
    return {
      contextText: 'Worker not configured.',
      matchedProducts: [],
      primaryProducts: [],
      sources: [],
      usedPillIds: [],
      usedPillSections: [],
      fallbackReason: 'worker_not_found',
    };
  }

  const assignments = await listKnowledgeAssignments(worker.id);
  if (assignments.length === 0) {
    return {
      contextText: 'No knowledge assigned to this worker.',
      matchedProducts: [],
      primaryProducts: [],
      sources: [],
      usedPillIds: [],
      usedPillSections: [],
      fallbackReason: 'no_assignments',
    };
  }

  const detectedProducts = detectProducts(originalQuery);
  const forceFullPortfolio = WORKER_SLUGS_FULL_PORTFOLIO.has(opts.workerSlug);
  const portfolioMode = isDbR77PortfolioQuestion(originalQuery);
  const assignedProductSlugs = uniq(
    assignments
      .filter((assignment) => assignment.product_slug)
      .map((assignment) => assignment.product_slug!)
  );
  const allKnownProducts = uniq([
    ...assignedProductSlugs,
    ...(PRODUCT_ORDER as unknown as string[]),
  ]);
  const defaultProduct = assignedProductSlugs.includes('consultify')
    ? 'consultify'
    : assignedProductSlugs[0] || undefined;
  const explicitAssignedProducts = detectedProducts.filter((product) =>
    assignedProductSlugs.includes(product)
  );
  const baseLimit = Math.min(Math.max(opts.limit || 6, 2), 10);
  const limit = portfolioMode ? Math.min(Math.max(baseLimit, 8), 10) : baseLimit;

  const portfolioProducts = uniq([
    'dbr77',
    'consultify',
    'vector',
    'iris',
    'digital-twin',
    'iiot',
    'marketplace',
    ...assignedProductSlugs,
  ]);
  const primaryProducts = portfolioMode
    ? prioritizeProducts(detectedProducts, portfolioProducts)
    : explicitAssignedProducts.length > 0
      ? uniq([
          ...explicitAssignedProducts.filter((product) => product !== defaultProduct),
          ...(defaultProduct ? [defaultProduct] : []),
        ])
      : defaultProduct
        ? [defaultProduct]
        : assignedProductSlugs.slice(0, 2);

  const query = portfolioMode
    ? `${originalQuery} consultify vector iris "digital twin" iiot marketplace`
    : originalQuery;

  const productQueryHints: Record<string, string> = {
    consultify: 'consultify consultinity',
    vector: 'vector',
    dbr77: 'dbr77 dbr ecosystem',
    iris: 'iris',
    'digital-twin': 'digital twin',
    iiot: 'iiot industrial iot',
    marketplace: 'marketplace',
  };

  try {
    const [{ docs: allDocs, weightMap }, pills] = await Promise.all([
      loadWorkerDocs(assignments),
      safeListWorkerPills(worker.id),
    ]);

    const pillById = new Map(pills.map((pill) => [pill.id, pill]));
    const pillByProduct = new Map(pills.map((pill) => [pill.product_slug || '', pill]));
    const assignedPills = assignments
      .map((assignment) => {
        const pill =
          (assignment.knowledge_pill_id ? pillById.get(assignment.knowledge_pill_id) : undefined) ||
          (assignment.product_slug ? pillByProduct.get(assignment.product_slug) : undefined);
        return pill ? ({ pill, assignment } satisfies AssignedPill) : null;
      })
      .filter(Boolean) as AssignedPill[];

    const docsByProduct = new Map<string, IndexedDoc[]>();
    for (const doc of allDocs) {
      const list = docsByProduct.get(doc.productSlug) || [];
      list.push(doc);
      docsByProduct.set(doc.productSlug, list);
    }

    let ragHits: RagHit[] = [];
    const pillHits = searchPillHits(query, assignedPills, primaryProducts);
    ragHits.push(...pillHits.primaryHits.slice(0, Math.max(limit, 8)));

    if (portfolioMode) {
      const portfolioHits = (
        await Promise.all(
          primaryProducts
            .filter((product) => product !== 'dbr77')
            .map(async (product) => {
              const productDocs = docsByProduct.get(product) || [];
              const scoped = splitDocsByLanguagePreference(productDocs, opts.locale);
              const hint = productQueryHints[product] || product;
              const preferred = await searchScoped(
                `${hint} ${originalQuery}`,
                scoped.preferredDocs,
                1
              );
              return preferred.length > 0
                ? preferred
                : searchScoped(`${hint} ${originalQuery}`, scoped.fallbackDocs, 1);
            })
        )
      ).flat();
      ragHits = dedupeHits([...ragHits, ...portfolioHits]);
    } else {
      const primaryDocs = primaryProducts.flatMap((product) => docsByProduct.get(product) || []);
      const scopedPrimary = splitDocsByLanguagePreference(primaryDocs, opts.locale);
      const scopedAll = splitDocsByLanguagePreference(allDocs, opts.locale);
      const preferredDocs =
        scopedPrimary.preferredDocs.length > 0
          ? scopedPrimary.preferredDocs
          : scopedAll.preferredDocs;
      const fallbackDocs =
        scopedPrimary.preferredDocs.length > 0
          ? scopedPrimary.fallbackDocs
          : scopedAll.fallbackDocs;

      const preferredHits = await searchScoped(query, preferredDocs, limit);
      const explicitCrossProduct = detectedProducts.some((product) => product !== 'consultify');
      const shouldExpandBeyondPrimary = explicitCrossProduct || preferredHits.length === 0;

      if (shouldExpandBeyondPrimary && preferredHits.length < limit) {
        const secondaryHits =
          scopedAll.preferredDocs.length > 0
            ? await searchScoped(query, scopedAll.preferredDocs, limit)
            : [];
        const fallbackHits =
          preferredHits.length === 0 &&
          secondaryHits.length === 0 &&
          scopedAll.fallbackDocs.length > 0
            ? await searchScoped(query, scopedAll.fallbackDocs, limit)
            : [];
        ragHits = dedupeHits([...ragHits, ...preferredHits, ...secondaryHits, ...fallbackHits]);
      } else {
        const preferredOrFallback =
          preferredHits.length > 0 ? preferredHits : await searchScoped(query, fallbackDocs, limit);
        ragHits = dedupeHits([...ragHits, ...preferredOrFallback]);
      }
    }

    if (ragHits.length === 0 && pillHits.fallbackOnlyHits.length > 0) {
      ragHits = dedupeHits([...pillHits.fallbackOnlyHits, ...ragHits]);
    }

    const fallbackProducts = portfolioMode ? allKnownProducts : primaryProducts;
    ragHits = dedupeHits([...ragHits, ...buildFallbackHits(fallbackProducts)]);

    const explicitPriority = new Map(detectedProducts.map((product, index) => [product, index]));
    const sorted = ragHits
      .sort((a, b) => {
        if (explicitPriority.size > 0) {
          const aExplicit = explicitPriority.has(a.productSlug)
            ? (explicitPriority.get(a.productSlug) as number)
            : explicitPriority.size + 1;
          const bExplicit = explicitPriority.has(b.productSlug)
            ? (explicitPriority.get(b.productSlug) as number)
            : explicitPriority.size + 1;
          if (aExplicit !== bExplicit) return aExplicit - bExplicit;
        }
        const aPriority = primaryProducts.indexOf(a.productSlug);
        const bPriority = primaryProducts.indexOf(b.productSlug);
        const aScore = aPriority >= 0 ? aPriority : primaryProducts.length + 1;
        const bScore = bPriority >= 0 ? bPriority : primaryProducts.length + 1;
        if (aScore !== bScore) return aScore - bScore;
        const aLanguage = scoreLanguagePreference(a.language, preferredLanguage);
        const bLanguage = scoreLanguagePreference(b.language, preferredLanguage);
        if (aLanguage !== bLanguage) return aLanguage - bLanguage;
        const aWeight = weightMap.get(a.productSlug) ?? 1.0;
        const bWeight = weightMap.get(b.productSlug) ?? 1.0;
        if (aWeight !== bWeight) return bWeight - aWeight;
        return b.similarity - a.similarity;
      })
      .slice(0, limit);

    const {
      contextText: rawContextText,
      sources,
      usedPillIds,
      usedPillSections,
    } = buildContextText(sorted, defaultProduct);

    const contextText = portfolioMode
      ? `${rawContextText}\n\nPORTFOLIO ANSWER RULE\n- If the user asks what DBR77 products you know / what the DBR77 ecosystem includes, explicitly list all public products you can describe: Consultify, DBR77 Vector, IRIS, Digital Twin, IIoT, Marketplace.\n- Keep it concise: 1 line per product.\n- Do not omit products from the list above.${
          forceFullPortfolio && portfolioMode
            ? '\n- You always have the governed product knowledge above; when a question touches any DBR77 product, use it. Do not claim you lack access to that product line.'
            : ''
        }`
      : rawContextText;

    return {
      contextText,
      matchedProducts: detectedProducts,
      primaryProducts,
      sources,
      usedPillIds,
      usedPillSections,
      fallbackReason: sorted.some((hit) => !hit.source.endsWith('-fallback'))
        ? null
        : sorted.some((hit) => hit.source.endsWith('-fallback'))
          ? 'fallback_context_only'
          : null,
    };
  } catch (error: unknown) {
    logger.warn('[VWKnowledge] Failed:', error instanceof Error ? error.message : String(error));
    const fallbackHits = buildFallbackHits(primaryProducts);
    const { contextText, sources, usedPillIds, usedPillSections } = buildContextText(
      fallbackHits,
      defaultProduct
    );
    return {
      contextText,
      matchedProducts: detectedProducts,
      primaryProducts,
      sources,
      usedPillIds,
      usedPillSections,
      fallbackReason: 'knowledge_resolution_failed',
    };
  }
}

export async function buildWorkerVoiceBootstrap(
  workerSlug: string,
  locale?: string
): Promise<WorkerKnowledgeResult> {
  const POLICY_REFUSED_RESULT: WorkerKnowledgeResult = {
    contextText: 'Policy gateway refused this query.',
    matchedProducts: [],
    primaryProducts: [],
    sources: [],
    usedPillIds: [],
    usedPillSections: [],
    fallbackReason: 'policy_refused',
  };

  const lang = String(locale || '')
    .toLowerCase()
    .startsWith('pl')
    ? 'pl'
    : 'en';
  const bootstrapQuery =
    lang === 'pl'
      ? 'Consultify czym jest wartosc biznesowa demo trial ROI security DBR77 Vector IRIS Digital Twin IIoT Marketplace ekosystem'
      : 'Consultify overview business value demo trial ROI security DBR77 Vector IRIS Digital Twin IIoT Marketplace ecosystem';

  try {
    const { decision } = await evaluateRetrievalPolicyDecision({
      consumerClass: 'worker',
      query: bootstrapQuery,
      organizationId: 'system',
      userId: 'worker:' + workerSlug,
    });
    logger.info(
      `[VWKnowledge] Voice bootstrap policy decision: outcome=${decision.outcome}, allowed=${decision.allowed}`
    );
    if (!decision.allowed) {
      return POLICY_REFUSED_RESULT;
    }
  } catch (gatewayError: unknown) {
    logger.warn(
      '[VWKnowledge] Voice bootstrap policy gateway failed (fail-closed):',
      gatewayError instanceof Error ? gatewayError.message : String(gatewayError)
    );
    return POLICY_REFUSED_RESULT;
  }

  return buildWorkerKnowledgeContext({
    workerSlug,
    query: bootstrapQuery,
    locale,
    limit: 8,
  });
}
