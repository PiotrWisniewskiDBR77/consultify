import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type {
  RadarContentType,
  RadarDomain,
  RadarDurability,
  RadarImpactLevel,
  RadarProcessedSignal,
  RadarRawItem,
  RadarRelevanceScope,
  RadarSourceRecord,
} from './radarTypes.js';

const ENTITY_HINTS = [
  'OpenAI',
  'Anthropic',
  'Google',
  'Microsoft',
  'AWS',
  'NVIDIA',
  'EU',
  'CISA',
  'Gartner',
  'McKinsey',
  'Deloitte',
  'Stripe',
  'Shopify',
];

const DOMAIN_KEYWORDS: Array<{ domain: RadarDomain; words: string[] }> = [
  { domain: 'AI', words: ['ai', 'agent', 'llm', 'model', 'copilot', 'genai', 'machine learning'] },
  { domain: 'transformation', words: ['transformation', 'operating model', 'digital', 'change'] },
  {
    domain: 'operations',
    words: ['operations', 'workflow', 'supply chain', 'planning', 'quality'],
  },
  { domain: 'product', words: ['product', 'platform', 'roadmap', 'user experience', 'launch'] },
  { domain: 'leadership', words: ['leadership', 'executive', 'management', 'board', 'steering'] },
  {
    domain: 'execution',
    words: ['execution', 'delivery', 'rollout', 'adoption', 'implementation'],
  },
  { domain: 'compliance', words: ['regulation', 'governance', 'compliance', 'policy', 'act'] },
  { domain: 'cyber', words: ['cyber', 'security', 'breach', 'zero trust', 'threat'] },
  { domain: 'market', words: ['market', 'pricing', 'demand', 'benchmark', 'industry'] },
  {
    domain: 'competition',
    words: ['competitor', 'launches', 'partnership', 'acquisition', 'vendor'],
  },
];

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1');
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

function stripHtml(s: string): string {
  return decodeEntities(stripCdata(s))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? String(match[1] || '').trim() : null;
}

function extractAtomLink(entryXml: string): string | null {
  const match = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? String(match[1]).trim() : null;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'ConsultifyRadar/2.0 (+https://consultify.local)',
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function detectLanguage(text: string, fallback = 'en'): string {
  const sample = text.toLowerCase();
  const polishMarkers = [' oraz ', ' jest ', ' się ', ' dla ', ' które ', 'ż', 'ł', 'ą', 'ę'];
  return polishMarkers.some((marker) => sample.includes(marker)) ? 'pl' : fallback;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyContentType(text: string, source: RadarSourceRecord): RadarContentType {
  const haystack = `${source.category} ${source.tags.join(' ')} ${text}`.toLowerCase();
  if (/\b(regulation|act|directive|policy)\b/.test(haystack)) return 'regulation';
  if (/\b(case study|case-study|customer story|success story)\b/.test(haystack))
    return 'case_study';
  if (/\b(how to|how-to|playbook|guide|tutorial)\b/.test(haystack)) return 'how_to';
  if (/\b(checklist|best practice|tool tip|workflow)\b/.test(haystack)) return 'tool_tip';
  if (/\b(opinion|point of view|essay)\b/.test(haystack)) return 'opinion';
  if (/\b(partnership|pricing|launch|acquisition|vendor)\b/.test(haystack))
    return 'competitor_move';
  return 'news';
}

function classifyDomains(text: string, source: RadarSourceRecord): RadarDomain[] {
  const haystack =
    `${source.name} ${source.category} ${source.tags.join(' ')} ${text}`.toLowerCase();
  const domains = DOMAIN_KEYWORDS.filter((entry) =>
    entry.words.some((word) => haystack.includes(word))
  ).map((entry) => entry.domain);
  return domains.length ? Array.from(new Set(domains)) : ['market'];
}

function extractTopics(title: string, summary: string, domains: RadarDomain[]): string[] {
  const phrases = `${title}. ${summary}`
    .split(/[,.]| and | oraz /i)
    .map((part) => part.trim())
    .filter((part) => part.length > 3);
  const topics = phrases.slice(0, 4).map((part) => part.toLowerCase());
  for (const domain of domains) topics.push(domain.toLowerCase());
  return Array.from(new Set(topics)).slice(0, 8);
}

function extractEntities(title: string, summary: string): string[] {
  const haystack = `${title} ${summary}`;
  const entities = ENTITY_HINTS.filter((hint) =>
    haystack.toLowerCase().includes(hint.toLowerCase())
  );
  return Array.from(new Set(entities));
}

function computeFreshnessScore(publishedAt?: string | null): number {
  if (!publishedAt) return 45;
  const publishedTs = Date.parse(publishedAt);
  if (!Number.isFinite(publishedTs)) return 45;
  const ageHours = (Date.now() - publishedTs) / (1000 * 60 * 60);
  if (ageHours <= 12) return 95;
  if (ageHours <= 48) return 84;
  if (ageHours <= 24 * 7) return 72;
  if (ageHours <= 24 * 30) return 60;
  return 42;
}

function classifyDurability(
  contentType: RadarContentType,
  freshnessScore: number
): RadarDurability {
  if (contentType === 'how_to' || contentType === 'tool_tip') return 'evergreen';
  if (freshnessScore >= 85) return 'hot';
  return 'current';
}

function classifyImpactLevel(score: number): RadarImpactLevel {
  if (score >= 78) return 'high';
  if (score >= 48) return 'medium';
  return 'low';
}

function computeImpactScore(contentType: RadarContentType, domains: RadarDomain[]): number {
  let score = 45;
  if (contentType === 'regulation' || contentType === 'competitor_move') score += 20;
  if (contentType === 'case_study' || contentType === 'tool_tip') score += 10;
  if (domains.includes('AI')) score += 10;
  if (domains.includes('operations') || domains.includes('compliance')) score += 10;
  if (domains.includes('competition')) score += 8;
  return Math.min(100, score);
}

function computeActionabilityScore(contentType: RadarContentType, summary: string): number {
  const haystack = summary.toLowerCase();
  let score = 42;
  if (contentType === 'how_to' || contentType === 'tool_tip') score += 30;
  if (contentType === 'case_study') score += 18;
  if (/\b(checklist|steps|playbook|how to|workflow|pilot|rollout)\b/.test(haystack)) score += 15;
  if (/\b(announced|launch|partnership)\b/.test(haystack)) score += 6;
  return Math.min(100, score);
}

function computeRelevanceScope(
  domains: RadarDomain[],
  entities: string[],
  topics: string[]
): RadarRelevanceScope {
  const text = `${domains.join(' ')} ${entities.join(' ')} ${topics.join(' ')}`.toLowerCase();
  if (/\b(role|leadership|ceo|consultant|manager|product)\b/.test(text)) return 'role_specific';
  if (/\b(manufacturing|finance|supply chain|retail|healthcare)\b/.test(text))
    return 'industry_specific';
  if (/\b(roadmap|project|delivery|initiative|rollout)\b/.test(text)) return 'project_specific';
  if (entities.length > 0) return 'company_specific';
  return 'general';
}

function buildDuplicateClusterId(title: string): string {
  return createHash('sha1').update(normalizeTitle(title)).digest('hex').slice(0, 16);
}

function buildContentHash(item: Pick<RadarRawItem, 'title' | 'rawText' | 'canonicalUrl'>): string {
  return createHash('sha1')
    .update(`${normalizeTitle(item.title)}|${item.canonicalUrl}|${item.rawText.slice(0, 600)}`)
    .digest('hex');
}

function parseFeed(xml: string, source: RadarSourceRecord): RadarRawItem[] {
  const blocks =
    /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml)
      ? xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
      : xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const items: RadarRawItem[] = [];
  for (const block of blocks.slice(0, 8)) {
    const title = stripHtml(extractTag(block, 'title') || '');
    const url = isAtom ? extractAtomLink(block) : stripHtml(extractTag(block, 'link') || '');
    const summaryRaw =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content') ||
      '';
    const summary = stripHtml(summaryRaw);
    if (!title || !url) continue;

    const rawItem: RadarRawItem = {
      id: uuidv4(),
      sourceId: source.id,
      title: title.slice(0, 280),
      rawText: summary.slice(0, 12000),
      rawHtml: summaryRaw.slice(0, 12000),
      canonicalUrl: url,
      author: stripHtml(extractTag(block, 'author') || '').slice(0, 200) || null,
      publishedAt:
        stripHtml(
          extractTag(block, 'pubDate') ||
            extractTag(block, 'published') ||
            extractTag(block, 'updated') ||
            ''
        ) || null,
      fetchedAt: new Date().toISOString(),
      language: detectLanguage(`${title} ${summary}`, source.language),
      metadata: {
        sourceName: source.name,
        sourceCategory: source.category,
      },
      contentHash: '',
    };
    rawItem.contentHash = buildContentHash(rawItem);
    items.push(rawItem);
  }
  return items;
}

function mapProcessedRow(row: any): RadarProcessedSignal {
  return {
    id: String(row.id),
    rawItemId: String(row.raw_item_id),
    sourceId: String(row.source_id),
    normalizedTitle: String(row.normalized_title || ''),
    summaryShort: String(row.summary_short || ''),
    summaryLong: String(row.summary_long || ''),
    contentType: String(row.content_type || 'news') as RadarContentType,
    domainTags: parseJsonArray(row.domain_tags_json) as RadarDomain[],
    topicTags: parseJsonArray(row.topic_tags_json),
    entityTags: parseJsonArray(row.entity_tags_json),
    relevanceScope: String(row.relevance_scope || 'general') as RadarRelevanceScope,
    businessImpact: String(row.business_impact || 'medium') as RadarImpactLevel,
    actionability: String(row.actionability || 'medium') as RadarImpactLevel,
    durability: String(row.durability || 'current') as RadarDurability,
    freshnessScore: Number(row.freshness_score || 0),
    impactScore: Number(row.impact_score || 0),
    actionabilityScore: Number(row.actionability_score || 0),
    trustScore: Number(row.trust_score || 0),
    duplicateClusterId: row.duplicate_cluster_id ? String(row.duplicate_cluster_id) : null,
    status: String(row.status || 'processed'),
    signalKind: String(row.signal_kind || 'external') as RadarProcessedSignal['signalKind'],
    metadata: parseJsonObject(row.metadata_json),
    sourceName: row.source_name ? String(row.source_name) : undefined,
    sourceCategory: row.source_category ? String(row.source_category) : undefined,
    sourceTrustScore: row.source_trust_score != null ? Number(row.source_trust_score) : undefined,
    canonicalUrl: row.canonical_url ? String(row.canonical_url) : undefined,
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

function parseJsonArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input))
    return input as Record<string, unknown>;
  if (typeof input !== 'string') return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

class RadarProcessingService {
  async ingestSource(source: RadarSourceRecord): Promise<number> {
    try {
      const xml = await fetchText(source.url, 5000);
      const rawItems = parseFeed(xml, source);
      let processedCount = 0;

      for (const rawItem of rawItems) {
        const existing = await queryHelpers.queryOne<{ id: string }>(
          `SELECT id
           FROM radar_raw_items
           WHERE source_id = ? AND canonical_url = ?`,
          [source.id, rawItem.canonicalUrl]
        );

        const rawItemId = existing?.id || rawItem.id;
        if (!existing) {
          await queryHelpers.queryRun(
            `INSERT INTO radar_raw_items (
              id, source_id, title, raw_text, raw_html, canonical_url, author,
              published_at, fetched_at, language, metadata_json, content_hash, processing_status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
            [
              rawItem.id,
              rawItem.sourceId,
              rawItem.title,
              rawItem.rawText,
              rawItem.rawHtml || null,
              rawItem.canonicalUrl,
              rawItem.author || null,
              rawItem.publishedAt || null,
              rawItem.fetchedAt,
              rawItem.language || source.language,
              JSON.stringify(rawItem.metadata || {}),
              rawItem.contentHash || null,
            ]
          );
        } else {
          await queryHelpers.queryRun(
            `UPDATE radar_raw_items
             SET title = ?, raw_text = ?, raw_html = ?, author = ?, published_at = ?,
                 fetched_at = ?, language = ?, metadata_json = ?, content_hash = ?,
                 processing_status = 'pending', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              rawItem.title,
              rawItem.rawText,
              rawItem.rawHtml || null,
              rawItem.author || null,
              rawItem.publishedAt || null,
              rawItem.fetchedAt,
              rawItem.language || source.language,
              JSON.stringify(rawItem.metadata || {}),
              rawItem.contentHash || null,
              rawItemId,
            ]
          );
        }

        await this.processRawItem(rawItemId, source);
        processedCount += 1;
      }

      return processedCount;
    } catch (error: any) {
      logger.warn(`[RadarProcessing] Source ingest failed for ${source.name}: ${error?.message}`);
      return 0;
    }
  }

  async processRawItem(
    rawItemId: string,
    source: RadarSourceRecord
  ): Promise<RadarProcessedSignal | null> {
    const rawItem = await queryHelpers.queryOne<any>(`SELECT * FROM radar_raw_items WHERE id = ?`, [
      rawItemId,
    ]);
    if (!rawItem) return null;

    const normalizedTitle = normalizeTitle(String(rawItem.title || ''));
    const summaryShort = String(rawItem.raw_text || '')
      .slice(0, 280)
      .trim();
    const summaryLong = String(rawItem.raw_text || '')
      .slice(0, 1600)
      .trim();
    const domains = classifyDomains(`${rawItem.title} ${summaryLong}`, source);
    const topics = extractTopics(String(rawItem.title || ''), summaryShort, domains);
    const entities = extractEntities(String(rawItem.title || ''), summaryShort);
    const contentType = classifyContentType(`${rawItem.title} ${summaryLong}`, source);
    const freshnessScore = computeFreshnessScore(
      rawItem.published_at ? String(rawItem.published_at) : null
    );
    const impactScore = computeImpactScore(contentType, domains);
    const actionabilityScore = computeActionabilityScore(contentType, summaryShort);
    const trustScore = Math.round(source.trustScore * 100);
    const duplicateKey = buildDuplicateClusterId(String(rawItem.title || ''));
    const existingDuplicate = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id
       FROM radar_processed_signals
       WHERE duplicate_cluster_id = ?
          OR normalized_title = ?
       LIMIT 1`,
      [duplicateKey, normalizedTitle]
    );
    const duplicateClusterId = existingDuplicate ? duplicateKey : null;
    const durability = classifyDurability(contentType, freshnessScore);
    const relevanceScope = computeRelevanceScope(domains, entities, topics);
    const businessImpact = classifyImpactLevel(impactScore);
    const actionability = classifyImpactLevel(actionabilityScore);
    const processedId = uuidv4();
    const existingProcessed = await queryHelpers.queryOne<{ metadata_json?: string }>(
      `SELECT metadata_json FROM radar_processed_signals WHERE raw_item_id = ?`,
      [rawItemId]
    );
    const existingMetadata = parseJsonObject(existingProcessed?.metadata_json);
    const mergedMetadata = {
      ...existingMetadata,
      originalTitle: rawItem.title,
      sourceName: source.name,
      sourceCategory: source.category,
      canonicalUrl: rawItem.canonical_url,
      publishedAt: rawItem.published_at,
      sourceLanguage: rawItem.language || source.language || 'en',
      contentHash: rawItem.content_hash || '',
    };

    await queryHelpers.queryRun(
      `INSERT INTO radar_processed_signals (
        id, raw_item_id, source_id, normalized_title, summary_short, summary_long, content_type,
        domain_tags_json, topic_tags_json, entity_tags_json, relevance_scope, business_impact,
        actionability, durability, freshness_score, impact_score, actionability_score,
        trust_score, duplicate_cluster_id, status, signal_kind, metadata_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', 'external', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(raw_item_id) DO UPDATE SET
        normalized_title = excluded.normalized_title,
        summary_short = excluded.summary_short,
        summary_long = excluded.summary_long,
        content_type = excluded.content_type,
        domain_tags_json = excluded.domain_tags_json,
        topic_tags_json = excluded.topic_tags_json,
        entity_tags_json = excluded.entity_tags_json,
        relevance_scope = excluded.relevance_scope,
        business_impact = excluded.business_impact,
        actionability = excluded.actionability,
        durability = excluded.durability,
        freshness_score = excluded.freshness_score,
        impact_score = excluded.impact_score,
        actionability_score = excluded.actionability_score,
        trust_score = excluded.trust_score,
        duplicate_cluster_id = excluded.duplicate_cluster_id,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        updated_at = CURRENT_TIMESTAMP`,
      [
        processedId,
        rawItemId,
        source.id,
        normalizedTitle,
        summaryShort,
        summaryLong,
        contentType,
        JSON.stringify(domains),
        JSON.stringify(topics),
        JSON.stringify(entities),
        relevanceScope,
        businessImpact,
        actionability,
        durability,
        freshnessScore,
        impactScore,
        actionabilityScore,
        trustScore,
        duplicateClusterId,
        JSON.stringify(mergedMetadata),
      ]
    );

    await queryHelpers.queryRun(
      `UPDATE radar_raw_items SET processing_status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [rawItemId]
    );

    return await this.getProcessedSignalByRawItem(rawItemId);
  }

  async getProcessedSignalByRawItem(rawItemId: string): Promise<RadarProcessedSignal | null> {
    const row = await queryHelpers.queryOne<any>(
      `SELECT ps.*, rs.name AS source_name, rs.category AS source_category, rs.trust_score AS source_trust_score,
              r.canonical_url, r.published_at
       FROM radar_processed_signals ps
       JOIN radar_sources rs ON rs.id = ps.source_id
       JOIN radar_raw_items r ON r.id = ps.raw_item_id
       WHERE ps.raw_item_id = ?`,
      [rawItemId]
    );
    return row ? mapProcessedRow(row) : null;
  }

  async listSignals(limit = 80): Promise<RadarProcessedSignal[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT ps.*, rs.name AS source_name, rs.category AS source_category, rs.trust_score AS source_trust_score,
              r.canonical_url, r.published_at
       FROM radar_processed_signals ps
       JOIN radar_sources rs ON rs.id = ps.source_id
       JOIN radar_raw_items r ON r.id = ps.raw_item_id
       WHERE ps.status = 'processed'
       ORDER BY ps.freshness_score DESC, ps.impact_score DESC, ps.updated_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(mapProcessedRow);
  }

  async getSignalById(signalId: string): Promise<RadarProcessedSignal | null> {
    const row = await queryHelpers.queryOne<any>(
      `SELECT ps.*, rs.name AS source_name, rs.category AS source_category, rs.trust_score AS source_trust_score,
              r.canonical_url, r.published_at
       FROM radar_processed_signals ps
       JOIN radar_sources rs ON rs.id = ps.source_id
       JOIN radar_raw_items r ON r.id = ps.raw_item_id
       WHERE ps.id = ?
       LIMIT 1`,
      [signalId]
    );
    return row ? mapProcessedRow(row) : null;
  }
}

export const radarProcessingService = new RadarProcessingService();
