/**
 * Report Builder Routes
 *
 * API endpoints for the generic Report Builder module.
 * Handles report CRUD, section management, and AI generation.
 */

import bcrypt from 'bcryptjs';
import * as docxModule from 'docx';
import { NextFunction, Request, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

import {
  getInvocationProfile,
  getProfilesForSourceType,
  INVOCATION_PROFILES,
} from '../config/reportInvocationProfiles.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { default as defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { exportReportToNotion } from '../services/ai/integrationHubService.js';

const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = docxModule as any;
import { upsertAssessmentReportForBuilder } from '../services/assessmentReportBuilderLinkService.js';
import { getOrCreateBrandVoice, updateBrandVoice } from '../services/brandVoiceProfileService.js';
import {
  buildPmReportSections,
  type PmReportKind,
  publishPmReport,
} from '../services/execution/programManagementReportsService.js';
import {
  buildThreeAxisReport,
  publishThreeAxisSnapshot,
} from '../services/execution/threeAxisReportService.js';
import { createInitiative as funnelCreateInitiative } from '../services/initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from '../services/initiativeProjectPolicyService.js';
import { buildKnowledgeMap } from '../services/knowledgeMapService.js';
import {
  isTemplateResolveError,
  resolveDocumentTemplateForCreation,
  type TemplateResolveErrorCode,
} from '../services/materials/creationIntent.js';
import notificationService from '../services/notificationService.js';
import { computeRagForReport } from '../services/ragLogicService.js';
import ReportContract from '../services/report/reportContract.js';
import {
  applyAgentAction,
  getAgentMessages,
  processAgentMessage,
} from '../services/reportAgentService.js';
import ReportBuilderCommentsService from '../services/reportBuilderCommentsService.js';
import ReportBuilderService from '../services/reportBuilderService.js';
import {
  getCanonicalTemplate,
  proposeOutline,
} from '../services/reportCanonicalTemplatesService.js';
import ReportGenerationService from '../services/reportGenerationService.js';
import { checkQualityGates } from '../services/reportQualityGatesService.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import { applyExportApprovalGate } from '../services/v8/exportApprovalGate.js';
import * as reportsPresModelService from '../services/v8/reportsPresModelService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import { exportsDir, uploadsDir } from '../utils/storagePaths.js';

// ==========================================
// HELPER: Auto-version + Notify on status change
// ==========================================

async function createAutoVersionOnStatusChange(
  reportId: string,
  organizationId: string,
  userId: string,
  previousStatus: string,
  newStatus: string,
  changeSummary: string
): Promise<void> {
  try {
    await ReportBuilderService.createVersion(reportId, organizationId, userId, {
      changeType: 'auto',
      changeSummary,
      previousStatus,
      newStatus,
    });
    logger.info('[ReportBuilder] Auto-version created on status change', {
      reportId,
      previousStatus,
      newStatus,
    });
  } catch (err) {
    logger.warn('[ReportBuilder] Failed to create auto-version (non-fatal)', { reportId, err });
  }
}

async function notifyOnStatusChange(
  reportId: string,
  organizationId: string,
  actorUserId: string,
  targetUserIds: string[],
  notifType: string,
  title: string,
  body: string,
  reportTitle?: string
): Promise<void> {
  for (const targetId of targetUserIds) {
    if (targetId === actorUserId) continue; // Don't notify yourself
    try {
      await notificationService.send({
        userId: targetId,
        organizationId,
        type: notifType,
        title,
        body,
        entityType: 'report_builder',
        entityId: reportId,
        actionUrl: `/reports/builder/${reportId}`,
        actorId: actorUserId,
        priority: 'normal',
        metadata: { reportTitle },
      });
    } catch (err) {
      logger.warn('[ReportBuilder] Failed to send notification (non-fatal)', { targetId, err });
    }
  }
}

async function syncArtifactRegistryForReport(
  report: any,
  organizationId: string,
  userId: string,
  options?: { visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared' | 'demo' }
): Promise<void> {
  const reportId = String(report?.id || '');
  if (!reportId) return;

  const title = String(report?.title || 'Untitled report');
  const projectId = report?.projectId ? String(report.projectId) : null;
  const sourceType = report?.sourceType ? String(report.sourceType) : null;
  const sourceId = report?.sourceId ? String(report.sourceId) : null;

  const registeredArtifact = await artifactRegistryService.registerArtifactOrigin({
    organizationId,
    outputType: 'report',
    artifactFamily: 'document',
    originRuntime: 'report',
    originRecordId: reportId,
    titleSnapshot: title,
    ownerUserId: String(report?.createdBy || userId || ''),
    createdBy: String(report?.createdBy || userId || 'system'),
    deliveryState: artifactRegistryService.mapReportStatusToDeliveryState(report?.status),
    visibilityScope: options?.visibilityScope ?? undefined,
    projectId,
    originSummary: {
      sourceType,
      sourceId,
      reportType: report?.reportType ? String(report.reportType) : null,
      templateId: report?.templateId ? String(report.templateId) : null,
      nativeStatus: report?.status ? String(report.status) : null,
      sourceTable: 'report_builder_reports',
    },
  });

  if (registeredArtifact && report?.templateId) {
    const templateArtifactId = String(report.templateArtifactId || report.templateId || '');
    if (templateArtifactId) {
      try {
        await artifactRegistryService.addSecondaryOriginLink({
          artifactId: registeredArtifact.artifactId,
          organizationId,
          originRuntime: 'source_template',
          originRecordId: templateArtifactId,
        });
      } catch {
        // Non-fatal: template link is supplementary
      }
    }
  }
}

async function enforceQualityGatesForExport(
  organizationId: string,
  reportId: string,
  res: Response
): Promise<boolean> {
  const qualityReport = await checkQualityGates(organizationId, reportId);
  if (qualityReport.canExport) return true;
  res.status(409).json({
    error: 'REPORT_NOT_READY_FOR_EXPORT',
    message: 'Report failed quality gates required for export.',
    qualityReport,
  });
  return false;
}

const router = Router();

function resolveReportBuilderCorrelationId(req: Request): string | null {
  return (req as any).correlationId || req.get('X-Correlation-ID') || null;
}

function buildReportBuilderFailClosedError(
  req: Request,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveReportBuilderCorrelationId(req),
  };
}

// Apply middleware (use default API limiter – 1000 req/15min in dev, not the restrictive auth limiter)
router.use(defaultRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// Helper to get auth context
function getAuthContext(req: any): { userId: string; organizationId: string } {
  const userId = req?.user?.id || req?.userId || '';
  const organizationId = req?.user?.organizationId || req?.organizationId || 'org-default';
  return { userId, organizationId };
}

async function recordCanonicalExportTrace(params: {
  organizationId: string;
  userId: string;
  reportId: string;
  format: 'pdf' | 'pptx' | 'docx';
  status?: 'completed' | 'failed';
}) {
  const artifact = await artifactRegistryService.getArtifactByOrigin({
    organizationId: params.organizationId,
    originRuntime: 'report',
    originRecordId: params.reportId,
    userId: params.userId,
    roleKey: null,
  });
  if (!artifact?.artifactId) return;
  if (params.status === 'failed') {
    await reportsPresModelService.recordFailedExport(
      artifact.artifactId,
      params.organizationId,
      params.format,
      params.userId || 'system'
    );
    return;
  }
  await reportsPresModelService.recordCompletedExport(
    artifact.artifactId,
    params.organizationId,
    params.format,
    params.userId || 'system'
  );
}

async function getNotionConfigForUser(userId: string): Promise<{
  apiKey: string;
  parentPageId?: string;
  databaseId?: string;
} | null> {
  const prefKey = 'settings:integrations';
  const row = await dbGet<{ preferences_data: string }>(
    `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
    [userId, prefKey],
    { fallback: true } as any
  );

  if (!row?.preferences_data) return null;
  let integrations: any[] = [];
  try {
    integrations = JSON.parse(row.preferences_data);
  } catch {
    integrations = [];
  }

  const notion = integrations.find((i) => String(i?.provider || '').toLowerCase() === 'notion');
  if (!notion || notion.status !== 'active') return null;

  const cfg = notion.config || {};
  const apiKey = String(cfg.apiKey || '').trim();
  const parentPageId = cfg.parentPageId ? String(cfg.parentPageId) : undefined;
  const databaseId = cfg.databaseId ? String(cfg.databaseId) : undefined;
  if (!apiKey) return null;
  if (!parentPageId && !databaseId) return null;
  return { apiKey, parentPageId, databaseId };
}

// Helper to safely extract string from params (handles string | string[])
function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

// ==========================================
// REPORT DEFINITIONS (kontrakt F5 — rejestr report_definitions)
// ==========================================

/**
 * GET /api/report-builder/definitions
 * Rejestr definicji raportów (systemowe + org-własne). Zastępuje hardkod
 * `ExecutionHub.reportCatalog`. Filtr `?kind=EXECUTION_PACK` zawęża do katalogu Execution.
 * Kontrakt F5: `server/src/services/report/reportContract.ts` (rdzeń §4.2).
 */
router.get('/definitions', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const definitions = await ReportContract.listDefinitions(organizationId, { kind });
    res.json({ definitions });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing report definitions:', err);
    res.status(500).json({ error: 'Failed to list report definitions' });
  }
});

/**
 * POST /api/report-builder/program-3axis/publish
 * F5 wiring — "silnik→papier" dla flagowego raportu PM: publikuje niemutowalny snapshot
 * raportu wykonawczego 3 osi (T=czas × Z=zadania × W=wartość) przez
 * `threeAxisReportService.publishThreeAxisSnapshot`. Additive — wzorem świeżo dodanego
 * `POST /api/finance-statements/packs/:id/report-section` (financeReportSectionService);
 * definicja rejestru `report_definitions` = 'sponsor-3axis' (migracja 913).
 * Body: { projectId?, programId?, title?, periodFrom?, periodTo? }. Zakres domyślny (brak
 * projectId/programId) = cała organizacja (patrz threeAxisReportService.buildThreeAxisReport).
 */
router.post('/program-3axis/publish', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { userId, organizationId } = getAuthContext(req);
    const body = req.body || {};
    const projectId =
      typeof body.projectId === 'string' && body.projectId.trim()
        ? body.projectId.trim()
        : undefined;
    const programId =
      typeof body.programId === 'string' && body.programId.trim()
        ? body.programId.trim()
        : undefined;
    const title =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;
    const periodFrom = typeof body.periodFrom === 'string' ? body.periodFrom : undefined;
    const periodTo = typeof body.periodTo === 'string' ? body.periodTo : undefined;

    const result = await publishThreeAxisSnapshot({
      organizationId,
      createdBy: userId || 'system',
      projectId,
      programId,
      title,
      periodFrom,
      periodTo,
    });

    res.status(201).json({
      success: true,
      reportId: result.reportId,
      snapshotId: result.snapshotId,
      report: result.report,
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error publishing 3-axis program report:', err);
    res.status(500).json({ error: 'Failed to publish 3-axis program report' });
  }
});

/**
 * GET /api/report-builder/program-3axis/live
 * Faza2 gap #2 (audyt endpointów READ) — podgląd NA ŻYWO raportu wykonawczego 3 osi
 * (T=czas × Z=zadania × W=wartość), bez publikacji/snapshotu. `threeAxisReportService`
 * miał gotowy read-model (`buildThreeAxisReport`) od migracji 913, ale żaden route go
 * nie wołał — tylko `POST .../publish` (freeze snapshot) był wpięty, więc timeline
 * pokazywał NA zanim ktoś opublikował. Ten endpoint jest czystym odczytem (fail-soft:
 * błąd/pusty portfel → program z samymi `null`, nie 500), org-scoped, additive — nie
 * zmienia zachowania `/program-3axis/publish`. Query: `projectId?`, `programId?`
 * (domyślnie = cała organizacja, jak w publish), `asOf?` (epoch ms, domyślnie teraz).
 */
router.get('/program-3axis/live', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId.trim()
        ? req.query.projectId.trim()
        : undefined;
    const programId =
      typeof req.query.programId === 'string' && req.query.programId.trim()
        ? req.query.programId.trim()
        : undefined;
    const asOfRaw = typeof req.query.asOf === 'string' ? Number(req.query.asOf) : undefined;
    const asOf = Number.isFinite(asOfRaw) ? asOfRaw : undefined;

    const report = await buildThreeAxisReport({
      organizationId,
      projectId,
      programId,
      asOf,
    });

    res.json({ success: true, available: true, report });
  } catch (err) {
    logger.error('[ReportBuilder] Error building live 3-axis program report:', err);
    res.json({
      success: true,
      available: false,
      report: null,
    });
  }
});

const PM_REPORT_KINDS: PmReportKind[] = ['sponsor-onepager', 'steering', 'pmo-weekly'];

function parsePmReportKind(raw: unknown): PmReportKind | null {
  const kind = typeof raw === 'string' ? raw.trim() : '';
  return (PM_REPORT_KINDS as string[]).includes(kind) ? (kind as PmReportKind) : null;
}

/**
 * GET /api/report-builder/program-management/:kind/live
 * D12+D13 — podgląd na żywo jednego z 3 pakietów PM (sponsor-onepager | steering |
 * pmo-weekly), bez publikacji. Wzorzec `GET /program-3axis/live` — czysty odczyt
 * (fail-soft), sekcje renderowane przez `programManagementReportsService` z
 * ISTNIEJĄCYCH read-modeli (3-osi, alerty, decyzje, ryzyka, capacity, cycle-time).
 * Query: `projectId?`, `programId?` (domyślnie = cała organizacja).
 */
router.get(
  '/program-management/:kind/live',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const kind = parsePmReportKind(req.params.kind);
      if (!kind) {
        res.status(400).json({
          error: `Unknown PM report kind. Expected one of: ${PM_REPORT_KINDS.join(', ')}`,
        });
        return;
      }
      const { organizationId } = getAuthContext(req);
      const projectId =
        typeof req.query.projectId === 'string' && req.query.projectId.trim()
          ? req.query.projectId.trim()
          : undefined;
      const programId =
        typeof req.query.programId === 'string' && req.query.programId.trim()
          ? req.query.programId.trim()
          : undefined;

      const sections = await buildPmReportSections(kind, { organizationId, projectId, programId });
      res.json({ success: true, available: true, kind, sections });
    } catch (err) {
      logger.error('[ReportBuilder] Error building live PM report:', err);
      res.json({ success: true, available: false, sections: null });
    }
  }
);

/**
 * POST /api/report-builder/program-management/:kind/publish
 * Tworzy realny raport-artefakt (kanon F5) z jednego z 3 szablonów PM zaseedowanych
 * migracją 924 (`tpl-pm-sponsor-onepager` | `tpl-pm-steering` | `tpl-pm-weekly`) i
 * wypełnia sekcje policzonymi (nie AI-zmyślonymi) danymi — wzorzec `POST /program-3axis/publish`.
 * Body: { projectId?, programId?, title? }.
 */
router.post(
  '/program-management/:kind/publish',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const kind = parsePmReportKind(req.params.kind);
      if (!kind) {
        res.status(400).json({
          error: `Unknown PM report kind. Expected one of: ${PM_REPORT_KINDS.join(', ')}`,
        });
        return;
      }
      const { userId, organizationId } = getAuthContext(req);
      const body = req.body || {};
      const projectId =
        typeof body.projectId === 'string' && body.projectId.trim()
          ? body.projectId.trim()
          : undefined;
      const programId =
        typeof body.programId === 'string' && body.programId.trim()
          ? body.programId.trim()
          : undefined;
      const title =
        typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;

      const result = await publishPmReport(kind, {
        organizationId,
        createdBy: userId || 'system',
        projectId,
        programId,
        title,
      });

      res.status(201).json({ success: true, reportId: result.reportId });
    } catch (err) {
      logger.error('[ReportBuilder] Error publishing PM report:', err);
      res.status(500).json({ error: 'Failed to publish PM report' });
    }
  }
);

// ==========================================
// INVOCATION PROFILES ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/profiles
 * List all available invocation profiles
 */
router.get('/profiles', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    const profiles = Object.values(INVOCATION_PROFILES).map((p) => ({
      id: p.id,
      name: p.name,
      namePl: p.namePl,
      description: p.description,
      descriptionPl: p.descriptionPl,
      sourceTypes: p.sourceTypes,
      features: p.features,
    }));

    res.json({ profiles });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing profiles:', err);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
});

/**
 * GET /api/report-builder/profiles/:profileId
 * Get a specific invocation profile with full details
 */
router.get('/profiles/:profileId', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const profileId = paramStr(req.params.profileId);
    const profile = getInvocationProfile(profileId);

    res.json({ profile });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting profile:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * GET /api/report-builder/profiles/for-source/:sourceType
 * Get profiles available for a specific source type
 */
router.get(
  '/profiles/for-source/:sourceType',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const sourceType = paramStr(req.params.sourceType);
      const profiles = getProfilesForSourceType(sourceType.toUpperCase()).map((p) => ({
        id: p.id,
        name: p.name,
        namePl: p.namePl,
        description: p.description,
        descriptionPl: p.descriptionPl,
        sourceTypes: p.sourceTypes,
        features: p.features,
        defaultIntent: p.defaultIntent,
      }));

      res.json({ profiles });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting profiles for source:', err);
      res.status(500).json({ error: 'Failed to get profiles' });
    }
  }
);

// ==========================================
// SOURCE ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/sources/assessment
 * List approved assessments available for report creation
 */
router.get('/sources/assessment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);

    const sources = await ReportBuilderService.listAssessmentSources(organizationId);

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing assessment sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/assessment/:sourceId
 * Get assessment source data for report
 */
router.get(
  '/sources/assessment/:sourceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceId = paramStr(req.params.sourceId);
      const { organizationId } = getAuthContext(req);

      // For now, return basic source info
      // Full data will be loaded when report is created
      const sources = await ReportBuilderService.listAssessmentSources(organizationId);
      const source = sources.find((s) => s.id === sourceId);

      if (!source) {
        return res.status(404).json({ error: 'Assessment not found or not approved' });
      }

      res.json(source);
    } catch (err) {
      logger.error('[ReportBuilder] Error getting assessment source:', err);
      next(err);
    }
  }
);

/**
 * GET /api/report-builder/sources/interview
 * List completed interviews available for report creation
 */
router.get('/sources/interview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const sessions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT s.id, s.name, s.status, s.total_questions, s.answered_questions,
                s.template_id, s.completed_at, s.created_at, s.updated_at,
                COALESCE(
                  NULLIF(
                    TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
                    ''
                  ),
                  u.email,
                  u.id
                ) as "ownerName"
         FROM interview_sessions s
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.organization_id = ? AND s.status IN ('completed', 'in_progress')
         ORDER BY s.updated_at DESC
         LIMIT 100`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const sources = sessions.map((s) => ({
      id: s.id,
      sourceType: 'INTERVIEW',
      name: s.name || 'Interview Session',
      status: s.status,
      framework: 'INTERVIEW',
      totalQuestions: s.total_questions || 0,
      answeredQuestions: s.answered_questions || 0,
      completionPercent:
        s.total_questions > 0 ? Math.round((s.answered_questions / s.total_questions) * 100) : 0,
      ownerName: s.ownerName || 'Unknown',
      completedAt: s.completed_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing interview sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/interview/:sourceId
 * Get interview source data for report generation
 */
router.get(
  '/sources/interview/:sourceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceId = paramStr(req.params.sourceId);
      const { organizationId } = getAuthContext(req);
      const { getDatabase } = await import('../database/index.js');
      const db = getDatabase();

      const session = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT s.*,
                  COALESCE(
                    NULLIF(
                      TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
                      ''
                    ),
                    u.email,
                    u.id
                  ) as "ownerName"
           FROM interview_sessions s
           LEFT JOIN users u ON u.id = s.owner_id
           WHERE s.id = ? AND s.organization_id = ?`,
          [sourceId, organizationId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!session) {
        return res.status(404).json({ error: 'Interview session not found' });
      }

      // Get questions and answers
      const questions = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT id, category, question_text, answer_text, status, confidence_score, tags
           FROM interview_questions
           WHERE session_id = ? AND organization_id = ?
           ORDER BY sort_order ASC`,
          [sourceId, organizationId],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Get notes
      const notes = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT id, category, title, content, created_by
           FROM interview_notes
           WHERE session_id = ? AND organization_id = ?
           ORDER BY created_at ASC`,
          [sourceId, organizationId],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const safeJsonParse = (v: string | null | undefined, fallback: any) => {
        if (!v) return fallback;
        try {
          return JSON.parse(v);
        } catch {
          return fallback;
        }
      };

      // D-P1.6 — surface the governed P10 findings layer to the report builder.
      // Previously the report source read only the legacy summary_* model + raw
      // Q&A, silently bypassing the flagship evidence-bounded findings. We find
      // every insight that references this session and load its findings, so a
      // report built from an interview includes the confidence-rated,
      // readback-gated findings rather than just the keyword summary.
      const p10Findings: Array<Record<string, unknown>> = [];
      try {
        const insightRows = await new Promise<any[]>((resolve) => {
          db.all(
            `SELECT id, source_session_ids FROM interview_insights
             WHERE organization_id = ? AND source_session_ids LIKE ?`,
            [organizationId, `%${sourceId}%`],
            (err: Error | null, rows: any[]) => resolve(err ? [] : rows || [])
          );
        });
        const matchingInsightIds = insightRows
          .filter((row) => {
            const ids = safeJsonParse(row.source_session_ids, []);
            return Array.isArray(ids) && ids.includes(sourceId);
          })
          .map((row) => row.id);
        if (matchingInsightIds.length > 0) {
          const { listFindings } =
            await import('../services/v8/interviewInsightFindingsService.js');
          for (const insightId of matchingInsightIds) {
            const findings = await listFindings(insightId).catch(() => []);
            for (const f of findings) {
              p10Findings.push({
                insightId,
                findingStatement: f.finding_statement,
                confidenceLevel: f.confidence_level,
                limits: f.limits,
                nextAction: f.next_action,
                readbackStatus: f.readback_status,
                evidence: (f.evidence_pointers || [])
                  .filter((p: any) => !p.isTombstone)
                  .slice(0, 6)
                  .map((p: any) => String(p.excerpt || p.source_id || '').slice(0, 280)),
              });
            }
          }
        }
      } catch (findingsErr) {
        logger.warn('[ReportBuilder] P10 findings load failed (degrading)', findingsErr);
      }

      res.json({
        id: session.id,
        sourceType: 'INTERVIEW',
        name: session.name || 'Interview Session',
        status: session.status,
        ownerName: session.ownerName || 'Unknown',
        totalQuestions: session.total_questions || 0,
        answeredQuestions: session.answered_questions || 0,
        summaryFacts: safeJsonParse(session.summary_facts, []),
        summaryGaps: safeJsonParse(session.summary_gaps, []),
        summaryConstraints: safeJsonParse(session.summary_constraints, []),
        summaryPainPoints: safeJsonParse(session.summary_pain_points, []),
        // D-P1.6 — governed evidence-bounded findings (empty array when the
        // session has no published insights/findings yet).
        p10Findings,
        questions: questions.map((q) => ({
          id: q.id,
          category: q.category,
          question: q.question_text,
          answer: q.answer_text || '',
          status: q.status,
          confidence: q.confidence_score || 0,
          tags: safeJsonParse(q.tags, []),
        })),
        notes: notes.map((n) => ({
          id: n.id,
          category: n.category,
          title: n.title,
          content: n.content,
        })),
        completedAt: session.completed_at,
        createdAt: session.created_at,
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting interview source:', err);
      next(err);
    }
  }
);

/**
 * GET /api/report-builder/sources/tool
 * List tool sessions available for report creation
 */
router.get('/sources/tool', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const sessions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT ts.id, ts.name, ts.tool_type, ts.status, ts.completion_percent,
                ts.confidence_avg, ts.created_at, ts.updated_at,
                COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as "creatorName"
         FROM tool_sessions ts
         LEFT JOIN users u ON u.id = ts.created_by
         WHERE ts.organization_id = ?
         ORDER BY ts.updated_at DESC
         LIMIT 100`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const sources = sessions.map((s) => ({
      id: s.id,
      sourceType: 'TOOL',
      name: s.name || 'Tool Session',
      status: s.status || 'DRAFT',
      framework: s.tool_type || 'TOOL',
      toolType: s.tool_type,
      completionPercent: s.completion_percent || 0,
      confidenceAvg: s.confidence_avg || 0,
      creatorName: s.creatorName || 'Unknown',
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing tool sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/tool/:sourceId
 * Get tool session source data for report generation
 */
router.get('/sources/tool/:sourceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceId = paramStr(req.params.sourceId);
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const session = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT ts.*, COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as "creatorName"
           FROM tool_sessions ts
           LEFT JOIN users u ON u.id = ts.created_by
           WHERE ts.id = ? AND ts.organization_id = ?`,
        [sourceId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      return res.status(404).json({ error: 'Tool session not found' });
    }

    // Get related tool works
    const toolWorks = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT tw.id, tw.name, tw.description, tw.tool_id, tw.status, tw.progress, tw.work_data
           FROM tool_works tw
           LEFT JOIN tools t ON t.id = tw.tool_id
           WHERE tw.organization_id = ?
           ORDER BY tw.updated_at DESC
           LIMIT 20`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const safeJsonParse = (v: string | null | undefined, fallback: any) => {
      if (!v) return fallback;
      try {
        return JSON.parse(v);
      } catch {
        return fallback;
      }
    };

    res.json({
      id: session.id,
      sourceType: 'TOOL',
      name: session.name || 'Tool Session',
      status: session.status,
      toolType: session.tool_type,
      completionPercent: session.completion_percent || 0,
      confidenceAvg: session.confidence_avg || 0,
      creatorName: session.creatorName || 'Unknown',
      answers: safeJsonParse(session.answers_json, {}),
      contextSnapshot: safeJsonParse(session.context_snapshot, {}),
      toolWorks: toolWorks.map((tw) => ({
        id: tw.id,
        name: tw.name,
        description: tw.description,
        toolId: tw.tool_id,
        status: tw.status,
        progress: tw.progress || 0,
        data: safeJsonParse(tw.work_data, {}),
      })),
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting tool source:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/upload_bundle
 * List uploaded document bundles available for draft report generation
 */
router.get('/sources/upload_bundle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const imports = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT id, source_file_name, source_format, detected_framework, detection_confidence,
                status, created_at, updated_at, processed_at, coverage_percent
         FROM imported_reports
         WHERE organization_id = ?
           AND status IN ('ready_for_review', 'assessment_created', 'initiatives_created', 'completed')
         ORDER BY COALESCE(processed_at, updated_at, created_at) DESC
         LIMIT 100`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const sources = imports.map((item) => ({
      id: item.id,
      sourceType: 'UPLOAD_BUNDLE',
      name: item.source_file_name || 'Uploaded bundle',
      status: item.status || 'ready_for_review',
      framework: item.detected_framework || 'UPLOAD',
      sourceFormat: item.source_format || 'unknown',
      detectionConfidence: Number(item.detection_confidence || 0),
      coveragePercent: Number(item.coverage_percent || 0),
      processedAt: item.processed_at || null,
      createdAt: item.created_at || null,
      updatedAt: item.updated_at || null,
    }));

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing upload bundle sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/upload_bundle/:sourceId
 * Get uploaded bundle source data for report generation
 */
router.get(
  '/sources/upload_bundle/:sourceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceId = paramStr(req.params.sourceId);
      const { organizationId } = getAuthContext(req);
      const { getDatabase } = await import('../database/index.js');
      const db = getDatabase();

      const row = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT id, source_file_name, source_file_size, source_format, detected_framework,
                  detection_confidence, extracted_data_json, document_metadata_json, canonical_markdown,
                  auto_summary, coverage_percent, status, created_at, updated_at, processed_at
           FROM imported_reports
           WHERE id = ? AND organization_id = ?`,
          [sourceId, organizationId],
          (err: Error | null, item: any) => {
            if (err) reject(err);
            else resolve(item || null);
          }
        );
      });

      if (!row) {
        return res.status(404).json({ error: 'Upload bundle not found' });
      }

      const safeJsonParse = (value: string | null | undefined, fallback: any) => {
        if (!value) return fallback;
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      };

      res.json({
        id: row.id,
        sourceType: 'UPLOAD_BUNDLE',
        name: row.source_file_name || 'Uploaded bundle',
        status: row.status || 'ready_for_review',
        framework: row.detected_framework || 'UPLOAD',
        sourceFormat: row.source_format || 'unknown',
        sourceFileSize: Number(row.source_file_size || 0),
        detectionConfidence: Number(row.detection_confidence || 0),
        coveragePercent: Number(row.coverage_percent || 0),
        summary: row.auto_summary || null,
        canonicalMarkdown: row.canonical_markdown || null,
        metadata: safeJsonParse(row.document_metadata_json, {}),
        extractedData: safeJsonParse(row.extracted_data_json, null),
        processedAt: row.processed_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting upload bundle source:', err);
      next(err);
    }
  }
);

// ==========================================
// TEMPLATE MARKETPLACE ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/templates
 * List all available templates (system + organization)
 */
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { sourceType, isPublic, isSystem } = req.query;

    const templates = await ReportBuilderService.listTemplates(organizationId, {
      sourceType: sourceType as string | undefined,
      isPublic: isPublic === 'true',
      isSystem: isSystem === 'true',
    });

    res.json({ templates });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing templates:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/templates
 * Create a new report template
 */
router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const { name, description, sourceType, reportType, sections, defaultOptions, isPublic } =
      req.body;

    if (!name || !sourceType || !sections) {
      return res.status(400).json({ error: 'Name, sourceType, and sections are required' });
    }

    const templateId = uuidv4();
    const template = await ReportBuilderService.createTemplate({
      id: templateId,
      organizationId,
      name,
      description,
      sourceType,
      reportType,
      sections,
      defaultOptions,
      isPublic: isPublic || false,
      createdBy: userId,
    });

    logger.info('[ReportBuilder] Template created', { templateId, userId });
    res.status(201).json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating template:', err);
    next(err);
  }
});

/**
 * R1 „Użyj wzorca" (raport) — SERVER-SIDE template resolution, 2026-07-26.
 *
 * Mirrors `POST /document-studio/templates/resolve`: the Template Library is
 * an INDEX (`v8_artifact_origin_links`), keyed by `templateArtifactId` (the
 * artifact-index row). The report-builder generator needs the CANONICAL
 * `report_builder_templates.id`. The client must never bridge that gap
 * itself — a canonical id arriving as a URL param would be an unvalidated
 * pointer straight into generation. This route performs the trusted
 * translation via `resolveDocumentTemplateForCreation` (same resolver
 * Document Studio uses — org access, scope, status and orphan checks, no
 * duplicated logic), then rejects anything that isn't a `report_template`:
 * a `document_template` hitting this route belongs to Document Studio, not
 * the legacy report-builder generator.
 *
 * Body: { templateArtifactId: string }
 * Returns 200: { template: { canonicalTemplateId, originRuntime, format,
 *                            scope, status, source, legacy, sectionCount } }
 * Errors: 400 templateArtifactId_required · 401 Unauthorized
 *         404 TEMPLATE_NOT_INDEXED | TEMPLATE_ORPHANED
 *         403 TEMPLATE_FORBIDDEN · 409 TEMPLATE_DEPRECATED
 *         422 TEMPLATE_FORMAT_UNSUPPORTED
 */
const REPORT_TEMPLATE_RESOLVE_STATUS: Record<TemplateResolveErrorCode, number> = {
  TEMPLATE_NOT_INDEXED: 404,
  TEMPLATE_ORPHANED: 404,
  TEMPLATE_FORBIDDEN: 403,
  TEMPLATE_DEPRECATED: 409,
  TEMPLATE_FORMAT_UNSUPPORTED: 422,
};

router.post('/templates/resolve', async (req: Request, res: Response) => {
  const { userId, organizationId } = getAuthContext(req);
  if (!userId || !organizationId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const templateArtifactId = String(req.body?.templateArtifactId || '').trim();
  if (!templateArtifactId) {
    res.status(400).json({ error: 'templateArtifactId_required' });
    return;
  }

  try {
    const resolved = await resolveDocumentTemplateForCreation(
      { kind: 'library', templateArtifactId },
      { organizationId }
    );

    // Same index can carry a document_template — that belongs to Document
    // Studio's own resolve route, not here. Reject rather than silently
    // handing report-builder a blueprint it didn't ask for.
    if (resolved.originRuntime !== 'report_template') {
      res.status(422).json({ error: 'TEMPLATE_FORMAT_UNSUPPORTED' });
      return;
    }

    res.json({
      template: {
        canonicalTemplateId: resolved.canonicalTemplateId,
        originRuntime: resolved.originRuntime,
        format: resolved.format,
        scope: resolved.scope,
        status: resolved.status,
        source: resolved.source,
        legacy: resolved.legacy,
        sectionCount: resolved.sectionBlueprint.length,
      },
    });
  } catch (err) {
    if (isTemplateResolveError(err)) {
      logger.info(
        `[ReportBuilder] template resolve rejected: ${err.code} (artifact ${templateArtifactId})`
      );
      res.status(REPORT_TEMPLATE_RESOLVE_STATUS[err.code]).json({ error: err.code });
      return;
    }
    logger.error('[ReportBuilder] template resolve failed', err);
    res.status(500).json({ error: 'TEMPLATE_RESOLVE_FAILED' });
  }
});

/**
 * GET /api/report-builder/templates/:templateId/details
 * Get template details by ID
 */
router.get(
  '/templates/:templateId/details',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateId = paramStr(req.params.templateId);
      const { organizationId } = getAuthContext(req);

      const template = await ReportBuilderService.getTemplateById(templateId, organizationId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Normalize: include parsed JSON fields for frontend convenience
      const sections =
        (template as any).sections_json && typeof (template as any).sections_json === 'string'
          ? JSON.parse((template as any).sections_json || '[]')
          : (template as any).sections || [];
      const defaultOptions =
        (template as any).default_options_json &&
        typeof (template as any).default_options_json === 'string'
          ? JSON.parse((template as any).default_options_json || 'null')
          : (template as any).defaultOptions || null;

      res.json({
        template: {
          ...template,
          sections,
          defaultOptions,
        },
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting template:', err);
      next(err);
    }
  }
);

/**
 * PUT /api/report-builder/templates/:templateId
 * Update a template
 */
router.put('/templates/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateId = paramStr(req.params.templateId);
    const { organizationId, userId } = getAuthContext(req);
    const { name, description, sections, defaultOptions, isPublic } = req.body;

    const template = await ReportBuilderService.updateTemplate(templateId, organizationId, {
      name,
      description,
      sections,
      defaultOptions,
      isPublic,
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not editable' });
    }

    logger.info('[ReportBuilder] Template updated', { templateId, userId });
    res.json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating template:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/templates/:templateId
 * Delete a template
 */
router.delete('/templates/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateId = paramStr(req.params.templateId);
    const { organizationId, userId } = getAuthContext(req);

    const deleted = await ReportBuilderService.deleteTemplate(templateId, organizationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }

    logger.info('[ReportBuilder] Template deleted', { templateId, userId });
    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error deleting template:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/templates/:templateId/duplicate
 * Duplicate a template
 */
router.post(
  '/templates/:templateId/duplicate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateId = paramStr(req.params.templateId);
      const { organizationId, userId } = getAuthContext(req);
      const { name } = req.body;

      const newTemplate = await ReportBuilderService.duplicateTemplate(
        templateId,
        organizationId,
        userId,
        name
      );

      if (!newTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }

      logger.info('[ReportBuilder] Template duplicated', {
        originalId: templateId,
        newId: newTemplate.id,
        userId,
      });
      res.status(201).json({ template: newTemplate });
    } catch (err) {
      logger.error('[ReportBuilder] Error duplicating template:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/templates/import
 * Import template from JSON
 */
router.post('/templates/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const { templateJson } = req.body;

    if (!templateJson) {
      return res.status(400).json({ error: 'templateJson is required' });
    }

    let templateData;
    try {
      templateData = typeof templateJson === 'string' ? JSON.parse(templateJson) : templateJson;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    const templateId = uuidv4();
    const template = await ReportBuilderService.createTemplate({
      id: templateId,
      organizationId,
      name: templateData.name || 'Imported Template',
      description: templateData.description,
      sourceType: templateData.sourceType || 'ASSESSMENT',
      reportType: templateData.reportType,
      sections: templateData.sections || [],
      defaultOptions: templateData.defaultOptions,
      isPublic: false,
      createdBy: userId,
    });

    logger.info('[ReportBuilder] Template imported', { templateId, userId });
    res.status(201).json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error importing template:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/templates/:templateId/export
 * Export template as JSON
 */
router.get(
  '/templates/:templateId/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateId = paramStr(req.params.templateId);
      const { organizationId } = getAuthContext(req);

      const template = await ReportBuilderService.getTemplateById(templateId, organizationId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const exportData = {
        name: template.name,
        description: template.description,
        sourceType: template.source_type,
        reportType: template.report_type,
        sections: JSON.parse(template.sections_json || '[]'),
        defaultOptions: template.default_options_json
          ? JSON.parse(template.default_options_json)
          : null,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${template.name.replace(/[^a-z0-9]/gi, '_')}.json"`
      );
      res.json(exportData);
    } catch (err) {
      logger.error('[ReportBuilder] Error exporting template:', err);
      next(err);
    }
  }
);

// ==========================================
// CANONICAL TEMPLATES (R1-R4)
// ==========================================

/**
 * GET /api/report-builder/templates/canonical/:reportType
 * Returns the canonical section template for R1/R2/R3/R4.
 */
router.get(
  '/templates/canonical/:reportType',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportType = String(req.params.reportType);
      const template = getCanonicalTemplate(reportType);

      if (!template) {
        return res
          .status(404)
          .json({ error: `No canonical template for report type "${reportType}"` });
      }

      res.json({ template });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting canonical template:', err);
      next(err);
    }
  }
);

// ==========================================
// TEMPLATE SOURCE TYPE ENDPOINT
// ==========================================

/**
 * GET /api/report-builder/templates/:sourceType
 * Get default template for source type
 */
router.get('/templates/:sourceType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceType = paramStr(req.params.sourceType);
    const { framework } = req.query;
    const { organizationId } = getAuthContext(req);

    const template = await ReportBuilderService.getTemplateForSource(
      sourceType.toUpperCase() as any,
      framework as string | undefined,
      organizationId
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting template:', err);
    next(err);
  }
});

// ==========================================
// BLOCK TYPES (Library)
// ==========================================

/**
 * GET /api/report-builder/block-types
 * List available block types (system + organization).
 */
router.get('/block-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const blocks = await ReportBuilderService.listBlockTypes(organizationId);
    res.json({ blocks });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing block types:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/block-types
 * Create a new block type for the organization.
 */
router.post('/block-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const {
      name,
      description,
      sourceTypes,
      renderKind,
      promptTemplate,
      inputSchema,
      defaultLength,
      defaultLanguage,
    } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!renderKind || typeof renderKind !== 'string') {
      return res.status(400).json({ error: 'renderKind is required' });
    }

    const created = await ReportBuilderService.createBlockType({
      organizationId,
      userId,
      name,
      description,
      sourceTypes: Array.isArray(sourceTypes) ? sourceTypes : undefined,
      renderKind,
      promptTemplate,
      inputSchema: inputSchema && typeof inputSchema === 'object' ? inputSchema : null,
      defaultLength,
      defaultLanguage,
    } as any);

    res.status(201).json({ block: created });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error creating block type:', err);
    res
      .status(500)
      .json(
        buildReportBuilderFailClosedError(
          req,
          500,
          'REPORT_BUILDER_BLOCK_TYPE_CREATE_FAILED',
          'Failed to create report block type.'
        )
      );
  }
});

/**
 * PUT /api/report-builder/block-types/:blockTypeId
 * Update an existing org block type.
 */
router.put('/block-types/:blockTypeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const blockTypeId = paramStr(req.params.blockTypeId);
    const patch = req.body || {};

    await ReportBuilderService.updateBlockType(blockTypeId, organizationId, userId, patch);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error updating block type:', err);
    const msg = err?.message || 'Failed to update block type';
    res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
  }
});

/**
 * DELETE /api/report-builder/block-types/:blockTypeId
 * Deactivate an org block type (soft delete).
 */
router.delete(
  '/block-types/:blockTypeId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, userId } = getAuthContext(req);
      const blockTypeId = paramStr(req.params.blockTypeId);
      await ReportBuilderService.deactivateBlockType(blockTypeId, organizationId, userId);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error deactivating block type:', err);
      const msg = err?.message || 'Failed to deactivate block type';
      res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
    }
  }
);

// ==========================================
// PATH C: UPLOAD CHAOS -> KNOWLEDGE MAP
// ==========================================

const chaosUploadStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const orgId = ((_req as any)?.user?.organizationId || 'unknown') as string;
    const dir = uploadsDir('chaos', orgId);
    cb(null, dir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${uniqueSuffix}-${basename}${ext}`);
  },
});

const chaosUpload = multer({
  storage: chaosUploadStorage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    const allowedExts = /\.(pdf|docx|xlsx|csv)$/i;
    const allowedMimes = /pdf|spreadsheet|document|msword|csv|comma-separated/i;
    if (allowedExts.test(file.originalname) || allowedMimes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, XLSX, and CSV files are allowed'));
    }
  },
});

/**
 * POST /api/report-builder/upload-chaos
 * Accept multipart file uploads for Path C, store and return file IDs.
 */
router.post(
  '/upload-chaos',
  // Support both "files" (multi) and legacy "file" (single) field names.
  chaosUpload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'file', maxCount: 1 },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, organizationId } = getAuthContext(req);
      const incoming = (req as any).files as
        | Express.Multer.File[]
        | Record<string, Express.Multer.File[]>
        | undefined;
      const files: Express.Multer.File[] = Array.isArray(incoming)
        ? incoming
        : [...(incoming?.files || []), ...(incoming?.file || [])];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      logger.info('[ReportBuilder] Upload chaos – received files', {
        count: files.length,
        userId,
        organizationId,
      });

      const reportType = String(
        (req.body?.reportType || req.body?.report_type || 'OTHER') as string
      )
        .toUpperCase()
        .trim();
      const title = String((req.body?.title || '') as string).trim();
      const consultantName = String(
        (req.body?.consultantName || req.body?.consultant_name || '') as string
      ).trim();
      const reportDate = String(
        (req.body?.reportDate || req.body?.report_date || '') as string
      ).trim();
      const projectId = req.body?.projectId ? String(req.body.projectId) : null;
      const tagsRaw = String((req.body?.tags || '') as string).trim();
      const tags = tagsRaw
        ? tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const fileIds: string[] = [];

      for (const file of files) {
        const fileId = uuidv4();
        await dbRun(
          `INSERT INTO generic_assessment_reports (
            id, organization_id, project_id,
            title, report_type, consultant_name, report_date,
            tags_json,
            file_path, file_name, file_size,
            original_name, mime_type, file_type,
            upload_status, processing_status,
            uploaded_by, uploaded_at,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?,
            ?,
            ?, ?, ?,
            ?, ?, ?,
            'done', 'uploaded',
            ?, datetime('now'),
            datetime('now'), datetime('now')
          )`,
          [
            fileId,
            organizationId,
            projectId,
            title || file.originalname,
            reportType || 'OTHER',
            consultantName || null,
            reportDate || null,
            JSON.stringify(tags),
            file.path,
            file.filename || file.originalname,
            file.size,
            file.originalname,
            file.mimetype,
            file.mimetype,
            userId,
          ]
        );
        fileIds.push(fileId);
      }

      res.json({
        fileIds,
        files: files.map((f, i) => ({
          id: fileIds[i],
          name: f.originalname,
          size: f.size,
          mimeType: f.mimetype,
        })),
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error in upload-chaos:', err);
      next(err);
    }
  }
);

/**
 * GET /api/report-builder/upload-chaos
 * List uploaded Path C files for the organization (best-effort workspace).
 */
router.get('/upload-chaos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { search, type } = req.query;

    let sql = `
      SELECT id, title, report_type, consultant_name, report_date,
             file_name, file_size, mime_type, upload_status, processing_status,
             tags_json, uploaded_at
      FROM generic_assessment_reports
      WHERE organization_id = ?
    `;
    const params: any[] = [organizationId];

    if (search && typeof search === 'string' && search.trim()) {
      sql += ` AND (title LIKE ? OR consultant_name LIKE ? OR ai_summary LIKE ? OR ocr_text LIKE ?)`;
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }

    if (type && typeof type === 'string' && type !== 'ALL') {
      sql += ` AND report_type = ?`;
      params.push(type.toUpperCase());
    }

    sql += ` ORDER BY COALESCE(uploaded_at, created_at) DESC LIMIT 100`;

    const rows = await dbAll<any>(sql, params);
    const reports = (rows || []).map((r: any) => ({
      id: r.id,
      title: r.title || r.file_name || 'Report',
      report_type: r.report_type || 'OTHER',
      consultant_name: r.consultant_name || null,
      report_date: r.report_date || null,
      file_name: r.file_name || '',
      file_size: Number(r.file_size || 0),
      processing_status: r.processing_status || r.upload_status || 'uploaded',
      ai_summary: r.ai_summary || null,
      tags_json: (() => {
        try {
          return JSON.parse(r.tags_json || '[]');
        } catch {
          return [];
        }
      })(),
      uploaded_at: r.uploaded_at || null,
    }));

    res.json({ reports });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing upload-chaos files:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/upload-chaos/:id
 * Delete uploaded Path C file record (best-effort deletes file from disk).
 */
router.delete('/upload-chaos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const id = paramStr(req.params.id);

    const row = await dbGet<any>(
      `SELECT file_path FROM generic_assessment_reports WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    if (!row) return res.status(404).json({ error: 'File not found' });

    await dbRun(`DELETE FROM generic_assessment_reports WHERE id = ? AND organization_id = ?`, [
      id,
      organizationId,
    ]);

    const fp = String(row.file_path || '');
    if (fp) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        // best-effort cleanup
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error deleting upload-chaos file:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/knowledge-map
 * Build a knowledge map from previously uploaded file IDs.
 */
router.post('/knowledge-map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { fileIds } = req.body;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'fileIds array is required' });
    }

    const knowledgeMap = await buildKnowledgeMap(organizationId, fileIds);
    res.json(knowledgeMap);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error building knowledge map:', err);
    const msg = err?.message || 'Failed to build knowledge map';
    res
      .status(msg.includes('not found') || msg.includes('No file') ? 404 : 500)
      .json({ error: msg });
  }
});

// ==========================================
// REPORT CRUD ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder
 * Create new report from source
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = getAuthContext(req);
    const { sourceType, sourceId, sourceName, title, description, templateId, config } = req.body;

    if (!sourceType || !sourceId || !title) {
      return res.status(400).json({ error: 'sourceType, sourceId, and title are required' });
    }

    const result = await ReportBuilderService.createReport({
      organizationId,
      sourceType: sourceType.toUpperCase(),
      sourceId,
      sourceName,
      title,
      description,
      config:
        config && typeof config === 'object' ? (config as Record<string, unknown>) : undefined,
      createdBy: userId,
      templateId,
    });

    logger.info('[ReportBuilder] Report created', { reportId: result.report.id, userId });

    // Projection into Assessment module list (so the report appears in Assessment → Reports tab)
    // Best-effort and non-blocking.
    try {
      if (String(result.report.sourceType || '').toUpperCase() === 'ASSESSMENT') {
        await upsertAssessmentReportForBuilder({
          organizationId,
          assessmentId: String(result.report.sourceId),
          projectId: result.report.projectId ? String(result.report.projectId) : null,
          builderReportId: String(result.report.id),
          name: String(result.report.title || title || 'Report'),
          templateId: result.report.templateId
            ? String(result.report.templateId)
            : templateId || null,
          rbStatus: String(result.report.status || 'CONFIGURING'),
          userId,
        });
      }
    } catch (syncErr: any) {
      logger.warn('[ReportBuilder] Failed to project report into assessment_reports', {
        reportId: result.report.id,
        message: syncErr?.message,
      });
    }

    res.status(201).json(result);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error creating report:', err);
    const message = String(err?.message || '');
    if (
      message.includes('not found') ||
      message.includes('not approved') ||
      message.includes('mismatch') ||
      message.includes('No template found') ||
      message.includes('template_not_found')
    ) {
      return res.status(400).json({ error: message });
    }
    next(err);
  }
});

/**
 * GET /api/report-builder
 * List reports for organization
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { status, statusIn, sourceType, sourceId, search, archived, includeArchived } = req.query;

    // Parse statusIn if provided as comma-separated string
    let statusInArray: string[] | undefined;
    if (statusIn && typeof statusIn === 'string') {
      statusInArray = statusIn.split(',').map((s) => s.trim().toUpperCase());
    }

    const reports = await ReportBuilderService.listReports(organizationId, {
      status: status as any,
      statusIn: statusInArray as any,
      sourceType: sourceType as any,
      sourceId: sourceId as string,
      search: search as string,
      // ?archived=true -> only archived reports; default (unset) -> only active reports.
      archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
      // ?includeArchived=true -> both active and archived, overrides the `archived` default filter.
      includeArchived: includeArchived === 'true',
    });

    res.json({ reports, total: reports.length });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing reports:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/backlinks/:artifactType/:artifactId
 * Find all reports that reference a given artifact
 */
router.get(
  '/backlinks/:artifactType/:artifactId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = getAuthContext(req);
      const artifactType = paramStr(req.params.artifactType);
      const artifactId = paramStr(req.params.artifactId);

      if (!artifactType || !artifactId) {
        return res.status(400).json({ error: 'artifactType and artifactId are required' });
      }

      const reports = await dbAll(
        `SELECT id, title, status, source_type, created_at, updated_at, source_refs_json
         FROM report_builder_reports
         WHERE organization_id = ?
           AND source_refs_json LIKE ?
         ORDER BY updated_at DESC
         LIMIT 50`,
        [organizationId, `%"artifact_id":"${artifactId}"%`]
      );

      const sectionRefs = await dbAll(
        `SELECT s.report_id, s.section_key, s.title AS section_title, s.source_refs_json
         FROM report_builder_sections s
         JOIN report_builder_reports r ON s.report_id = r.id
         WHERE r.organization_id = ?
           AND s.source_refs_json LIKE ?
         LIMIT 100`,
        [organizationId, `%"artifact_id":"${artifactId}"%`]
      );

      const reportIds = new Set(reports.map((r: any) => r.id));
      for (const sec of sectionRefs) {
        if (!reportIds.has(sec.report_id)) {
          reportIds.add(sec.report_id);
        }
      }

      const results = reports.map((r: any) => ({
        reportId: r.id,
        title: r.title,
        status: r.status,
        sourceType: r.source_type,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        sections: sectionRefs
          .filter((s: any) => s.report_id === r.id)
          .map((s: any) => ({ sectionKey: s.section_key, sectionTitle: s.section_title })),
      }));

      res.json({ artifactType, artifactId, reports: results, total: results.length });
    } catch (err) {
      logger.error('[ReportBuilder] Error finding backlinks:', err);
      next(err);
    }
  }
);

// ==========================================
// BRAND VOICE PROFILE ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/brand-voice
 * Returns org's brand voice profile (creates default if none exists)
 */
router.get('/brand-voice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const profile = await getOrCreateBrandVoice(organizationId);
    res.json({ profile });
  } catch (err) {
    logger.error('[ReportBuilder] Error fetching brand voice profile:', err);
    next(err);
  }
});

/**
 * PUT /api/report-builder/brand-voice
 * Updates org's brand voice profile
 */
router.put('/brand-voice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const updates = req.body || {};
    const profile = await updateBrandVoice(organizationId, updates);
    res.json({ profile });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating brand voice profile:', err);
    next(err);
  }
});

// ==========================================
// REPORT SESSIONS (Dynamic Menu)
// ==========================================

/**
 * GET /api/report-builder/sessions
 * List open report sessions (dynamic menu). Max 6.
 */
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = getAuthContext(req);
    const sessions = await ReportBuilderService.listOpenSessions(organizationId, userId);
    res.json({ sessions });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing sessions:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/session/open
 * Open a report in the dynamic menu (upsert). Enforces max 6.
 */
router.post('/:id/session/open', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { navigationState } = req.body || {};

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const session = await ReportBuilderService.openSession({
      organizationId,
      userId,
      reportId: id,
      navigationState:
        navigationState && typeof navigationState === 'object' ? navigationState : null,
    });

    res.json({ session });
  } catch (err) {
    logger.error('[ReportBuilder] Error opening session:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/session/close
 * Close a report from the dynamic menu.
 */
router.post('/:id/session/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const success = await ReportBuilderService.closeSession({
      organizationId,
      userId,
      reportId: id,
    });

    res.json({ success });
  } catch (err) {
    logger.error('[ReportBuilder] Error closing session:', err);
    next(err);
  }
});

// ==========================================
// REPORT CRUD ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/:id
 * Get report with sections
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    const result = await ReportBuilderService.getReport(id, organizationId);

    if (!result) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result);
  } catch (err) {
    logger.error('[ReportBuilder] Error getting report:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/:id
 * Delete report
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only allow deletion of DRAFT reports
    if (
      report.report.status !== 'CONFIGURING' &&
      report.report.status !== 'DRAFT' &&
      report.report.status !== 'GENERATED'
    ) {
      return res
        .status(400)
        .json({ error: 'Only configuring, draft, or generated reports can be deleted' });
    }

    // Delete (cascade will handle sections)
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM report_builder_reports WHERE id = ?', [id], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info('[ReportBuilder] Report deleted', { reportId: id });

    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error deleting report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/archive
 * Archive a report (#68e). Orthogonal to `status` — workflow status is preserved so
 * unarchive restores the report exactly where it left off. Archived reports are hidden
 * from the default GET / list.
 */
router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const result = await ReportBuilderService.archiveReport(id, organizationId, userId);
    if (!result) {
      return res.status(404).json({ error: 'Report not found' });
    }

    logger.info('[ReportBuilder] Report archived', { reportId: id, userId });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[ReportBuilder] Error archiving report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/unarchive
 * Restore an archived report to default-list visibility (#68e).
 */
router.post('/:id/unarchive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const result = await ReportBuilderService.unarchiveReport(id, organizationId, userId);
    if (!result) {
      return res.status(404).json({ error: 'Report not found' });
    }

    logger.info('[ReportBuilder] Report unarchived', { reportId: id, userId });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[ReportBuilder] Error unarchiving report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/duplicate
 * Duplicate report
 */
router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { title } = req.body;

    const result = await ReportBuilderService.duplicateReport(id, organizationId, userId, title);

    logger.info('[ReportBuilder] Report duplicated', {
      originalId: id,
      newId: result.report.id,
    });

    res.status(201).json(result);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error duplicating report:', err);
    if (err.message === 'Report not found') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// ==========================================
// REPORT METADATA
// ==========================================

/**
 * PATCH /api/report-builder/:id/metadata
 * Update report title, description without changing status.
 */
router.patch('/:id/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { title, description } = req.body;

    if (!title && description === undefined) {
      return res.status(400).json({ error: 'At least one of title or description is required' });
    }

    const existing = await ReportBuilderService.getReport(id, organizationId);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await ReportBuilderService.updateReportMetadata(id, organizationId, userId, {
      title: title || undefined,
      description: description !== undefined ? description : undefined,
    });

    const refreshed = await ReportBuilderService.getReport(id, organizationId);

    try {
      if (refreshed?.report) {
        await syncArtifactRegistryForReport(refreshed.report, organizationId, userId);
      }
    } catch (artifactErr: any) {
      logger.warn('[ReportBuilder] Failed to sync shared artifact registry on metadata update', {
        reportId: id,
        message: artifactErr?.message,
      });
    }

    logger.info('[ReportBuilder] Report metadata updated', { reportId: id, title, userId });
    res.json({ report: refreshed?.report });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating report metadata:', err);
    next(err);
  }
});

// ==========================================
// SECTION CONFIGURATION ENDPOINTS
// ==========================================

/**
 * PUT /api/report-builder/:id/intent
 * Update report-level intent/config (no generation happens here).
 */
router.put('/:id/intent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { config } = req.body;

    // Verify report exists and belongs to org
    const existing = await ReportBuilderService.getReport(id, organizationId);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await ReportBuilderService.updateReportConfig(
      id,
      organizationId,
      config && typeof config === 'object' ? (config as Record<string, unknown>) : null,
      userId
    );

    const refreshed = await ReportBuilderService.getReport(id, organizationId);
    res.json({ success: true, report: refreshed?.report });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating intent/config:', err);
    next(err);
  }
});

/**
 * PUT /api/report-builder/:id/config
 * Update section configuration (enable/disable, order, options)
 */
router.put('/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections array is required' });
    }

    // Verify report exists and belongs to org
    const existing = await ReportBuilderService.getReport(id, organizationId);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updatedSections = await ReportBuilderService.updateSectionConfig(id, sections);

    // If outline/config has been touched, move CONFIGURING -> DRAFT automatically
    if (existing.report.status === 'CONFIGURING') {
      await ReportBuilderService.updateReportStatus(id, 'DRAFT', userId);
    }

    logger.info('[ReportBuilder] Section config updated', {
      reportId: id,
      sectionsUpdated: sections.length,
    });

    const refreshed = await ReportBuilderService.getReport(id, organizationId);
    res.json({ sections: updatedSections, report: refreshed?.report });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating section config:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/sections
 * Add custom section
 */
router.post('/:id/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);
    const {
      title,
      sectionType,
      afterSectionKey,
      length,
      language,
      blockTypeId,
      blockConfig,
      renderKind,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    // SEC (M17 wave-5): verify the report belongs to the caller's org before
    // mutating its sections — addCustomSection is keyed on report_id only, so an
    // unscoped call would let org A insert sections into org B's report.
    const owned = await ReportBuilderService.getReport(id, organizationId);
    if (!owned) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const section = await ReportBuilderService.addCustomSection(id, {
      title,
      sectionType,
      afterSectionKey,
      length,
      language,
      blockTypeId,
      blockConfig,
      renderKind,
    });

    logger.info('[ReportBuilder] Custom section added', {
      reportId: id,
      sectionKey: section.sectionKey,
    });

    res.status(201).json({ section });
  } catch (err) {
    logger.error('[ReportBuilder] Error adding custom section:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/:id/sections/:sectionKey
 * Remove section
 */
router.delete(
  '/:id/sections/:sectionKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { organizationId } = getAuthContext(req);

      // SEC (M17 wave-5): verify report ownership before deleting a section —
      // removeSection is keyed on report_id only, so an unscoped call would let
      // org A delete sections from org B's report.
      const owned = await ReportBuilderService.getReport(id, organizationId);
      if (!owned) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const success = await ReportBuilderService.removeSection(id, sectionKey);

      if (!success) {
        return res.status(404).json({ error: 'Section not found' });
      }

      logger.info('[ReportBuilder] Section removed', { reportId: id, sectionKey });

      res.json({ success: true });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error removing section:', err);
      if (err.message?.includes('Cannot remove required')) {
        return res.status(400).json({ error: 'Cannot remove a required section' });
      }
      next(err);
    }
  }
);

/**
 * PUT /api/report-builder/:id/sections/:sectionKey/content
 * Update section content (user edit)
 * Auto-revert: If report is IN_REVIEW, editing content automatically reverts status to GENERATED
 */
router.put(
  '/:id/sections/:sectionKey/content',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { userId, organizationId } = getAuthContext(req);
      const { content, contentFormat } = req.body;

      if (content === undefined) {
        return res.status(400).json({ error: 'content is required' });
      }

      // Check current status for auto-revert logic
      const reportData = await ReportBuilderService.getReport(id, organizationId);
      if (!reportData) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const previousStatus = reportData.report.status;
      let statusReverted = false;

      // AUTO-REVERT: Editing content in IN_REVIEW automatically reverts to GENERATED
      if (previousStatus === 'IN_REVIEW') {
        await ReportBuilderService.updateReportStatus(id, 'GENERATED', userId);
        statusReverted = true;
        logger.info('[ReportBuilder] Review invalidated - content edited, reverting to GENERATED', {
          reportId: id,
          sectionKey,
          previousStatus,
          userId,
        });
      }

      await ReportBuilderService.updateSectionContent(
        id,
        sectionKey,
        content,
        userId,
        contentFormat || 'markdown'
      );

      logger.info('[ReportBuilder] Section content updated', { reportId: id, sectionKey });

      res.json({
        success: true,
        statusReverted,
        previousStatus: statusReverted ? previousStatus : undefined,
        currentStatus: statusReverted ? 'GENERATED' : previousStatus,
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error updating section content:', err);
      next(err);
    }
  }
);

// ==========================================
// GENERATION ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/generate
 * Generate all sections
 */
router.post('/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { regenerateAll } = req.body;

    const result = await ReportGenerationService.generateFullReport(id, organizationId, userId, {
      regenerateAll,
    });

    logger.info('[ReportBuilder] Report generated', {
      reportId: id,
      totalTokens: result.totalTokens,
      sectionsGenerated: result.generatedSections.length,
    });

    // Get updated report
    const report = await ReportBuilderService.getReport(id, organizationId);

    res.json({
      success: true,
      ...result,
      report: report?.report,
      sections: report?.sections,
    });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error generating report:', err);
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: 'Report not found' });
    }
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/generate-section/:sectionKey
 * Generate or regenerate a single section
 */
router.post(
  '/:id/generate-section/:sectionKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { userId, organizationId } = getAuthContext(req);
      const { customPrompt } = req.body;

      const result = await ReportGenerationService.regenerateSection(
        id,
        sectionKey,
        organizationId,
        userId,
        customPrompt
      );

      logger.info('[ReportBuilder] Section generated', {
        reportId: id,
        sectionKey,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        content: result.content,
        tokensUsed: result.tokensUsed,
      });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error generating section:', err);
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: 'Section not found' });
      }
      next(err);
    }
  }
);

// ==========================================
// WORKFLOW ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/finalize
 * Finalize report (move to IN_REVIEW)
 */
router.post('/:id/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { reviewers, message } = req.body || {};

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'GENERATED') {
      return res.status(400).json({ error: 'Report must be generated before finalizing' });
    }

    // Check all enabled sections have content
    const missingContent = report.sections.filter(
      (s) => s.enabled && !s.generatedContent && !s.editedContent
    );

    if (missingContent.length > 0) {
      return res.status(400).json({
        error: 'All enabled sections must have content',
        missingSections: missingContent.map((s) => s.sectionKey),
      });
    }

    const previousStatus = report.report.status;
    await ReportBuilderService.updateReportStatus(id, 'IN_REVIEW', userId);

    // Auto-version: snapshot before review
    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      previousStatus,
      'IN_REVIEW',
      `Sent for review${message ? `: ${message}` : ''}`
    );

    // Notify reviewers
    const reviewerIds = Array.isArray(reviewers) ? reviewers : [];
    if (reviewerIds.length > 0) {
      const reportTitle = report.report.title || 'Report';
      await notifyOnStatusChange(
        id,
        organizationId,
        userId,
        reviewerIds,
        'report_review_requested',
        'Review requested',
        `You have been asked to review "${reportTitle}"${message ? `. Message: ${message}` : ''}`,
        reportTitle
      );
    }

    logger.info('[ReportBuilder] Report finalized', { reportId: id, reviewers: reviewerIds });

    res.json({ success: true, status: 'IN_REVIEW' });
  } catch (err) {
    logger.error('[ReportBuilder] Error finalizing report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/approve
 * Approve report
 * Gate: Cannot approve if there are open comments
 */
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'Report must be in review to approve' });
    }

    // GATE CHECK: No open comments allowed
    const approvalCheck = await ReportBuilderCommentsService.canApproveReport(id);
    if (!approvalCheck.canApprove) {
      logger.warn('[ReportBuilder] Approval blocked - open comments', {
        reportId: id,
        openCount: approvalCheck.openCount,
      });
      return res.status(400).json({
        error: 'Cannot approve report with open comments',
        openCommentsCount: approvalCheck.openCount,
        blockers: approvalCheck.blockers,
      });
    }

    const previousStatus = report.report.status;
    await ReportBuilderService.updateReportStatus(id, 'APPROVED', userId);

    // Auto-version: approved version snapshot (immutable reference)
    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      previousStatus,
      'APPROVED',
      'Report approved — approved version snapshot'
    );

    // Notify report author
    const authorId = report.report.createdBy || (report.report as any).created_by;
    if (authorId) {
      await notifyOnStatusChange(
        id,
        organizationId,
        userId,
        [authorId],
        'report_approved',
        'Report approved',
        `Your report "${report.report.title || 'Report'}" has been approved.`,
        report.report.title
      );
    }

    // Auto-sync: mark APPROVE_REPORT gate as APPROVED in assessment workflow (when sourced from assessment)
    if (
      String(report.report.sourceType || '').toUpperCase() === 'ASSESSMENT' &&
      report.report.sourceId
    ) {
      const assessmentId = String(report.report.sourceId);
      try {
        const { getDatabase } = await import('../database/index.js');
        const db = getDatabase();

        await new Promise<void>((resolve, reject) => {
          db.run(
            `UPDATE assessments
             SET report_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND organization_id = ?`,
            [assessmentId, String(organizationId)],
            (err: Error | null) => (err ? reject(err) : resolve())
          );
        });

        // Best-effort: gate table may not exist in all environments
        await new Promise<void>((resolve) => {
          db.run(
            `UPDATE assessment_gate_decisions
             SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP
             WHERE assessment_id = ? AND gate_type = 'APPROVE_REPORT'`,
            [String(userId), assessmentId],
            () => resolve()
          );
        });

        await new Promise<void>((resolve) => {
          db.run(
            `UPDATE assessment_gate_decisions
             SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP
             WHERE assessment_id = ? AND gate_type = 'GENERATE_REPORT' AND status != 'APPROVED'`,
            [String(userId), assessmentId],
            () => resolve()
          );
        });

        logger.info('[ReportBuilder] Auto-synced APPROVE_REPORT gate for assessment', {
          assessmentId,
          reportId: id,
        });
      } catch (syncErr: any) {
        logger.warn('[ReportBuilder] Gate sync failed for assessment report approval', {
          assessmentId,
          reportId: id,
          message: syncErr?.message,
        });
      }
    }

    logger.info('[ReportBuilder] Report approved', { reportId: id });

    res.json({ success: true, status: 'APPROVED' });
  } catch (err) {
    logger.error('[ReportBuilder] Error approving report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/send-back
 * Send report back to draft status for re-editing
 */
router.post('/:id/send-back', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'Report must be in review to send back' });
    }

    const previousStatus = report.report.status;
    await ReportBuilderService.updateReportStatus(id, 'DRAFT', userId);

    // Auto-version before reverting
    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      previousStatus,
      'DRAFT',
      'Sent back for revision'
    );

    // Notify author
    const authorId = report.report.createdBy || (report.report as any).created_by;
    if (authorId) {
      await notifyOnStatusChange(
        id,
        organizationId,
        userId,
        [authorId],
        'report_sent_back',
        'Report sent back',
        `Your report "${report.report.title || 'Report'}" was sent back for revision.`,
        report.report.title
      );
    }

    logger.info('[ReportBuilder] Report sent back to draft', { reportId: id });

    res.json({ success: true, status: 'DRAFT' });
  } catch (err) {
    logger.error('[ReportBuilder] Error sending report back:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/reject
 * Reject report with comments (IN_REVIEW/APPROVED -> DRAFT)
 */
router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { reason, comments } = req.body || {};

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const status = report.report.status;
    if (status !== 'IN_REVIEW' && status !== 'APPROVED') {
      return res.status(400).json({ error: 'Report must be IN_REVIEW or APPROVED to reject' });
    }

    await ReportBuilderService.updateReportStatus(id, 'DRAFT', userId);

    // Auto-version before rejection
    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      status,
      'DRAFT',
      `Rejected${reason ? `: ${reason}` : ''}`
    );

    // Notify author
    const authorId = report.report.createdBy || (report.report as any).created_by;
    if (authorId) {
      await notifyOnStatusChange(
        id,
        organizationId,
        userId,
        [authorId],
        'report_rejected',
        'Report rejected',
        `Your report "${report.report.title || 'Report'}" was rejected.${reason ? ` Reason: ${reason}` : ''}`,
        report.report.title
      );
    }

    logger.info('[ReportBuilder] Report rejected', {
      reportId: id,
      userId,
      reason: reason || comments || '',
    });

    res.json({ success: true, status: 'DRAFT', reason: reason || comments || '' });
  } catch (err) {
    logger.error('[ReportBuilder] Error rejecting report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/utilize
 * Mark report as utilized (APPROVED/SENT_EXTERNAL -> UTILIZED)
 */
router.post('/:id/utilize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { notes } = req.body || {};

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const status = report.report.status;
    if (status !== 'APPROVED' && status !== 'SENT_INTERNAL' && status !== 'SENT_EXTERNAL') {
      return res.status(400).json({ error: 'Report must be APPROVED or SENT to utilize' });
    }

    await ReportBuilderService.updateReportStatus(id, 'UTILIZED', userId);

    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      status,
      'UTILIZED',
      `Report utilized${notes ? `: ${notes}` : ''}`
    );

    logger.info('[ReportBuilder] Report utilized', { reportId: id, userId, notes });

    res.json({ success: true, status: 'UTILIZED' });
  } catch (err) {
    logger.error('[ReportBuilder] Error utilizing report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/mark-sent-internal
 * Mark approved report as sent internally
 */
router.post('/:id/mark-sent-internal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Report must be approved to mark as sent internally' });
    }

    await ReportBuilderService.updateReportStatus(id, 'SENT_INTERNAL', userId);

    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      'APPROVED',
      'SENT_INTERNAL',
      'Sent internally'
    );

    logger.info('[ReportBuilder] Report marked as sent internally', { reportId: id, userId });

    res.json({ success: true, status: 'SENT_INTERNAL' });
  } catch (err) {
    logger.error('[ReportBuilder] Error marking report as sent internally:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/mark-sent-external
 * Mark report as sent externally (after sent internally)
 */
router.post('/:id/mark-sent-external', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'SENT_INTERNAL') {
      return res.status(400).json({ error: 'Report must be marked as sent internally first' });
    }

    await ReportBuilderService.updateReportStatus(id, 'SENT_EXTERNAL', userId);

    await createAutoVersionOnStatusChange(
      id,
      organizationId,
      userId,
      'SENT_INTERNAL',
      'SENT_EXTERNAL',
      'Sent to client'
    );

    logger.info('[ReportBuilder] Report marked as sent externally', { reportId: id, userId });

    res.json({ success: true, status: 'SENT_EXTERNAL' });
  } catch (err) {
    logger.error('[ReportBuilder] Error marking report as sent externally:', err);
    next(err);
  }
});

// ==========================================
// SOURCE DATA ENDPOINT
// ==========================================

/**
 * GET /api/report-builder/:id/source-data
 * Get source data for report (for preview/reference)
 */
router.get('/:id/source-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    const sourceData = await ReportBuilderService.getSourceDataForReport(id, organizationId);

    if (!sourceData) {
      return res.status(404).json({ error: 'Source data not found' });
    }

    res.json(sourceData);
  } catch (err) {
    logger.error('[ReportBuilder] Error getting source data:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/source-refs
 * Returns all source_refs for a report (from report + aggregated from sections)
 */
router.get('/:id/source-refs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    const report = await dbGet<{ source_refs_json: string }>(
      `SELECT source_refs_json FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportRefs: Array<{ artifact_id: string; artifact_type: string; artifact_name: string }> =
      report.source_refs_json ? JSON.parse(report.source_refs_json) : [];

    const sectionRows = await dbAll(
      `SELECT section_key, title, source_refs_json
       FROM report_builder_sections
       WHERE report_id = ? AND source_refs_json IS NOT NULL`,
      [id]
    );

    const sectionRefMap: Record<string, Array<{ sectionKey: string; sectionTitle: string }>> = {};
    for (const sec of sectionRows) {
      const secRefs: Array<{ artifact_id: string }> = sec.source_refs_json
        ? JSON.parse(sec.source_refs_json)
        : [];
      for (const ref of secRefs) {
        if (!sectionRefMap[ref.artifact_id]) sectionRefMap[ref.artifact_id] = [];
        sectionRefMap[ref.artifact_id].push({
          sectionKey: sec.section_key,
          sectionTitle: sec.title,
        });
      }
    }

    const mergedIds = new Set<string>();
    const allRefs: Array<{
      artifact_id: string;
      artifact_type: string;
      artifact_name: string;
      usedInSections: Array<{ sectionKey: string; sectionTitle: string }>;
    }> = [];

    for (const ref of reportRefs) {
      mergedIds.add(ref.artifact_id);
      allRefs.push({
        ...ref,
        usedInSections: sectionRefMap[ref.artifact_id] || [],
      });
    }

    for (const sec of sectionRows) {
      const secRefs: Array<{ artifact_id: string; artifact_type: string; artifact_name: string }> =
        sec.source_refs_json ? JSON.parse(sec.source_refs_json) : [];
      for (const ref of secRefs) {
        if (!mergedIds.has(ref.artifact_id)) {
          mergedIds.add(ref.artifact_id);
          allRefs.push({
            ...ref,
            usedInSections: sectionRefMap[ref.artifact_id] || [],
          });
        }
      }
    }

    res.json({ reportId: id, sourceRefs: allRefs, total: allRefs.length });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting source refs:', err);
    next(err);
  }
});

// ==========================================
// PDF EXPORT ENDPOINTS
// ==========================================

const ensureExportDir = async (): Promise<string> => {
  return exportsDir('report-builder');
};

interface AssessmentMatrixData {
  type: 'assessment_matrix';
  scaleMax: number;
  axes: Array<{
    axisId: string;
    axisName: string;
    score: number;
    maxScore: number;
    gap?: number;
  }>;
}

/**
 * Write PDF for report builder report
 */
const writeReportBuilderPdf = async (
  report: any,
  sections: any[],
  filePath: string
): Promise<void> => {
  // bufferPages enables adding page numbers after content generation
  const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const drawHeaderFooter = (pageNumber: number, totalPages: number) => {
    const title = String(report.title || report.name || 'Report');
    const org = report.organizationName ? String(report.organizationName) : '';

    // Header
    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text(org ? `${org} • ${title}` : title, 48, 22, { align: 'left' });
    doc
      .moveTo(48, 36)
      .lineTo(doc.page.width - 48, 36)
      .lineWidth(0.5)
      .strokeColor('#e2e8f0')
      .stroke();

    // Footer
    const footerY = doc.page.height - 34;
    doc
      .moveTo(48, footerY - 6)
      .lineTo(doc.page.width - 48, footerY - 6)
      .lineWidth(0.5)
      .strokeColor('#e2e8f0')
      .stroke();

    doc.fontSize(8).fillColor('#94a3b8').text('Confidential', 48, footerY, { align: 'left' });
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`${pageNumber} / ${totalPages}`, 48, footerY, { align: 'right' });
  };

  // Title page
  doc
    .fontSize(24)
    .fillColor('#1e293b')
    .text(report.title || 'Report', { align: 'center' });
  doc.moveDown(0.5);

  if (report.sourceName) {
    doc.fontSize(12).fillColor('#64748b').text(`Source: ${report.sourceName}`, { align: 'center' });
  }
  doc.fontSize(10).fillColor('#94a3b8').text(`Generated: ${new Date().toLocaleDateString()}`, {
    align: 'center',
  });
  doc.moveDown(2);
  doc.addPage();

  // Sections
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  for (const section of enabledSections) {
    const content = section.editedContent || section.generatedContent || '';
    if (!content) continue;

    // Section title
    doc.fontSize(16).fillColor('#0f172a').text(section.title);
    doc.moveDown(0.3);

    // Check if it's a matrix section
    const isMatrix = section.sectionType === 'matrix' || section.renderKind === 'matrix';
    if (isMatrix) {
      try {
        const matrixData = JSON.parse(content) as AssessmentMatrixData;
        if (matrixData.type === 'assessment_matrix' && matrixData.axes) {
          // Render matrix as table
          doc.fontSize(10).fillColor('#64748b').text('Assessment Matrix', { underline: true });
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const colWidth = 80;
          const rowHeight = 20;
          const startX = 48;

          // Header
          doc.fontSize(9).fillColor('#475569');
          doc.text('Axis', startX, tableTop);
          doc.text('Score', startX + 200, tableTop);
          doc.text('Max', startX + 260, tableTop);

          let currentY = tableTop + rowHeight;

          for (const axis of matrixData.axes) {
            doc.fontSize(9).fillColor('#1e293b');
            doc.text(axis.axisName || axis.axisId, startX, currentY, { width: 190 });
            doc.text(axis.score?.toFixed(1) || '—', startX + 200, currentY);
            doc.text(String(axis.maxScore || matrixData.scaleMax), startX + 260, currentY);
            currentY += rowHeight;

            // Page break if needed
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              currentY = 48;
            }
          }

          doc.y = currentY + 10;
        }
      } catch {
        // If parsing fails, render as text
        doc.fontSize(11).fillColor('#334155').text(content);
      }
    } else {
      // Regular markdown content - render as plain text (simplified)
      const plainText = content
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1') // Remove code
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
        .replace(/^[-*]\s/gm, '• '); // Convert lists

      doc.fontSize(11).fillColor('#334155').text(plainText, {
        align: 'justify',
        lineGap: 2,
      });
    }

    doc.moveDown(1.5);

    // Page break if needed
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    }
  }

  // Add headers/footers with page numbers (skip title page)
  const range = doc.bufferedPageRange(); // { start: 0, count: N }
  const totalPages = range.count;
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    if (i === 0) continue; // title page
    drawHeaderFooter(i + 1, totalPages);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

const escapeHtml = (input: string) =>
  input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

/**
 * Very small markdown-to-HTML formatter (good enough for Word .doc export).
 * We intentionally keep it simple and robust.
 */
const markdownToHtmlLite = (md: string): string => {
  const lines = String(md || '').split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      out.push('<p>&nbsp;</p>');
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    // Bullets
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    closeList();

    // Basic inline cleanup (drop markdown markers)
    const cleaned = line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');

    out.push(`<p>${escapeHtml(cleaned)}</p>`);
  }

  closeList();
  return out.join('\n');
};

const writeReportBuilderWordDoc = async (report: any, sections: any[], filePath: string) => {
  const title = report.title || report.name || 'Report';
  const subtitleParts: string[] = [];
  if (report.organizationName) subtitleParts.push(String(report.organizationName));
  if (report.sourceFramework) subtitleParts.push(String(report.sourceFramework));
  if (report.sourceName) subtitleParts.push(String(report.sourceName));

  const body: string[] = [];
  body.push(`<h1>${escapeHtml(String(title))}</h1>`);
  if (subtitleParts.length) {
    body.push(`<p><em>${escapeHtml(subtitleParts.join(' • '))}</em></p>`);
  }
  body.push('<hr />');

  const enabledSections = (sections || [])
    .filter((s) => s && s.enabled)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  for (const section of enabledSections) {
    const sectionTitle = section.title || section.sectionKey || 'Section';
    body.push(`<h2>${escapeHtml(String(sectionTitle))}</h2>`);
    const content = section.editedContent || section.generatedContent || '';
    body.push(markdownToHtmlLite(String(content)));
    body.push('<br />');
  }

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(String(title))}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #0f172a; }
      h1 { font-size: 24pt; margin: 0 0 8pt 0; }
      h2 { font-size: 16pt; margin: 18pt 0 6pt 0; }
      h3 { font-size: 13pt; margin: 14pt 0 6pt 0; }
      p, li { font-size: 11pt; line-height: 1.35; }
      hr { border: 0; border-top: 1px solid #e2e8f0; margin: 10pt 0 14pt 0; }
    </style>
  </head>
  <body>
    ${body.join('\n')}
  </body>
</html>`;

  await fs.promises.writeFile(filePath, html, 'utf8');
};

/**
 * Parse inline markdown (bold, italic, code, links) into TextRun children.
 */
const parseInlineMarkdown = (text: string): any[] => {
  const runs: any[] = [];
  const regex = /(\*\*\*(.*?)\*\*\*|\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`|\[(.*?)\]\((.*?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun(text.slice(lastIndex, match.index)));
    }
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: 'Courier New', size: 20 }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], underline: {} }));
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun(text.slice(lastIndex)));
  }
  return runs.length > 0 ? runs : [new TextRun(text)];
};

/**
 * Parse a markdown table block (array of lines starting with |) into a docx Table.
 */
const parseMarkdownTable = (tableLines: string[]): any => {
  const rows: string[][] = [];
  for (const line of tableLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && !trimmed.match(/^\|[\s-:|]+\|$/)) {
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length > 0) rows.push(cells);
    }
  }

  if (rows.length === 0) {
    return new Table({
      rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('')] })] })],
    });
  }

  const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, rowIdx) =>
        new TableRow({
          children: cells.map(
            (cellText) =>
              new TableCell({
                borders,
                children: [
                  new Paragraph({
                    children:
                      rowIdx === 0
                        ? [new TextRun({ text: cellText, bold: true, size: 20 })]
                        : parseInlineMarkdown(cellText),
                  }),
                ],
              })
          ),
        })
    ),
  });
};

const markdownToDocxParagraphs = (markdown: string): any[] => {
  const text = String(markdown || '');
  const lines = text.split('\n');
  const out: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\r/g, '');

    // Collect markdown table blocks
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        out.push(parseMarkdownTable(tableLines));
      }
      continue;
    }

    i++;

    if (!line.trim()) {
      out.push(new Paragraph({ text: '' }));
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      out.push(new Paragraph({ text: line.slice(4).trim(), heading: HeadingLevel.HEADING_3 }));
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2 }));
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1 }));
      continue;
    }

    // Bullets
    if (/^[-*]\s+/.test(line)) {
      out.push(
        new Paragraph({
          children: parseInlineMarkdown(line.replace(/^[-*]\s+/, '').trim()),
          bullet: { level: 0 },
        })
      );
      continue;
    }

    // Numbered lists
    if (/^\d+\.\s+/.test(line)) {
      out.push(
        new Paragraph({
          children: parseInlineMarkdown(line.replace(/^\d+\.\s+/, '').trim()),
          numbering: { reference: 'default-numbering', level: 0 },
        })
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      out.push(
        new Paragraph({
          text: '',
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
        })
      );
      continue;
    }

    // Regular paragraph with inline formatting
    out.push(new Paragraph({ children: parseInlineMarkdown(line) }));
  }

  return out;
};

const writeReportBuilderDocx = async (report: any, sections: any[], filePath: string) => {
  const title = report.title || report.name || 'Report';
  const subtitleParts: string[] = [];
  if (report.organizationName) subtitleParts.push(String(report.organizationName));
  if (report.sourceFramework) subtitleParts.push(String(report.sourceFramework));
  if (report.sourceName) subtitleParts.push(String(report.sourceName));

  const enabledSections = (sections || [])
    .filter((s) => s && s.enabled)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const children: any[] = [];

  // Cover page
  children.push(
    new Paragraph({
      text: String(title),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );
  if (subtitleParts.length) {
    children.push(
      new Paragraph({
        text: subtitleParts.join(' • '),
        alignment: AlignmentType.CENTER,
      })
    );
  }
  children.push(
    new Paragraph({
      text: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(new Paragraph({ text: '' }));

  // Table of Contents
  if (enabledSections.length >= 3) {
    children.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }));
    for (let idx = 0; idx < enabledSections.length; idx++) {
      const secTitle = enabledSections[idx].title || enabledSections[idx].sectionKey || 'Section';
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${idx + 1}. ${secTitle}`, size: 22 })],
          spacing: { after: 60 },
        })
      );
    }
    children.push(new Paragraph({ text: '' }));
  }

  // Body sections
  for (const section of enabledSections) {
    const sectionTitle = section.title || section.sectionKey || 'Section';
    children.push(
      new Paragraph({
        text: String(sectionTitle),
        heading: HeadingLevel.HEADING_1,
      })
    );
    const content = section.editedContent || section.generatedContent || '';
    children.push(...markdownToDocxParagraphs(String(content)));
    children.push(new Paragraph({ text: '' }));
  }

  // Customizable header/footer from report metadata
  const orgName = report.organizationName || '';
  const headerText = orgName ? `${title} — ${orgName}` : String(title);
  const footerLabel = orgName ? `${orgName} • Confidential` : 'Consultify Report';

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal' as any,
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: headerText, size: 18, color: '666666' })],
                alignment: AlignmentType.LEFT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: footerLabel, size: 16, color: '999999' }),
                  new TextRun('  •  Page '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' of '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(filePath, buffer);
};

/**
 * GET /api/report-builder/:id/export/pdf
 * Export report as PDF
 */
router.post('/:id/export/notion', async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) return res.status(404).json({ error: 'Report not found' });

    // M17: export-approval gate — Notion is an external publish target, so this
    // is the most important main-path gate of all (fail-open on registry lag).
    const approvalArtifact = await artifactRegistryService
      .getArtifactByOrigin({
        organizationId,
        originRuntime: 'report',
        originRecordId: id,
        userId,
        roleKey: (req as any).user?.role ? String((req as any).user.role) : null,
      })
      .catch(() => null);
    if (
      approvalArtifact &&
      !applyExportApprovalGate({
        res,
        organizationId,
        userId,
        originRuntime: 'report',
        originRecordId: id,
        format: 'notion',
        publishState: approvalArtifact.publishState,
      })
    ) {
      return;
    }

    // Notion is an external publish target — apply the same export-readiness gate
    // enforced for pdf/doc/docx/pptx so un-vetted reports cannot leak outside.
    if (!(await enforceQualityGatesForExport(organizationId, id, res))) return;

    const notionConfig = await getNotionConfigForUser(userId);
    if (!notionConfig) {
      return res.status(400).json({
        error: 'Notion integration not configured',
        hint: 'Configure Notion in Settings → Integrations (apiKey + parentPageId/databaseId)',
      });
    }

    const sections = (reportData.sections || [])
      .filter((s: any) => s.enabled !== false)
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((s: any) => ({
        title: String(s.title || s.sectionKey || 'Section'),
        content: String(s.editedContent || s.generatedContent || ''),
      }));

    const result = await exportReportToNotion(
      {
        reportId: id,
        title: reportData.report.title || 'Report',
        description: reportData.report.description || undefined,
        sections,
        metadata: {
          createdAt: reportData.report.createdAt,
          createdBy: reportData.report.createdBy,
          organizationId,
          sourceType: reportData.report.sourceType,
          sourceId: reportData.report.sourceId,
        },
      },
      notionConfig
    );

    if (!result.success || !result.url) {
      return res.status(500).json({ error: result.error || 'Failed to export to Notion' });
    }

    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'notion',
      filePath: result.url,
      fileSize: 0,
      language: 'en',
      exportedBy: userId,
    }).catch(() => null);

    return res.json({ success: true, url: result.url });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error exporting to Notion:', err);
    return res
      .status(500)
      .json(
        buildReportBuilderFailClosedError(
          req,
          500,
          'REPORT_BUILDER_EXPORT_NOTION_FAILED',
          'Failed to export report to Notion.'
        )
      );
  }
});

router.get('/:id/export/pdf', async (req: Request, res: Response, next: NextFunction) => {
  const id = paramStr(req.params.id);
  const { userId, organizationId } = getAuthContext(req);
  try {
    // M17: export-approval gate. Fail-open when the artifact registry has no
    // linked record yet (registry-sync lag) — the existence/visibility check
    // belongs to a separate concern (P18-B, already covered on the pptx path);
    // this gate only ever blocks an artifact we KNOW is under an un-approved
    // review. See server/src/services/v8/exportApprovalGate.ts.
    const approvalArtifact = await artifactRegistryService
      .getArtifactByOrigin({
        organizationId,
        originRuntime: 'report',
        originRecordId: id,
        userId,
        roleKey: (req as any).user?.role ? String((req as any).user.role) : null,
      })
      .catch(() => null);
    if (
      approvalArtifact &&
      !applyExportApprovalGate({
        res,
        organizationId,
        userId,
        originRuntime: 'report',
        originRecordId: id,
        format: 'pdf',
        publishState: approvalArtifact.publishState,
      })
    ) {
      return;
    }

    if (!(await enforceQualityGatesForExport(organizationId, id, res))) return;

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exportDir = await ensureExportDir();
    const fileName = `${id}-${Date.now()}.pdf`;
    const filePath = path.join(exportDir, fileName);

    await writeReportBuilderPdf(reportData.report, reportData.sections, filePath);

    // Get file size
    const stats = await fs.promises.stat(filePath);

    // Create export record
    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'pdf',
      filePath,
      fileSize: stats.size,
      language: 'en',
      exportedBy: userId,
    });
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: 'pdf',
    }).catch(() => null);

    logger.info('[ReportBuilder] PDF exported', { reportId: id, userId });

    res.setHeader('Content-Type', 'application/pdf');
    const exportTitle = String(reportData.report.title || 'report');
    const asciiFileName =
      exportTitle
        .normalize('NFKD')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\/;\r\n]/g, '_')
        .trim() || 'report';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFileName}.pdf"; filename*=UTF-8''${encodeURIComponent(`${exportTitle}.pdf`)}`
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: 'pdf',
      status: 'failed',
    }).catch(() => null);
    logger.error('[ReportBuilder] Error exporting PDF:', err);
    return res
      .status(500)
      .json(
        buildReportBuilderFailClosedError(
          req,
          500,
          'REPORT_BUILDER_EXPORT_PDF_FAILED',
          'Failed to export report as PDF.'
        )
      );
  }
});

/**
 * GET /api/report-builder/:id/export/doc
 * Export report as a Word document (.docx)
 */
const exportDocx = async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const { userId, organizationId } = getAuthContext(req);
  try {
    // M17: export-approval gate (fail-open on registry lag — see /export/pdf above).
    const approvalArtifact = await artifactRegistryService
      .getArtifactByOrigin({
        organizationId,
        originRuntime: 'report',
        originRecordId: id,
        userId,
        roleKey: (req as any).user?.role ? String((req as any).user.role) : null,
      })
      .catch(() => null);
    if (
      approvalArtifact &&
      !applyExportApprovalGate({
        res,
        organizationId,
        userId,
        originRuntime: 'report',
        originRecordId: id,
        format: 'docx',
        publishState: approvalArtifact.publishState,
      })
    ) {
      return;
    }

    if (!(await enforceQualityGatesForExport(organizationId, id, res))) return;

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exportDir = await ensureExportDir();
    const fileName = `${id}-${Date.now()}.docx`;
    const filePath = path.join(exportDir, fileName);

    // Generate real DOCX (client-ready) instead of HTML-in-.doc
    await writeReportBuilderDocx(reportData.report, reportData.sections, filePath);

    const stats = await fs.promises.stat(filePath);

    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'docx',
      filePath,
      fileSize: stats.size,
      language: 'pl',
      exportedBy: userId,
    });
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: 'docx',
    }).catch(() => null);

    logger.info('[ReportBuilder] Word (.docx) exported', { reportId: id, userId });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportData.report.title || 'report'}.docx"`
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: 'docx',
      status: 'failed',
    }).catch(() => null);
    logger.error('[ReportBuilder] Error exporting Word (.docx):', err);
    // INFO-DISCLOSURE guard: log the real error above; never echo raw err.message to the client.
    return res.status(500).json({ error: 'Failed to export Word', code: 'EXPORT_DOCX_FAILED' });
  }
};

// Backward compatible + explicit endpoints
router.get('/:id/export/doc', exportDocx);
router.get('/:id/export/docx', exportDocx);

/**
 * GET /api/report-builder/:id/export/pptx
 * Export report as PowerPoint presentation
 *
 * Query params:
 *   ?version=2          — use new BCG-grade pipeline (v2)
 *   ?template=corporate — corporate | minimal | modern
 *   ?language=pl        — pl | en
 *   ?confidentiality=confidential — confidential | internal | public
 */
router.get('/:id/export/pptx', async (req: Request, res: Response, next: NextFunction) => {
  const id = paramStr(req.params.id);
  const { userId, organizationId } = getAuthContext(req);
  try {
    const roleKey = (req as any).user?.role ? String((req as any).user.role) : null;
    const { template, language, version, confidentiality } = req.query;
    const useV2 = version === '2' || version === 'v2';

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // P18-B: export audit respects visibility — deny exports when artifact is not visible to the caller.
    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId,
      originRuntime: 'report',
      originRecordId: id,
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // M17: export-approval gate — see server/src/services/v8/exportApprovalGate.ts
    // for the shadow/enforce rationale (EXPORT_APPROVAL_ENFORCE).
    if (
      !applyExportApprovalGate({
        res,
        organizationId,
        userId,
        originRuntime: 'report',
        originRecordId: id,
        format: 'pptx',
        publishState: artifact.publishState,
      })
    ) {
      return;
    }

    if (!(await enforceQualityGatesForExport(organizationId, id, res))) return;

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let buffer: Buffer;

    if (useV2) {
      // ── V2: BCG-grade component pipeline ──
      const { PptxPipelineService } =
        await import('../services/report/pptx/PptxPipelineService.js');
      const pipeline = new PptxPipelineService();

      const rpt = reportData.report as any;

      // Parse score summary if stored as JSON string
      let scoreSummary: any = undefined;
      const rawScore = rpt.scoreSummary || rpt.score_summary;
      if (rawScore) {
        try {
          scoreSummary = typeof rawScore === 'string' ? JSON.parse(rawScore) : rawScore;
        } catch {
          /* ignore */
        }
      }

      // Parse config if stored as JSON string
      let config: any = undefined;
      const rawConfig = rpt.config || rpt.config_json;
      if (rawConfig) {
        try {
          config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
        } catch {
          /* ignore */
        }
      }

      // Pre-load block types once for slide_intent resolution
      const allBlockTypes = await ReportBuilderService.listBlockTypes(organizationId).catch(
        () => []
      );
      const btMap = new Map(allBlockTypes.map((bt) => [bt.id, bt] as [string, typeof bt]));

      const v2Sections = (reportData.sections || []).map((s: any) => {
        const btId = s.blockTypeId || s.block_type_id;
        const bt = btId ? btMap.get(btId) : undefined;
        return {
          sectionKey: s.sectionKey || s.section_key,
          sectionType: s.sectionType || s.section_type,
          title: s.title || s.sectionKey || s.section_key,
          orderIndex: s.orderIndex ?? s.order_index ?? 0,
          enabled: s.enabled !== false,
          blockTypeId: btId,
          blockConfig: s.blockConfig || s.block_config,
          renderKind: s.renderKind || s.render_kind,
          generatedContent: s.generatedContent || s.generated_content,
          editedContent: s.editedContent || s.edited_content,
          contentFormat: s.contentFormat || s.content_format,
          repeatFor: s.repeatFor || s.repeat_for,
          repeatKey: s.repeatKey || s.repeat_key,
          repeatName: s.repeatName || s.repeat_name,
          repeatData: s.repeatData || s.repeat_data,
          slideIntent: bt?.slideIntent ?? undefined,
        };
      });

      const result = await pipeline.generateFromLegacyReport(
        {
          report: {
            id: rpt.id,
            title: rpt.title || rpt.name || 'Report',
            description: rpt.description,
            sourceType: rpt.sourceType || rpt.source_type || 'ASSESSMENT',
            sourceFramework: rpt.sourceFramework || rpt.source_framework,
            sourceName: rpt.sourceName || rpt.source_name,
            config,
            companyContext: rpt.companyContext || rpt.company_context,
            createdAt: rpt.createdAt || rpt.created_at,
            createdBy: rpt.createdBy || (rpt as any).created_by || userId,
          },
          sections: v2Sections,
          scoreSummary,
          organizationName: rpt.organizationName || rpt.organization_name,
          projectName: rpt.projectName || rpt.project_name,
        },
        {
          template: (template as any) || 'corporate',
          language: (language as any) || 'pl',
          confidentiality: (confidentiality as any) || 'confidential',
        }
      );

      buffer = result.buffer;

      // Log pipeline stats
      logger.info('[ReportBuilder] PPTX v2 exported', {
        reportId: id,
        userId,
        slideCount: result.slideCount,
        warnings: result.warnings.length,
        valid: result.validation.valid,
      });
    } else {
      // ── V1: Legacy monolithic export ──
      const { PptxExportService } = await import('../services/report/PptxExportService.js');
      const pptxService = new PptxExportService();

      const rpt = reportData.report as any;
      const pptxReportData = {
        id: rpt.id,
        name: rpt.title || rpt.name || 'Report',
        sourceType: rpt.sourceType || rpt.source_type || 'ASSESSMENT',
        sourceFramework: rpt.sourceFramework || rpt.source_framework,
        organizationName: rpt.organizationName || rpt.organization_name,
        projectName: rpt.projectName || rpt.project_name,
        createdAt: rpt.createdAt || rpt.created_at,
        intentConfig:
          rpt.intentConfig || rpt.intent_config
            ? JSON.parse(rpt.intentConfig || rpt.intent_config)
            : undefined,
        sections: (reportData.sections || []).map((s: any) => ({
          key: s.sectionKey || s.section_key,
          title: s.title || s.sectionKey || s.section_key,
          type: s.sectionType || s.section_type,
          content: s.generatedContent || s.generated_content || '',
          renderKind: s.renderKind || s.render_kind,
          data: s.dataJson || s.data_json ? JSON.parse(s.dataJson || s.data_json) : undefined,
        })),
        scoreSummary:
          rpt.scoreSummary || rpt.score_summary
            ? JSON.parse(rpt.scoreSummary || rpt.score_summary)
            : undefined,
      };

      buffer = await pptxService.generatePresentation(pptxReportData, {
        template: (template as any) || 'corporate',
        language: (language as any) || 'pl',
        includeCharts: true,
        includeToc: true,
      });

      logger.info('[ReportBuilder] PPTX v1 exported', { reportId: id, userId });
    }

    // Save to exports directory
    const exportDir = await ensureExportDir();
    const fileName = `${id}-${Date.now()}.pptx`;
    const filePath = path.join(exportDir, fileName);
    await fs.promises.writeFile(filePath, buffer);

    // Get file size
    const stats = await fs.promises.stat(filePath);

    // Create export record
    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'pptx',
      filePath,
      fileSize: stats.size,
      language: (language as string) || 'pl',
      exportedBy: userId,
    });
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: 'pptx',
    }).catch(() => null);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportData.report.title || 'report'}.pptx"`
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: 'pptx',
      status: 'failed',
    }).catch(() => null);
    logger.error('[ReportBuilder] Error exporting PPTX:', err);
    // INFO-DISCLOSURE guard: log the real error above; never echo raw err.message to the client.
    return res.status(500).json({ error: 'Failed to export PPTX', code: 'EXPORT_PPTX_FAILED' });
  }
});

/**
 * POST /api/report-builder/:id/publish/cloud/:cloudSourceId
 * Generate an export (pdf/docx/pptx) and upload it to a connected cloud source.
 *
 * Body:
 *  - format: 'pdf' | 'docx' | 'pptx' (required)
 *  - folderId?: string (optional)
 *  - version?: '2' | 'v2' (optional for pptx; defaults to v1)
 */
router.post('/:id/publish/cloud/:cloudSourceId', async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const cloudSourceId = paramStr(req.params.cloudSourceId);
  const { userId, organizationId } = getAuthContext(req);
  const format = String(req.body?.format || '')
    .trim()
    .toLowerCase();
  try {
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const folderId = req.body?.folderId ? String(req.body.folderId).trim() : undefined;
    const version = String(req.body?.version || req.query?.version || '').trim();
    const useV2 = version === '2' || version === 'v2';

    if (!['pdf', 'docx', 'pptx'].includes(format)) {
      return res.status(400).json({ error: 'format must be one of: pdf, docx, pptx' });
    }

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) return res.status(404).json({ error: 'Report not found' });
    if (!(await enforceQualityGatesForExport(organizationId, id, res))) return;

    const exportDir = await ensureExportDir();
    const safeTitle = String(reportData.report.title || 'report')
      .replace(/[^\w-]+/g, '_')
      .slice(0, 64);
    const fileName = `${safeTitle}-${id}-${Date.now()}.${format}`;
    const filePath = path.join(exportDir, fileName);

    if (format === 'pdf') {
      await writeReportBuilderPdf(reportData.report, reportData.sections, filePath);
    } else if (format === 'docx') {
      await writeReportBuilderDocx(reportData.report, reportData.sections, filePath);
    } else if (format === 'pptx') {
      // Reuse the same v1/v2 logic as export endpoint, but save to disk and upload.
      let buffer: Buffer;
      if (useV2) {
        const { PptxPipelineService } =
          await import('../services/report/pptx/PptxPipelineService.js');
        const pipeline = new PptxPipelineService();
        const rpt = reportData.report as any;

        let scoreSummary: any = undefined;
        const rawScore = rpt.scoreSummary || rpt.score_summary;
        if (rawScore) {
          try {
            scoreSummary = typeof rawScore === 'string' ? JSON.parse(rawScore) : rawScore;
          } catch {}
        }

        let config: any = undefined;
        const rawConfig = rpt.config || rpt.config_json;
        if (rawConfig) {
          try {
            config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
          } catch {}
        }

        const allBlockTypes = await ReportBuilderService.listBlockTypes(organizationId).catch(
          () => []
        );
        const btMap = new Map(allBlockTypes.map((bt) => [bt.id, bt] as [string, typeof bt]));
        const v2Sections = (reportData.sections || []).map((s: any) => {
          const btId = s.blockTypeId || s.block_type_id;
          const bt = btId ? btMap.get(btId) : undefined;
          return {
            sectionKey: s.sectionKey || s.section_key,
            sectionType: s.sectionType || s.section_type,
            title: s.title || s.sectionKey || s.section_key,
            orderIndex: s.orderIndex ?? s.order_index ?? 0,
            enabled: s.enabled !== false,
            blockTypeId: btId,
            blockConfig: s.blockConfig || s.block_config,
            renderKind: s.renderKind || s.render_kind,
            generatedContent: s.generatedContent || s.generated_content,
            editedContent: s.editedContent || s.edited_content,
            slideIntent: bt?.slideIntent || undefined,
          };
        });

        const pipelineResult = await pipeline.generateFromLegacyReport(
          {
            report: {
              id: rpt.id,
              name: rpt.title || 'Report',
              sourceType: rpt.sourceType || rpt.source_type || 'TOOL',
              sourceFramework: rpt.sourceFramework || rpt.source_framework,
              createdAt: rpt.createdAt || rpt.created_at,
              intentConfig: config?.intentConfig || config?.intent_config,
              sections: v2Sections,
              scoreSummary,
            } as any,
            sections: v2Sections,
            scoreSummary,
            organizationName: rpt.organizationName || rpt.organization_name,
            projectName: rpt.projectName || rpt.project_name,
          },
          { confidentiality: req.body?.confidentiality || req.query?.confidentiality } as any
        );
        buffer = pipelineResult.buffer;
      } else {
        const { PptxExportService } = await import('../services/report/PptxExportService.js');
        const pptx = new PptxExportService();
        buffer = await pptx.generatePresentation(
          {
            id: reportData.report.id,
            name: reportData.report.title || 'Report',
            sourceType: reportData.report.sourceType || 'TOOL',
            sourceFramework: reportData.report.sourceFramework,
            organizationName: (reportData.report as any).organizationName,
            projectName: (reportData.report as any).projectName,
            createdAt: reportData.report.createdAt,
            sections: (reportData.sections || []).map((s: any) => ({
              key: s.sectionKey,
              title: s.title,
              type: s.sectionType,
              content: s.editedContent || s.generatedContent || '',
              renderKind: s.renderKind,
              data: s.sourceDataSnapshot,
            })),
          } as any,
          {
            template: req.body?.template || req.query?.template,
            language: req.body?.language || req.query?.language,
          }
        );
      }

      await fs.promises.writeFile(filePath, buffer);
    }

    const stats = await fs.promises.stat(filePath);
    const buf = await fs.promises.readFile(filePath);
    const mimeType =
      format === 'pdf'
        ? 'application/pdf'
        : format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    const { uploadCloudFile } = await import('../services/cloudDataService.js');
    const uploaded = await uploadCloudFile({
      sourceId: cloudSourceId,
      organizationId,
      fileName,
      mimeType,
      content: buf,
      folderId,
    });

    // Best-effort: write a sync mapping for org-level integrations (if present).
    // This allows Integrations logs/mappings to show the outbound publish action.
    try {
      const mapCols = await dbAll<{ name: string }>(
        'PRAGMA table_info(integration_sync_mappings)',
        []
      ).catch(() => []);
      const hasMappings = (mapCols || []).some(
        (c) => String((c as any).name || '') === 'integration_id'
      );
      if (hasMappings) {
        const providerKey =
          uploaded.provider === 'sharepoint'
            ? 'onedrive'
            : String(uploaded.provider || '')
                .trim()
                .toLowerCase();
        const integration = await dbGet<{ id: string }>(
          `
          SELECT i.id
          FROM integrations i
          LEFT JOIN integration_providers p ON p.id = i.provider_id
          WHERE i.organization_id = ?
            AND p.name = ?
            AND (i.status IS NULL OR i.status IN ('active','connected'))
          ORDER BY COALESCE(i.connected_at, i.updated_at, i.last_sync_at) DESC
          LIMIT 1
        `,
          [organizationId, providerKey]
        );
        const integrationId = integration?.id ? String(integration.id) : '';
        if (integrationId) {
          const mappingId = `sync-${uuidv4()}`;
          const now = new Date().toISOString();
          await dbRun(
            `INSERT INTO integration_sync_mappings (
              id, integration_id,
              local_type, local_id,
              external_type, external_id, external_url,
              sync_status, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)`,
            [
              mappingId,
              integrationId,
              'report_builder',
              id,
              'file',
              uploaded.fileId,
              uploaded.url || null,
              now,
              now,
              JSON.stringify({
                source: 'report_builder_publish_cloud',
                format,
                cloudSourceId,
                fileName,
                mimeType,
              }),
            ]
          ).catch(() => null);
        }
      }
    } catch {
      // ignore (best-effort)
    }

    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: `cloud_${format}` as any,
      filePath: uploaded.url || uploaded.fileId,
      fileSize: stats.size,
      language: 'en',
      exportedBy: userId,
    }).catch(() => null);
    await recordCanonicalExportTrace({
      organizationId,
      userId,
      reportId: id,
      format: format as 'pdf' | 'docx' | 'pptx',
    }).catch(() => null);

    return res.json({ success: true, uploaded });
  } catch (err: any) {
    if (format === 'pdf' || format === 'docx' || format === 'pptx') {
      await recordCanonicalExportTrace({
        organizationId,
        userId,
        reportId: id,
        format,
        status: 'failed',
      }).catch(() => null);
    }
    logger.error('[ReportBuilder] Error publishing to cloud:', err);
    // INFO-DISCLOSURE guard: log the real error above; never echo raw err.message to the client.
    return res
      .status(500)
      .json({ error: 'Failed to publish to cloud', code: 'CLOUD_PUBLISH_FAILED' });
  }
});

/**
 * GET /api/report-builder/:id/exports
 * List export records for a report
 */
router.get('/:id/exports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exports = await ReportBuilderService.getExportRecords(id);
    res.json({ exports });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing exports:', err);
    next(err);
  }
});

// ==========================================
// VERSION HISTORY ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/:id/versions
 * List all versions of a report
 */
router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    const versions = await ReportBuilderService.listVersions(id, organizationId);
    res.json({ versions });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing versions:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/versions
 * Create a new version snapshot
 */
router.post('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { changeSummary } = req.body;

    const version = await ReportBuilderService.createVersion(id, organizationId, userId, {
      changeType: 'manual',
      changeSummary,
    });

    logger.info('[ReportBuilder] Version created manually', { reportId: id, userId });
    res.status(201).json({ version });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating version:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/versions/:versionId
 * Get a specific version with full snapshot
 */
router.get('/versions/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionId = paramStr(req.params.versionId);
    const { organizationId } = getAuthContext(req);

    const version = await ReportBuilderService.getVersion(versionId, organizationId);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ version });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting version:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/versions/:versionId1/compare/:versionId2
 * Compare two versions
 */
router.get(
  '/versions/:versionId1/compare/:versionId2',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionId1 = paramStr(req.params.versionId1);
      const versionId2 = paramStr(req.params.versionId2);
      const { organizationId } = getAuthContext(req);

      const comparison = await ReportBuilderService.compareVersions(
        versionId1,
        versionId2,
        organizationId
      );

      if (!comparison) {
        return res.status(404).json({ error: 'Versions not found or not comparable' });
      }

      res.json({ comparison });
    } catch (err) {
      logger.error('[ReportBuilder] Error comparing versions:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/versions/:versionId/rollback
 * Rollback report to a specific version
 */
router.post(
  '/versions/:versionId/rollback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionId = paramStr(req.params.versionId);
      const { userId, organizationId } = getAuthContext(req);

      const report = await ReportBuilderService.rollbackToVersion(
        versionId,
        organizationId,
        userId
      );

      if (!report) {
        return res.status(404).json({ error: 'Version not found' });
      }

      logger.info('[ReportBuilder] Rollback completed', { versionId, userId });
      res.json({ report, message: 'Rollback successful' });
    } catch (err) {
      logger.error('[ReportBuilder] Error rolling back:', err);
      next(err);
    }
  }
);

// ==========================================
// PUBLIC SHARE LINK ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/share
 * Create a public share link for a report
 */
router.post('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { password, expiresInDays, showCompanyLogo, showConsultifyBranding, customMessage } =
      req.body || {};

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only allow sharing of approved or generated reports
    if (!['GENERATED', 'IN_REVIEW', 'APPROVED', 'UTILIZED'].includes(report.report.status)) {
      return res.status(400).json({ error: 'Report must be generated before sharing' });
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (password && typeof password === 'string') {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Calculate expiration date
    let expiresAt: string | undefined;
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiresInDays);
      expiresAt = expDate.toISOString();
    }

    const link = await ReportBuilderService.createPublicLink({
      reportId: id,
      reportType: 'report_builder',
      organizationId,
      createdBy: userId,
      passwordHash,
      expiresAt,
      showCompanyLogo,
      showConsultifyBranding,
      customMessage,
    });

    logger.info('[ReportBuilder] Public link created', { reportId: id, linkId: link.id });

    // Return link without password hash
    res.status(201).json({
      link: {
        id: link.id,
        token: link.linkToken,
        url: `/shared/report/${link.linkToken}`,
        hasPassword: Boolean(passwordHash),
        expiresAt: link.expiresAt,
        showCompanyLogo: link.showCompanyLogo,
        showConsultifyBranding: link.showConsultifyBranding,
        customMessage: link.customMessage,
        createdAt: link.createdAt,
      },
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating share link:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/share
 * List public share links for a report
 */
router.get('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const links = await ReportBuilderService.getPublicLinks(id, organizationId);

    res.json({
      links: links.map((l) => ({
        id: l.id,
        token: l.linkToken,
        url: `/shared/report/${l.linkToken}`,
        hasPassword: Boolean(l.passwordHash),
        expiresAt: l.expiresAt,
        showCompanyLogo: l.showCompanyLogo,
        showConsultifyBranding: l.showConsultifyBranding,
        customMessage: l.customMessage,
        viewCount: l.viewCount,
        lastViewedAt: l.lastViewedAt,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing share links:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/:id/share/:linkId
 * Revoke a public share link
 */
router.delete('/:id/share/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const linkId = paramStr(req.params.linkId);
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const success = await ReportBuilderService.revokePublicLink(linkId, organizationId);

    if (!success) {
      return res.status(404).json({ error: 'Link not found or already revoked' });
    }

    logger.info('[ReportBuilder] Public link revoked', { reportId: id, linkId });

    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error revoking share link:', err);
    next(err);
  }
});

// ==========================================
// COMMENTS ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/:id/comments
 * List comments for a report with optional filters
 */
router.get('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);
    const { sectionKey, status, commentType, parentOnly } = req.query;

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filters: any = {};
    if (sectionKey !== undefined) filters.sectionKey = sectionKey === 'null' ? null : sectionKey;
    if (status) {
      filters.status =
        typeof status === 'string' && status.includes(',') ? status.split(',') : status;
    }
    if (commentType) filters.commentType = commentType;
    if (parentOnly === 'true') filters.parentOnly = true;

    const comments = await ReportBuilderCommentsService.listComments(id, filters);
    const summary = await ReportBuilderCommentsService.getCommentSummary(id);

    res.json({ comments, summary });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing comments:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/comments/summary
 * Get comment summary/counts for a report
 */
router.get('/:id/comments/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    // Verify report exists
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const summary = await ReportBuilderCommentsService.getCommentSummary(id);
    const canApprove = await ReportBuilderCommentsService.canApproveReport(id);

    res.json({ summary, canApprove });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting comment summary:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/comments
 * Create a new comment
 */
router.post('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { sectionKey, anchor, commentType, content, parentCommentId, priority, tags } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get user display name from database (stay compatible with older schemas)
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();
    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT first_name, last_name, avatar_url, email FROM users WHERE id = ?',
        [userId],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const comment = await ReportBuilderCommentsService.createComment({
      reportId: id,
      sectionKey,
      anchor,
      userId,
      userName:
        String(`${user?.first_name || ''} ${user?.last_name || ''}`).trim() ||
        String(user?.email || '') ||
        undefined,
      userAvatar: user?.avatar_url,
      commentType,
      content: content.trim(),
      parentCommentId,
      priority,
      tags,
    });

    logger.info('[ReportBuilder] Comment created', { reportId: id, commentId: comment.id, userId });

    res.status(201).json({ comment });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating comment:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/comments/:commentId
 * Get a specific comment
 */
router.get('/:id/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const commentId = paramStr(req.params.commentId);
    const { organizationId } = getAuthContext(req);

    // Verify report exists
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const comment = await ReportBuilderCommentsService.getComment(commentId);
    if (!comment || comment.reportId !== id) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ comment });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting comment:', err);
    next(err);
  }
});

/**
 * PATCH /api/report-builder/:id/comments/:commentId
 * Update a comment (content, status, etc.)
 */
router.patch(
  '/:id/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const commentId = paramStr(req.params.commentId);
      const { userId, organizationId } = getAuthContext(req);
      const { content, commentType, status, resolutionNotes, priority, tags } = req.body;

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Verify comment exists and belongs to this report
      const existing = await ReportBuilderCommentsService.getComment(commentId);
      if (!existing || existing.reportId !== id) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const updates: any = {};
      if (content !== undefined) updates.content = content;
      if (commentType !== undefined) updates.commentType = commentType;
      if (status !== undefined) updates.status = status;
      if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;
      if (priority !== undefined) updates.priority = priority;
      if (tags !== undefined) updates.tags = tags;

      const comment = await ReportBuilderCommentsService.updateComment(commentId, userId, updates);

      logger.info('[ReportBuilder] Comment updated', {
        reportId: id,
        commentId,
        updates: Object.keys(updates),
      });

      res.json({ comment });
    } catch (err) {
      logger.error('[ReportBuilder] Error updating comment:', err);
      next(err);
    }
  }
);

/**
 * DELETE /api/report-builder/:id/comments/:commentId
 * Delete a comment
 */
router.delete(
  '/:id/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const commentId = paramStr(req.params.commentId);
      const { userId, organizationId } = getAuthContext(req);

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Verify comment exists and belongs to this report
      const existing = await ReportBuilderCommentsService.getComment(commentId);
      if (!existing || existing.reportId !== id) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      await ReportBuilderCommentsService.deleteComment(commentId, userId);

      logger.info('[ReportBuilder] Comment deleted', { reportId: id, commentId, userId });

      res.json({ success: true });
    } catch (err) {
      logger.error('[ReportBuilder] Error deleting comment:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/:id/comments/:commentId/resolve
 * Quick resolve a comment
 */
router.post(
  '/:id/comments/:commentId/resolve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const commentId = paramStr(req.params.commentId);
      const { userId, organizationId } = getAuthContext(req);
      const { resolutionNotes } = req.body;

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const comment = await ReportBuilderCommentsService.updateComment(commentId, userId, {
        status: 'RESOLVED',
        resolutionNotes,
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      logger.info('[ReportBuilder] Comment resolved', { reportId: id, commentId, userId });

      // Return updated summary
      const summary = await ReportBuilderCommentsService.getCommentSummary(id);

      res.json({ comment, summary });
    } catch (err) {
      logger.error('[ReportBuilder] Error resolving comment:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/:id/comments/bulk-resolve
 * Resolve multiple comments at once
 */
router.post(
  '/:id/comments/bulk-resolve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const { userId, organizationId } = getAuthContext(req);
      const { commentIds, resolutionNotes } = req.body;

      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return res.status(400).json({ error: 'commentIds array is required' });
      }

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const resolvedCount = await ReportBuilderCommentsService.resolveComments(
        commentIds,
        userId,
        resolutionNotes
      );

      logger.info('[ReportBuilder] Bulk resolve', { reportId: id, resolvedCount, userId });

      const summary = await ReportBuilderCommentsService.getCommentSummary(id);

      res.json({ resolvedCount, summary });
    } catch (err) {
      logger.error('[ReportBuilder] Error bulk resolving comments:', err);
      next(err);
    }
  }
);

// ==========================================
// T060: Report Agent (Gamma-style chat)
// ==========================================

router.get(
  '/:id/agent/messages',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const orgId = (req as any).user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
      const messages = await getAgentMessages(orgId, String(id));
      res.json({ messages });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting agent messages:', err);
      next(err);
    }
  }
);

router.post(
  '/:id/agent/message',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const orgId = (req as any).user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }
      const result = await processAgentMessage(orgId, String(id), message);
      res.json(result);
    } catch (err) {
      logger.error('[ReportBuilder] Error processing agent message:', err);
      next(err);
    }
  }
);

router.post(
  '/:id/agent/apply/:messageId',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, messageId } = req.params;
      const orgId = (req as any).user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await applyAgentAction(orgId, String(id), String(messageId));
      res.json(result);
    } catch (err) {
      logger.error('[ReportBuilder] Error applying agent action:', err);
      next(err);
    }
  }
);

// ==========================================
// PROPOSE OUTLINE (AI-assisted)
// ==========================================

/**
 * POST /api/report-builder/:id/propose-outline
 * Proposes 1-3 outline variants based on report definition layer.
 */
router.post(
  '/:id/propose-outline',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { organizationId } = getAuthContext(req);

      const variants = await proposeOutline(String(id), organizationId);
      res.json({ variants, sections: variants[0]?.sections || [] });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: 'Report not found' });
      }
      logger.error('[ReportBuilder] Error proposing outline:', err);
      next(err);
    }
  }
);

// ==========================================
// T060: Quality Gates
// ==========================================

router.get(
  '/:id/quality-gates',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const orgId = (req as any).user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
      const report = await checkQualityGates(orgId, String(id));
      res.json(report);
    } catch (err) {
      logger.error('[ReportBuilder] Error checking quality gates:', err);
      next(err);
    }
  }
);

// ==========================================
// Phase 8: Refreshable Blocks & Data Binding
// ==========================================

/**
 * POST /api/report-builder/:id/sections/:sectionKey/refresh
 * Re-generate a single section using latest source data, returning a proposal (no auto-overwrite).
 */
router.post(
  '/:id/sections/:sectionKey/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { userId, organizationId } = getAuthContext(req);
      const { customPrompt } = req.body || {};

      const reportData = await ReportBuilderService.getReport(id, organizationId);
      if (!reportData) return res.status(404).json({ error: 'Report not found' });

      const section = reportData.sections.find((s) => s.sectionKey === sectionKey);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      const previousContent = section.editedContent || section.generatedContent || '';

      const result = await ReportGenerationService.regenerateSection(
        id,
        sectionKey,
        organizationId,
        userId,
        customPrompt
      );

      const newContent = result.content;

      const diff: string[] = [];
      if (previousContent !== newContent) {
        diff.push('Content changed');
        const prevLen = previousContent.length;
        const newLen = newContent.length;
        if (newLen > prevLen) {
          diff.push(`Added ~${newLen - prevLen} characters`);
        } else if (newLen < prevLen) {
          diff.push(`Removed ~${prevLen - newLen} characters`);
        }
      }

      logger.info('[ReportBuilder] Section refresh proposal generated', {
        reportId: id,
        sectionKey,
        diffCount: diff.length,
      });

      res.json({ sectionKey, previousContent, newContent, diff });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error refreshing section:', err);
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: 'Section not found' });
      }
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/:id/sections/:sectionKey/accept-refresh
 * Accept a refresh proposal — overwrites edited_content, updates last_data_timestamp.
 */
router.post(
  '/:id/sections/:sectionKey/accept-refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { userId, organizationId } = getAuthContext(req);
      const { newContent } = req.body || {};

      if (!newContent) return res.status(400).json({ error: 'newContent is required' });

      const reportData = await ReportBuilderService.getReport(id, organizationId);
      if (!reportData) return res.status(404).json({ error: 'Report not found' });

      const section = reportData.sections.find((s) => s.sectionKey === sectionKey);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      await ReportBuilderService.acceptRefreshContent(id, sectionKey, newContent, userId);

      logger.info('[ReportBuilder] Section refresh accepted', { reportId: id, sectionKey });

      res.json({ success: true, sectionKey });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error accepting refresh:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/:id/refresh-all
 * Generate refresh proposals for all refreshable sections.
 */
router.post('/:id/refresh-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) return res.status(404).json({ error: 'Report not found' });

    const refreshableSections = await ReportBuilderService.getRefreshableSections(id);

    const proposals: Array<{
      sectionKey: string;
      previousContent: string;
      newContent: string;
    }> = [];

    for (const section of refreshableSections) {
      try {
        const previousContent = section.editedContent || section.generatedContent || '';
        const result = await ReportGenerationService.regenerateSection(
          id,
          section.sectionKey,
          organizationId,
          userId
        );
        proposals.push({
          sectionKey: section.sectionKey,
          previousContent,
          newContent: result.content,
        });
      } catch (err) {
        logger.warn('[ReportBuilder] Failed to refresh section (skipping)', {
          reportId: id,
          sectionKey: section.sectionKey,
          err,
        });
      }
    }

    logger.info('[ReportBuilder] Refresh-all completed', {
      reportId: id,
      proposalsCount: proposals.length,
      totalRefreshable: refreshableSections.length,
    });

    res.json({ proposals });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error in refresh-all:', err);
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: 'Report not found' });
    }
    next(err);
  }
});

// ==========================================
// Phase 6: RAG Status Computation
// ==========================================

router.post(
  '/:id/compute-rag',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { organizationId } = getAuthContext(req);

      const results = await computeRagForReport(String(id), organizationId);
      res.json({ results });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: 'Report not found' });
      }
      logger.error('[ReportBuilder] Error computing RAG:', err);
      next(err);
    }
  }
);

// ── R1→R2 Auto-Escalation Trigger (G7) ──────────────────────
router.post(
  '/:id/evaluate-escalation',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { organizationId } = getAuthContext(req);

      const report = await dbGet<{
        report_type_v3: string;
        period_from: string;
        period_to: string;
      }>(
        `SELECT report_type_v3, period_from, period_to
         FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
        [id, organizationId]
      );

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const reportType = (report.report_type_v3 || '').toUpperCase();
      if (reportType !== 'R1') {
        return res.json({
          shouldEscalate: false,
          severity: 'none',
          reasons: [],
          message: 'Escalation evaluation is only applicable to R1 reports',
        });
      }

      const { evaluateR1EscalationTrigger } = await import('../services/ragLogicService.js');
      const periodFrom =
        report.period_from || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const periodTo = report.period_to || new Date().toISOString();

      const trigger = await evaluateR1EscalationTrigger(organizationId, periodFrom, periodTo);
      res.json(trigger);
    } catch (err: any) {
      logger.error('[ReportBuilder] Error evaluating escalation:', err);
      next(err);
    }
  }
);

// ==========================================
// Phase 9: Report -> Execution Integration
// ==========================================

/**
 * POST /api/report-builder/:id/sections/:sectionKey/create-initiative
 * Creates an initiative from a report section's content.
 */
router.post(
  '/:id/sections/:sectionKey/create-initiative',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { userId, organizationId } = getAuthContext(req);
      const { title: bodyTitle, description: bodyDescription } = req.body || {};

      const reportData = await ReportBuilderService.getReport(id, organizationId);
      if (!reportData) return res.status(404).json({ error: 'Report not found' });

      const section = reportData.sections.find((s) => s.sectionKey === sectionKey);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      const sectionContent = section.editedContent || section.generatedContent || '';
      // F15 (data-integrity, continuation of Z139): decode HTML entities the
      // global input-sanitization middleware escaped on bodyTitle before it
      // feeds initiatives.title/name below (funnel branch AND raw-insert
      // fallback — INITIATIVE_FUNNEL_ENABLED is default OFF).
      const initiativeTitle = decodeHtmlEntities(
        String(bodyTitle || section.title || 'Untitled Initiative')
      );
      const initiativeDescription =
        bodyDescription || (sectionContent ? sectionContent.slice(0, 500) : '');

      let initiativeId = uuidv4();
      const now = new Date().toISOString();

      // Uspójnienie F1.9 — przez kanoniczny lejek (DRAFT + name/title + lineage).
      if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
        const __r = await funnelCreateInitiative(
          organizationId,
          {
            title: initiativeTitle,
            projectId: reportData.report.projectId || null,
            summary: initiativeDescription,
            description: initiativeDescription,
            ownerBusinessId: userId || null,
            ownerExecutionId: userId || null,
            sourceType: 'report',
            sourceId: id,
          },
          { validate: false, actor: { id: userId } }
        );
        initiativeId = __r.id;
        // Funnel nie zna report_id/created_by/updated_by — dośpiewujemy (best-effort).
        try {
          await dbRun(
            `UPDATE initiatives SET report_id = ?, created_by = ?, updated_by = ?
             WHERE id = ? AND organization_id = ?`,
            [id, userId || 'system', userId || 'system', initiativeId, organizationId]
          );
        } catch {
          /* report_id/created_by/updated_by columns may be absent */
        }

        logger.info('[ReportBuilder] Initiative created from section', {
          reportId: id,
          sectionKey,
          initiativeId,
        });

        return res.json({ id: initiativeId, title: initiativeTitle, status: 'DRAFT' });
      }

      // D1 (Zwornik §9 Faza 3): this raw-insert branch below is the LIVE path
      // (INITIATIVE_FUNNEL_ENABLED defaults off) and did not anchor
      // project_id — auto-assign the org's system portfolio project instead
      // of persisting a silent orphan.
      const anchoredProjectId = await resolveInitiativeProjectId(
        organizationId,
        reportData.report.projectId,
        { createdBy: userId || null }
      );

      let initiativeColumns: string[] = [];
      try {
        const info = await dbAll<Array<{ name?: string }>>(`PRAGMA table_info(initiatives)`, []);
        initiativeColumns = (info || []).map((row: any) => String(row?.name || '')).filter(Boolean);
      } catch {
        initiativeColumns = [];
      }

      const staticColumnMapping: Record<string, unknown> = {
        id: initiativeId,
        organization_id: organizationId,
        project_id: anchoredProjectId,
        report_id: id,
        title: initiativeTitle,
        name: initiativeTitle,
        summary: initiativeDescription,
        description: initiativeDescription,
        status: 'DRAFT',
        owner_business_id: userId || null,
        owner_execution_id: userId || null,
        created_by: userId || 'system',
        updated_by: userId || 'system',
        created_at: now,
        updated_at: now,
      };

      if (initiativeColumns.length === 0) {
        await dbRun(
          `INSERT INTO initiatives (
            id, organization_id, project_id, name, summary, status,
            report_id, owner_business_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)`,
          [
            initiativeId,
            organizationId,
            anchoredProjectId,
            initiativeTitle,
            initiativeDescription,
            id,
            userId,
            now,
            now,
          ]
        );
      } else {
        const insertCols: string[] = [];
        const insertVals: unknown[] = [];
        for (const column of initiativeColumns) {
          if (column === 'metadata_json') continue;
          insertCols.push(column);
          if (Object.prototype.hasOwnProperty.call(staticColumnMapping, column)) {
            insertVals.push(staticColumnMapping[column]);
            continue;
          }
          const defaultNullColumnPrefixes = ['custom_', 'meta_', 'attr_', 'x_'];
          if (defaultNullColumnPrefixes.some((prefix) => column.startsWith(prefix))) {
            insertVals.push(null);
            continue;
          }
          insertVals.push(null);
        }
        const placeholders = insertCols.map(() => '?').join(', ');
        await dbRun(
          `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${placeholders})`,
          insertVals
        );
      }

      logger.info('[ReportBuilder] Initiative created from section', {
        reportId: id,
        sectionKey,
        initiativeId,
      });

      res.json({ id: initiativeId, title: initiativeTitle, status: 'DRAFT' });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error creating initiative from section:', err);
      next(err);
    }
  }
);

/**
 * GET /api/report-builder/:id/entity-links
 * Returns all entities (initiatives, tasks, decisions) linked to the report.
 */
router.get('/:id/entity-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    const report = await dbGet<{ id: string }>(
      `SELECT id FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const initiatives = await dbAll<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM initiatives
       WHERE organization_id = ? AND report_id = ?
       ORDER BY created_at DESC`,
      [organizationId, id]
    );

    const tasks = await dbAll<{ id: string; title: string; status: string }>(
      `SELECT t.id, t.title, t.status FROM tasks t
       JOIN initiatives i ON t.initiative_id = i.id
       WHERE i.organization_id = ? AND i.report_id = ?
       ORDER BY t.created_at DESC`,
      [organizationId, id]
    );

    const decisions = await dbAll<{ id: string; title: string; status: string }>(
      `SELECT d.id, d.title, d.status FROM decisions d
       JOIN initiatives i ON d.initiative_id = i.id
       WHERE d.organization_id = ? AND i.report_id = ?
       ORDER BY d.created_at DESC`,
      [organizationId, id]
    );

    const kpis = await dbAll<{
      id: string;
      initiativeId: string;
      name: string;
      targetValue: number | null;
      unit: string | null;
    }>(
      `SELECT k.id,
              k.initiative_id AS "initiativeId",
              k.name,
              k.target_value AS "targetValue",
              k.unit
       FROM initiative_kpis k
       JOIN initiatives i ON i.id = k.initiative_id
       WHERE i.organization_id = ? AND i.report_id = ?
       ORDER BY k.updated_at DESC, k.created_at DESC`,
      [organizationId, id]
    );

    const milestones = await dbAll<{
      id: string;
      initiativeId: string;
      name: string;
      status: string | null;
      targetDate: string | null;
    }>(
      `SELECT m.id,
              m.initiative_id AS "initiativeId",
              m.name,
              m.status,
              m.target_date AS "targetDate"
       FROM initiative_milestones m
       JOIN initiatives i ON i.id = m.initiative_id
       WHERE m.organization_id = ? AND i.report_id = ?
       ORDER BY m.target_date DESC, m.created_at DESC`,
      [organizationId, id]
    );

    res.json({
      initiatives: initiatives.map((i) => ({ id: i.id, title: i.name, status: i.status })),
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
      decisions: decisions.map((d) => ({ id: d.id, title: d.title, status: d.status })),
      kpis: kpis.map((k) => ({
        id: k.id,
        initiativeId: k.initiativeId,
        title: k.name,
        targetValue: k.targetValue ?? null,
        unit: k.unit ?? null,
      })),
      milestones: milestones.map((m) => ({
        id: m.id,
        initiativeId: m.initiativeId,
        title: m.name,
        status: m.status ?? 'PENDING',
        targetDate: m.targetDate ?? null,
      })),
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting entity links:', err);
    next(err);
  }
});

// ==========================================
// Phase 10: Convenience Schedule Endpoint
// ==========================================

/**
 * POST /api/report-builder/schedule
 * Create a scheduled report from a template.
 * Delegates to scheduledReportService.createSchedule.
 */
router.post('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = getAuthContext(req);
    const {
      templateId,
      scheduleName,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      deliveryMethods,
      timezone,
    } = req.body || {};

    if (!scheduleName || !frequency || !deliveryMethods?.length) {
      return res.status(400).json({
        error: 'Missing required fields: scheduleName, frequency, deliveryMethods',
      });
    }

    const { scheduledReportService } = await import('../services/scheduledReportService.js');

    const schedule = await scheduledReportService.createSchedule(
      {
        name: scheduleName,
        templateId: templateId || undefined,
        reportType: 'custom',
        frequency,
        timezone: timezone || 'UTC',
        deliveryMethods: deliveryMethods || [],
        deliveryConfig: {
          email: deliveryMethods?.includes('email')
            ? { recipients: [], subject: scheduleName }
            : undefined,
        },
      },
      organizationId,
      userId
    );

    logger.info('[ReportBuilder] Schedule created via convenience endpoint', {
      scheduleId: schedule.id,
      templateId,
      frequency,
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error creating schedule:', err);
    next(err);
  }
});

export default router;
