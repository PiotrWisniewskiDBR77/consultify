/**
 * Presentations Routes — Bundle 17 (T058 + T059)
 * Deck generation, templates, brand kits, export.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import auditEventsService from '../services/AuditEventsService.js';
import { send as sendNotification } from '../services/notificationService.js';
import {
  applyPresentationEditPlan,
  parsePresentationEditIntent,
} from '../services/presentationAgentEditService.js';
import { hasPresentationCapability, type PresentationCapability } from '../services/presentationAccessPolicyService.js';
import {
  isPresentationActionAllowedByConfidentiality,
  normalizePresentationRole,
  resolvePresentationDeckConfidentiality,
} from '../services/presentationConfidentialityPolicyService.js';
import { buildDeckDiffSummary } from '../services/presentationDeckDiffSummaryService.js';
import { buildPresentationGovernanceCard } from '../services/presentationGovernanceCardService.js';
import {
  buildPresentationGovernanceWatchlist,
  type WatchlistEntryInput,
} from '../services/presentationGovernanceWatchlistService.js';
import {
  buildPresentationRuntimeRollup,
  type PresentationRuntimeEventRow,
} from '../services/presentationRuntimeRollupService.js';
import { writePresentationRuntimeEvent } from '../services/presentationRuntimeTelemetryService.js';
import { normalizeTemplatePayload } from '../services/presentationTemplateCompatibilityService.js';
import { OrgPoliciesError, requireNoLegalHold } from '../services/OrgPoliciesService.js';
import {
  deckDocumentToUnifiedJson,
  normalizeDeckDocument,
} from '../services/presentationDeckDocumentService.js';
import type { DeckSetup } from '../services/presentationGeneratorService.js';
import { generateDeck, generateOutline } from '../services/presentationGeneratorService.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import * as reportsPresModelService from '../services/v8/reportsPresModelService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function getUserId(req: any): string {
  return req.user?.id || req.userId || 'system';
}

function ensurePresentationCapability(
  req: any,
  res: Response,
  capability: PresentationCapability
): boolean {
  const role = req.user?.role || req.userRole || 'VIEWER';
  if (hasPresentationCapability(role, capability)) return true;
  res.status(403).json({
    success: false,
    error: 'Permission denied',
    code: 'PERMISSION_DENIED',
    requiredCapability: capability,
  });
  return false;
}

function ensureConfidentialityPolicy(
  req: any,
  res: Response,
  params: { action: 'export' | 'share'; deck: any }
): boolean {
  const role = req.user?.role || req.userRole;
  const confidentiality = resolvePresentationDeckConfidentiality(params.deck);
  const allowed = isPresentationActionAllowedByConfidentiality({
    action: params.action,
    role,
    confidentiality,
  });
  if (!allowed) {
    const shareNeedsAdmin =
      params.action === 'share' &&
      confidentiality !== 'public' &&
      normalizePresentationRole(role) === 'PROJECT_MANAGER';
    res.status(403).json({
      success: false,
      error: shareNeedsAdmin
        ? 'Sharing non-public decks requires admin approval.'
        : 'Action blocked by confidentiality policy.',
      code: shareNeedsAdmin
        ? 'CONFIDENTIALITY_SHARE_REQUIRES_ADMIN'
        : 'CONFIDENTIALITY_POLICY_BLOCKED',
      action: params.action,
      confidentiality,
    });
    return false;
  }
  return true;
}

const EXPORT_MAX_SLIDE_COUNT = 60;
const EXPORT_MAX_PAYLOAD_BYTES = 50_000_000;
const pendingDeckAiOperations = new Map<
  string,
  {
    operationId: string;
    deckId: string;
    organizationId: string;
    userId: string;
    originalDeckJson: string;
    proposedDeckJson: string;
    reply: string;
    actions: string[];
    createdAt: string;
  }
>();

type PendingDeckAiOperation = {
  operationId: string;
  deckId: string;
  organizationId: string;
  userId: string;
  originalDeckJson: string;
  proposedDeckJson: string;
  reply: string;
  actions: string[];
  diff?: any;
  createdAt: string;
};

async function recordCanonicalDeckExportTrace(params: {
  organizationId: string;
  userId: string;
  roleKey: string | null;
  deckId: string;
  format: 'pdf' | 'pptx' | 'png' | 'html';
  status?: 'completed' | 'failed';
  errorCategory?: string;
}) {
  const artifact = await artifactRegistryService.getArtifactByOrigin({
    organizationId: params.organizationId,
    originRuntime: 'presentation',
    originRecordId: params.deckId,
    userId: params.userId,
    roleKey: params.roleKey,
  });
  if (!artifact?.artifactId) return;
  if (params.status === 'failed') {
    logger.warn('[Presentations] Export failed before completion record', {
      deckId: params.deckId,
      format: params.format,
      errorCategory: params.errorCategory,
    });
    return;
  }
  await reportsPresModelService.recordCompletedExport(
    artifact.artifactId,
    params.organizationId,
    params.format as any,
    params.userId || 'system'
  );
}

async function recordPresentationExportRecord(params: {
  organizationId: string;
  deckId: string;
  userId: string;
  format: 'pdf' | 'pptx' | 'png' | 'html';
  status: 'completed' | 'failed' | 'blocked';
  qualityReport?: any;
  filePath?: string | null;
  fileUrl?: string | null;
  errorCategory?: string | null;
}) {
  try {
    await dbRun(
      `INSERT INTO presentation_export_records (id, deck_id, organization_id, user_id, format, status, quality_result, quality_report_json, fidelity_score, file_path, file_url, storage_provider, error_category, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, CURRENT_TIMESTAMP)`,
      [
        uuidv4().replace(/-/g, ''),
        params.deckId,
        params.organizationId,
        params.userId,
        params.format,
        params.status,
        params.qualityReport?.result || null,
        JSON.stringify(params.qualityReport || {}),
        typeof params.qualityReport?.score === 'number' ? params.qualityReport.score : null,
        params.filePath || null,
        params.fileUrl || null,
        params.errorCategory || null,
      ]
    );
  } catch (error) {
    if (!isSchemaMissingError(error)) logger.warn('[Presentations] Could not record export QA', error);
  }
}

async function recordPresentationRuntimeEvent(params: {
  organizationId: string;
  deckId?: string | null;
  userId?: string | null;
  eventType: string;
  status?: string | null;
  scope?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await writePresentationRuntimeEvent(params);
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not record runtime event', error);
    }
  }
}

async function enforceQualityGateForExport(params: {
  organizationId: string;
  deckId: string;
  format: 'pdf' | 'pptx' | 'png' | 'html';
  allowOverride?: boolean;
}) {
  const { checkDeckQualityGates } = await import('../services/presentationQualityGatesService.js');
  const report = await checkDeckQualityGates(params.organizationId, params.deckId);
  if (!report.canExport && !params.allowOverride) {
    return {
      ok: false,
      status: 422,
      report,
      payload: {
        success: false,
        error: 'Deck is blocked by quality gates.',
        code: 'QUALITY_GATE_BLOCKED',
        result: report.result,
        scorecard: report.scorecard,
        gates: report.gates,
        format: params.format,
      },
    };
  }
  return { ok: true, report };
}

function enforceExportLimits(deck: any, cards: any[]): { ok: boolean; error?: string } {
  if (cards.length > EXPORT_MAX_SLIDE_COUNT) {
    return {
      ok: false,
      error: `Export limit exceeded: max ${EXPORT_MAX_SLIDE_COUNT} slides, deck has ${cards.length}`,
    };
  }
  const payloadSize = JSON.stringify(deck.deck_json || deck.unified_json || '').length;
  if (payloadSize > EXPORT_MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: `Export limit exceeded: payload too large (${Math.round(payloadSize / 1_000_000)}MB, max ${EXPORT_MAX_PAYLOAD_BYTES / 1_000_000}MB)`,
    };
  }
  return { ok: true };
}

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

function normalizeDeckRow(row: any) {
  const canonicalDeck = normalizeDeckDocument(row);
  return {
    ...row,
    deck_json: canonicalDeck ? JSON.stringify(canonicalDeck) : row.deck_json,
    source_artifacts: JSON.parse(row.source_artifacts || '[]'),
    source_refs: JSON.parse(row.source_refs_json || '[]'),
    outline_json: JSON.parse(row.outline_json || '[]'),
    validation_warnings: JSON.parse(row.validation_warnings || '[]'),
  };
}

function parseDeckPayload(row: any): any {
  return normalizeDeckDocument(row) || {};
}

function getDeckCards(row: any): any[] {
  const parsed = parseDeckPayload(row);
  return Array.isArray(parsed.cards)
    ? parsed.cards
    : Array.isArray(parsed.slides)
      ? parsed.slides
      : [];
}

async function ensureDeckLineageSchema(): Promise<void> {
  try {
    await dbRun(
      `ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS source_refs_json TEXT DEFAULT '{}'`
    );
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not ensure source_refs_json column', error);
    }
  }
}

async function syncArtifactRegistryForDeck(params: {
  deckId: string;
  organizationId: string;
  userId: string;
  title: string;
  slideCount?: number;
  presentationMode?: string | null;
  exportFormat?: string | null;
  status?: string | null;
  source?: unknown;
}): Promise<void> {
  await artifactRegistryService.registerArtifactOrigin({
    organizationId: params.organizationId,
    outputType: 'presentation',
    artifactFamily: 'presentation',
    originRuntime: 'presentation',
    originRecordId: params.deckId,
    titleSnapshot: params.title,
    ownerUserId: params.userId,
    createdBy: params.userId,
    deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState(params.status),
    visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
      outputType: 'presentation',
      ownerUserId: params.userId,
    }),
    originSummary: {
      presentationMode: params.presentationMode || null,
      slideCount: params.slideCount ?? null,
      exportFormat: params.exportFormat || null,
      source: params.source ?? null,
      sourceTable: 'presentation_decks',
      nativeStatus: params.status || 'draft',
    },
  });
}

function buildAuditEventSummary(row: any): string {
  const action = String(row?.action || '').toLowerCase();
  const resourceType = String(row?.resourceType || '');
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};

  if (resourceType === 'presentation_deck') {
    if (action === 'create') return 'Deck created';
    if (action === 'update') return 'Deck updated';
    if (action === 'delete') return 'Deck deleted';
    if (action === 'share') return 'Share link issued';
    if (action === 'refresh') return 'Deck refreshed';
  }

  if (resourceType === 'presentation_deck_agent_edit') {
    if (action === 'propose') return 'AI proposal created';
    if (action === 'approve') {
      const versionAfter = (meta as any)?.versionAfter ?? (meta as any)?.version_after;
      return versionAfter != null
        ? `AI proposal approved → v${versionAfter}`
        : 'AI proposal approved';
    }
    if (action === 'reject') return 'AI proposal rejected';
  }

  return `${row?.action || 'unknown'} ${resourceType || ''}`.trim();
}

async function saveAiOperation(op: PendingDeckAiOperation, prompt: string, versionBefore?: number) {
  pendingDeckAiOperations.set(op.operationId, op);
  try {
    await dbRun(
      `INSERT INTO presentation_ai_operations (id, deck_id, organization_id, user_id, operation_type, status, prompt, reply, actions_json, diff_json, original_deck_json, proposed_deck_json, version_before, created_at)
       VALUES (?, ?, ?, ?, 'agent_edit', 'draft', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        op.operationId,
        op.deckId,
        op.organizationId,
        op.userId,
        prompt,
        op.reply,
        JSON.stringify(op.actions || []),
        JSON.stringify(op.diff || {}),
        op.originalDeckJson,
        op.proposedDeckJson,
        versionBefore || null,
      ]
    );
  } catch (error) {
    if (!isSchemaMissingError(error)) logger.warn('[Presentations] Could not persist AI operation', error);
  }
}

async function getAiOperation(operationId: string): Promise<PendingDeckAiOperation | null> {
  const cached = pendingDeckAiOperations.get(operationId);
  if (cached) return cached;
  try {
    const row = (await dbGet(`SELECT * FROM presentation_ai_operations WHERE id = ?`, [
      operationId,
    ])) as any;
    if (!row) return null;
    return {
      operationId: row.id,
      deckId: row.deck_id,
      organizationId: row.organization_id,
      userId: row.user_id || 'system',
      originalDeckJson: row.original_deck_json || '{}',
      proposedDeckJson: row.proposed_deck_json || '{}',
      reply: row.reply || '',
      actions: JSON.parse(row.actions_json || '[]'),
      diff: JSON.parse(row.diff_json || '{}'),
      createdAt: row.created_at || new Date().toISOString(),
    };
  } catch (error) {
    if (!isSchemaMissingError(error)) logger.warn('[Presentations] Could not read AI operation', error);
    return null;
  }
}

async function resolveAiOperation(
  operationId: string,
  status: 'accepted' | 'rejected' | 'applied',
  versionAfter?: number
) {
  pendingDeckAiOperations.delete(operationId);
  try {
    await dbRun(
      `UPDATE presentation_ai_operations SET status = ?, version_after = COALESCE(?, version_after), resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, versionAfter || null, operationId]
    );
  } catch (error) {
    if (!isSchemaMissingError(error)) logger.warn('[Presentations] Could not resolve AI operation', error);
  }
}

async function getTemplateForOrgOrSystem(templateId: string, organizationId: string) {
  return (await dbGet(
    `SELECT *
     FROM presentation_templates
     WHERE id = ?
       AND is_active = TRUE
       AND (organization_id IS NULL OR organization_id = ?)`,
    [templateId, organizationId]
  )) as any;
}

async function enforceNoLegalHold(res: Response, organizationId: string, operation: string) {
  try {
    await requireNoLegalHold(organizationId, operation);
    return true;
  } catch (error: any) {
    if (error instanceof OrgPoliciesError || error?.code === 'LEGAL_HOLD') {
      res.status(403).json({ success: false, error: error.message, code: 'LEGAL_HOLD' });
      return false;
    }
    throw error;
  }
}

router.get(
  '/shared/:token',
  asyncHandler(async (req, res) => {
    const row = (await dbGet(
      `SELECT *
       FROM presentation_decks
       WHERE share_token = ?
         AND (share_expires_at IS NULL OR share_expires_at > CURRENT_TIMESTAMP)`,
      [req.params.token]
    )) as any;

    if (!row) {
      return res.status(404).json({ success: false, error: 'Shared presentation not found' });
    }

    res.json({ success: true, data: normalizeDeckRow(row) });
  })
);

router.use(verifyToken);

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
    const templates = ((rows || []) as any[]).map((r: any) => normalizeTemplatePayload(r));
    res.json({ success: true, data: templates });
  })
);

router.get(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const row = await getTemplateForOrgOrSystem(String(req.params.id), orgId);
    if (!row) return res.status(404).json({ success: false, error: 'Template not found' });
    const template = normalizeTemplatePayload(row);
    res.json({ success: true, data: template });
  })
);

router.post(
  '/templates/:id/clone',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'template_approve')) return;
    const orgId = getOrgId(req);
    const source = await getTemplateForOrgOrSystem(String(req.params.id), orgId);
    if (!source) return res.status(404).json({ success: false, error: 'Template not found' });
    const normalizedSource = normalizeTemplatePayload(source);

    const id = uuidv4().replace(/-/g, '');
    const { name } = req.body;
    await dbRun(
      `INSERT INTO presentation_templates (id, organization_id, name, description, deck_type, audience, goal, language_default, confidentiality_default, theme, outline_json, max_slides, min_slides, must_have_intents, recommended_visuals, is_system, cloned_from, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)`,
      [
        id,
        orgId,
        name || `${normalizedSource.name} (Copy)`,
        normalizedSource.description,
        normalizedSource.deck_type,
        normalizedSource.audience,
        normalizedSource.goal,
        normalizedSource.language_default,
        normalizedSource.confidentiality_default,
        normalizedSource.theme,
        JSON.stringify(normalizedSource.outline_json || []),
        normalizedSource.max_slides,
        normalizedSource.min_slides,
        JSON.stringify(normalizedSource.must_have_intents || []),
        JSON.stringify(normalizedSource.recommended_visuals || []),
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
    if (!ensurePresentationCapability(req, res, 'template_approve')) return;
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
    if (!ensurePresentationCapability(req, res, 'brand_change')) return;
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
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const setup: DeckSetup = req.body;
    const result = await generateOutline(setup, orgId);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/generate/deck',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const { deckId, outline, setup } = req.body;
    const result = await generateDeck(deckId, outline, setup, orgId);
    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/presentations/decks
 * Create a deck directly from structured slide JSON (used by Table OS export).
 */
router.post(
  '/decks',
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const {
      title,
      theme,
      slides,
      source,
      actionComposer,
      actionContract,
      sourcePack,
      evidenceRefs,
    } = req.body || {};

    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const deckId = uuidv4().replace(/-/g, '');
    const slideCount = Array.isArray(slides) ? slides.length : 0;

    try {
      await ensureDeckLineageSchema();
      await dbRun(
        `INSERT INTO presentation_decks (id, organization_id, title, deck_type, theme, slide_count, status, source_refs_json, created_at, updated_at)
         VALUES (?, ?, ?, 'custom', ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          deckId,
          orgId,
          title,
          theme || 'modern',
          slideCount,
          JSON.stringify({
            source: source || 'idea_table',
            actionComposer: actionComposer || null,
            actionContract: actionContract || null,
            sourcePack: sourcePack || {},
            evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs : [],
          }),
        ]
      );

      if (Array.isArray(slides)) {
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          const cardId = uuidv4().replace(/-/g, '');
          await dbRun(
            `INSERT INTO presentation_cards (id, deck_id, card_index, intent, blocks_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [cardId, deckId, i, slide.type || 'content', JSON.stringify(slide.content || slide)]
          );
        }
      }

      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: 'create',
        resourceType: 'presentation_deck',
        resourceId: deckId,
        after: { title, theme, slideCount, source, actionContract: actionContract || null },
        metadata: { organizationId: orgId },
      });

      try {
        await syncArtifactRegistryForDeck({
          deckId,
          organizationId: orgId,
          userId,
          title: String(title),
          slideCount,
          presentationMode: 'briefing',
          status: 'draft',
          source,
        });
      } catch (artifactErr: any) {
        await dbRun(`DELETE FROM presentation_cards WHERE deck_id = ?`, [deckId]);
        await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [
          deckId,
          orgId,
        ]);
        throw artifactErr;
      }

      res.status(201).json({ success: true, data: { id: deckId, title, slideCount } });
    } catch (error: any) {
      logger.error('[presentations] Failed to create deck:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to create deck' });
    }
  })
);

router.get(
  '/decks',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    try {
      await ensureDeckLineageSchema();
      const rows = await dbAll(
        `SELECT id, title, description, deck_type, audience, goal, language, theme, presentation_mode, slide_count, status, export_format, exported_at, created_at, updated_at, source_id, thumbnail_url, source_refs_json FROM presentation_decks WHERE organization_id = ? ORDER BY updated_at DESC`,
        [orgId]
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        logger.warn('[Presentations] Deck listing unavailable: schema not ready');
        return res.json({ success: true, data: [], unavailable: true });
      }
      throw error;
    }
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
    res.json({ success: true, data: normalizeDeckRow(row) });
  })
);

router.get(
  '/decks/:id/download',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_export')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const authReq = req as any;
    const roleKey = authReq.user?.role ? String(authReq.user.role) : null;
    if (!authReq.user?.id && !authReq.userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!(await enforceNoLegalHold(res, orgId, 'Presentation export'))) return;

    // P18-B: export audit respects visibility — deny exports when artifact is not visible to the caller.
    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId: orgId,
      originRuntime: 'presentation',
      originRecordId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ success: false, error: 'Export not available' });
    }

    const deck = (await dbGet(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!deck || !deck.export_path)
      return res.status(404).json({ success: false, error: 'Export not available' });
    if (!ensureConfidentialityPolicy(req, res, { action: 'export', deck })) return;

    const quality = await enforceQualityGateForExport({
      organizationId: orgId,
      deckId: String(req.params.id || ''),
      format: 'pptx',
      allowOverride: String(req.query.overrideQualityGate || '') === 'true',
    });
    if (!quality.ok) {
      await recordPresentationRuntimeEvent({
        organizationId: orgId,
        deckId: String(req.params.id || ''),
        userId,
        eventType: 'export_blocked',
        status: quality.report?.result || 'blocked',
        scope: 'global',
        metadata: {
          format: 'pptx',
          gateCount: Array.isArray(quality.report?.gates) ? quality.report.gates.length : 0,
        },
      });
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        format: 'pptx',
        status: 'blocked',
        qualityReport: quality.report,
        errorCategory: 'quality_gate_blocked',
      });
      return res.status(quality.status).json(quality.payload);
    }

    if (!fs.existsSync(deck.export_path))
      return res.status(404).json({ success: false, error: 'File not found' });

    const cards = getDeckCards(deck);
    const limitCheck = enforceExportLimits(deck, cards);
    if (!limitCheck.ok) {
      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        roleKey,
        format: 'pptx',
        status: 'failed',
        errorCategory: 'limit_exceeded',
      }).catch(() => null);
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        format: 'pptx',
        status: 'completed',
        qualityReport: quality.report,
        filePath: deck.export_path,
      });
      return res
        .status(422)
        .json({ success: false, error: limitCheck.error, code: 'EXPORT_LIMIT_EXCEEDED' });
    }

    const filename = `${deck.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pptx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    try {
      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        roleKey,
        format: 'pptx',
        status: 'completed',
      }).catch(() => null);
      sendNotification({
        userId,
        organizationId: orgId,
        type: 'presentation_export',
        title: 'Presentation exported',
        body: `"${deck.title}" has been exported as PPTX.`,
        entityType: 'presentation_deck',
        entityId: String(req.params.id || ''),
        actionUrl: `/presentations/builder/${req.params.id}`,
      }).catch(() => null);
      res.sendFile(path.resolve(deck.export_path));
    } catch (exportErr: any) {
      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        roleKey,
        format: 'pptx',
        status: 'failed',
        errorCategory: exportErr?.message || 'unknown',
      }).catch(() => null);
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        format: 'pptx',
        status: 'failed',
        qualityReport: quality.report,
        errorCategory: exportErr?.message || 'unknown',
      });
      throw exportErr;
    }
  })
);

router.get(
  '/decks/:deckId/export/pdf',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_export')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const authReq = req as any;
    const roleKey = authReq.user?.role ? String(authReq.user.role) : null;
    if (!authReq.user?.id && !authReq.userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!(await enforceNoLegalHold(res, orgId, 'Presentation PDF export'))) return;

    // P18-B: export audit respects visibility — deny exports when artifact is not visible to the caller.
    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId: orgId,
      originRuntime: 'presentation',
      originRecordId: String(deckId || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const deck = (await dbGet(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [deckId, orgId]
    )) as any;
    if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });
    if (!ensureConfidentialityPolicy(req, res, { action: 'export', deck })) return;

    const quality = await enforceQualityGateForExport({
      organizationId: orgId,
      deckId: String(deckId || ''),
      format: 'pdf',
      allowOverride: String(req.query.overrideQualityGate || '') === 'true',
    });
    if (!quality.ok) {
      await recordPresentationRuntimeEvent({
        organizationId: orgId,
        deckId: String(deckId || ''),
        userId,
        eventType: 'export_blocked',
        status: quality.report?.result || 'blocked',
        scope: 'global',
        metadata: {
          format: 'pdf',
          gateCount: Array.isArray(quality.report?.gates) ? quality.report.gates.length : 0,
        },
      });
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        format: 'pdf',
        status: 'blocked',
        qualityReport: quality.report,
        errorCategory: 'quality_gate_blocked',
      });
      return res.status(quality.status).json(quality.payload);
    }

    const cards = getDeckCards(deck);
    const limitCheck = enforceExportLimits(deck, cards);
    if (!limitCheck.ok) {
      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        roleKey,
        format: 'pdf',
        status: 'failed',
        errorCategory: 'limit_exceeded',
      }).catch(() => null);
      return res
        .status(422)
        .json({ success: false, error: limitCheck.error, code: 'EXPORT_LIMIT_EXCEEDED' });
    }

    const filename = `${String(deck.title || 'presentation').replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      doc.pipe(res);

      cards.forEach((card: any, index: number) => {
        if (index > 0) doc.addPage();
        doc.fontSize(22).text(String(card.title || card.key_message || `Slide ${index + 1}`));
        doc.moveDown(0.5);
        doc
          .fontSize(10)
          .fillColor('#666')
          .text(`Slide ${index + 1}`);
        doc.moveDown(1);
        const blocks = Array.isArray(card.blocks) ? card.blocks : [];
        if (blocks.length === 0) {
          doc.fillColor('#111').fontSize(12).text('No slide content');
          return;
        }
        blocks.slice(0, 8).forEach((block: any) => {
          const text = extractBlockText(block);
          if (!text) return;
          doc
            .fillColor('#111')
            .fontSize(12)
            .text(`• ${text.slice(0, 500)}`);
          doc.moveDown(0.35);
        });
        const footer = card.header_footer;
        if (footer) {
          doc
            .fillColor('#666')
            .fontSize(8)
            .text(
              `${String(footer.confidentiality || deck.confidentiality || 'internal').toUpperCase()} · ${String(footer.footerText || 'Consultify')} · ${index + 1}/${cards.length}`,
              48,
              doc.page.height - 42,
              { align: 'center' }
            );
        }
      });

      doc.end();

      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        roleKey,
        format: 'pdf',
        status: 'completed',
      }).catch(() => null);
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        format: 'pdf',
        status: 'completed',
        qualityReport: quality.report,
        filePath: null,
      });
      sendNotification({
        userId,
        organizationId: orgId,
        type: 'presentation_export',
        title: 'Presentation exported',
        body: `"${deck.title || 'Presentation'}" has been exported as PDF.`,
        entityType: 'presentation_deck',
        entityId: String(deckId || ''),
        actionUrl: `/presentations/builder/${deckId}`,
      }).catch(() => null);
    } catch (exportErr: any) {
      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        roleKey,
        format: 'pdf',
        status: 'failed',
        errorCategory: exportErr?.message || 'unknown',
      }).catch(() => null);
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        format: 'pdf',
        status: 'failed',
        qualityReport: quality.report,
        errorCategory: exportErr?.message || 'unknown',
      });
      throw exportErr;
    }
  })
);

router.delete(
  '/decks/:id',
  requireAudit,
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!(await enforceNoLegalHold(res, orgId, 'Presentation deletion'))) return;
    const deck = (await dbGet(
      `SELECT id, title, export_path, share_token, share_expires_at FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    if (deck?.export_path && fs.existsSync(deck.export_path)) {
      try {
        fs.unlinkSync(deck.export_path);
      } catch {}
    }
    await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [
      req.params.id,
      orgId,
    ]);
    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'delete',
      resourceType: 'presentation_deck',
      resourceId: req.params.id,
      before: {
        title: deck.title,
        shareToken: deck.share_token,
        shareExpiresAt: deck.share_expires_at,
      },
      metadata: { organizationId: orgId },
    });
    res.json({ success: true });
  })
);

// Share link
router.post(
  '/decks/:id/share',
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_share')) return;
    const orgId = getOrgId(req);
    const { expiresInDays } = req.body;
    const before = (await dbGet(
      `SELECT id, title, share_token, share_expires_at, confidentiality, deck_json FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!before) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    if (!ensureConfidentialityPolicy(req, res, { action: 'share', deck: before })) return;
    const token = uuidv4().replace(/-/g, '');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : new Date(Date.now() + 7 * 86400000).toISOString();

    await dbRun(
      `UPDATE presentation_decks SET share_token = ?, share_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [token, expiresAt, req.params.id, orgId]
    );
    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'share',
      resourceType: 'presentation_deck',
      resourceId: req.params.id,
      before: {
        shareToken: before.share_token,
        shareExpiresAt: before.share_expires_at,
      },
      after: {
        shareToken: token,
        shareExpiresAt: expiresAt,
      },
      metadata: { organizationId: orgId, title: before.title },
    });
    const shareUserId = getUserId(req);
    sendNotification({
      userId: shareUserId,
      organizationId: orgId,
      type: 'presentation_shared',
      title: 'Presentation shared',
      body: `"${before.title}" share link created (expires ${expiresAt}).`,
      entityType: 'presentation_deck',
      entityId: String(req.params.id || ''),
      actionUrl: `/presentations/builder/${req.params.id}`,
    }).catch(() => null);
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
    if (!ensurePresentationCapability(req, res, 'presentation_export')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const authReq = req as any;
    const roleKey = authReq.user?.role ? String(authReq.user.role) : null;
    if (!(await enforceNoLegalHold(res, orgId, 'Presentation HTML export'))) return;

    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId: orgId,
      originRuntime: 'presentation',
      originRecordId: String(deckId || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const deck = await dbGet(
      'SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );

    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    if (!ensureConfidentialityPolicy(req, res, { action: 'export', deck })) return;

    const quality = await enforceQualityGateForExport({
      organizationId: orgId,
      deckId: String(deckId || ''),
      format: 'html',
      allowOverride: String(req.query.overrideQualityGate || '') === 'true',
    });
    if (!quality.ok) {
      await recordPresentationRuntimeEvent({
        organizationId: orgId,
        deckId: String(deckId || ''),
        userId,
        eventType: 'export_blocked',
        status: quality.report?.result || 'blocked',
        scope: 'global',
        metadata: {
          format: 'html',
          gateCount: Array.isArray(quality.report?.gates) ? quality.report.gates.length : 0,
        },
      });
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        format: 'html',
        status: 'blocked',
        qualityReport: quality.report,
        errorCategory: 'quality_gate_blocked',
      });
      return res.status(quality.status).json(quality.payload);
    }

    const { exportDeckAsHtml } = await import('../services/presentationHtmlExportService.js');
    const deckData = normalizeDeckDocument(deck);
    if (!deckData) return res.status(422).json({ success: false, error: 'Invalid deck data' });

    const htmlBuffer = await exportDeckAsHtml({
      title: deck.title || 'Presentation',
      cards: deckData.cards || [],
      theme: deckData.theme || {
        primary: '#6366F1',
        secondary: '#8B5CF6',
        accent: '#EC4899',
        background: '#0F172A',
        surface: '#1E293B',
        textPrimary: '#F1F5F9',
        textSecondary: '#94A3B8',
        heading: '#F8FAFC',
      },
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${deck.title || 'presentation'}.html"`
    );
    await recordPresentationExportRecord({
      organizationId: orgId,
      userId,
      deckId: String(deckId || ''),
      format: 'html',
      status: 'completed',
      qualityReport: quality.report,
      filePath: null,
    });
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
          freshContent = {
            ...freshContent,
            ...(init as any),
            _refreshed_at: new Date().toISOString(),
          };
        }
      } else if (sourceRef.artifact_type === 'kpi' && sourceRef.artifact_id) {
        const kpi = await dbGet(
          'SELECT name, current_value, target_value, unit FROM initiative_kpis WHERE id = ? AND organization_id = ?',
          [sourceRef.artifact_id, orgId]
        );
        if (kpi) {
          freshContent = {
            ...freshContent,
            ...(kpi as any),
            _refreshed_at: new Date().toISOString(),
          };
        }
      } else if (sourceRef.artifact_type === 'assessment' && sourceRef.artifact_id) {
        const assessment = await dbGet(
          'SELECT id, name, status, overall_score, framework FROM assessment_reports WHERE id = ? AND organization_id = ?',
          [sourceRef.artifact_id, orgId]
        );
        if (assessment) {
          freshContent = {
            ...freshContent,
            ...(assessment as any),
            _refreshed_at: new Date().toISOString(),
          };
        }
      } else if (sourceRef.artifact_type === 'tool_session' && sourceRef.artifact_id) {
        const session = await dbGet(
          'SELECT id, tool_type, name, answers_json FROM tool_sessions WHERE id = ? AND organization_id = ?',
          [sourceRef.artifact_id, orgId]
        );
        if (session) {
          let answers: any = {};
          try {
            answers = JSON.parse((session as any).answers_json || '{}');
          } catch {}
          freshContent = {
            ...freshContent,
            tool_type: (session as any).tool_type,
            name: (session as any).name,
            summary: answers.summary || answers.conclusion || '',
            _refreshed_at: new Date().toISOString(),
          };
        }
      } else if (sourceRef.artifact_type === 'report' && sourceRef.artifact_id) {
        const report = await dbGet(
          'SELECT id, title, status, report_type FROM reports WHERE id = ? AND organization_id = ?',
          [sourceRef.artifact_id, orgId]
        );
        if (report) {
          freshContent = {
            ...freshContent,
            ...(report as any),
            _refreshed_at: new Date().toISOString(),
          };
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
    const userId = getUserId(req);
    const clientVersion = req.headers['x-deck-version']
      ? Number(req.headers['x-deck-version'])
      : null;

    const deck = (await dbGet(
      'SELECT id, version, deck_json FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    )) as any;
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    if (clientVersion !== null && clientVersion < deck.version) {
      return res.status(409).json({
        success: false,
        error: 'Version conflict: deck was modified by another session. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: deck.version,
        clientVersion,
      });
    }

    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length > 10_000_000) {
      return res.status(413).json({ success: false, error: 'Payload too large' });
    }

    const newVersion = (deck.version || 1) + 1;

    if (deck.deck_json) {
      try {
        const slideCount = (() => {
          try {
            const parsed = JSON.parse(deck.deck_json);
            return Array.isArray(parsed?.cards) ? parsed.cards.length : 0;
          } catch {
            return 0;
          }
        })();
        await dbRun(
          `INSERT INTO presentation_deck_versions (id, deck_id, version, deck_json_snapshot, slide_count, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [uuidv4().replace(/-/g, ''), deckId, deck.version, deck.deck_json, slideCount, userId]
        );
      } catch {
        // Version history table may not exist yet; non-blocking
      }
    }

    await dbRun(
      `UPDATE presentation_decks SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [bodyStr, newVersion, deckId, orgId]
    );

    res.json({ success: true, version: newVersion });
  })
);

router.post(
  '/decks/:deckId/agent-edit',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });

    const row = (await dbGet(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [deckId, orgId]
    )) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Deck not found' });

    const deck = parseDeckPayload(row);
    const isPolish = String(req.headers['accept-language'] || '')
      .toLowerCase()
      .startsWith('pl');
    const plan = parsePresentationEditIntent(prompt);
    if (!plan.actionable) {
      await recordPresentationRuntimeEvent({
        organizationId: orgId,
        deckId,
        userId,
        eventType: 'agent_edit_noop',
        status: 'noop',
        scope: plan.scope,
        metadata: { reason: plan.noOpReason || 'unsupported_intent' },
      });
      return res.json({
        success: true,
        data: {
          status: 'noop',
          plan,
          reply: isPolish
            ? `Brak zmian: ${plan.noOpReason || 'nierozpoznana intencja edycji.'}`
            : `No changes: ${plan.noOpReason || 'unsupported edit intent.'}`,
        },
      });
    }
    const result = applyPresentationEditPlan({
      plan,
      prompt,
      isPolish,
      deck: {
        ...deck,
        deck_id: deck.deck_id || deckId,
        title: deck.title || row.title,
      },
    });

    const operationId = uuidv4().replace(/-/g, '');
    const originalDeckJson = JSON.stringify(deck);
    const proposedDeckJson = JSON.stringify(result.deck);
    const diff = {
      ...buildDeckDiffSummary(deck, result.deck),
      editPlan: result.plan,
    };
    await saveAiOperation({
      operationId,
      deckId,
      organizationId: orgId,
      userId,
      originalDeckJson,
      proposedDeckJson,
      reply: result.reply,
      actions: result.appliedActions,
      diff,
      createdAt: new Date().toISOString(),
    }, prompt, row.version || 1);
    await recordPresentationRuntimeEvent({
      organizationId: orgId,
      deckId,
      userId,
      eventType: 'agent_edit_proposal_created',
      status: 'proposal',
      scope: result.plan.scope,
      metadata: {
        targetSlides: result.plan.targetSlides,
        mutationKinds: result.plan.mutationKinds,
        operationId,
      },
    });
    await (req as any).emitAuditEvent?.({
      actorType: 'AI_AGENT',
      action: 'propose',
      resourceType: 'presentation_deck_agent_edit',
      resourceId: operationId,
      metadata: {
        organizationId: orgId,
        deckId,
        scope: result.plan.scope,
        mutationKinds: result.plan.mutationKinds,
        targetSlides: result.plan.targetSlides,
      },
    });

    res.json({
      success: true,
      data: {
        ...result,
        operationId,
        status: 'proposal',
        plan: result.plan,
        diff,
        reply: isPolish
          ? `${result.reply} Przejrzyj propozycję przed zastosowaniem.`
          : `${result.reply} Review the proposal before applying it.`,
      },
    });
  })
);

router.post(
  '/decks/:deckId/agent-edit/:operationId/accept',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_approve')) return;
    const { deckId, operationId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const op = await getAiOperation(operationId);
    if (!op || op.deckId !== deckId || op.organizationId !== orgId) {
      return res.status(404).json({ success: false, error: 'AI proposal not found' });
    }

    const row = (await dbGet(
      `SELECT version, deck_json FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [deckId, orgId]
    )) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Deck not found' });

    const nextVersion = (row.version || 1) + 1;
    try {
      await dbRun(
        `INSERT INTO presentation_deck_versions (id, deck_id, version, deck_json_snapshot, slide_count, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4().replace(/-/g, ''),
          deckId,
          row.version || 1,
          row.deck_json || op.originalDeckJson,
          getDeckCards({ deck_json: row.deck_json || op.originalDeckJson }).length,
          userId,
        ]
      );
    } catch {
      // Version history is optional in older dev schemas.
    }

    const proposed = JSON.parse(op.proposedDeckJson);
    proposed.ai = {
      ...(proposed.ai || {}),
      lastResolvedOperationId: operationId,
      reviewState: 'clean',
    };
    proposed.updated_at = new Date().toISOString();

    await dbRun(
      `UPDATE presentation_decks SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(proposed), nextVersion, deckId, orgId]
    );
    await resolveAiOperation(operationId, 'applied', nextVersion);
    await recordPresentationRuntimeEvent({
      organizationId: orgId,
      deckId,
      userId,
      eventType: 'agent_edit_applied',
      status: 'applied',
      scope: String((op.diff as any)?.editPlan?.scope || 'global'),
      metadata: {
        operationId,
        versionAfter: nextVersion,
        actionCount: Array.isArray(op.actions) ? op.actions.length : 0,
      },
    });
    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'approve',
      resourceType: 'presentation_deck_agent_edit',
      resourceId: operationId,
      after: { versionAfter: nextVersion },
      metadata: {
        organizationId: orgId,
        deckId,
        scope: String((op.diff as any)?.editPlan?.scope || 'global'),
        actionCount: Array.isArray(op.actions) ? op.actions.length : 0,
      },
    });

    res.json({
      success: true,
      data: {
        deck: proposed,
        operationId,
        appliedActions: op.actions,
        reply: op.reply,
        version: nextVersion,
      },
    });
  })
);

router.post(
  '/decks/:deckId/agent-edit/:operationId/reject',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_approve')) return;
    const { deckId, operationId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const op = await getAiOperation(operationId);
    if (!op || op.deckId !== deckId || op.organizationId !== orgId) {
      return res.status(404).json({ success: false, error: 'AI proposal not found' });
    }
    await resolveAiOperation(operationId, 'rejected');
    await recordPresentationRuntimeEvent({
      organizationId: orgId,
      deckId,
      userId,
      eventType: 'agent_edit_rejected',
      status: 'rejected',
      scope: String((op.diff as any)?.editPlan?.scope || 'global'),
      metadata: { operationId },
    });
    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'reject',
      resourceType: 'presentation_deck_agent_edit',
      resourceId: operationId,
      metadata: {
        organizationId: orgId,
        deckId,
        scope: String((op.diff as any)?.editPlan?.scope || 'global'),
      },
    });
    res.json({ success: true, data: { operationId, status: 'rejected' } });
  })
);

router.get(
  '/decks/:deckId/governance-card',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const callerRole = (req as any).user?.role || (req as any).userRole || null;
    const windowDays = Math.min(Math.max(Number(req.query.windowDays) || 7, 1), 90);
    const cutoffIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    const deckRow = (await dbGet(
      `SELECT id, confidentiality, deck_json FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [deckId, orgId]
    )) as any;
    if (!deckRow) return res.status(404).json({ success: false, error: 'Deck not found' });

    let qualityReport: any = null;
    try {
      const { checkDeckQualityGates } = await import('../services/presentationQualityGatesService.js');
      qualityReport = await checkDeckQualityGates(orgId, String(deckId));
    } catch (error) {
      logger.warn('[Presentations] Quality gates failed during governance-card build', error);
    }

    let telemetryRollup: ReturnType<typeof buildPresentationRuntimeRollup> | null = null;
    try {
      const rows = (await dbAll(
        `SELECT id, organization_id, deck_id, user_id, event_type, status, scope, metadata_json, created_at
         FROM presentation_runtime_events
         WHERE organization_id = ? AND deck_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 1000`,
        [orgId, deckId, cutoffIso]
      )) as PresentationRuntimeEventRow[];
      telemetryRollup = buildPresentationRuntimeRollup({ rows: rows || [], windowDays });
    } catch (error) {
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] Telemetry load failed during governance-card build', error);
      }
    }

    const confidentialityLevel = (() => {
      const direct = String(deckRow?.confidentiality || '').toLowerCase();
      if (direct === 'public' || direct === 'internal' || direct === 'confidential') return direct as any;
      try {
        const parsed = deckRow?.deck_json ? JSON.parse(deckRow.deck_json) : null;
        const meta = String(parsed?.meta?.confidentiality || '').toLowerCase();
        if (meta === 'public' || meta === 'internal' || meta === 'confidential') return meta as any;
      } catch {
        // ignore
      }
      return 'internal';
    })();

    const card = buildPresentationGovernanceCard({
      deckId: String(deckId),
      qualityReport,
      confidentialityLevel,
      callerRole: callerRole ? String(callerRole) : null,
      telemetryRollup: telemetryRollup
        ? {
            windowDays: telemetryRollup.windowDays,
            totals: telemetryRollup.totals,
            lastActivityAt: telemetryRollup.lastActivityAt,
          }
        : null,
    });

    res.json({ success: true, data: card });
  })
);

router.get(
  '/governance/watchlist',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const callerRole = (req as any).user?.role || (req as any).userRole || null;

    const onlyBlockedRaw = String(req.query.onlyBlocked ?? 'true').toLowerCase();
    const onlyBlocked = onlyBlockedRaw !== 'false';
    const limitRaw = Number(req.query.limit);
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : 50, 1),
      200
    );

    const WINDOW_DAYS = 7;
    const cutoffIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

    let deckRows: any[] = [];
    try {
      deckRows = (await dbAll(
        `SELECT id, title, deck_json, confidentiality, updated_at
         FROM presentation_decks
         WHERE organization_id = ?
         ORDER BY updated_at DESC
         LIMIT 200`,
        [orgId]
      )) as any[];
    } catch (error) {
      if (isSchemaMissingError(error)) {
        try {
          deckRows = (await dbAll(
            `SELECT id, title, deck_json, updated_at
             FROM presentation_decks
             WHERE organization_id = ?
             ORDER BY updated_at DESC
             LIMIT 200`,
            [orgId]
          )) as any[];
        } catch (innerError) {
          logger.warn(
            '[Presentations] Could not load decks for governance watchlist',
            innerError
          );
          return res.status(500).json({
            success: false,
            error: 'Failed to load decks for governance watchlist',
          });
        }
      } else {
        logger.warn('[Presentations] Could not load decks for governance watchlist', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to load decks for governance watchlist',
        });
      }
    }

    const { checkDeckQualityGates } = await import(
      '../services/presentationQualityGatesService.js'
    );

    const warnings: string[] = [];
    const inputs: WatchlistEntryInput[] = [];

    for (const deckRow of deckRows || []) {
      const deckId = String(deckRow?.id || '');
      if (!deckId) continue;
      const title = typeof deckRow?.title === 'string' ? deckRow.title : 'Untitled deck';
      const updatedAt =
        typeof deckRow?.updated_at === 'string' ? deckRow.updated_at : null;
      const confidentialityLevel = resolvePresentationDeckConfidentiality(deckRow);

      try {
        let qualityReport: any = null;
        try {
          qualityReport = await checkDeckQualityGates(orgId, deckId);
        } catch (error) {
          logger.warn(
            `[Presentations] Quality gates failed for deck ${deckId} during watchlist build`,
            error
          );
        }

        let telemetryRollup: ReturnType<typeof buildPresentationRuntimeRollup> | null = null;
        try {
          const rows = (await dbAll(
            `SELECT id, organization_id, deck_id, user_id, event_type, status, scope, metadata_json, created_at
             FROM presentation_runtime_events
             WHERE organization_id = ? AND deck_id = ? AND created_at >= ?
             ORDER BY created_at DESC
             LIMIT 1000`,
            [orgId, deckId, cutoffIso]
          )) as PresentationRuntimeEventRow[];
          telemetryRollup = buildPresentationRuntimeRollup({
            rows: rows || [],
            windowDays: WINDOW_DAYS,
          });
        } catch (error) {
          if (!isSchemaMissingError(error)) {
            logger.warn(
              `[Presentations] Telemetry load failed for deck ${deckId} during watchlist build`,
              error
            );
          }
        }

        const card = buildPresentationGovernanceCard({
          deckId,
          qualityReport,
          confidentialityLevel,
          callerRole: callerRole ? String(callerRole) : null,
          telemetryRollup: telemetryRollup
            ? {
                windowDays: telemetryRollup.windowDays,
                totals: telemetryRollup.totals,
                lastActivityAt: telemetryRollup.lastActivityAt,
              }
            : null,
        });

        inputs.push({
          deckId,
          title,
          confidentialityLevel,
          updatedAt,
          card: {
            overallVerdict: card.overallVerdict,
            quality: {
              p0: card.quality.p0,
              p1: card.quality.p1,
              p2: card.quality.p2,
              gateCount: card.quality.gateCount,
            },
            telemetry: {
              exportsBlocked: card.telemetry.exportsBlocked,
              lastActivityAt: card.telemetry.lastActivityAt,
            },
          },
        });
      } catch (error) {
        const reason =
          (error as any)?.message
            ? String((error as any).message)
            : 'governance_card_build_failed';
        warnings.push(`deck ${deckId}: ${reason}`);
        inputs.push({
          deckId,
          title,
          confidentialityLevel,
          updatedAt,
          card: {
            overallVerdict: 'INCONCLUSIVE',
            quality: { p0: 0, p1: 0, p2: 0, gateCount: 0 },
            telemetry: { exportsBlocked: 0, lastActivityAt: null },
          },
        });
      }
    }

    const watchlist = buildPresentationGovernanceWatchlist(inputs, { onlyBlocked, limit });

    const entries = watchlist.entries.map((entry) => ({
      deckId: entry.deckId,
      title: entry.title,
      confidentialityLevel: entry.confidentialityLevel,
      updatedAt: entry.updatedAt,
      overallVerdict: entry.card.overallVerdict,
      p0: entry.card.quality.p0,
      p1: entry.card.quality.p1,
      p2: entry.card.quality.p2,
      gateCount: entry.card.quality.gateCount,
      exportsBlocked: entry.card.telemetry.exportsBlocked,
      lastActivityAt: entry.card.telemetry.lastActivityAt,
      severityScore: entry.severityScore,
    }));

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        totals: watchlist.totals,
        entries,
        ...(warnings.length > 0 ? { warnings } : {}),
        appliedFilters: { onlyBlocked, limit },
      },
    });
  })
);

router.get(
  '/decks/:deckId/audit-log',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1),
      500
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    const [deckLevel, agentLevel] = await Promise.all([
      auditEventsService.query({
        resourceType: 'presentation_deck',
        resourceId: deckId,
        organizationId: orgId,
        limit: 500,
        offset: 0,
      }),
      auditEventsService.query({
        resourceType: 'presentation_deck_agent_edit',
        organizationId: orgId,
        limit: 500,
        offset: 0,
      }),
    ]);

    const agentForDeck = (agentLevel.data || []).filter((row: any) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      return meta.deckId === deckId;
    });

    const merged = [...(deckLevel.data || []), ...agentForDeck]
      .map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        actorId: row.actorId ?? null,
        actorType: row.actorType ?? 'SYSTEM',
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        scope:
          (row.metadata && typeof row.metadata === 'object' && (row.metadata.scope as string)) ||
          null,
        operationId:
          row.resourceType === 'presentation_deck_agent_edit' ? row.resourceId : null,
        summary: buildAuditEventSummary(row),
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
      }))
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        deckId,
        total: (deckLevel.total || 0) + agentForDeck.length,
        limit,
        offset,
        events: merged,
      },
    });
  })
);

router.get(
  '/decks/:deckId/agent-history',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1),
      200
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    try {
      const rows = (await dbAll(
        `SELECT id, deck_id, organization_id, user_id, operation_type, status, prompt, reply,
                actions_json, diff_json, version_before, version_after, created_at, resolved_at
         FROM presentation_ai_operations
         WHERE deck_id = ? AND organization_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [deckId, orgId, limit, offset]
      )) as Array<Record<string, any>>;

      let total = 0;
      try {
        const totalRow = (await dbGet(
          `SELECT COUNT(*) AS c FROM presentation_ai_operations WHERE deck_id = ? AND organization_id = ?`,
          [deckId, orgId]
        )) as Record<string, any> | null;
        if (totalRow) {
          const raw = (totalRow as any).c ?? (totalRow as any).count ?? (totalRow as any)['COUNT(*)'];
          const parsed = Number(raw);
          total = Number.isFinite(parsed) ? parsed : 0;
        }
      } catch (countError) {
        if (!isSchemaMissingError(countError)) {
          logger.warn('[Presentations] Could not count agent history rows', countError);
        }
      }

      const operations = (rows || []).map((row) => {
        let actions: string[] = [];
        try {
          const parsedActions = row.actions_json ? JSON.parse(row.actions_json) : [];
          if (Array.isArray(parsedActions)) {
            actions = parsedActions.map((entry) =>
              typeof entry === 'string' ? entry : String(entry)
            );
          }
        } catch {
          actions = [];
        }

        let diffRaw: Record<string, any> = {};
        try {
          const parsedDiff = row.diff_json ? JSON.parse(row.diff_json) : {};
          if (parsedDiff && typeof parsedDiff === 'object' && !Array.isArray(parsedDiff)) {
            diffRaw = parsedDiff as Record<string, any>;
          }
        } catch {
          diffRaw = {};
        }

        const slides = Array.isArray(diffRaw.slides) ? diffRaw.slides : undefined;
        const editPlan = diffRaw.editPlan;

        const numericOrNull = (value: unknown): number | null =>
          typeof value === 'number' && Number.isFinite(value) ? value : null;
        const numericOrZero = (value: unknown): number =>
          typeof value === 'number' && Number.isFinite(value) ? value : 0;

        return {
          id: String(row.id),
          deckId: String(row.deck_id),
          status: String(row.status || 'draft'),
          operationType: String(row.operation_type || 'agent_edit'),
          prompt: row.prompt ?? null,
          reply: row.reply ?? null,
          actions,
          versionBefore: numericOrNull(row.version_before),
          versionAfter: numericOrNull(row.version_after),
          createdAt: row.created_at ?? null,
          resolvedAt: row.resolved_at ?? null,
          diff: {
            cardsBefore: numericOrNull(diffRaw.cardsBefore),
            cardsAfter: numericOrNull(diffRaw.cardsAfter),
            cardsAdded: numericOrZero(diffRaw.cardsAdded),
            cardsRemoved: numericOrZero(diffRaw.cardsRemoved),
            changedCards: numericOrZero(diffRaw.changedCards),
            slides,
            editPlan,
          },
        };
      });

      return res.json({
        success: true,
        data: {
          deckId,
          total,
          limit,
          offset,
          operations,
        },
      });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.json({
          success: true,
          data: {
            deckId,
            total: 0,
            limit,
            offset,
            operations: [],
            warnings: ['schema_missing_ai_operations'],
          },
        });
      }
      logger.warn('[Presentations] Could not load agent history', error);
      return res.json({
        success: true,
        data: {
          deckId,
          total: 0,
          limit,
          offset,
          operations: [],
          warnings: ['agent_history_load_failed'],
        },
      });
    }
  })
);

router.get(
  '/decks/:deckId/runtime-events/summary',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const windowDays = Math.min(Math.max(Number(req.query.windowDays) || 7, 1), 90);
    const cutoffIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    try {
      const rows = (await dbAll(
        `SELECT id, organization_id, deck_id, user_id, event_type, status, scope, metadata_json, created_at
         FROM presentation_runtime_events
         WHERE organization_id = ? AND deck_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 1000`,
        [orgId, deckId, cutoffIso]
      )) as PresentationRuntimeEventRow[];
      const rollup = buildPresentationRuntimeRollup({ rows: rows || [], windowDays });
      res.json({ success: true, data: rollup });
    } catch (error: any) {
      if (isSchemaMissingError(error)) {
        return res.json({
          success: true,
          data: buildPresentationRuntimeRollup({ rows: [], windowDays }),
          degraded: true,
          reason: 'telemetry_schema_missing',
        });
      }
      logger.warn('[Presentations] Could not load runtime events summary', error);
      res.status(500).json({ success: false, error: 'Failed to load runtime events summary' });
    }
  })
);

router.get(
  '/decks/:deckId/runtime-events',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const eventTypeParam = String(req.query.eventType || '').trim();
    const sinceParam = String(req.query.since || '').trim();

    const conditions: string[] = ['organization_id = ?', 'deck_id = ?'];
    const params: any[] = [orgId, deckId];
    if (eventTypeParam) {
      conditions.push('event_type = ?');
      params.push(eventTypeParam);
    }
    if (sinceParam && !Number.isNaN(Date.parse(sinceParam))) {
      conditions.push('created_at >= ?');
      params.push(new Date(sinceParam).toISOString());
    }
    params.push(limit);

    try {
      const rows = (await dbAll(
        `SELECT id, organization_id, deck_id, user_id, event_type, status, scope, metadata_json, created_at
         FROM presentation_runtime_events
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT ?`,
        params
      )) as any[];
      const events = (rows || []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        deckId: row.deck_id,
        userId: row.user_id,
        eventType: row.event_type,
        status: row.status,
        scope: row.scope,
        metadata: (() => {
          try {
            return JSON.parse(row.metadata_json || '{}');
          } catch {
            return {};
          }
        })(),
        createdAt: row.created_at,
      }));
      res.json({ success: true, data: events });
    } catch (error: any) {
      if (isSchemaMissingError(error)) {
        return res.json({ success: true, data: [], degraded: true, reason: 'telemetry_schema_missing' });
      }
      logger.warn('[Presentations] Could not load runtime events', error);
      res.status(500).json({ success: false, error: 'Failed to load runtime events' });
    }
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

    const { checkDeckQualityGates } =
      await import('../services/presentationQualityGatesService.js');
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
    if (!ensurePresentationCapability(req, res, 'presentation_export')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const authReq = req as any;
    const roleKey = authReq.user?.role ? String(authReq.user.role) : null;
    if (!(await enforceNoLegalHold(res, orgId, 'Presentation PNG export'))) return;

    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId: orgId,
      originRuntime: 'presentation',
      originRecordId: String(deckId || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const deck = await dbGet(
      'SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    if (!ensureConfidentialityPolicy(req, res, { action: 'export', deck })) return;

    const quality = await enforceQualityGateForExport({
      organizationId: orgId,
      deckId: String(deckId || ''),
      format: 'png',
      allowOverride: String(req.query.overrideQualityGate || '') === 'true',
    });
    if (!quality.ok) {
      await recordPresentationRuntimeEvent({
        organizationId: orgId,
        deckId: String(deckId || ''),
        userId,
        eventType: 'export_blocked',
        status: quality.report?.result || 'blocked',
        scope: 'global',
        metadata: {
          format: 'png',
          gateCount: Array.isArray(quality.report?.gates) ? quality.report.gates.length : 0,
        },
      });
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        format: 'png',
        status: 'blocked',
        qualityReport: quality.report,
        errorCategory: 'quality_gate_blocked',
      });
      return res.status(quality.status).json(quality.payload);
    }

    const deckData: any = normalizeDeckDocument(deck) || {};
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
      const pngBuffer = await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();

      archive.append(Readable.from(pngBuffer), {
        name: `${String(i + 1).padStart(2, '0')}_${safeName}.png`,
      });
    }

    await archive.finalize();
    await recordPresentationExportRecord({
      organizationId: orgId,
      userId,
      deckId: String(deckId || ''),
      format: 'png',
      status: 'completed',
      qualityReport: quality.report,
      filePath: null,
    });
  })
);

function renderCardToSvg(card: any, index: number, deckTitle: string, theme: string): string {
  const bgColor = theme === 'minimal' ? '#FFFFFF' : theme === 'modern' ? '#0F172A' : '#1E293B';
  const textColor = theme === 'minimal' ? '#1E293B' : '#F1F5F9';
  const accentColor = theme === 'modern' ? '#8B5CF6' : '#6366F1';

  const title = escapeXml(card.title || card.key_message || `Slide ${index + 1}`);
  const subtitle = escapeXml(deckTitle);
  const footer = card.header_footer;
  const footerText = footer
    ? `${String(footer.confidentiality || 'internal').toUpperCase()} · ${String(footer.footerText || 'Consultify')} · ${footer.pageNumber || index + 1}/${footer.totalPages || ''}`
    : String(index + 1);

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
  <text x="120" y="1020" font-size="14" fill="${textColor}" opacity="0.45" font-family="Arial, Helvetica, sans-serif">${escapeXml(footerText)}</text>
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
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// G3: SHARE ANALYTICS
// ============================================================

router.post(
  '/decks/:deckId/analytics/view',
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const { viewerToken, cardIndex, durationMs } = req.body;

    const deckOwner = await dbGet('SELECT id FROM presentation_decks WHERE id = ?', [deckId]);
    if (!deckOwner) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

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
  return createHash('sha256')
    .update(ip + 'consultify-salt')
    .digest('hex')
    .slice(0, 16);
}

// ============================================================
// VERSION HISTORY (P20 §2.6 — server-side revert)
// ============================================================

router.get(
  '/decks/:deckId/versions',
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const orgId = getOrgId(req);

    const deck = await dbGet(
      'SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );
    if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

    try {
      const versions = await dbAll(
        `SELECT id, deck_id, version, slide_count, created_by, created_at
         FROM presentation_deck_versions
         WHERE deck_id = ?
         ORDER BY version DESC
         LIMIT 50`,
        [deckId]
      );
      res.json({ success: true, data: versions || [] });
    } catch {
      res.json({ success: true, data: [] });
    }
  })
);

router.post(
  '/decks/:deckId/versions/:versionId/restore',
  asyncHandler(async (req, res) => {
    const { deckId, versionId } = req.params;
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const deck = (await dbGet(
      'SELECT id, version, deck_json FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    )) as any;
    if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

    let versionRow: any;
    try {
      versionRow = await dbGet(
        'SELECT * FROM presentation_deck_versions WHERE id = ? AND deck_id = ?',
        [versionId, deckId]
      );
    } catch {
      return res.status(404).json({ success: false, error: 'Version history not available' });
    }
    if (!versionRow) return res.status(404).json({ success: false, error: 'Version not found' });

    const newVersion = (deck.version || 1) + 1;

    if (deck.deck_json) {
      try {
        await dbRun(
          `INSERT INTO presentation_deck_versions (id, deck_id, version, deck_json_snapshot, slide_count, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [uuidv4().replace(/-/g, ''), deckId, deck.version, deck.deck_json, 0, userId]
        );
      } catch {
        /* non-blocking */
      }
    }

    await dbRun(
      `UPDATE presentation_decks SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [versionRow.deck_json_snapshot, newVersion, deckId, orgId]
    );

    res.json({ success: true, version: newVersion, restoredFromVersion: versionRow.version });
  })
);

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
