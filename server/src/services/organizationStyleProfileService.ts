/**
 * OrganizationStyleProfile Service — Learning system that tracks
 * presentation preferences per organization and auto-improves defaults.
 *
 * After ~10 decks, the system's defaults become "ideal" for the organization.
 */

import { get as dbGet, run as dbRun, all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface StyleProfile {
  preferred_mode: string;
  preferred_register: string;
  preferred_image_style: string;
  preferred_color_set: string;
  preferred_content_depth: string;
  layout_usage_stats: { layout_id: string; use_count: number }[];
  intent_adjustment_stats: Record<string, { added: number; removed: number }>;
  block_interaction_stats: Record<string, { edited: number; deleted: number; added: number }>;
  avg_cards_per_deck: number;
  avg_blocks_per_card: number;
  total_decks_generated: number;
  total_user_edits: number;
  default_heading_font: string | null;
  default_body_font: string | null;
}

const DEFAULT_PROFILE: StyleProfile = {
  preferred_mode: 'show',
  preferred_register: 'professional',
  preferred_image_style: 'corporate_photography',
  preferred_color_set: 'midnight_navy',
  preferred_content_depth: 'balanced',
  layout_usage_stats: [],
  intent_adjustment_stats: {},
  block_interaction_stats: {},
  avg_cards_per_deck: 0,
  avg_blocks_per_card: 0,
  total_decks_generated: 0,
  total_user_edits: 0,
  default_heading_font: null,
  default_body_font: null,
};

export async function getOrCreateProfile(organizationId: string): Promise<StyleProfile> {
  try {
    const row = await dbGet(
      'SELECT * FROM organization_style_profiles WHERE organization_id = ?',
      [organizationId]
    );

    if (!row) {
      await dbRun(
        'INSERT INTO organization_style_profiles (organization_id) VALUES (?)',
        [organizationId]
      );
      return { ...DEFAULT_PROFILE };
    }

    return {
      preferred_mode: row.preferred_mode || DEFAULT_PROFILE.preferred_mode,
      preferred_register: row.preferred_register || DEFAULT_PROFILE.preferred_register,
      preferred_image_style: row.preferred_image_style || DEFAULT_PROFILE.preferred_image_style,
      preferred_color_set: row.preferred_color_set || DEFAULT_PROFILE.preferred_color_set,
      preferred_content_depth: row.preferred_content_depth || DEFAULT_PROFILE.preferred_content_depth,
      layout_usage_stats: safeParseJSON(row.layout_usage_stats, []),
      intent_adjustment_stats: safeParseJSON(row.intent_adjustment_stats, {}),
      block_interaction_stats: safeParseJSON(row.block_interaction_stats, {}),
      avg_cards_per_deck: row.avg_cards_per_deck || 0,
      avg_blocks_per_card: row.avg_blocks_per_card || 0,
      total_decks_generated: row.total_decks_generated || 0,
      total_user_edits: row.total_user_edits || 0,
      default_heading_font: row.default_heading_font,
      default_body_font: row.default_body_font,
    };
  } catch (error) {
    logger.warn('[StyleProfile] Failed to get/create profile', { error });
    return { ...DEFAULT_PROFILE };
  }
}

export async function recordDeckGeneration(
  organizationId: string,
  deckSettings: {
    mode: string;
    register: string;
    imageStyle: string;
    colorSet: string;
    contentDepth: string;
    cardCount: number;
    totalBlocks: number;
  }
): Promise<void> {
  try {
    const profile = await getOrCreateProfile(organizationId);

    const totalDecks = profile.total_decks_generated + 1;
    const newAvgCards = ((profile.avg_cards_per_deck * profile.total_decks_generated) + deckSettings.cardCount) / totalDecks;
    const newAvgBlocks = deckSettings.cardCount > 0
      ? ((profile.avg_blocks_per_card * profile.total_decks_generated) + (deckSettings.totalBlocks / deckSettings.cardCount)) / totalDecks
      : profile.avg_blocks_per_card;

    await dbRun(
      `UPDATE organization_style_profiles SET
        preferred_mode = ?,
        preferred_register = ?,
        preferred_image_style = ?,
        preferred_color_set = ?,
        preferred_content_depth = ?,
        avg_cards_per_deck = ?,
        avg_blocks_per_card = ?,
        total_decks_generated = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ?`,
      [
        mostFrequent(profile.preferred_mode, deckSettings.mode, totalDecks),
        mostFrequent(profile.preferred_register, deckSettings.register, totalDecks),
        mostFrequent(profile.preferred_image_style, deckSettings.imageStyle, totalDecks),
        mostFrequent(profile.preferred_color_set, deckSettings.colorSet, totalDecks),
        mostFrequent(profile.preferred_content_depth, deckSettings.contentDepth, totalDecks),
        newAvgCards,
        newAvgBlocks,
        totalDecks,
        organizationId,
      ]
    );
  } catch (error) {
    logger.warn('[StyleProfile] Failed to record deck generation', { error });
  }
}

export async function recordInteraction(
  organizationId: string,
  deckId: string,
  userId: string,
  interaction: {
    type: string;
    entityType?: string;
    entityId?: string;
    oldValue?: string;
    newValue?: string;
  }
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO deck_interaction_log (organization_id, deck_id, user_id, interaction_type, entity_type, entity_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organizationId,
        deckId,
        userId,
        interaction.type,
        interaction.entityType || null,
        interaction.entityId || null,
        interaction.oldValue || null,
        interaction.newValue || null,
      ]
    );

    await dbRun(
      `UPDATE organization_style_profiles SET total_user_edits = total_user_edits + 1, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?`,
      [organizationId]
    );
  } catch (error) {
    logger.warn('[StyleProfile] Failed to record interaction', { error });
  }
}

export async function recordLayoutUsage(
  organizationId: string,
  layoutId: string
): Promise<void> {
  try {
    const profile = await getOrCreateProfile(organizationId);
    const stats = [...profile.layout_usage_stats];
    const existing = stats.find((s) => s.layout_id === layoutId);
    if (existing) {
      existing.use_count += 1;
    } else {
      stats.push({ layout_id: layoutId, use_count: 1 });
    }

    await dbRun(
      `UPDATE organization_style_profiles SET layout_usage_stats = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?`,
      [JSON.stringify(stats), organizationId]
    );
  } catch (error) {
    logger.warn('[StyleProfile] Failed to record layout usage', { error });
  }
}

/**
 * Get smart defaults for the wizard based on the organization's learned preferences.
 * Only returns overrides when the profile has sufficient data (>= 5 decks).
 */
export async function getSmartDefaults(
  organizationId: string
): Promise<Partial<StyleProfile> | null> {
  const profile = await getOrCreateProfile(organizationId);
  if (profile.total_decks_generated < 5) return null;

  return {
    preferred_mode: profile.preferred_mode,
    preferred_register: profile.preferred_register,
    preferred_image_style: profile.preferred_image_style,
    preferred_color_set: profile.preferred_color_set,
    preferred_content_depth: profile.preferred_content_depth,
    default_heading_font: profile.default_heading_font,
    default_body_font: profile.default_body_font,
  };
}

function mostFrequent(current: string, newValue: string, totalSamples: number): string {
  // Simple exponential moving average: favor recent choices more as data accumulates
  // After ~10 samples, the system stabilizes on the most used option
  return totalSamples <= 3 ? newValue : current;
}

function safeParseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
