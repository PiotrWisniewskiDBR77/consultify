/**
 * Cross-Conversation Intelligence Service
 *
 * Enables searching across team conversations with permission checks,
 * trend detection, and pattern identification across the organization.
 */
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface CrossConversationResult {
  conversationId: string;
  conversationTitle: string;
  userId: string;
  messageSnippet: string;
  relevanceScore: number;
  createdAt: string;
}

export interface ConversationTrend {
  topic: string;
  mentionCount: number;
  uniqueUsers: number;
  firstMentioned: string;
  lastMentioned: string;
  isEmerging: boolean;
}

class CrossConversationService {
  async searchAcrossConversations(input: {
    query: string;
    organizationId: string;
    userId: string;
    limit?: number;
    includeOwnOnly?: boolean;
  }): Promise<CrossConversationResult[]> {
    const { query, organizationId, userId, limit = 20, includeOwnOnly = false } = input;

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);

    if (!keywords.length) return [];

    const likeConditions = keywords.map(() => `m.content LIKE ?`).join(' OR ');
    const likeParams = keywords.map((k) => `%${k}%`);

    const ownerFilter = includeOwnOnly ? 'AND c.user_id = ?' : '';
    const ownerParams = includeOwnOnly ? [userId] : [];

    try {
      const rows = (await dbAll(
        `SELECT
           c.id as conversation_id,
           c.title as conversation_title,
           c.user_id,
           SUBSTR(m.content, 1, 200) as message_snippet,
           m.created_at
         FROM conversation_messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.organization_id = ? ${ownerFilter}
           AND m.role = 'assistant'
           AND (${likeConditions})
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [organizationId, ...ownerParams, ...likeParams, limit]
      )) as any[];

      return (rows || []).map((row: any) => ({
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title || 'Untitled',
        userId: row.user_id,
        messageSnippet: row.message_snippet || '',
        relevanceScore: this.computeRelevance(row.message_snippet || '', keywords),
        createdAt: row.created_at,
      }));
    } catch (err: any) {
      logger.warn(`[CrossConv] Search failed: ${err?.message}`);
      return [];
    }
  }

  async detectTrends(input: {
    organizationId: string;
    days?: number;
    minMentions?: number;
  }): Promise<ConversationTrend[]> {
    const { organizationId, days = 7, minMentions = 3 } = input;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const rows = (await dbAll(
        `SELECT
           m.content,
           c.user_id,
           m.created_at
         FROM conversation_messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.organization_id = ?
           AND m.created_at >= ?
           AND m.role = 'user'
           AND LENGTH(m.content) > 20
         ORDER BY m.created_at DESC
         LIMIT 500`,
        [organizationId, cutoff]
      )) as any[];

      const topicCounts = new Map<
        string,
        {
          count: number;
          users: Set<string>;
          firstSeen: string;
          lastSeen: string;
        }
      >();

      for (const row of rows || []) {
        const topics = this.extractTopics(row.content);
        for (const topic of topics) {
          const existing = topicCounts.get(topic) || {
            count: 0,
            users: new Set(),
            firstSeen: row.created_at,
            lastSeen: row.created_at,
          };
          existing.count++;
          existing.users.add(row.user_id);
          if (row.created_at < existing.firstSeen) existing.firstSeen = row.created_at;
          if (row.created_at > existing.lastSeen) existing.lastSeen = row.created_at;
          topicCounts.set(topic, existing);
        }
      }

      const trends: ConversationTrend[] = [];
      for (const [topic, data] of topicCounts) {
        if (data.count < minMentions) continue;
        const daysSinceFirst =
          (new Date(data.lastSeen).getTime() - new Date(data.firstSeen).getTime()) /
          (1000 * 60 * 60 * 24);

        trends.push({
          topic,
          mentionCount: data.count,
          uniqueUsers: data.users.size,
          firstMentioned: data.firstSeen,
          lastMentioned: data.lastSeen,
          isEmerging: daysSinceFirst < 3 && data.users.size >= 2,
        });
      }

      return trends.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 20);
    } catch (err: any) {
      logger.warn(`[CrossConv] Trend detection failed: ${err?.message}`);
      return [];
    }
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];
    const words = content.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (bigram.length > 6 && !/^(the |a |an |to |in |is |it |of |and |or |for )/.test(bigram)) {
        topics.push(bigram);
      }
    }

    const properNouns =
      content.match(
        /\b[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{3,}(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{3,})?/g
      ) || [];
    topics.push(...properNouns.map((n) => n.toLowerCase()));

    return [...new Set(topics)].slice(0, 10);
  }

  private computeRelevance(text: string, keywords: string[]): number {
    const lower = text.toLowerCase();
    const hits = keywords.filter((k) => lower.includes(k)).length;
    return Math.round((hits / Math.max(keywords.length, 1)) * 100) / 100;
  }
}

export const crossConversationService = new CrossConversationService();
export default crossConversationService;
