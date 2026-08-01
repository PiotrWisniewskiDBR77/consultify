/**
 * Presentations Routes — Bundle 17 (T058 + T059)
 * Deck generation, templates, brand kits, export.
 */

// MAT-010: top-level import, NOT an inline `require('crypto')`. This file's
// existing `hashIp()` uses the require() form, which throws
// "ReferenceError: require is not defined" under the real ESM dev server
// (found the hard way in MAT-006). That latent bug is out of MAT-010's
// boundary and is left untouched — but not repeated here.
import { createHash } from 'crypto';
import { type NextFunction, type Request, type Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';

import { verifyToken } from '../middleware/auth.middleware.js';
import { sanitizeOrgIdForUploadPath } from '../middleware/fileUpload.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import auditEventsService from '../services/AuditEventsService.js';
import {
  createDeckComment,
  DeckCommentError,
  deleteDeckComment,
  ensureDeckCommentsHydrated,
  getDeckCommentCounts,
  listDeckCommentThreads,
  replyToDeckComment,
  setDeckCommentResolved,
} from '../services/deckCommentsService.js';
// MAT-010 — canonical artifact lineage. `created` (below) and `public_open`
// hooks stay on the fail-open `...Safe` variant — see their own comments for
// why. Every OTHER event type uses `...Tracked` (Codex review, second round)
// — see `respondIfLineageLost` below for why those sites CAN'T stay fire-open.
import {
  cancelPendingLineageIntent,
  deriveCreatedEventIdempotencyKey,
  preflightStreamingExportIntent,
  recordLineageEventSafe,
  recordLineageEventTracked,
} from '../services/lineage/artifactLineageService.js';
import {
  isTemplateResolveError,
  resolvePresentationTemplateForCreation,
  type TemplateResolveErrorCode,
} from '../services/materials/creationIntent.js';
import { send as sendNotification } from '../services/notificationService.js';
import { uploadMedia as uploadOrganizationMedia } from '../services/organizationMediaService.js';
import { OrgPoliciesError, requireNoLegalHold } from '../services/OrgPoliciesService.js';
import {
  hasPresentationCapability,
  type PresentationCapability,
} from '../services/presentationAccessPolicyService.js';
import {
  applyPresentationEditPlan,
  parsePresentationEditIntent,
} from '../services/presentationAgentEditService.js';
import {
  buildPlaygroundDispatchPlan,
  type PlaygroundSeverity,
  verifyInboxRequest,
} from '../services/presentationAlertPlaygroundService.js';
import { buildAuditIntegrityReport } from '../services/presentationAuditIntegrityService.js';
import {
  type BenchmarkRunRecord,
  listBenchmarkRunHistory,
} from '../services/presentationBenchmarkScorecardService.js';
import {
  buildBenchmarkTrendReport,
  DEFAULT_WINDOW_MONTHS as TREND_DEFAULT_WINDOW_MONTHS,
  loadRecentBenchmarkRuns,
  MAX_WINDOW_MONTHS as TREND_MAX_WINDOW_MONTHS,
} from '../services/presentationBenchmarkTrendService.js';
import {
  isPresentationActionAllowedByConfidentiality,
  normalizePresentationRole,
  resolvePresentationDeckConfidentiality,
} from '../services/presentationConfidentialityPolicyService.js';
import {
  type BulkRevertOpRow,
  evaluateBulkRevertEligibility,
  planBulkRevert,
} from '../services/presentationDeckBulkRevertService.js';
import {
  type CollaboratorRole,
  isValidRole,
  listCollaborators,
  permissionToRole,
  revokeCollaborator,
  upsertCollaborator,
} from '../services/presentationDeckCollaboratorService.js';
import { buildDeckDiffSummary } from '../services/presentationDeckDiffSummaryService.js';
import {
  buildDeckDocumentFromStructuredSlides,
  deckDocumentToRenderableUnifiedJson,
  normalizeDeckDocument,
  resolveDeckContentCoherence,
  type StructuredSlideInput,
} from '../services/presentationDeckDocumentService.js';
import {
  evaluateRevertEligibility,
  type RevertEligibilityReason,
} from '../services/presentationDeckRevertService.js';
import { buildParityReportForDeck } from '../services/presentationExportParityService.js';
import type { DeckSetup } from '../services/presentationGeneratorService.js';
import { generateDeck, generateOutline } from '../services/presentationGeneratorService.js';
import {
  type AlertSeverity,
  dispatchAlertsForTransition,
  listActiveSubscriptions,
  maskTarget,
} from '../services/presentationGovernanceAlertService.js';
import {
  issueSubscriberDashboardToken,
  rotateSubscriptionSecret,
  sendTestDelivery,
} from '../services/presentationGovernanceAlertSubscriberService.js';
import { buildPresentationGovernanceCard } from '../services/presentationGovernanceCardService.js';
import {
  buildPresentationGovernanceWatchlist,
  type WatchlistEntryInput,
} from '../services/presentationGovernanceWatchlistService.js';
import {
  type AnomalyContext,
  type AnomalySample,
  type DetectableSloId,
  detectAnomaliesForReport,
} from '../services/presentationOperationsAnomalyDetectionService.js';
import {
  type BuildSloDrilldownInput,
  buildSloDrilldownReport,
  type DrilldownSloId,
} from '../services/presentationOperationsHealthDrilldownService.js';
import {
  renderOperationsHealthHtml,
  renderOperationsHealthPdf,
} from '../services/presentationOperationsHealthPdfService.js';
import {
  type BuildOperationsHealthInput,
  buildOperationsHealthReport,
  type OperationsHealthAnomaly,
  type OperationsHealthReport,
} from '../services/presentationOperationsHealthService.js';
import {
  buildPresentationRuntimeRollup,
  type PresentationRuntimeEventRow,
} from '../services/presentationRuntimeRollupService.js';
import { writePresentationRuntimeEvent } from '../services/presentationRuntimeTelemetryService.js';
import {
  buildSubscriberDashboardSnapshot,
  hashToken,
} from '../services/presentationSubscriberDashboardService.js';
import {
  listSubscriberTokens,
  revokeSubscriberToken,
} from '../services/presentationSubscriberTokenManagementService.js';
import { normalizeTemplatePayload } from '../services/presentationTemplateCompatibilityService.js';
import {
  draftPresentationTemplateAsync,
  type PresentationTemplateDraftInput,
} from '../services/presentationTemplateDraftService.js';
import {
  applyLifecycleTransition,
  assertEditableLifecycle,
  computeLineageForClone,
  deprecateTemplate as deprecateTemplateGovernance,
  fetchLineageChain,
  listGovernanceEvents,
  listTemplatesByState,
  recordGovernanceEvent,
  type TemplateLifecycleState,
} from '../services/presentationTemplateGovernanceService.js';
import { mapOutlineBlueprintToDeckSlides } from '../services/presentationTemplateRuntimeService.js';
import {
  comparePresetsByName,
  normalizePresetFilters,
  validatePresetCreateInput,
  type WatchlistPreset,
  type WatchlistPresetFilters,
} from '../services/presentationWatchlistPresetService.js';
import {
  createSavedSearch as createWatchlistSavedSearch,
  deleteSavedSearch as deleteWatchlistSavedSearch,
  listSavedSearches as listWatchlistSavedSearches,
  markUsed as markWatchlistSavedSearchUsed,
} from '../services/presentationWatchlistSavedSearchService.js';
import {
  applyPdfLayoutTruncationMarker,
  buildPdfLayoutTruncationMarker,
} from '../services/report/pdf/PdfLayoutTruncationMarker.js';
import { PptxPipelineService } from '../services/report/pptx/PptxPipelineService.js';
import { getStorage } from '../services/storage/index.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import { applyExportApprovalGate } from '../services/v8/exportApprovalGate.js';
import * as reportsPresModelService from '../services/v8/reportsPresModelService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { exportsDir } from '../utils/storagePaths.js';
import { canOverrideQualityGate, enforceQualityGateForExport } from './presentationExportGate.js';

const router = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

type SubscriberDashboardTokenRow = {
  id: string;
  subscription_id: string;
  organization_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type SubscriberDashboardSubscriptionRow = {
  id: string;
  channel: string;
  target: string;
  min_severity: string;
  active: unknown;
  signing_secret_rotated_at: string | null;
};

type SubscriberDashboardDispatchRow = {
  id: string;
  created_at: string;
  status: string;
  http_status: number | null;
  to_verdict: string;
  deck_id: string | null;
  signature_present: unknown;
  signature_algorithm: string | null;
};

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function getUserId(req: any): string {
  return req.user?.id || req.userId || 'system';
}

// R11 deck slice (2026-07-26) — same code→HTTP mapping as
// document-studio.routes.ts's TEMPLATE_RESOLVE_STATUS (kept as its own const
// here since the two routers don't share a common base module).
const TEMPLATE_RESOLVE_STATUS: Record<TemplateResolveErrorCode, number> = {
  TEMPLATE_NOT_INDEXED: 404,
  TEMPLATE_ORPHANED: 404,
  TEMPLATE_FORBIDDEN: 403,
  TEMPLATE_DEPRECATED: 409,
  TEMPLATE_FORMAT_UNSUPPORTED: 422,
};

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

/**
 * MAT-010 (Codex review, second round) — the closing half of the durability
 * fix. `recordLineageEventTracked` tells the truth about whether an event's
 * intent survived ANYWHERE (direct write or the durable pending/outbox
 * fallback). When it did not — a genuine double failure — the calling route
 * must not report unconditional success (the business mutation already
 * committed and is NOT rolled back; only the HTTP response is honest about
 * the audit trail). Returns `true` when the caller should send this 500 and
 * stop; `false` when the caller should proceed with its normal response.
 *
 * Mirrors `workbook.routes.ts`'s function of the same name exactly (same
 * signature, same body, same status code/shape) — kept as a local copy
 * rather than a shared import because both route files are independently
 * frozen modules and this durability fix must not introduce a new
 * cross-route dependency.
 *
 * Client-retry safety after this 500 is verified per event type at each call
 * site's own comment, not assumed uniformly — see
 * `recordLineageEventTracked`'s doc comment in artifactLineageService.ts for
 * the full reasoning (CAS guard on version/restore; single-column overwrite,
 * not accumulation, on share_minted; already-idempotent share_revoked; no
 * persisted side effect on export — except the two streamed export sites
 * where the response is already committed by the time the hook runs, see
 * their own comments).
 */
function respondIfLineageLost(res: Response, outcome: { durable: boolean }): boolean {
  if (outcome.durable) return false;
  res.status(500).json({
    success: false,
    error: 'Lineage could not be durably recorded for this operation',
    code: 'LINEAGE_RECOVERY_REQUIRED',
  });
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
  // Codex review, third round (Blocker A) — when the caller already ran
  // `preflightStreamingExportIntent` before streaming began (PDF/PNG), these
  // thread the SAME idempotency key / occurredAt through so this
  // post-stream call converges on the pre-flight's durable pending row
  // instead of deriving an unrelated one. Omitted by every other caller —
  // `recordLineageEventTracked` derives its own when these are undefined,
  // unchanged from before this round.
  lineageIdempotencyKey?: string;
  lineageOccurredAt?: string;
}): Promise<{ durable: boolean } | null> {
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
    if (!isSchemaMissingError(error))
      logger.warn('[Presentations] Could not record export QA', error);
  }

  // MAT-010 lineage hook. Only a genuinely completed export becomes an
  // `export` lineage entry; failed/blocked attempts stay in
  // `presentation_export_records` where the QA detail belongs. `...Tracked`
  // (Codex review, second round): retry-safety verified — re-running an
  // export has no persisted side effect to duplicate, the file is simply
  // regenerated. IMPORTANT: this helper has no `res` of its own — it is
  // called from several route handlers below. Most call the lineage hook
  // BEFORE their response is sent and can gate on the returned outcome via
  // `respondIfLineageLost`; the pdf and png success paths call it AFTER
  // `doc.pipe(res)`/`archive.pipe(res)` have already streamed the response,
  // so they cannot act on `durable: false` — see their own comments for that
  // residual gap. Returns `null` (nothing to track/gate) for non-`completed`
  // statuses, unchanged from the prior behavior.
  if (params.status === 'completed') {
    return recordLineageEventTracked({
      organizationId: params.organizationId,
      artifactKind: 'presentation',
      sourceRecordId: params.deckId,
      eventType: 'export',
      actorUserId: params.userId || null,
      detail: { format: params.format },
      idempotencyKey: params.lineageIdempotencyKey,
      occurredAt: params.lineageOccurredAt,
    });
  }
  return null;
}

/**
 * MAT-010 — share-token digest for the lineage trail. The raw token is never
 * written to the lineage (mirrors `workbook.routes.ts`'s `hashShareToken`).
 */
function hashLineageShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
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

// P0 fix: on-disk PPTX is only rendered at deck-creation time. Autosave / agent-edit /
// AI-accept endpoints only persist `deck_json` (see PUT /decks/:deckId/autosave), so the
// file at `deck.export_path` silently drifts out of sync with the edited content. Before
// serving the download we re-render from the current `deck_json` whenever the deck was
// updated more recently than the exported file was written, then persist the refreshed
// file + `exported_at` so subsequent downloads (and the bundle/ZIP export, which reuses
// this same export_path) see the same up-to-date artifact.
async function regeneratePptxIfStale(deck: any): Promise<any> {
  try {
    if (!deck?.export_path) return deck;
    const exportPath = String(deck.export_path);
    const deckUpdatedAt = deck.updated_at ? new Date(deck.updated_at).getTime() : 0;
    if (!deckUpdatedAt || Number.isNaN(deckUpdatedAt)) return deck;

    let fileMtimeMs = 0;
    try {
      fileMtimeMs = fs.statSync(exportPath).mtimeMs;
    } catch {
      // Missing file is handled by the existing fs.existsSync() check downstream.
      return deck;
    }

    // Small tolerance to avoid re-render churn from clock/rounding skew between the
    // DB timestamp and the filesystem mtime for a file we just wrote ourselves.
    const STALE_TOLERANCE_MS = 2000;
    if (deckUpdatedAt <= fileMtimeMs + STALE_TOLERANCE_MS) return deck;

    const deckDocument = normalizeDeckDocument(deck);
    if (!deckDocument || !Array.isArray(deckDocument.cards) || deckDocument.cards.length === 0) {
      // Nothing renderable — leave the stale-but-existing file in place rather than
      // failing the download outright.
      return deck;
    }

    // Fix 2026-07-14 (dowód _DOWOD_DECK_PPTX_2026-07-14.md): re-rendering from the
    // flattened deck_json projection alone produced 8/12 "Render Error" slides,
    // because the flatten kept the slide intent but reduced content to
    // key_messages while PPTX layouts are intent-bound. Re-render instead from a
    // MERGE of `unified_json` (rich per-intent render model, written at
    // generation / regenerateSlide) with the edited cards from `deck_json`
    // (autosave / agent-edit write only deck_json) — fresh AND renderable.
    let baseUnified: any = null;
    try {
      baseUnified = deck.unified_json ? JSON.parse(String(deck.unified_json)) : null;
    } catch {
      baseUnified = null; // legacy/corrupt unified_json → coerced-flatten fallback
    }
    const unifiedJson = deckDocumentToRenderableUnifiedJson(deckDocument, baseUnified);
    const pipeline = new PptxPipelineService();
    // Validation is intentionally ON (skipValidation removed): the only
    // error-severity rules (missing intent/key_message/content, nameless
    // initiatives, empty deck) are integrity failures that would render broken
    // anyway. A validation throw lands in the catch below → the download keeps
    // serving the last-known-good file instead of a broken re-render.
    const result = await pipeline.generateFromUnifiedJson(unifiedJson, {
      template: (deckDocument.meta?.theme as any) || undefined,
      language: (deckDocument.meta?.language as any) || undefined,
      confidentiality: (deckDocument.meta?.confidentiality as any) || undefined,
    });

    // Render-integrity gate: never overwrite a good export with a deck that
    // contains fallback "Render Error" slides — serve the previous file instead.
    const renderFailures = result.warnings.filter((warning) => warning.includes('render failed'));
    if (renderFailures.length > 0) {
      logger.error('[Presentations] Stale-regen produced error slides; keeping previous export', {
        deckId: deck.id,
        renderFailures,
      });
      return deck;
    }

    fs.writeFileSync(exportPath, result.buffer);
    const exportedAtIso = new Date().toISOString();
    await dbRun(
      `UPDATE presentation_decks SET slide_count = ?, exported_at = ?, updated_at = updated_at WHERE id = ? AND organization_id = ?`,
      [result.slideCount, exportedAtIso, deck.id, deck.organization_id]
    );
    logger.info('[Presentations] Re-rendered stale PPTX export before download', {
      deckId: deck.id,
      slideCount: result.slideCount,
    });

    return { ...deck, exported_at: exportedAtIso, slide_count: result.slideCount };
  } catch (error) {
    // Regeneration failure must never block the download of the last-known-good file.
    logger.warn('[Presentations] PPTX re-render before download failed; serving existing file', {
      deckId: deck?.id,
      error: (error as any)?.message || error,
    });
    return deck;
  }
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

// MAT-006B — fail-closed count/content coherence on the canonical read path.
//
// AS-IS that produced the staging blocker: `slide_count` was echoed verbatim
// from the column while `normalizeDeckDocument()` silently returned `null` for
// a row with no `deck_json.cards` and no `unified_json.slides`. The response
// therefore claimed "11 slides" and delivered none, and the builder rendered
// "Card 1 of 0" with no explanation of why.
//
// The canonical GET now reports the DERIVED count (what it can actually serve)
// and states the content state explicitly. `content_state === 'missing'` always
// travels with `slide_count === 0`, so no consumer of this route can advertise
// slides that do not exist.
function normalizeDeckRow(row: any) {
  const coherence = resolveDeckContentCoherence(row);
  const canonicalDeck = coherence.document;
  return {
    ...row,
    deck_json: canonicalDeck ? JSON.stringify(canonicalDeck) : row.deck_json,
    slide_count: coherence.cardCount,
    declared_slide_count: coherence.declaredSlideCount,
    content_state: coherence.hasCanonicalContent ? 'canonical' : 'missing',
    source_artifacts: JSON.parse(row.source_artifacts || '[]'),
    source_refs: JSON.parse(row.source_refs_json || '[]'),
    outline_json: JSON.parse(row.outline_json || '[]'),
    validation_warnings: JSON.parse(row.validation_warnings || '[]'),
  };
}

// W9: strip tenant-identifying and internal fields before returning to unauthenticated callers
const PUBLIC_DECK_DENY_FIELDS = new Set([
  'organization_id',
  'confidentiality',
  'share_token',
  'share_created_by',
  'created_by',
  'updated_by',
  // MAT-006B — `declared_slide_count` is the raw column kept for internal
  // diagnostics (it is the number that can lie). A public share viewer has no
  // use for it and it exposes internal bookkeeping drift, so it is stripped.
  // `slide_count` (derived) and `content_state` DO stay: they are what let the
  // viewer say "this deck has no content" instead of rendering "Card 1 of 0".
  'declared_slide_count',
]);

function toPublicDeckRow(row: any) {
  const full = normalizeDeckRow(row);
  return Object.fromEntries(Object.entries(full).filter(([k]) => !PUBLIC_DECK_DENY_FIELDS.has(k)));
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

// MAT-007/009 root-cause fix (part 2): POST /decks and POST /decks/from-template
// build canonical deck_json (see buildDeckDocumentFromStructuredSlides above) but,
// unlike the AI generateDeck() pipeline (presentationGeneratorService.ts:2076-2127),
// never rendered a physical PPTX or set export_path — so GET /decks/:id/download
// (`if (!deck || !deck.export_path) return res.status(404)`) 404s for every deck
// created through these two routes, even after the content-shape fix above. This
// reuses the EXACT same render call the generator pipeline already makes
// (PptxPipelineService.generateFromUnifiedJson via deckDocumentToRenderableUnifiedJson)
// so the golden-flow export step works against a real, existing contract instead of
// a new one. Best-effort / non-fatal: a render failure must not fail deck creation —
// the deck is still fully usable in the builder; export can be retried by editing +
// re-triggering a stale re-render, or a future manual export attempt will just 404
// exactly as it did before this change, not worse.
async function renderInitialPptxForDeck(params: {
  deckId: string;
  organizationId: string;
  deckDocument: ReturnType<typeof buildDeckDocumentFromStructuredSlides>;
}): Promise<void> {
  try {
    if (!Array.isArray(params.deckDocument.cards) || params.deckDocument.cards.length === 0) {
      return;
    }
    const unifiedJson = deckDocumentToRenderableUnifiedJson(params.deckDocument, null);
    const pipeline = new PptxPipelineService();
    const result = await pipeline.generateFromUnifiedJson(unifiedJson, {
      template: (params.deckDocument.meta?.theme as any) || undefined,
      language: (params.deckDocument.meta?.language as any) || undefined,
      confidentiality: (params.deckDocument.meta?.confidentiality as any) || undefined,
    });
    const exportDir = exportsDir('presentations');
    const exportPath = path.join(exportDir, `${params.deckId}.pptx`);
    fs.mkdirSync(exportDir, { recursive: true });
    fs.writeFileSync(exportPath, result.buffer);
    await dbRun(
      `UPDATE presentation_decks SET export_path = ?, export_format = 'pptx', exported_at = CURRENT_TIMESTAMP, updated_at = updated_at WHERE id = ? AND organization_id = ?`,
      [exportPath, params.deckId, params.organizationId]
    );
  } catch (renderErr) {
    logger.warn('[presentations] initial PPTX render failed (non-fatal, deck still usable)', {
      deckId: params.deckId,
      error: (renderErr as any)?.message || renderErr,
    });
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

  // MAT-010 lineage hook (fail-open) — head of the lineage chain for decks.
  // Placed inside this shared helper so BOTH deck-creation call sites are
  // covered by one insertion, and after `registerArtifactOrigin` above so the
  // canonical artifact id resolves immediately.
  //
  // Fail-open matters especially here: both call sites wrap this helper in a
  // try/catch that DELETES the freshly created deck on throw. A lineage
  // failure must never trigger that rollback — hence `...Safe`, which never
  // throws.
  await recordLineageEventSafe({
    organizationId: params.organizationId,
    artifactKind: 'presentation',
    sourceRecordId: params.deckId,
    eventType: 'created',
    actorUserId: params.userId,
    titleSnapshot: params.title,
    idempotencyKey: deriveCreatedEventIdempotencyKey({
      artifactKind: 'presentation',
      sourceRecordId: params.deckId,
    }),
    sourceContext: {
      source: params.source ?? null,
      presentationMode: params.presentationMode ?? null,
      slideCount: params.slideCount ?? null,
    },
    detail: { status: params.status || 'draft' },
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
    if (!isSchemaMissingError(error))
      logger.warn('[Presentations] Could not persist AI operation', error);
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
    if (!isSchemaMissingError(error))
      logger.warn('[Presentations] Could not read AI operation', error);
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
    if (!isSchemaMissingError(error))
      logger.warn('[Presentations] Could not resolve AI operation', error);
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

/**
 * M09-H02 — strict, tenant-scoped read-back for `presentation_templates` writes.
 *
 * Deliberately NOT `getTemplateForOrgOrSystem`: that helper also matches system
 * rows (`organization_id IS NULL`), so it can confirm a row this org does not
 * own. A write may only be reported as successful when the row is durably
 * present AND owned by the writing organization.
 */
async function readBackOrgTemplate(templateId: string, organizationId: string) {
  return (await dbGet(`SELECT * FROM presentation_templates WHERE id = ? AND organization_id = ?`, [
    templateId,
    organizationId,
  ])) as any;
}

/**
 * M09-H02 — settle a `presentation_templates` write against durable state.
 *
 * `dbRun` defaults to `fallback: true` (see `DbPromise.run`), so a failed
 * statement RESOLVES `{ success: false }` instead of rejecting. Callers that
 * ignore the result answer 200 for a row that was never written.
 *
 * The driver acknowledgement is therefore treated as a hint, never as the
 * authority — the read-back is the authority:
 *
 *  - ack ok + row present   → success
 *  - ack failed + row present → success, logged. This is the retry/idempotency
 *    case scoped to this operation: a statement can commit and still report a
 *    failure (timeout fired after COMMIT). Failing closed there would orphan a
 *    row that genuinely exists, so the durable state wins.
 *  - row absent (any ack)   → fail closed. Never fabricate an envelope from the
 *    in-memory draft.
 */
async function settleTemplateWrite(
  operation: string,
  templateId: string,
  organizationId: string,
  ack: { success: boolean; error?: string } | null | undefined
): Promise<{ ok: true; row: any } | { ok: false; reason: string }> {
  const row = await readBackOrgTemplate(templateId, organizationId);
  if (!row) {
    return { ok: false, reason: ack?.error || 'row_not_persisted' };
  }
  if (!ack?.success) {
    logger.warn(
      `[Presentations] ${operation}: driver reported a failed write but the row is durably present — treating as committed`,
      { templateId, organizationId, driverError: ack?.error }
    );
  }
  return { ok: true, row };
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

// L-03 (M17): throttle the unauthenticated public viewer to blunt token
// brute-force / scraping. Defined here (before use) to avoid a TDZ on the
// shareRateLimiter declared further below for the authenticated mint/revoke.
const publicViewerLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});

router.get(
  '/shared/:token',
  publicViewerLimiter,
  asyncHandler(async (req, res) => {
    const row = (await dbGet(
      `SELECT *
       FROM presentation_decks
       WHERE share_token = ?
         AND (share_expires_at IS NULL OR share_expires_at > CURRENT_TIMESTAMP)`,
      [req.params.token]
    )) as any;

    // Single 404 surface for missing / revoked (token nulled) / expired — a
    // deliberate anti-enumeration choice (no 410), consistent with the M18
    // share design. A revoked link (DELETE /decks/:id/share) lands here as 404.
    if (!row) {
      return res.status(404).json({ success: false, error: 'Shared presentation not found' });
    }

    // MAT-010 lineage hook (fail-open). UNAUTHENTICATED request: the tenant
    // comes from the matched row (server-side), never from the requester, and
    // there is no actor. Placed after the row matched, so a revoked/expired/
    // unknown token — 404'd above — never produces a lineage entry.
    await recordLineageEventSafe({
      organizationId: String(row.organization_id),
      artifactKind: 'presentation',
      sourceRecordId: String(row.id),
      eventType: 'public_open',
      actorUserId: null,
      detail: { via: 'public_share_link' },
    });

    res.json({ success: true, data: toPublicDeckRow(row) });
  })
);

// ---------------------------------------------------------------------------
// Sprint 13: External Subscriber Dashboard (read-only, Bearer-token auth).
//
// This endpoint is intentionally registered BEFORE `router.use(verifyToken)`
// because external HMAC alert subscribers ("clients of clients") authenticate
// via a sha256-hashed subscription token from migration 765, NOT via the
// platform JWT. The companion ADMIN issuance endpoint lives adjacent to the
// Sprint 11 alert-subscription block below
// (`POST /governance/alert-subscriptions/:id/dashboard-tokens`) where the
// JWT-gated `presentation_edit` capability is enforced.
//
// Security invariants:
//   * Single-subscription scope — tokens are bound to one subscription_id;
//     the snapshot can never include other subscriptions or other orgs.
//   * No signing-secret echo — the snapshot exposes only `signature.algorithm`
//     and rotation timestamps; the raw secret is never read or returned.
//   * 401 on every failure path; reason is intentionally generic so we don't
//     leak whether the token was invalid, expired, revoked, or unknown.
//   * Schema-tolerant — when migration 765 has not been applied yet, returns
//     503 instead of 500 so platform availability isn't tied to migration
//     ordering.
// ---------------------------------------------------------------------------
router.get(
  '/governance/subscriber/dashboard',
  asyncHandler(async (req, res) => {
    const authHeader = String(req.get('authorization') || '');
    const match = /^Bearer\s+([0-9a-fA-F]+)\s*$/.exec(authHeader);
    if (!match) {
      return res.status(401).json({ status: 'unauthorized', reason: 'missing_or_malformed_token' });
    }
    const rawToken = match[1].toLowerCase();
    if (rawToken.length !== 64) {
      return res.status(401).json({ status: 'unauthorized', reason: 'invalid_token_format' });
    }

    const tokenHash = hashToken(rawToken);

    let tokenRow: SubscriberDashboardTokenRow | null = null;
    try {
      tokenRow = (await dbGet(
        `SELECT id, subscription_id, organization_id, expires_at, revoked_at
           FROM presentation_governance_subscriber_tokens
          WHERE token_hash = ?`,
        [tokenHash]
      )) as SubscriberDashboardTokenRow | null;
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({
          success: false,
          error: 'subscriber_tokens_table_missing',
          code: 'SCHEMA_NOT_READY',
          hint: 'apply migration 765_presentation_governance_subscriber_tokens.sql',
        });
      }
      logger.warn('[Presentations] subscriber dashboard token lookup failed', error);
      return res.status(401).json({ status: 'unauthorized', reason: 'token_lookup_failed' });
    }

    if (!tokenRow) {
      return res.status(401).json({ status: 'unauthorized', reason: 'token_not_found' });
    }
    if (tokenRow.revoked_at) {
      return res.status(401).json({ status: 'unauthorized', reason: 'token_revoked' });
    }
    const expiresMs = Date.parse(tokenRow.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      return res.status(401).json({ status: 'unauthorized', reason: 'token_expired' });
    }

    let subscriptionRow: SubscriberDashboardSubscriptionRow | null = null;
    try {
      subscriptionRow = (await dbGet(
        `SELECT id, channel, target, min_severity, active, signing_secret_rotated_at
           FROM presentation_governance_alert_subscriptions
          WHERE id = ? AND organization_id = ?`,
        [tokenRow.subscription_id, tokenRow.organization_id]
      )) as SubscriberDashboardSubscriptionRow | null;
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({
          success: false,
          error: 'alert_subscriptions_table_missing',
          code: 'SCHEMA_NOT_READY',
        });
      }
      logger.warn('[Presentations] subscriber dashboard subscription load failed', error);
      return res.status(401).json({ status: 'unauthorized', reason: 'subscription_load_failed' });
    }
    if (!subscriptionRow) {
      // The cascading FK in migration 765 means this should not normally
      // happen; if it does, treat as unauthorized rather than leaking a
      // subscription_id back to the caller.
      return res.status(401).json({ status: 'unauthorized', reason: 'subscription_missing' });
    }

    let dispatchRows: SubscriberDashboardDispatchRow[] = [];
    try {
      dispatchRows = (await dbAll(
        `SELECT id, created_at, status, http_status, to_verdict, deck_id,
                signature_present, signature_algorithm
           FROM presentation_governance_alert_dispatches
          WHERE subscription_id = ? AND organization_id = ?
          ORDER BY created_at DESC
          LIMIT 100`,
        [tokenRow.subscription_id, tokenRow.organization_id]
      )) as SubscriberDashboardDispatchRow[];
    } catch (error) {
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] subscriber dashboard dispatch load failed', error);
      }
      // Schema-tolerant: empty dispatch list is a legitimate snapshot input
      // (the snapshot will simply emit `health: healthy` with the "no recent
      // dispatches" warning for active subscriptions).
      dispatchRows = [];
    }

    try {
      await dbRun(
        `UPDATE presentation_governance_subscriber_tokens
            SET last_used_at = now()
          WHERE id = ?`,
        [tokenRow.id]
      );
    } catch (error) {
      // Non-fatal: failure to bump `last_used_at` should never block a
      // legitimate read. Silently swallow + warn so the dashboard remains
      // available during transient write failures.
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] subscriber dashboard last_used_at update failed', error);
      }
    }

    const snapshot = buildSubscriberDashboardSnapshot({
      subscription: {
        id: subscriptionRow.id,
        channel: String(subscriptionRow.channel || ''),
        target: String(subscriptionRow.target || ''),
        minSeverity: String(subscriptionRow.min_severity || ''),
        active:
          subscriptionRow.active === true ||
          subscriptionRow.active === 1 ||
          subscriptionRow.active === 'TRUE' ||
          subscriptionRow.active === 't' ||
          subscriptionRow.active === 'true',
        signingSecretRotatedAt: subscriptionRow.signing_secret_rotated_at,
      },
      // The DB query is `ORDER BY created_at DESC` (newest first) but
      // `buildSubscriberDashboardSnapshot` expects ASCENDING input so its
      // `consecutiveFailures` walk (from END of array) reflects the most
      // recent failures. Reverse here.
      dispatches: dispatchRows
        .map((row) => ({
          id: String(row.id),
          dispatchedAt: String(row.created_at || ''),
          status: String(row.status || ''),
          httpStatus:
            typeof row.http_status === 'number' && Number.isFinite(row.http_status)
              ? row.http_status
              : null,
          toVerdict: String(row.to_verdict || ''),
          deckId: typeof row.deck_id === 'string' ? row.deck_id : null,
          signaturePresent:
            row.signature_present === true ||
            row.signature_present === 1 ||
            row.signature_present === 't',
          signatureAlgorithm:
            typeof row.signature_algorithm === 'string' && row.signature_algorithm.length > 0
              ? row.signature_algorithm
              : null,
        }))
        .reverse(),
    });

    res.json({ success: true, data: snapshot });
  })
);

router.use(verifyToken);
router.use(requireOrgAccess());

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

/**
 * R11 deck slice (2026-07-26) — SERVER-SIDE template resolution for
 * "Użyj wzorca" on a PRESENTATION. Mirrors
 * `POST /document-studio/templates/resolve` 1:1 (see that route's doc
 * comment for the full rationale): the Template Library index only ever
 * hands the client an `artifactIndexId`; the canonical
 * `presentation_templates.id` + a fresh read of `outline_json` are resolved
 * HERE, never trusted from the client.
 *
 * The resolved `outlineBlueprint` is deliberately NOT returned — the client
 * has no use for it, and `POST /presentations/decks/from-template` (below)
 * re-resolves fresh at creation time instead of trusting this snapshot.
 *
 * Body: { templateArtifactId: string }
 * Returns 200: { template: { canonicalTemplateId, originRuntime, format,
 *                            name, scope, status, source, legacy, slideCount } }
 * Errors: 400 templateArtifactId_required · 401 Unauthorized
 *         404 TEMPLATE_NOT_INDEXED | TEMPLATE_ORPHANED
 *         403 TEMPLATE_FORBIDDEN · 409 TEMPLATE_DEPRECATED
 *         422 TEMPLATE_FORMAT_UNSUPPORTED
 */
router.post(
  '/templates/resolve',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateArtifactId = String(req.body?.templateArtifactId || '').trim();
    if (!templateArtifactId) {
      res.status(400).json({ error: 'templateArtifactId_required' });
      return;
    }

    try {
      const resolved = await resolvePresentationTemplateForCreation(
        { kind: 'library', templateArtifactId },
        { organizationId: orgId }
      );
      res.json({
        template: {
          canonicalTemplateId: resolved.canonicalTemplateId,
          originRuntime: resolved.originRuntime,
          format: resolved.format,
          name: resolved.name,
          scope: resolved.scope,
          status: resolved.status,
          source: resolved.source,
          legacy: resolved.legacy,
          slideCount: resolved.outlineBlueprint.length,
        },
      });
    } catch (err) {
      if (isTemplateResolveError(err)) {
        logger.info(
          `[Presentations] template resolve rejected: ${err.code} (artifact ${templateArtifactId})`
        );
        res.status(TEMPLATE_RESOLVE_STATUS[err.code]).json({ error: err.code });
        return;
      }
      throw err;
    }
  })
);

// ------------------------------------------------------------------
// FALA B (2026-07-22): AI Template Architect for decks — mirrors the
// Document Studio pattern (`POST /api/document-studio/templates/plan` ->
// `draftTemplateAsync`). Builds a NEW draft template (outline of
// {intent,title} slides + governance defaults) from a free-text purpose,
// persists it as `lifecycle_state = 'draft'`, and hands it to the
// EXISTING governance lifecycle (approve/deprecate/clone/audit) and the
// existing manual editor (`PUT /templates/:id`, below) unchanged.
// Route-ordering vs. `PUT /templates/:id` is irrelevant here (different
// HTTP method + literal path, no `:id` collision); kept next to
// `GET /templates` for readability, mirroring document-studio.routes.ts.
// ------------------------------------------------------------------
router.post(
  '/templates/plan',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const input = (req.body?.input ?? null) as PresentationTemplateDraftInput | null;
    if (!input || typeof input !== 'object' || typeof input.purpose !== 'string') {
      res.status(400).json({ success: false, error: 'template input (purpose) is required' });
      return;
    }
    const useLlm = req.body?.useLlm === true;

    let draft;
    try {
      draft = await draftPresentationTemplateAsync({ input, useLlm });
    } catch (err) {
      logger.warn('[Presentations] Template plan failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      const message = err instanceof Error ? err.message : 'template_plan_failed';
      res.status(400).json({ success: false, error: 'template_plan_failed', message });
      return;
    }

    const { template, llmRefined } = draft;
    const id = uuidv4().replace(/-/g, '');
    // Base insert uses ONLY the migration-568 columns so template creation
    // keeps working on installs where migration 767 (lifecycle + lineage)
    // has not run yet. `lifecycle_state` defaults to `draft` either way
    // (567 has no such column; 767 adds it with `DEFAULT 'draft'`).
    const insertAck = await dbRun(
      `INSERT INTO presentation_templates (id, organization_id, name, description, deck_type, audience, goal, language_default, confidentiality_default, theme, outline_json, max_slides, min_slides, must_have_intents, recommended_visuals, is_system, is_active, cloned_from, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE, NULL, ?)`,
      [
        id,
        orgId,
        template.name,
        template.description,
        template.deckType,
        template.audience,
        template.goal,
        template.languageDefault,
        template.confidentialityDefault,
        template.theme,
        JSON.stringify(template.outlineJson),
        template.maxSlides,
        template.minSlides,
        JSON.stringify(template.mustHaveIntents),
        JSON.stringify(template.recommendedVisuals),
        userId,
      ]
    );

    // M09-H02 — settle against durable state BEFORE any best-effort side write.
    // Previously the route ran the lineage/governance writes and then answered
    // `success: true` with an envelope rebuilt from the in-memory draft whenever
    // the read-back came back empty, so a rejected INSERT still looked like a
    // saved template.
    const planSettled = await settleTemplateWrite('template plan', id, orgId, insertAck);
    if (!planSettled.ok) {
      logger.error('[Presentations] Template plan insert did not persist', {
        templateId: id,
        organizationId: orgId,
        reason: planSettled.reason,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        success: false,
        error: 'template_persist_failed',
        message: 'Template was not saved. Nothing was created.',
      });
      return;
    }

    // Epic C2 parity with /clone: a freshly drafted template is the root
    // of its own lineage chain. Best-effort — never breaks creation when
    // migration 767 has not run yet.
    try {
      await dbRun(`UPDATE presentation_templates SET lineage_root_id = ? WHERE id = ?`, [id, id]);
    } catch (lineageError) {
      logger.warn(
        '[Presentations] Could not set template-plan lineage root (migration 767 may be pending)',
        lineageError
      );
    }

    // Best-effort audit ledger write, mirrors the /clone route: never
    // breaks template creation when migration 767 has not run yet.
    try {
      await recordGovernanceEvent({
        templateId: id,
        organizationId: orgId,
        eventType: 'submitted_for_approval',
        fromState: null,
        toState: 'draft',
        actorId: userId,
        actorRole: (req as any).user?.role || null,
        reason: llmRefined ? 'Drafted by AI Template Architect' : 'Drafted (deterministic outline)',
        metadata: {
          source: llmRefined ? 'ai_template_architect' : 'deterministic',
          purpose: input.purpose,
        },
      });
    } catch (governanceError) {
      logger.warn(
        '[Presentations] Could not record template-plan governance event (migration 767 may be pending)',
        governanceError
      );
    }

    // M09-H02 — re-read after the lineage write so the client gets the final
    // persisted row. `planSettled.row` is the fail-closed guarantee; this only
    // refreshes it. No in-memory fallback: if the row vanished between the two
    // reads, the earlier guard already proved persistence, so we serve the row
    // we verified rather than inventing one.
    const row = (await readBackOrgTemplate(id, orgId)) || planSettled.row;
    res.json({
      success: true,
      data: { template: normalizeTemplatePayload(row), llmRefined },
    });
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
    const cloneAck = await dbRun(
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

    // M09-H02 — the clone answered `{ success: true, data: { id } }` for an id
    // that may never have been written. Settle against durable, org-owned state
    // before the best-effort lineage writes and before answering.
    const cloneSettled = await settleTemplateWrite('template clone', id, orgId, cloneAck);
    if (!cloneSettled.ok) {
      logger.error('[Presentations] Template clone insert did not persist', {
        templateId: id,
        sourceTemplateId: String(req.params.id),
        organizationId: orgId,
        reason: cloneSettled.reason,
      });
      return res.status(500).json({
        success: false,
        error: 'template_clone_failed',
        message: 'Template was not cloned. Nothing was created.',
      });
    }

    // Epic C2: extend the clone with a lineage chain + governance
    // event so the registry surface can render the version history.
    // Both writes are best-effort and silently no-op when migration
    // 767 has not been applied — never break the existing clone API.
    try {
      const lineage = computeLineageForClone({
        parentTemplate: {
          id: String(source.id),
          lineageRootId: source.lineage_root_id ? String(source.lineage_root_id) : null,
          lineageVersion: Number(source.lineage_version) || 1,
        },
      });
      await dbRun(
        `UPDATE presentation_templates
            SET lineage_parent_id = ?,
                lineage_root_id = ?,
                lineage_version = ?
          WHERE id = ?`,
        [lineage.lineageParentId, lineage.lineageRootId, lineage.lineageVersion, id]
      );
      await recordGovernanceEvent({
        templateId: id,
        organizationId: orgId,
        eventType: 'cloned',
        fromState: null,
        toState: 'draft',
        actorId: (req as any).user?.id || null,
        actorRole: (req as any).user?.role || null,
        reason: typeof name === 'string' && name.trim().length > 0 ? `Cloned as ${name}` : null,
        metadata: {
          parentTemplateId: lineage.lineageParentId,
          lineageRootId: lineage.lineageRootId,
          lineageVersion: lineage.lineageVersion,
        },
      });
    } catch (lineageError) {
      logger.warn(
        '[Presentations] Could not persist clone lineage (migration 767 may be pending)',
        lineageError
      );
    }

    res.json({ success: true, data: { id } });
  })
);

router.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'template_approve')) return;
    const orgId = getOrgId(req);

    // Epic C2 invariant: only `draft` templates may be edited in
    // place. `approved` / `deprecated` rows must be cloned first so
    // the audit trail and lineage stay honest. Lookup is best-effort
    // — when migration 767 is pending, lifecycle_state defaults to
    // `draft` so legacy installs keep editing as before.
    const existing = await getTemplateForOrgOrSystem(String(req.params.id), orgId);
    if (existing) {
      const guard = assertEditableLifecycle(existing);
      if (!guard.allowed) {
        return res.status(409).json({
          success: false,
          error: guard.reason || 'Template lifecycle blocks edits.',
          code: 'TEMPLATE_LIFECYCLE_LOCKED',
          lifecycleState: guard.state,
        });
      }
    }

    const { name, description, audience, goal, theme, outlineJson, maxSlides, colorTemplateId } =
      req.body;

    // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). Reuses the existing,
    // previously-unused `layout_policy_json` free-form column (no new
    // migration) instead of a new column — see
    // `presentationTemplateCompatibilityService.ts` for the read side.
    // `colorTemplateId === undefined` means "field not sent, leave
    // untouched"; `null` or `''` means "explicitly cleared".
    let layoutPolicyJson: string | null = null;
    if (colorTemplateId !== undefined) {
      let currentLayoutPolicy: Record<string, unknown> = {};
      if (existing?.layout_policy_json) {
        try {
          currentLayoutPolicy = JSON.parse(existing.layout_policy_json) || {};
        } catch {
          currentLayoutPolicy = {};
        }
      }
      layoutPolicyJson = JSON.stringify({
        ...currentLayoutPolicy,
        colorTemplateId: colorTemplateId || null,
      });
    }

    const updateAck = await dbRun(
      `UPDATE presentation_templates SET name = COALESCE(?, name), description = COALESCE(?, description), audience = COALESCE(?, audience), goal = COALESCE(?, goal), theme = COALESCE(?, theme), outline_json = COALESCE(?, outline_json), max_slides = COALESCE(?, max_slides), layout_policy_json = COALESCE(?, layout_policy_json), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND is_system = FALSE`,
      [
        name,
        description,
        audience,
        goal,
        theme,
        outlineJson ? JSON.stringify(outlineJson) : null,
        maxSlides,
        layoutPolicyJson,
        req.params.id,
        orgId,
      ]
    );

    // M09-H02 — the UPDATE is already tenant-scoped in its WHERE clause, but the
    // route answered `{ success: true }` unconditionally. A foreign-org id, an
    // unknown id or a system row therefore matched zero rows and still reported
    // a saved edit. Zero rows changed is NOT a successful save.
    if (updateAck?.success && updateAck.changes === 0) {
      res.status(404).json({
        success: false,
        error: 'template_not_found_for_org',
        message: 'No editable template with this id belongs to your organization.',
      });
      return;
    }

    const updateSettled = await settleTemplateWrite(
      'template update',
      String(req.params.id),
      orgId,
      updateAck
    );
    if (!updateSettled.ok) {
      logger.error('[Presentations] Template update did not persist', {
        templateId: String(req.params.id),
        organizationId: orgId,
        reason: updateSettled.reason,
      });
      res.status(500).json({
        success: false,
        error: 'template_update_failed',
        message: 'Template was not updated. No changes were saved.',
      });
      return;
    }

    res.json({ success: true });
  })
);

// ============================================================
// TEMPLATE GOVERNANCE (Epic C2 - Sprint 13)
// ============================================================
//
// Lifecycle (`draft` / `approved` / `deprecated`) + lineage + audit
// ledger for the org's template registry. All endpoints are gated by
// `presentation_edit` (read) and `template_approve` (transitions),
// and degrade to a 503 honest banner when migration 767 is pending.

const VALID_LIFECYCLE_STATES: ReadonlySet<TemplateLifecycleState> = new Set([
  'draft',
  'approved',
  'deprecated',
]);

function isValidLifecycleState(value: unknown): value is TemplateLifecycleState {
  return typeof value === 'string' && VALID_LIFECYCLE_STATES.has(value as TemplateLifecycleState);
}

router.get(
  '/templates/:id/governance',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const templateId = String(req.params.id || '');
    const source = await getTemplateForOrgOrSystem(templateId, orgId);
    if (!source) return res.status(404).json({ success: false, error: 'Template not found' });

    const events = await listGovernanceEvents(orgId, templateId, 20);
    const lineage = await fetchLineageChain(orgId, templateId);
    const lifecycleState = isValidLifecycleState(source.lifecycle_state)
      ? source.lifecycle_state
      : 'draft';

    res.json({
      success: true,
      data: {
        templateId,
        name: source.name,
        lifecycleState,
        lineage: {
          parentId: source.lineage_parent_id ? String(source.lineage_parent_id) : null,
          rootId: source.lineage_root_id ? String(source.lineage_root_id) : String(source.id),
          version: Number(source.lineage_version) || 1,
          chain: lineage.status === 'ok' ? lineage.chain : [],
          chainStatus: lineage.status,
        },
        approval: {
          approvedAt: source.approved_at || null,
          approvedBy: source.approved_by || null,
          deprecatedAt: source.deprecated_at || null,
          deprecatedBy: source.deprecated_by || null,
          deprecationReason: source.deprecation_reason || null,
        },
        events,
        ...(lineage.status === 'storage_error'
          ? { warnings: ['template_governance_schema_pending'] }
          : {}),
      },
    });
  })
);

router.post(
  '/templates/:id/governance/transition',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'template_approve')) return;
    const orgId = getOrgId(req);
    const templateId = String(req.params.id || '');
    const targetState = req.body?.targetState;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    if (!isValidLifecycleState(targetState)) {
      return res.status(400).json({
        success: false,
        error: 'Unknown targetState. Allowed: draft, approved, deprecated.',
        code: 'INVALID_TARGET_STATE',
      });
    }

    const result = await applyLifecycleTransition({
      templateId,
      organizationId: orgId,
      targetState,
      actor: {
        id: (req as any).user?.id || 'system',
        role: (req as any).user?.role || 'VIEWER',
      },
      reason,
    });

    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, error: result.reason || 'Template not found' });
    }
    if (result.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: result.reason || 'Transition blocked',
        code: 'TEMPLATE_TRANSITION_BLOCKED',
        ...(result.requiredCapability ? { requiredCapability: result.requiredCapability } : {}),
      });
    }
    if (result.status === 'storage_error') {
      return res.status(503).json({
        success: false,
        error: 'Template governance storage is unavailable.',
        code: 'TEMPLATE_GOVERNANCE_UNAVAILABLE',
        reason: result.reason || 'storage_error',
      });
    }

    res.json({
      success: true,
      data: {
        record: result.record || null,
        ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
      },
    });
  })
);

router.post(
  '/templates/:id/governance/deprecate',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'template_approve')) return;
    const orgId = getOrgId(req);
    const templateId = String(req.params.id || '');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty `reason` is required to deprecate a template.',
        code: 'DEPRECATION_REASON_REQUIRED',
      });
    }

    const result = await deprecateTemplateGovernance({
      templateId,
      organizationId: orgId,
      actor: {
        id: (req as any).user?.id || 'system',
        role: (req as any).user?.role || 'VIEWER',
      },
      reason,
    });

    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, error: result.reason || 'Template not found' });
    }
    if (result.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: result.reason || 'Deprecation blocked',
        code: 'TEMPLATE_DEPRECATION_BLOCKED',
      });
    }
    if (result.status === 'storage_error') {
      return res.status(503).json({
        success: false,
        error: 'Template governance storage is unavailable.',
        code: 'TEMPLATE_GOVERNANCE_UNAVAILABLE',
        reason: result.reason || 'storage_error',
      });
    }

    res.json({
      success: true,
      data: {
        record: result.record || null,
      },
    });
  })
);

router.get(
  '/templates/governance/by-state/:state',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const state = req.params.state;
    if (!isValidLifecycleState(state)) {
      return res.status(400).json({
        success: false,
        error: 'Unknown lifecycle state. Allowed: draft, approved, deprecated.',
        code: 'INVALID_LIFECYCLE_STATE',
      });
    }
    const rows = await listTemplatesByState(orgId, state);
    res.json({
      success: true,
      data: { state, templates: rows },
    });
  })
);

router.get(
  '/templates/:id/governance/lineage',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const templateId = String(req.params.id || '');
    const lineage = await fetchLineageChain(orgId, templateId);

    if (lineage.status === 'not_found') {
      return res
        .status(404)
        .json({ success: false, error: lineage.reason || 'Template not found' });
    }
    if (lineage.status === 'storage_error') {
      return res.status(503).json({
        success: false,
        error: 'Template governance storage is unavailable.',
        code: 'TEMPLATE_GOVERNANCE_UNAVAILABLE',
        reason: lineage.reason || 'storage_error',
      });
    }

    res.json({
      success: true,
      data: {
        templateId,
        chain: lineage.chain,
      },
    });
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

    // P0.3-b — legacy route parity: deckId comes from a prior /generate/outline
    // call, which already INSERTs the row (status='draft'). generateDeck() itself
    // does an unconditional UPDATE status='generating' with no guard, so two
    // concurrent /generate/deck POSTs for the same deckId both proceed and race
    // each other. Mirror the deliverablesGenerationService.start() atomic-lock
    // pattern: a conditional UPDATE wins exactly one request; the loser gets 409
    // instead of duplicating generateDeck(). Fail-open when deckId is absent —
    // that shape doesn't correspond to the outline→deck flow this lock protects.
    if (deckId) {
      const lock = await dbRun(
        `UPDATE presentation_decks SET status = 'generating', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND status != 'generating'
         RETURNING id`,
        [deckId, orgId]
      );
      if (!lock.success || !lock.changes) {
        return res.status(409).json({
          success: false,
          error: `Generacja ${deckId} już trwa — odpytuj status zamiast startować ponownie`,
          code: 'PRESENTATION_GENERATION_IN_PROGRESS',
        });
      }
    }

    try {
      const result = await generateDeck(deckId, outline, setup, orgId);
      res.json({ success: true, data: result });
    } catch (error) {
      // RED-J W6 bug #2 — registerArtifactOrigin() (called deep inside
      // generateDeck()) does a raw RegisterArtifactOriginParamsSchema.parse()
      // and throws an uncaught ZodError when required fields (e.g.
      // originRecordId) are missing from `setup`. That surfaced as a 500
      // instead of a client-input 400 — map it here, same pattern as
      // execution.routes.ts::handleExecutionError / my-work.routes.ts.
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid deck generation payload',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
      }
      throw error;
    }
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
    // MAT-007/009 root-cause fix: build the canonical deck_json (schemaVersion
    // 1, real DeckDocumentCard[]) up front so the row this INSERT creates is
    // self-consistent from the start — GET /decks/:id and the DeckBuilder both
    // read deck_json first (see normalizeDeckDocument), and previously this
    // route only ever wrote to the never-read `presentation_cards` table,
    // leaving deck_json NULL while slide_count correctly reported the count.
    // That produced "Ready, N slides" in the list but "Card 1 of 0" in the
    // builder. See docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MAT-006B_PRESENTATION_LIFECYCLE_E2E.md.
    const canonicalDeckDocument = buildDeckDocumentFromStructuredSlides({
      deckId,
      organizationId: orgId,
      title,
      theme: theme || 'modern',
      slides: Array.isArray(slides) ? (slides as StructuredSlideInput[]) : [],
      status: 'draft',
      createdBy: userId,
    });
    const deckJsonStr = JSON.stringify(canonicalDeckDocument);

    try {
      await ensureDeckLineageSchema();
      // MAT-010 G8 fix — `dbRun` defaults `fallback: true` (see DbPromise.ts),
      // which resolves `{ success: false }` on a DB error instead of
      // rejecting (e.g. an `organization_id` FK violation). Without this
      // check the route fell through to card inserts, audit, registry sync
      // and PPTX render for a deck row that was NEVER written, then answered
      // 201 with an id pointing at nothing. Checking `.success` restores the
      // existing catch/500 path for a failed create — no new behavior, just
      // no longer silently trusting an unchecked write.
      const deckInsertResult = await dbRun(
        `INSERT INTO presentation_decks (id, organization_id, title, deck_type, theme, slide_count, status, source_refs_json, deck_json, created_at, updated_at)
         VALUES (?, ?, ?, 'custom', ?, ?, 'draft', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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
          deckJsonStr,
        ]
      );
      if (!deckInsertResult?.success) {
        throw new Error(
          `presentation_decks insert failed: ${deckInsertResult?.error || 'unknown error'}`
        );
      }

      if (Array.isArray(slides)) {
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          const cardId = uuidv4().replace(/-/g, '');
          // Best-effort legacy mirror; deck_json above is now the source of
          // truth read by GET /decks/:id and the builder. presentation_cards
          // may not exist in every environment, so a failure here must not
          // fail deck creation (the canonical row above already succeeded).
          try {
            await dbRun(
              `INSERT INTO presentation_cards (id, deck_id, card_index, intent, blocks_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [cardId, deckId, i, slide.type || 'content', JSON.stringify(slide.content || slide)]
            );
          } catch (cardsErr) {
            logger.warn('[presentations] presentation_cards mirror insert failed (non-fatal)', {
              deckId,
              error: (cardsErr as any)?.message || cardsErr,
            });
          }
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

      await renderInitialPptxForDeck({
        deckId,
        organizationId: orgId,
        deckDocument: canonicalDeckDocument,
      });

      res.status(201).json({ success: true, data: { id: deckId, title, slideCount } });
    } catch (error: any) {
      logger.error('[presentations] Failed to create deck:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to create deck', code: 'DECK_CREATE_FAILED' });
    }
  })
);

/**
 * POST /api/presentations/decks/from-template
 *
 * R11 deck slice (2026-07-26) — the deck counterpart of the "Use template"
 * fix already shipped for documents. Fixes the bug the R0 audit flagged as
 * the most important functional gap for Materiały: "Użyj wzorca" for a
 * PRESENTATION used to throw away the template's structure and hand only a
 * text description to the AI chat pipeline as a prompt
 * (`PrezentacjeView.tsx` read `originSummary.template.description` and
 * called `startGeneration(desc, templateArtifactId)` — the outline never
 * reached generation).
 *
 * This route skips the AI pipeline entirely for the template case (same
 * shape of decision as the existing `POST /decks` "blank deck" route above —
 * no AI needed when the structure is already fully known) and DETERMINISTICALLY
 * copies `presentation_templates.outline_json` into `presentation_cards`,
 * one card per outline item. `templateArtifactId` is the ONLY template
 * pointer accepted from the client (Template Library index id); the
 * canonical `presentation_templates` record is re-resolved and re-validated
 * HERE via `resolvePresentationTemplateForCreation` — never trusted from a
 * prior `/templates/resolve` response.
 *
 * Body: { templateArtifactId: string, title?: string }
 * Returns 201: { success: true, data: { id, title, slideCount } } — same
 * shape as `POST /decks` so the client can reuse its existing deck-created
 * handling.
 * Errors: 400 templateArtifactId_required
 *         404 TEMPLATE_NOT_INDEXED | TEMPLATE_ORPHANED
 *         403 TEMPLATE_FORBIDDEN · 409 TEMPLATE_DEPRECATED
 *         422 TEMPLATE_FORMAT_UNSUPPORTED
 */
router.post(
  '/decks/from-template',
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const templateArtifactId = String(req.body?.templateArtifactId || '').trim();
    if (!templateArtifactId) {
      res.status(400).json({ success: false, error: 'templateArtifactId_required' });
      return;
    }
    const requestedTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

    let resolved;
    try {
      resolved = await resolvePresentationTemplateForCreation(
        { kind: 'library', templateArtifactId },
        { organizationId: orgId }
      );
    } catch (err) {
      if (isTemplateResolveError(err)) {
        logger.info(
          `[Presentations] deck-from-template resolve rejected: ${err.code} (artifact ${templateArtifactId})`
        );
        res.status(TEMPLATE_RESOLVE_STATUS[err.code]).json({ error: err.code });
        return;
      }
      throw err;
    }

    const title = requestedTitle || resolved.name || 'Presentation from template';
    // Deterministic outline→slide copy (no AI) — see mapOutlineBlueprintToDeckSlides
    // doc comment for why this is a named, independently-tested export rather
    // than inline mapping.
    const slides = mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint);
    const slideCount = slides.length;

    const deckId = uuidv4().replace(/-/g, '');
    // MAT-007/009 root-cause fix — see matching comment in `POST /decks`
    // above: persist canonical deck_json at creation so this row never lands
    // in the "Ready + slide_count>0, empty builder" state.
    const canonicalDeckDocument = buildDeckDocumentFromStructuredSlides({
      deckId,
      organizationId: orgId,
      title,
      theme: 'modern',
      slides: slides as StructuredSlideInput[],
      status: 'draft',
      createdBy: userId,
    });
    const deckJsonStr = JSON.stringify(canonicalDeckDocument);
    try {
      await ensureDeckLineageSchema();
      // MAT-010 G8 fix — see matching comment in `POST /decks` above: `dbRun`
      // resolves `{ success: false }` rather than throwing, so an unchecked
      // insert can answer 201 for a deck row that was never written.
      const deckInsertResult = await dbRun(
        `INSERT INTO presentation_decks (id, organization_id, title, deck_type, theme, slide_count, status, source_refs_json, deck_json, created_at, updated_at)
         VALUES (?, ?, ?, 'custom', 'modern', ?, 'draft', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          deckId,
          orgId,
          title,
          slideCount,
          JSON.stringify({
            source: 'template_library',
            templateArtifactId,
            canonicalTemplateId: resolved.canonicalTemplateId,
          }),
          deckJsonStr,
        ]
      );
      if (!deckInsertResult?.success) {
        throw new Error(
          `presentation_decks insert failed: ${deckInsertResult?.error || 'unknown error'}`
        );
      }

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const cardId = uuidv4().replace(/-/g, '');
        try {
          await dbRun(
            `INSERT INTO presentation_cards (id, deck_id, card_index, intent, blocks_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [cardId, deckId, i, slide.type, JSON.stringify(slide.content)]
          );
        } catch (cardsErr) {
          logger.warn('[presentations] presentation_cards mirror insert failed (non-fatal)', {
            deckId,
            error: (cardsErr as any)?.message || cardsErr,
          });
        }
      }

      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: 'create',
        resourceType: 'presentation_deck',
        resourceId: deckId,
        after: { title, slideCount, source: 'template_library', templateArtifactId },
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
          source: 'template_library',
        });
      } catch (artifactErr: any) {
        await dbRun(`DELETE FROM presentation_cards WHERE deck_id = ?`, [deckId]);
        await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [
          deckId,
          orgId,
        ]);
        throw artifactErr;
      }

      await renderInitialPptxForDeck({
        deckId,
        organizationId: orgId,
        deckDocument: canonicalDeckDocument,
      });

      res.status(201).json({ success: true, data: { id: deckId, title, slideCount } });
    } catch (error: any) {
      logger.error('[presentations] Failed to create deck from template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create deck from template',
        code: 'DECK_FROM_TEMPLATE_FAILED',
      });
    }
  })
);

router.get(
  '/decks',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    try {
      await ensureDeckLineageSchema();
      // MAT-006B — the list must not advertise slides the deck cannot serve.
      //
      // The first attempt at this gate used a pure-SQL predicate
      // (`COALESCE(deck_json,'') <> '' OR COALESCE(unified_json,'') <> ''`) and
      // echoed the stored `slide_count` whenever it was true. That is not
      // fail-closed: a non-empty JSON string is not proof of renderable cards.
      // It still passed a positive count through for `'{}'`, for invalid JSON
      // (which `safeJsonParse` discards), for `{"schemaVersion":1,"cards":[]}`,
      // and for the generator's cards+1 drift — i.e. every shape that actually
      // occurs on `demo`. Only parsing the payload can answer the question, so
      // the list now parses it, in JS, through the same
      // `resolveDeckContentCoherence()` the canonical GET uses. List and
      // canonical GET are therefore the same number by construction; there is
      // no 'unverified' middle state left to hide behind.
      //
      // COST — this is a deliberate trade. The listing now reads `deck_json`
      // (tens of rows x ~40 KB on a demo tenant) and JSON.parses each one. Two
      // things keep the shape sane, neither of them measured:
      //   1. `unified_json` is NOT selected up front. Every writer that stores
      //      content stores `deck_json` (presentationGeneratorService.ts:2127
      //      writes both in one UPDATE), so the second column is dead weight for
      //      effectively every row. It is fetched only for the rows whose
      //      `deck_json` yielded zero cards AND that hold a `unified_json` —
      //      the legacy shape. Omitting it can only ever UNDERSTATE a count
      //      (`normalizeDeckDocument` falls back to `unified_json` only when
      //      `deck_json` produced no cards), never overstate it, so the second
      //      pass is a correctness top-up, not a guess.
      //   2. Neither content column is returned to the client. The response
      //      carries the same fields it always did, plus the derived count.
      // If this listing ever becomes hot, the fix is a persisted derived count
      // (a generated column or a write-path invariant), not a return to a
      // predicate that cannot see inside the payload.
      const rows = (await dbAll(
        `SELECT pd.id, pd.title, pd.description, pd.deck_type, pd.audience, pd.goal, pd.language, pd.theme, pd.presentation_mode, pd.slide_count, pd.status, pd.export_format, pd.exported_at, pd.created_at, pd.updated_at, pd.source_id, pd.thumbnail_url, pd.source_refs_json, pd.created_by,
                (u.first_name || ' ' || u.last_name) AS created_by_name,
                pd.deck_json,
                (CASE WHEN COALESCE(pd.unified_json, '') <> '' THEN 1 ELSE 0 END) AS has_unified_json
         FROM presentation_decks pd
         LEFT JOIN users u ON u.id = pd.created_by
         WHERE pd.organization_id = ? ORDER BY pd.updated_at DESC`,
        [orgId]
      )) as any[];

      const deckRows: any[] = rows || [];
      const coherences = deckRows.map((row: any) => resolveDeckContentCoherence(row));
      const needsUnifiedJson = deckRows
        .filter(
          (row: any, index: number) =>
            coherences[index].cardCount === 0 && Number(row?.has_unified_json) === 1
        )
        .map((row: any) => String(row?.id));
      if (needsUnifiedJson.length > 0) {
        const placeholders = needsUnifiedJson.map(() => '?').join(', ');
        const unifiedRows = (await dbAll(
          `SELECT id, unified_json FROM presentation_decks
           WHERE organization_id = ? AND id IN (${placeholders})`,
          [orgId, ...needsUnifiedJson]
        )) as any[];
        const unifiedById = new Map(
          (unifiedRows || []).map((u: any) => [String(u?.id), u?.unified_json])
        );
        deckRows.forEach((row: any, index: number) => {
          if (!unifiedById.has(String(row?.id))) return;
          coherences[index] = resolveDeckContentCoherence({
            ...row,
            unified_json: unifiedById.get(String(row?.id)),
          });
        });
      }

      const data = deckRows.map((row: any, index: number) => {
        // Content columns are read to derive the count; they are not shipped.
        const { deck_json: _deckJson, has_unified_json: _hasUnifiedJson, ...listRow } = row;
        const coherence = coherences[index];
        return {
          ...listRow,
          has_canonical_content: coherence.hasCanonicalContent,
          // The raw column, kept for diagnostics only — this is the number that
          // lied on `demo` ("Ready · 11" over zero renderable cards).
          declared_slide_count: coherence.declaredSlideCount,
          // Derived from the persisted content. `content_state === 'missing'`
          // always travels with `slide_count === 0`.
          slide_count: coherence.cardCount,
          content_state: coherence.hasCanonicalContent ? 'canonical' : 'missing',
        };
      });
      res.json({ success: true, data });
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

    // M17: export-approval gate — see server/src/services/v8/exportApprovalGate.ts.
    if (
      !applyExportApprovalGate({
        res,
        organizationId: orgId,
        userId,
        originRuntime: 'presentation',
        originRecordId: String(req.params.id || ''),
        format: 'pptx',
        publishState: artifact.publishState,
      })
    ) {
      return;
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
      allowOverride: canOverrideQualityGate(req),
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
      return res.status(quality.status ?? 422).json(quality.payload);
    }

    if (!fs.existsSync(deck.export_path))
      return res.status(404).json({ success: false, error: 'File not found' });

    // P0 fix: deck_json can have been edited (autosave / agent-edit) after the on-disk
    // PPTX was last rendered. Re-render from the current deck_json when stale so the
    // download reflects the latest edits instead of the file from creation time.
    const freshDeck = await regeneratePptxIfStale(deck);

    const cards = getDeckCards(freshDeck);
    const limitCheck = enforceExportLimits(freshDeck, cards);
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
      const limitExportOutcome = await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(req.params.id || ''),
        format: 'pptx',
        status: 'completed',
        qualityReport: quality.report,
        filePath: deck.export_path,
      });
      // Response not yet sent — safe to fail-closed on a genuine double
      // failure. Retry-safety: re-running this export has no persisted side
      // effect to duplicate (see `recordPresentationExportRecord`'s comment).
      if (limitExportOutcome && respondIfLineageLost(res, limitExportOutcome)) return;
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

    // M17: export-approval gate — see server/src/services/v8/exportApprovalGate.ts.
    if (
      !applyExportApprovalGate({
        res,
        organizationId: orgId,
        userId,
        originRuntime: 'presentation',
        originRecordId: String(deckId || ''),
        format: 'pdf',
        publishState: artifact.publishState,
      })
    ) {
      return;
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
      allowOverride: canOverrideQualityGate(req),
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
      return res.status(quality.status ?? 422).json(quality.payload);
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

    // Codex review, third round (Blocker A) — durable pending intent BEFORE
    // the first byte is sent. `doc.pipe(res)` below streams the response
    // immediately as pages render; once that starts, headers/body are
    // committed and a later lineage failure can never become a 5xx (see
    // the comment at `doc.end()` below). If we cannot even persist the
    // INTENT to record this export, refuse to start streaming at all —
    // a plain error response, zero bytes sent — rather than risk total,
    // silent lineage loss on an export the client will believe succeeded.
    const pdfExportIntent = await preflightStreamingExportIntent({
      organizationId: orgId,
      artifactKind: 'presentation',
      sourceRecordId: String(deckId || ''),
      actorUserId: userId,
      detail: { format: 'pdf' },
    });
    if (!pdfExportIntent) {
      return res.status(500).json({
        success: false,
        error: 'Lineage could not be durably recorded before export',
        code: 'LINEAGE_RECOVERY_REQUIRED',
      });
    }

    const filename = `${String(deck.title || 'presentation').replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      const pdfMargin = 48;
      const doc = new PDFDocument({ margin: pdfMargin, size: 'A4' });
      doc.pipe(res);

      cards.forEach((card: any, index: number) => {
        if (index > 0) doc.addPage();

        // Sprint S16 — render the layout-audit truncation marker BEFORE
        // the page title so the badge sits above any title that wraps
        // to multiple lines. The marker is a no-op when `card.audit_flags`
        // is empty/missing (legacy decks). Closes R-S15-1: PDF parity for
        // the renderer-side honest truncation indicator.
        try {
          const flags: string[] | undefined = Array.isArray(card?.audit_flags)
            ? (card.audit_flags as string[])
            : undefined;
          const instruction = buildPdfLayoutTruncationMarker(flags, {
            width: doc.page.width,
            height: doc.page.height,
            margin: pdfMargin,
          });
          if (instruction) applyPdfLayoutTruncationMarker(doc as any, instruction);
        } catch (markerErr: any) {
          // Non-fatal: log, continue rendering the page without a marker.
          logger.warn(
            `[Presentations][PDF] Layout-audit marker skipped for slide ${index + 1}: ${markerErr?.message || markerErr}`
          );
        }

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
      // NOTE (Codex review, third round — Blocker A CLOSED): `doc.pipe(res)`
      // above has ALREADY streamed headers and body to the client by the
      // time `doc.end()` returns — there is nothing left to un-send, so
      // this call itself still cannot fail-closed on an export the client
      // has already received. What changed: `pdfExportIntent` above already
      // persisted a durable pending row BEFORE any byte was sent (aborting
      // the whole request if even THAT failed) — so if this direct write
      // also fails, nothing is lost: the pre-flight row is what the next
      // scheduled reconciliation tick replays, converging on the SAME
      // idempotency key. Threading `pdfExportIntent`'s key/occurredAt
      // through is what makes this finalize idempotent rather than a
      // second, unrelated attempt.
      await recordPresentationExportRecord({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        format: 'pdf',
        status: 'completed',
        qualityReport: quality.report,
        filePath: null,
        lineageIdempotencyKey: pdfExportIntent.idempotencyKey,
        lineageOccurredAt: pdfExportIntent.occurredAt,
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
      // Blocker A: the export genuinely failed after the pre-flight intent
      // was persisted (possibly after partial bytes already streamed) —
      // cancel it so reconciliation never fabricates a false `completed`
      // event for a failed export.
      await cancelPendingLineageIntent({
        organizationId: orgId,
        idempotencyKey: pdfExportIntent.idempotencyKey,
      });
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

// L-03: throttle share-link mint/revoke to blunt token-churn / enumeration abuse.
const shareRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many share operations, slow down.' },
});

// Share link
router.post(
  '/decks/:id/share',
  shareRateLimiter,
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

    // MAT-010 lineage hook. Only a token HASH reaches the lineage. `...Tracked`
    // + `respondIfLineageLost` (Codex review, second round): the business
    // write above is `UPDATE ... SET share_token = ?`, a single-column
    // overwrite, not an append — a retry mints a NEW token that REPLACES this
    // one; there is still exactly one valid token afterward, never an
    // accumulation. The residual cost of declining success here is the
    // previous (already-minted) token becoming invalid sooner than expected,
    // not data corruption or an accumulation of live credentials.
    const shareOutcome = await recordLineageEventTracked({
      organizationId: orgId,
      artifactKind: 'presentation',
      sourceRecordId: String(req.params.id),
      eventType: 'share_minted',
      actorUserId: shareUserId,
      titleSnapshot: before.title,
      detail: { shareTokenHash: hashLineageShareToken(token), expiresAt },
    });
    if (respondIfLineageLost(res, shareOutcome)) return;

    res.json({ success: true, data: { shareToken: token, expiresAt } });
  })
);

// L-03: revoke a deck's public share link. Nulls share_token so the
// `/shared/:token` viewer (WHERE share_token = ?) stops matching — the link
// goes dead immediately. Org-scoped + audited; idempotent (no token → 200).
router.delete(
  '/decks/:id/share',
  shareRateLimiter,
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_share')) return;
    const orgId = getOrgId(req);
    const before = (await dbGet(
      `SELECT id, title, share_token, share_expires_at FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!before) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    await dbRun(
      `UPDATE presentation_decks SET share_token = NULL, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'share_revoke',
      resourceType: 'presentation_deck',
      resourceId: req.params.id,
      before: { shareToken: before.share_token, shareExpiresAt: before.share_expires_at },
      after: { shareToken: null, shareExpiresAt: null },
      metadata: { organizationId: orgId, title: before.title },
    });

    // MAT-010 lineage hook. `...Tracked` + `respondIfLineageLost` (Codex
    // review, second round): retry-safe — this route is already documented
    // idempotent above (nulling an already-null token is a no-op), so a
    // retried revoke cannot double-apply anything.
    const revokeOutcome = await recordLineageEventTracked({
      organizationId: orgId,
      artifactKind: 'presentation',
      sourceRecordId: String(req.params.id),
      eventType: 'share_revoked',
      actorUserId: getUserId(req),
      titleSnapshot: before.title,
      detail: { hadShareToken: Boolean(before.share_token) },
    });
    if (respondIfLineageLost(res, revokeOutcome)) return;

    res.json({ success: true, data: { revoked: true } });
  })
);

// ============================================================
// P3.3 — PER-USER DECK COLLABORATORS (presentation_deck_collaborators)
// ============================================================
//
// The deferred half of P3.1: inviting a collaborator writes a real membership
// row (deck + user/email + role) instead of only minting a share-link. All
// three endpoints are org-scoped, gated by the `presentation_share` capability,
// and FAIL-OPEN — if the collaborators table is unavailable the service returns
// storage_error and we surface a soft 200/`collaborators: []` rather than a 500,
// so the editor never blocks on the membership layer.

// List collaborators for a deck.
router.get(
  '/decks/:id/collaborators',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const orgId = getOrgId(req);
    const deck = (await dbGet(
      `SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    const collaborators = await listCollaborators(req.params.id, orgId);
    res.json({ success: true, data: { collaborators } });
  })
);

// Invite / upsert a collaborator with a role. Accepts either an explicit
// { role } or a P3.1-style { permission: 'view' | 'comment' }.
router.post(
  '/decks/:id/collaborators',
  shareRateLimiter,
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_share')) return;
    const orgId = getOrgId(req);
    const inviterId = getUserId(req);
    const deck = (await dbGet(
      `SELECT id, title FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!email && !targetUserId) {
      return res
        .status(400)
        .json({ success: false, error: 'email or userId is required', code: 'INVALID_INVITE' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid email', code: 'INVALID_EMAIL' });
    }

    const role: CollaboratorRole = isValidRole(body.role)
      ? body.role
      : permissionToRole(body.permission);

    const result = await upsertCollaborator({
      deckId: req.params.id,
      organizationId: orgId,
      userId: targetUserId || null,
      invitedEmail: email || null,
      role,
      invitedBy: inviterId,
    });

    if (result.status !== 'ok') {
      // Fail-open: membership layer unavailable. Return a soft 200 so the FE can
      // still fall back to the share-link invite path without an error toast.
      return res.json({
        success: true,
        data: { collaborator: null, degraded: true, reason: result.reason },
      });
    }

    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'collaborator_invite',
      resourceType: 'presentation_deck',
      resourceId: req.params.id,
      after: { role, email: email || null, userId: targetUserId || null },
      metadata: { organizationId: orgId, title: deck.title },
    });

    res.json({ success: true, data: { collaborator: result.collaborator ?? null } });
  })
);

// Revoke a collaborator (soft delete).
router.delete(
  '/decks/:id/collaborators/:collaboratorId',
  shareRateLimiter,
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_share')) return;
    const orgId = getOrgId(req);
    const deck = (await dbGet(
      `SELECT id, title FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as any;
    if (!deck) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    const result = await revokeCollaborator(req.params.id, orgId, req.params.collaboratorId);
    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'collaborator_revoke',
      resourceType: 'presentation_deck',
      resourceId: req.params.id,
      after: { collaboratorId: req.params.collaboratorId },
      metadata: { organizationId: orgId, title: deck.title },
    });
    res.json({
      success: true,
      data: { revoked: result.status === 'ok', degraded: result.status !== 'ok' },
    });
  })
);

// ============================================================
// DECK COMMENTS (reviewer threads — full stack, wzór Word Epic E6)
// ============================================================
//
// Deck previously had NO comment system. These endpoints port the proven
// Document Studio comment lifecycle to the deck domain: deck- or slide-anchored
// threads, flat 2-level replies, thread-wide resolve/reopen, author-only
// soft-delete. All org-scoped; the deck existence check binds the thread to a
// tenant-owned deck. Read requires `presentation_view`; writes require
// `presentation_view` too (any viewer can leave review comments — mirrors how
// the collaborators list is gated), with author-only delete enforced in-code.

function mapDeckCommentError(res: Response, err: unknown): boolean {
  if (err instanceof DeckCommentError) {
    const status =
      err.code === 'invalid_input'
        ? 400
        : err.code === 'unknown_comment'
          ? 404
          : err.code === 'forbidden'
            ? 403
            : 409;
    res.status(status).json({ success: false, error: err.message, code: err.code });
    return true;
  }
  return false;
}

async function ensureDeckOwnedByOrg(deckId: string, orgId: string): Promise<boolean> {
  const deck = (await dbGet(
    `SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, orgId]
  )) as any;
  return Boolean(deck);
}

// List comment threads (+ counts) for a deck. Optional ?slideId= / ?resolved=.
router.get(
  '/decks/:id/comments',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const orgId = getOrgId(req);
    const deckId = String(req.params.id);
    if (!(await ensureDeckOwnedByOrg(deckId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    await ensureDeckCommentsHydrated(orgId);
    const slideId =
      typeof req.query.slideId === 'string' && req.query.slideId.trim()
        ? String(req.query.slideId).trim()
        : undefined;
    const resolvedParam =
      typeof req.query.resolved === 'string'
        ? req.query.resolved === 'true'
          ? true
          : req.query.resolved === 'false'
            ? false
            : undefined
        : undefined;
    const threads = listDeckCommentThreads(deckId, orgId, {
      ...(slideId ? { slideId } : {}),
      ...(typeof resolvedParam === 'boolean' ? { resolved: resolvedParam } : {}),
    });
    const counts = getDeckCommentCounts(deckId, orgId);
    res.json({ success: true, data: { threads, counts } });
  })
);

// Create a comment. Root (no parentCommentId) or reply. Optional slideId anchor.
router.post(
  '/decks/:id/comments',
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const deckId = String(req.params.id);
    if (!(await ensureDeckOwnedByOrg(deckId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    await ensureDeckCommentsHydrated(orgId);
    const body = req.body || {};
    const text = typeof body.body === 'string' ? body.body : '';
    try {
      const parentCommentId =
        typeof body.parentCommentId === 'string' && body.parentCommentId.trim()
          ? String(body.parentCommentId).trim()
          : undefined;
      const comment = parentCommentId
        ? replyToDeckComment({
            organizationId: orgId,
            deckId,
            author: userId,
            parentCommentId,
            body: text,
          })
        : createDeckComment({
            organizationId: orgId,
            deckId,
            author: userId,
            body: text,
            slideId: typeof body.slideId === 'string' ? body.slideId : null,
          });
      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: parentCommentId ? 'deck_comment_reply' : 'deck_comment_add',
        resourceType: 'presentation_deck',
        resourceId: deckId,
        after: { commentId: comment.id, slideId: comment.slideId },
        metadata: { organizationId: orgId },
      });
      res.status(201).json({ success: true, data: { comment } });
    } catch (err) {
      if (mapDeckCommentError(res, err)) return;
      throw err;
    }
  })
);

// Resolve / reopen a thread (body: { resolved: boolean }). Thread-wide.
router.patch(
  '/decks/:id/comments/:commentId',
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const deckId = String(req.params.id);
    const commentId = String(req.params.commentId);
    if (!(await ensureDeckOwnedByOrg(deckId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    await ensureDeckCommentsHydrated(orgId);
    const resolved = Boolean((req.body || {}).resolved);
    try {
      const comment = setDeckCommentResolved({
        organizationId: orgId,
        deckId,
        userId,
        commentId,
        resolved,
      });
      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: resolved ? 'deck_comment_resolve' : 'deck_comment_reopen',
        resourceType: 'presentation_deck',
        resourceId: deckId,
        after: { commentId, resolved },
        metadata: { organizationId: orgId },
      });
      res.json({ success: true, data: { comment } });
    } catch (err) {
      if (mapDeckCommentError(res, err)) return;
      throw err;
    }
  })
);

// Author-only soft-delete a comment.
router.delete(
  '/decks/:id/comments/:commentId',
  requireAudit,
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const deckId = String(req.params.id);
    const commentId = String(req.params.commentId);
    if (!(await ensureDeckOwnedByOrg(deckId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    await ensureDeckCommentsHydrated(orgId);
    try {
      const comment = deleteDeckComment({
        organizationId: orgId,
        deckId,
        userId,
        commentId,
      });
      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: 'deck_comment_delete',
        resourceType: 'presentation_deck',
        resourceId: deckId,
        after: { commentId },
        metadata: { organizationId: orgId },
      });
      res.json({ success: true, data: { comment } });
    } catch (err) {
      if (mapDeckCommentError(res, err)) return;
      throw err;
    }
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

    // M17: export-approval gate — see server/src/services/v8/exportApprovalGate.ts.
    if (
      !applyExportApprovalGate({
        res,
        organizationId: orgId,
        userId,
        originRuntime: 'presentation',
        originRecordId: String(deckId || ''),
        format: 'html',
        publishState: artifact.publishState,
      })
    ) {
      return;
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
      allowOverride: canOverrideQualityGate(req),
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
      return res.status(quality.status ?? 422).json(quality.payload);
    }

    const { exportDeckAsHtml } = await import('../services/presentationHtmlExportService.js');
    const deckData = normalizeDeckDocument(deck);
    if (!deckData) return res.status(422).json({ success: false, error: 'Invalid deck data' });

    const htmlBuffer = await exportDeckAsHtml({
      title: deck.title || 'Presentation',
      cards: deckData.cards || [],
      theme: {
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
    // Response headers are set but the body is not yet sent — safe to
    // fail-closed on a genuine double failure. Retry-safety: re-running this
    // export has no persisted side effect to duplicate (see
    // `recordPresentationExportRecord`'s comment).
    const htmlExportOutcome = await recordPresentationExportRecord({
      organizationId: orgId,
      userId,
      deckId: String(deckId || ''),
      format: 'html',
      status: 'completed',
      qualityReport: quality.report,
      filePath: null,
    });
    if (htmlExportOutcome && respondIfLineageLost(res, htmlExportOutcome)) return;
    res.send(htmlBuffer);
  })
);

// ============================================================
// CROSS-FORMAT EXPORT PARITY (Epic F1)
// ============================================================

router.get(
  '/decks/:deckId/export-parity',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    if (!deckId || !orgId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing deckId or organization context' });
    }
    const result = await buildParityReportForDeck(String(deckId), String(orgId));
    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }
    if (result.status === 'storage_error') {
      return res.status(503).json({
        success: false,
        error: 'Export parity storage unavailable',
        code: 'STORAGE_UNAVAILABLE',
        reason: result.reason || 'storage_error',
      });
    }
    return res.json({ success: true, data: result.report });
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
    const canonicalSlideCount = Array.isArray(req.body?.cards) ? req.body.cards.length : 0;

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

    // Compare-and-swap: pin the UPDATE to the exact version we just read
    // (or the client-supplied version, when present) so two writers that
    // both observed the same starting version can no longer BOTH succeed.
    // Whichever writer's UPDATE commits first advances the row's version;
    // the loser's WHERE clause no longer matches (`version` has moved on),
    // `changes` comes back 0, and it gets the same 409 VERSION_CONFLICT
    // shape as the pre-existing stale-read check above, so the FE doesn't
    // need to distinguish the two cases.
    const expectedVersion = clientVersion !== null ? clientVersion : deck.version;
    const updateResult = (await dbRun(
      `UPDATE presentation_decks SET deck_json = ?, slide_count = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND version = ?`,
      [bodyStr, canonicalSlideCount, newVersion, deckId, orgId, expectedVersion]
    )) as { success?: boolean; changes?: number } | undefined;

    if ((updateResult?.changes ?? 0) === 0) {
      const latest = (await dbGet(
        'SELECT id, version FROM presentation_decks WHERE id = ? AND organization_id = ?',
        [deckId, orgId]
      )) as any;
      return res.status(409).json({
        success: false,
        error: 'Version conflict: deck was modified by another session. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: latest?.version ?? null,
        clientVersion,
      });
    }

    // MAT-010 lineage hook. Recorded only PAST the compare-and-swap guard
    // above, so a 409-losing writer never appears in the lineage. This is the
    // deck's real version-producing route: it snapshots the prior state into
    // `presentation_deck_versions` and advances `presentation_decks.version`.
    // `...Tracked` + `respondIfLineageLost` (Codex review, second round):
    // retry-safe because the CAS guard above rejects a retried PUT once the
    // mutation has actually applied (stale/behind version -> 409, never a
    // double-apply).
    const versionOutcome = await recordLineageEventTracked({
      organizationId: orgId,
      artifactKind: 'presentation',
      // `String(...)` because Express types `req.params` values as
      // `string | string[]` — same idiom as the share routes above.
      sourceRecordId: String(deckId),
      eventType: 'version',
      actorUserId: userId,
      detail: { version: newVersion, previousVersion: expectedVersion, via: 'autosave' },
    });
    if (respondIfLineageLost(res, versionOutcome)) return;

    res.json({ success: true, version: newVersion });
  })
);

router.post(
  '/decks/:deckId/agent-edit',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const deckId = String(req.params.deckId || '');
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
      // ★ Fala 2 (SPEC §3.3.4) — 1-based slide numbers protected by a manual
      // lock (`is_locked`) and skipped by this global/section edit. Surfaced
      // to the client so the approval banner can name them, not just count
      // `changedCards`.
      skippedLockedSlides: result.skippedLockedSlides,
    };
    await saveAiOperation(
      {
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
      },
      prompt,
      row.version || 1
    );
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
    const deckId = String(req.params.deckId || '');
    const operationId = String(req.params.operationId || '');
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
    const deckId = String(req.params.deckId || '');
    const operationId = String(req.params.operationId || '');
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
      const { checkDeckQualityGates } =
        await import('../services/presentationQualityGatesService.js');
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
      if (direct === 'public' || direct === 'internal' || direct === 'confidential')
        return direct as any;
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
          logger.warn('[Presentations] Could not load decks for governance watchlist', innerError);
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

    const { checkDeckQualityGates } =
      await import('../services/presentationQualityGatesService.js');

    const warnings: string[] = [];
    const inputs: WatchlistEntryInput[] = [];

    for (const deckRow of deckRows || []) {
      const deckId = String(deckRow?.id || '');
      if (!deckId) continue;
      const title = typeof deckRow?.title === 'string' ? deckRow.title : 'Untitled deck';
      const updatedAt = typeof deckRow?.updated_at === 'string' ? deckRow.updated_at : null;
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
        const reason = (error as any)?.message
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

// ---------------------------------------------------------------------------
// Sprint 9: Operations Health scoreboard
//
// Read-only SuperAdmin aggregate of:
//   - 5 SLO indicators (generation/export success, p95 latency, agent edit
//     acceptance, export blocked rate),
//   - last-run snapshots for the four scheduled jobs (retention, weekly
//     digest, governance CI, alert worker),
//   - 7-day alert dispatch volume bucketed by status.
//
// Every backing query is wrapped in try/catch so a missing table or schema
// drift degrades to "inconclusive"/"unknown" instead of returning 500.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sprint 13: Operations Health anomaly detection
//
// Helpers below build a per-SLO 24h baseline (24 buckets x 1h each) using
// the same algebra as the Sprint 11 drill-down service, then call the
// `presentationOperationsAnomalyDetectionService` detector. Anomalies are
// best-effort: if any backing query throws, the dashboard still renders
// (we just attach an empty `anomalies` array). Runtime events are
// throttled by `(orgId, sloId)` for 60 minutes to avoid event spam from
// repeated dashboard refreshes.
// ---------------------------------------------------------------------------

const ANOMALY_BASELINE_BUCKETS = 24;
const ANOMALY_BUCKET_MS = 60 * 60 * 1000;
const ANOMALY_THROTTLE_MS = 60 * 60 * 1000;
const ANOMALY_MIN_LATENCY_BUCKET_SAMPLES = 1;
const ANOMALY_DETECTABLE_SLO_IDS: DetectableSloId[] = [
  'generation_success_rate',
  'export_success_rate',
  'p95_generation_latency_ms',
  'agent_edit_success_rate',
  'export_blocked_rate',
];

interface AnomalyBucket {
  startMs: number;
  endMs: number;
}

function buildHourlyBuckets(nowMs: number, count: number): AnomalyBucket[] {
  const out: AnomalyBucket[] = [];
  for (let i = count; i > 0; i -= 1) {
    const endMs = nowMs - (i - 1) * ANOMALY_BUCKET_MS;
    const startMs = endMs - ANOMALY_BUCKET_MS;
    out.push({ startMs, endMs });
  }
  return out;
}

function pctOrNull(num: number, den: number): number | null {
  if (den <= 0) return null;
  return (num / den) * 100;
}

function p95ForLatency(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const v = sorted[idx];
  return typeof v === 'number' ? v : null;
}

function bucketObservedFor(
  sloId: DetectableSloId,
  bucket: AnomalyBucket,
  rows: {
    runtimeEvents: BuildOperationsHealthInput['runtimeEvents'];
    exportRecords: BuildOperationsHealthInput['exportRecords'];
    agentOperations: BuildOperationsHealthInput['agentOperations'];
  }
): number | null {
  const inBucket = (iso: string): boolean => {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return false;
    return ms >= bucket.startMs && ms < bucket.endMs;
  };

  switch (sloId) {
    case 'generation_success_rate': {
      let total = 0;
      let success = 0;
      for (const op of rows.agentOperations || []) {
        if (!op || !inBucket(op.createdAt)) continue;
        if (
          op.operationType !== 'agent_edit' &&
          op.operationType !== 'agent_bulk_revert' &&
          op.operationType !== 'agent_revert'
        ) {
          continue;
        }
        total += 1;
        if (op.status === 'applied' || op.status === 'accepted') success += 1;
      }
      return pctOrNull(success, total);
    }
    case 'export_success_rate': {
      let total = 0;
      let success = 0;
      for (const row of rows.exportRecords || []) {
        if (!row || !inBucket(row.createdAt)) continue;
        total += 1;
        if (row.status === 'completed') success += 1;
      }
      return pctOrNull(success, total);
    }
    case 'p95_generation_latency_ms': {
      const samples: number[] = [];
      for (const row of rows.exportRecords || []) {
        if (!row || !inBucket(row.createdAt)) continue;
        const dur = typeof row.durationMs === 'number' ? row.durationMs : null;
        if (dur !== null && Number.isFinite(dur) && dur >= 0) samples.push(dur);
      }
      if (samples.length < ANOMALY_MIN_LATENCY_BUCKET_SAMPLES) return null;
      return p95ForLatency(samples);
    }
    case 'agent_edit_success_rate': {
      let proposals = 0;
      let applied = 0;
      for (const evt of rows.runtimeEvents || []) {
        if (!evt || !inBucket(evt.createdAt)) continue;
        if (evt.eventType === 'agent_edit_proposal_created') proposals += 1;
        else if (evt.eventType === 'agent_edit_applied') applied += 1;
      }
      return pctOrNull(applied, proposals);
    }
    case 'export_blocked_rate': {
      let blocked = 0;
      let attempted = 0;
      for (const evt of rows.runtimeEvents || []) {
        if (!evt || !inBucket(evt.createdAt)) continue;
        if (evt.eventType === 'export_attempted') attempted += 1;
        else if (evt.eventType === 'export_blocked') blocked += 1;
      }
      if (attempted === 0) {
        for (const row of rows.exportRecords || []) {
          if (!row || !inBucket(row.createdAt)) continue;
          attempted += 1;
        }
      }
      return pctOrNull(blocked, attempted);
    }
    default:
      return null;
  }
}

function buildAnomalyContexts(
  slos: OperationsHealthReport['slos'],
  nowMs: number,
  rows: {
    runtimeEvents: BuildOperationsHealthInput['runtimeEvents'];
    exportRecords: BuildOperationsHealthInput['exportRecords'];
    agentOperations: BuildOperationsHealthInput['agentOperations'];
  }
): AnomalyContext[] {
  const buckets = buildHourlyBuckets(nowMs, ANOMALY_BASELINE_BUCKETS);
  const contexts: AnomalyContext[] = [];
  for (const slo of slos || []) {
    if (!ANOMALY_DETECTABLE_SLO_IDS.includes(slo.id as DetectableSloId)) continue;
    const baseline: AnomalySample[] = buckets.map((b) => ({
      observedAt: new Date(b.startMs).toISOString(),
      observedValue: bucketObservedFor(slo.id as DetectableSloId, b, rows),
    }));
    contexts.push({
      sloId: slo.id,
      current: slo.observedNumeric,
      baseline,
    });
  }
  return contexts;
}

/**
 * Best-effort: returns the set of (sloId) values that already have a
 * recent `anomaly_detected` runtime event for this org within the throttle
 * window. Schema-tolerance: a missing table or any error degrades to an
 * EMPTY set — i.e. throttling defaults to "allow write" so the operator
 * is never silently denied an alert because of a transient DB hiccup.
 */
async function loadRecentAnomalySloIds(orgId: string, nowMs: number): Promise<Set<string>> {
  const cutoffIso = new Date(nowMs - ANOMALY_THROTTLE_MS).toISOString();
  try {
    const rows = (await dbAll(
      `SELECT metadata_json
         FROM presentation_runtime_events
        WHERE organization_id = ?
          AND event_type = 'anomaly_detected'
          AND created_at >= ?
        LIMIT 500`,
      [orgId, cutoffIso]
    )) as Array<{ metadata_json: string | null }>;
    const out = new Set<string>();
    for (const r of rows || []) {
      if (!r || !r.metadata_json) continue;
      try {
        const parsed = JSON.parse(r.metadata_json) as { sloId?: unknown };
        if (parsed && typeof parsed.sloId === 'string') {
          out.add(parsed.sloId);
        }
      } catch {
        // Ignore unparseable metadata — never throw inside throttle.
      }
    }
    return out;
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn(
        '[Presentations] Could not load recent anomaly_detected events for throttling',
        error
      );
    }
    return new Set<string>();
  }
}

function findSloCurrent(slos: OperationsHealthReport['slos'], sloId: string): number | null {
  const slo = slos.find((s) => s.id === sloId);
  return slo ? slo.observedNumeric : null;
}

async function emitAnomalyEventsBestEffort(
  orgId: string,
  nowMs: number,
  anomalies: OperationsHealthAnomaly[],
  slos: OperationsHealthReport['slos']
): Promise<void> {
  const detected = anomalies.filter((a) => a.status === 'detected');
  if (detected.length === 0) return;

  const recentlyEmitted = await loadRecentAnomalySloIds(orgId, nowMs);

  for (const a of detected) {
    if (recentlyEmitted.has(a.sloId)) continue;
    try {
      await writePresentationRuntimeEvent({
        organizationId: orgId,
        deckId: null,
        eventType: 'anomaly_detected',
        scope: 'operations_health',
        metadata: {
          sloId: a.sloId,
          severity: a.severity,
          direction: a.direction,
          zScore: a.zScore,
          baselineMean: a.baselineMean,
          current: findSloCurrent(slos, a.sloId),
          reason: a.reason,
        },
      });
    } catch (err) {
      // Writing the event is best-effort: never fail the dashboard
      // request because we couldn't persist a runtime event.
      if (!isSchemaMissingError(err)) {
        logger.warn(
          `[Presentations] Failed to write anomaly_detected event for slo=${a.sloId}`,
          err
        );
      }
    }
  }
}

function escapeHtmlForAnomaly(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a small HTML "Anomalies" fragment that the export endpoint
 * injects into the existing operations-health document. The rendered
 * fragment is scoped to inline styles so it does not depend on the
 * upstream PDF service template (which we deliberately do not modify
 * to keep the touch-blast small).
 */
function renderAnomaliesHtmlFragment(anomalies: OperationsHealthAnomaly[] | undefined): string {
  const detected = (anomalies || []).filter((a) => a.status === 'detected');
  if (detected.length === 0) return '';
  const items = detected
    .map((a) => {
      const severity = a.severity === 'major' ? 'Major' : 'Minor';
      const direction = a.direction || '';
      const z = typeof a.zScore === 'number' ? a.zScore.toFixed(2) : '—';
      const baseline = typeof a.baselineMean === 'number' ? a.baselineMean.toFixed(2) : '—';
      return `
        <li style="margin: 6px 0;">
          <span style="display:inline-block;background:#fb923c;color:#fff;border-radius:9999px;padding:1px 8px;font-size:9pt;font-weight:600;margin-right:6px;">${escapeHtmlForAnomaly(severity)} anomaly</span>
          <strong>${escapeHtmlForAnomaly(a.sloId)}</strong>
          <span style="color:#475569;"> · z=${escapeHtmlForAnomaly(z)} · baseline ${escapeHtmlForAnomaly(baseline)} · ${escapeHtmlForAnomaly(direction)}</span>
          <div style="font-size:9pt;color:#64748b;margin-top:2px;">${escapeHtmlForAnomaly(a.reason || '')}</div>
        </li>`;
    })
    .join('');
  return `
    <section style="margin-top:24px;padding:12px 16px;border:1px solid #fed7aa;background:#fff7ed;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;font-size:11pt;color:#9a3412;">Anomalies (${detected.length})</h3>
      <ul style="list-style:none;padding:0;margin:0;font-size:10pt;color:#1f2937;">${items}</ul>
      <p style="margin:8px 0 0 0;font-size:9pt;color:#9a3412;">Detected vs the prior 24h baseline (1h buckets, z-score). See <em>PRESENTATION_OPS_ANOMALY_DETECTION.md</em>.</p>
    </section>`;
}

function injectAnomaliesIntoExportHtml(
  html: string,
  anomalies: OperationsHealthAnomaly[] | undefined
): string {
  const fragment = renderAnomaliesHtmlFragment(anomalies);
  if (!fragment) return html;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${fragment}\n</body>`);
  }
  return `${html}\n${fragment}`;
}

/**
 * Compute and (best-effort) emit anomalies for a freshly-built ops report.
 * Returns the anomalies array to be merged into the response. This function
 * NEVER throws — any failure resolves to an empty array so the green-path
 * report is unaffected.
 */
async function computeAnomaliesForReport(params: {
  orgId: string;
  nowMs: number;
  report: OperationsHealthReport;
  rows: {
    runtimeEvents: BuildOperationsHealthInput['runtimeEvents'];
    exportRecords: BuildOperationsHealthInput['exportRecords'];
    agentOperations: BuildOperationsHealthInput['agentOperations'];
  };
}): Promise<OperationsHealthAnomaly[]> {
  try {
    const contexts = buildAnomalyContexts(params.report.slos, params.nowMs, params.rows);
    const verdicts = detectAnomaliesForReport({
      contexts,
      nowIso: new Date(params.nowMs).toISOString(),
    });
    const anomalies: OperationsHealthAnomaly[] = verdicts.map((v) => ({
      sloId: v.sloId,
      status: v.verdict.status,
      direction: v.verdict.direction,
      severity: v.verdict.severity,
      reason: v.verdict.reason,
      baselineMean: v.verdict.baselineMean,
      zScore: v.verdict.zScore,
    }));
    await emitAnomalyEventsBestEffort(params.orgId, params.nowMs, anomalies, params.report.slos);
    return anomalies;
  } catch (err) {
    logger.warn('[Presentations] Anomaly detection pipeline failed; degrading to empty', err);
    return [];
  }
}

// Shared loader for the Operations Health scoreboard. Extracted so the
// HTML/PDF export endpoint (`/operations/health/export`) can reuse the
// exact same query block + warnings shape as the JSON endpoint without
// duplicating ~200 lines of try/catch fall-throughs. Returns the assembled
// report along with the merged warnings list.
async function loadOperationsHealthReport(params: {
  orgId: string;
  windowDays: number;
}): Promise<{ report: OperationsHealthReport; warnings: string[] }> {
  const { orgId, windowDays } = params;
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const routeWarnings: string[] = [];

  let runtimeEvents: BuildOperationsHealthInput['runtimeEvents'] = [];
  try {
    const rows = (await dbAll(
      `SELECT event_type, metadata_json, created_at
       FROM presentation_runtime_events
       WHERE organization_id = ? AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 5000`,
      [orgId, cutoffIso]
    )) as Array<{
      event_type: string;
      metadata_json: string | null;
      created_at: string;
    }>;
    runtimeEvents = (rows || []).map((r) => ({
      eventType: String(r.event_type || ''),
      payloadJson: r.metadata_json ?? null,
      createdAt: String(r.created_at || ''),
    }));
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not load runtime events for ops health', error);
    }
    routeWarnings.push('runtime_events_unavailable');
  }

  let exportRecords: BuildOperationsHealthInput['exportRecords'] = [];
  try {
    const rows = (await dbAll(
      `SELECT status, created_at, completed_at
       FROM presentation_export_records
       WHERE organization_id = ? AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 5000`,
      [orgId, cutoffIso]
    )) as Array<{
      status: string;
      created_at: string;
      completed_at: string | null;
    }>;
    exportRecords = (rows || []).map((r) => {
      const startMs = Date.parse(String(r.created_at || ''));
      const endMs = r.completed_at ? Date.parse(String(r.completed_at)) : NaN;
      const durationMs =
        Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
          ? endMs - startMs
          : null;
      return {
        status: String(r.status || ''),
        createdAt: String(r.created_at || ''),
        durationMs,
      };
    });
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not load export records for ops health', error);
    }
    routeWarnings.push('exports_unavailable');
  }

  let agentOperations: BuildOperationsHealthInput['agentOperations'] = [];
  try {
    const rows = (await dbAll(
      `SELECT status, operation_type, created_at
       FROM presentation_ai_operations
       WHERE organization_id = ? AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 5000`,
      [orgId, cutoffIso]
    )) as Array<{
      status: string;
      operation_type: string;
      created_at: string;
    }>;
    agentOperations = (rows || []).map((r) => ({
      status: String(r.status || ''),
      operationType: String(r.operation_type || ''),
      createdAt: String(r.created_at || ''),
    }));
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not load agent operations for ops health', error);
    }
    routeWarnings.push('agent_operations_unavailable');
  }

  const jobRuns: BuildOperationsHealthInput['jobRuns'] = {};

  try {
    const purgeRow = (await dbGet(
      `SELECT MAX(created_at) AS last_run
       FROM presentation_runtime_events
       WHERE organization_id = ? AND event_type = 'retention_purge'`,
      [orgId]
    )) as { last_run: string | null } | undefined;
    jobRuns.retentionTelemetry = {
      lastRunAt: purgeRow?.last_run || null,
      status: purgeRow?.last_run ? 'pass' : 'unknown',
      summary: purgeRow?.last_run ? 'Most recent retention_purge runtime event.' : null,
    };
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not load retention purge snapshot', error);
    }
    jobRuns.retentionTelemetry = { lastRunAt: null, status: 'unknown', summary: null };
    routeWarnings.push('retention_telemetry_unavailable');
  }

  jobRuns.weeklyDigest = { lastRunAt: null, status: 'unknown', summary: null };
  jobRuns.governanceCi = { lastRunAt: null, status: 'unknown', summary: null };

  let pausedSubscriptionsCount = 0;
  try {
    const workerRow = (await dbGet(
      `SELECT last_run_at, last_run_summary, paused
       FROM presentation_governance_alert_worker_state
       WHERE organization_id = ?`,
      [orgId]
    )) as
      | {
          last_run_at: string | null;
          last_run_summary: string | null;
          paused: boolean | number | null;
        }
      | undefined;
    let workerStatus: string = 'unknown';
    if (workerRow?.last_run_summary) {
      try {
        const parsed = JSON.parse(workerRow.last_run_summary) as { ok?: boolean };
        if (parsed?.ok === true) workerStatus = 'pass';
        else if (parsed?.ok === false) workerStatus = 'fail';
      } catch {
        workerStatus = 'pass';
      }
    }
    jobRuns.alertWorker = {
      lastRunAt: workerRow?.last_run_at || null,
      status: workerStatus,
      summary: workerRow?.last_run_summary ?? null,
    };
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not load alert worker state', error);
    }
    jobRuns.alertWorker = { lastRunAt: null, status: 'unknown', summary: null };
    routeWarnings.push('alert_worker_unavailable');
  }

  try {
    const pausedRow = (await dbGet(
      `SELECT COUNT(*) AS n
       FROM presentation_governance_alert_subscriptions
       WHERE organization_id = ? AND active = FALSE`,
      [orgId]
    )) as { n: number | string | null } | undefined;
    const n = Number(pausedRow?.n ?? 0);
    pausedSubscriptionsCount = Number.isFinite(n) ? n : 0;
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not count paused alert subscriptions', error);
    }
  }

  let alertDispatchRows: BuildOperationsHealthInput['alertDispatchRows'] = [];
  try {
    const rows = (await dbAll(
      `SELECT status, deck_id, created_at
       FROM presentation_governance_alert_dispatches
       WHERE organization_id = ? AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 5000`,
      [orgId, cutoffIso]
    )) as Array<{ status: string; deck_id: string; created_at: string }>;
    alertDispatchRows = (rows || []).map((r) => ({
      status: String(r.status || ''),
      deckId: String(r.deck_id || ''),
      createdAt: String(r.created_at || ''),
    }));
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn('[Presentations] Could not load alert dispatches for ops health', error);
    }
    routeWarnings.push('alert_dispatches_unavailable');
  }

  const report = buildOperationsHealthReport({
    organizationId: orgId,
    windowDays,
    nowIso,
    runtimeEvents,
    exportRecords,
    agentOperations,
    jobRuns,
    alertDispatchRows,
    pausedSubscriptionsCount,
  });

  const merged = Array.from(new Set([...(report.warnings || []), ...routeWarnings]));
  const reportWithWarnings: OperationsHealthReport = {
    ...report,
    warnings: merged,
  };

  // Sprint 13: anomalies. Best-effort — failure resolves to an empty
  // array so the rest of the report still renders. Runtime events are
  // throttled per-(org,sloId) for 60 minutes inside `computeAnomaliesForReport`.
  const anomalies = await computeAnomaliesForReport({
    orgId,
    nowMs: Date.parse(nowIso),
    report: reportWithWarnings,
    rows: { runtimeEvents, exportRecords, agentOperations },
  });

  return {
    report: { ...reportWithWarnings, anomalies },
    warnings: merged,
  };
}

function clampOpsHealthWindowDays(raw: unknown): number {
  const n = Number(raw);
  return Math.min(Math.max(Number.isFinite(n) && n > 0 ? Math.round(n) : 7, 1), 30);
}

router.get(
  '/operations/health',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const windowDays = clampOpsHealthWindowDays(req.query.windowDays);
    const { report } = await loadOperationsHealthReport({ orgId, windowDays });

    res.json({ success: true, data: report });
  })
);

// ---------------------------------------------------------------------------
// Sprint 12: Operations Health export
//
// `GET /operations/health/export?windowDays=N&format=html|pdf`
//
// Returns the Operations Health scoreboard as either:
//
//   - `format=html` (default): self-contained HTML document with a print
//     banner. Subscribers can still save as PDF via the browser's
//     Print-to-PDF flow.
//   - `format=pdf`: real `application/pdf` rendered server-side via the
//     Playwright-backed `renderOperationsHealthPdf` pipeline. If Playwright
//     or chromium are not available on this host (or the renderer crashes
//     mid-flight), the endpoint transparently falls back to HTML and
//     surfaces the reason via response headers:
//       * `X-Operations-Health-Format-Fallback: html`
//       * `X-Operations-Health-Fallback-Reason: <renderer status>`
//     A successful PDF render returns `X-Operations-Health-Format: pdf`.
//
// Schema-tolerance: missing tables degrade to empty / inconclusive values
// upstream in `loadOperationsHealthReport`, so this endpoint should never
// 500 because of missing data — only because of permission errors.
// ---------------------------------------------------------------------------

router.get(
  '/operations/health/export',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const windowDays = clampOpsHealthWindowDays(req.query.windowDays);
    const formatRaw = String(req.query.format || 'html').toLowerCase();
    const format: 'html' | 'pdf' = formatRaw === 'pdf' ? 'pdf' : 'html';

    const { report } = await loadOperationsHealthReport({ orgId, windowDays });

    if (format === 'pdf') {
      try {
        const result = await renderOperationsHealthPdf({
          report,
          organizationName: orgId,
          generatedBy: getUserId(req),
        });

        if (result.status === 'pdf' && result.buffer) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Operations-Health-Format', 'pdf');
          return res.status(200).send(result.buffer);
        }

        const fallbackHtml = injectAnomaliesIntoExportHtml(result.html ?? '', report.anomalies);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Operations-Health-Format-Fallback', 'html');
        if (result.fallbackReason) {
          res.setHeader('X-Operations-Health-Fallback-Reason', result.fallbackReason);
        }
        return res.status(200).send(fallbackHtml);
      } catch (err) {
        // Last-ditch HTML fallback: the PDF pipeline already wraps every
        // failure mode in a typed result, but if something truly unexpected
        // bubbles up we still want the endpoint to remain useful rather
        // than 500.
        logger.warn(
          '[Presentations] Operations Health PDF renderer threw, falling back to HTML',
          err
        );
        const rendered = renderOperationsHealthHtml({
          report,
          organizationName: orgId,
          generatedBy: getUserId(req),
        });
        const renderedHtml = injectAnomaliesIntoExportHtml(rendered.html, report.anomalies);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${rendered.filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Operations-Health-Format-Fallback', 'html');
        res.setHeader('X-Operations-Health-Fallback-Reason', 'pdf_renderer_crashed');
        return res.status(200).send(renderedHtml);
      }
    }

    // format === 'html': original Sprint 12 behavior.
    const rendered = renderOperationsHealthHtml({
      report,
      organizationName: orgId,
      generatedBy: getUserId(req),
    });
    const renderedHtml = injectAnomaliesIntoExportHtml(rendered.html, report.anomalies);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${rendered.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(renderedHtml);
  })
);

// ---------------------------------------------------------------------------
// Sprint 11: Operations Health drill-down per SLO
//
// Companion to GET /operations/health that returns a 30-day (configurable)
// trend bucketed at 1..7 day granularity, the top problematic decks, and a
// short list of recent event samples for ONE SLO indicator. Schema-tolerant:
// missing tables degrade to empty arrays + warnings rather than 500.
// ---------------------------------------------------------------------------

const DRILLDOWN_SLO_IDS = new Set<DrilldownSloId>([
  'generation_success_rate',
  'export_success_rate',
  'p95_generation_latency_ms',
  'agent_edit_success_rate',
  'export_blocked_rate',
]);

router.get(
  '/operations/health/slo/:sloId/drilldown',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const sloIdParam = String(req.params.sloId || '');
    if (!DRILLDOWN_SLO_IDS.has(sloIdParam as DrilldownSloId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SLO id',
        code: 'INVALID_SLO_ID',
        allowed: Array.from(DRILLDOWN_SLO_IDS),
      });
    }
    const sloId = sloIdParam as DrilldownSloId;

    const windowDaysRaw = Number(req.query.windowDays);
    const windowDays = Math.min(
      Math.max(
        Number.isFinite(windowDaysRaw) && windowDaysRaw > 0 ? Math.round(windowDaysRaw) : 30,
        1
      ),
      90
    );
    const bucketDaysRaw = Number(req.query.bucketDays);
    const bucketDays = Math.min(
      Math.max(
        Number.isFinite(bucketDaysRaw) && bucketDaysRaw > 0 ? Math.round(bucketDaysRaw) : 1,
        1
      ),
      7
    );
    const nowIso = new Date().toISOString();
    const cutoffIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    const routeWarnings: string[] = [];

    // Runtime events: drives agent_edit_success_rate + export_blocked_rate.
    let runtimeEvents: BuildSloDrilldownInput['runtimeEvents'] = [];
    try {
      const rows = (await dbAll(
        `SELECT deck_id, event_type, metadata_json, created_at
         FROM presentation_runtime_events
         WHERE organization_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 5000`,
        [orgId, cutoffIso]
      )) as Array<{
        deck_id: string | null;
        event_type: string;
        metadata_json: string | null;
        created_at: string;
      }>;
      runtimeEvents = (rows || []).map((r) => ({
        deckId: String(r.deck_id || ''),
        eventType: String(r.event_type || ''),
        payloadJson: r.metadata_json ?? null,
        createdAt: String(r.created_at || ''),
      }));
    } catch (error) {
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] Could not load runtime events for ops drilldown', error);
      }
      routeWarnings.push('runtime_events_unavailable');
    }

    // Export records: drives export_success_rate + p95 latency + blocked-rate
    // fallback. Duration is computed as completed_at - created_at because the
    // schema does not store a precomputed durationMs column.
    let exportRecords: BuildSloDrilldownInput['exportRecords'] = [];
    try {
      const rows = (await dbAll(
        `SELECT deck_id, status, format, created_at, completed_at
         FROM presentation_export_records
         WHERE organization_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 5000`,
        [orgId, cutoffIso]
      )) as Array<{
        deck_id: string | null;
        status: string;
        format: string | null;
        created_at: string;
        completed_at: string | null;
      }>;
      exportRecords = (rows || []).map((r) => {
        const startMs = Date.parse(String(r.created_at || ''));
        const endMs = r.completed_at ? Date.parse(String(r.completed_at)) : NaN;
        const durationMs =
          Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
            ? endMs - startMs
            : null;
        return {
          deckId: String(r.deck_id || ''),
          status: String(r.status || ''),
          format: String(r.format || ''),
          durationMs,
          createdAt: String(r.created_at || ''),
        };
      });
    } catch (error) {
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] Could not load export records for ops drilldown', error);
      }
      routeWarnings.push('exports_unavailable');
    }

    // Agent operations: drives generation_success_rate.
    let agentOperations: BuildSloDrilldownInput['agentOperations'] = [];
    try {
      const rows = (await dbAll(
        `SELECT deck_id, status, operation_type, created_at
         FROM presentation_ai_operations
         WHERE organization_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT 5000`,
        [orgId, cutoffIso]
      )) as Array<{
        deck_id: string | null;
        status: string;
        operation_type: string;
        created_at: string;
      }>;
      agentOperations = (rows || []).map((r) => ({
        deckId: String(r.deck_id || ''),
        status: String(r.status || ''),
        operationType: String(r.operation_type || ''),
        createdAt: String(r.created_at || ''),
      }));
    } catch (error) {
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] Could not load agent operations for ops drilldown', error);
      }
      routeWarnings.push('agent_operations_unavailable');
    }

    // Deck titles: best-effort lookup so the side panel can render human
    // labels. Limit defensive size — the report only uses up to 5 decks.
    let decks: BuildSloDrilldownInput['decks'] = [];
    try {
      const rows = (await dbAll(
        `SELECT id, title
         FROM presentation_decks
         WHERE organization_id = ?
         ORDER BY updated_at DESC
         LIMIT 5000`,
        [orgId]
      )) as Array<{ id: string; title: string | null }>;
      decks = (rows || []).map((r) => ({
        id: String(r.id || ''),
        title: r.title ? String(r.title) : String(r.id || ''),
      }));
    } catch (error) {
      if (!isSchemaMissingError(error)) {
        logger.warn('[Presentations] Could not load decks for ops drilldown', error);
      }
      routeWarnings.push('decks_unavailable');
    }

    const report = buildSloDrilldownReport({
      sloId,
      windowDays,
      bucketDays,
      nowIso,
      runtimeEvents,
      exportRecords,
      agentOperations,
      decks,
    });

    const mergedWarnings = Array.from(new Set([...(report.warnings || []), ...routeWarnings]));

    return res.json({
      success: true,
      data: { ...report, warnings: mergedWarnings },
    });
  })
);

// ---------------------------------------------------------------------------
// Sprint 15 — H2: Benchmark trend (vs Gamma target)
//
// `GET /api/presentations/benchmark/trend?windowMonths=N&referenceSet=...`
//
// Returns the per-dimension regression trend report consumed by the
// SuperAdmin "Benchmark Trend" tab. The pure builder lives in
// `presentationBenchmarkTrendService` and is fully unit-tested. The DB
// loader is schema-tolerant: when migration 768
// (`presentation_benchmark_runs`) hasn't shipped yet, the loader returns
// `[]` and the builder yields an INCONCLUSIVE verdict instead of 500.
// ---------------------------------------------------------------------------

router.get(
  '/benchmark/trend',
  asyncHandler(async (req, res) => {
    // Spec called for `presentation_view`, but the live PresentationCapability
    // type doesn't include that token. Mirror the Operations Health endpoint
    // (`/operations/health`) and gate on `presentation_edit` so SuperAdmin /
    // OWNER / ADMIN can read the dashboard while VIEWER cannot.
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const rawWindow = Number(req.query.windowMonths);
    const windowMonths = Math.min(
      Math.max(
        Number.isFinite(rawWindow) && rawWindow > 0
          ? Math.round(rawWindow)
          : TREND_DEFAULT_WINDOW_MONTHS,
        1
      ),
      TREND_MAX_WINDOW_MONTHS
    );

    const referenceSetRaw = req.query.referenceSet;
    const referenceSet =
      typeof referenceSetRaw === 'string' && referenceSetRaw.length > 0 ? referenceSetRaw : 'dbr77';

    // Pull a generous slice (roughly one record per month, +50% headroom for
    // re-runs) and let the pure builder do the windowing math.
    const runs = await loadRecentBenchmarkRuns(orgId, {
      limit: Math.max(windowMonths, 12) + 12,
      referenceSet,
    });

    const report = buildBenchmarkTrendReport({
      runs,
      organizationId: orgId,
      referenceSet,
      nowIso: new Date().toISOString(),
    });

    // The builder's `windowMonths` reflects the actual data span; preserve
    // the operator's requested window in the response so the UI can keep its
    // selector in sync even when the dataset is sparse.
    return res.json({
      success: true,
      data: { ...report, windowMonths },
    });
  })
);

// ---------------------------------------------------------------------------
// Sprint 9: Governance Watchlist saved filter presets (per-org, RBAC-gated)
//
// Storage-only CRUD for the SuperAdmin watchlist UI. The watchlist GET above
// stays preset-agnostic — the client decides which preset is active. We use
// `validatePresetCreateInput` from `presentationWatchlistPresetService` for
// stable error codes and silently degrade (return an empty list with a
// warning) when the migration has not run yet, so the UI never crashes
// during partial deploys.
// ---------------------------------------------------------------------------

function rowToWatchlistPreset(row: Record<string, any>): WatchlistPreset {
  let filters: WatchlistPresetFilters;
  try {
    filters = normalizePresetFilters(JSON.parse(String(row.filters_json ?? '{}')));
  } catch {
    filters = normalizePresetFilters({});
  }
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    filters,
    isDefault: Boolean(row.is_default),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
  };
}

router.get(
  '/governance/watchlist-presets',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const warnings: string[] = [];
    let presets: WatchlistPreset[] = [];

    try {
      const rows = (await dbAll(
        `SELECT id, organization_id, name, description, filters_json,
                is_default, created_by, created_at, updated_at
           FROM presentation_watchlist_presets
          WHERE organization_id = ?
          ORDER BY is_default DESC, name ASC`,
        [orgId]
      )) as Array<Record<string, any>>;
      presets = (rows || []).map(rowToWatchlistPreset);
      // Defensive secondary sort: DBs that lack a stable case-insensitive
      // collation (eg. SQLite default) should still produce a UI-friendly
      // ordering with default presets first.
      presets.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return comparePresetsByName(a, b);
      });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        warnings.push('schema_missing_watchlist_presets');
      } else {
        logger.warn('[Presentations] watchlist-presets list failed', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to load watchlist presets',
        });
      }
    }

    res.json({
      success: true,
      data: {
        presets,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    });
  })
);

router.post(
  '/governance/watchlist-presets',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const validation = validatePresetCreateInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        code: validation.error,
      });
    }
    const input = validation.value;

    const id = uuidv4().replace(/-/g, '');
    const filtersJson = JSON.stringify(input.filters);

    try {
      // Only one default preset per org. We clear existing defaults first so
      // the partial unique index (is_default = TRUE) cannot collide on
      // INSERT. Both statements share the same orgId scope.
      if (input.isDefault) {
        await dbRun(
          `UPDATE presentation_watchlist_presets
              SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE organization_id = ? AND is_default = TRUE`,
          [orgId]
        );
      }

      await dbRun(
        `INSERT INTO presentation_watchlist_presets (
           id, organization_id, name, description, filters_json,
           is_default, created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          orgId,
          input.name,
          input.description ?? null,
          filtersJson,
          input.isDefault === true,
          userId,
        ]
      );
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.json({
          success: true,
          data: {
            preset: null,
            warnings: ['schema_missing_watchlist_presets'],
          },
        });
      }
      const msg = String((error as any)?.message || '').toLowerCase();
      if (
        msg.includes('unique') ||
        msg.includes('duplicate') ||
        msg.includes('idx_pres_watchlist_presets_org_name')
      ) {
        return res.status(409).json({
          success: false,
          error: 'name_taken',
          code: 'NAME_TAKEN',
        });
      }
      logger.warn('[Presentations] watchlist-presets create failed', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create watchlist preset',
      });
    }

    const created = await dbGet(
      `SELECT id, organization_id, name, description, filters_json,
              is_default, created_by, created_at, updated_at
         FROM presentation_watchlist_presets
        WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );

    res.json({
      success: true,
      data: {
        preset: created
          ? rowToWatchlistPreset(created as Record<string, any>)
          : {
              id,
              organizationId: orgId,
              name: input.name,
              description: input.description ?? null,
              filters: input.filters,
              isDefault: input.isDefault === true,
              createdBy: userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
      },
    });
  })
);

router.delete(
  '/governance/watchlist-presets/:id',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const presetId = String(req.params.id || '');
    if (!presetId) {
      return res.status(400).json({ success: false, error: 'Preset id required' });
    }

    try {
      const existing = (await dbGet(
        `SELECT id FROM presentation_watchlist_presets
          WHERE id = ? AND organization_id = ?`,
        [presetId, orgId]
      )) as { id: string } | null;
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Preset not found' });
      }

      await dbRun(
        `DELETE FROM presentation_watchlist_presets
          WHERE id = ? AND organization_id = ?`,
        [presetId, orgId]
      );
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.status(404).json({ success: false, error: 'Preset not found' });
      }
      logger.warn('[Presentations] watchlist-presets delete failed', error);
      return res.status(500).json({ success: false, error: 'Failed to delete preset' });
    }

    res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Sprint 12: Governance Watchlist Saved Searches (per-org, RBAC-gated)
//
// Persisted ad-hoc text searches (free-text deck-title query + verdict /
// confidentiality / minSeverity filters). Storage-only — the watchlist
// GET endpoint stays preset-agnostic; the client decides which saved
// search is active and applies it client-side (so highlighting and the
// rendered table stay in sync). Status mapping mirrors the service:
//   invalid → 400
//   name_conflict → 409
//   storage_error → 503
//   not_found → 404
// Schema-tolerance: if migration 766 has not landed, list returns []
// and writes return 503 so the UI can show an honest "apply migration"
// banner instead of a generic 500.
// ---------------------------------------------------------------------------

router.get(
  '/governance/watchlist/saved-searches',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const result = await listWatchlistSavedSearches(orgId);
    const warnings: string[] = [];
    if (result.status === 'storage_error' && result.reason) {
      warnings.push(`schema_missing_watchlist_saved_searches:${result.reason}`);
    }

    res.json({
      success: true,
      data: {
        savedSearches: result.records,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    });
  })
);

router.post(
  '/governance/watchlist/saved-searches',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const result = await createWatchlistSavedSearch(orgId, req.body, userId);
    if (result.status === 'invalid') {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        code: 'INVALID',
        errors: result.errors ?? [],
      });
    }
    if (result.status === 'name_conflict') {
      return res.status(409).json({
        success: false,
        error: 'name_taken',
        code: 'NAME_TAKEN',
      });
    }
    if (result.status === 'storage_error') {
      return res.status(503).json({
        success: false,
        error: 'storage_error',
        code: 'STORAGE_ERROR',
        reason: result.reason ?? 'unavailable',
      });
    }

    res.json({
      success: true,
      data: {
        savedSearch: result.record,
        ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
      },
    });
  })
);

router.delete(
  '/governance/watchlist/saved-searches/:id',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const id = String(req.params.id || '');
    if (!id) {
      return res.status(400).json({ success: false, error: 'Saved search id required' });
    }

    const result = await deleteWatchlistSavedSearch(orgId, id);
    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    if (result.status === 'storage_error') {
      return res.status(503).json({
        success: false,
        error: 'storage_error',
        reason: result.reason ?? 'unavailable',
      });
    }

    res.json({ success: true });
  })
);

// Optional bookkeeping endpoint: bumps `use_count` and stamps
// `last_used_at` so the UI can surface recently-used searches in a
// future iteration. Always 200 so the client can fire-and-forget.
router.post(
  '/governance/watchlist/saved-searches/:id/mark-used',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const id = String(req.params.id || '');
    if (orgId && id) {
      try {
        await markWatchlistSavedSearchUsed(orgId, id);
      } catch (error) {
        logger.warn('[Presentations] watchlist saved search mark-used failed', error);
      }
    }
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Sprint 8: Governance Watchlist Alert Subscriptions
//
// Outbound webhook/email/slack subscriptions and dispatch audit. The watchlist
// GET above stays read-only; alert dispatch runs through the dedicated
// `dispatchAlertsForTransition` orchestrator so a future periodic worker can
// reuse the same surface without coupling to the GET endpoint.
// ---------------------------------------------------------------------------

const ALERT_CHANNELS = new Set(['webhook', 'email', 'slack']);
const ALERT_SEVERITIES = new Set(['BLOCKED_P0', 'BLOCKED_P1']);

router.get(
  '/governance/alert-subscriptions',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const warnings: string[] = [];
    let subscriptions: Array<{
      id: string;
      channel: string;
      targetRedacted: string;
      minSeverity: string;
      active: boolean;
    }> = [];

    try {
      const rows = await listActiveSubscriptions(orgId);
      subscriptions = rows.map((sub) => ({
        id: sub.id,
        channel: sub.channel,
        targetRedacted: maskTarget(sub.target),
        minSeverity: sub.minSeverity,
        active: sub.active,
      }));
    } catch (error) {
      if (isSchemaMissingError(error)) {
        warnings.push('schema_missing_alert_tables');
      } else {
        logger.warn('[Presentations] alert-subscriptions list failed', error);
        warnings.push('list_failed');
      }
    }

    res.json({
      success: true,
      data: {
        subscriptions,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    });
  })
);

router.post(
  '/governance/alert-subscriptions',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const channelRaw = String(req.body?.channel || '').toLowerCase();
    const targetRaw = typeof req.body?.target === 'string' ? req.body.target.trim() : '';
    const minSeverityRaw = String(req.body?.minSeverity || 'BLOCKED_P1');

    if (!ALERT_CHANNELS.has(channelRaw)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel',
        code: 'INVALID_CHANNEL',
        allowed: Array.from(ALERT_CHANNELS),
      });
    }
    if (!targetRaw) {
      return res.status(400).json({
        success: false,
        error: 'Target is required',
        code: 'TARGET_REQUIRED',
      });
    }
    if (!ALERT_SEVERITIES.has(minSeverityRaw)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid minSeverity',
        code: 'INVALID_MIN_SEVERITY',
        allowed: Array.from(ALERT_SEVERITIES),
      });
    }

    const id = uuidv4().replace(/-/g, '');
    try {
      await dbRun(
        `INSERT INTO presentation_governance_alert_subscriptions (
           id, organization_id, channel, target, min_severity, active, created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, orgId, channelRaw, targetRaw, minSeverityRaw, userId]
      );
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.json({
          success: true,
          data: {
            subscription: null,
            warnings: ['schema_missing_alert_tables'],
          },
        });
      }
      logger.warn('[Presentations] alert-subscriptions create failed', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create alert subscription',
      });
    }

    res.json({
      success: true,
      data: {
        subscription: {
          id,
          channel: channelRaw,
          targetRedacted: maskTarget(targetRaw),
          minSeverity: minSeverityRaw,
          active: true,
        },
      },
    });
  })
);

router.delete(
  '/governance/alert-subscriptions/:id',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const subId = String(req.params.id || '');
    if (!subId) {
      return res.status(400).json({ success: false, error: 'Subscription id required' });
    }

    try {
      const existing = (await dbGet(
        `SELECT id FROM presentation_governance_alert_subscriptions
          WHERE id = ? AND organization_id = ? AND active = TRUE`,
        [subId, orgId]
      )) as { id: string } | null;
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Subscription not found' });
      }

      await dbRun(
        `UPDATE presentation_governance_alert_subscriptions
            SET active = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?`,
        [subId, orgId]
      );
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.json({
          success: true,
          data: { warnings: ['schema_missing_alert_tables'] },
        });
      }
      logger.warn('[Presentations] alert-subscriptions delete failed', error);
      return res.status(500).json({ success: false, error: 'Failed to delete subscription' });
    }

    res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Sprint 11: Subscriber onboarding — secret rotation + signed test delivery.
//
// `rotate-secret`     One-time reveal of a freshly generated 64-hex secret.
//                     This is the ONLY path that returns the raw secret;
//                     list/get endpoints (Sprint 8/9) only ever expose the
//                     redacted target. Audit log records the rotation event
//                     but NEVER the secret material.
//
// `test-delivery`     Synthetic signed POST so the subscriber app can
//                     verify their HMAC pipeline end-to-end before real
//                     governance traffic flows. Always 200; status is
//                     reported in the response body so the SuperAdmin can
//                     see the failure detail (httpStatus, durationMs,
//                     signaturePreview, payloadPreview).
// ---------------------------------------------------------------------------
router.post(
  '/governance/alert-subscriptions/:id/rotate-secret',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const subId = String(req.params.id || '').trim();
    if (!subId) {
      return res.status(400).json({ success: false, error: 'Subscription id required' });
    }
    if (req.body?.confirm !== true) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        code: 'CONFIRMATION_REQUIRED',
      });
    }

    const result = await rotateSubscriptionSecret({
      subscriptionId: subId,
      organizationId: orgId,
    });

    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    if (result.status === 'inactive') {
      return res.status(409).json({
        success: false,
        error: 'subscription_inactive',
        code: 'SUBSCRIPTION_INACTIVE',
      });
    }

    const rotatedAt = new Date().toISOString();
    try {
      await auditEventsService.log({
        actorId: userId,
        actorType: 'USER',
        organizationId: orgId,
        action: 'rotate_secret',
        resourceType: 'presentation_governance_alert_subscription',
        resourceId: subId,
        metadata: { rotated_at: rotatedAt },
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (error) {
      logger.warn('[Presentations] alert-subscriptions rotate-secret audit log failed', error);
    }

    res.json({
      success: true,
      data: {
        subscription: result.subscription,
        oneTimeSecret: result.oneTimeSecret,
      },
    });
  })
);

router.post(
  '/governance/alert-subscriptions/:id/test-delivery',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const subId = String(req.params.id || '').trim();
    if (!subId) {
      return res.status(400).json({ success: false, error: 'Subscription id required' });
    }

    const verdictRaw = String(req.body?.syntheticVerdict || 'BLOCKED_P0');
    const syntheticVerdict: AlertSeverity = ALERT_SEVERITIES.has(verdictRaw)
      ? (verdictRaw as AlertSeverity)
      : 'BLOCKED_P0';
    const syntheticDeckId =
      typeof req.body?.syntheticDeckId === 'string' && req.body.syntheticDeckId.trim().length > 0
        ? String(req.body.syntheticDeckId).trim().slice(0, 128)
        : undefined;

    const result = await sendTestDelivery({
      subscriptionId: subId,
      organizationId: orgId,
      syntheticDeckId,
      syntheticVerdict,
    });

    try {
      await auditEventsService.log({
        actorId: userId,
        actorType: 'USER',
        organizationId: orgId,
        action: 'test_delivery',
        resourceType: 'presentation_governance_alert_subscription',
        resourceId: subId,
        metadata: {
          status: result.status,
          httpStatus: result.httpStatus ?? null,
          syntheticVerdict,
        },
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (error) {
      logger.warn('[Presentations] alert-subscriptions test-delivery audit log failed', error);
    }

    res.json({ success: true, data: result });
  })
);

// ---------------------------------------------------------------------------
// Sprint 13: Subscriber dashboard token issuance (admin-side).
//
// Issues a one-time Bearer token an admin can hand out-of-band to an
// external HMAC subscriber. The subscriber then reads their own delivery
// stats via `GET /api/presentations/governance/subscriber/dashboard`,
// which is registered ABOVE the `router.use(verifyToken)` line because
// it does NOT use the platform JWT. Token storage = sha256-hashed only
// (migration 765); the raw token is returned exactly once and never logged.
// ---------------------------------------------------------------------------
router.post(
  '/governance/alert-subscriptions/:id/dashboard-tokens',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const subId = String(req.params.id || '').trim();
    if (!subId) {
      return res.status(400).json({ success: false, error: 'Subscription id required' });
    }

    const ttlDaysRaw = req.body?.ttlDays;
    const ttlDays =
      typeof ttlDaysRaw === 'number' && Number.isFinite(ttlDaysRaw) ? ttlDaysRaw : undefined;

    const result = await issueSubscriberDashboardToken({
      subscriptionId: subId,
      organizationId: orgId,
      ttlDays,
      issuedBy: userId,
    });

    if (result.status === 'subscription_not_found') {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    if (result.status === 'subscription_inactive') {
      return res.status(409).json({
        success: false,
        error: 'subscription_inactive',
        code: 'SUBSCRIPTION_INACTIVE',
      });
    }
    if (result.status === 'storage_error') {
      if (result.reason === 'schema_missing') {
        return res.status(503).json({
          success: false,
          error: 'subscriber_tokens_table_missing',
          code: 'SCHEMA_NOT_READY',
          hint: 'apply migration 765_presentation_governance_subscriber_tokens.sql',
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to issue dashboard token',
        code: 'STORAGE_ERROR',
      });
    }

    const prefix = result.oneTimeToken ? result.oneTimeToken.slice(0, 8) : '';
    try {
      await auditEventsService.log({
        actorId: userId,
        actorType: 'USER',
        organizationId: orgId,
        action: 'subscriber_dashboard_token_issued',
        resourceType: 'presentation_governance_alert_subscription',
        resourceId: subId,
        // Audit metadata records ONLY the prefix — never the raw token.
        metadata: { prefix, expiresAt: result.expiresAt || null },
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (error) {
      logger.warn('[Presentations] dashboard-token issuance audit log failed', error);
    }

    res.json({
      success: true,
      data: {
        subscriptionId: subId,
        tokenId: result.tokenId,
        oneTimeToken: result.oneTimeToken,
        expiresAt: result.expiresAt,
        prefix,
      },
    });
  })
);

// ---------------------------------------------------------------------------
// Sprint 14: Subscriber dashboard token list (admin-side).
//
// Read-only enumeration of the tokens issued for one subscription. Token
// hashes are NEVER projected — only the 8-char prefix recorded at
// issuance leaves the DB. The route is gated by `presentation_edit`
// like its sibling issuance endpoint above.
// ---------------------------------------------------------------------------
router.get(
  '/governance/alert-subscriptions/:id/dashboard-tokens',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const subId = String(req.params.id || '').trim();
    if (!subId) {
      return res.status(400).json({ success: false, error: 'Subscription id required' });
    }

    const includeRevokedRaw = String(req.query.includeRevoked ?? '').toLowerCase();
    const includeRevoked = includeRevokedRaw === 'true' || includeRevokedRaw === '1';

    let limit: number | undefined;
    if (typeof req.query.limit === 'string' && req.query.limit.length > 0) {
      const parsed = Number(req.query.limit);
      if (Number.isFinite(parsed)) limit = parsed;
    }

    const result = await listSubscriberTokens({
      subscriptionId: subId,
      organizationId: orgId,
      includeRevoked,
      limit,
    });

    if (result.status === 'subscription_not_found') {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    if (result.status === 'storage_error') {
      if (result.reason === 'migration_pending') {
        return res.status(503).json({
          success: false,
          error: 'subscriber_tokens_table_missing',
          code: 'SCHEMA_NOT_READY',
          hint: 'apply migration 765_presentation_governance_subscriber_tokens.sql',
        });
      }
      return res.status(503).json({
        success: false,
        error: 'Failed to list dashboard tokens',
        code: 'STORAGE_ERROR',
      });
    }

    return res.json({
      success: true,
      data: {
        subscriptionId: subId,
        tokens: result.tokens || [],
      },
    });
  })
);

// ---------------------------------------------------------------------------
// Sprint 14: Subscriber dashboard token revocation (admin-side).
//
// Irreversible flip of `revoked_at` + `revoked_reason` for a single
// token row scoped to (subscription, organization). The subscriber
// endpoint already returns 401 with `reason: 'token_revoked'` when
// `revoked_at IS NOT NULL` (Sprint 13), so this is purely the
// write-side counterpart.
//
// Body:
//   { reason: string (≥ 5 / ≤ 500 chars after trim), confirm: true }
//
// Status mapping:
//   invalid_reason   → 400
//   not_found        → 404
//   already_revoked  → 409 (idempotent — body still includes the row)
//   storage_error    → 503
// ---------------------------------------------------------------------------
router.post(
  '/governance/alert-subscriptions/:id/dashboard-tokens/:tokenId/revoke',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const subId = String(req.params.id || '').trim();
    const tokenId = String(req.params.tokenId || '').trim();
    if (!subId || !tokenId) {
      return res.status(400).json({ success: false, error: 'Subscription and token id required' });
    }

    if (req.body?.confirm !== true) {
      return res.status(400).json({
        success: false,
        error: 'confirm_required',
        code: 'CONFIRM_REQUIRED',
      });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';

    const result = await revokeSubscriberToken({
      tokenId,
      subscriptionId: subId,
      organizationId: orgId,
      actorId: userId,
      reason,
    });

    if (result.status === 'invalid_reason') {
      return res.status(400).json({
        success: false,
        error: 'invalid_reason',
        code: 'INVALID_REASON',
        hint: 'reason must be 5..500 chars after trim',
      });
    }
    if (result.status === 'not_found') {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }
    if (result.status === 'already_revoked') {
      return res.status(409).json({
        success: false,
        error: 'already_revoked',
        code: 'ALREADY_REVOKED',
        data: { token: result.token || null },
      });
    }
    if (result.status === 'storage_error') {
      if (result.reason === 'migration_pending') {
        return res.status(503).json({
          success: false,
          error: 'subscriber_tokens_table_missing',
          code: 'SCHEMA_NOT_READY',
          hint: 'apply migration 765_presentation_governance_subscriber_tokens.sql',
        });
      }
      return res.status(503).json({
        success: false,
        error: 'Failed to revoke dashboard token',
        code: 'STORAGE_ERROR',
      });
    }

    const tokenSummary = result.token;
    const auditReason =
      tokenSummary?.revokedReason && tokenSummary.revokedReason.length > 200
        ? tokenSummary.revokedReason.slice(0, 200)
        : tokenSummary?.revokedReason || '';
    try {
      await auditEventsService.log({
        actorId: userId,
        actorType: 'USER',
        organizationId: orgId,
        action: 'subscriber_dashboard_token_revoked',
        resourceType: 'presentation_governance_alert_subscription',
        resourceId: subId,
        // Audit metadata records the prefix + truncated reason; never the
        // raw token (the hash never leaves the DB anyway).
        metadata: {
          tokenId,
          prefix: tokenSummary?.tokenPrefix || '',
          reason: auditReason,
        },
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (error) {
      logger.warn('[Presentations] dashboard-token revocation audit log failed', error);
    }

    return res.json({
      success: true,
      data: { token: tokenSummary || null },
    });
  })
);

// ---------------------------------------------------------------------------
// Sprint 12: Webhook Playground — self-contained HMAC verifier loop.
//
// `playground/dispatch`  Builds a fully signed synthetic payload (headers,
//                        body bytes, canonical signing string, hex
//                        signature) that the SuperAdmin can copy into
//                        their verifier code. The response includes the
//                        `signingSecret` ONCE — both for the operator to
//                        copy into their subscriber app AND so the same
//                        UI can feed it back into `playground/inbox` to
//                        prove the loop closes. The endpoint NEVER reads
//                        from `presentation_governance_alert_subscriptions`
//                        and NEVER writes to
//                        `presentation_governance_alert_dispatches` —
//                        playground is decoupled from the audit trail.
//
// `playground/inbox`     Pure receiver-side verification. Re-builds the
//                        canonical string from headers+body, recomputes
//                        the HMAC, returns a typed `status` so the UI can
//                        render distinct banners for verified / unsigned /
//                        invalid_signature / missing_headers / parse_error
//                        / mismatched_event. The provided `signingSecret`
//                        is used ONLY for verification — never logged,
//                        never persisted, never echoed back in the
//                        response.
// ---------------------------------------------------------------------------
router.post(
  '/governance/alerts/playground/dispatch',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_required' });
    }

    const verdictRaw = String(req.body?.syntheticVerdict || 'BLOCKED_P0');
    const syntheticVerdict: PlaygroundSeverity = ALERT_SEVERITIES.has(verdictRaw)
      ? (verdictRaw as PlaygroundSeverity)
      : 'BLOCKED_P0';
    const syntheticDeckId =
      typeof req.body?.syntheticDeckId === 'string' && req.body.syntheticDeckId.trim().length > 0
        ? String(req.body.syntheticDeckId).trim().slice(0, 128)
        : undefined;
    const signingSecret =
      typeof req.body?.signingSecret === 'string' && req.body.signingSecret.length > 0
        ? String(req.body.signingSecret)
        : null;

    const plan = buildPlaygroundDispatchPlan({
      organizationId: orgId,
      syntheticVerdict,
      syntheticDeckId,
      signingSecret,
    });

    res.json({ success: true, data: plan });
  })
);

router.post(
  '/governance/alerts/playground/inbox',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_required' });
    }

    const bodyJson = typeof req.body?.bodyJson === 'string' ? req.body.bodyJson : '';
    const signature = typeof req.body?.signature === 'string' ? req.body.signature : null;
    const signatureAlgorithm =
      typeof req.body?.signatureAlgorithm === 'string' ? req.body.signatureAlgorithm : null;
    const timestamp = typeof req.body?.timestamp === 'string' ? req.body.timestamp : null;
    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : null;
    const signingSecret = typeof req.body?.signingSecret === 'string' ? req.body.signingSecret : '';

    const result = verifyInboxRequest({
      bodyJson,
      signature,
      signatureAlgorithm,
      timestamp,
      eventId,
      signingSecret,
    });

    // 200 always — the result encodes failure as `status`. The provided
    // `signingSecret` is intentionally NOT logged or echoed back; only
    // the typed verification result leaves the endpoint.
    res.json({ success: true, data: result });
  })
);

router.post(
  '/governance/alerts/test',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const deckId =
      typeof req.body?.deckId === 'string' && req.body.deckId.trim()
        ? String(req.body.deckId).trim()
        : 'test-deck';
    const toVerdictRaw = String(req.body?.toVerdict || 'BLOCKED_P0');
    const toVerdict: AlertSeverity = ALERT_SEVERITIES.has(toVerdictRaw)
      ? (toVerdictRaw as AlertSeverity)
      : 'BLOCKED_P0';

    const summary = await dispatchAlertsForTransition({
      deckId,
      deckTitle: typeof req.body?.deckTitle === 'string' ? req.body.deckTitle : 'Synthetic Test',
      fromVerdict: typeof req.body?.fromVerdict === 'string' ? req.body.fromVerdict : null,
      toVerdict,
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        deckId,
        toVerdict,
        summary,
      },
    });
  })
);

router.get(
  '/governance/alerts/recent',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);
    const limitRaw = Number(req.query.limit);
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : 50, 1),
      200
    );

    const warnings: string[] = [];
    let rows: Array<Record<string, any>> = [];
    try {
      rows = (await dbAll(
        `SELECT id, subscription_id, deck_id, from_verdict, to_verdict,
                channel, target_redacted, status, http_status, error_category,
                created_at, sent_at
           FROM presentation_governance_alert_dispatches
          WHERE organization_id = ?
          ORDER BY created_at DESC
          LIMIT ?`,
        [orgId, limit]
      )) as Array<Record<string, any>>;
    } catch (error) {
      if (isSchemaMissingError(error)) {
        warnings.push('schema_missing_alert_tables');
      } else {
        logger.warn('[Presentations] alerts recent load failed', error);
        warnings.push('list_failed');
      }
    }

    const dispatches = (rows || []).map((row) => ({
      id: String(row.id),
      subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
      deckId: String(row.deck_id),
      fromVerdict: row.from_verdict ? String(row.from_verdict) : null,
      toVerdict: String(row.to_verdict),
      channel: String(row.channel),
      targetRedacted: row.target_redacted ? String(row.target_redacted) : null,
      status: String(row.status),
      httpStatus:
        row.http_status === null || row.http_status === undefined ? null : Number(row.http_status),
      errorCategory: row.error_category ? String(row.error_category) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      sentAt: row.sent_at ? String(row.sent_at) : null,
    }));

    res.json({
      success: true,
      data: {
        dispatches,
        appliedFilters: { limit },
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    });
  })
);

router.get(
  '/decks/:deckId/audit-log',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const deckId = String(req.params.deckId || '');
    const orgId = getOrgId(req);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
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
        operationId: row.resourceType === 'presentation_deck_agent_edit' ? row.resourceId : null,
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

// ---------------------------------------------------------------------------
// Epic K3 closure: audit integrity verification.
//
// `GET /operations/audit-integrity?windowDays=N`
//
// Cross-references applied agent edits + successful exports against the
// audit_events log and confirms each has a matching record within the
// AUDIT_LATENCY_BUDGET_MS budget (5 minutes). Returns the same
// `IntegrityCheckReport` shape as the CLI (`check-audit-integrity.ts`) so
// the SuperAdmin Operations Health surface and the cron job stay in sync.
//
// Schema-tolerance: any missing source table downgrades to an empty array
// + `warnings` entry; only catastrophic failures map to HTTP 503.
// ---------------------------------------------------------------------------
router.get(
  '/operations/audit-integrity',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const orgId = getOrgId(req);

    const rawWindowDays = Number(req.query.windowDays);
    const windowDays = Math.min(
      Math.max(
        Number.isFinite(rawWindowDays) && rawWindowDays > 0 ? Math.round(rawWindowDays) : 7,
        1
      ),
      90
    );

    const result = await buildAuditIntegrityReport({
      organizationId: orgId,
      windowDays,
    });

    if (result.status !== 'ok' || !result.report) {
      return res.status(503).json({
        success: false,
        error: 'audit_integrity_storage_error',
        code: 'STORAGE_ERROR',
        reason: result.reason ?? 'unknown',
      });
    }

    return res.json({ success: true, data: result.report });
  })
);

router.get(
  '/decks/:deckId/agent-history',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const { deckId } = req.params;
    const orgId = getOrgId(req);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
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
          const raw =
            (totalRow as any).c ?? (totalRow as any).count ?? (totalRow as any)['COUNT(*)'];
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
        const skippedLockedSlides = Array.isArray(diffRaw.skippedLockedSlides)
          ? diffRaw.skippedLockedSlides.filter(
              (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
            )
          : [];

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
            skippedLockedSlides,
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

router.post(
  '/decks/:deckId/agent-history/:operationId/revert',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const deckId = String(req.params.deckId || '');
    const operationId = String(req.params.operationId || '');
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'Missing organization context' });
    }
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, error: 'Confirmation required' });
    }

    let operationRow: Record<string, any> | null;
    let deckRow: Record<string, any> | null;
    try {
      operationRow = (await dbGet(
        `SELECT id, deck_id, organization_id, user_id, status, original_deck_json,
                proposed_deck_json, version_before, version_after, created_at
         FROM presentation_ai_operations
         WHERE id = ? AND organization_id = ? AND deck_id = ?`,
        [operationId, orgId, deckId]
      )) as Record<string, any> | null;
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.status(409).json({
          success: false,
          error: 'Revert blocked',
          reason: 'operation_not_found',
          message: 'Agent history is not available in this environment.',
        });
      }
      throw error;
    }

    try {
      deckRow = (await dbGet(
        `SELECT id, organization_id, deck_json, version FROM presentation_decks WHERE id = ? AND organization_id = ?`,
        [deckId, orgId]
      )) as Record<string, any> | null;
    } catch (error) {
      logger.warn('[Presentations] Could not load deck for revert', error);
      return res.status(500).json({ success: false, error: 'Failed to load deck for revert' });
    }

    if (!operationRow) {
      return res.status(409).json({
        success: false,
        error: 'Revert blocked',
        reason: 'operation_not_found' satisfies RevertEligibilityReason,
        message: 'The original proposal could not be found.',
      });
    }
    if (!deckRow) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    let newerCount = 0;
    try {
      const countRow = (await dbGet(
        `SELECT COUNT(*) AS c FROM presentation_ai_operations
         WHERE deck_id = ? AND organization_id = ?
           AND status IN ('applied', 'accepted')
           AND created_at > ?`,
        [deckId, orgId, operationRow.created_at || '1970-01-01T00:00:00.000Z']
      )) as Record<string, any> | null;
      const raw = countRow?.c ?? countRow?.count ?? countRow?.['COUNT(*)'];
      const parsed = Number(raw);
      newerCount = Number.isFinite(parsed) ? parsed : 0;
    } catch (countError) {
      if (!isSchemaMissingError(countError)) {
        logger.warn('[Presentations] Could not count newer applied operations', countError);
      }
    }

    const versionBeforeRaw = operationRow.version_before;
    const versionAfterRaw = operationRow.version_after;
    const eligibility = evaluateRevertEligibility({
      operation: {
        id: String(operationRow.id),
        deckId: String(operationRow.deck_id),
        organizationId: String(operationRow.organization_id),
        status: String(operationRow.status || ''),
        originalDeckJson: operationRow.original_deck_json ?? null,
        versionBefore:
          typeof versionBeforeRaw === 'number' && Number.isFinite(versionBeforeRaw)
            ? versionBeforeRaw
            : null,
        createdAt: operationRow.created_at ?? null,
      },
      deck: { id: String(deckRow.id), organizationId: String(deckRow.organization_id) },
      requestOrgId: orgId,
      newerAppliedOperationsCount: newerCount,
    });

    if (!eligibility.eligible) {
      const reasonMessageMap: Record<RevertEligibilityReason, string> = {
        operation_not_found: 'The original proposal could not be found.',
        operation_not_applied: 'Only applied or accepted proposals can be reverted.',
        operation_org_mismatch: 'This proposal does not belong to your organization.',
        no_snapshot: 'Pre-edit snapshot is missing for this operation.',
        deck_not_found: 'The deck this proposal targeted is no longer available.',
        newer_operation_exists:
          'Newer applied edits exist on this deck. Revert from the most recent operation first.',
      };
      const reason = eligibility.reason ?? 'operation_not_found';
      return res.status(409).json({
        success: false,
        error: 'Revert blocked',
        reason,
        message: reasonMessageMap[reason],
      });
    }

    let snapshotDeckJson: any;
    try {
      snapshotDeckJson = JSON.parse(String(operationRow.original_deck_json));
    } catch {
      return res.status(500).json({ success: false, error: 'Snapshot corrupted' });
    }

    let currentDeckJson: any = {};
    try {
      currentDeckJson = deckRow.deck_json ? JSON.parse(String(deckRow.deck_json)) : {};
    } catch {
      currentDeckJson = {};
    }

    const versionBefore =
      typeof deckRow.version === 'number' && Number.isFinite(deckRow.version) ? deckRow.version : 1;
    const opVersionBefore =
      typeof versionBeforeRaw === 'number' && Number.isFinite(versionBeforeRaw)
        ? versionBeforeRaw
        : 0;
    const opVersionAfter =
      typeof versionAfterRaw === 'number' && Number.isFinite(versionAfterRaw) ? versionAfterRaw : 0;
    const newVersion = Math.max(versionBefore + 1, opVersionBefore + 1, opVersionAfter + 1);

    const diffSummary = buildDeckDiffSummary(currentDeckJson, snapshotDeckJson);

    if (snapshotDeckJson && typeof snapshotDeckJson === 'object') {
      snapshotDeckJson.ai = {
        ...((snapshotDeckJson.ai && typeof snapshotDeckJson.ai === 'object'
          ? (snapshotDeckJson.ai as Record<string, unknown>)
          : {}) || {}),
        lastRevertOfOperationId: operationId,
        reviewState: 'clean',
      };
      snapshotDeckJson.updated_at = new Date().toISOString();
    }

    try {
      await dbRun(
        `UPDATE presentation_decks SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [JSON.stringify(snapshotDeckJson), newVersion, deckId, orgId]
      );
    } catch (error) {
      logger.warn('[Presentations] Could not write reverted deck', error);
      return res.status(500).json({ success: false, error: 'Failed to revert deck' });
    }

    const revertOperationId = uuidv4().replace(/-/g, '');
    try {
      await dbRun(
        `INSERT INTO presentation_ai_operations (id, deck_id, organization_id, user_id, operation_type, status, prompt, reply, actions_json, diff_json, original_deck_json, proposed_deck_json, version_before, version_after, created_at, resolved_at)
         VALUES (?, ?, ?, ?, 'agent_revert', 'applied', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          revertOperationId,
          deckId,
          orgId,
          userId,
          `Revert of ${operationId}`,
          `Reverted deck to snapshot taken before operation ${operationId}.`,
          JSON.stringify(['revert']),
          JSON.stringify(diffSummary),
          JSON.stringify(currentDeckJson),
          JSON.stringify(snapshotDeckJson),
          versionBefore,
          newVersion,
        ]
      );
    } catch (insertError) {
      if (!isSchemaMissingError(insertError)) {
        logger.warn('[Presentations] Could not record revert operation', insertError);
      }
    }

    try {
      await dbRun(
        `UPDATE presentation_ai_operations SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [operationId]
      );
    } catch (touchError) {
      if (!isSchemaMissingError(touchError)) {
        logger.warn('[Presentations] Could not touch reverted operation row', touchError);
      }
    }

    await recordPresentationRuntimeEvent({
      organizationId: orgId,
      deckId,
      userId,
      eventType: 'agent_edit_reverted',
      status: 'reverted',
      scope: 'deck',
      metadata: {
        operationId,
        revertOperationId,
        versionBefore,
        versionAfter: newVersion,
        diffSummary: {
          cardsBefore: diffSummary.cardsBefore,
          cardsAfter: diffSummary.cardsAfter,
          cardsAdded: diffSummary.cardsAdded,
          cardsRemoved: diffSummary.cardsRemoved,
          changedCards: diffSummary.changedCards,
        },
      },
    });

    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'revert',
      resourceType: 'presentation_deck',
      resourceId: deckId,
      before: { version: versionBefore },
      after: { version: newVersion },
      metadata: {
        organizationId: orgId,
        deckId,
        revertedOperationId: operationId,
        revertOperationId,
        scope: 'deck',
        summary: `Reverted to deck state before ${operationId}`,
        cardsBefore: diffSummary.cardsBefore,
        cardsAfter: diffSummary.cardsAfter,
      },
    });

    return res.json({
      success: true,
      data: {
        deckId,
        versionBefore,
        versionAfter: newVersion,
        revertOperationId,
        diffSummary: {
          cardsBefore: diffSummary.cardsBefore,
          cardsAfter: diffSummary.cardsAfter,
          cardsAdded: diffSummary.cardsAdded,
          cardsRemoved: diffSummary.cardsRemoved,
          changedCards: diffSummary.changedCards,
        },
      },
    });
  })
);

router.post(
  '/decks/:deckId/agent-history/bulk-revert',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;
    const deckId = String(req.params.deckId || '');
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'Missing organization context' });
    }
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, error: 'Confirmation required' });
    }

    const requestedIdsRaw = Array.isArray(req.body?.operationIds) ? req.body.operationIds : null;
    if (!requestedIdsRaw || requestedIdsRaw.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'operationIds must be a non-empty array of strings',
      });
    }
    if (requestedIdsRaw.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'operationIds must contain at most 50 ids',
      });
    }
    const requestedIds: string[] = [];
    for (const raw of requestedIdsRaw) {
      if (typeof raw !== 'string' || !raw.trim()) {
        return res.status(400).json({
          success: false,
          error: 'operationIds must be a non-empty array of strings',
        });
      }
      requestedIds.push(raw);
    }

    let deckRow: Record<string, any> | null;
    try {
      deckRow = (await dbGet(
        `SELECT id, organization_id, deck_json, version FROM presentation_decks WHERE id = ? AND organization_id = ?`,
        [deckId, orgId]
      )) as Record<string, any> | null;
    } catch (error) {
      logger.warn('[Presentations] Could not load deck for bulk revert', error);
      return res.status(500).json({ success: false, error: 'Failed to load deck for bulk revert' });
    }
    if (!deckRow) {
      return res.status(404).json({ success: false, error: 'Deck not found' });
    }

    const uniqueIds = Array.from(new Set(requestedIds));
    const placeholders = uniqueIds.map(() => '?').join(', ');
    let operationRows: Record<string, any>[] = [];
    try {
      const fetched = (await dbAll(
        `SELECT id, deck_id, organization_id, user_id, status, original_deck_json,
                proposed_deck_json, version_before, version_after, created_at
         FROM presentation_ai_operations
         WHERE id IN (${placeholders}) AND organization_id = ? AND deck_id = ?`,
        [...uniqueIds, orgId, deckId]
      )) as Record<string, any>[] | null;
      operationRows = Array.isArray(fetched) ? fetched : [];
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return res.status(409).json({
          success: false,
          error: 'Bulk revert blocked',
          reasons: ['schema_missing'],
          message: 'Agent history is not available in this environment.',
        });
      }
      logger.warn('[Presentations] Could not load operations for bulk revert', error);
      return res.status(500).json({ success: false, error: 'Failed to load operations' });
    }

    const planRows: BulkRevertOpRow[] = operationRows.map((row) => ({
      id: String(row.id),
      deckId: String(row.deck_id),
      organizationId: String(row.organization_id),
      status: String(row.status || ''),
      originalDeckJson: row.original_deck_json ?? null,
      versionBefore:
        typeof row.version_before === 'number' && Number.isFinite(row.version_before)
          ? row.version_before
          : null,
      versionAfter:
        typeof row.version_after === 'number' && Number.isFinite(row.version_after)
          ? row.version_after
          : null,
      createdAt: String(row.created_at || ''),
    }));

    const plan = planBulkRevert({
      requestedIds,
      rows: planRows,
      deckId,
      organizationId: orgId,
    });

    if (plan.rejected.length === requestedIds.length || !plan.baseSnapshot) {
      return res.status(422).json({
        success: false,
        error: 'No matching operations',
        rejected: plan.rejected,
      });
    }

    let newerAppliedAfterOldestCount = 0;
    let appliedIdsSinceBase: string[] = [];
    try {
      const baseCreatedAt = plan.baseSnapshot.createdAt || '1970-01-01T00:00:00.000Z';
      const sinceRows = (await dbAll(
        `SELECT id FROM presentation_ai_operations
         WHERE deck_id = ? AND organization_id = ?
           AND status IN ('applied','accepted')
           AND created_at >= ?`,
        [deckId, orgId, baseCreatedAt]
      )) as Record<string, any>[] | null;
      appliedIdsSinceBase = (sinceRows || []).map((r) => String(r.id));
      newerAppliedAfterOldestCount = appliedIdsSinceBase.length;
    } catch (countError) {
      if (!isSchemaMissingError(countError)) {
        logger.warn(
          '[Presentations] Could not count applied operations since base for bulk revert',
          countError
        );
      }
    }

    const orderedIdSet = new Set(plan.ordered.map((o) => o.id));
    const missingIds = appliedIdsSinceBase.filter((id) => !orderedIdSet.has(id));
    if (missingIds.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Bulk revert blocked: non-consecutive selection',
        missingIds,
      });
    }

    const eligibility = evaluateBulkRevertEligibility({
      ordered: plan.ordered,
      newerAppliedAfterOldestCount,
    });

    if (!eligibility.eligible) {
      return res.status(409).json({
        success: false,
        error: 'Bulk revert blocked',
        reasons: eligibility.reasons,
        baseSnapshotId: eligibility.baseSnapshotId,
      });
    }

    const baseSnapshot = plan.baseSnapshot;
    let snapshotDeckJson: any;
    try {
      const raw = baseSnapshot.originalDeckJson;
      snapshotDeckJson =
        typeof raw === 'string' ? JSON.parse(raw) : raw && typeof raw === 'object' ? raw : null;
      if (snapshotDeckJson === null) {
        throw new Error('snapshot_null');
      }
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Snapshot corrupted',
        baseSnapshotId: baseSnapshot.id,
      });
    }

    let currentDeckJson: any = {};
    try {
      currentDeckJson = deckRow.deck_json ? JSON.parse(String(deckRow.deck_json)) : {};
    } catch {
      currentDeckJson = {};
    }

    const versionBefore =
      typeof deckRow.version === 'number' && Number.isFinite(deckRow.version) ? deckRow.version : 1;
    const opVersionBefore =
      typeof baseSnapshot.versionBefore === 'number' && Number.isFinite(baseSnapshot.versionBefore)
        ? baseSnapshot.versionBefore
        : 0;
    const opVersionAfter =
      typeof baseSnapshot.versionAfter === 'number' && Number.isFinite(baseSnapshot.versionAfter)
        ? baseSnapshot.versionAfter
        : 0;
    const newVersion = Math.max(versionBefore + 1, opVersionBefore + 1, opVersionAfter + 1);

    const diffSummary = buildDeckDiffSummary(currentDeckJson, snapshotDeckJson);

    if (snapshotDeckJson && typeof snapshotDeckJson === 'object') {
      snapshotDeckJson.ai = {
        ...((snapshotDeckJson.ai && typeof snapshotDeckJson.ai === 'object'
          ? (snapshotDeckJson.ai as Record<string, unknown>)
          : {}) || {}),
        lastBulkRevertBaseSnapshotId: baseSnapshot.id,
        lastBulkRevertCount: plan.ordered.length,
        reviewState: 'clean',
      };
      snapshotDeckJson.updated_at = new Date().toISOString();
    }

    try {
      await dbRun(
        `UPDATE presentation_decks SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [JSON.stringify(snapshotDeckJson), newVersion, deckId, orgId]
      );
    } catch (error) {
      logger.warn('[Presentations] Could not write bulk-reverted deck', error);
      return res.status(500).json({ success: false, error: 'Failed to bulk-revert deck' });
    }

    const revertedOperationIds = plan.ordered.map((o) => o.id);
    for (const opId of revertedOperationIds) {
      try {
        await dbRun(
          `UPDATE presentation_ai_operations SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [opId]
        );
      } catch (touchError) {
        if (!isSchemaMissingError(touchError)) {
          logger.warn('[Presentations] Could not touch reverted operation row in bulk', touchError);
        }
      }
    }

    const revertOperationId = uuidv4().replace(/-/g, '');
    try {
      await dbRun(
        `INSERT INTO presentation_ai_operations (id, deck_id, organization_id, user_id, operation_type, status, prompt, reply, actions_json, diff_json, original_deck_json, proposed_deck_json, version_before, version_after, created_at, resolved_at)
         VALUES (?, ?, ?, ?, 'agent_bulk_revert', 'applied', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          revertOperationId,
          deckId,
          orgId,
          userId,
          `Bulk revert of ${plan.ordered.length} ops back to ${baseSnapshot.id}`,
          `Bulk-reverted ${plan.ordered.length} proposals to snapshot ${baseSnapshot.id}.`,
          JSON.stringify({
            revertedOperationIds,
            baseSnapshotId: baseSnapshot.id,
          }),
          JSON.stringify(diffSummary),
          JSON.stringify(currentDeckJson),
          JSON.stringify(snapshotDeckJson),
          versionBefore,
          newVersion,
        ]
      );
    } catch (insertError) {
      if (!isSchemaMissingError(insertError)) {
        logger.warn('[Presentations] Could not record bulk revert operation', insertError);
      }
    }

    await recordPresentationRuntimeEvent({
      organizationId: orgId,
      deckId,
      userId,
      eventType: 'agent_edit_bulk_reverted',
      status: 'reverted',
      scope: 'deck',
      metadata: {
        count: plan.ordered.length,
        baseSnapshotId: baseSnapshot.id,
        versionBefore,
        versionAfter: newVersion,
        diffSummary: {
          cardsBefore: diffSummary.cardsBefore,
          cardsAfter: diffSummary.cardsAfter,
          cardsAdded: diffSummary.cardsAdded,
          cardsRemoved: diffSummary.cardsRemoved,
          changedCards: diffSummary.changedCards,
        },
      },
    });

    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'bulk_revert',
      resourceType: 'presentation_deck',
      resourceId: deckId,
      before: { version: versionBefore },
      after: { version: newVersion },
      metadata: {
        organizationId: orgId,
        deckId,
        revertedOperationIds,
        baseSnapshotId: baseSnapshot.id,
        count: plan.ordered.length,
        version_before: versionBefore,
        version_after: newVersion,
        scope: 'deck',
        summary: `Bulk-reverted ${plan.ordered.length} proposals to ${baseSnapshot.id}`,
      },
    });

    return res.json({
      success: true,
      data: {
        deckId,
        baseSnapshotId: baseSnapshot.id,
        count: plan.ordered.length,
        revertOperationId,
        versionBefore,
        versionAfter: newVersion,
        diffSummary: {
          cardsBefore: diffSummary.cardsBefore,
          cardsAfter: diffSummary.cardsAfter,
          cardsAdded: diffSummary.cardsAdded,
          cardsRemoved: diffSummary.cardsRemoved,
          changedCards: diffSummary.changedCards,
        },
      },
    });
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
        return res.json({
          success: true,
          data: [],
          degraded: true,
          reason: 'telemetry_schema_missing',
        });
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

// Media upload was FE-only dead weight: DeckBuilder's MediaLibraryBrowser
// (src/components/Presentations/DeckBuilder/MediaLibraryBrowser.tsx) has been
// POSTing to /api/presentations/media/upload since it shipped, but no route
// ever answered it (404) — uploads silently failed. Mirrors the whiteboard
// image upload pattern (server/src/routes/my-work/whiteboard-uploads.routes.ts):
// memoryStorage multer + the provider-agnostic storage seam
// (services/storage), keyed `presentation-media/<orgId>/<uuid>.<ext>` under the
// existing `uploads/` tree. Row bookkeeping (AI tagging, tag search, usage
// counters) reuses the already-built organizationMediaService.uploadMedia,
// which GET /media above already reads from.
const MAX_PRESENTATION_MEDIA_BYTES = 10 * 1024 * 1024; // 10MB, matches whiteboard upload cap

// Deliberately excludes image/svg+xml — same XSS rationale as the whiteboard
// upload allow-list (SVGs can carry <script>/on* handlers and would be served
// same-origin from /uploads).
const ALLOWED_PRESENTATION_MEDIA_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const presentationMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRESENTATION_MEDIA_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Reject unsupported types by declining the file (cb signature here accepts null only);
    // the handler returns a 4xx with an explicit message when no file survives the filter.
    cb(null, ALLOWED_PRESENTATION_MEDIA_MIME_TYPES.has(file.mimetype));
  },
});

router.post(
  '/media/upload',
  (req, res, next) => {
    presentationMediaUpload.single('file')(req, res, (err: unknown) => {
      if (!err) return next();
      const isLimitError = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
      if (!isLimitError) {
        logger.warn('[Presentations] media upload rejected', { err });
      }
      const message = isLimitError ? 'Image too large (max 10MB)' : 'Upload failed';
      res.status(isLimitError ? 413 : 400).json({ success: false, error: message });
    });
  },
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_edit')) return;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    if (!ALLOWED_PRESENTATION_MEDIA_MIME_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type. Only PNG, JPEG, GIF and WebP are allowed.',
      });
    }
    if (req.file.size > MAX_PRESENTATION_MEDIA_BYTES) {
      return res.status(413).json({ success: false, error: 'Image too large (max 10MB)' });
    }
    if (!req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const safeOrgId = sanitizeOrgIdForUploadPath(String(orgId));
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.png';
    const filename = `${uuidv4()}${ext}`;
    const key = `presentation-media/${safeOrgId}/${filename}`;

    const storage = getStorage();
    await storage.putObject({ key, body: req.file.buffer, contentType: req.file.mimetype });
    const storageUrl = await storage.getUrl(key);

    const item = await uploadOrganizationMedia({
      organizationId: orgId,
      uploadedBy: userId,
      filename,
      originalName: req.file.originalname || filename,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageUrl,
    });

    logger.info(`[Presentations] Media uploaded for org ${orgId}: ${filename}`);
    res.status(201).json({ success: true, item });
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

    // M17: export-approval gate — see server/src/services/v8/exportApprovalGate.ts.
    if (
      !applyExportApprovalGate({
        res,
        organizationId: orgId,
        userId,
        originRuntime: 'presentation',
        originRecordId: String(deckId || ''),
        format: 'png',
        publishState: artifact.publishState,
      })
    ) {
      return;
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
      allowOverride: canOverrideQualityGate(req),
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
      return res.status(quality.status ?? 422).json(quality.payload);
    }

    const deckData: any = normalizeDeckDocument(deck) || {};
    const cards = deckData.cards || deckData.slides || [];
    const pngLimitCheck = enforceExportLimits(deck, cards);
    if (!pngLimitCheck.ok) {
      await recordCanonicalDeckExportTrace({
        organizationId: orgId,
        userId,
        deckId: String(deckId || ''),
        roleKey,
        format: 'png',
        status: 'failed',
        errorCategory: 'limit_exceeded',
      }).catch(() => null);
      return res
        .status(422)
        .json({ success: false, error: pngLimitCheck.error, code: 'EXPORT_LIMIT_EXCEEDED' });
    }

    // Codex review, third round (Blocker A) — same durable pre-flight intent
    // as the PDF route above, for the same reason: `archive.pipe(res)`
    // below streams immediately, so once it starts a later lineage failure
    // can never become a 5xx. If we cannot even persist the intent, refuse
    // to start streaming — zero bytes sent. NOTE: unlike the PDF route,
    // this route has no try/catch around generation today (a pre-existing
    // gap, not introduced here — `recordPresentationExportRecord({status:
    // 'failed'})` is never called for PNG either) — a mid-generation throw
    // (e.g. `sharp`) leaves this pending row uncancelled, same class of gap
    // as the route's pre-existing lack of failure bookkeeping, not a new
    // regression from this change.
    const pngExportIntent = await preflightStreamingExportIntent({
      organizationId: orgId,
      artifactKind: 'presentation',
      sourceRecordId: String(deckId || ''),
      actorUserId: userId,
      detail: { format: 'png' },
    });
    if (!pngExportIntent) {
      return res.status(500).json({
        success: false,
        error: 'Lineage could not be durably recorded before export',
        code: 'LINEAGE_RECOVERY_REQUIRED',
      });
    }

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
    // NOTE (Codex review, third round — Blocker A CLOSED): `archive.pipe(res)`
    // above has ALREADY streamed the zip to the client by the time
    // `archive.finalize()` resolves, so this call itself still cannot
    // fail-closed. What changed: `pngExportIntent` above already persisted
    // a durable pending row BEFORE any byte was sent — threading its
    // key/occurredAt through makes this finalize converge with that
    // pre-flight row instead of being a second, unrelated attempt.
    await recordPresentationExportRecord({
      organizationId: orgId,
      userId,
      deckId: String(deckId || ''),
      format: 'png',
      status: 'completed',
      qualityReport: quality.report,
      filePath: null,
      lineageIdempotencyKey: pngExportIntent.idempotencyKey,
      lineageOccurredAt: pngExportIntent.occurredAt,
    });
  })
);

// Exported for integration coverage of the PNG export primitive
// (Module 12 audit gap #5): tests render a real card SVG and rasterize it
// through `sharp` to confirm valid PNG output before advertising PNG export.
export function renderCardToSvg(
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
    const orgId = getOrgId(req);
    const { deckId } = req.params;
    const { viewerToken, cardIndex, durationMs } = req.body;

    // SEC (M17 wave-5): org-scope the deck lookup so org A cannot write
    // analytics rows against (or probe the existence of) org B's deck by id.
    const deckOwner = await dbGet(
      'SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, orgId]
    );
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

    const tv: any = totalViews || {};
    res.json({
      success: true,
      data: {
        summary: {
          unique_viewers: Number(tv.unique_viewers ?? 0),
          total_views: Number(tv.total_views ?? 0),
        },
        perCard: (perCard || []).map((r: any) => ({
          ...r,
          views: Number(r.views ?? 0),
          avg_duration_ms: Number(r.avg_duration_ms ?? 0),
        })),
        dailyViews: (dailyViews || []).map((r: any) => ({ ...r, viewers: Number(r.viewers ?? 0) })),
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
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return res.status(400).json({
        success: false,
        error: 'expectedVersion is required',
        code: 'EXPECTED_VERSION_REQUIRED',
      });
    }
    if (expectedVersion !== Number(deck.version || 1)) {
      return res.status(409).json({
        success: false,
        error: 'Version conflict: deck was modified before restore.',
        code: 'VERSION_CONFLICT',
        serverVersion: Number(deck.version || 1),
        clientVersion: expectedVersion,
      });
    }

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

    const restored = await dbRun(
      `UPDATE presentation_decks SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? AND version = ?`,
      [versionRow.deck_json_snapshot, newVersion, deckId, orgId, expectedVersion]
    );
    if ((restored?.changes ?? 0) === 0) {
      const latest = (await dbGet(
        'SELECT version FROM presentation_decks WHERE id = ? AND organization_id = ?',
        [deckId, orgId]
      )) as any;
      return res.status(409).json({
        success: false,
        error: 'Version conflict: deck changed during restore.',
        code: 'VERSION_CONFLICT',
        serverVersion: Number(latest?.version || deck.version || 1),
        clientVersion: expectedVersion,
      });
    }

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

    // MAT-010 lineage hook. Past the CAS guard above, so a 409-losing restore
    // never appears in the lineage. Restore is a NEW forward version, never a
    // rewrite of history, and the deck id is unchanged — hence the same
    // `sourceRecordId` as every other event. `...Tracked` +
    // `respondIfLineageLost` (Codex review, second round): retry-safe, same
    // CAS guard (`expectedVersion` check + the UPDATE's own `AND version = ?`)
    // as above.
    const restoreOutcome = await recordLineageEventTracked({
      organizationId: orgId,
      artifactKind: 'presentation',
      // `String(...)` — see the autosave hook: Express types `req.params`
      // values as `string | string[]`.
      sourceRecordId: String(deckId),
      eventType: 'restore',
      actorUserId: userId,
      detail: {
        version: newVersion,
        restoredFromVersion: versionRow.version,
        versionId: String(versionId),
      },
    });
    if (respondIfLineageLost(res, restoreOutcome)) return;

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

// ============================================================
// MONTHLY BENCHMARK HISTORY (Epic H1)
// ============================================================

router.get(
  '/benchmark/history',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_view')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'Missing organization context' });
    }

    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.round(limitRaw)) : 12;
    const referenceSetRaw =
      typeof req.query.referenceSet === 'string' ? req.query.referenceSet.trim() : '';
    const referenceSet = referenceSetRaw.length > 0 ? referenceSetRaw : undefined;

    let history: BenchmarkRunRecord[] = [];
    try {
      history = await listBenchmarkRunHistory(orgId, { limit, referenceSet });
    } catch (error) {
      logger.warn('[presentations.routes] benchmark history fetch failed', {
        orgId,
        error: (error as { message?: unknown })?.message ?? String(error),
      });
      return res.status(503).json({
        success: false,
        error: 'Benchmark history storage unavailable',
        code: 'STORAGE_UNAVAILABLE',
      });
    }

    return res.json({
      success: true,
      data: history,
      meta: { limit, referenceSet: referenceSet ?? null, count: history.length },
    });
  })
);

/**
 * M09-H02 — narrow test surface. `settleTemplateWrite` encodes the
 * "durable read-back is the authority, not the driver ack" rule; the
 * post-commit-timeout branch cannot be reached through HTTP without racing a
 * real timeout, so it is asserted directly. Not imported by production code.
 */
export const __testables = { settleTemplateWrite, readBackOrgTemplate };

export default router;
