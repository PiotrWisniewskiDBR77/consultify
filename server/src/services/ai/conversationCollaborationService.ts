/**
 * Conversation Collaboration Service
 *
 * Enables multi-user chat sessions with AI:
 * - Shared conversations (multiple participants)
 * - Real-time sync via WebSocket/SSE broadcast
 * - Role-based visibility (admin sees more context than viewer)
 * - Presence indicators
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type ParticipantRole = 'owner' | 'editor' | 'viewer';

export interface ConversationParticipant {
  userId: string;
  role: ParticipantRole;
  joinedAt: string;
  lastSeenAt: string;
  isOnline: boolean;
}

export interface SharedConversation {
  conversationId: string;
  title: string;
  organizationId: string;
  createdBy: string;
  participants: ConversationParticipant[];
  isShared: boolean;
  createdAt: string;
}

const onlineUsers = new Map<string, Set<string>>();

class ConversationCollaborationService {
  async shareConversation(input: {
    conversationId: string;
    organizationId: string;
    sharedBy: string;
    participantIds: string[];
    defaultRole?: ParticipantRole;
  }): Promise<SharedConversation> {
    const conv = await dbGet(
      `SELECT * FROM conversations WHERE id = ? AND organization_id = ?`,
      [input.conversationId, input.organizationId]
    ) as any;

    if (!conv) throw new Error('Conversation not found');

    for (const userId of input.participantIds) {
      const existing = await dbGet(
        `SELECT id FROM conversation_participants
         WHERE conversation_id = ? AND user_id = ?`,
        [input.conversationId, userId]
      );

      if (!existing) {
        await dbRun(
          `INSERT INTO conversation_participants
            (id, conversation_id, user_id, role, joined_at, last_seen_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            randomUUID(),
            input.conversationId,
            userId,
            input.defaultRole || 'viewer',
          ]
        );
      }
    }

    const ownerExists = await dbGet(
      `SELECT id FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ?`,
      [input.conversationId, input.sharedBy]
    );

    if (!ownerExists) {
      await dbRun(
        `INSERT INTO conversation_participants
          (id, conversation_id, user_id, role, joined_at, last_seen_at)
         VALUES (?, ?, ?, 'owner', datetime('now'), datetime('now'))`,
        [randomUUID(), input.conversationId, input.sharedBy]
      );
    }

    await dbRun(
      `UPDATE conversations SET is_shared = 1, updated_at = datetime('now')
       WHERE id = ?`,
      [input.conversationId]
    ).catch(() => {});

    return this.getSharedConversation(input.conversationId, input.organizationId);
  }

  async getSharedConversation(
    conversationId: string,
    organizationId: string
  ): Promise<SharedConversation> {
    const conv = await dbGet(
      `SELECT * FROM conversations WHERE id = ? AND organization_id = ?`,
      [conversationId, organizationId]
    ) as any;

    if (!conv) throw new Error('Conversation not found');

    const participantRows = await dbAll(
      `SELECT * FROM conversation_participants WHERE conversation_id = ?`,
      [conversationId]
    ).catch(() => []) as any[];

    const onlineSet = onlineUsers.get(conversationId) || new Set();

    const participants: ConversationParticipant[] = (participantRows || []).map((p: any) => ({
      userId: p.user_id,
      role: p.role as ParticipantRole,
      joinedAt: p.joined_at,
      lastSeenAt: p.last_seen_at,
      isOnline: onlineSet.has(p.user_id),
    }));

    return {
      conversationId,
      title: conv.title || 'Shared Conversation',
      organizationId,
      createdBy: conv.user_id || conv.created_by,
      participants,
      isShared: participants.length > 1,
      createdAt: conv.created_at,
    };
  }

  async checkPermission(
    conversationId: string,
    userId: string,
    requiredRole: ParticipantRole
  ): Promise<boolean> {
    const participant = await dbGet(
      `SELECT role FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId]
    ) as any;

    if (!participant) return false;

    const hierarchy: Record<ParticipantRole, number> = {
      owner: 3,
      editor: 2,
      viewer: 1,
    };

    return hierarchy[participant.role as ParticipantRole] >= hierarchy[requiredRole];
  }

  async updateParticipantRole(
    conversationId: string,
    targetUserId: string,
    newRole: ParticipantRole,
    updatedBy: string
  ): Promise<void> {
    const isOwner = await this.checkPermission(conversationId, updatedBy, 'owner');
    if (!isOwner) throw new Error('Only conversation owners can change roles');

    await dbRun(
      `UPDATE conversation_participants SET role = ? WHERE conversation_id = ? AND user_id = ?`,
      [newRole, conversationId, targetUserId]
    );
  }

  async removeParticipant(
    conversationId: string,
    targetUserId: string,
    removedBy: string
  ): Promise<void> {
    const isOwner = await this.checkPermission(conversationId, removedBy, 'owner');
    if (!isOwner) throw new Error('Only conversation owners can remove participants');

    await dbRun(
      `DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, targetUserId]
    );
  }

  markUserOnline(conversationId: string, userId: string): void {
    if (!onlineUsers.has(conversationId)) {
      onlineUsers.set(conversationId, new Set());
    }
    onlineUsers.get(conversationId)!.add(userId);

    dbRun(
      `UPDATE conversation_participants SET last_seen_at = datetime('now')
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId]
    ).catch(() => {});
  }

  markUserOffline(conversationId: string, userId: string): void {
    onlineUsers.get(conversationId)?.delete(userId);
  }

  getOnlineUsers(conversationId: string): string[] {
    return Array.from(onlineUsers.get(conversationId) || []);
  }

  getVisibilityFilter(role: ParticipantRole): {
    includeSystemContext: boolean;
    includeToolCalls: boolean;
    includeDebugInfo: boolean;
  } {
    switch (role) {
      case 'owner':
        return { includeSystemContext: true, includeToolCalls: true, includeDebugInfo: true };
      case 'editor':
        return { includeSystemContext: false, includeToolCalls: true, includeDebugInfo: false };
      case 'viewer':
        return { includeSystemContext: false, includeToolCalls: false, includeDebugInfo: false };
    }
  }
}

export const conversationCollaborationService = new ConversationCollaborationService();
export default conversationCollaborationService;
