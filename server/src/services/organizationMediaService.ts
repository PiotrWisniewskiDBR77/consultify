/**
 * Organization Media Service — manages uploaded images with AI auto-tagging.
 * Provides search by tags, intent-based lookup for smart image routing,
 * and usage tracking.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface MediaItem {
  id: string;
  organization_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  storage_url: string;
  thumbnail_url?: string;
  ai_tags: string[];
  ai_description?: string;
  ai_dominant_colors: string[];
  ai_category?: string;
  user_tags: string[];
  title?: string;
  alt_text?: string;
  usage_count: number;
  created_at: string;
}

export interface UploadMediaInput {
  organizationId: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  title?: string;
  userTags?: string[];
}

/**
 * Upload a new media item and trigger AI tagging.
 */
export async function uploadMedia(input: UploadMediaInput): Promise<MediaItem> {
  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await dbRun(
    `INSERT INTO organization_media
      (id, organization_id, uploaded_by, filename, original_name, mime_type, file_size, width, height, storage_url, thumbnail_url, title, user_tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.uploadedBy,
      input.filename,
      input.originalName,
      input.mimeType,
      input.fileSize,
      input.width || null,
      input.height || null,
      input.storageUrl,
      input.thumbnailUrl || null,
      input.title || null,
      JSON.stringify(input.userTags || []),
    ]
  );

  // Auto-tag asynchronously
  autoTagImage(id, input.storageUrl).catch((error) => {
    logger.warn('[MediaLibrary] Auto-tagging failed', { error, mediaId: id });
  });

  return getMediaById(id) as Promise<MediaItem>;
}

/**
 * AI auto-tagging: generates tags, description, dominant colors, and category.
 */
async function autoTagImage(mediaId: string, imageUrl: string): Promise<void> {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI();

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Analyze this image for a corporate media library. Return JSON:
{
  "tags": ["tag1", "tag2", ...],
  "description": "brief description",
  "dominant_colors": ["#hex1", "#hex2", "#hex3"],
  "category": "photo" | "illustration" | "chart" | "logo" | "icon"
}`,
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            { type: 'text', text: 'Analyze this image.' },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');

    await dbRun(
      `UPDATE organization_media SET
        ai_tags = ?, ai_description = ?, ai_dominant_colors = ?, ai_category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        JSON.stringify(parsed.tags || []),
        parsed.description || null,
        JSON.stringify(parsed.dominant_colors || []),
        parsed.category || null,
        mediaId,
      ]
    );

    logger.info(`[MediaLibrary] Auto-tagged media ${mediaId}: ${(parsed.tags || []).length} tags`);
  } catch (error) {
    logger.warn('[MediaLibrary] Auto-tagging failed', { error, mediaId });
  }
}

export async function getMediaById(id: string): Promise<MediaItem | null> {
  const row = await dbGet('SELECT * FROM organization_media WHERE id = ?', [id]);
  return row ? mapRowToMediaItem(row) : null;
}

export async function listMedia(
  organizationId: string,
  options?: { category?: string; tags?: string[]; limit?: number; offset?: number }
): Promise<MediaItem[]> {
  let query = 'SELECT * FROM organization_media WHERE organization_id = ? AND is_archived = 0';
  const params: unknown[] = [organizationId];

  if (options?.category) {
    query += ' AND ai_category = ?';
    params.push(options.category);
  }

  query += ' ORDER BY usage_count DESC, created_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = await dbAll(query, params);
  let items = rows.map(mapRowToMediaItem);

  if (options?.tags && options.tags.length > 0) {
    items = items.filter((item) =>
      options.tags!.some(
        (tag) =>
          item.ai_tags.includes(tag.toLowerCase()) || item.user_tags.includes(tag.toLowerCase())
      )
    );
  }

  return items;
}

/**
 * Smart image search: find the best matching org image for a given intent/context.
 * Used by Smart Image Routing before falling back to AI generation.
 */
export async function searchForSlideImage(
  organizationId: string,
  context: { slideTitle: string; slideIntent: string; brandColors?: string[] }
): Promise<MediaItem | null> {
  const allMedia = await listMedia(organizationId, { category: 'photo', limit: 50 });
  if (allMedia.length === 0) return null;

  const intentKeywords = getIntentKeywords(context.slideIntent);
  const titleWords = context.slideTitle.toLowerCase().split(/\s+/);

  let bestMatch: MediaItem | null = null;
  let bestScore = 0;

  for (const item of allMedia) {
    let score = 0;
    const allTags = [...item.ai_tags, ...item.user_tags].map((t) => t.toLowerCase());

    // Tag overlap with intent keywords
    for (const kw of intentKeywords) {
      if (allTags.includes(kw)) score += 3;
    }

    // Tag overlap with title words
    for (const word of titleWords) {
      if (allTags.includes(word)) score += 2;
    }

    // Description match
    if (item.ai_description) {
      for (const word of titleWords) {
        if (item.ai_description.toLowerCase().includes(word)) score += 1;
      }
    }

    // Color harmony bonus
    if (context.brandColors && item.ai_dominant_colors.length > 0) {
      score += 1;
    }

    // Usage popularity bonus
    score += Math.min(item.usage_count * 0.1, 2);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

export async function incrementUsage(mediaId: string): Promise<void> {
  await dbRun(
    'UPDATE organization_media SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
    [mediaId]
  );
}

export async function archiveMedia(mediaId: string): Promise<void> {
  await dbRun(
    'UPDATE organization_media SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [mediaId]
  );
}

function getIntentKeywords(intent: string): string[] {
  const map: Record<string, string[]> = {
    cover: ['team', 'office', 'building', 'professional', 'corporate', 'logo'],
    executive_summary: ['meeting', 'board', 'leadership', 'strategy'],
    kpi_dashboard: ['chart', 'data', 'analytics', 'dashboard', 'metrics'],
    content: ['presentation', 'business', 'professional'],
    comparison: ['comparison', 'options', 'analysis'],
    recommendation: ['success', 'growth', 'opportunity', 'innovation'],
    risk_overview: ['warning', 'risk', 'security'],
    timeline: ['timeline', 'roadmap', 'planning'],
    thank_you: ['thank', 'team', 'success', 'celebration'],
  };
  return map[intent] || ['professional', 'business'];
}

function mapRowToMediaItem(row: any): MediaItem {
  return {
    id: row.id,
    organization_id: row.organization_id,
    filename: row.filename,
    original_name: row.original_name,
    mime_type: row.mime_type,
    file_size: row.file_size,
    width: row.width,
    height: row.height,
    storage_url: row.storage_url,
    thumbnail_url: row.thumbnail_url,
    ai_tags: safeParseJSON(row.ai_tags, []),
    ai_description: row.ai_description,
    ai_dominant_colors: safeParseJSON(row.ai_dominant_colors, []),
    ai_category: row.ai_category,
    user_tags: safeParseJSON(row.user_tags, []),
    title: row.title,
    alt_text: row.alt_text,
    usage_count: row.usage_count || 0,
    created_at: row.created_at,
  };
}

function safeParseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
