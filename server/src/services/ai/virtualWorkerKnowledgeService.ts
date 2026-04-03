/**
 * Virtual Worker Knowledge Service
 *
 * Generalized knowledge retrieval for any virtual worker.
 * Replaces the Anna-specific annaKnowledgeService with a worker-aware version.
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import ragService from '../ragService.js';
import {
  getWorkerBySlug,
  type KnowledgeAssignment,
  listKnowledgeAssignments,
} from './virtualWorkerService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
};

export type WorkerKnowledgeResult = {
  contextText: string;
  matchedProducts: string[];
  primaryProducts: string[];
  sources: string[];
};

// ---------------------------------------------------------------------------
// Product detection
// ---------------------------------------------------------------------------

const PRODUCT_ORDER = [
  'consultify',
  'vector',
  'dbr77',
  'iris',
  'digital-twin',
  'iiot',
  'marketplace',
] as const;

const PRODUCT_MATCHERS: Record<string, RegExp[]> = {
  consultify: [/\bconsultify\b/i, /\bconsultinity\b/i],
  vector: [/\bvector\b/i, /\bllm\b/i, /\blarge language model\b/i],
  dbr77: [/\bdbr77\b/i, /\bdbr\b/i],
  iris: [/\biris\b/i],
  'digital-twin': [/\bdigital twin\b/i, /\bdigital-twin\b/i],
  iiot: [/\biiot\b/i, /\bindustrial iot\b/i],
  marketplace: [/\bmarketplace\b/i],
};

function detectProducts(query: string): string[] {
  const matched: string[] = [];
  for (const product of PRODUCT_ORDER) {
    if ((PRODUCT_MATCHERS[product] || []).some((r) => r.test(query))) {
      matched.push(product);
    }
  }
  return matched;
}

function isDbR77PortfolioQuestion(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const mentionsDbR = /\bdbr77\b/.test(q) || /\bdbr\b/.test(q);
  const mentionsAnnaOrProduct =
    /\banna\b/.test(q) || /\bconsultify\b/.test(q) || mentionsDbR;

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

  if (mentionsDbR && portfolioKeywords) return true;
  if (portfolioKeywords && !mentionsAnnaOrProduct) return true;
  return false;
}

const PRODUCT_FALLBACK_CONTEXTS: Record<string, string> = {
  consultify: `Product: Consultify
Consultify is the main public product priority. It is an AI-powered platform for structured digital transformation work: diagnosis, roadmap building, initiatives, execution support, ROI logic, and reporting. Anna should default to explaining Consultify first, especially for value, adoption, demo, trial, workflow, onboarding, and business impact questions.`,
  vector: `Product: DBR77 Vector
DBR77 Vector is the DBR77 proprietary LLM and industrial reasoning layer. It is positioned as a domain-trained model for factory transformation, industrial operations, digital transformation, deployment flexibility, and enterprise-grade security. In Anna conversations, Vector should be explained mainly as the intelligence layer that can support Consultify and the broader DBR ecosystem.`,
  dbr77: `Product: DBR77 Ecosystem
DBR77 is presented as one connected system that includes Consultify, Vector, Digital Twin, IIoT, Marketplace, IRIS and other operational products. The priority in public conversations is still Consultify first. Other DBR products should be introduced when the user asks directly or when they help explain how Consultify creates business value.`,
  iris: `Product: IRIS
IRIS is the DBR77 intelligence engine for industrial risk scoring, anomaly detection and predictive maintenance. It processes real-time signals from IIoT and Digital Twin to surface operational insights for factory and supply-chain leaders.`,
  'digital-twin': `Product: Digital Twin
DBR77 Digital Twin creates a virtual replica of physical factory processes, enabling simulation, scenario planning and optimization without disrupting production. It integrates with IIoT data and IRIS analytics.`,
  iiot: `Product: IIoT
DBR77 IIoT is the Industrial Internet of Things connectivity layer that collects real-time sensor and machine data from production lines, feeding it into Digital Twin, IRIS and the broader DBR77 analytics stack.`,
  marketplace: `Product: Marketplace
DBR77 Marketplace is the curated catalog of pre-built transformation modules, integrations and partner solutions that organizations can plug into their Consultify-managed transformation programs.`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const v = String(text || '').trim();
  return v.length <= maxChars ? v : v.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
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

function splitDocsByLanguagePreference(
  docs: IndexedDoc[],
  locale?: string
): {
  preferredLanguage: 'pl' | 'en';
  preferredDocs: IndexedDoc[];
  fallbackDocs: IndexedDoc[];
} {
  const preferredLanguage = resolveKnowledgeLanguage(locale);
  const preferredDocs: IndexedDoc[] = [];
  const fallbackDocs: IndexedDoc[] = [];

  for (const doc of docs) {
    const docLanguage = normalizeLanguage(doc.language);
    if (!docLanguage || docLanguage === preferredLanguage) {
      preferredDocs.push(doc);
      continue;
    }
    fallbackDocs.push(doc);
  }

  return {
    preferredLanguage,
    preferredDocs,
    fallbackDocs,
  };
}

function dedupeHits(hits: RagHit[]): RagHit[] {
  const seen = new Set<string>();
  const out: RagHit[] = [];
  for (const hit of hits) {
    const key = `${hit.productSlug}::${hit.source}::${hit.content.slice(0, 160)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function scoreLanguagePreference(language: string | null, preferredLanguage: 'pl' | 'en'): number {
  const normalizedLanguage = normalizeLanguage(language);
  if (normalizedLanguage === preferredLanguage) return 0;
  if (!normalizedLanguage) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Core: load docs scoped to a worker's knowledge assignments
// ---------------------------------------------------------------------------

async function loadWorkerDocs(
  assignments: KnowledgeAssignment[]
): Promise<{ docs: IndexedDoc[]; assignedDocs: IndexedDoc[]; weightMap: Map<string, number> }> {
  const productSlugs = assignments
    .filter((a) => a.knowledge_source_type === 'product_pill' && a.product_slug)
    .map((a) => a.product_slug!);

  const docIds = assignments.filter((a) => a.knowledge_doc_id).map((a) => a.knowledge_doc_id!);

  const weightMap = new Map<string, number>();
  for (const a of assignments) {
    if (a.product_slug) weightMap.set(a.product_slug, a.priority_weight);
  }

  const rows = (await dbAll(
    `SELECT id, filename, metadata FROM knowledge_docs WHERE source_type IN ('product_pill', 'tool_pack')`,
    [],
    { fallback: true } as any
  )) as DocRow[];

  const docs: IndexedDoc[] = [];
  const assignedDocs: IndexedDoc[] = [];
  for (const row of rows || []) {
    const meta = parseMeta(row.metadata);
    const id = String(row.id || '').trim();
    const filename = String(row.filename || '').trim();
    const productSlug = String(meta.product_slug || '').trim();
    if (!id || !filename) continue;

    const doc: IndexedDoc = {
      id,
      filename,
      productSlug: productSlug || 'unknown',
      pillId: meta.pill_id ? String(meta.pill_id) : null,
      language: meta.language ? String(meta.language) : null,
    };

    docs.push(doc);

    const matchesProduct = productSlug && productSlugs.includes(productSlug);
    const matchesDocId = docIds.includes(id);
    if (matchesProduct || matchesDocId || productSlugs.length === 0) {
      assignedDocs.push(doc);
    }
  }

  return { docs, assignedDocs, weightMap };
}

// ---------------------------------------------------------------------------
// RAG search scoped to specific docs
// ---------------------------------------------------------------------------

async function searchScoped(query: string, docs: IndexedDoc[], limit: number): Promise<RagHit[]> {
  if (docs.length === 0) return [];

  const docById = new Map(docs.map((d) => [d.id, d]));
  const results = await ragService.searchRelevantChunks(query, {
    limit,
    minSimilarity: 0.15,
    documentIds: docs.map((d) => d.id),
  });

  return results
    .map((r) => {
      const doc = r.documentId ? docById.get(String(r.documentId)) : null;
      if (!doc) return null;
      return {
        content: String(r.content || '').trim(),
        source: doc.filename,
        similarity: Number(r.similarity || 0),
        documentId: doc.id,
        productSlug: doc.productSlug,
        language: doc.language,
      } satisfies RagHit;
    })
    .filter((r) => Boolean(r?.content)) as RagHit[];
}

// ---------------------------------------------------------------------------
// Build context text
// ---------------------------------------------------------------------------

function buildFallbackHits(primaryProducts: string[]): RagHit[] {
  const hits: RagHit[] = [];
  for (const product of primaryProducts) {
    const ctx = PRODUCT_FALLBACK_CONTEXTS[product];
    if (ctx) {
      hits.push({
        content: ctx,
        source: `${product}-fallback`,
        similarity: 0.5,
        productSlug: product,
        language: null,
      });
    }
  }
  return hits;
}

function buildContextText(
  hits: RagHit[],
  defaultProduct?: string
): { contextText: string; sources: string[] } {
  if (hits.length === 0) {
    return {
      contextText:
        'No indexed knowledge was found for this worker. Stay conservative and use only verified public claims.',
      sources: [],
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
  for (const hit of hits) {
    sections.push(
      `[product=${hit.productSlug} | source=${hit.source} | relevance=${hit.similarity.toFixed(2)}]\n${safeSlice(hit.content, 1400)}`
    );
    sources.push(hit.source);
  }

  return { contextText: sections.join('\n\n'), sources: uniq(sources) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildWorkerKnowledgeContext(opts: {
  workerSlug: string;
  query: string;
  locale?: string;
  limit?: number;
}): Promise<WorkerKnowledgeResult> {
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
    };
  }

  const assignments = await listKnowledgeAssignments(worker.id);
  if (assignments.length === 0) {
    return {
      contextText: 'No knowledge assigned to this worker.',
      matchedProducts: [],
      primaryProducts: [],
      sources: [],
    };
  }

  const portfolioMode = isDbR77PortfolioQuestion(originalQuery);
  const detectedProducts = detectProducts(originalQuery);
  const assignedProductSlugs = uniq(
    assignments.filter((a) => a.product_slug).map((a) => a.product_slug!)
  );

  const allKnownProducts: string[] = uniq([
    ...assignedProductSlugs,
    ...(PRODUCT_ORDER as unknown as string[]),
  ]);

  const defaultProduct = assignedProductSlugs.includes('consultify')
    ? 'consultify'
    : assignedProductSlugs[0] || undefined;

  const explicitAssignedProducts = detectedProducts.filter((p) => assignedProductSlugs.includes(p));
  const baseLimit = Math.min(Math.max(opts.limit || 6, 2), 10);
  const limit = portfolioMode ? Math.min(Math.max(baseLimit, 8), 10) : baseLimit;

  const primaryProducts = portfolioMode
    ? uniq([
        'dbr77',
        'consultify',
        'vector',
        'iris',
        'digital-twin',
        'iiot',
        'marketplace',
        ...assignedProductSlugs,
      ])
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
    iris: 'iris',
    'digital-twin': 'digital twin',
    iiot: 'iiot industrial iot',
    marketplace: 'marketplace',
  };

  try {
    const { docs: allDocs, weightMap } = await loadWorkerDocs(assignments);

    const docsByProduct = new Map<string, IndexedDoc[]>();
    for (const doc of allDocs) {
      const existing = docsByProduct.get(doc.productSlug) || [];
      existing.push(doc);
      docsByProduct.set(doc.productSlug, existing);
    }

    let ragHits: RagHit[] = [];

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
              if (preferred.length > 0) return preferred;
              return searchScoped(`${hint} ${originalQuery}`, scoped.fallbackDocs, 1);
            })
        )
      ).flat();
      ragHits = portfolioHits;
    } else {
      const primaryDocs = primaryProducts.flatMap((p) => docsByProduct.get(p) || []);
      const languageScopedPrimaryDocs = splitDocsByLanguagePreference(primaryDocs, opts.locale);
      const languageScopedAllDocs = splitDocsByLanguagePreference(allDocs, opts.locale);
      const preferredDocs =
        languageScopedPrimaryDocs.preferredDocs.length > 0
          ? languageScopedPrimaryDocs.preferredDocs
          : languageScopedAllDocs.preferredDocs;
      const fallbackDocs =
        languageScopedPrimaryDocs.preferredDocs.length > 0
          ? languageScopedPrimaryDocs.fallbackDocs
          : languageScopedAllDocs.fallbackDocs;

      const preferredHits = await searchScoped(query, preferredDocs, limit);

      const explicitCrossProduct = detectedProducts.some((p) => p !== 'consultify');
      const shouldExpandBeyondPrimary = explicitCrossProduct || preferredHits.length === 0;

      if (shouldExpandBeyondPrimary && preferredHits.length < limit) {
        const allPreferredDocs = languageScopedAllDocs.preferredDocs;
        const secondaryHits =
          allPreferredDocs.length > 0
            ? await searchScoped(query, allPreferredDocs, limit)
            : [];
        const allFallbackDocs = languageScopedAllDocs.fallbackDocs;
        const fallbackHits =
          preferredHits.length === 0 && secondaryHits.length === 0 && allFallbackDocs.length > 0
            ? await searchScoped(query, allFallbackDocs, limit)
            : [];
        ragHits = dedupeHits([...preferredHits, ...secondaryHits, ...fallbackHits]);
      } else {
        ragHits =
          preferredHits.length > 0
            ? preferredHits
            : await searchScoped(query, fallbackDocs, limit);
      }
    }

    const fallbackProducts = portfolioMode ? allKnownProducts : primaryProducts;
    ragHits = dedupeHits([...ragHits, ...buildFallbackHits(fallbackProducts)]);

    const sorted = ragHits
      .sort((a, b) => {
        const aWeight = weightMap.get(a.productSlug) ?? 1.0;
        const bWeight = weightMap.get(b.productSlug) ?? 1.0;
        if (aWeight !== bWeight) return bWeight - aWeight;
        const aPriority = primaryProducts.indexOf(a.productSlug);
        const bPriority = primaryProducts.indexOf(b.productSlug);
        const aScore = aPriority >= 0 ? aPriority : primaryProducts.length + 1;
        const bScore = bPriority >= 0 ? bPriority : primaryProducts.length + 1;
        if (aScore !== bScore) return aScore - bScore;
        const aLanguageScore = scoreLanguagePreference(a.language, preferredLanguage);
        const bLanguageScore = scoreLanguagePreference(b.language, preferredLanguage);
        if (aLanguageScore !== bLanguageScore) return aLanguageScore - bLanguageScore;
        return b.similarity - a.similarity;
      })
      .slice(0, limit);

    const { contextText: rawContextText, sources } = buildContextText(sorted, defaultProduct);
    const contextText = portfolioMode
      ? `${rawContextText}\n\nPORTFOLIO ANSWER RULE\n- If the user asks what DBR77 products you know / what the DBR77 ecosystem includes, explicitly list all public products you can describe: Consultify, DBR77 Vector, IRIS, Digital Twin, IIoT, Marketplace.\n- Keep it concise: 1 line per product.\n- Do not omit products from the list above.`
      : rawContextText;

    return {
      contextText,
      matchedProducts: detectedProducts,
      primaryProducts,
      sources,
    };
  } catch (error: unknown) {
    logger.warn('[VWKnowledge] Failed:', error instanceof Error ? error.message : String(error));
    const fallbackHits = buildFallbackHits(primaryProducts);
    const { contextText, sources } = buildContextText(fallbackHits, defaultProduct);
    return {
      contextText,
      matchedProducts: detectedProducts,
      primaryProducts,
      sources,
    };
  }
}

export async function buildWorkerVoiceBootstrap(
  workerSlug: string,
  locale?: string
): Promise<WorkerKnowledgeResult> {
  const lang = String(locale || '')
    .toLowerCase()
    .startsWith('pl')
    ? 'pl'
    : 'en';
  const bootstrapQuery =
    lang === 'pl'
      ? 'Consultify czym jest wartosc biznesowa demo trial ROI security DBR77 Vector IRIS Digital Twin IIoT Marketplace ekosystem'
      : 'Consultify overview business value demo trial ROI security DBR77 Vector IRIS Digital Twin IIoT Marketplace ecosystem';

  return buildWorkerKnowledgeContext({
    workerSlug,
    query: bootstrapQuery,
    locale,
    limit: 8,
  });
}
