/**
 * Public Artifacts Routes
 *
 * Public, read-only access to shared work-canvas drafts ("artifacts") via
 * share token (no authentication required). The authenticated side of this
 * flow lives in work-canvas.routes.ts:
 *
 *   POST /api/work-canvas/drafts/:draftId/share
 *     → generates a 32-hex-char token and stores it (with createdAt /
 *       expiresAt, 7-day TTL) inside the draft's `provenance_json.share`
 *       object on `work_canvas_drafts`.
 *
 * This router exposes ONLY the public consume side:
 *
 *   GET /api/public/artifacts/:token
 *     → sanitized payload { title, kind, contentMd, updatedAt, orgBranding? }.
 *       Never returns internal IDs, author identity, or org IDs.
 *       404 for unknown/revoked tokens, 410 for expired ones (mirrors the
 *       authenticated GET /api/work-canvas/shared/:token contract).
 *
 * Mount: app.use('/api/public/artifacts', publicArtifactsRoutes) — alongside
 * the other /api/public/* routers in Gateway.ts (MUST mount before legacy
 * `/api` root routers that apply router-level auth).
 *
 * Protections:
 *   - express-rate-limit: 30 req / IP / minute (same posture as the public
 *     table-platform form intake surface).
 *   - Strict token-shape validation (32 lowercase hex chars — the exact
 *     output of randomUUID().replace(/-/g, '')) before it ever reaches a
 *     LIKE query, so no wildcard injection is possible.
 */

import { type Request, type Response, Router } from 'express';
import rateLimit from 'express-rate-limit';

import { all as dbAll, get as dbGet, tableExists } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const publicArtifactLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

// Exact shape produced by the share route: randomUUID().replace(/-/g, '').
const SHARE_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

// Kinds whose `content_md` is a faithful, self-contained rendering of the
// artifact. Other kinds (deck, sheet, table) need richer viewers — the
// frontend shows a graceful "not yet public" fallback for those, but we
// still expose `kind` so it can decide.
type ShareRecord = {
  token: string;
  expiresAt: string;
};

type PublicDraftRow = {
  id: string;
  organization_id: string;
  kind: string;
  title: string;
  content_md: string | null;
  provenance_json: string | null;
  updated_at: string;
};

function parseShare(provenanceJson: string | null): ShareRecord | null {
  if (!provenanceJson) return null;
  try {
    const provenance = JSON.parse(provenanceJson) as Record<string, unknown>;
    const share = provenance?.share;
    if (!share || typeof share !== 'object') return null;
    const record = share as Record<string, unknown>;
    const token = typeof record.token === 'string' ? record.token.trim() : '';
    if (!token) return null;
    return {
      token,
      expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : '',
    };
  } catch {
    return null;
  }
}

async function lookupOrgName(organizationId: string): Promise<string | null> {
  try {
    const row = await dbGet<{ name?: string }>(
      `SELECT name FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: true }
    );
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    return name || null;
  } catch {
    // Branding is decorative — never fail the share view over it.
    return null;
  }
}

/**
 * GET /api/public/artifacts/:token
 * Public, sanitized view of a shared canvas artifact. NO AUTH.
 */
router.get('/:token', publicArtifactLimiter, async (req: Request, res: Response) => {
  try {
    const tokenParam = req.params.token;
    const token = String(Array.isArray(tokenParam) ? tokenParam[0] : tokenParam || '')
      .trim()
      .toLowerCase();

    // Strict shape check BEFORE any DB access — also guarantees the LIKE
    // parameter below cannot contain `%` / `_` wildcards.
    if (!SHARE_TOKEN_PATTERN.test(token)) {
      return res.status(404).json({ error: 'Shared artifact not found' });
    }

    // Fresh deployments may not have the canvas tables yet — that is simply
    // "no such share", not a server error.
    if (!(await tableExists('work_canvas_drafts'))) {
      return res.status(404).json({ error: 'Shared artifact not found' });
    }

    // Cross-org lookup by design: the share token IS the capability. The
    // LIKE prefilter narrows candidates; the exact match below is the
    // authoritative check (provenance_json could contain the token string
    // in an unrelated field).
    const rows = await dbAll<PublicDraftRow>(
      `SELECT id, organization_id, kind, title, content_md, provenance_json, updated_at
       FROM work_canvas_drafts
       WHERE provenance_json LIKE ?
       ORDER BY updated_at DESC`,
      [`%${token}%`],
      { fallback: false }
    );

    const match = rows.find((row) => parseShare(row.provenance_json)?.token === token);
    if (!match) {
      // Unknown token, or share was revoked (share object removed from
      // provenance) — indistinguishable on purpose.
      return res.status(404).json({ error: 'Shared artifact not found' });
    }

    const share = parseShare(match.provenance_json);
    if (share && share.expiresAt && Date.parse(share.expiresAt) < Date.now()) {
      return res.status(410).json({
        error: 'Shared artifact link expired',
        code: 'CANVAS_SHARE_EXPIRED',
      });
    }

    const orgName = await lookupOrgName(match.organization_id);

    // Sanitized payload: no draft/org/author IDs, no provenance, no emails.
    return res.json({
      title: match.title || 'Untitled artifact',
      kind: match.kind,
      contentMd: match.content_md || '',
      updatedAt: match.updated_at,
      ...(orgName ? { orgBranding: { name: orgName } } : {}),
    });
  } catch (err) {
    logger.error('[PublicArtifacts] Error resolving shared artifact:', err);
    return res.status(500).json({ error: 'Failed to load shared artifact' });
  }
});

export default router;
