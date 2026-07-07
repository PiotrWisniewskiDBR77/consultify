/**
 * Workbook Artifact Service — shared server-side entry point for the `.xlsx`
 * generator (WorkbookGeneratorService → WorkbookBuilder → ExcelJS).
 *
 * Extracted so that BOTH callers produce a single, consistent `generated_workbooks`
 * row:
 *   1. POST /api/workbook/generate            (workbook.routes.ts)
 *   2. materializeArtifactRun (outputType:'sheet', sheetRuntime:'workbook')
 *      (artifactRegistryService.ts)
 *
 * Before this existed, only the route generated workbooks; the V8 materialize path
 * created a `tp_tables` row instead, and the client then fired a SECOND, unlinked
 * `generate` call — one user action produced two independent "sheet" artifacts
 * (the split-brain fixed by D1(a) in _PLANY_KONCOWE_2026-07-07/07_excel_sheet.md).
 *
 * This module intentionally does NOT depend on artifactRegistryService: it only
 * generates + persists the workbook row. Each caller is responsible for its own
 * V8 origin registration (the route and materialize both call registerArtifactOrigin
 * directly), which keeps the dependency graph acyclic.
 */

import type { WorkbookGenerationResult } from './WorkbookGeneratorService.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

/**
 * Ensure the `generated_workbooks` storage table exists (lazy-DDL, fail-soft).
 * Mirrors the schema previously inlined in workbook.routes.ts.
 */
export async function ensureWorkbookSchema(): Promise<void> {
  try {
    await queryHelpers.queryRun(`
      CREATE TABLE IF NOT EXISTS generated_workbooks (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        prompt TEXT,
        schema_json TEXT,
        sheet_count INTEGER DEFAULT 1,
        file_name TEXT,
        file_size INTEGER,
        validation_errors TEXT,
        quality_score REAL,
        pipeline_log TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS action_contract_json TEXT DEFAULT '{}'`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS source_pack_json TEXT DEFAULT '{}'`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS evidence_refs_json TEXT DEFAULT '[]'`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_workbooks_org ON generated_workbooks(organization_id)`
    );
  } catch {
    /* table may already exist */
  }
}

export interface GenerateAndPersistWorkbookParams {
  prompt: string;
  userId: string;
  organizationId: string;
  projectId?: string | null;
  researchContext?: string;
  language?: string;
  /** Optional provenance blobs persisted alongside the workbook metadata. */
  actionContract?: unknown;
  sourcePack?: unknown;
  evidenceRefs?: unknown;
}

/**
 * Run the 5-phase workbook generator and persist the resulting metadata row.
 *
 * Persistence is best-effort (matches the route's prior behaviour): a failed
 * INSERT is logged but does not fail the generation — the caller still gets the
 * in-memory result and can serve/download it, and `/download` rebuilds from the
 * stored schema when available.
 */
export async function generateAndPersistWorkbook(
  params: GenerateAndPersistWorkbookParams
): Promise<WorkbookGenerationResult> {
  await ensureWorkbookSchema();

  const { default: WorkbookGeneratorService } = await import('./WorkbookGeneratorService.js');

  const result = await WorkbookGeneratorService.generate({
    prompt: params.prompt,
    userId: params.userId,
    organizationId: params.organizationId,
    projectId: params.projectId || null,
    researchContext: params.researchContext,
    language: params.language,
  });

  try {
    await queryHelpers.queryRun(
      `INSERT INTO generated_workbooks (id, organization_id, title, description, prompt, schema_json, sheet_count, file_name, file_size, validation_errors, quality_score, pipeline_log, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        params.organizationId,
        result.schema.title,
        result.schema.description || null,
        params.prompt,
        JSON.stringify(result.schema),
        result.schema.sheets.length,
        result.fileName,
        result.buffer.length,
        result.validationErrors.length > 0 ? JSON.stringify(result.validationErrors) : null,
        result.qualityScore,
        JSON.stringify(result.pipelineLog),
        JSON.stringify(
          params.actionContract && typeof params.actionContract === 'object'
            ? params.actionContract
            : {}
        ),
        JSON.stringify(
          params.sourcePack && typeof params.sourcePack === 'object' ? params.sourcePack : {}
        ),
        JSON.stringify(Array.isArray(params.evidenceRefs) ? params.evidenceRefs : []),
        params.userId,
        result.generatedAt,
      ]
    );
  } catch (err) {
    logger.warn('[WorkbookArtifactService] Failed to persist workbook metadata:', err);
  }

  return result;
}
