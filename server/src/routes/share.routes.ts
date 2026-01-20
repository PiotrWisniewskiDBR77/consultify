/**
 * Share Routes
 *
 * API endpoints for conversation sharing functionality.
 * Enables creating, viewing, and managing public share links.
 *
 * FLOW-SHARE: Conversation sharing system
 */

import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import { verifyToken as authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();

// ==========================================
// TYPES
// ==========================================

interface ShareSettings {
  allowCopy?: boolean;
  showTimestamps?: boolean;
  anonymize?: boolean;
  passwordHash?: string;
}

interface ConversationShare {
  id: string;
  conversationId: string;
  shareToken: string;
  createdBy: string;
  title?: string;
  description?: string;
  expiresAt?: Date;
  viewCount: number;
  isActive: boolean;
  settings: ShareSettings;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// HELPERS
// ==========================================

function generateShareToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ==========================================
// CREATE SHARE
// ==========================================

router.post('/conversations/:id/share', authenticate, async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = (req as any).user?.id;
  const { title, description, expiresIn, password, settings } = req.body;

  try {
    const db = getDatabase();

    const conversation = await db.get(
      `SELECT * FROM conversations WHERE id = ? AND (user_id = ? OR organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = ?
        ))`,
      [conversationId, userId, userId]
    ) as { title?: string } | undefined;

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const existingShare = await db.get(
      'SELECT * FROM conversation_shares WHERE conversation_id = ? AND is_active = 1',
      [conversationId]
    ) as { share_token?: string } | undefined;

    if (existingShare) {
      return res.status(400).json({
        error: 'Conversation already has an active share',
        shareToken: existingShare.share_token,
      });
    }

    const shareId = uuidv4();
    const shareToken = generateShareToken();
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const shareSettings: ShareSettings = {
      allowCopy: settings?.allowCopy ?? true,
      showTimestamps: settings?.showTimestamps ?? true,
      anonymize: settings?.anonymize ?? false,
    };

    if (password) {
      shareSettings.passwordHash = hashPassword(password);
    }

    await db.run(
      `INSERT INTO conversation_shares 
         (id, conversation_id, share_token, created_by, title, description, expires_at, settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shareId,
        conversationId,
        shareToken,
        userId,
        title || conversation.title,
        description,
        expiresAt,
        JSON.stringify(shareSettings),
      ]
    );

    logger.info(`[Share] Created share for conversation ${conversationId}: ${shareToken}`);

    res.json({
      id: shareId,
      shareToken,
      shareUrl: `${process.env.APP_URL || ''}/share/${shareToken}`,
      expiresAt,
    });
  } catch (error: any) {
    logger.error('[Share] Create error:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// ==========================================
// GET SHARE INFO
// ==========================================

router.get('/conversations/:id/share', authenticate, async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const db = getDatabase();

    const share = await db.get(
      `SELECT cs.*, c.title as conversation_title 
         FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.conversation_id = ? AND cs.is_active = 1
         AND (c.user_id = ? OR c.organization_id IN (
           SELECT organization_id FROM organization_members WHERE user_id = ?
         ))`,
      [conversationId, userId, userId]
    ) as {
      id?: string;
      share_token?: string;
      title?: string;
      conversation_title?: string;
      description?: string;
      view_count?: number;
      expires_at?: string;
      settings?: string;
      created_at?: string;
    } | undefined;

    if (!share) {
      return res.status(404).json({ error: 'No active share found' });
    }

    res.json({
      id: share.id,
      shareToken: share.share_token,
      shareUrl: `${process.env.APP_URL || ''}/share/${share.share_token}`,
      title: share.title || share.conversation_title,
      description: share.description,
      viewCount: share.view_count,
      expiresAt: share.expires_at,
      isPasswordProtected: !!JSON.parse(share.settings || '{}').passwordHash,
      settings: JSON.parse(share.settings || '{}'),
      createdAt: share.created_at,
    });
  } catch (error: any) {
    logger.error('[Share] Get info error:', error);
    res.status(500).json({ error: 'Failed to get share info' });
  }
});

// ==========================================
// VIEW SHARED CONVERSATION (PUBLIC)
// ==========================================

router.get('/share/:token', optionalAuth, async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.query;

  try {
    const db = getDatabase();

    const share = await db.get('SELECT * FROM conversation_shares WHERE share_token = ?', [token]) as {
      id?: string;
      conversation_id?: string;
      is_active?: number | boolean;
      expires_at?: string;
      settings?: string;
      title?: string;
      description?: string;
      view_count?: number;
    } | undefined;

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (!share.is_active) {
      return res.status(410).json({ error: 'Share has been revoked' });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    const settings = JSON.parse(share.settings || '{}') as ShareSettings;

    if (settings.passwordHash) {
      if (!password) {
        return res.status(401).json({
          error: 'Password required',
          passwordProtected: true,
        });
      }
      if (hashPassword(password as string) !== settings.passwordHash) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    const conversation = await db.get('SELECT * FROM conversations WHERE id = ?', [
      share.conversation_id,
    ]) as { title?: string; user_id?: string } | undefined;

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.all(
      `SELECT id, role, content, message_type, metadata, created_at
         FROM conversation_messages 
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
      [share.conversation_id]
    ) as Array<{
      id: string;
      role: string;
      content: string;
      message_type?: string;
      metadata?: string;
      created_at?: string;
    }>;

    await db.run(
      'UPDATE conversation_shares SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [share.id]
    );

    await db.run(
      `INSERT INTO conversation_share_views (id, share_id, viewer_ip, viewer_agent, referrer)
         VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), share.id, req.ip, req.headers['user-agent'], req.headers['referer']]
    );

    const response: any = {
      id: share.id,
      title: share.title || conversation.title,
      description: share.description,
      settings: {
        allowCopy: settings.allowCopy ?? true,
        showTimestamps: settings.showTimestamps ?? true,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        messageType: m.message_type,
        metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
        timestamp: settings.showTimestamps ? m.created_at : undefined,
      })),
      viewCount: (share.view_count || 0) + 1,
    };

    if (!settings.anonymize) {
      response.author = {
        id: conversation.user_id,
      };
    }

    res.json(response);
  } catch (error: any) {
    logger.error('[Share] View error:', error);
    res.status(500).json({ error: 'Failed to view share' });
  }
});

// ==========================================
// UPDATE SHARE
// ==========================================

router.patch('/conversations/:id/share', authenticate, async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = (req as any).user?.id;
  const { title, description, expiresIn, password, settings } = req.body;

  try {
    const db = getDatabase();

    const share = await db.get(
      `SELECT cs.* FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.conversation_id = ? AND cs.is_active = 1
         AND (c.user_id = ? OR cs.created_by = ?)`,
      [conversationId, userId, userId]
    ) as {
      id?: string;
      settings?: string;
      expires_at?: string;
      title?: string;
      description?: string;
    } | undefined;

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const currentSettings = JSON.parse(share.settings || '{}') as ShareSettings;
    const newSettings = { ...currentSettings, ...settings };

    if (password !== undefined) {
      if (password === null) {
        delete newSettings.passwordHash;
      } else {
        newSettings.passwordHash = hashPassword(password);
      }
    }

    const expiresAt =
      expiresIn !== undefined
        ? expiresIn === null
          ? null
          : new Date(Date.now() + expiresIn * 1000).toISOString()
        : share.expires_at;

    await db.run(
      `UPDATE conversation_shares 
         SET title = ?, description = ?, expires_at = ?, settings = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      [
        title !== undefined ? title : share.title,
        description !== undefined ? description : share.description,
        expiresAt,
        JSON.stringify(newSettings),
        share.id,
      ]
    );

    logger.info(`[Share] Updated share ${share.id}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Share] Update error:', error);
    res.status(500).json({ error: 'Failed to update share' });
  }
});

// ==========================================
// DELETE SHARE
// ==========================================

router.delete('/conversations/:id/share', authenticate, async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const db = getDatabase();

    const share = await db.get(
      `SELECT cs.* FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.conversation_id = ? AND cs.is_active = 1
         AND (c.user_id = ? OR cs.created_by = ?)`,
      [conversationId, userId, userId]
    ) as { id?: string } | undefined;

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    await db.run(
      'UPDATE conversation_shares SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [share.id]
    );

    logger.info(`[Share] Revoked share ${share.id}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Share] Delete error:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// ==========================================
// LIST USER'S SHARES
// ==========================================

router.get('/shares', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const db = getDatabase();

    const shares = await db.all(
      `SELECT cs.*, c.title as conversation_title
         FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.created_by = ?
         ORDER BY cs.created_at DESC`,
      [userId]
    );

    res.json({
      shares: shares.map((s: any) => ({
        id: s.id,
        conversationId: s.conversation_id,
        shareToken: s.share_token,
        shareUrl: `${process.env.APP_URL || ''}/share/${s.share_token}`,
        title: s.title || s.conversation_title,
        description: s.description,
        viewCount: s.view_count,
        isActive: s.is_active === 1,
        expiresAt: s.expires_at,
        createdAt: s.created_at,
      })),
    });
  } catch (error: any) {
    logger.error('[Share] List error:', error);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

export default router;
