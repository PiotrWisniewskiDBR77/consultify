import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import ragService from '../ragService.js';

type AnnaDocRow = {
  id?: string;
  filename?: string;
  metadata?: string | Record<string, unknown> | null;
};

type AnnaDocMeta = {
  product_slug?: string;
  pill_id?: string;
  language?: string;
};

type AnnaIndexedDoc = {
  id: string;
  filename: string;
  productSlug: string;
  pillId: string | null;
  language: string | null;
};

type AnnaRagHit = {
  content: string;
  source: string;
  similarity: number;
  documentId?: string;
  productSlug: string;
};

type AnnaKnowledgeContextResult = {
  contextText: string;
  matchedProducts: string[];
  primaryProducts: string[];
  sources: string[];
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

const PRODUCT_MATCHERS: Record<string, RegExp[]> = {
  consultify: [/\bconsultify\b/i, /\bconsultinity\b/i],
  vector: [/\bvector\b/i, /\bllm\b/i, /\blarge language model\b/i, /\bmodel\b/i],
  dbr77: [/\bdbr77\b/i, /\bdbr\b/i],
  iris: [/\biris\b/i],
  'digital-twin': [/\bdigital twin\b/i, /\bdigital-twin\b/i, /\bdt\b/i],
  iiot: [/\biiot\b/i, /\biiot\b/i, /\bindustrial iot\b/i, /\biot\b/i],
  marketplace: [/\bmarketplace\b/i],
};

const VECTOR_FALLBACK_CONTEXT = `Product: DBR77 Vector
DBR77 Vector is the DBR77 proprietary LLM and industrial reasoning layer. It is positioned as a domain-trained model for factory transformation, industrial operations, digital transformation, deployment flexibility, and enterprise-grade security. In Anna conversations, Vector should be explained mainly as the intelligence layer that can support Consultify and the broader DBR ecosystem.`;

const CONSULTIFY_FALLBACK_CONTEXT = `Product: Consultify
Consultify is the main public product priority. It is an AI-powered platform for structured digital transformation work: diagnosis, roadmap building, initiatives, execution support, ROI logic, and reporting. Anna should default to explaining Consultify first, especially for value, adoption, demo, trial, workflow, onboarding, and business impact questions.`;

const DBR77_FALLBACK_CONTEXT = `Product: DBR77 Ecosystem
DBR77 is presented as one connected system that includes Consultify, Vector, Digital Twin, IIoT, Marketplace, and other operational products. The priority in public conversations is still Consultify first. Other DBR products should be introduced when the user asks directly or when they help explain how Consultify creates business value.`;

function parseMeta(raw: AnnaDocRow['metadata']): AnnaDocMeta {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as AnnaDocMeta;
  try {
    return JSON.parse(String(raw)) as AnnaDocMeta;
  } catch {
    return {};
  }
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function safeSlice(text: string, maxChars: number): string {
  const value = String(text || '').trim();
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

function detectRequestedProducts(query: string): { matchedProducts: string[]; primaryProducts: string[] } {
  const matchedProducts: string[] = [];
  for (const product of PRODUCT_ORDER) {
    const matchers = PRODUCT_MATCHERS[product] || [];
    if (matchers.some((matcher) => matcher.test(query))) {
      matchedProducts.push(product);
    }
  }

  const explicitNonConsultify = matchedProducts.filter((product) => product !== 'consultify');
  const primaryProducts =
    explicitNonConsultify.length > 0
      ? uniq(['consultify', ...explicitNonConsultify])
      : uniq([
          'consultify',
          ...(matchedProducts.includes('vector') ? ['vector'] : []),
          ...(matchedProducts.includes('dbr77') ? ['dbr77'] : []),
        ]);

  return {
    matchedProducts: uniq(matchedProducts),
    primaryProducts,
  };
}

async function loadIndexedProductDocs(): Promise<AnnaIndexedDoc[]> {
  const rows = (await dbAll(
    `SELECT id, filename, metadata FROM knowledge_docs WHERE source_type = ?`,
    ['product_pill'],
    { fallback: true } as any
  )) as AnnaDocRow[];

  return (rows || [])
    .map((row) => {
      const metadata = parseMeta(row.metadata);
      const id = String(row.id || '').trim();
      const filename = String(row.filename || '').trim();
      const productSlug = String(metadata.product_slug || '').trim();
      if (!id || !filename || !productSlug) return null;
      return {
        id,
        filename,
        productSlug,
        pillId: metadata.pill_id ? String(metadata.pill_id) : null,
        language: metadata.language ? String(metadata.language) : null,
      } satisfies AnnaIndexedDoc;
    })
    .filter(Boolean) as AnnaIndexedDoc[];
}

function groupDocsByProduct(docs: AnnaIndexedDoc[]): Record<string, AnnaIndexedDoc[]> {
  return docs.reduce<Record<string, AnnaIndexedDoc[]>>((acc, doc) => {
    acc[doc.productSlug] = acc[doc.productSlug] || [];
    acc[doc.productSlug].push(doc);
    return acc;
  }, {});
}

function dedupeHits(hits: AnnaRagHit[]): AnnaRagHit[] {
  const seen = new Set<string>();
  const out: AnnaRagHit[] = [];

  for (const hit of hits) {
    const key = `${hit.productSlug}::${hit.source}::${hit.content.slice(0, 160)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }

  return out;
}

async function searchScopedKnowledge(
  query: string,
  docs: AnnaIndexedDoc[],
  limit: number
): Promise<AnnaRagHit[]> {
  if (docs.length === 0) return [];

  const docById = new Map(docs.map((doc) => [doc.id, doc]));
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
      } satisfies AnnaRagHit;
    })
    .filter((result) => Boolean(result?.content)) as AnnaRagHit[];
}

function buildFallbackHits(primaryProducts: string[]): AnnaRagHit[] {
  const hits: AnnaRagHit[] = [];

  if (primaryProducts.includes('consultify')) {
    hits.push({
      content: CONSULTIFY_FALLBACK_CONTEXT,
      source: 'consultify-fallback',
      similarity: 0.6,
      productSlug: 'consultify',
    });
  }

  if (primaryProducts.includes('vector')) {
    hits.push({
      content: VECTOR_FALLBACK_CONTEXT,
      source: 'vector-fallback',
      similarity: 0.55,
      productSlug: 'vector',
    });
  }

  if (primaryProducts.includes('dbr77')) {
    hits.push({
      content: DBR77_FALLBACK_CONTEXT,
      source: 'dbr77-fallback',
      similarity: 0.5,
      productSlug: 'dbr77',
    });
  }

  return hits;
}

function buildContextText(hits: AnnaRagHit[]): { contextText: string; sources: string[] } {
  if (hits.length === 0) {
    return {
      contextText:
        'No indexed product pills were found. Stay conservative and use only verified public product claims.',
      sources: [],
    };
  }

  const sections: string[] = [
    'ANNA KNOWLEDGE CONTEXT',
    '- Priority: default to Consultify-first answers.',
    '- Mention other DBR products only when the user asks directly or when they explain how Consultify fits the wider DBR system.',
  ];

  const sources: string[] = [];
  for (const hit of hits) {
    sections.push(
      `[product=${hit.productSlug} | source=${hit.source} | relevance=${hit.similarity.toFixed(2)}]\n${safeSlice(hit.content, 1400)}`
    );
    sources.push(hit.source);
  }

  return {
    contextText: sections.join('\n\n'),
    sources: uniq(sources),
  };
}

export async function buildAnnaKnowledgeContext(opts: {
  query: string;
  locale?: string;
  limit?: number;
  preferredProducts?: string[];
}): Promise<AnnaKnowledgeContextResult> {
  const query = String(opts.query || '').trim();
  const limit = Math.min(Math.max(opts.limit || 6, 2), 10);

  const detected = detectRequestedProducts(query);
  const explicitCrossProductRequest = detected.matchedProducts.some((product) => product !== 'consultify');
  const preferredCrossProductRequest = Boolean(
    opts.preferredProducts?.some((product) => product !== 'consultify')
  );
  const primaryProducts =
    opts.preferredProducts && opts.preferredProducts.length > 0
      ? uniq(['consultify', ...opts.preferredProducts])
      : detected.primaryProducts;

  try {
    const docs = await loadIndexedProductDocs();
    const docsByProduct = groupDocsByProduct(docs);

    const primaryDocs = primaryProducts.flatMap((product) => docsByProduct[product] || []);
    const allDocs = PRODUCT_ORDER.flatMap((product) => docsByProduct[product] || []);

    const primaryHits = await searchScopedKnowledge(query, primaryDocs, Math.min(limit, 4));
    const shouldExpandBeyondPrimary =
      explicitCrossProductRequest || preferredCrossProductRequest || primaryHits.length === 0;
    const secondaryHits =
      primaryHits.length >= limit || allDocs.length === 0 || !shouldExpandBeyondPrimary
        ? []
        : await searchScopedKnowledge(query, allDocs, limit);

    const hits = dedupeHits([...primaryHits, ...secondaryHits, ...buildFallbackHits(primaryProducts)])
      .sort((a, b) => {
        const aPriority = primaryProducts.indexOf(a.productSlug);
        const bPriority = primaryProducts.indexOf(b.productSlug);
        const aScore = aPriority >= 0 ? aPriority : primaryProducts.length + 1;
        const bScore = bPriority >= 0 ? bPriority : primaryProducts.length + 1;
        if (aScore !== bScore) return aScore - bScore;
        return b.similarity - a.similarity;
      })
      .slice(0, limit);

    const { contextText, sources } = buildContextText(hits);
    return {
      contextText,
      matchedProducts: detected.matchedProducts,
      primaryProducts,
      sources,
    };
  } catch (error: unknown) {
    logger.warn(
      '[AnnaKnowledgeService] Failed to build Anna knowledge context:',
      error instanceof Error ? error.message : String(error)
    );

    const fallbackHits = buildFallbackHits(primaryProducts);
    const { contextText, sources } = buildContextText(fallbackHits);
    return {
      contextText,
      matchedProducts: detected.matchedProducts,
      primaryProducts,
      sources,
    };
  }
}

export async function buildAnnaVoiceBootstrap(locale?: string): Promise<AnnaKnowledgeContextResult> {
  const bootstrapQuery =
    String(locale || '').toLowerCase().startsWith('pl')
      ? 'Consultify czym jest wartosc biznesowa demo trial ROI security DBR77 Vector ekosystem'
      : 'Consultify overview business value demo trial ROI security DBR77 Vector ecosystem';

  return buildAnnaKnowledgeContext({
    query: bootstrapQuery,
    locale,
    limit: 5,
    preferredProducts: ['consultify', 'vector', 'dbr77'],
  });
}
