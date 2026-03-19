import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import type { RadarActionType, UserRadarProfileRecord } from './radarTypes.js';
import { radarRankingService } from './radarRankingService.js';

type ActionInput = {
  userId: string;
  orgId: string;
  signalId?: string | null;
  actionType: RadarActionType;
  sourceContext?: string | null;
  createdObjectType?: string | null;
  createdObjectId?: string | null;
  payload?: Record<string, unknown>;
  role?: string | null;
  industry?: string | null;
};

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

class RadarActionService {
  async record(input: ActionInput): Promise<{ success: true; profile?: UserRadarProfileRecord | null }> {
    await queryHelpers.queryRun(
      `INSERT INTO radar_actions (
        id, user_id, organization_id, signal_id, action_type, source_context,
        created_object_type, created_object_id, action_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        input.userId,
        input.orgId,
        input.signalId || null,
        input.actionType,
        input.sourceContext || null,
        input.createdObjectType || null,
        input.createdObjectId || null,
        JSON.stringify(input.payload || {}),
      ]
    );

    let updatedProfile: UserRadarProfileRecord | null = null;
    if (
      input.actionType === 'add_to_watchlist' ||
      input.actionType === 'more_like_this' ||
      input.actionType === 'less_like_this'
    ) {
      updatedProfile = await this.applyPreferenceFeedback(input);
    }

    return { success: true, profile: updatedProfile };
  }

  private async applyPreferenceFeedback(input: ActionInput): Promise<UserRadarProfileRecord | null> {
    const profile = await radarRankingService.getOrCreateProfile({
      userId: input.userId,
      orgId: input.orgId,
      role: input.role,
      industry: input.industry,
    });

    const signal = input.signalId
      ? await queryHelpers.queryOne<any>(
          `SELECT ps.*, rs.name AS source_name
           FROM radar_processed_signals ps
           JOIN radar_sources rs ON rs.id = ps.source_id
           WHERE ps.id = ?`,
          [input.signalId]
        )
      : null;

    const topicTags = signal?.topic_tags_json
      ? (() => {
          try {
            const parsed = JSON.parse(signal.topic_tags_json);
            return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
          } catch {
            return [];
          }
        })()
      : [];
    const sourceName = signal?.source_name ? String(signal.source_name) : undefined;

    let patch: Partial<UserRadarProfileRecord> = {};

    if (input.actionType === 'add_to_watchlist') {
      const watchValue =
        String(input.payload?.value || input.payload?.topic || topicTags[0] || sourceName || '').trim();
      const itemType = String(input.payload?.itemType || (sourceName ? 'company' : 'topic'));
      if (watchValue) {
        await queryHelpers.queryRun(
          `INSERT INTO watchlist_items (id, user_id, organization_id, item_type, value, source, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, item_type, value) DO UPDATE SET active = 1, metadata_json = excluded.metadata_json`,
          [
            uuidv4(),
            input.userId,
            input.orgId,
            itemType,
            watchValue,
            sourceName || null,
            JSON.stringify({ signalId: input.signalId || null }),
          ]
        );
        if (itemType === 'company') {
          patch.trackedCompanies = uniqueList([...profile.trackedCompanies, watchValue]);
        } else {
          patch.trackedTopics = uniqueList([...profile.trackedTopics, watchValue]);
        }
      }
    }

    if (input.actionType === 'more_like_this') {
      patch.trackedTopics = uniqueList([...profile.trackedTopics, ...topicTags.slice(0, 2)]);
      if (sourceName) {
        patch.trackedCompanies = uniqueList([...profile.trackedCompanies, sourceName]);
      }
    }

    if (input.actionType === 'less_like_this') {
      patch.mutedTopics = uniqueList([...profile.mutedTopics, ...topicTags.slice(0, 2)]);
      if (sourceName) {
        patch.mutedSources = uniqueList([...profile.mutedSources, sourceName]);
      }
    }

    if (!Object.keys(patch).length) return profile;
    return await radarRankingService.updateProfile(input.userId, {
      ...patch,
      organizationId: profile.organizationId,
    });
  }
}

export const radarActionService = new RadarActionService();
