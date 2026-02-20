/**
 * Presentations Routes — Bundle 17 (T058 + T059)
 * Deck generation, templates, brand kits, export.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { verifyToken } from '../middleware/auth.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { generateOutline, generateDeck } from '../services/presentationGeneratorService.js';
import type { DeckSetup } from '../services/presentationGeneratorService.js';

const router = Router();
router.use(verifyToken);

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

// ============================================================
// TEMPLATES (T059)
// ============================================================

router.get('/templates', asyncHandler(async (req, res) => {
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
}));

router.get('/templates/:id', asyncHandler(async (req, res) => {
  const row = await dbGet(`SELECT * FROM presentation_templates WHERE id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ success: false, error: 'Template not found' });
  const template = row as any;
  template.outline_json = JSON.parse(template.outline_json || '[]');
  template.must_have_intents = JSON.parse(template.must_have_intents || '[]');
  template.recommended_visuals = JSON.parse(template.recommended_visuals || '[]');
  res.json({ success: true, data: template });
}));

router.post('/templates/:id/clone', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const source = await dbGet(`SELECT * FROM presentation_templates WHERE id = ?`, [req.params.id]) as any;
  if (!source) return res.status(404).json({ success: false, error: 'Template not found' });

  const id = uuidv4().replace(/-/g, '');
  const { name } = req.body;
  await dbRun(
    `INSERT INTO presentation_templates (id, organization_id, name, description, deck_type, audience, goal, language_default, confidentiality_default, theme, outline_json, max_slides, min_slides, must_have_intents, recommended_visuals, is_system, cloned_from, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)`,
    [id, orgId, name || `${source.name} (Copy)`, source.description, source.deck_type, source.audience, source.goal, source.language_default, source.confidentiality_default, source.theme, source.outline_json, source.max_slides, source.min_slides, source.must_have_intents, source.recommended_visuals, req.params.id, (req as any).user?.id]
  );
  res.json({ success: true, data: { id } });
}));

router.put('/templates/:id', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { name, description, audience, goal, theme, outlineJson, maxSlides } = req.body;
  await dbRun(
    `UPDATE presentation_templates SET name = COALESCE(?, name), description = COALESCE(?, description), audience = COALESCE(?, audience), goal = COALESCE(?, goal), theme = COALESCE(?, theme), outline_json = COALESCE(?, outline_json), max_slides = COALESCE(?, max_slides), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND is_system = FALSE`,
    [name, description, audience, goal, theme, outlineJson ? JSON.stringify(outlineJson) : null, maxSlides, req.params.id, orgId]
  );
  res.json({ success: true });
}));

// ============================================================
// BRAND KITS (T059)
// ============================================================

router.get('/brand-kit', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const row = await dbGet(`SELECT * FROM brand_kits WHERE organization_id = ?`, [orgId]);
  res.json({ success: true, data: row || null });
}));

router.put('/brand-kit', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const {
    name, logoUrl, primaryColor, secondaryColor, accentColor,
    fontTitle, fontBody, footerText, headerText,
    showPageNumbers, showConfidentiality, confidentialityDefault,
    disclaimerText, watermarkText,
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
    [id, orgId, name || 'Default', logoUrl || null, primaryColor || '003A70', secondaryColor || '2C5F8A', accentColor || '00AA55', fontTitle || 'Calibri Light', fontBody || 'Calibri', footerText || null, headerText || null, showPageNumbers ?? true, showConfidentiality ?? true, confidentialityDefault || 'internal', disclaimerText || null, watermarkText || null, (req as any).user?.id]
  );
  res.json({ success: true });
}));

// ============================================================
// DECK GENERATION (T058)
// ============================================================

router.post('/generate/outline', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const setup: DeckSetup = req.body;
  const result = await generateOutline(setup, orgId);
  res.json({ success: true, data: result });
}));

router.post('/generate/deck', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { deckId, outline, setup } = req.body;
  const result = await generateDeck(deckId, outline, setup, orgId);
  res.json({ success: true, data: result });
}));

router.get('/decks', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const rows = await dbAll(
    `SELECT id, title, description, deck_type, audience, goal, language, theme, slide_count, status, export_format, exported_at, created_at, updated_at FROM presentation_decks WHERE organization_id = ? ORDER BY updated_at DESC`,
    [orgId]
  );
  res.json({ success: true, data: rows || [] });
}));

router.get('/decks/:id', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const row = await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [req.params.id, orgId]
  ) as any;
  if (!row) return res.status(404).json({ success: false, error: 'Deck not found' });
  row.source_artifacts = JSON.parse(row.source_artifacts || '[]');
  row.outline_json = JSON.parse(row.outline_json || '[]');
  row.validation_warnings = JSON.parse(row.validation_warnings || '[]');
  res.json({ success: true, data: row });
}));

router.get('/decks/:id/download', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const deck = await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [req.params.id, orgId]
  ) as any;
  if (!deck || !deck.export_path) return res.status(404).json({ success: false, error: 'Export not available' });

  if (!fs.existsSync(deck.export_path)) return res.status(404).json({ success: false, error: 'File not found' });

  const filename = `${deck.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pptx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(path.resolve(deck.export_path));
}));

router.delete('/decks/:id', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const deck = await dbGet(`SELECT export_path FROM presentation_decks WHERE id = ? AND organization_id = ?`, [req.params.id, orgId]) as any;
  if (deck?.export_path && fs.existsSync(deck.export_path)) {
    try { fs.unlinkSync(deck.export_path); } catch {}
  }
  await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [req.params.id, orgId]);
  res.json({ success: true });
}));

// Share link
router.post('/decks/:id/share', asyncHandler(async (req, res) => {
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
}));

// Intent catalog (for UI)
router.get('/intents', asyncHandler(async (_req, res) => {
  const intents = [
    { id: 'cover', label: 'Cover Slide', description: 'Title page with branding' },
    { id: 'executive_summary', label: 'Executive Summary', description: 'High-level findings and KPIs' },
    { id: 'section_intro', label: 'Section Intro', description: 'Section divider with title' },
    { id: 'key_messages', label: 'Key Messages', description: '3-4 critical takeaways' },
    { id: 'performance_overview', label: 'KPI Dashboard', description: 'Performance metrics overview' },
    { id: 'single_insight', label: 'Single Insight', description: 'One chart or metric deep-dive' },
    { id: 'comparison', label: 'Comparison', description: 'Side-by-side or gap analysis' },
    { id: 'assessment', label: 'Assessment', description: 'Maturity/score overview' },
    { id: 'recommendation_portfolio', label: 'Recommendations', description: 'Action recommendations' },
    { id: 'initiative_portfolio', label: 'Initiative Portfolio', description: 'Initiative cards/table' },
    { id: 'prioritization_matrix', label: 'Prioritization Matrix', description: 'Impact vs effort quadrants' },
    { id: 'roadmap', label: 'Roadmap', description: 'Timeline with phases' },
    { id: 'risk_management', label: 'Risks & Mitigations', description: 'Risk table with actions' },
    { id: 'next_steps', label: 'Next Steps', description: 'Actions, owners, deadlines' },
    { id: 'appendix', label: 'Appendix', description: 'Disclaimers & methodology' },
  ];
  res.json({ success: true, data: intents });
}));

export default router;
