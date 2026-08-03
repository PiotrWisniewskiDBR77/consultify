import { type Request, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { requireV8OrgContext } from '../middleware/v8Auth.middleware.js';
import { v8OutputsGate } from '../middleware/v8FeatureGate.middleware.js';
import activityService from '../services/ActivityService.js';
import { resolveArtifactContent } from '../services/artifacts/artifactContentResolverService.js';
import * as organizationService from '../services/organizationService.js';
import {
  computeDeckListScorecard,
  type DeckListScorecard,
} from '../services/presentationDeckScorecard.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import * as executionSpineService from '../services/v8/executionSpineService.js';
import * as publishReviewService from '../services/v8/publishReviewService.js';
import * as reportsPresModelService from '../services/v8/reportsPresModelService.js';
import {
  approveAndCommitWave5Mutation,
  approveWave5Mutation,
  buildWave5ExportManifest,
  commitWave5Mutation,
  createWave5Artifact,
  fillWave5DocumentTemplate,
  generateWave5StructuredArtifact,
  getWave5Artifact,
  listWave5Artifacts,
  listWave5ArtifactVersions,
  listWave5Mutations,
  markWave5ArtifactExported,
  proposeWave5Mutation,
  rejectWave5Mutation,
  WAVE5_ARTIFACT_LIFECYCLE,
  WAVE5_ARTIFACT_TYPES,
} from '../services/wave5ArtifactRuntimeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);
router.use(requireV8OrgContext);
router.use(v8OutputsGate);

function getAuthContext(req: any): {
  userId: string;
  organizationId: string;
  roleKey: string | null;
} {
  return {
    userId: String(req?.user?.id || req?.userId || ''),
    organizationId: String(req?.user?.organizationId || req?.organizationId || ''),
    roleKey: req?.user?.role ? String(req.user.role) : null,
  };
}

/**
 * Wave5 runtime services throw plain `Error('...')` for not-found / conflict
 * conditions, which otherwise fall through asyncHandler to the global error
 * handler and surface as a generic HTTP 500. This maps the known, controlled
 * runtime messages to the correct HTTP status + stable code while keeping the
 * existing `{ success: false, error }` response shape. Unknown errors are
 * re-thrown so the global handler still returns a generic 500 (no raw-text leak).
 */
function respondWave5RuntimeError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : '';

  if (message === 'Artifact not found' || message === 'Mutation proposal not found') {
    res.status(404).json({ success: false, error: message });
    return;
  }
  if (
    message.startsWith('Artifact already has active mutation proposal') ||
    message.startsWith('Mutation is ')
  ) {
    res.status(409).json({ success: false, error: message });
    return;
  }
  if (message.startsWith('Unsupported artifact type')) {
    res.status(400).json({ success: false, error: message });
    return;
  }

  logger.error('[artifacts] Unexpected wave5 runtime error', { message });
  res
    .status(500)
    .json({ success: false, error: 'An unexpected error occurred. Please try again later.' });
}

function canManageArtifactAccess(params: {
  userId: string;
  roleKey: string | null;
  ownerUserId?: string | null;
}): boolean {
  if (params.ownerUserId && params.ownerUserId === params.userId) return true;
  const normalizedRole = String(params.roleKey || '').toUpperCase();
  return (
    normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN' || normalizedRole === 'OWNER'
  );
}

function canPublishOrgTemplate(roleKey: string | null): boolean {
  const normalizedRole = String(roleKey || '').toUpperCase();
  return (
    normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN' || normalizedRole === 'OWNER'
  );
}

function buildActionTargetPayload(artifact: {
  artifactId: string;
  originRuntime?: string | null;
  originRecordId?: string | null;
}) {
  const originRuntime = String(artifact.originRuntime || '');
  const originRecordId = String(artifact.originRecordId || '');
  const reviewPath = `/api/artifacts/${artifact.artifactId}/start-review`;

  if (!originRuntime || !originRecordId) {
    return {
      artifactId: artifact.artifactId,
      originRuntime: null,
      originRecordId: null,
      openPath: null,
      exportPath: null,
      deletePath: null,
      reviewPath,
      authority: 'artifact_registry',
    };
  }

  // HOTFIX task#63 (UI-M5): a promoted assessment is registered with
  // originRuntime 'assessment_report' and originRecordId = the assessment RUN id.
  // No report_builder_reports row exists for it, so it must NOT route to
  // /reports/builder/{id} (that opens an empty "Add first block" builder =
  // looks like data loss). Route back to the assessment run it came from.
  if (originRuntime === 'assessment_report') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/assessment?assessmentId=${encodeURIComponent(originRecordId)}`,
      exportPath: null,
      deletePath: null,
      reviewPath,
      authority: 'assessment_workbench',
    };
  }

  if (originRuntime === 'report') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/reports/builder/${originRecordId}`,
      exportPath: `/api/report-builder/${originRecordId}/export/pdf`,
      deletePath: `/api/report-builder/${originRecordId}`,
      reviewPath,
      authority: 'report_builder',
    };
  }

  if (originRuntime === 'presentation') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/presentations/builder/${originRecordId}`,
      exportPath: `/api/presentations/decks/${originRecordId}/download`,
      deletePath: `/api/presentations/decks/${originRecordId}`,
      reviewPath,
      authority: 'presentations_runtime',
    };
  }

  // P0.2 fix (2026-07-26): documents created directly in Document Studio
  // register as originRuntime='native_artifact' (server/src/routes/document-
  // studio.routes.ts registerGeneratedDocumentOrigin) — a DIFFERENT runtime
  // from 'report' (report_builder). Before this case existed they fell to the
  // generic branch below (openPath: null), which made the client's fallback
  // path (getArtifactPath('report', id) -> /wordy?artifactId=...) the only
  // option — the WRONG engine for these documents. Route explicitly to the
  // Document Studio resume URL, which this same runtime's GET
  // /api/document-studio/:artifactId actually resolves.
  if (originRuntime === 'native_artifact') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/document-studio/${originRecordId}`,
      exportPath: `/api/document-studio/${originRecordId}/export/pdf`,
      deletePath: null,
      reviewPath,
      authority: 'document_studio',
    };
  }

  if (originRuntime === 'report_template') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: `/reports/builder?tab=templates&templateArtifactId=${artifact.artifactId}&edit=true`,
      exportPath: null,
      deletePath: null,
      reviewPath,
      authority: 'report_builder',
    };
  }

  if (originRuntime === 'presentation_template') {
    // Scalenie wejść prezentacji 2026-07-27: `/presentations/wizard` jest
    // teraz redirect-only (AppRoutes.tsx); kanoniczne wejście do edycji
    // szablonu decka to Architekt szablonów pod `/presentations?tab=
    // template_architect` (deep-link istniejący od 26.07 —
    // ReportsAndPresentationsHub.tsx czyta ?tab=template_architect i
    // ustawia templatesView='deckArchitect').
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: '/presentations?tab=template_architect',
      exportPath: null,
      deletePath: null,
      reviewPath,
      authority: 'presentations_runtime',
    };
  }

  if (originRuntime === 'sheet') {
    return {
      artifactId: artifact.artifactId,
      originRuntime,
      originRecordId,
      openPath: null,
      exportPath: `/api/table-platform/tables/${originRecordId}/export/xlsx`,
      deletePath: null,
      reviewPath,
      authority: 'table_platform',
    };
  }

  return {
    artifactId: artifact.artifactId,
    originRuntime,
    originRecordId,
    openPath: null,
    exportPath: null,
    deletePath: null,
    reviewPath,
    authority: 'artifact_registry',
  };
}

async function updateTemplateArtifactPostPublish(params: {
  artifactId: string;
  organizationId: string;
  publishedBy: string;
  reviewedBy: string;
  reviewedAt: string;
  publishState: string;
  validationState: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const row = await dbGet<{ origin_summary_json: string | null }>(
    `SELECT origin_summary_json FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [params.artifactId, params.organizationId]
  );
  let summary: Record<string, unknown> | null = null;
  try {
    summary = row?.origin_summary_json ? (JSON.parse(row.origin_summary_json) as any) : null;
  } catch {
    summary = null;
  }

  const nextSummary = summary && typeof summary === 'object' ? { ...summary } : {};
  const template =
    (nextSummary as any).template && typeof (nextSummary as any).template === 'object'
      ? { ...(nextSummary as any).template }
      : {};
  template.status = 'published';
  template.metadata = {
    ...(template.metadata && typeof template.metadata === 'object' ? template.metadata : {}),
    provenanceStamp: {
      source: params.publishedBy,
      reviewedBy: params.reviewedBy,
      reviewedAt: params.reviewedAt,
      publishState: params.publishState,
      validationState: params.validationState,
    },
    publishedBy: params.publishedBy,
    publishedAt: now,
    updatedAt: now,
  };
  (nextSummary as any).template = template;

  await dbRun(
    `UPDATE v8_output_artifacts
     SET visibility_scope = 'organization',
         owner_user_id = NULL,
         origin_summary_json = ?,
         last_transition_at = ?
     WHERE artifact_id = ? AND organization_id = ?`,
    [JSON.stringify(nextSummary), now, params.artifactId, params.organizationId]
  );
}

async function buildArtifactTrustPayload(params: {
  artifact: Awaited<ReturnType<typeof artifactRegistryService.getArtifactForUser>>;
  organizationId: string;
  userId: string;
  roleKey: string | null;
}) {
  const artifact = params.artifact;
  if (!artifact) return null;

  const [links, grants, executionRun] = await Promise.all([
    artifactRegistryService.getArtifactOriginLinks(artifact.artifactId, params.organizationId),
    artifactRegistryService.getArtifactAccessGrantsForArtifact(
      artifact.artifactId,
      params.organizationId
    ),
    artifact.executionRunId
      ? executionSpineService.getRun(artifact.executionRunId, params.organizationId)
      : Promise.resolve(null),
  ]);
  const exportHistory = await reportsPresModelService
    .getExportHistory(artifact.artifactId, params.organizationId)
    .catch(() => []);

  const actionTarget = buildActionTargetPayload(artifact);
  const validation = artifactRegistryService.deriveArtifactValidationSnapshot({
    artifact,
    executionState: executionRun?.state,
    sourceRefs: artifact.sourceRefs,
  });

  const lineagePaths = artifact.executionRunId
    ? {
        runPath: `/v8/execution/runs/${artifact.executionRunId}`,
        toolUsagePath: `/v8/execution/runs/${artifact.executionRunId}/tool-usage`,
        outputsPath: `/v8/execution/runs/${artifact.executionRunId}/outputs`,
      }
    : null;

  return {
    artifactId: artifact.artifactId,
    outputType: artifact.outputType,
    canonicalHome: artifact.canonicalHome,
    visibilityScope: artifact.visibilityScope,
    projectId: artifact.projectId,
    publishState: artifact.publishState,
    validationState: validation.state,
    validationChecks: validation.checks,
    reviewers: artifact.publishReviewers,
    reviewGateCount: artifact.reviewGateCount,
    executionRunId: artifact.executionRunId,
    executionState: executionRun?.state || null,
    contextSnapshotId: artifact.contextSnapshotId,
    lastTransitionAt: artifact.lastTransitionAt,
    sourceRefs: artifact.sourceRefs,
    originSummary: artifact.originSummary,
    originLinks: links,
    accessGrants: grants,
    exportHistory,
    lineagePaths,
    openPath: actionTarget.openPath,
    exportPath: actionTarget.exportPath,
    authority: actionTarget.authority,
    manageAccessPath: `/api/artifacts/${artifact.artifactId}/access`,
    canManageAccess: canManageArtifactAccess({
      userId: params.userId,
      roleKey: params.roleKey,
      ownerUserId: artifact.ownerUserId,
    }),
    reviewAuthority: 'artifact_review',
    executionAuthority: 'execution_spine',
  };
}

/**
 * Resolve the draft-visibility mode for the Outputs listing (M17 junk filter, S6.3).
 * Default is 'exclude' (only real/final artifacts). Callers opt into drafts via:
 *   ?include=drafts | ?drafts=include  → real + drafts (mixed)
 *   ?view=drafts    | ?drafts=only     → drafts only (the "Robocze" view)
 *   ?drafts=exclude                    → explicit default
 */
function resolveDraftMode(req: Request): 'exclude' | 'include' | 'only' {
  const drafts = String(req.query.drafts || '').toLowerCase();
  if (drafts === 'include' || drafts === 'only' || drafts === 'exclude') return drafts;
  if (req.query.view === 'drafts') return 'only';
  if (String(req.query.include || '').toLowerCase() === 'drafts') return 'include';
  return 'exclude';
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const items = await artifactRegistryService.listArtifactsForUser({
      organizationId,
      userId,
      roleKey,
      filters: {
        drafts: resolveDraftMode(req),
        dedupe: String(req.query.dedupe || '').toLowerCase() !== 'false',
        outputType:
          req.query.outputType === 'report' ||
          req.query.outputType === 'presentation' ||
          req.query.outputType === 'sheet'
            ? req.query.outputType
            : undefined,
        artifactFamily:
          req.query.artifactFamily === 'document' ||
          req.query.artifactFamily === 'presentation' ||
          req.query.artifactFamily === 'sheet' ||
          req.query.artifactFamily === 'template'
            ? req.query.artifactFamily
            : undefined,
        visibilityScope:
          req.query.visibilityScope === 'private' ||
          req.query.visibilityScope === 'project' ||
          req.query.visibilityScope === 'organization' ||
          req.query.visibilityScope === 'review_shared' ||
          req.query.visibilityScope === 'demo'
            ? req.query.visibilityScope
            : undefined,
        sourceInitiativeId:
          typeof req.query.sourceInitiativeId === 'string' && req.query.sourceInitiativeId.trim()
            ? req.query.sourceInitiativeId.trim()
            : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        onlyMine: req.query.view === 'mine',
        reviewSharedForUserId: req.query.view === 'review' ? userId : undefined,
        limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      },
    });

    const baseData = items.map((item) => ({
      ...item,
      ...buildActionTargetPayload(item),
    }));

    // P2.6 — surface the EXISTING deck quality gates (checkDeckQualityGates) as a
    // compact per-row scorecard so the Prezentacje list badge shows a real score
    // + A-F grade, not just the governance validationState. Presentation rows
    // only; each computation is fail-open (null → list keeps the governance
    // badge) and runs in parallel so a slow/broken deck never blocks the list.
    const data = await Promise.all(
      baseData.map(async (item) => {
        const anyItem = item as { originRuntime?: string; originRecordId?: string };
        if (anyItem.originRuntime !== 'presentation' || !anyItem.originRecordId) return item;
        const deckScorecard: DeckListScorecard | null = await computeDeckListScorecard(
          organizationId,
          anyItem.originRecordId
        );
        return deckScorecard ? { ...item, deckScorecard } : item;
      })
    );

    res.json({ data, total: data.length, canonicalHome: 'outputs_library' });
  })
);

router.get(
  '/my-work',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const result = await artifactRegistryService.listMyWorkArtifacts({
      organizationId,
      userId,
      roleKey,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  })
);

router.get(
  '/origin/:originRuntime/:originRecordId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const originRuntime = String(req.params.originRuntime || '');
    const originRecordId = String(req.params.originRecordId || '');
    if (
      originRuntime !== 'report' &&
      originRuntime !== 'presentation' &&
      originRuntime !== 'sheet' &&
      originRuntime !== 'native_artifact' &&
      originRuntime !== 'report_template' &&
      originRuntime !== 'presentation_template'
    ) {
      return res.status(400).json({ error: 'Invalid originRuntime' });
    }

    const artifact = await artifactRegistryService.getArtifactByOrigin({
      organizationId,
      originRuntime,
      originRecordId,
      userId,
      roleKey,
    });

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json({ data: artifact });
  })
);

/**
 * DEC-1 (Harvard R1 #8) — Chat deliverable registry with back-reference.
 *
 * Every deck/doc/sheet produced from the chat is registered in the M17 Outputs
 * library (v8_output_artifacts) with a back-reference to its source, so Materiały
 * shows the artifact and can link back to the conversation that produced it. This
 * fixes the "split-brain" where `registerChatDeliverable` only wrote to a local
 * (localStorage) store and the artifact never reached M17 — Teresa "lied about
 * location" because the deliverable was nowhere the user could find it.
 *
 * The back-reference lives in two places (mirrors work-canvas register-in-outputs):
 *  - origin link: originRuntime + originRecordId (= the generationId), idempotent
 *  - originSummary: { sourceType: 'chat', sourceId: conversationId, kind }
 *
 * Registration is idempotent per (org, originRuntime, generationId): re-posting the
 * same generation updates the title/metadata instead of duplicating — one
 * deliverable, zero duplicates.
 */
router.post(
  '/register-chat',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req);
    const body = (req.body || {}) as Record<string, unknown>;

    const rawKind = String(body.kind || '').toLowerCase();
    const generationId = String(body.generationId || '').trim();
    const title = String(body.title || '').trim() || null;
    const conversationId = String(body.conversationId || '').trim() || null;

    if (rawKind !== 'deck' && rawKind !== 'doc' && rawKind !== 'sheet') {
      return res.status(400).json({ error: 'Invalid kind (expected deck | doc | sheet)' });
    }
    if (!generationId) {
      return res.status(400).json({ error: 'generationId is required' });
    }

    // Map chat kind → registry taxonomy (mirrors DocumentStudio/Presentations conventions).
    const mapping =
      rawKind === 'deck'
        ? {
            outputType: 'presentation' as const,
            artifactFamily: 'presentation' as const,
            originRuntime: 'presentation' as const,
          }
        : rawKind === 'sheet'
          ? {
              outputType: 'sheet' as const,
              artifactFamily: 'sheet' as const,
              originRuntime: 'sheet' as const,
            }
          : {
              outputType: 'report' as const,
              artifactFamily: 'document' as const,
              originRuntime: 'native_artifact' as const,
            };

    const artifact = await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: mapping.outputType,
      artifactFamily: mapping.artifactFamily,
      originRuntime: mapping.originRuntime,
      originRecordId: generationId,
      titleSnapshot: title,
      ownerUserId: userId,
      createdBy: userId,
      visibilityScope: undefined,
      originSummary: {
        sourceType: 'chat',
        sourceId: conversationId,
        sourceTable: 'conversations',
        kind: rawKind,
        generationId,
      },
    });

    return res.json({
      data: artifact,
      readBack: {
        target: 'outputs_library',
        artifactId: artifact?.artifactId || null,
        sourceType: 'chat',
        sourceId: conversationId,
        status: artifact ? 'registered' : 'skipped',
      },
    });
  })
);

router.get(
  '/wave5/schema',
  asyncHandler(async (_req: Request, res: Response) =>
    res.json({
      success: true,
      artifactTypes: WAVE5_ARTIFACT_TYPES,
      lifecycle: WAVE5_ARTIFACT_LIFECYCLE,
    })
  )
);

router.get(
  '/wave5',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const artifacts = await listWave5Artifacts({
      organizationId,
      status: typeof req.query.status === 'string' ? req.query.status : null,
      artifactType: typeof req.query.artifactType === 'string' ? req.query.artifactType : null,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    return res.json({ success: true, artifacts });
  })
);

router.post(
  '/wave5',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    try {
      const artifact = await createWave5Artifact({
        organizationId,
        userId,
        artifactType: req.body.artifactType,
        title: String(req.body.title || 'Untitled artifact'),
        content: String(req.body.content || ''),
        canonicalFormat: req.body.canonicalFormat,
        contentMd: req.body.contentMd,
        contentJson: req.body.contentJson,
        contentSchemaVersion: req.body.contentSchemaVersion,
        projectId: req.body.projectId || null,
        conversationId: req.body.conversationId || null,
        researchSessionId: req.body.researchSessionId || null,
        aiRunId: req.body.aiRunId || null,
        trustBundleId: req.body.trustBundleId || null,
        citations: Array.isArray(req.body.citations) ? req.body.citations : [],
        sourceRefs: Array.isArray(req.body.sourceRefs) ? req.body.sourceRefs : [],
        metadata:
          req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
      });
      return res.status(201).json({ success: true, artifact });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

router.post(
  '/wave5/fill-template',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await fillWave5DocumentTemplate({
      organizationId,
      userId,
      artifactId: req.body.artifactId || null,
      artifactType: req.body.artifactType,
      title: req.body.title,
      template: String(req.body.template || ''),
      fields: req.body.fields && typeof req.body.fields === 'object' ? req.body.fields : {},
      projectId: req.body.projectId || null,
      conversationId: req.body.conversationId || null,
    });
    return res.status(result.needsInput ? 200 : 201).json(result);
  })
);

router.post(
  '/wave5/generate',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const artifact = await generateWave5StructuredArtifact({
      organizationId,
      userId,
      outputKind: req.body.outputKind,
      prompt: String(req.body.prompt || ''),
      title: req.body.title || null,
      projectId: req.body.projectId || null,
      conversationId: req.body.conversationId || null,
      researchSessionId: req.body.researchSessionId || null,
      aiRunId: req.body.aiRunId || null,
      trustBundleId: req.body.trustBundleId || null,
      citations: Array.isArray(req.body.citations) ? req.body.citations : [],
      sourceRefs: Array.isArray(req.body.sourceRefs) ? req.body.sourceRefs : [],
    });
    return res.status(201).json({ success: true, artifact });
  })
);

router.get(
  '/wave5/:artifactId',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const artifact = await getWave5Artifact(String(req.params.artifactId), organizationId);
    if (!artifact) return res.status(404).json({ success: false, error: 'Artifact not found' });
    return res.json({ success: true, artifact });
  })
);

router.get(
  '/wave5/:artifactId/versions',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const versions = await listWave5ArtifactVersions(String(req.params.artifactId), organizationId);
    return res.json({ success: true, versions });
  })
);

router.get(
  '/wave5/:artifactId/mutations',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const mutations = await listWave5Mutations(String(req.params.artifactId), organizationId);
    return res.json({ success: true, mutations });
  })
);

router.post(
  '/wave5/:artifactId/mutations',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    try {
      const mutation = await proposeWave5Mutation({
        organizationId,
        userId,
        artifactId: String(req.params.artifactId),
        proposedContent: String(req.body.proposedContent || ''),
        summary: req.body.summary || null,
        mutationType: req.body.mutationType || null,
        metadata:
          req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
      });
      return res.status(201).json({ success: true, mutation });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

router.post(
  '/wave5/mutations/:mutationId/reject',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    try {
      const mutation = await rejectWave5Mutation({
        mutationId: String(req.params.mutationId),
        organizationId,
        userId,
      });
      return res.json({ success: true, mutation });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

router.post(
  '/wave5/mutations/:mutationId/approve',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    try {
      const mutation = await approveWave5Mutation({
        mutationId: String(req.params.mutationId),
        organizationId,
        userId,
      });
      return res.json({ success: true, mutation });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

router.post(
  '/wave5/mutations/:mutationId/commit',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    try {
      const artifact = await commitWave5Mutation({
        mutationId: String(req.params.mutationId),
        organizationId,
        userId,
      });
      return res.json({ success: true, artifact });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

router.post(
  '/wave5/mutations/:mutationId/approve-and-commit',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    try {
      const artifact = await approveAndCommitWave5Mutation({
        mutationId: String(req.params.mutationId),
        organizationId,
        userId,
      });
      return res.json({ success: true, artifact });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

const EXPORTABLE_STATES = ['approved', 'published'] as const;

async function assertArtifactExportable(
  req: Request,
  res: Response,
  artifactId: string
): Promise<{ organizationId: string } | null> {
  const { organizationId, userId, roleKey } = getAuthContext(req);
  const artifact = await artifactRegistryService.getArtifactForUser({
    organizationId,
    artifactId,
    userId,
    roleKey,
  });
  if (!artifact) {
    res.status(404).json({ success: false, error: 'Artifact not found' });
    return null;
  }
  if (!(EXPORTABLE_STATES as readonly string[]).includes(artifact.publishState)) {
    res.status(403).json({
      success: false,
      error: 'Artifact must be approved before export',
      code: 'EXPORT_NOT_APPROVED',
      publishState: artifact.publishState,
    });
    return null;
  }
  return { organizationId };
}

router.get(
  '/wave5/:artifactId/export-manifest',
  asyncHandler(async (req: Request, res: Response) => {
    const artifactId = String(req.params.artifactId);
    const ctx = await assertArtifactExportable(req, res, artifactId);
    if (!ctx) return;
    try {
      const manifest = await buildWave5ExportManifest(artifactId, ctx.organizationId);
      return res.json({ success: true, manifest });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

router.post(
  '/wave5/:artifactId/exported',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const artifactId = String(req.params.artifactId);
    const ctx = await assertArtifactExportable(req, res, artifactId);
    if (!ctx) return;
    try {
      const artifact = await markWave5ArtifactExported(artifactId, ctx.organizationId);
      return res.json({ success: true, artifact });
    } catch (error) {
      return respondWave5RuntimeError(res, error);
    }
  })
);

// Legacy compatibility alias. Canonical ArtifactRun contract lives under /api/artifact-runs/*.
router.post(
  '/runs/from-chat',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req);
    const result = await artifactRegistryService.planArtifactFromChat({
      organizationId,
      userId,
      conversationId: String(req.body?.conversationId || ''),
      contextSnapshotId: String(req.body?.contextSnapshotId || ''),
      goal: String(req.body?.goal || ''),
      requestedArtifactFamily: req.body?.requestedArtifactFamily,
      requestedOutputType: req.body?.requestedOutputType,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/:id/action-target',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json({ data: buildActionTargetPayload(artifact) });
  })
);

router.get(
  '/:id/access',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const payload = await buildArtifactTrustPayload({ artifact, organizationId, userId, roleKey });
    res.json(payload);
  })
);

router.get(
  '/:id/trust-state',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const payload = await buildArtifactTrustPayload({ artifact, organizationId, userId, roleKey });
    res.json({ data: payload });
  })
);

router.post(
  '/:id/access',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    if (!canManageArtifactAccess({ userId, roleKey, ownerUserId: artifact.ownerUserId })) {
      return res.status(403).json({ error: 'Insufficient permissions to change artifact access' });
    }

    const grant = await artifactRegistryService.createArtifactAccessGrant({
      organizationId,
      artifactId: artifact.artifactId,
      grantKind: req.body?.grantKind,
      userId: req.body?.userId ?? null,
      roleKey: req.body?.roleKey ?? null,
      createdBy: userId,
    });
    res.status(201).json({ data: grant });
  })
);

router.post(
  '/:id/start-review',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // P24-C rollback posture: allow disabling template review without disabling browse/generate.
    if (
      artifact.artifactFamily === 'template' &&
      String(process.env.V8_TEMPLATES_REVIEW_ENABLED || 'true').toLowerCase() === 'false'
    ) {
      return res.status(503).json({
        error: 'Template review is temporarily disabled (rollback posture). Please retry later.',
      });
    }

    try {
      const reviewersRaw = Array.isArray(req.body?.reviewers)
        ? req.body.reviewers.map((value: unknown) => String(value))
        : [];
      let reviewers = reviewersRaw;

      // P24-B: for org-scope templates, auto-assign org admins/owners as reviewers
      // (so the submitter doesn't need to know user IDs).
      if (reviewers.length === 0 && artifact.artifactFamily === 'template') {
        const templateScope = String((artifact.originSummary as any)?.template?.scope || '')
          .trim()
          .toLowerCase();
        if (templateScope === 'org' || templateScope === 'organization') {
          const members = await organizationService.getMembers(organizationId);
          reviewers = (members || [])
            .filter((m: any) => {
              const role = String(m?.role || '').toUpperCase();
              return role === 'OWNER' || role === 'ADMIN';
            })
            .map((m: any) => String(m?.user_id || ''))
            .filter((id) => Boolean(id) && id !== userId);
        }
      }

      const started = await artifactRegistryService.startArtifactReview({
        artifactId: artifact.artifactId,
        organizationId,
        actorUserId: userId,
        reviewers,
      });

      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: 'start_review',
        resourceType: 'artifact',
        resourceId: artifact.artifactId,
        after: { reviewers, publishState: started?.publishState || 'reviewable_share' },
      });

      activityService
        .log({
          organizationId,
          userId,
          action: 'artifact_review_started',
          entityType: 'artifact',
          entityId: artifact.artifactId,
          entityName: (artifact as any).title || artifact.artifactId,
          metadata: { reviewers, artifactFamily: artifact.artifactFamily },
        })
        .catch((err) => {
          logger.warn('[artifacts] Failed to log review activity', { error: err });
        });

      return res.status(200).json({ data: started });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      if (rawMessage.includes('cannot enter review before artifact validation passes')) {
        return res
          .status(409)
          .json({ error: 'Cannot enter review before artifact validation passes' });
      }
      throw error;
    }
  })
);

/**
 * POST /api/artifacts/:id/save-as-template
 * Creates a template artifact from an existing output artifact (report / presentation).
 *
 * This is the P24-B "save-as-template" entrypoint. It creates a legacy runtime template record
 * (report_builder_templates / presentation_templates) and registers it as a canonical Outputs artifact
 * (artifact_family='template') so it can be published/governed via P18/P19 semantics.
 */
router.post(
  '/:id/save-as-template',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const sourceArtifactId = String(req.params.id || '');
    const name = String(req.body?.name || '').trim();
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const scope = String(req.body?.scope || 'user')
      .trim()
      .toLowerCase(); // user | org

    if (!name) {
      return res.status(422).json({ error: 'Template name is required' });
    }

    const source = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: sourceArtifactId,
      userId,
      roleKey,
    });
    if (!source) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    if (
      source.originRuntime !== 'report' &&
      source.originRuntime !== 'presentation' &&
      source.originRuntime !== 'sheet'
    ) {
      return res
        .status(409)
        .json({ error: 'Only report, presentation or sheet outputs can be saved as templates' });
    }

    const templateScope = scope === 'org' ? 'org' : 'user';
    const templateId = uuidv4();

    if (source.originRuntime === 'report') {
      const reportId = String(source.originRecordId || '').trim();
      const reportSvc = await import('../services/reportBuilderService.js');
      const reportBundle = await reportSvc.getReport(reportId, organizationId);
      if (!reportBundle) {
        return res.status(404).json({ error: 'Source report not found' });
      }

      const sections = (reportBundle.sections || []).map((s: any) => ({
        key: s.sectionKey,
        title: s.title,
        sectionType: s.sectionType,
        orderIndex: s.orderIndex,
        enabled: Boolean(s.enabled),
        required: Boolean(s.required),
        length: s.length,
        language: s.language,
      }));

      await reportSvc.createTemplate({
        id: templateId,
        organizationId,
        name,
        description,
        sourceType: String(reportBundle.report.sourceType || 'ASSESSMENT'),
        reportType: String(reportBundle.report.reportType || 'custom'),
        sections,
        defaultOptions: null,
        isPublic: false,
        createdBy: userId,
      });

      const templateArtifact = await artifactRegistryService.registerArtifactOrigin({
        organizationId,
        outputType: 'report',
        artifactFamily: 'template',
        originRuntime: 'report_template',
        originRecordId: templateId,
        titleSnapshot: name,
        ownerUserId: userId,
        createdBy: userId,
        deliveryState: 'draft',
        visibilityScope: 'private',
        originSummary: {
          template: {
            scope: templateScope,
            status: 'draft',
            description,
            reportType: String(reportBundle.report.reportType || 'custom'),
            structureBlueprint: {
              sections: sections.map((s: any) => ({ key: s.key, title: s.title })),
            },
            metadata: {
              createdBy: userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              legacyTemplateId: templateId,
              sourceArtifactId,
            },
          },
        },
      });

      return res.status(201).json({ data: templateArtifact });
    }

    // sheet (arkusz Excel) → tp_base_templates via deliverableTemplateService
    // (Fala B, 2026-07-22). Reuses the same 'table'-type template path the
    // Template Builder already writes through — see
    // server/src/services/deliverableTemplateService.ts createDeliverableTemplate
    // — instead of duplicating the insert here, so the sheet_template origin
    // mapping (registerBuilderTemplateArtifactBestEffort) is exercised for real.
    if (source.originRuntime === 'sheet') {
      const workbookId = String(source.originRecordId || '').trim();
      const workbookRow = await dbGet<{ schema_json: string | null }>(
        `SELECT schema_json FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
        [workbookId, organizationId]
      );
      if (!workbookRow) {
        return res.status(404).json({ error: 'Source workbook not found' });
      }

      let schemaSnapshot: unknown = {};
      try {
        schemaSnapshot = workbookRow.schema_json ? JSON.parse(workbookRow.schema_json) : {};
      } catch {
        schemaSnapshot = {};
      }

      const deliverableTemplateService = await import('../services/deliverableTemplateService.js');
      // createDeliverableTemplate mints its own tp_base_templates row id
      // (gen_random_uuid()::text) — NOT the route-level `templateId` above
      // (that one's scoped to the legacy report_template/presentation_template
      // branches) — so use the id it actually returns to look the artifact up.
      const createdTemplate = await deliverableTemplateService.createDeliverableTemplate(
        'table',
        name,
        description || undefined,
        { schema_snapshot: schemaSnapshot, category: 'excel' },
        organizationId,
        userId
      );

      const templateArtifact = await artifactRegistryService.getArtifactByOrigin({
        organizationId,
        originRuntime: 'sheet_template',
        originRecordId: createdTemplate.id,
        userId,
        roleKey,
      });

      return res.status(201).json({ data: templateArtifact ?? createdTemplate });
    }

    // presentation → presentation_templates
    const deckId = String(source.originRecordId || '').trim();
    const deckRow = await dbGet<any>(
      `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
      [deckId, organizationId]
    );
    if (!deckRow) {
      return res.status(404).json({ error: 'Source presentation not found' });
    }

    const outline = (() => {
      try {
        return JSON.parse(deckRow.outline_json || '[]');
      } catch {
        return [];
      }
    })();

    await dbRun(
      `INSERT INTO presentation_templates (
        id, organization_id, name, description, deck_type,
        audience, goal, language_default, confidentiality_default, theme,
        outline_json, max_slides, min_slides,
        must_have_intents, recommended_visuals,
        is_system, is_active, cloned_from, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        templateId,
        organizationId,
        name,
        description || null,
        deckRow.deck_type || 'custom',
        deckRow.audience || 'executive',
        deckRow.goal || 'inform',
        deckRow.language || 'en',
        deckRow.confidentiality || 'internal',
        deckRow.theme || 'corporate',
        JSON.stringify(Array.isArray(outline) ? outline : []),
        25,
        5,
        JSON.stringify([]),
        JSON.stringify([]),
        userId,
      ]
    );

    const templateArtifact = await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'template',
      originRuntime: 'presentation_template',
      originRecordId: templateId,
      titleSnapshot: name,
      ownerUserId: userId,
      createdBy: userId,
      deliveryState: 'draft',
      visibilityScope: 'private',
      originSummary: {
        template: {
          scope: templateScope,
          status: 'draft',
          description,
          deckType: String(deckRow.deck_type || 'custom'),
          structureBlueprint: { outline: Array.isArray(outline) ? outline : [] },
          metadata: {
            createdBy: userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            legacyTemplateId: templateId,
            sourceArtifactId,
          },
        },
      },
    });

    return res.status(201).json({ data: templateArtifact });
  })
);

/**
 * POST /api/artifacts/:id/publish
 * Minimal governed publish for template artifacts (P24-B).
 *
 * Assumes a publish record already exists (e.g. via POST /:id/start-review).
 * Transitions reviewable_share → in_review → approved → published, submits a review gate,
 * and flips the artifact visibility to organization scope.
 */
router.post(
  '/:id/publish',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifactId = String(req.params.id || '');
    const reviewType = String(req.body?.reviewType || 'peer_review');
    const comments = typeof req.body?.comments === 'string' ? req.body.comments : null;

    if (!canPublishOrgTemplate(roleKey)) {
      return res
        .status(403)
        .json({ error: 'Only admins/owners can publish organization templates' });
    }

    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId,
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    if (artifact.artifactFamily !== 'template') {
      return res
        .status(409)
        .json({ error: 'Only template artifacts can be published via this endpoint' });
    }

    // P24-C rollback posture: disable template publish without disabling browse/generate.
    if (String(process.env.V8_TEMPLATES_PUBLISH_ENABLED || 'true').toLowerCase() === 'false') {
      return res.status(503).json({
        error:
          'Template publishing is temporarily disabled (rollback posture). Please retry later.',
      });
    }

    const templateScope = String((artifact.originSummary as any)?.template?.scope || '')
      .trim()
      .toLowerCase();
    if (
      templateScope !== 'org' &&
      templateScope !== 'organization' &&
      templateScope !== 'app' &&
      templateScope !== 'application'
    ) {
      return res.status(409).json({
        error:
          'Only organization/system templates can be published. Create an org-scope template first.',
      });
    }

    // P24 contract: fail-closed when provenance stamp cannot be minted (simulate P18 outage).
    if (
      (templateScope === 'org' ||
        templateScope === 'organization' ||
        templateScope === 'app' ||
        templateScope === 'application') &&
      String(process.env.V8_PROVENANCE_STAMP_ENABLED || 'true').toLowerCase() === 'false'
    ) {
      return res.status(503).json({
        error:
          'Provenance stamp unavailable (P18). Publishing is blocked (fail closed). Please retry later.',
      });
    }

    const record = await publishReviewService.getPublishRecord(artifactId, organizationId);
    if (!record) {
      return res.status(409).json({ error: 'Publish record missing. Start review first.' });
    }
    if (record.currentState === 'published') {
      return res.status(200).json({ data: { publishRecord: record, gate: null } });
    }

    let current = record;
    if (current.currentState === 'reviewable_share') {
      current = await publishReviewService.transitionPublishState({
        recordId: current.recordId,
        organizationId,
        newState: 'in_review',
        actor: userId,
      });
    }

    let gate;
    try {
      gate = await publishReviewService.submitReviewGate({
        artifactId,
        organizationId,
        reviewType: reviewType as any,
        reviewerId: userId,
        result: 'approved',
        comments,
      });

      if (current.currentState === 'in_review') {
        current = await publishReviewService.transitionPublishState({
          recordId: current.recordId,
          organizationId,
          newState: 'approved',
          actor: userId,
        });
      }

      if (current.currentState === 'approved') {
        current = await publishReviewService.transitionPublishState({
          recordId: current.recordId,
          organizationId,
          newState: 'published',
          actor: userId,
        });
      }
    } catch (error) {
      if (error instanceof publishReviewService.PublishReviewError) {
        return res.status(409).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    await updateTemplateArtifactPostPublish({
      artifactId,
      organizationId,
      publishedBy: userId,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      publishState: current.currentState,
      validationState: 'validated',
    });

    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'publish',
      resourceType: 'artifact',
      resourceId: artifactId,
      after: { publishState: current.currentState, reviewType },
    });

    res.status(200).json({ data: { publishRecord: current, gate } });
  })
);

/**
 * POST /api/artifacts/:id/deprecate
 * Marks a template artifact as deprecated with an optional migrationHint (P24 contract §2.3.3).
 * Deprecated templates remain browsable (read-only) but are excluded from selection by default.
 */
router.post(
  '/:id/deprecate',
  requireAudit,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifactId = String(req.params.id || '');
    const deprecationReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const migrationHint =
      typeof req.body?.migrationHint === 'string' ? req.body.migrationHint.trim() : null;
    const replacedByArtifactId =
      typeof req.body?.replacedByArtifactId === 'string'
        ? req.body.replacedByArtifactId.trim()
        : null;

    if (!canPublishOrgTemplate(roleKey)) {
      return res.status(403).json({ error: 'Only admins/owners can deprecate templates' });
    }

    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId,
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    if (artifact.artifactFamily !== 'template') {
      return res
        .status(409)
        .json({ error: 'Only template artifacts can be deprecated via this endpoint' });
    }

    const now = new Date().toISOString();
    const row = await dbGet<{ origin_summary_json: string | null }>(
      `SELECT origin_summary_json FROM v8_output_artifacts
       WHERE artifact_id = ? AND organization_id = ?`,
      [artifactId, organizationId]
    );
    let summary: Record<string, unknown> | null = null;
    try {
      summary = row?.origin_summary_json ? (JSON.parse(row.origin_summary_json) as any) : null;
    } catch {
      summary = null;
    }

    const nextSummary = summary && typeof summary === 'object' ? { ...summary } : {};
    const template =
      (nextSummary as any).template && typeof (nextSummary as any).template === 'object'
        ? { ...(nextSummary as any).template }
        : {};
    template.status = 'deprecated';
    template.deprecationReason = deprecationReason || null;
    template.migrationHint = migrationHint;
    template.replacedByArtifactId = replacedByArtifactId;
    template.metadata = {
      ...(template.metadata && typeof template.metadata === 'object' ? template.metadata : {}),
      deprecatedBy: userId,
      deprecatedAt: now,
      updatedAt: now,
    };
    (nextSummary as any).template = template;

    await dbRun(
      `UPDATE v8_output_artifacts
       SET origin_summary_json = ?,
           last_transition_at = ?
       WHERE artifact_id = ? AND organization_id = ?`,
      [JSON.stringify(nextSummary), now, artifactId, organizationId]
    );

    if (process.env.V8_TEMPLATES_EXECUTION_SPINE_ENABLED === 'true') {
      try {
        await executionSpineService.createRun({
          organizationId,
          artifactId,
          agentType: 'template_deprecation',
          userId,
          goalDescription: `Deprecate template: ${deprecationReason || 'no reason'}`,
        } as any);
      } catch {
        // Non-fatal: spine integration is supplementary
      }
    }

    await (req as any).emitAuditEvent?.({
      actorType: 'USER',
      action: 'deprecate',
      resourceType: 'artifact',
      resourceId: artifactId,
      after: {
        status: 'deprecated',
        deprecationReason: deprecationReason || null,
        migrationHint,
        replacedByArtifactId,
      },
    });

    res.status(200).json({
      data: {
        artifactId,
        status: 'deprecated',
        deprecationReason: deprecationReason || null,
        migrationHint,
        replacedByArtifactId,
      },
    });
  })
);

router.get(
  '/:id/usage-count',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const artifactId = String(req.params.id || '');
    const count = await artifactRegistryService.countTemplateUsage(artifactId, organizationId);
    res.json({ data: { artifactId, usageCount: count } });
  })
);

router.get(
  '/:id/content',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const content = await resolveArtifactContent({
      artifactId: String(req.params.id || ''),
      organizationId,
    });
    res.setHeader('ETag', content.etag);
    res.setHeader('Cache-Control', 'private, must-revalidate');
    const candidates = String(req.headers['if-none-match'] || '')
      .split(',')
      .map((value) => value.trim());
    if (candidates.includes('*') || candidates.includes(content.etag)) {
      return res.status(304).end();
    }
    const { etag: _etag, ...payload } = content;
    res.json({ data: payload });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleKey } = getAuthContext(req);
    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId,
      artifactId: String(req.params.id || ''),
      userId,
      roleKey,
    });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const originLinks = await artifactRegistryService.getArtifactOriginLinks(
      artifact.artifactId,
      organizationId
    );
    res.json({ data: artifact, originLinks });
  })
);

export default router;
