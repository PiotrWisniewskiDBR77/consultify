/**
 * Share Routes
 *
 * API endpoints for conversation sharing functionality.
 * Enables creating, viewing, and managing public share links.
 *
 * FLOW-SHARE: Conversation sharing system
 *
 * Security model (Chat P0-2 hardening):
 *  - Passwords are NEVER in the URL. Clients submit them via
 *    `POST /share/:token/unlock` with the password in the request body.
 *    The unlock response sets a short-lived signed access cookie that the
 *    subsequent GET reads. This keeps the password out of access logs,
 *    browser history, and Referer headers.
 *  - Passwords are stored as `scrypt(password, salt, N=16384, r=8, p=1)`
 *    in the format `scrypt$<saltHex>$<hashHex>`. Pre-hardening SHA-256
 *    hashes (stored without the `scrypt$` prefix) are still accepted on
 *    verification but rejected on creation — a one-way migration that
 *    leaves no rainbow-table-trivial digests in the DB after the next
 *    rotation. On a successful legacy verify we upgrade the row to
 *    scrypt in place.
 *  - The `/share/:token` endpoints have an in-process per-token+IP rate
 *    limit so an offline brute force can't run online.
 */

import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  type AuthRequest,
  optionalAuth,
  verifyToken as authenticate,
} from '../middleware/auth.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';

// ----- Augmentation so the legacy handlers can mention `req.user.id`. The
//       `@ts-nocheck` shield was removed (P0-2) — the codebase now type-checks
//       this file.
type ReqWithUser = Request & { user?: { id?: string; organizationId?: string } };
const authedReq = (req: Request): ReqWithUser => req as ReqWithUser;

// The original `../database/connection.js` (getDb with .get/.run/.query) no longer
// exists — that's why this router was orphaned. Shim the same shape over the
// canonical DbPromise helpers so the handlers work unchanged.
function getDb() {
  return {
    get: (sql: string, params?: unknown[]) => dbGet(sql, params as any),
    run: (sql: string, params?: unknown[]) => dbRun(sql, params as any),
    all: (sql: string, params?: unknown[]) => dbAll(sql, params as any),
    query: (sql: string, params?: unknown[]) => dbAll(sql, params as any),
  };
}

const router = Router();

// is_active is INTEGER/bigint on Postgres — node-pg serializes bigint as a
// STRING ("0"/"1"), so a raw `!share.is_active` is always falsy-wrong (a
// non-empty string "0" is truthy). Coerce uniformly across number/string/bool.
function flagOn(v: unknown): boolean {
  return v === true || Number(v) === 1;
}

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

// DB_MANAGED_SCHEMA may be off, so migration 283 might not have run. Ensure the
// sharing tables exist lazily (idempotent). Runs once per process.
let _shareTablesReady: boolean | null = null;
async function ensureShareTables() {
  if (_shareTablesReady !== null) return _shareTablesReady;
  try {
    const db = getDb();
    await db.run(`CREATE TABLE IF NOT EXISTS conversation_shares (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      title TEXT,
      description TEXT,
      expires_at TIMESTAMP,
      view_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      settings JSON DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.run(`CREATE TABLE IF NOT EXISTS conversation_share_views (
      id TEXT PRIMARY KEY,
      share_id TEXT NOT NULL,
      viewer_ip TEXT,
      viewer_agent TEXT,
      referrer TEXT,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.run('CREATE INDEX IF NOT EXISTS idx_shares_token ON conversation_shares(share_token)');
    _shareTablesReady = true;
  } catch (e: any) {
    logger.warn(`[Share] ensure tables failed: ${e?.message}`);
    _shareTablesReady = false;
  }
  return _shareTablesReady;
}

// ---- Password hashing (Chat P0-2) ----------------------------------------
// scrypt with N=16384, r=8, p=1 — node:crypto's defaults, OWASP-acceptable.
// Stored as `scrypt$<saltHex>$<hashHex>` so we can detect format on verify.
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_PREFIX = 'scrypt$';

function scryptHash(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SCRYPT_SALT_BYTES);
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${SCRYPT_PREFIX}${salt.toString('hex')}$${derivedKey.toString('hex')}`);
    });
  });
}

function scryptVerify(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(SCRYPT_PREFIX)) return Promise.resolve(false);
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      const a = Buffer.from(hashHex, 'hex');
      const b = derivedKey as Buffer;
      if (a.length !== b.length) return resolve(false);
      resolve(crypto.timingSafeEqual(a, b));
    });
  });
}

/**
 * Verify a password against a stored hash. Accepts the legacy SHA-256 format
 * (64 hex chars, no prefix) for backwards compatibility and signals the
 * caller via the second return whether the stored value should be upgraded.
 */
async function verifyPasscode(
  password: string,
  stored: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith(SCRYPT_PREFIX)) {
    const ok = await scryptVerify(password, stored);
    return { ok, needsUpgrade: false };
  }
  // Legacy SHA-256 path — constant-time compare so we don't leak via timing.
  const legacy = crypto.createHash('sha256').update(password).digest('hex');
  const a = Buffer.from(legacy);
  const b = Buffer.from(stored);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsUpgrade: ok };
}

// ---- Signed access cookie for unlocked shares ----------------------------
const ACCESS_COOKIE_TTL_MS = 1000 * 60 * 30; // 30 minutes
function shareAccessSecret(): string {
  return String(process.env.JWT_SECRET || process.env.SHARE_ACCESS_SECRET || 'consultify-share-dev')
    .padEnd(32, '_')
    .slice(0, 64);
}
function signShareAccess(token: string, expiresAt: number): string {
  const payload = `${token}.${expiresAt}`;
  const mac = crypto.createHmac('sha256', shareAccessSecret()).update(payload).digest('hex');
  return `${payload}.${mac}`;
}
function verifyShareAccess(token: string, signed: string | undefined): boolean {
  if (!signed) return false;
  const parts = signed.split('.');
  if (parts.length !== 3) return false;
  const [storedToken, expStr, mac] = parts;
  if (storedToken !== token) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = crypto
    .createHmac('sha256', shareAccessSecret())
    .update(`${storedToken}.${expStr}`)
    .digest('hex');
  if (mac.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(mac, 'utf-8'), Buffer.from(expected, 'utf-8'));
}

// ---- Per-token+IP rate limit ---------------------------------------------
// In-process; multi-instance deployments should swap for Redis. Default cap:
// 10 unlock attempts per 10 minutes per (token, IP) tuple.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rateLimitBuckets: Map<string, { count: number; resetAt: number }> = new Map();
function rateLimitConsume(token: string, ip: string): boolean {
  const key = `${token}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

// ==========================================
// CREATE SHARE
// ==========================================

router.post('/conversations/:id/share', authenticate, async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = authedReq(req).user?.id;
  const { title: rawTitle, description: rawDescription, expiresIn, settings } = req.body;
  // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
  // middleware escaped, before storing — the DB should hold plain text.
  const title = typeof rawTitle === 'string' ? decodeHtmlEntities(rawTitle) : rawTitle;
  const description =
    typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passcode = (req.body as any)?.password;

  try {
    const db = getDb();
    await ensureShareTables();

    const conversation = await db.get(
      `SELECT * FROM conversations WHERE id = ? AND (user_id = ? OR organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = ?
        ))`,
      [conversationId, userId, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Chat P1-8 — enforce the F2 team RBAC. The conversation is reachable
    // via the org-membership join above; that alone doesn't authorize the
    // act of publishing it. `create_share_link` is admin-only by default
    // (chatPermissionService canChat); contributors/viewers cannot expose
    // a team conversation publicly.
    if (conversation.organization_id && userId) {
      try {
        const { checkChatPermission } = await import('../services/chatPermissionService.js');
        const check = await checkChatPermission(
          userId,
          conversation.organization_id,
          'create_share_link',
          { isCreator: conversation.user_id === userId }
        );
        if (!check.allowed) {
          return res.status(403).json({
            error: check.reason || 'Only admins can publish team conversations',
            code: 'SHARE_PERMISSION_DENIED',
          });
        }
      } catch (permErr) {
        logger.warn('[Share] RBAC check failed; falling open is unsafe — denying.', permErr);
        return res.status(500).json({ error: 'Failed to check share permission' });
      }
    }

    const existingShare = await db.get(
      'SELECT * FROM conversation_shares WHERE conversation_id = ? AND is_active = 1',
      [conversationId]
    );

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

    if (passcode) {
      // Chat P0-2 — scrypt hash with random salt. The legacy SHA-256 path is
      // verify-only; new shares never store the unsalted digest.
      shareSettings.passwordHash = await scryptHash(String(passcode));
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

router.get('/conversations/:id/share', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;

  try {
    const db = getDb();

    const share = await db.get(
      `SELECT cs.*, c.title as conversation_title 
         FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.conversation_id = ? AND cs.is_active = 1
         AND (c.user_id = ? OR c.organization_id IN (
           SELECT organization_id FROM organization_members WHERE user_id = ?
         ))`,
      [conversationId, userId, userId]
    );

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

/**
 * Chat P0-2 — unlock endpoint. Submits password in a POST body (never the
 * URL), verifies via scrypt (or legacy SHA-256 with auto-upgrade), and on
 * success sets a short-lived signed access cookie the subsequent GET
 * verifies. Rate-limited per (token, IP).
 */
router.post('/share/:token/unlock', async (req: Request, res: Response) => {
  const token = String(req.params.token);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const password = String((req.body as any)?.password || '');
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');

  if (!rateLimitConsume(token, ip)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  try {
    const db = getDb();
    await ensureShareTables();
    const share = await db.get('SELECT * FROM conversation_shares WHERE share_token = ?', [token]);
    if (!share) return res.status(404).json({ error: 'Share not found' });
    if (!flagOn(share.is_active)) return res.status(410).json({ error: 'Share has been revoked' });
    const settings = JSON.parse(share.settings || '{}');
    if (!settings.passwordHash)
      return res.status(400).json({ error: 'Share is not password-protected' });
    const verdict = await verifyPasscode(password, String(settings.passwordHash));
    if (verdict.ok === false) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    if (verdict.needsUpgrade) {
      // Migrate legacy SHA-256 to scrypt on successful verify.
      try {
        const upgraded = await scryptHash(password);
        const nextSettings = { ...settings, passwordHash: upgraded };
        await db.run('UPDATE conversation_shares SET settings = ? WHERE share_token = ?', [
          JSON.stringify(nextSettings),
          token,
        ]);
      } catch (upgradeErr) {
        logger.warn('[Share] password hash upgrade failed', upgradeErr);
      }
    }
    const exp = Date.now() + ACCESS_COOKIE_TTL_MS;
    const signed = signShareAccess(token, exp);
    res.cookie(`share_access_${token}`, signed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: ACCESS_COOKIE_TTL_MS,
      path: `/share/${token}`,
    });
    return res.json({ ok: true, expiresAt: exp });
  } catch (error) {
    logger.error('[Share] unlock error:', error);
    return res.status(500).json({ error: 'Failed to unlock share' });
  }
});

router.get('/share/:token', optionalAuth, async (req: Request, res: Response) => {
  const token = String(req.params.token);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyQueryPassword = (req.query as any)?.password;

  try {
    const db = getDb();
    await ensureShareTables();

    const share = await db.get('SELECT * FROM conversation_shares WHERE share_token = ?', [token]);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (!flagOn(share.is_active)) {
      return res.status(410).json({ error: 'Share has been revoked' });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    const settings = JSON.parse(share.settings || '{}');

    if (settings.passwordHash) {
      // Chat P0-2 — check the signed access cookie first. Falls back to a
      // legacy `?password=...` query for one release of backwards compat,
      // but emits a deprecation warning header so the client can migrate.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cookieVal = (req as any).cookies?.[`share_access_${token}`];
      if (verifyShareAccess(token, cookieVal)) {
        // Access granted via signed cookie — continue.
      } else if (legacyQueryPassword) {
        res.setHeader(
          'Warning',
          '299 - "Deprecated: pass passwords via POST /share/:token/unlock instead of the URL"'
        );
        const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
        if (!rateLimitConsume(token, ip)) {
          return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
        }
        const verdict = await verifyPasscode(
          String(legacyQueryPassword),
          String(settings.passwordHash)
        );
        if (verdict.ok === false) {
          return res.status(401).json({ error: 'Incorrect password' });
        }
        // Don't auto-upgrade via legacy path — only on the proper POST.
      } else {
        return res.status(401).json({
          error: 'Password required',
          passwordProtected: true,
        });
      }
    }

    const conversation = await db.get('SELECT * FROM conversations WHERE id = ?', [
      share.conversation_id,
    ]);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.all(
      `SELECT id, role, content, message_type, created_at
         FROM conversation_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
      [share.conversation_id]
    );

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
      messages: messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        messageType: m.message_type,
        timestamp: settings.showTimestamps ? m.created_at : undefined,
      })),
      viewCount: share.view_count + 1,
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

router.patch('/conversations/:id/share', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;
  const { title: rawTitle, description: rawDescription, expiresIn, settings } = req.body;
  // T5 (Z139 follow-up): decode HTML entities before storing — see POST /share.
  const title = typeof rawTitle === 'string' ? decodeHtmlEntities(rawTitle) : rawTitle;
  const description =
    typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;
  const passcode = (req.body as any)?.password;

  try {
    const db = getDb();

    const share = await db.get(
      `SELECT cs.* FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.conversation_id = ? AND cs.is_active = 1
         AND (c.user_id = ? OR cs.created_by = ?)`,
      [conversationId, userId, userId]
    );

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const currentSettings = JSON.parse(share.settings || '{}');
    const newSettings = { ...currentSettings, ...settings };

    if (passcode !== undefined) {
      if (passcode === null) {
        delete newSettings.passwordHash;
      } else {
        newSettings.passwordHash = await scryptHash(String(passcode));
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

router.delete('/conversations/:id/share', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;

  try {
    const db = getDb();

    const share = await db.get(
      `SELECT cs.* FROM conversation_shares cs
         JOIN conversations c ON cs.conversation_id = c.id
         WHERE cs.conversation_id = ? AND cs.is_active = 1
         AND (c.user_id = ? OR cs.created_by = ?)`,
      [conversationId, userId, userId]
    );

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

router.get('/shares', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  try {
    const db = getDb();

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
        isActive: flagOn(s.is_active),
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
