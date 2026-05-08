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
 * Auth: reuses verifyToken + tenant guards used across artifact routes.
 */

import { type Request, type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
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
import { runDocumentQa } from '../services/documentStudio/documentQaService.js';
import {
  approveEditProposal,
  canOverrideQa,
  createGlobalEditProposal,
  createLocalEditProposal,
  createSectionEditProposal,
  exportDocumentArtifact,
  getDocumentArtifact,
  listDocumentAuditEntries,
  materializeDocumentArtifact,
  MissingRequiredSourceError,
  planDocument,
  planDocumentAsync,
  QaBlockingError,
  QaOverrideUnauthorizedError,
  rejectEditProposal,
} from '../services/documentStudio/documentStudioService.js';
import type {
  DocumentEditorProposalInput,
  DocumentIntake,
  DocumentOutline,
  DocumentSourceRef,
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

router.post(
  '/source-packs',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const language = req.body?.language === 'pl' || req.body?.language === 'en' ? req.body.language : 'pl';
    const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
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
    const includeArchived = req.query.includeArchived === 'true' || req.query.includeArchived === '1';
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
            language: input.language === 'pl' || input.language === 'en' ? (input.language as 'pl' | 'en') : undefined,
            sourceTitle: typeof input.sourceTitle === 'string' ? input.sourceTitle : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'url':
          draft = await ingestUrlSource({
            url: String(input.url ?? ''),
            title: typeof input.title === 'string' ? input.title : undefined,
            language: input.language === 'pl' || input.language === 'en' ? (input.language as 'pl' | 'en') : undefined,
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
            language: input.language === 'pl' || input.language === 'en' ? (input.language as 'pl' | 'en') : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'v8_artifact':
          draft = await ingestV8ArtifactSource({
            artifactId: String(input.artifactId ?? ''),
            organizationId,
            title: typeof input.title === 'string' ? input.title : undefined,
            language: input.language === 'pl' || input.language === 'en' ? (input.language as 'pl' | 'en') : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'integration':
          draft = ingestIntegrationSource({
            integration: input.integration as 'notion' | 'drive' | 'sharepoint' | 'confluence',
            externalId: String(input.externalId ?? ''),
            title: String(input.title ?? ''),
            preview: typeof input.preview === 'string' ? input.preview : undefined,
            language: input.language === 'pl' || input.language === 'en' ? (input.language as 'pl' | 'en') : undefined,
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
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'artifact_not_found' });
      return;
    }
    const report = runDocumentQa(schema);
    report.organizationId = organizationId;
    res.json({ report });
  })
);

export default router;
