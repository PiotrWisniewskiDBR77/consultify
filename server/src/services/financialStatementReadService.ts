import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import {
  evaluateStatementReadiness,
  loadLatestStatementVersionSnapshot,
} from './financialStatementService.js';

function isSchemaCompatError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('no such column') ||
    message.includes('does not exist') ||
    message.includes('unknown column') ||
    message.includes('undefined column')
  );
}

function parseValidationMessages(value: unknown) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listStatements(
  organizationId: string,
  readinessFilter = ''
): Promise<Record<string, unknown>[]> {
  const normalizedReadiness = String(readinessFilter || '')
    .trim()
    .toLowerCase();
  try {
    return await dbAll(
      `SELECT fs.id, fs.entity_name, fs.statement_type, fs.period_start, fs.period_end, fs.period_label, fs.currency, fs.scaling, fs.source_file_name,
              fs.overall_confidence, fs.validation_status, fs.status, fs.created_at, fs.updated_at,
              fs.readiness_status, fs.readiness_score, fs.quality_summary, fs.quality_reason_codes,
              fs.document_class, fs.extraction_strategy, fs.template_family, fs.values_version,
              COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE) AS total_line_count,
              COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE AND fsv.canonical_line_id IS NOT NULL) AS mapped_line_count,
              COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE AND fsv.canonical_line_id IS NULL) AS unmapped_line_count,
              COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = TRUE) AS non_financial_line_count,
              CASE
                WHEN fs.readiness_status = 'ready' THEN TRUE
                ELSE FALSE
              END AS is_workable
         FROM financial_statements fs
         LEFT JOIN financial_statement_values fsv ON fsv.statement_id = fs.id
         WHERE fs.organization_id = ?
           AND (? = '' OR LOWER(COALESCE(fs.readiness_status, 'pending')) = ?)
         GROUP BY fs.id
         ORDER BY fs.period_end DESC, fs.created_at DESC
         LIMIT 100`,
      [organizationId, normalizedReadiness, normalizedReadiness],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) {
      throw error;
    }
    return await dbAll(
      `SELECT fs.id, fs.entity_name, fs.statement_type, fs.period_start, fs.period_end, fs.period_label, fs.currency, fs.scaling, fs.source_file_name,
              fs.overall_confidence, fs.validation_status, fs.status, fs.created_at, fs.updated_at,
              COUNT(fsv.id) AS total_line_count,
              COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) AS mapped_line_count,
              COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) AS unmapped_line_count,
              0 AS non_financial_line_count,
              CASE
                WHEN fs.status IN ('mapped', 'confirmed')
                 AND fs.validation_status IN ('pass', 'warnings')
                 AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) > 0
                 AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) = 0
                THEN TRUE
                ELSE FALSE
              END AS is_workable,
              CASE
                WHEN fs.status IN ('mapped', 'confirmed')
                 AND fs.validation_status IN ('pass', 'warnings')
                 AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) > 0
                 AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) = 0
                THEN 'ready'
                WHEN COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) > 0
                THEN 'recoverable'
                ELSE 'pending'
              END AS readiness_status,
              0 AS readiness_score,
              NULL AS quality_summary,
              '[]' AS quality_reason_codes,
              NULL AS document_class,
              NULL AS extraction_strategy,
              NULL AS template_family,
              0 AS values_version
         FROM financial_statements fs
         LEFT JOIN financial_statement_values fsv ON fsv.statement_id = fs.id
         WHERE fs.organization_id = ?
         GROUP BY fs.id
         ORDER BY fs.period_end DESC, fs.created_at DESC
         LIMIT 100`,
      [organizationId]
    );
  }
}

export async function getStatementDetail(
  organizationId: string,
  statementId: string
): Promise<Record<string, unknown> | null> {
  const stmt = await dbGet<any>(
    `SELECT *
       FROM financial_statements
      WHERE id = ? AND organization_id = ?`,
    [statementId, organizationId]
  );

  if (!stmt) {
    return null;
  }

  let values: any[] = [];
  let qualityRuns: any[] = [];
  let ingestRuns: any[] = [];
  let extractedSections: any[] = [];
  let repairSessions: any[] = [];
  let mappingCandidates: any[] = [];
  let validationLedger: any[] = [];
  let versions: any[] = [];
  let sourceSiblings: any[] = [];

  try {
    values = await dbAll(
      `SELECT fsv.id, fsv.canonical_line_id, fsv.original_label, fsv.value, fsv.confidence, fsv.source_page, fsv.source_row,
              fsv.mapping_status, fsv.is_manually_corrected, fsv.is_non_financial, fsv.classification_reason,
              fsv.value_origin, fsv.mapping_confidence, fsv.evidence_json, fsv.source_candidate_row_id,
              fsv.selected_mapping_candidate_id, fsv.period_granularity,
              candidate.metadata_json AS candidate_metadata_json,
              decision.decision_id AS manual_decision_id,
              decision.action AS manual_decision_action,
              decision.reason AS manual_decision_reason,
              decision.source_receipt_id AS manual_decision_source_receipt_id,
              decision.statement_values_version AS manual_decision_values_version,
              decision.decided_by AS manual_decision_decided_by,
              decision.decided_at AS manual_decision_decided_at,
              fsl.line_code, fsl.line_name, fsl.line_name_en, fsl.line_name_pl, fsl.parent_line_id, fsl.aggregation_level, fsl.required_level,
              fsl.sign_convention, fsl.is_total, fsl.is_subtotal, fsl.is_computed, fsl.formula_json, fsl.deaggregation_ready
         FROM financial_statement_values fsv
         LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
         LEFT JOIN financial_statement_candidate_rows candidate
           ON candidate.id = fsv.source_candidate_row_id
          AND candidate.statement_id = fsv.statement_id
         LEFT JOIN LATERAL (
           SELECT decision_id, action, reason, source_receipt_id,
                  statement_values_version, decided_by, decided_at
             FROM finance_statement_manual_mapping_decisions
            WHERE organization_id = ?
              AND statement_id = fsv.statement_id
              AND candidate_row_id = fsv.source_candidate_row_id
            ORDER BY decided_at DESC, decision_id DESC
            LIMIT 1
         ) decision ON TRUE
        WHERE fsv.statement_id = ? ORDER BY fsv.source_row`,
      [organizationId, statementId],
      { fallback: false }
    );
    qualityRuns = await dbAll(
      `SELECT stage, result_status, readiness_status, strategy, summary, reason_codes, created_at
         FROM financial_statement_quality_runs
        WHERE statement_id = ?
        ORDER BY created_at DESC
        LIMIT 8`,
      [statementId],
      { fallback: false }
    );
    ingestRuns = await dbAll(
      `SELECT id, run_status, current_stage, source_file_name, parse_method, document_class, extraction_strategy,
              template_family, raw_text_length, latest_reason_codes, started_at, completed_at, updated_at
         FROM financial_statement_ingest_runs
        WHERE statement_id = ?
        ORDER BY started_at DESC
        LIMIT 6`,
      [statementId],
      { fallback: false }
    );
    extractedSections = await dbAll(
      `SELECT section_key, section_label, statement_type, line_start, line_end, confidence, text_excerpt, metadata_json, created_at
         FROM financial_statement_extracted_sections
        WHERE statement_id = ?
        ORDER BY created_at DESC, confidence DESC
        LIMIT 12`,
      [statementId],
      { fallback: false }
    );
    repairSessions = await dbAll(
      `SELECT id, repair_status, summary, payload_json, started_by, created_at, updated_at
         FROM financial_statement_repair_sessions
        WHERE statement_id = ?
        ORDER BY created_at DESC
        LIMIT 6`,
      [statementId],
      { fallback: false }
    );
    mappingCandidates = await dbAll(
      `SELECT candidate_row_id, canonical_line_id, score, match_reason, is_selected, selected_by, metadata_json, created_at
         FROM financial_statement_mapping_candidates
        WHERE statement_id = ?
        ORDER BY created_at DESC, score DESC
        LIMIT 150`,
      [statementId],
      { fallback: false }
    );
    validationLedger = await dbAll(
      `SELECT validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference,
              tolerance, message, details_json, computed_at
         FROM financial_statement_validations
        WHERE statement_id = ?
        ORDER BY computed_at DESC, check_code ASC`,
      [statementId],
      { fallback: false }
    );
    versions = await dbAll(
      `SELECT version_no, version_kind, readiness_status, change_summary, created_at
         FROM financial_statement_versions
        WHERE statement_id = ?
        ORDER BY version_no DESC
        LIMIT 12`,
      [statementId],
      { fallback: false }
    );
    sourceSiblings = await dbAll(
      `SELECT sibling.id, sibling.entity_name, sibling.statement_type, sibling.period_label,
              sibling.currency, sibling.scaling, sibling.source_file_name,
              sibling.status, sibling.readiness_status, sibling.values_version,
              sibling_receipt.receipt_id AS source_receipt_id,
              sibling_receipt.original_file_name, sibling_receipt.content_sha256
         FROM finance_statement_source_receipts anchor_receipt
         JOIN finance_statement_source_receipts sibling_receipt
           ON sibling_receipt.organization_id = anchor_receipt.organization_id
          AND sibling_receipt.upload_id = anchor_receipt.upload_id
          AND sibling_receipt.content_sha256 = anchor_receipt.content_sha256
         JOIN financial_statements sibling
           ON sibling.id = sibling_receipt.statement_id
          AND sibling.organization_id = sibling_receipt.organization_id
        WHERE anchor_receipt.statement_id = ?
          AND anchor_receipt.organization_id = ?
        ORDER BY CASE sibling.statement_type WHEN 'P&L' THEN 1 WHEN 'BS' THEN 2 WHEN 'CF' THEN 3 ELSE 9 END,
                 sibling.period_label DESC, sibling.id`,
      [statementId, organizationId],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) {
      throw error;
    }
    values = await dbAll(
      `SELECT fsv.id, fsv.canonical_line_id, fsv.original_label, fsv.value, fsv.confidence, fsv.source_row, fsv.mapping_status, fsv.is_manually_corrected,
              FALSE as is_non_financial, NULL as classification_reason,
              fsl.line_code, fsl.line_name, fsl.line_name_pl
         FROM financial_statement_values fsv
         LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
        WHERE fsv.statement_id = ? ORDER BY fsv.source_row`,
      [statementId]
    );
  }

  const { notes, ...stmtData } = stmt;
  const activeValues = Array.isArray(values)
    ? values.filter((value: any) => !value?.is_non_financial)
    : [];
  const totalLineCount = activeValues.length;
  const mappedLineCount = activeValues.filter((value: any) => value?.line_code).length;
  const unmappedLineCount = Math.max(0, totalLineCount - mappedLineCount);
  const validationMessages = parseValidationMessages(stmt.validation_messages);
  values = (values || []).map((value: any) => {
    let candidateMetadata: Record<string, unknown> = {};
    try {
      candidateMetadata = value.candidate_metadata_json
        ? typeof value.candidate_metadata_json === 'string'
          ? JSON.parse(value.candidate_metadata_json)
          : value.candidate_metadata_json
        : {};
    } catch {
      candidateMetadata = {};
    }
    const {
      candidate_metadata_json: _candidateMetadataJson,
      manual_decision_id: _manualDecisionId,
      manual_decision_action: _manualDecisionAction,
      manual_decision_reason: _manualDecisionReason,
      manual_decision_source_receipt_id: _manualDecisionSourceReceiptId,
      manual_decision_values_version: _manualDecisionValuesVersion,
      manual_decision_decided_by: _manualDecisionDecidedBy,
      manual_decision_decided_at: _manualDecisionDecidedAt,
      ...rest
    } = value;
    return {
      ...rest,
      suggested_exclusion_reason:
        typeof candidateMetadata.suggestedExclusionReason === 'string'
          ? candidateMetadata.suggestedExclusionReason
          : null,
      manual_decision: value.manual_decision_id
        ? {
            decisionId: value.manual_decision_id,
            action: value.manual_decision_action,
            reason: value.manual_decision_reason,
            sourceReceiptId: value.manual_decision_source_receipt_id,
            statementValuesVersion: Number(value.manual_decision_values_version),
            decidedBy: value.manual_decision_decided_by,
            decidedAt: value.manual_decision_decided_at,
          }
        : null,
    };
  });
  const latestVersionSnapshot = await loadLatestStatementVersionSnapshot(statementId);
  const readiness = evaluateStatementReadiness({
    rawStatus: stmt.status,
    statementType: stmt.statement_type,
    validationStatus: stmt.validation_status,
    currency: stmt.currency,
    scaling: stmt.scaling,
    validationMessages,
    values: (values || []).map((value: any) => ({
      canonicalLineId: value.canonical_line_id,
      value: Number(value.value || 0),
      isNonFinancial: !!value.is_non_financial,
    })),
  });

  return {
    ...stmtData,
    totalLineCount,
    mappedLineCount,
    unmappedLineCount,
    nonFinancialLineCount: Array.isArray(values)
      ? values.filter((value: any) => !!value?.is_non_financial).length
      : 0,
    isWorkable: readiness.isReady,
    readinessStatus: readiness.readinessStatus,
    readinessScore: readiness.readinessScore,
    readinessSummary: readiness.summary,
    readinessReasonCodes: readiness.reasonCodes,
    validationMessages,
    qualityRuns: qualityRuns || [],
    ingestRuns: ingestRuns || [],
    extractedSections: extractedSections || [],
    repairSessions: repairSessions || [],
    mappingCandidates: mappingCandidates || [],
    validationLedger: validationLedger || [],
    versions: versions || [],
    sourceSiblings: sourceSiblings || [],
    latestVersionNo: Number(latestVersionSnapshot?.versionNo || stmt.values_version || 0),
    values: values || [],
  };
}
