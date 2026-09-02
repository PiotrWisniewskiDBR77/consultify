import { getDatabase } from '../../database/Database.js';
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import ragService from '../ragService.js';
import { resolveAnnaPreferredProducts, resolveAnnaSiteConfig } from './annaSiteConfig.js';
import { evaluateRetrievalPolicyDecision } from './chatPolicyGateway.js';

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
  language: string | null;
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

const DBR77_FALLBACK_CONTEXT = `Company: DBR77
DBR77 is the organization behind a portfolio of industrial and transformation products, including Consultify, DBR77 Vector, IRIS, Digital Twin, IIoT and Marketplace. Do not describe DBR77 itself as only a technology ecosystem; separate the company from its individual products and platforms.`;

const IRIS_FALLBACK_CONTEXT = `Product: IRIS
IRIS is the DBR77 intelligence engine for industrial risk scoring, anomaly detection and predictive maintenance. It processes real-time signals from IIoT and Digital Twin to surface operational insights for factory and supply-chain leaders.`;

const DIGITAL_TWIN_FALLBACK_CONTEXT = `Product: Digital Twin
DBR77 Digital Twin creates a virtual replica of physical factory processes, enabling simulation, scenario planning and optimization without disrupting production. It integrates with IIoT data and IRIS analytics.`;

const IIOT_FALLBACK_CONTEXT = `Product: IIoT
DBR77 IIoT is the Industrial Internet of Things connectivity layer that collects real-time sensor and machine data from production lines, feeding it into Digital Twin, IRIS and the broader DBR77 analytics stack.`;

const MARKETPLACE_FALLBACK_CONTEXT = `Product: Marketplace
DBR77 Marketplace is the curated catalog of pre-built transformation modules, integrations and partner solutions that organizations can plug into their Consultify-managed transformation programs.`;

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
  docs: AnnaIndexedDoc[],
  locale?: string
): {
  preferredLanguage: 'pl' | 'en';
  preferredDocs: AnnaIndexedDoc[];
  fallbackDocs: AnnaIndexedDoc[];
} {
  const preferredLanguage = resolveKnowledgeLanguage(locale);
  const preferredDocs: AnnaIndexedDoc[] = [];
  const fallbackDocs: AnnaIndexedDoc[] = [];

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

function detectRequestedProducts(query: string): {
  matchedProducts: string[];
  primaryProducts: string[];
} {
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
      ? uniq([...explicitNonConsultify, 'consultify'])
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

function prioritizeProducts(explicitProducts: string[], baseProducts: string[]): string[] {
  return explicitProducts.length > 0
    ? uniq([...explicitProducts, ...baseProducts])
    : uniq(baseProducts);
}

async function loadIndexedProductDocs(): Promise<AnnaIndexedDoc[]> {
  let rows: AnnaDocRow[];

  const isPg = process.env.DB_TYPE === 'postgres';
  if (isPg) {
    const db = getDatabase();
    const result = await db.query<AnnaDocRow>(
      `SELECT id, filename, metadata FROM knowledge_docs WHERE source_type = $1`,
      ['product_pill']
    );
    rows = result.rows;
  } else {
    rows = (await dbAll(
      `SELECT id, filename, metadata FROM knowledge_docs WHERE source_type = ?`,
      ['product_pill'],
      { fallback: true } as any
    )) as AnnaDocRow[];
  }

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
  // FIX-2 (dyżur 210): deliberately NOT threading a userId here. Anna is the
  // public marketing chatbot — `buildAnnaKnowledgeContext` above calls the
  // policy gateway with `organizationId: 'public'`, `userId: 'anonymous'`;
  // there is no real per-request human identity to take instead of
  // fabricating one (the card explicitly forbids inventing an identity).
  // `docs` here is always sourced from `loadIndexedProductDocs()`, which
  // hard-filters `WHERE source_type = 'product_pill'` — never `scope='user'`
  // Vault-private documents — so the owner-aware exception in
  // `appendKnowledgeDocAccessFilter` has no private doc to apply to on this
  // path regardless.
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
      } satisfies AnnaRagHit;
    })
    .filter((result) => Boolean(result?.content)) as AnnaRagHit[];
}

const FALLBACK_CONTEXT_MAP: Record<string, string> = {
  consultify: CONSULTIFY_FALLBACK_CONTEXT,
  vector: VECTOR_FALLBACK_CONTEXT,
  dbr77: DBR77_FALLBACK_CONTEXT,
  iris: IRIS_FALLBACK_CONTEXT,
  'digital-twin': DIGITAL_TWIN_FALLBACK_CONTEXT,
  iiot: IIOT_FALLBACK_CONTEXT,
  marketplace: MARKETPLACE_FALLBACK_CONTEXT,
};

function buildFallbackHits(primaryProducts: string[]): AnnaRagHit[] {
  const hits: AnnaRagHit[] = [];
  for (const product of primaryProducts) {
    const ctx = FALLBACK_CONTEXT_MAP[product];
    if (ctx) {
      hits.push({
        content: ctx,
        source: `${product}-fallback`,
        similarity: product === 'consultify' ? 0.6 : product === 'vector' ? 0.55 : 0.5,
        productSlug: product,
        language: null,
      });
    }
  }
  return hits;
}

function buildContextText(
  hits: AnnaRagHit[],
  priorityProductName: string,
  crossSellRule: string
): { contextText: string; sources: string[] } {
  if (hits.length === 0) {
    return {
      contextText:
        'No indexed product pills were found. Stay conservative and use only verified public product claims.',
      sources: [],
    };
  }

  const sections: string[] = [
    'ANNA KNOWLEDGE CONTEXT',
    `- Priority: default to ${priorityProductName} first on this landing page.`,
    `- Cross-sell rule: ${crossSellRule}`,
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
  siteKey?: string;
}): Promise<AnnaKnowledgeContextResult> {
  const EMPTY_RESULT: AnnaKnowledgeContextResult = {
    contextText: '',
    matchedProducts: [],
    primaryProducts: [],
    sources: [],
  };

  try {
    const { decision } = await evaluateRetrievalPolicyDecision({
      consumerClass: 'anna',
      query: opts.query,
      organizationId: 'public',
      userId: 'anonymous',
    });
    logger.info(
      `[AnnaKnowledgeService] Policy decision: outcome=${decision.outcome}, allowed=${decision.allowed}`
    );
    if (!decision.allowed) {
      return {
        ...EMPTY_RESULT,
        contextText:
          decision.refusal?.userMessage || 'This query was refused by the policy gateway.',
      };
    }
  } catch (gatewayError: unknown) {
    logger.warn(
      '[AnnaKnowledgeService] Policy gateway failed, blocking retrieval (fail-closed):',
      gatewayError instanceof Error ? gatewayError.message : String(gatewayError)
    );
    return {
      ...EMPTY_RESULT,
      contextText: 'Knowledge retrieval is temporarily unavailable.',
    };
  }

  const originalQuery = String(opts.query || '').trim();
  const baseLimit = Math.min(Math.max(opts.limit || 6, 2), 10);
  const siteConfig = resolveAnnaSiteConfig(opts.siteKey);
  const sitePreferredProducts =
    opts.preferredProducts && opts.preferredProducts.length > 0
      ? uniq(opts.preferredProducts)
      : resolveAnnaPreferredProducts(opts.siteKey);

  const detected = detectRequestedProducts(originalQuery);
  const explicitCrossProductRequest = detected.matchedProducts.some(
    (product) => product !== siteConfig.primaryProductSlug
  );
  const preferredCrossProductRequest = Boolean(
    sitePreferredProducts.some((product) => product !== siteConfig.primaryProductSlug)
  );
  // Always load full DBR77 portfolio context for public Anna (same intent as anna/teresa workers).
  const portfolioMode = true;
  const limit = portfolioMode ? Math.min(Math.max(baseLimit, 8), 10) : baseLimit;
  const explicitProducts = detected.matchedProducts;
  const portfolioProducts = uniq(['dbr77', ...sitePreferredProducts]);
  const primaryProducts = portfolioMode
    ? prioritizeProducts(explicitProducts, portfolioProducts)
    : explicitProducts.length > 0
      ? uniq([...explicitProducts, ...sitePreferredProducts])
      : sitePreferredProducts;
  const preferredLanguage = resolveKnowledgeLanguage(opts.locale);
  const query = portfolioMode
    ? `${originalQuery} consultify vector iris "digital twin" iiot marketplace`
    : originalQuery;

  try {
    const docs = await loadIndexedProductDocs();
    const docsByProduct = groupDocsByProduct(docs);

    const productQueryHints: Record<string, string> = {
      consultify: 'consultify consultinity',
      vector: 'vector',
      dbr77: 'dbr77 dbr ecosystem',
      iris: 'iris',
      'digital-twin': 'digital twin',
      iiot: 'iiot industrial iot',
      marketplace: 'marketplace',
    };

    const portfolioHits = portfolioMode
      ? (
          await Promise.all(
            primaryProducts
              .filter((product) => product !== 'dbr77')
              .map(async (product) => {
                const productDocs = docsByProduct[product] || [];
                const scoped = splitDocsByLanguagePreference(productDocs, opts.locale);
                const hint = productQueryHints[product] || product;
                const preferred = await searchScopedKnowledge(
                  `${hint} ${originalQuery}`,
                  scoped.preferredDocs,
                  1
                );
                if (preferred.length > 0) return preferred;
                return await searchScopedKnowledge(
                  `${hint} ${originalQuery}`,
                  scoped.fallbackDocs,
                  1
                );
              })
          )
        ).flat()
      : [];

    const primaryDocs = primaryProducts.flatMap((product) => docsByProduct[product] || []);
    const allDocs = PRODUCT_ORDER.flatMap((product) => docsByProduct[product] || []);
    const preferredPrimaryDocs = splitDocsByLanguagePreference(primaryDocs, opts.locale);
    const preferredAllDocs = splitDocsByLanguagePreference(allDocs, opts.locale);

    const primaryHits = portfolioMode
      ? []
      : await searchScopedKnowledge(query, preferredPrimaryDocs.preferredDocs, Math.min(limit, 4));
    const shouldExpandBeyondPrimary =
      explicitCrossProductRequest || preferredCrossProductRequest || primaryHits.length === 0;
    const secondaryHits =
      primaryHits.length >= limit ||
      preferredAllDocs.preferredDocs.length === 0 ||
      !shouldExpandBeyondPrimary ||
      portfolioMode
        ? []
        : await searchScopedKnowledge(query, preferredAllDocs.preferredDocs, limit);
    const shouldFallbackAcrossLanguages = primaryHits.length === 0 && secondaryHits.length === 0;
    const fallbackPrimaryHits = shouldFallbackAcrossLanguages
      ? await searchScopedKnowledge(query, preferredPrimaryDocs.fallbackDocs, Math.min(limit, 4))
      : [];
    const fallbackSecondaryHits =
      !shouldFallbackAcrossLanguages ||
      fallbackPrimaryHits.length >= limit ||
      preferredAllDocs.fallbackDocs.length === 0 ||
      !shouldExpandBeyondPrimary ||
      portfolioMode
        ? []
        : await searchScopedKnowledge(query, preferredAllDocs.fallbackDocs, limit);

    const hits = dedupeHits([
      ...portfolioHits,
      ...primaryHits,
      ...secondaryHits,
      ...fallbackPrimaryHits,
      ...fallbackSecondaryHits,
      ...buildFallbackHits(primaryProducts),
    ])
      .sort((a, b) => {
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

    const { contextText: rawContextText, sources } = buildContextText(
      hits,
      siteConfig.primaryProductName,
      siteConfig.crossSellRule
    );
    const contextText = portfolioMode
      ? `${rawContextText}\n\nPORTFOLIO ANSWER RULE\n- If the user asks what DBR77 products you know / what the DBR77 ecosystem includes, explicitly list all public products you can describe: Consultify, DBR77 Vector, IRIS, Digital Twin, IIoT, Marketplace.\n- Keep it concise: 1 line per product.\n- Do not omit products from the list above.\n- You always have the governed product knowledge above; when a question touches any DBR77 product, use it. Do not claim you lack access to that product line.`
      : rawContextText;
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
    const { contextText, sources } = buildContextText(
      fallbackHits,
      siteConfig.primaryProductName,
      siteConfig.crossSellRule
    );
    return {
      contextText,
      matchedProducts: detected.matchedProducts,
      primaryProducts,
      sources,
    };
  }
}

export async function buildAnnaVoiceBootstrap(
  locale?: string,
  siteKey?: string
): Promise<AnnaKnowledgeContextResult> {
  const EMPTY_RESULT: AnnaKnowledgeContextResult = {
    contextText: '',
    matchedProducts: [],
    primaryProducts: [],
    sources: [],
  };

  const siteConfig = resolveAnnaSiteConfig(siteKey);
  const bootstrapQuery = String(locale || '')
    .toLowerCase()
    .startsWith('pl')
    ? `${siteConfig.primaryProductName} czym jest wartosc biznesowa demo trial ROI security DBR77 Vector IRIS Digital Twin IIoT Marketplace ekosystem`
    : `${siteConfig.primaryProductName} overview business value demo trial ROI security DBR77 Vector IRIS Digital Twin IIoT Marketplace ecosystem`;

  try {
    const { decision } = await evaluateRetrievalPolicyDecision({
      consumerClass: 'anna',
      query: bootstrapQuery,
      organizationId: 'public',
      userId: 'anonymous',
    });
    logger.info(
      `[AnnaKnowledgeService] Voice bootstrap policy decision: outcome=${decision.outcome}, allowed=${decision.allowed}`
    );
    if (!decision.allowed) {
      return {
        ...EMPTY_RESULT,
        contextText:
          decision.refusal?.userMessage || 'This query was refused by the policy gateway.',
      };
    }
  } catch (gatewayError: unknown) {
    logger.warn(
      '[AnnaKnowledgeService] Voice bootstrap policy gateway failed (fail-closed):',
      gatewayError instanceof Error ? gatewayError.message : String(gatewayError)
    );
    return {
      ...EMPTY_RESULT,
      contextText: 'Knowledge retrieval is temporarily unavailable.',
    };
  }

  return buildAnnaKnowledgeContext({
    query: bootstrapQuery,
    locale,
    limit: 8,
    preferredProducts: resolveAnnaPreferredProducts(siteKey),
    siteKey,
  });
}
