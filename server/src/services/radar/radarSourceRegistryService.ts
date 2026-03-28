import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import type { RadarSourceRecord, RadarSourceType } from './radarTypes.js';

type SeedSource = {
  id: string;
  name: string;
  sourceType: RadarSourceType;
  url: string;
  category: string;
  language: string;
  trustScore: number;
  refreshFrequencyMinutes: number;
  active: boolean;
  tags: string[];
  metadata?: Record<string, unknown>;
};

const DEFAULT_RADAR_SOURCES: SeedSource[] = [
  {
    id: 'radar-openai-news',
    name: 'OpenAI',
    sourceType: 'company_newsroom',
    url: 'https://openrss.org/openai.com/news/rss.xml',
    category: 'ai',
    language: 'en',
    trustScore: 0.96,
    refreshFrequencyMinutes: 180,
    active: true,
    tags: ['AI', 'vendor', 'models'],
  },
  {
    id: 'radar-anthropic-news',
    name: 'Anthropic',
    sourceType: 'company_newsroom',
    url: 'https://openrss.org/www.anthropic.com/news',
    category: 'ai',
    language: 'en',
    trustScore: 0.95,
    refreshFrequencyMinutes: 180,
    active: true,
    tags: ['AI', 'vendor', 'governance'],
  },
  {
    id: 'radar-google-ai-blog',
    name: 'Google AI',
    sourceType: 'company_newsroom',
    url: 'https://blog.google/technology/ai/rss/',
    category: 'ai',
    language: 'en',
    trustScore: 0.92,
    refreshFrequencyMinutes: 180,
    active: true,
    tags: ['AI', 'cloud', 'models'],
  },
  {
    id: 'radar-aws-ml',
    name: 'AWS ML',
    sourceType: 'blog',
    url: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    category: 'cloud',
    language: 'en',
    trustScore: 0.9,
    refreshFrequencyMinutes: 240,
    active: true,
    tags: ['AI', 'cloud', 'enterprise'],
  },
  {
    id: 'radar-microsoft-ai',
    name: 'Microsoft AI',
    sourceType: 'company_newsroom',
    url: 'https://www.microsoft.com/en-us/ai/blog/feed/',
    category: 'ai',
    language: 'en',
    trustScore: 0.9,
    refreshFrequencyMinutes: 180,
    active: true,
    tags: ['AI', 'copilot', 'enterprise'],
  },
  {
    id: 'radar-stripe-blog',
    name: 'Stripe',
    sourceType: 'blog',
    url: 'https://stripe.com/blog/feed.rss',
    category: 'enterprise_software',
    language: 'en',
    trustScore: 0.82,
    refreshFrequencyMinutes: 360,
    active: true,
    tags: ['SaaS', 'business_model', 'operations'],
  },
  {
    id: 'radar-shopify-enterprise',
    name: 'Shopify Engineering',
    sourceType: 'blog',
    url: 'https://shopify.engineering/blog.atom',
    category: 'product',
    language: 'en',
    trustScore: 0.82,
    refreshFrequencyMinutes: 360,
    active: true,
    tags: ['product', 'platform', 'operations'],
  },
  {
    id: 'radar-mckinsey-tech',
    name: 'McKinsey Technology',
    sourceType: 'analyst_source',
    url: 'https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/rss',
    category: 'transformation',
    language: 'en',
    trustScore: 0.85,
    refreshFrequencyMinutes: 720,
    active: true,
    tags: ['transformation', 'leadership', 'strategy'],
  },
  {
    id: 'radar-gartner-news',
    name: 'Gartner Newsroom',
    sourceType: 'analyst_source',
    url: 'https://www.gartner.com/en/newsroom/rss.xml',
    category: 'market',
    language: 'en',
    trustScore: 0.87,
    refreshFrequencyMinutes: 720,
    active: true,
    tags: ['market', 'enterprise', 'leadership'],
  },
  {
    id: 'radar-nvidia-blog',
    name: 'NVIDIA Blog',
    sourceType: 'company_newsroom',
    url: 'https://blogs.nvidia.com/feed/',
    category: 'infrastructure',
    language: 'en',
    trustScore: 0.86,
    refreshFrequencyMinutes: 240,
    active: true,
    tags: ['AI', 'infrastructure', 'compute'],
  },
  {
    id: 'radar-wef-agenda',
    name: 'World Economic Forum',
    sourceType: 'news_provider',
    url: 'https://feeds.feedburner.com/strategy-business/latest',
    category: 'leadership',
    language: 'en',
    trustScore: 0.76,
    refreshFrequencyMinutes: 720,
    active: false,
    tags: ['strategy', 'leadership', 'market'],
  },
  {
    id: 'radar-hbr',
    name: 'Harvard Business Review',
    sourceType: 'analyst_source',
    url: 'https://feeds.hbr.org/harvardbusiness',
    category: 'leadership',
    language: 'en',
    trustScore: 0.82,
    refreshFrequencyMinutes: 720,
    active: false,
    tags: ['leadership', 'management', 'strategy'],
  },
  {
    id: 'radar-eu-ai-act',
    name: 'EU Digital Strategy',
    sourceType: 'documentation_feed',
    url: 'https://digital-strategy.ec.europa.eu/en/news/rss.xml',
    category: 'compliance',
    language: 'en',
    trustScore: 0.92,
    refreshFrequencyMinutes: 720,
    active: true,
    tags: ['regulation', 'AI', 'compliance'],
  },
  {
    id: 'radar-cisa',
    name: 'CISA News',
    sourceType: 'documentation_feed',
    url: 'https://www.cisa.gov/news.xml',
    category: 'cyber',
    language: 'en',
    trustScore: 0.9,
    refreshFrequencyMinutes: 720,
    active: false,
    tags: ['cyber', 'risk', 'compliance'],
  },
  {
    id: 'radar-deloitte-tech',
    name: 'Deloitte Insights',
    sourceType: 'analyst_source',
    url: 'https://www2.deloitte.com/us/en/insights/rss.xml',
    category: 'transformation',
    language: 'en',
    trustScore: 0.8,
    refreshFrequencyMinutes: 720,
    active: false,
    tags: ['transformation', 'operations', 'strategy'],
  },
];

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

function mapSourceRow(row: any): RadarSourceRecord {
  return {
    id: String(row.id || uuidv4()),
    name: String(row.name || ''),
    sourceType: String(row.source_type || 'rss') as RadarSourceType,
    url: String(row.url || ''),
    category: String(row.category || 'market'),
    language: String(row.language || 'en'),
    trustScore: Number(row.trust_score || 0.7),
    refreshFrequencyMinutes: Number(row.refresh_frequency_minutes || 180),
    active: Number(row.active || 0) === 1 || row.active === true,
    tags: parseJsonArray(row.tags_json),
    metadata: parseJsonObject(row.metadata_json),
    lastFetchedAt: row.last_fetched_at ? String(row.last_fetched_at) : null,
    nextRefreshAt: row.next_refresh_at ? String(row.next_refresh_at) : null,
  };
}

class RadarSourceRegistryService {
  async syncDefaultSources(): Promise<void> {
    for (const source of DEFAULT_RADAR_SOURCES) {
      await queryHelpers.queryRun(
        `INSERT INTO radar_sources (
          id, name, source_type, url, category, language, trust_score,
          refresh_frequency_minutes, active, tags_json, metadata_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          source_type = excluded.source_type,
          url = excluded.url,
          category = excluded.category,
          language = excluded.language,
          trust_score = excluded.trust_score,
          refresh_frequency_minutes = excluded.refresh_frequency_minutes,
          active = excluded.active,
          tags_json = excluded.tags_json,
          metadata_json = excluded.metadata_json,
          updated_at = CURRENT_TIMESTAMP`,
        [
          source.id,
          source.name,
          source.sourceType,
          source.url,
          source.category,
          source.language,
          source.trustScore,
          source.refreshFrequencyMinutes,
          source.active ? 1 : 0,
          JSON.stringify(source.tags),
          JSON.stringify(source.metadata || {}),
        ]
      );
    }
  }

  async listAll(): Promise<RadarSourceRecord[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT * FROM radar_sources ORDER BY active DESC, trust_score DESC, name ASC`
    );
    return rows.map(mapSourceRow);
  }

  async listDue(nowIso: string, limit = 6): Promise<RadarSourceRecord[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT *
       FROM radar_sources
       WHERE active = 1
         AND (next_refresh_at IS NULL OR next_refresh_at <= ?)
       ORDER BY COALESCE(next_refresh_at, '1970-01-01') ASC, trust_score DESC, name ASC
       LIMIT ?`,
      [nowIso, limit]
    );
    return rows.map(mapSourceRow);
  }

  async markRefreshed(
    sourceId: string,
    nowIso: string,
    refreshFrequencyMinutes: number
  ): Promise<void> {
    const nextRefreshAt = new Date(
      new Date(nowIso).getTime() + refreshFrequencyMinutes * 60 * 1000
    ).toISOString();
    await queryHelpers.queryRun(
      `UPDATE radar_sources
       SET last_fetched_at = ?, next_refresh_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowIso, nextRefreshAt, sourceId]
    );
  }
}

export const radarSourceRegistryService = new RadarSourceRegistryService();
