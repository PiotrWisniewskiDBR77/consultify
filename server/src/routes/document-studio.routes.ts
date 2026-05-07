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
 *     Returns: export payload (markdown / docx / pdf).
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
 * Auth: reuses verifyToken + tenant guards used across artifact routes.
 */

import { type Request, type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  approveEditProposal,
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
  rejectEditProposal,
} from '../services/documentStudio/documentStudioService.js';
import type {
  DocumentEditorProposalInput,
  DocumentIntake,
  DocumentOutline,
  DocumentSourceRef,
  TemplateDraftInput,
} from '../services/documentStudio/documentStudioTypes.js';
import {
  approveTemplate,
  deprecateTemplate,
  draftTemplate,
  draftTemplateAsync,
  getTemplate,
  listTemplateAuditEntries,
  listTemplates,
} from '../services/documentStudio/documentTemplateService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);

function getAuthContext(req: AuthRequest): { userId: string; organizationId: string } {
  const userId = String((req as any)?.user?.id || (req as any)?.userId || '');
  const organizationId = String(
    (req as any)?.user?.organizationId || (req as any)?.organizationId || ''
  );
  return { userId, organizationId };
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
    const template = getTemplate(templateId, organizationId);
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    const auditEntries = listTemplateAuditEntries(templateId, organizationId);
    res.json({ auditEntries });
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

    try {
      const result = await exportDocumentArtifact(artifactId, organizationId, format);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export document';
      const status = message.toLowerCase().includes('not found') ? 404 : 500;
      res.status(status).json({ error: 'export_failed', message });
    }
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

export default router;
