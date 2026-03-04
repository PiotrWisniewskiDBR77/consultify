/**
 * Presentations Routes — Bundle 17 (T058 + T059)
 * Deck generation, templates, brand kits, export.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import type { DeckSetup } from '../services/presentationGeneratorService.js';
import { generateDeck, generateOutline } from '../services/presentationGeneratorService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(verifyToken);

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

// ============================================================
// TEMPLATES (T059)
// ============================================================

router.get(
  '/templates',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const rows = await dbAll(
      `SELECT * FROM presentation_templates WHERE (organization_id IS NULL OR organization_id = ?) AND is_active = TRUE ORDER BY is_system DESC, name`,
      [orgId]
    );
    const templates = ((rows || []) as any[]).map((r: any) => ({
      ...r,
      outline_json: JSON.parse(r.outline_json || '[]'),
      must_have_intents: JSON.parse(r.must_have_intents || '[]'),
      recommended_visuals: JSON.parse(r.recommended_visuals || '[]'),
    }));
    res.json({ success: true, data: templates });
  })
);

router.get(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const row = await dbGet(`SELECT * FROM presentation_templates WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Template not found' });
    const template = row as any;
    template.outline_json = JSON.parse(template.outline_json || '[]');
    template.must_have_intents = JSON.parse(template.must_have_intents || '[]');
    template.recommended_visuals = JSON.parse(template.recommended_visuals || '[]');
    res.json({ success: true, data: template });
  })
);

router.post(
  '/templates/:id/clone',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const source = (await dbGet(`SELECT * FROM presentation_templates WHERE id = ?`, [
      req.params.id,
    ])) as any;
    if (!source) return res.status(404).json({ success: false, error: 'Template not found' });

    const id = uuidv4().replace(/-/g, '');
    const { name } = req.body;
    await dbRun(
      `INSERT INTO presentation_templates (id, organization_id, name, description, deck_type, audience, goal, language_default, confidentiality_default, theme, outline_json, max_slides, min_slides, must_have_intents, recommended_visuals, is_system, cloned_from, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)`,
      [
        id,
        orgId,
        name || `${source.name} (Copy)`,
        source.description,
        source.deck_type,
        source.audience,
        source.goal,
        source.language_default,
        source.confidentiality_default,
        source.theme,
        source.outline_json,
        source.max_slides,
        source.min_slides,
        source.must_have_intents,
        source.recommended_visuals,
        req.params.id,
        (req as any).user?.id,
      ]
    );
    res.json({ success: true, data: { id } });
  })
);

router.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { name, description, audience, goal, theme, outlineJson, maxSlides } = req.body;
    await dbRun(
      `UPDATE presentation_templates SET name = COALESCE(?, name), description = COALESCE(?, description), audience = COALESCE(?, audience), goal = COALESCE(?, goal), theme = COALESCE(?, theme), outline_json = COALESCE(?, outline_json), max_slides = COALESCE(?, max_slides), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND is_system = FALSE`,
      [
        name,
        description,
        audience,
        goal,
        theme,
        outlineJson ? JSON.stringify(outlineJson) : null,
        maxSlides,
        req.params.id,
        orgId,
      ]
    );
    res.json({ success: true });
  })
);

// ============================================================
// BRAND KITS (T059)
// ============================================================

router.get(
  '/brand-kit',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const row = await dbGet(`SELECT * FROM brand_kits WHERE organization_id = ?`, [orgId]);
    res.json({ success: true, data: row || null });
  })
);

router.put(
  '/brand-kit',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const {
      name,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      fontTitle,
      fontBody,
      footerText,
      headerText,
      showPageNumbers,
      showConfidentiality,
      confidentialityDefault,
      disclaimerText,
      watermarkText,
    } = req.body;

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO brand_kits (id, organization_id, name, logo_url, primary_color, secondary_color, accent_color, font_title, font_body, footer_text, header_text, show_page_numbers, show_confidentiality, confidentiality_default, disclaimer_text, watermark_text, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(organization_id) DO UPDATE SET
       name=excluded.name, logo_url=excluded.logo_url, primary_color=excluded.primary_color,
       secondary_color=excluded.secondary_color, accent_color=excluded.accent_color,
       font_title=excluded.font_title, font_body=excluded.font_body,
       footer_text=excluded.footer_text, header_text=excluded.header_text,
       show_page_numbers=excluded.show_page_numbers, show_confidentiality=excluded.show_confidentiality,
       confidentiality_default=excluded.confidentiality_default,
       disclaimer_text=excluded.disclaimer_text, watermark_text=excluded.watermark_text,
       updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        orgId,
        name || 'Default',
        logoUrl || null,
        primaryColor || '003A70',
        secondaryColor || '2C5F8A',
        accentColor || '00AA55',
        fontTitle || 'Calibri Light',
        fontBody || 'Calibri',
        footerText || null,
        headerText || null,
        showPageNumbers ?? true,
        showConfidentiality ?? true,
        confidentialityDefault || 'internal',
        disclaimerText || null,
        watermarkText || null,
        (req as any).user?.id,
      ]
    );
    res.json({ success: true });
  })
);

// ============================================================
// DECK GENERATION (T058)
// ============================================================

router.post(
  '/generate/outline',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const setup: DeckSetup = req.body;
    const result = await generateOutline(setup, orgId);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/generate/deck',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { deckId, outline, setup } = req.body;
    const result = await generateDeck(deckId, outline, setup, orgId);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/decks',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const rows = await dbAll(
      `SELECT id, title, description, deck_type, audience, goal, language, theme, slide_count, status, export_format, exported_at, created_at, updated_at FROM presentation_decks WHERE organization_id = ? ORDER BY updated_at DESC`,
      [orgId]
    );
    res.json({ success: true, data: rows || [] });
  })
);

router.get(
  '/decks/:id',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const row = (await dbGet(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Deck not found' });
    row.source_artifacts = JSON.parse(row.source_artifacts || '[]');
    row.outline_json = JSON.parse(row.outline_json || '[]');
    row.validation_warnings = JSON.parse(row.validation_warnings || '[]');
    res.json({ success: true, data: row });
  })
);

router.get(
  '/decks/:id/download',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const deck = (await dbGet(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!deck || !deck.export_path)
      return res.status(404).json({ success: false, error: 'Export not available' });

    if (!fs.existsSync(deck.export_path))
      return res.status(404).json({ success: false, error: 'File not found' });

    const filename = `${deck.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pptx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(deck.export_path));
  })
);

router.delete(
  '/decks/:id',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const deck = (await dbGet(
      `SELECT export_path FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (deck?.export_path && fs.existsSync(deck.export_path)) {
      try {
        fs.unlinkSync(deck.export_path);
      } catch {}
    }
    await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [
      req.params.id,
      orgId,
    ]);
    res.json({ success: true });
  })
);

// Share link
router.post(
  '/decks/:id/share',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { expiresInDays } = req.body;
    const token = uuidv4().replace(/-/g, '');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : new Date(Date.now() + 7 * 86400000).toISOString();

    await dbRun(
      `UPDATE presentation_decks SET share_token = ?, share_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [token, expiresAt, req.params.id, orgId]
    );
    res.json({ success: true, data: { shareToken: token, expiresAt } });
  })
);

// Intent catalog (for UI) — reads from presentation_intents table
router.get(
  '/intents',
  asyncHandler(async (_req, res) => {
    const rows = await dbAll(
      `SELECT id, label, label_pl, description, description_pl FROM presentation_intents WHERE is_active = TRUE ORDER BY sort_order ASC`,
      []
    );
    const intents = ((rows || []) as any[]).map((r: any) => ({
      id: r.id,
      label: r.label,
      label_pl: r.label_pl,
      description: r.description,
      description_pl: r.description_pl,
    }));
    res.json({ success: true, data: intents });
  })
);

// ============================================================
// HTML5 INTERACTIVE EXPORT
// ============================================================

router.post(
  '/decks/:deckId/export/html',
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const orgId = getOrgId(req);

    const deck = await dbGet(
      'SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );

    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const { exportDeckAsHtml } = await import('../services/presentationHtmlExportService.js');
    let deckData: any;
    try {
      deckData = JSON.parse(deck.deck_json || deck.unified_json || '{}');
    } catch {
      return res.status(422).json({ success: false, error: 'Invalid deck data' });
    }

    const htmlBuffer = await exportDeckAsHtml({
      title: deck.title || 'Presentation',
      cards: deckData.cards || [],
      theme: deckData.theme || {
        primary: '#6366F1', secondary: '#8B5CF6', accent: '#EC4899',
        background: '#0F172A', surface: '#1E293B', textPrimary: '#F1F5F9',
        textSecondary: '#94A3B8', heading: '#F8FAFC',
      },
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${deck.title || 'presentation'}.html"`);
    res.send(htmlBuffer);
  })
);

// ============================================================
// DATA REFRESH
// ============================================================

router.post(
  '/decks/:deckId/cards/:cardId/blocks/:blockId/refresh',
  asyncHandler(async (req, res) => {
    const { deckId, cardId, blockId } = req.params;
    const orgId = getOrgId(req);

    const deck = await dbGet(
      'SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );

    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const deckData = JSON.parse(deck.deck_json || '{}');
    const card = (deckData.cards || []).find((c: any) => c.card_id === cardId);
    const block = card?.blocks?.find((b: any) => b.block_id === blockId);

    if (!block || !block.is_refreshable || !block.source_ref) {
      return res.json({ success: true, updated: false, reason: 'Block not refreshable' });
    }

    const sourceRef = block.source_ref;
    let freshContent = { ...block.content };

    try {
      if (sourceRef.artifact_type === 'initiative' && sourceRef.artifact_id) {
        const init = await dbGet(
          'SELECT name, status, progress, priority FROM initiatives WHERE id = ? AND organization_id = ?',
          [sourceRef.artifact_id, orgId]
        );
        if (init) {
          freshContent = { ...freshContent, ...(init as any), _refreshed_at: new Date().toISOString() };
        }
      } else if (sourceRef.artifact_type === 'kpi' && sourceRef.artifact_id) {
        const kpi = await dbGet(
          'SELECT name, current_value, target_value, unit FROM initiative_kpis WHERE id = ? AND organization_id = ?',
          [sourceRef.artifact_id, orgId]
        );
        if (kpi) {
          freshContent = { ...freshContent, ...(kpi as any), _refreshed_at: new Date().toISOString() };
        }
      } else {
        freshContent._refreshed_at = new Date().toISOString();
      }
    } catch {
      freshContent._refreshed_at = new Date().toISOString();
    }

    res.json({ success: true, updated: true, content: freshContent });
  })
);

// ============================================================
// AUTOSAVE
// ============================================================

router.put(
  '/decks/:deckId/autosave',
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const orgId = getOrgId(req);

    const deck = await dbGet(
      'SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length > 10_000_000) {
      return res.status(413).json({ success: false, error: 'Payload too large' });
    }

    await dbRun(
      `UPDATE presentation_decks SET deck_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [bodyStr, deckId, orgId]
    );

    res.json({ success: true });
  })
);

// ============================================================
// MEDIA LIBRARY
// ============================================================

router.get(
  '/media',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { category, limit = '30', offset = '0' } = req.query;

    let query = 'SELECT * FROM organization_media WHERE organization_id = ? AND is_archived = 0';
    const params: any[] = [orgId];

    if (category) {
      query += ' AND ai_category = ?';
      params.push(category);
    }

    query += ' ORDER BY usage_count DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = await dbAll(query, params);
    res.json({ success: true, items: rows });
  })
);

// ============================================================
// G1: DECK QUALITY GATES
// ============================================================

router.post(
  '/decks/:deckId/quality-gates',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { deckId } = req.params;

    const { checkDeckQualityGates } = await import(
      '../services/presentationQualityGatesService.js'
    );
    const report = await checkDeckQualityGates(orgId, String(deckId));
    res.json({ success: true, data: report });
  })
);

// ============================================================
// G2: PNG EXPORT (per-card high-res)
// ============================================================

router.post(
  '/decks/:deckId/export/png',
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const orgId = getOrgId(req);

    const deck = await dbGet(
      'SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    let deckData: any;
    try {
      deckData = JSON.parse(deck.deck_json || deck.unified_json || '{}');
    } catch {
      deckData = {};
    }
    const cards = deckData.cards || deckData.slides || [];
    const title = deck.title || 'presentation';

    const Archiver = (await import('archiver')).default;
    const { Readable } = await import('stream');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_png.zip"`
    );

    const archive = Archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardTitle = card.title || card.key_message || `slide_${i + 1}`;
      const safeName = cardTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

      const svg = renderCardToSvg(card, i, title, deck.theme || 'corporate');
      const svgBuffer = svgToBuffer(svg);

      archive.append(Readable.from(svgBuffer), {
        name: `${String(i + 1).padStart(2, '0')}_${safeName}.svg`,
      });
    }

    await archive.finalize();
  })
);

function renderCardToSvg(
  card: any,
  index: number,
  deckTitle: string,
  theme: string
): string {
  const bgColor = theme === 'minimal' ? '#FFFFFF' : theme === 'modern' ? '#0F172A' : '#1E293B';
  const textColor = theme === 'minimal' ? '#1E293B' : '#F1F5F9';
  const accentColor = theme === 'modern' ? '#8B5CF6' : '#6366F1';

  const title = escapeXml(card.title || card.key_message || `Slide ${index + 1}`);
  const subtitle = escapeXml(deckTitle);

  let blocksContent = '';
  const blocks = card.blocks || [];
  let yOffset = 380;

  for (const block of blocks.slice(0, 5)) {
    const blockText = extractBlockText(block);
    if (blockText) {
      blocksContent += `<text x="120" y="${yOffset}" font-size="22" fill="${textColor}" opacity="0.85" font-family="Arial, Helvetica, sans-serif">${escapeXml(blockText.slice(0, 120))}</text>`;
      yOffset += 40;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${bgColor}"/>
  <rect x="60" y="60" width="6" height="140" rx="3" fill="${accentColor}"/>
  <text x="120" y="140" font-size="48" font-weight="bold" fill="${textColor}" font-family="Arial, Helvetica, sans-serif">${title}</text>
  <text x="120" y="200" font-size="24" fill="${textColor}" opacity="0.6" font-family="Arial, Helvetica, sans-serif">${subtitle}</text>
  <line x1="120" y1="260" x2="1800" y2="260" stroke="${accentColor}" stroke-width="1" opacity="0.3"/>
  ${blocksContent}
  <text x="120" y="1020" font-size="14" fill="${textColor}" opacity="0.3" font-family="Arial, Helvetica, sans-serif">${index + 1}</text>
</svg>`;
}

function extractBlockText(block: any): string {
  if (!block?.content) return '';
  const c = block.content;
  if (typeof c === 'string') return c;
  if (c.text) return String(c.text);
  if (c.headline) return String(c.headline);
  if (c.label) return `${c.label}: ${c.value ?? ''}`;
  if (c.items && Array.isArray(c.items)) {
    return c.items
      .slice(0, 4)
      .map((item: any) => (typeof item === 'string' ? item : item.title || item.label || ''))
      .join(' | ');
  }
  return '';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgToBuffer(svg: string): Buffer {
  return Buffer.from(svg, 'utf-8');
}

// ============================================================
// G3: SHARE ANALYTICS
// ============================================================

router.post(
  '/decks/:deckId/analytics/view',
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const { viewerToken, cardIndex, durationMs } = req.body;

    const id = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO presentation_analytics (id, deck_id, viewer_token, event_type, card_index, duration_ms, user_agent, ip_hash, created_at)
       VALUES (?, ?, ?, 'page_view', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        deckId,
        viewerToken || 'anonymous',
        cardIndex ?? 0,
        durationMs ?? 0,
        req.headers['user-agent'] || '',
        hashIp(req.ip || ''),
      ]
    );

    res.json({ success: true });
  })
);

router.get(
  '/decks/:deckId/analytics',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { deckId } = req.params;

    const deck = await dbGet(
      'SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );
    if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

    const totalViews = await dbGet(
      `SELECT COUNT(DISTINCT viewer_token) AS unique_viewers, COUNT(*) AS total_views FROM presentation_analytics WHERE deck_id = ?`,
      [deckId]
    );

    const perCard = await dbAll(
      `SELECT card_index, COUNT(*) AS views, AVG(duration_ms) AS avg_duration_ms FROM presentation_analytics WHERE deck_id = ? GROUP BY card_index ORDER BY card_index`,
      [deckId]
    );

    const dailyViews = await dbAll(
      `SELECT DATE(created_at) AS date, COUNT(DISTINCT viewer_token) AS viewers FROM presentation_analytics WHERE deck_id = ? GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
      [deckId]
    );

    res.json({
      success: true,
      data: {
        summary: totalViews || { unique_viewers: 0, total_views: 0 },
        perCard: perCard || [],
        dailyViews: dailyViews || [],
      },
    });
  })
);

function hashIp(ip: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(ip + 'consultify-salt').digest('hex').slice(0, 16);
}

// ============================================================
// STYLE PROFILE
// ============================================================

router.get(
  '/style-profile',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const { getSmartDefaults } = await import('../services/organizationStyleProfileService.js');
    const defaults = await getSmartDefaults(orgId);
    res.json({ success: true, data: defaults });
  })
);

export default router;
