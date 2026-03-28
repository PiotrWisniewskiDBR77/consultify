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
): Promise<{ docs: IndexedDoc[]; weightMap: Map<string, number> }> {
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
  for (const row of rows || []) {
    const meta = parseMeta(row.metadata);
    const id = String(row.id || '').trim();
    const filename = String(row.filename || '').trim();
    const productSlug = String(meta.product_slug || '').trim();
    if (!id || !filename) continue;

    const matchesProduct = productSlug && productSlugs.includes(productSlug);
    const matchesDocId = docIds.includes(id);
    if (!matchesProduct && !matchesDocId && productSlugs.length > 0) continue;

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
  const query = String(opts.query || '').trim();
  const limit = Math.min(Math.max(opts.limit || 6, 2), 10);
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

  const detectedProducts = detectProducts(query);
  const assignedProductSlugs = uniq(
    assignments.filter((a) => a.product_slug).map((a) => a.product_slug!)
  );

  const defaultProduct = assignedProductSlugs.includes('consultify')
    ? 'consultify'
    : assignedProductSlugs[0] || undefined;

  const explicitAssignedProducts = detectedProducts.filter((p) => assignedProductSlugs.includes(p));
  const primaryProducts =
    explicitAssignedProducts.length > 0
      ? uniq([
          ...explicitAssignedProducts.filter((product) => product !== defaultProduct),
          ...(defaultProduct ? [defaultProduct] : []),
        ])
      : defaultProduct
        ? [defaultProduct]
        : assignedProductSlugs.slice(0, 2);

  try {
    const { docs, weightMap } = await loadWorkerDocs(assignments);

    const primaryDocs = docs.filter((d) => primaryProducts.includes(d.productSlug));
    const languageScopedPrimaryDocs = splitDocsByLanguagePreference(primaryDocs, opts.locale);
    const languageScopedAllDocs = splitDocsByLanguagePreference(docs, opts.locale);
    const preferredDocs =
      languageScopedPrimaryDocs.preferredDocs.length > 0
        ? languageScopedPrimaryDocs.preferredDocs
        : languageScopedAllDocs.preferredDocs;
    const fallbackDocs =
      languageScopedPrimaryDocs.preferredDocs.length > 0
        ? languageScopedPrimaryDocs.fallbackDocs
        : languageScopedAllDocs.fallbackDocs;

    const preferredHits = await searchScoped(query, preferredDocs, limit);
    const hits =
      preferredHits.length > 0 ? preferredHits : await searchScoped(query, fallbackDocs, limit);

    const sorted = hits
      .sort((a, b) => {
        const aWeight = weightMap.get(a.productSlug) ?? 1.0;
        const bWeight = weightMap.get(b.productSlug) ?? 1.0;
        if (aWeight !== bWeight) return bWeight - aWeight;
        const aLanguageScore = scoreLanguagePreference(a.language, preferredLanguage);
        const bLanguageScore = scoreLanguagePreference(b.language, preferredLanguage);
        if (aLanguageScore !== bLanguageScore) return aLanguageScore - bLanguageScore;
        return b.similarity - a.similarity;
      })
      .slice(0, limit);

    const { contextText, sources } = buildContextText(sorted, defaultProduct);
    return {
      contextText,
      matchedProducts: detectedProducts,
      primaryProducts,
      sources,
    };
  } catch (error: unknown) {
    logger.warn('[VWKnowledge] Failed:', error instanceof Error ? error.message : String(error));
    return {
      contextText: 'Knowledge retrieval failed. Stay conservative.',
      matchedProducts: detectedProducts,
      primaryProducts,
      sources: [],
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
      ? 'Consultify czym jest wartosc biznesowa demo trial ROI security DBR77 Vector ekosystem'
      : 'Consultify overview business value demo trial ROI security DBR77 Vector ecosystem';

  return buildWorkerKnowledgeContext({
    workerSlug,
    query: bootstrapQuery,
    locale,
    limit: 5,
  });
}
