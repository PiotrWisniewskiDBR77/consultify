/**
 * Consultify Document Studio — Routes.
 *
 * Mode 1 / Mode 3 generation:
 *   POST /api/document-studio/plan
 *     Body: { intake, useLlm? }
 *     Returns: { outline, llmRefined? }
 *
 *   POST /api/document-studio/generate
 *     Body: { intake, outline?, sourceRefs?, projectId?, useLlm?, templateId? }
 *     Returns: { artifactId, schema }
 *
 *   GET /api/document-studio/:artifactId
 *     Returns: { schema }
 *
 *   GET /api/document-studio/:artifactId/export/:format
 *     Query: qaOverride=true to bypass the QA soft-block (audited; requires
 *            a privileged role per `canOverrideQa`).
 *     Returns: export payload (markdown / docx / pdf).
 *     Errors: 403 qa_blocking when an approval-gated document type has any
 *             blocking QA category and qaOverride was not set.
 *             403 qa_override_unauthorized when qaOverride was set but the
 *             actor's role is not authorized.
 *
 *   GET /api/document-studio/policy
 *     Returns: { policy: { canOverrideQa: boolean, role: string|null } }
 *
 * Mode 2 — Document Template Architect (MVP-2):
 *   GET  /api/document-studio/templates
 *     Query: status?, documentType?
 *     Returns: { templates: DocumentTemplate[] }
 *
 *   POST /api/document-studio/templates/plan
 *     Body: { input: TemplateDraftInput }
 *     Returns: { template: DocumentTemplate }
 *
 *   GET  /api/document-studio/templates/:templateId
 *     Returns: { template }
 *
 *   POST /api/document-studio/templates/:templateId/approve
 *     Body: { notes? }
 *     Returns: { template }
 *
 *   POST /api/document-studio/templates/:templateId/deprecate
 *     Body: { reason? }
 *     Returns: { template }
 *
 *   GET  /api/document-studio/templates/:templateId/audit
 *     Returns: { auditEntries }
 *
 * QA Engine — MVP-3 hardening:
 *   GET  /api/document-studio/:artifactId/qa
 *     Returns: { report: DocumentQaReport } (10/10 QA categories)
 *
 * Source Pack registry — Epic E4:
 *   POST   /api/document-studio/source-packs                       — draft a pack
 *   GET    /api/document-studio/source-packs                       — list packs (status?, language?, includeArchived?)
 *   GET    /api/document-studio/source-packs/:packId               — get pack
 *   GET    /api/document-studio/source-packs/:packId/audit         — list audit
 *   POST   /api/document-studio/source-packs/:packId/items         — ingest via { connector, input }
 *                                                                    connectors: text | url | file | v8_artifact | integration
 *   DELETE /api/document-studio/source-packs/:packId/items/:itemId — remove an item
 *   POST   /api/document-studio/source-packs/:packId/ready         — mark ready
 *   POST   /api/document-studio/source-packs/:packId/archive       — irreversible archive
 *   POST   /api/document-studio/source-packs/:packId/attach        — attach to document, returns { pack, sourceRefs }
 *
 * Chat-first creation entry — Epic E4 Slice 4.4:
 *   POST   /api/document-studio/chat/create-from-sources           — Teresa-driven flow: drafts a pack, ingests every
 *                                                                    supplied connector input, marks ready, and generates
 *                                                                    the document artifact in one transactional call.
 *                                                                    Body: { intake, sources[], packName?, templateId?, ... }
 *                                                                    Returns: { artifactId, schema, packId, itemCount }
 *
 * Document Lifecycle — Epic E5:
 *   GET    /api/document-studio/:artifactId/lifecycle                              — current status + history
 *   POST   /api/document-studio/:artifactId/status                                 — body: { to, reason? }; transitions per matrix
 *                                                                                     409 invalid_transition / 400 unknown_status / 404 unknown_artifact
 *   GET    /api/document-studio/:artifactId/snapshots                              — list snapshots (versionNumber asc)
 *   POST   /api/document-studio/:artifactId/snapshots                              — body: { label?, reason? }; capture current schema
 *                                                                                     201 with { snapshot }; 404 document_not_found
 *   GET    /api/document-studio/:artifactId/snapshots/:versionId                   — get a specific snapshot
 *   POST   /api/document-studio/:artifactId/snapshots/:versionId/rollback          — body: { reason? }; restore snapshot, capture
 *                                                                                     rollback_revert, force lifecycle to draft.
 *                                                                                     Returns { schema, revertSnapshot, restoredFrom, lifecycle }
 *
 * Comments + review mode — Epic E6:
 *   GET    /api/document-studio/:artifactId/comments                               — flat list (status?, sectionId?, blockId?, hideDeleted?)
 *   POST   /api/document-studio/:artifactId/comments                               — body: { body, anchor: { kind, sectionId?, blockId? } }
 *                                                                                     201 with { comment }
 *   GET    /api/document-studio/:artifactId/comments/threads                       — grouped view (status?, sectionId?, blockId?)
 *   GET    /api/document-studio/:artifactId/comments/counts                        — totals + per-section / per-block buckets
 *   GET    /api/document-studio/:artifactId/comments/:commentId                    — single comment
 *   POST   /api/document-studio/:artifactId/comments/:commentId/reply              — body: { body }
 *   POST   /api/document-studio/:artifactId/comments/:commentId/resolve            — body: { reason? }; thread-wide
 *   POST   /api/document-studio/:artifactId/comments/:commentId/reopen             — body: { reason? }; thread-wide
 *   DELETE /api/document-studio/:artifactId/comments/:commentId                    — author-only soft-delete
 *
 * Per-tenant Brand Voice profile — Epic E7:
 *   GET    /api/document-studio/brand-voice/active                                — currently active profile or 204 No Content
 *   GET    /api/document-studio/brand-voice/profiles                              — list profiles (status?, includeArchived?)
 *   POST   /api/document-studio/brand-voice/profiles                              — draft a new profile
 *   GET    /api/document-studio/brand-voice/profiles/:profileId                   — single profile
 *   PATCH  /api/document-studio/brand-voice/profiles/:profileId                   — partial update (draft + active only)
 *   POST   /api/document-studio/brand-voice/profiles/:profileId/activate          — promote to active; auto-archives previous active
 *   POST   /api/document-studio/brand-voice/profiles/:profileId/archive           — body: { reason? }; irreversible
 *   GET    /api/document-studio/brand-voice/profiles/:profileId/audit             — list audit entries
 *
 * Audience-driven warianty — Epic E9:
 *   GET    /api/document-studio/audience-profiles                                 — list profiles (status?, includeArchived?, includeSystem?)
 *   POST   /api/document-studio/audience-profiles                                 — draft a new profile (forbidden under 'system' org)
 *   GET    /api/document-studio/audience-profiles/:profileId                      — single profile (tenant + system seeds visible)
 *   PATCH  /api/document-studio/audience-profiles/:profileId                      — partial update (draft + active only; system seeds immutable)
 *   POST   /api/document-studio/audience-profiles/:profileId/activate             — promote to active (multiple actives allowed; system seeds rejected)
 *   POST   /api/document-studio/audience-profiles/:profileId/archive              — body: { reason? }; irreversible (system seeds rejected)
 *   GET    /api/document-studio/audience-profiles/:profileId/audit                — list audit entries
 *   GET    /api/document-studio/:artifactId/variants                              — list candidate variants (active profiles + system seeds) with projection plans
 *   GET    /api/document-studio/:artifactId/variants/:profileId                   — projected DocumentSchema + provenance for a single profile
 *
 * Auth: reuses verifyToken + tenant guards used across artifact routes.
 */

import { type Request, type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  activateAudienceProfile,
  archiveAudienceProfile,
  AudienceProfileError,
  type AudienceProfileErrorCode,
  draftAudienceProfile,
  ensureAudienceProfileRegistryHydrated,
  getAudienceProfile,
  listActiveAudienceProfiles,
  listAudienceProfileAuditEntries,
  listAudienceProfiles,
  updateAudienceProfile,
} from '../services/documentStudio/documentAudienceProfileService.js';
import {
  describeAudienceProjectionPlan,
  projectDocumentForAudience,
} from '../services/documentStudio/documentAudienceProjector.js';
import {
  activateBrandVoiceProfile,
  archiveBrandVoiceProfile,
  BrandVoiceProfileError,
  type BrandVoiceProfileErrorCode,
  draftBrandVoiceProfile,
  ensureBrandVoiceRegistryHydrated,
  getActiveBrandVoiceProfile,
  getBrandVoiceProfile,
  listBrandVoiceProfileAuditEntries,
  listBrandVoiceProfiles,
  updateBrandVoiceProfile,
} from '../services/documentStudio/documentBrandVoiceService.js';
import {
  ingestFileSource,
  ingestIntegrationSource,
  ingestRawTextSource,
  ingestUrlSource,
  ingestV8ArtifactSource,
  SourcePackConnectorError,
} from '../services/documentStudio/documentSourcePackConnectors.js';
import {
  addSourcePackItem,
  archiveSourcePack,
  attachSourcePackToDocument,
  draftSourcePack,
  ensureSourcePackRegistryHydrated,
  getSourcePack,
  listSourcePackAuditEntries,
  listSourcePacks,
  markSourcePackReady,
  removeSourcePackItem,
} from '../services/documentStudio/documentSourcePackService.js';
import {
  approveEditProposal,
  canOverrideQa,
  type CreateChatSourcePackConnectorInput,
  createDocumentComment,
  createDocumentFromChatSourcePack,
  createDocumentSnapshot,
  createGlobalEditProposal,
  createLocalEditProposal,
  createSectionEditProposal,
  deleteDocumentComment,
  DocumentCommentError,
  DocumentLifecycleTransitionError,
  DocumentRollbackError,
  ensureDocumentCommentsHydrated,
  ensureDocumentLifecycleHydrated,
  ensureDocumentVersionSnapshotsHydrated,
  exportDocumentArtifact,
  getDocumentArtifact,
  getDocumentComment,
  getDocumentCommentSectionCounts,
  getDocumentLifecycleState,
  getDocumentVersionSnapshot,
  listDocumentAuditEntries,
  listDocumentComments,
  listDocumentCommentThreads,
  listDocumentVersionSnapshots,
  materializeDocumentArtifact,
  MissingRequiredSourceError,
  planDocument,
  planDocumentAsync,
  QaBlockingError,
  QaOverrideUnauthorizedError,
  rejectEditProposal,
  reopenDocumentComment,
  replyToDocumentComment,
  resolveDocumentComment,
  rollbackDocumentToVersion,
  runQaForDocument,
  transitionDocumentStatus,
} from '../services/documentStudio/documentStudioService.js';
import type {
  AudienceProfileAppendixPolicy,
  AudienceProfileExecutiveSummaryPolicy,
  AudienceProfileJargonPolicy,
  AudienceProfileStatus,
  AudienceProfileTagFilter,
  BrandVoiceGlossaryEntry,
  BrandVoiceProfileLanguageScope,
  BrandVoiceProfileStatus,
  CommunicationRegister,
  DocumentCommentAnchor,
  DocumentCommentStatus,
  DocumentDensity,
  DocumentEditorProposalInput,
  DocumentIntake,
  DocumentLanguageStyle,
  DocumentOutline,
  DocumentSourceRef,
  DocumentStatus,
  SourcePackStatus,
  TemplateDraftInput,
} from '../services/documentStudio/documentStudioTypes.js';
import {
  approveTemplate,
  deprecateTemplate,
  draftTemplate,
  draftTemplateAsync,
  ensureTemplateRegistryHydrated,
  getTemplate,
  listTemplateAuditEntries,
  listTemplates,
} from '../services/documentStudio/documentTemplateService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);

function getAuthContext(req: AuthRequest): {
  userId: string;
  organizationId: string;
  userRole: string;
} {
  const userId = String((req as any)?.user?.id || (req as any)?.userId || '');
  const organizationId = String(
    (req as any)?.user?.organizationId || (req as any)?.organizationId || ''
  );
  const userRole = String((req as any)?.userRole || (req as any)?.user?.role || '');
  return { userId, organizationId, userRole };
}

router.post(
  '/plan',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuthContext(req as AuthRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const intake = (req.body?.intake ?? null) as DocumentIntake | null;
    if (!intake || typeof intake !== 'object') {
      res.status(400).json({ error: 'intake is required' });
      return;
    }
    const useLlm = req.body?.useLlm === true;
    try {
      const result = useLlm
        ? await planDocumentAsync({ intake, useLlm: true })
        : planDocument({ intake });
      res.json({ outline: result.outline, llmRefined: useLlm });
    } catch (err) {
      logger.warn('[DocumentStudio] plan failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(400).json({
        error: 'plan_failed',
        message: err instanceof Error ? err.message : 'Failed to plan document outline',
      });
    }
  })
);

router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const intake = (req.body?.intake ?? null) as DocumentIntake | null;
    if (!intake || typeof intake !== 'object') {
      res.status(400).json({ error: 'intake is required' });
      return;
    }
    const outline = (req.body?.outline ?? undefined) as DocumentOutline | undefined;
    const sourceRefs = Array.isArray(req.body?.sourceRefs)
      ? (req.body.sourceRefs as DocumentSourceRef[])
      : [];
    const projectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.length > 0
        ? (req.body.projectId as string)
        : null;
    const useLlm = req.body?.useLlm === true;
    const templateId =
      typeof req.body?.templateId === 'string' && req.body.templateId.trim().length > 0
        ? (req.body.templateId as string)
        : null;

    try {
      const result = await materializeDocumentArtifact({
        organizationId,
        userId,
        intake,
        outline,
        sourceRefs,
        projectId,
        useLlm,
        templateId,
      });
      res.json({ artifactId: result.artifactId, schema: result.schema });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate document artifact';
      logger.error('[DocumentStudio] generate failed', { message });
      if (err instanceof MissingRequiredSourceError) {
        res.status(400).json({
          error: 'missing_required_source',
          message,
          missing: err.missing,
        });
        return;
      }
      const status = message === 'template_not_usable' ? 400 : 500;
      res.status(status).json({
        error: status === 400 ? 'template_not_usable' : 'generate_failed',
        message,
      });
    }
  })
);

// =============================================================================
// MVP-2 — Document Template Architect routes.
// MUST be registered BEFORE the `/:artifactId` GET handler to avoid having
// `/templates` swallowed by the generic artifact-id matcher.
// =============================================================================

router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const documentType =
      typeof req.query.documentType === 'string' ? req.query.documentType : undefined;
    await ensureTemplateRegistryHydrated(organizationId);
    const templates = listTemplates(organizationId, {
      status:
        status === 'draft' || status === 'approved' || status === 'deprecated' ? status : undefined,
      documentType: (documentType as TemplateDraftInput['documentType']) ?? undefined,
    });
    res.json({ templates });
  })
);

router.post(
  '/templates/plan',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const input = (req.body?.input ?? null) as TemplateDraftInput | null;
    if (!input || typeof input !== 'object' || typeof input.purpose !== 'string') {
      res.status(400).json({ error: 'template input is required' });
      return;
    }
    const useLlm = req.body?.useLlm === true;
    try {
      if (useLlm) {
        const result = await draftTemplateAsync({
          organizationId,
          userId,
          input,
          useLlm: true,
        });
        res.json({ template: result.template, llmRefined: result.llmRefined });
        return;
      }
      const result = draftTemplate({ organizationId, userId, input });
      res.json({ template: result.template, llmRefined: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_plan_failed';
      logger.warn('[DocumentStudio] template plan failed', { message });
      res.status(400).json({ error: 'template_plan_failed', message });
    }
  })
);

router.get(
  '/templates/:templateId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    await ensureTemplateRegistryHydrated(organizationId);
    const template = getTemplate(templateId, organizationId);
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    res.json({ template });
  })
);

router.post(
  '/templates/:templateId/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    try {
      const template = approveTemplate({ templateId, organizationId, userId, notes });
      res.json({ template });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_approve_failed';
      const status =
        message === 'template_not_found' ? 404 : message === 'template_deprecated' ? 409 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/templates/:templateId/deprecate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const template = deprecateTemplate({ templateId, organizationId, userId, reason });
      res.json({ template });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_deprecate_failed';
      const status = message === 'template_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.get(
  '/templates/:templateId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    await ensureTemplateRegistryHydrated(organizationId);
    const template = getTemplate(templateId, organizationId);
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    const auditEntries = listTemplateAuditEntries(templateId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E4 — Source Pack registry routes.
// MUST be registered BEFORE the `/:artifactId` GET handler so the static
// `/source-packs/...` prefix wins over the generic artifact-id matcher.
// All routes are tenant-scoped via the JWT-derived organizationId.
//
// Connector ingestion is dispatched via { connector, input } in the
// POST /:packId/items body so the route stays connector-agnostic and
// every connector adapter keeps the same SourcePackConnectorError
// vocabulary (mapped to HTTP statuses below).
// =============================================================================

interface SourcePackConnectorPayload {
  connector?: string;
  input?: Record<string, unknown>;
}

function mapConnectorErrorToStatus(code: SourcePackConnectorError['code']): number {
  switch (code) {
    case 'invalid_input':
    case 'unsupported_scheme':
    case 'integration_not_configured':
      return 400;
    case 'artifact_not_found':
      return 404;
    case 'fetch_failed':
    case 'fetch_timeout':
    case 'fetch_too_large':
    case 'extraction_failed':
      return 422;
    default:
      return 500;
  }
}

function mapServiceErrorToStatus(message: string): number {
  if (message === 'source_pack_not_found' || message === 'source_pack_item_not_found') return 404;
  if (
    message === 'source_pack_archived' ||
    message === 'source_pack_empty' ||
    message === 'source_pack_not_ready' ||
    message.startsWith('unsupported source pack item type')
  ) {
    return 400;
  }
  return 500;
}

/** Epic E5 — map DocumentLifecycleTransitionError codes to HTTP. */
function mapLifecycleErrorToStatus(code: DocumentLifecycleTransitionError['code']): number {
  switch (code) {
    case 'unknown_status':
      return 400;
    case 'invalid_transition':
      return 409;
    case 'unknown_artifact':
      return 404;
    default:
      return 500;
  }
}

/** Epic E5 — map DocumentRollbackError codes to HTTP. */
function mapRollbackErrorToStatus(code: DocumentRollbackError['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'snapshot_not_found':
    case 'document_not_found':
      return 404;
    case 'tenant_mismatch':
      return 403;
    default:
      return 500;
  }
}

/** Epic E6 — map DocumentCommentError codes to HTTP. */
function mapCommentErrorToStatus(code: DocumentCommentError['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'unknown_comment':
    case 'unknown_thread':
      return 404;
    case 'comment_already_resolved':
    case 'comment_not_resolved':
    case 'reply_to_reply_forbidden':
    case 'comment_deleted':
      return 409;
    case 'forbidden':
      return 403;
    default:
      return 500;
  }
}

function parseCommentAnchorFromBody(body: unknown): DocumentCommentAnchor | null {
  if (!body || typeof body !== 'object') return null;
  const a = (body as { anchor?: unknown }).anchor;
  if (!a || typeof a !== 'object') return null;
  const obj = a as { kind?: unknown; sectionId?: unknown; blockId?: unknown };
  if (obj.kind === 'document') return { kind: 'document' };
  if (obj.kind === 'section' && typeof obj.sectionId === 'string') {
    return { kind: 'section', sectionId: obj.sectionId };
  }
  if (
    obj.kind === 'block' &&
    typeof obj.sectionId === 'string' &&
    typeof obj.blockId === 'string'
  ) {
    return { kind: 'block', sectionId: obj.sectionId, blockId: obj.blockId };
  }
  return null;
}

router.post(
  '/source-packs',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const language =
      req.body?.language === 'pl' || req.body?.language === 'en' ? req.body.language : 'pl';
    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    if (!name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const pack = draftSourcePack({
        organizationId,
        userId,
        name,
        language,
        description,
        notes,
      });
      res.status(201).json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_draft_failed';
      logger.warn('[DocumentStudio] source pack draft failed', { message });
      res.status(400).json({ error: 'source_pack_draft_failed', message });
    }
  })
);

router.get(
  '/source-packs',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureSourcePackRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const allowedStatus: SourcePackStatus[] = ['draft', 'ready', 'archived'];
    const status =
      statusRaw && allowedStatus.includes(statusRaw as SourcePackStatus)
        ? (statusRaw as SourcePackStatus)
        : undefined;
    const language =
      req.query.language === 'pl' || req.query.language === 'en'
        ? (req.query.language as 'pl' | 'en')
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const packs = listSourcePacks(organizationId, { status, language, includeArchived });
    res.json({ packs });
  })
);

router.get(
  '/source-packs/:packId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    await ensureSourcePackRegistryHydrated(organizationId);
    const pack = getSourcePack(packId, organizationId);
    if (!pack) {
      res.status(404).json({ error: 'source_pack_not_found' });
      return;
    }
    res.json({ pack });
  })
);

router.get(
  '/source-packs/:packId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    await ensureSourcePackRegistryHydrated(organizationId);
    const pack = getSourcePack(packId, organizationId);
    if (!pack) {
      res.status(404).json({ error: 'source_pack_not_found' });
      return;
    }
    const auditEntries = listSourcePackAuditEntries(packId, organizationId);
    res.json({ auditEntries });
  })
);

router.post(
  '/source-packs/:packId/items',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    const payload = (req.body ?? {}) as SourcePackConnectorPayload;
    const connector = typeof payload.connector === 'string' ? payload.connector : '';
    const input = (payload.input ?? {}) as Record<string, unknown>;
    if (!connector) {
      res.status(400).json({ error: 'connector is required' });
      return;
    }
    try {
      let draft;
      switch (connector) {
        case 'text':
          draft = ingestRawTextSource({
            title: String(input.title ?? ''),
            body: String(input.body ?? ''),
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            sourceTitle: typeof input.sourceTitle === 'string' ? input.sourceTitle : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'url':
          draft = await ingestUrlSource({
            url: String(input.url ?? ''),
            title: typeof input.title === 'string' ? input.title : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
            timeoutMs: typeof input.timeoutMs === 'number' ? input.timeoutMs : undefined,
          });
          break;
        case 'file':
          draft = ingestFileSource({
            filename: String(input.filename ?? ''),
            mimeType: String(input.mimeType ?? 'text/plain'),
            body: String(input.body ?? ''),
            title: typeof input.title === 'string' ? input.title : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'v8_artifact':
          draft = await ingestV8ArtifactSource({
            artifactId: String(input.artifactId ?? ''),
            organizationId,
            title: typeof input.title === 'string' ? input.title : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'integration':
          draft = ingestIntegrationSource({
            integration: input.integration as 'notion' | 'drive' | 'sharepoint' | 'confluence',
            externalId: String(input.externalId ?? ''),
            title: String(input.title ?? ''),
            preview: typeof input.preview === 'string' ? input.preview : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        default:
          res.status(400).json({ error: 'unknown_connector', connector });
          return;
      }
      const pack = addSourcePackItem({
        organizationId,
        userId,
        packId,
        item: draft,
      });
      res.status(201).json({ pack });
    } catch (err) {
      if (err instanceof SourcePackConnectorError) {
        const status = mapConnectorErrorToStatus(err.code);
        res.status(status).json({
          error: err.code,
          message: err.message,
          details: err.details,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'source_pack_item_failed';
      const status = mapServiceErrorToStatus(message);
      logger.warn('[DocumentStudio] source pack item add failed', { message });
      res.status(status).json({ error: message, message });
    }
  })
);

router.delete(
  '/source-packs/:packId/items/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const itemId = String(req.params.itemId || '');
    if (!packId || !itemId) {
      res.status(400).json({ error: 'packId and itemId are required' });
      return;
    }
    try {
      const pack = removeSourcePackItem({ organizationId, userId, packId, itemId });
      res.json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_item_remove_failed';
      const status = mapServiceErrorToStatus(message);
      res.status(status).json({ error: message, message });
    }
  })
);

router.post(
  '/source-packs/:packId/ready',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    try {
      const pack = markSourcePackReady({ organizationId, userId, packId, notes });
      res.json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_ready_failed';
      const status = mapServiceErrorToStatus(message);
      res.status(status).json({ error: message, message });
    }
  })
);

router.post(
  '/source-packs/:packId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    try {
      const pack = archiveSourcePack({ organizationId, userId, packId, reason });
      res.json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_archive_failed';
      const status = mapServiceErrorToStatus(message);
      res.status(status).json({ error: message, message });
    }
  })
);

router.post(
  '/chat/create-from-sources',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const intake = (req.body?.intake ?? null) as DocumentIntake | null;
    if (!intake || typeof intake !== 'object') {
      res.status(400).json({ error: 'intake is required' });
      return;
    }
    const sources = req.body?.sources;
    if (!Array.isArray(sources) || sources.length === 0) {
      res.status(400).json({ error: 'sources array is required (at least one item)' });
      return;
    }
    const packName = typeof req.body?.packName === 'string' ? req.body.packName : undefined;
    const packDescription =
      typeof req.body?.packDescription === 'string' ? req.body.packDescription : undefined;
    const packLanguage =
      req.body?.packLanguage === 'pl' || req.body?.packLanguage === 'en'
        ? (req.body.packLanguage as 'pl' | 'en')
        : undefined;
    const templateId =
      typeof req.body?.templateId === 'string' && req.body.templateId.trim().length > 0
        ? (req.body.templateId as string)
        : null;
    const projectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.length > 0
        ? (req.body.projectId as string)
        : null;
    const useLlm = req.body?.useLlm === true;
    const outline = (req.body?.outline ?? undefined) as DocumentOutline | undefined;

    try {
      const result = await createDocumentFromChatSourcePack({
        organizationId,
        userId,
        intake,
        sources: sources as CreateChatSourcePackConnectorInput[],
        packName,
        packDescription,
        packLanguage,
        templateId,
        projectId,
        useLlm,
        outline,
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof SourcePackConnectorError) {
        const status = mapConnectorErrorToStatus(err.code);
        res.status(status).json({
          error: err.code,
          message: err.message,
          details: err.details,
        });
        return;
      }
      if (err instanceof MissingRequiredSourceError) {
        res.status(400).json({
          error: 'missing_required_source',
          message: err.message,
          missing: err.missing,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'chat_create_from_sources_failed';
      const status = mapServiceErrorToStatus(message);
      logger.warn('[DocumentStudio] chat-first creation failed', { message });
      res.status(status).json({ error: message, message });
    }
  })
);

router.post(
  '/source-packs/:packId/attach',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const artifactId = typeof req.body?.artifactId === 'string' ? req.body.artifactId : '';
    if (!packId || !artifactId) {
      res.status(400).json({ error: 'packId and artifactId are required' });
      return;
    }
    try {
      const result = attachSourcePackToDocument({
        organizationId,
        userId,
        packId,
        artifactId,
      });
      res.json({ pack: result.pack, sourceRefs: result.sourceRefs });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_attach_failed';
      const status = mapServiceErrorToStatus(message);
      res.status(status).json({ error: message, message });
    }
  })
);

// =============================================================================
// Epic E7 — Per-tenant Brand Voice profile.
//
// All routes are scoped under `/brand-voice/...` so the static prefix wins
// over the generic `/:artifactId` matcher (registered later in this file).
// Lifecycle: draft → active → archived; at most one active row per tenant.
// =============================================================================

const VALID_BRAND_VOICE_STATUSES: ReadonlyArray<BrandVoiceProfileStatus> = [
  'draft',
  'active',
  'archived',
];

const VALID_BRAND_VOICE_LANGUAGE_SCOPES: ReadonlyArray<BrandVoiceProfileLanguageScope> = [
  'pl',
  'en',
  'all',
];

const VALID_REGISTERS: ReadonlyArray<CommunicationRegister> = [
  'executive',
  'professional',
  'narrative',
];

function mapBrandVoiceErrorToStatus(code: BrandVoiceProfileErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'profile_not_found':
      return 404;
    case 'profile_archived':
    case 'profile_already_active':
    case 'profile_already_archived':
      return 409;
    case 'forbidden':
      return 403;
    default:
      return 400;
  }
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

function parseGlossaryEntries(raw: unknown): BrandVoiceGlossaryEntry[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: BrandVoiceGlossaryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<BrandVoiceGlossaryEntry>;
    if (typeof candidate.avoid !== 'string' || typeof candidate.prefer !== 'string') continue;
    out.push({
      avoid: candidate.avoid,
      prefer: candidate.prefer,
      note: typeof candidate.note === 'string' ? candidate.note : undefined,
    });
  }
  return out;
}

function parseLanguageScope(raw: unknown): BrandVoiceProfileLanguageScope | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_BRAND_VOICE_LANGUAGE_SCOPES.includes(raw as BrandVoiceProfileLanguageScope)
    ? (raw as BrandVoiceProfileLanguageScope)
    : undefined;
}

function parseRegisterOverride(raw: unknown): CommunicationRegister | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_REGISTERS.includes(raw as CommunicationRegister)
    ? (raw as CommunicationRegister)
    : undefined;
}

router.get(
  '/brand-voice/active',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const profile = getActiveBrandVoiceProfile(organizationId);
    if (!profile) {
      res.status(204).end();
      return;
    }
    res.json({ profile });
  })
);

router.get(
  '/brand-voice/profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_BRAND_VOICE_STATUSES.includes(statusRaw as BrandVoiceProfileStatus)
        ? (statusRaw as BrandVoiceProfileStatus)
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const profiles = listBrandVoiceProfiles(organizationId, { status, includeArchived });
    res.json({ profiles });
  })
);

router.post(
  '/brand-voice/profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = draftBrandVoiceProfile({
        organizationId,
        userId,
        input: {
          name: typeof body.name === 'string' ? body.name : '',
          description: typeof body.description === 'string' ? body.description : undefined,
          languageScope: parseLanguageScope(body.languageScope),
          bannedPhrases: parseStringArray(body.bannedPhrases),
          disabledGlobalBannedPhrases: parseStringArray(body.disabledGlobalBannedPhrases),
          preferredPhrases: parseStringArray(body.preferredPhrases),
          glossaryEntries: parseGlossaryEntries(body.glossaryEntries),
          requiredKeywords: parseStringArray(body.requiredKeywords),
          registerOverride:
            parseRegisterOverride(body.registerOverride) === null
              ? undefined
              : (parseRegisterOverride(body.registerOverride) as CommunicationRegister | undefined),
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.status(201).json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/brand-voice/profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const profile = getBrandVoiceProfile(profileId, organizationId);
    if (!profile) {
      res.status(404).json({ error: 'profile_not_found' });
      return;
    }
    res.json({ profile });
  })
);

router.patch(
  '/brand-voice/profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = updateBrandVoiceProfile({
        organizationId,
        userId,
        profileId,
        input: {
          name: typeof body.name === 'string' ? body.name : undefined,
          description: typeof body.description === 'string' ? body.description : undefined,
          languageScope: parseLanguageScope(body.languageScope),
          bannedPhrases: parseStringArray(body.bannedPhrases),
          disabledGlobalBannedPhrases: parseStringArray(body.disabledGlobalBannedPhrases),
          preferredPhrases: parseStringArray(body.preferredPhrases),
          glossaryEntries: parseGlossaryEntries(body.glossaryEntries),
          requiredKeywords: parseStringArray(body.requiredKeywords),
          registerOverride: parseRegisterOverride(body.registerOverride),
          notes:
            body.notes === null ? null : typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/brand-voice/profiles/:profileId/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    try {
      const profile = activateBrandVoiceProfile({ organizationId, userId, profileId });
      res.json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/brand-voice/profiles/:profileId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const profile = archiveBrandVoiceProfile({ organizationId, userId, profileId, reason });
      res.json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/brand-voice/profiles/:profileId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const auditEntries = listBrandVoiceProfileAuditEntries(profileId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E9 — Audience-driven warianty.
//
// AudienceProfile CRUD + lifecycle routes follow the brand-voice contract.
// Variant projection routes (/:artifactId/variants/...) are registered in
// the Epic E5/E6 block below alongside other /:artifactId/... routes so
// the path matcher always reaches them before the generic /:artifactId.
// =============================================================================

const VALID_AUDIENCE_PROFILE_STATUSES: ReadonlyArray<AudienceProfileStatus> = [
  'draft',
  'active',
  'archived',
];

const VALID_AUDIENCE_REGISTERS: ReadonlyArray<CommunicationRegister> = [
  'executive',
  'professional',
  'technical',
  'narrative',
];

const VALID_AUDIENCE_DENSITIES: ReadonlyArray<DocumentDensity> = [
  'concise',
  'standard',
  'detailed',
  'comprehensive',
];

const VALID_AUDIENCE_LANGUAGE_STYLES: ReadonlyArray<DocumentLanguageStyle> = [
  'formal',
  'consulting',
  'legal',
  'narrative',
];

const VALID_AUDIENCE_EXEC_SUMMARY_POLICIES: ReadonlyArray<AudienceProfileExecutiveSummaryPolicy> = [
  'preserve',
  'expand',
  'drop',
];

const VALID_AUDIENCE_APPENDIX_POLICIES: ReadonlyArray<AudienceProfileAppendixPolicy> = [
  'preserve',
  'drop',
];

const VALID_AUDIENCE_JARGON_POLICIES: ReadonlyArray<AudienceProfileJargonPolicy> = [
  'as_is',
  'plain_language',
];

function mapAudienceProfileErrorToStatus(code: AudienceProfileErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'profile_not_found':
      return 404;
    case 'profile_archived':
    case 'profile_already_active':
    case 'profile_already_archived':
      return 409;
    case 'system_profile_immutable':
    case 'forbidden':
      return 403;
    default:
      return 400;
  }
}

function parseAudienceRegister(raw: unknown): CommunicationRegister | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_REGISTERS.includes(raw as CommunicationRegister)
    ? (raw as CommunicationRegister)
    : undefined;
}

function parseAudienceDensity(raw: unknown): DocumentDensity | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_DENSITIES.includes(raw as DocumentDensity)
    ? (raw as DocumentDensity)
    : undefined;
}

function parseAudienceLanguageStyle(raw: unknown): DocumentLanguageStyle | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_LANGUAGE_STYLES.includes(raw as DocumentLanguageStyle)
    ? (raw as DocumentLanguageStyle)
    : undefined;
}

function parseAudienceExecutiveSummaryPolicy(
  raw: unknown
): AudienceProfileExecutiveSummaryPolicy | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_EXEC_SUMMARY_POLICIES.includes(raw as AudienceProfileExecutiveSummaryPolicy)
    ? (raw as AudienceProfileExecutiveSummaryPolicy)
    : undefined;
}

function parseAudienceAppendixPolicy(raw: unknown): AudienceProfileAppendixPolicy | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_APPENDIX_POLICIES.includes(raw as AudienceProfileAppendixPolicy)
    ? (raw as AudienceProfileAppendixPolicy)
    : undefined;
}

function parseAudienceJargonPolicy(raw: unknown): AudienceProfileJargonPolicy | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_JARGON_POLICIES.includes(raw as AudienceProfileJargonPolicy)
    ? (raw as AudienceProfileJargonPolicy)
    : undefined;
}

function parseAudienceTagFilter(raw: unknown): AudienceProfileTagFilter | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const candidate = raw as { include?: unknown; exclude?: unknown };
  return {
    include: parseStringArray(candidate.include),
    exclude: parseStringArray(candidate.exclude),
  };
}

router.get(
  '/audience-profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_AUDIENCE_PROFILE_STATUSES.includes(statusRaw as AudienceProfileStatus)
        ? (statusRaw as AudienceProfileStatus)
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const includeSystem = !(req.query.includeSystem === 'false' || req.query.includeSystem === '0');
    const profiles = listAudienceProfiles(organizationId, {
      status,
      includeArchived,
      includeSystem,
    });
    res.json({ profiles });
  })
);

router.post(
  '/audience-profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = draftAudienceProfile({
        organizationId,
        userId,
        input: {
          name: typeof body.name === 'string' ? body.name : '',
          description: typeof body.description === 'string' ? body.description : undefined,
          audienceLabels: parseStringArray(body.audienceLabels),
          registerOverride:
            parseAudienceRegister(body.registerOverride) === null
              ? undefined
              : (parseAudienceRegister(body.registerOverride) as CommunicationRegister | undefined),
          densityOverride:
            parseAudienceDensity(body.densityOverride) === null
              ? undefined
              : (parseAudienceDensity(body.densityOverride) as DocumentDensity | undefined),
          languageStyleOverride:
            parseAudienceLanguageStyle(body.languageStyleOverride) === null
              ? undefined
              : (parseAudienceLanguageStyle(body.languageStyleOverride) as
                  | DocumentLanguageStyle
                  | undefined),
          sectionFilters: parseAudienceTagFilter(body.sectionFilters),
          blockFilters: parseAudienceTagFilter(body.blockFilters),
          executiveSummaryPolicy: parseAudienceExecutiveSummaryPolicy(body.executiveSummaryPolicy),
          appendixPolicy: parseAudienceAppendixPolicy(body.appendixPolicy),
          jargonPolicy: parseAudienceJargonPolicy(body.jargonPolicy),
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.status(201).json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/audience-profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const profile = getAudienceProfile(profileId, organizationId);
    if (!profile) {
      res.status(404).json({ error: 'profile_not_found' });
      return;
    }
    res.json({ profile });
  })
);

router.patch(
  '/audience-profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = updateAudienceProfile({
        organizationId,
        userId,
        profileId,
        input: {
          name: typeof body.name === 'string' ? body.name : undefined,
          description:
            body.description === null
              ? null
              : typeof body.description === 'string'
                ? body.description
                : undefined,
          audienceLabels: parseStringArray(body.audienceLabels),
          registerOverride: parseAudienceRegister(body.registerOverride),
          densityOverride: parseAudienceDensity(body.densityOverride),
          languageStyleOverride: parseAudienceLanguageStyle(body.languageStyleOverride),
          sectionFilters: parseAudienceTagFilter(body.sectionFilters),
          blockFilters: parseAudienceTagFilter(body.blockFilters),
          executiveSummaryPolicy: parseAudienceExecutiveSummaryPolicy(body.executiveSummaryPolicy),
          appendixPolicy: parseAudienceAppendixPolicy(body.appendixPolicy),
          jargonPolicy: parseAudienceJargonPolicy(body.jargonPolicy),
          notes:
            body.notes === null ? null : typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/audience-profiles/:profileId/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    try {
      const profile = activateAudienceProfile({ organizationId, userId, profileId });
      res.json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/audience-profiles/:profileId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const profile = archiveAudienceProfile({ organizationId, userId, profileId, reason });
      res.json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/audience-profiles/:profileId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const auditEntries = listAudienceProfileAuditEntries(profileId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E5 — Document Lifecycle (status mutation + version snapshot +
// rollback). All routes are scoped under /:artifactId/... and registered
// before the generic /:artifactId GET handler so the path matcher always
// hits the most specific route first.
// =============================================================================

const VALID_DOCUMENT_STATUSES: ReadonlyArray<DocumentStatus> = [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
];

router.get(
  '/:artifactId/lifecycle',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentLifecycleHydrated(organizationId);
    const lifecycle = getDocumentLifecycleState(artifactId, organizationId);
    if (!lifecycle) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ lifecycle });
  })
);

router.post(
  '/:artifactId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const to = req.body?.to as DocumentStatus | undefined;
    if (!to || !VALID_DOCUMENT_STATUSES.includes(to)) {
      res.status(400).json({
        error: 'invalid_target_status',
        message: `to must be one of: ${VALID_DOCUMENT_STATUSES.join(', ')}`,
      });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentLifecycleHydrated(organizationId);
    try {
      const lifecycle = transitionDocumentStatus({
        organizationId,
        artifactId,
        userId,
        to,
        reason,
      });
      res.json({ lifecycle });
    } catch (err) {
      if (err instanceof DocumentLifecycleTransitionError) {
        const status = mapLifecycleErrorToStatus(err.code);
        res
          .status(status)
          .json({ error: err.code, message: err.message, from: err.from, to: err.to });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] status transition failed', { message });
      res.status(500).json({ error: 'transition_failed', message });
    }
  })
);

router.get(
  '/:artifactId/snapshots',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    const snapshots = listDocumentVersionSnapshots(artifactId, organizationId);
    res.json({ snapshots });
  })
);

router.post(
  '/:artifactId/snapshots',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentLifecycleHydrated(organizationId);
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    try {
      const snapshot = await createDocumentSnapshot({
        organizationId,
        artifactId,
        userId,
        label,
        reason,
        // 'manual' — the explicit-origin path stays @internal and only
        // the rollback orchestrator and (future) auto-status-change
        // hooks set it.
      });
      res.status(201).json({ snapshot });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'document_not_found') {
        res.status(404).json({ error: 'document_not_found', message });
        return;
      }
      logger.warn('[DocumentStudio] snapshot capture failed', { message });
      res.status(500).json({ error: 'snapshot_failed', message });
    }
  })
);

router.get(
  '/:artifactId/snapshots/:versionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const versionId = String(req.params.versionId);
    if (!artifactId || !versionId) {
      res.status(400).json({ error: 'artifactId and versionId are required' });
      return;
    }
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    const snapshot = getDocumentVersionSnapshot(versionId, organizationId);
    if (!snapshot || snapshot.artifactId !== artifactId) {
      // Don't leak existence across artifacts in the same tenant — same
      // 404 for missing AND mismatched.
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ snapshot });
  })
);

router.post(
  '/:artifactId/snapshots/:versionId/rollback',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const versionId = String(req.params.versionId);
    if (!artifactId || !versionId) {
      res.status(400).json({ error: 'artifactId and versionId are required' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentLifecycleHydrated(organizationId);
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    try {
      const result = await rollbackDocumentToVersion({
        organizationId,
        artifactId,
        userId,
        versionId,
        reason,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof DocumentRollbackError) {
        const status = mapRollbackErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] rollback failed', { message });
      res.status(500).json({ error: 'rollback_failed', message });
    }
  })
);

// =============================================================================
// Epic E6 — Comments + review mode. Routes scoped under
// /:artifactId/comments and /:artifactId/comments/threads, all
// registered before the generic /:artifactId GET so the path matcher
// hits the most specific route first. Lifecycle gating (e.g.
// preventing comment mutations on archived documents) is intentionally
// NOT enforced here — review mode must stay usable on any document
// status; the lifecycle check belongs in a UI / governance layer.
// =============================================================================

const VALID_COMMENT_STATUSES: ReadonlyArray<DocumentCommentStatus> = ['open', 'resolved'];

router.get(
  '/:artifactId/comments/threads',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const status =
      typeof req.query.status === 'string' &&
      VALID_COMMENT_STATUSES.includes(req.query.status as DocumentCommentStatus)
        ? (req.query.status as DocumentCommentStatus)
        : undefined;
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
    const blockId = typeof req.query.blockId === 'string' ? req.query.blockId : undefined;
    const threads = listDocumentCommentThreads(artifactId, organizationId, {
      status,
      sectionId,
      blockId,
    });
    res.json({ threads });
  })
);

router.get(
  '/:artifactId/comments/counts',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const counts = getDocumentCommentSectionCounts(artifactId, organizationId);
    res.json({ counts });
  })
);

router.get(
  '/:artifactId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const status =
      typeof req.query.status === 'string' &&
      VALID_COMMENT_STATUSES.includes(req.query.status as DocumentCommentStatus)
        ? (req.query.status as DocumentCommentStatus)
        : undefined;
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
    const blockId = typeof req.query.blockId === 'string' ? req.query.blockId : undefined;
    const hideDeleted = req.query.hideDeleted !== 'false';
    const comments = listDocumentComments(artifactId, organizationId, {
      status,
      sectionId,
      blockId,
      hideDeleted,
    });
    res.json({ comments });
  })
);

router.post(
  '/:artifactId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const anchor = parseCommentAnchorFromBody(req.body);
    if (!anchor) {
      res.status(400).json({
        error: 'invalid_anchor',
        message:
          'anchor must be { kind: "document" } | { kind: "section", sectionId } | { kind: "block", sectionId, blockId }',
      });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const comment = createDocumentComment({
        organizationId,
        artifactId,
        authorId: userId,
        body,
        anchor,
      });
      res.status(201).json({ comment });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] create comment failed', { message });
      res.status(500).json({ error: 'create_comment_failed', message });
    }
  })
);

router.get(
  '/:artifactId/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    if (!artifactId || !commentId) {
      res.status(400).json({ error: 'artifactId and commentId are required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const comment = getDocumentComment(commentId, organizationId);
    if (!comment || comment.artifactId !== artifactId) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ comment });
  })
);

router.post(
  '/:artifactId/comments/:commentId/reply',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const parentCommentId = String(req.params.commentId);
    if (!artifactId || !parentCommentId) {
      res.status(400).json({ error: 'artifactId and commentId are required' });
      return;
    }
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const reply = replyToDocumentComment({
        organizationId,
        artifactId,
        authorId: userId,
        parentCommentId,
        body,
      });
      res.status(201).json({ comment: reply });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] reply comment failed', { message });
      res.status(500).json({ error: 'reply_comment_failed', message });
    }
  })
);

router.post(
  '/:artifactId/comments/:commentId/resolve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const root = resolveDocumentComment({
        organizationId,
        artifactId,
        userId,
        commentId,
        reason,
      });
      res.json({ comment: root });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] resolve comment failed', { message });
      res.status(500).json({ error: 'resolve_comment_failed', message });
    }
  })
);

router.post(
  '/:artifactId/comments/:commentId/reopen',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const root = reopenDocumentComment({
        organizationId,
        artifactId,
        userId,
        commentId,
        reason,
      });
      res.json({ comment: root });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] reopen comment failed', { message });
      res.status(500).json({ error: 'reopen_comment_failed', message });
    }
  })
);

router.delete(
  '/:artifactId/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const deleted = deleteDocumentComment({
        organizationId,
        artifactId,
        userId,
        commentId,
      });
      res.json({ comment: deleted });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] delete comment failed', { message });
      res.status(500).json({ error: 'delete_comment_failed', message });
    }
  })
);

// =============================================================================
// Epic E9 — Audience-driven warianty: variant projection routes.
//
// Registered alongside other /:artifactId/... routes so the path matcher
// always reaches them BEFORE the generic /:artifactId GET handler below.
//
// Both routes are read-only projections of the source DocumentSchema —
// they do not run QA on the variant nor mutate the underlying artifact.
// =============================================================================

router.get(
  '/:artifactId/variants',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const profiles = listActiveAudienceProfiles(organizationId, { includeSystem: true });
    const variants = profiles.map((profile) => ({
      profile,
      plan: describeAudienceProjectionPlan(schema, profile),
    }));
    res.json({ variants });
  })
);

router.get(
  '/:artifactId/variants/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const profileId = String(req.params.profileId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const profile = getAudienceProfile(profileId, organizationId);
    if (!profile) {
      res.status(404).json({ error: 'profile_not_found' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const variant = projectDocumentForAudience(schema, profile);
    res.json({ variant });
  })
);

router.get(
  '/:artifactId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ schema });
  })
);

router.get(
  '/:artifactId/export/:format',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const formatRaw = String(req.params.format).toLowerCase();
    if (formatRaw !== 'markdown' && formatRaw !== 'docx' && formatRaw !== 'pdf') {
      res.status(400).json({ error: 'unsupported_format' });
      return;
    }
    const format = formatRaw as 'markdown' | 'docx' | 'pdf';
    const qaOverride = req.query.qaOverride === 'true' || req.query.qaOverride === '1';
    const { userRole } = getAuthContext(req as AuthRequest);

    try {
      const result = await exportDocumentArtifact(artifactId, organizationId, format, {
        userId,
        userRole,
        qaOverride,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof QaOverrideUnauthorizedError) {
        res.status(403).json({
          error: 'qa_override_unauthorized',
          message: err.message,
          role: err.role,
        });
        return;
      }
      if (err instanceof QaBlockingError) {
        res.status(403).json({
          error: 'qa_blocking',
          message:
            'Document QA produced blocking findings. Resolve the findings or re-run with qaOverride=true (audited).',
          report: err.report,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to export document';
      const status = message.toLowerCase().includes('not found') ? 404 : 500;
      res.status(status).json({ error: 'export_failed', message });
    }
  })
);

// Lightweight policy lookup so the frontend can hide / disable
// privilege-only actions (currently: the QA export-gate override) before
// the user attempts them. Cheap enough to call on every Document Studio
// session bootstrap.
router.get(
  '/policy',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, userRole } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({
      policy: {
        canOverrideQa: canOverrideQa(userRole),
        role: userRole || null,
      },
    });
  })
);

router.post(
  '/:artifactId/editor/proposals/local',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const input = (req.body ?? null) as Partial<DocumentEditorProposalInput> | null;
    if (!input || typeof input !== 'object') {
      res.status(400).json({ error: 'proposal input is required' });
      return;
    }
    if (
      input.scope !== 'local' ||
      typeof input.sectionId !== 'string' ||
      typeof input.blockId !== 'string' ||
      typeof input.instruction !== 'string'
    ) {
      res.status(400).json({ error: 'invalid proposal input' });
      return;
    }
    try {
      const proposal = await createLocalEditProposal({
        artifactId,
        organizationId,
        userId,
        input: {
          scope: 'local',
          sectionId: input.sectionId,
          blockId: input.blockId,
          instruction: input.instruction,
        },
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proposal_failed';
      const status =
        message === 'artifact_not_found' ||
        message === 'section_not_found' ||
        message === 'block_not_found'
          ? 404
          : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/section',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const sectionId = typeof req.body?.sectionId === 'string' ? req.body.sectionId : '';
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!sectionId || !instruction) {
      res.status(400).json({ error: 'sectionId and instruction are required' });
      return;
    }
    try {
      const proposal = await createSectionEditProposal({
        artifactId,
        organizationId,
        userId,
        sectionId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proposal_failed';
      const status =
        message === 'artifact_not_found' || message === 'section_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/global',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!instruction) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }
    try {
      const proposal = await createGlobalEditProposal({
        artifactId,
        organizationId,
        userId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proposal_failed';
      const status = message === 'artifact_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/:proposalId/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const proposalId = String(req.params.proposalId || '');
    if (!artifactId || !proposalId) {
      res.status(400).json({ error: 'artifactId and proposalId are required' });
      return;
    }
    try {
      const result = await approveEditProposal({
        artifactId,
        organizationId,
        userId,
        proposalId,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'approve_failed';
      const status =
        message === 'artifact_not_found' || message === 'proposal_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/:proposalId/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const proposalId = String(req.params.proposalId || '');
    if (!artifactId || !proposalId) {
      res.status(400).json({ error: 'artifactId and proposalId are required' });
      return;
    }
    try {
      const proposal = rejectEditProposal({
        artifactId,
        organizationId,
        userId,
        proposalId,
      });
      res.json({ proposal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'reject_failed';
      const status = message === 'proposal_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.get(
  '/:artifactId/editor/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'artifact_not_found' });
      return;
    }
    const auditEntries = listDocumentAuditEntries(artifactId, organizationId);
    res.json({ auditEntries });
  })
);

router.get(
  '/:artifactId/qa',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const report = await runQaForDocument(artifactId, organizationId);
    if (!report) {
      res.status(404).json({ error: 'artifact_not_found' });
      return;
    }
    res.json({ report });
  })
);

export default router;
