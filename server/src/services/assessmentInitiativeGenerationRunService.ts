/**
 * AssessmentInitiativeGenerationRunService
 *
 * Enterprise orchestration for generating large initiative portfolios (50+).
 * Creates a "run" record, then generates multiple sub-batches (default size 7),
 * persisting initiatives as DRAFT and linking them to the assessment.
 *
 * Design goals:
 * - auditable progress (runs + batches)
 * - retry per batch
 * - backward-compatible with schema variations (optional columns)
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import AssessmentInitiativeService from './assessmentInitiativeService.js';
import { upsertActiveAssessmentInitiativeBatch } from './assessment/AssessmentWorkbenchService.js';

export type InitiativeGenerationRunMode = 'ASSESSMENT_REPORT' | 'REPORT_ONLY';
export type InitiativeGenerationRunStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

type AssessmentRow = any;

type CreateRunParams = {
  assessmentId: string;
  organizationId: string;
  userId: string;
  mode: InitiativeGenerationRunMode;
  methodologyId: string;
  requestedCount: number;
  batchSize: number;
  includeChatContext: boolean;
  reportId?: string | null;
  templateId?: string | null;
  consultantBrief?: string | null;
};

type RunProgress = {
  runId: string;
  assessmentId: string;
  status: InitiativeGenerationRunStatus;
  mode: InitiativeGenerationRunMode;
  methodologyId: string;
  requestedCount: number;
  batchSize: number;
  generatedCount: number;
  batchesPlanned: number;
  batchesCreated: number;
  batchesSucceeded: number;
  batchesFailed: number;
  startedAt: string | null;
  updatedAt: string | null;
  error?: string | null;
};

const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const safeJsonStringify = (value: any): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
};

const nowIso = () => new Date().toISOString();

async function insertBatch(params: {
  batchId: string;
  runId: string;
  assessmentId: string;
  organizationId: string;
  methodologyId: string;
  initiativesCount: number;
  includeChatContext: boolean;
  generatedBy: string;
  createdAt: string;
  reportId?: string | null;
}) {
  return upsertActiveAssessmentInitiativeBatch({
    batchId: params.batchId,
    assessmentId: params.assessmentId,
    organizationId: params.organizationId,
    fields: {
      methodology_id: params.methodologyId,
      initiatives_count: params.initiativesCount,
      include_chat_context: params.includeChatContext ? 1 : 0,
      generated_by: params.generatedBy,
      created_at: params.createdAt,
      report_id: params.reportId ? String(params.reportId) : null,
      run_id: params.runId,
    },
  });
}

async function updateBatchCount(batchId: string, count: number) {
  try {
    await queryHelpers.queryRun(
      `UPDATE assessment_initiative_batches SET initiatives_count = ? WHERE id = ?`,
      [count, batchId]
    );
  } catch {
    // ignore schema-variant failures
  }
}

async function applyTemplateToInitiatives(
  initiativeIds: string[],
  templateId: string
): Promise<void> {
  if (!initiativeIds.length) return;
  const placeholders = initiativeIds.map(() => '?').join(', ');
  await queryHelpers.queryRun(
    `UPDATE initiatives SET initiative_template_id = ? WHERE id IN (${placeholders})`,
    [templateId, ...initiativeIds]
  );
}

async function fetchAssessment(
  assessmentId: string,
  organizationId: string
): Promise<AssessmentRow | null> {
  return await queryHelpers.queryOne<any>(
    `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
    [assessmentId, organizationId]
  );
}

async function fetchExistingLinkedInitiatives(
  assessmentId: string
): Promise<Array<{ id?: string; title?: string; status?: string; reportId?: string }>> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT i.id, COALESCE(i.title, i.name) as title, i.status, i.report_id as "reportId"
     FROM assessment_initiative_links l
     LEFT JOIN initiatives i ON l.initiative_id = i.id
     WHERE l.assessment_id = ?
     ORDER BY l.created_at DESC
     LIMIT 200`,
    [assessmentId]
  );
  return (rows || []).map((r: any) => ({
    id: r?.id,
    title: r?.title,
    status: r?.status,
    reportId: r?.reportId,
  }));
}

async function fetchReportContext(
  assessmentId: string,
  reportId?: string | null
): Promise<any | null> {
  try {
    const reportRow = reportId
      ? await queryHelpers.queryOne<any>(
          `SELECT * FROM assessment_reports WHERE id = ? AND assessment_id = ? LIMIT 1`,
          [String(reportId), String(assessmentId)]
        )
      : await queryHelpers.queryOne<any>(
          `SELECT * FROM assessment_reports WHERE assessment_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`,
          [String(assessmentId)]
        );
    if (!reportRow) return null;
    // Support multiple schema variants:
    // - v2: content_json (JSON)
    // - legacy: executive_summary / detailed_analysis / recommendations
    const content = reportRow.content_json
      ? safeJsonParse(reportRow.content_json, {})
      : {
          executiveSummary: reportRow.executive_summary || reportRow.executiveSummary || null,
          detailedAnalysis: reportRow.detailed_analysis || reportRow.detailedAnalysis || null,
          recommendations: reportRow.recommendations || null,
          generationParams: reportRow.generation_params || reportRow.generationParams || null,
        };
    return {
      id: reportRow.id,
      assessmentId: reportRow.assessment_id || assessmentId,
      version: reportRow.version,
      status: reportRow.status,
      content,
      approvedAt: reportRow.approved_at || null,
      createdAt: reportRow.created_at || null,
      updatedAt: reportRow.updated_at || null,
    };
  } catch {
    return null;
  }
}

export class AssessmentInitiativeGenerationRunService {
  /**
   * Creates a run record and starts processing asynchronously.
   */
  static async createAndStart(params: CreateRunParams): Promise<{ runId: string }> {
    const runId = uuidv4();
    const createdAt = nowIso();
    const assessment = await fetchAssessment(params.assessmentId, params.organizationId);
    const workbench = safeJsonParse<Record<string, any>>(
      String(assessment?.p28_workbench_v1 || ''),
      {}
    );
    const inputs = {
      mode: params.mode,
      methodologyId: params.methodologyId,
      requestedCount: params.requestedCount,
      batchSize: params.batchSize,
      includeChatContext: params.includeChatContext,
      reportId: params.reportId || null,
      templateId: params.templateId || null,
      consultantBrief: params.consultantBrief || null,
      provenance: workbench?.assessmentRunId
        ? {
            assessmentRunId: workbench.assessmentRunId,
            assessmentDefinitionId: workbench?.assessmentDefinitionRef?.definitionId || null,
            assessmentDefinitionVersion: workbench?.assessmentDefinitionRef?.version || null,
            workbenchRunState: workbench?.runState || null,
            interpretationReviewState: workbench?.interpretationReview?.status || null,
            scoreReviewState: workbench?.scoreReview?.status || null,
          }
        : null,
    };
    const stats = {
      batchesPlanned: Math.ceil(params.requestedCount / params.batchSize),
      batchesCreated: 0,
      batchesSucceeded: 0,
      batchesFailed: 0,
      generatedCount: 0,
      retries: 0,
      startedAt: createdAt,
    };

    await queryHelpers.queryRun(
      `INSERT INTO assessment_initiative_generation_runs (
        id, assessment_id, organization_id, report_id, mode, methodology_id,
        requested_count, batch_size, status, created_by,
        inputs_json, stats_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        params.assessmentId,
        params.organizationId,
        params.reportId ? String(params.reportId) : null,
        params.mode,
        params.methodologyId,
        params.requestedCount,
        params.batchSize,
        'RUNNING',
        params.userId,
        safeJsonStringify(inputs),
        safeJsonStringify(stats),
        createdAt,
        createdAt,
      ]
    );

    // Start async (best-effort). Do not block request/response cycle.
    setTimeout(() => {
      void this.processRun(runId).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        // H5.5: processRun handles KNOWN validation failures internally by
        // moving the run to FAILED. An UNEXPECTED rejection here (e.g. a DB read
        // in the setup phase throwing before any status write) would otherwise
        // leave the run stuck at status='RUNNING' FOREVER — getProgress would
        // report a perpetual spinner. Advance the state machine to FAILED so the
        // caller sees a terminal state, and log with correlation (runId).
        logger.error(`[InitiativeGenRun] processRun crashed run=${runId}: ${message}`);
        try {
          await queryHelpers.queryRun(
            `UPDATE assessment_initiative_generation_runs
                SET status = 'FAILED', error = ?, updated_at = ?
              WHERE id = ? AND status = 'RUNNING'`,
            [message.slice(0, 500), nowIso(), runId]
          );
        } catch (markErr: unknown) {
          logger.warn(
            `[InitiativeGenRun] failed to mark run=${runId} FAILED after crash: ${
              markErr instanceof Error ? markErr.message : String(markErr)
            }`
          );
        }
      });
    }, 0);

    return { runId };
  }

  static async getProgress(runId: string, organizationId: string): Promise<RunProgress | null> {
    const run = await queryHelpers.queryOne<any>(
      `SELECT * FROM assessment_initiative_generation_runs WHERE id = ? AND organization_id = ?`,
      [runId, organizationId]
    );
    if (!run) return null;
    const stats = safeJsonParse<any>(run.stats_json, {});

    // Compute counts from DB where possible
    let batchesCreated = 0;
    let generatedCount = 0;
    try {
      const b = await queryHelpers.queryOne<any>(
        `SELECT COUNT(*) as c FROM assessment_initiative_batches WHERE run_id = ?`,
        [runId]
      );
      batchesCreated = Number(b?.c || 0);
    } catch {
      batchesCreated = Number(stats.batchesCreated || 0);
    }
    try {
      const g = await queryHelpers.queryOne<any>(
        `SELECT COUNT(*) as c
         FROM assessment_initiative_links l
         JOIN assessment_initiative_batches b ON b.id = l.batch_id
         WHERE b.run_id = ?`,
        [runId]
      );
      generatedCount = Number(g?.c || 0);
    } catch {
      generatedCount = Number(stats.generatedCount || 0);
    }

    return {
      runId: String(run.id),
      assessmentId: String(run.assessment_id),
      status:
        (String(run.status || 'RUNNING').toUpperCase() as InitiativeGenerationRunStatus) ||
        'RUNNING',
      mode: String(run.mode || 'ASSESSMENT_REPORT') as InitiativeGenerationRunMode,
      methodologyId: String(run.methodology_id || ''),
      requestedCount: Number(run.requested_count || 0),
      batchSize: Number(run.batch_size || 7),
      generatedCount,
      batchesPlanned: Number(
        stats.batchesPlanned ||
          Math.ceil(Number(run.requested_count || 0) / Number(run.batch_size || 7))
      ),
      batchesCreated,
      batchesSucceeded: Number(stats.batchesSucceeded || 0),
      batchesFailed: Number(stats.batchesFailed || 0),
      startedAt: stats.startedAt || run.created_at || null,
      updatedAt: run.updated_at || null,
      error: run.error || null,
    };
  }

  static async listRuns(assessmentId: string, organizationId: string): Promise<any[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT id, assessment_id as "assessmentId", report_id as "reportId", mode, methodology_id as "methodologyId",
              requested_count as "requestedCount", batch_size as "batchSize", status, created_by as "createdBy",
              inputs_json as "inputsJson", created_at as "createdAt", updated_at as "updatedAt"
       FROM assessment_initiative_generation_runs
       WHERE assessment_id = ? AND organization_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [assessmentId, organizationId]
    );
    return (rows || []).map((row: any) => {
      const inputs = safeJsonParse<any>(row.inputsJson, {});
      return {
        ...row,
        provenance: inputs?.provenance || null,
      };
    });
  }

  static async listRunInitiatives(
    runId: string,
    organizationId: string,
    limit: number = 200
  ): Promise<Array<{ id: string; title: string; status: string; createdAt: string }>> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT i.id,
              COALESCE(i.title, i.name) as title,
              UPPER(COALESCE(i.status,'DRAFT')) as status,
              COALESCE(l.created_at, i.created_at) as "createdAt"
       FROM assessment_initiative_links l
       JOIN assessment_initiative_batches b ON b.id = l.batch_id
       JOIN initiatives i ON i.id = l.initiative_id
       WHERE b.run_id = ? AND i.organization_id = ?
       ORDER BY l.created_at DESC
       LIMIT ?`,
      [runId, organizationId, limit]
    );
    return (rows || []).map((r: any) => ({
      id: String(r.id),
      title: String(r.title || 'Untitled'),
      status: String(r.status || 'DRAFT'),
      createdAt: String(r.createdAt || ''),
    }));
  }

  static async bulkSubmitRunDrafts(params: {
    runId: string;
    assessmentId: string;
    organizationId: string;
    actorId: string;
    actorRole: string;
  }): Promise<{ updated: number }> {
    // Ensure run exists and belongs to assessment/org
    const run = await queryHelpers.queryOne<any>(
      `SELECT id, assessment_id, organization_id FROM assessment_initiative_generation_runs WHERE id = ?`,
      [params.runId]
    );
    if (
      !run ||
      String(run.assessment_id) !== String(params.assessmentId) ||
      String(run.organization_id) !== String(params.organizationId)
    ) {
      throw new Error('Run not found');
    }

    const role = String(params.actorRole || '').toUpperCase();
    const updatedAt = nowIso();

    // Consultant can only submit initiatives they created (created_by)
    if (role === 'CONSULTANT') {
      await queryHelpers.queryRun(
        `UPDATE initiatives
         SET status = 'PENDING_REVIEW', updated_at = ?
         WHERE id IN (
           SELECT i.id
           FROM assessment_initiative_links l
           JOIN assessment_initiative_batches b ON b.id = l.batch_id
           JOIN initiatives i ON i.id = l.initiative_id
           WHERE b.run_id = ? AND i.organization_id = ? AND i.status = 'DRAFT' AND i.created_by = ?
         )`,
        [updatedAt, params.runId, params.organizationId, params.actorId]
      );
    } else {
      await queryHelpers.queryRun(
        `UPDATE initiatives
         SET status = 'PENDING_REVIEW', updated_at = ?
         WHERE id IN (
           SELECT i.id
           FROM assessment_initiative_links l
           JOIN assessment_initiative_batches b ON b.id = l.batch_id
           JOIN initiatives i ON i.id = l.initiative_id
           WHERE b.run_id = ? AND i.organization_id = ? AND i.status = 'DRAFT'
         )`,
        [updatedAt, params.runId, params.organizationId]
      );
    }

    const countRow = await queryHelpers.queryOne<any>(
      `SELECT COUNT(*) as c
       FROM initiatives i
       JOIN assessment_initiative_links l ON l.initiative_id = i.id
       JOIN assessment_initiative_batches b ON b.id = l.batch_id
       WHERE b.run_id = ? AND i.organization_id = ? AND i.status = 'PENDING_REVIEW'`,
      [params.runId, params.organizationId]
    );
    return { updated: Number(countRow?.c || 0) };
  }

  /**
   * Background execution loop.
   */
  private static async processRun(runId: string): Promise<void> {
    const run = await queryHelpers.queryOne<any>(
      `SELECT * FROM assessment_initiative_generation_runs WHERE id = ?`,
      [runId]
    );
    if (!run) return;
    if (String(run.status || '').toUpperCase() !== 'RUNNING') return;

    const assessmentId = String(run.assessment_id);
    const organizationId = String(run.organization_id);
    const userId = String(run.created_by);
    const mode = String(run.mode || 'ASSESSMENT_REPORT') as InitiativeGenerationRunMode;
    const methodologyId = String(run.methodology_id || 'impact-feasibility');
    const requestedCount = Number(run.requested_count || 0);
    const batchSize = Math.max(1, Math.min(7, Number(run.batch_size || 7)));
    const inputs = safeJsonParse<any>(run.inputs_json, {});
    const includeChatContext = Boolean(inputs.includeChatContext);
    const reportId = run.report_id
      ? String(run.report_id)
      : inputs.reportId
        ? String(inputs.reportId)
        : null;
    const templateId = inputs?.templateId ? String(inputs.templateId) : null;

    const stats = safeJsonParse<any>(run.stats_json, {});
    stats.batchesPlanned = Math.ceil(requestedCount / batchSize);
    stats.batchesCreated = 0;
    stats.batchesSucceeded = 0;
    stats.batchesFailed = 0;
    stats.generatedCount = 0;
    stats.startedAt = stats.startedAt || run.created_at || nowIso();

    const updateRun = async (
      patch: Partial<{ status: string; stats: any; error: string | null }>
    ) => {
      const updatedAt = nowIso();
      const nextStats = patch.stats ?? stats;
      await queryHelpers.queryRun(
        `UPDATE assessment_initiative_generation_runs
         SET status = COALESCE(?, status),
             stats_json = COALESCE(?, stats_json),
             error = COALESCE(?, error),
             updated_at = ?
         WHERE id = ?`,
        [
          patch.status ? String(patch.status).toUpperCase() : null,
          patch.stats ? safeJsonStringify(nextStats) : null,
          patch.error !== undefined ? patch.error : null,
          updatedAt,
          runId,
        ]
      );
    };

    // Validate assessment presence and baseline constraints (assessment+report mode)
    const assessment = await fetchAssessment(assessmentId, organizationId);
    if (!assessment) {
      await updateRun({ status: 'FAILED', error: 'Assessment not found' });
      return;
    }

    const status = String(assessment.status || '').toUpperCase();
    if (status !== 'APPROVED') {
      await updateRun({
        status: 'FAILED',
        error: 'Assessment must be APPROVED to generate initiatives',
      });
      return;
    }

    // For assessment-driven generation, answers_json must exist (report-only can work without answers).
    if (mode === 'ASSESSMENT_REPORT') {
      if (
        !assessment.answers_json ||
        String(assessment.answers_json) === '{}' ||
        String(assessment.answers_json) === 'null'
      ) {
        await updateRun({
          status: 'FAILED',
          error: 'Missing assessment data (answers_json) for generation',
        });
        return;
      }
    }

    const existingInitiatives = await fetchExistingLinkedInitiatives(assessmentId);
    const reportContextRaw =
      mode === 'ASSESSMENT_REPORT' || mode === 'REPORT_ONLY'
        ? await fetchReportContext(assessmentId, reportId)
        : null;
    const reportContext =
      reportContextRaw && inputs?.consultantBrief
        ? { ...reportContextRaw, consultantBrief: String(inputs.consultantBrief) }
        : reportContextRaw;

    if (mode === 'REPORT_ONLY' && !reportContext) {
      await updateRun({
        status: 'FAILED',
        error: 'Report context is required for REPORT_ONLY generation',
      });
      return;
    }

    let totalCreated = 0;
    for (let offset = 0; offset < requestedCount; offset += batchSize) {
      const batchCount = Math.min(batchSize, requestedCount - offset);
      let batchId = uuidv4();
      const createdAt = nowIso();

      // Create batch row first (required by FK on links)
      try {
        const batchResult = await insertBatch({
          batchId,
          runId,
          assessmentId,
          organizationId,
          methodologyId,
          initiativesCount: batchCount,
          includeChatContext,
          generatedBy: userId,
          createdAt,
          reportId: reportContext?.id
            ? String(reportContext.id)
            : reportId
              ? String(reportId)
              : null,
        });
        // Every writer shares the same exactly-one contract. If another path
        // won the race, all links produced by this run attach to that row.
        if (!batchResult.created) batchId = batchResult.batchId;
        stats.batchesCreated += 1;
        await updateRun({ stats });
      } catch (e: any) {
        stats.batchesFailed += 1;
        await updateRun({ stats, error: e?.message || 'Failed to create batch record' });
        continue;
      }

      // Generate + persist (retry per batch)
      const maxAttempts = 2;
      let attempt = 0;
      let createdThisBatch = 0;
      let lastErr: any = null;
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const initiatives = await AssessmentInitiativeService.generateFromAssessment({
            assessment,
            methodologyId,
            count: batchCount,
            includeChatContext,
            reportContext,
            existingInitiatives,
            userId,
          });
          const created = await AssessmentInitiativeService.persistInitiatives({
            assessment,
            batchId,
            initiatives,
            reportId: reportContext?.id
              ? String(reportContext.id)
              : reportId
                ? String(reportId)
                : null,
            userId,
          });
          createdThisBatch = Array.isArray(created) ? created.length : 0;
          if (templateId && Array.isArray(created) && created.length) {
            await applyTemplateToInitiatives(
              created.map((c: any) => String(c.id)).filter(Boolean),
              templateId
            );
          }
          await updateBatchCount(batchId, createdThisBatch);
          break;
        } catch (err: any) {
          lastErr = err;
          stats.retries = Number(stats.retries || 0) + 1;
        }
      }

      if (createdThisBatch > 0) {
        totalCreated += createdThisBatch;
        stats.generatedCount = totalCreated;
        stats.batchesSucceeded += 1;
        await updateRun({ stats });
      } else {
        stats.batchesFailed += 1;
        await updateRun({
          stats,
          error: lastErr?.message || 'Batch generation failed',
        });
      }
    }

    // Finalize
    const finalStatus =
      totalCreated === requestedCount ? 'SUCCEEDED' : totalCreated > 0 ? 'PARTIAL' : 'FAILED';
    await updateRun({ status: finalStatus, stats });
  }
}

export default AssessmentInitiativeGenerationRunService;
