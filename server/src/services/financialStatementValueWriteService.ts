import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { syncStatementToPack } from './financialStatementPackService.js';
import {
  evaluateStatementReadiness,
  getLatestStatementIngestRun,
  learnStatementAliases,
  openStatementRepairSession,
  persistStatementValidationLedger,
  persistStatementValueEvidence,
  recordStatementQualityRun,
  recordStatementSourceArtifact,
  runCfoAutoValidation,
  saveStatementValues,
  snapshotCanonicalStatementVersion,
  snapshotStatementValueVersion,
  startStatementIngestRun,
  updateStatementIngestRun,
  updateStatementReadinessState,
  updateStatementStatus,
  validateStatement,
} from './financialStatementService.js';

async function ensureStatementIngestRun(params: {
  statementId: string;
  organizationId?: string;
  createdBy?: string;
  sourceFileName?: string;
  sourceFilePath?: string;
  parseMethod?: string;
  documentClass?: string;
  extractionStrategy?: string;
  templateFamily?: string | null;
}) {
  const existingRunId = await getLatestStatementIngestRun(params.statementId);
  if (existingRunId) {
    return existingRunId;
  }
  if (!params.organizationId) {
    return null;
  }
  return await startStatementIngestRun({
    statementId: params.statementId,
    organizationId: params.organizationId,
    sourceFileName: params.sourceFileName,
    sourceFilePath: params.sourceFilePath,
    parseMethod: params.parseMethod,
    documentClass: params.documentClass,
    extractionStrategy: params.extractionStrategy,
    templateFamily: params.templateFamily,
    createdBy: params.createdBy,
  });
}

async function loadCandidateRowLookup(
  statementId: string
): Promise<Map<number, { candidateRowId: string; sourcePage: number | null; rowLabel: string }>> {
  const rows = (await dbAll(
    `SELECT id, source_row, source_page, row_label
     FROM financial_statement_candidate_rows
     WHERE statement_id = ?`,
    [statementId]
  )) as Array<{ id: string; source_row?: number; source_page?: number | null; row_label?: string }>;
  const lookup = new Map<
    number,
    { candidateRowId: string; sourcePage: number | null; rowLabel: string }
  >();
  for (const row of rows || []) {
    if (row.source_row == null) continue;
    lookup.set(Number(row.source_row), {
      candidateRowId: String(row.id),
      sourcePage: row.source_page != null ? Number(row.source_page) : null,
      rowLabel: String(row.row_label || ''),
    });
  }
  return lookup;
}

async function loadSelectedMappingLookup(statementId: string): Promise<Map<string, string>> {
  const rows = (await dbAll(
    `SELECT candidate_row_id, canonical_line_id, id
     FROM financial_statement_mapping_candidates
     WHERE statement_id = ? AND is_selected = TRUE`,
    [statementId]
  )) as Array<{ candidate_row_id?: string; canonical_line_id?: string; id: string }>;
  const lookup = new Map<string, string>();
  for (const row of rows || []) {
    const key = `${String(row.candidate_row_id || '')}:${String(row.canonical_line_id || '')}`;
    if (!key || key === ':') continue;
    lookup.set(key, String(row.id));
  }
  return lookup;
}

export function shouldDeferStatementPackSync(statement: Record<string, any>): boolean {
  return (
    statement.extraction_strategy === 'spreadsheet_structured_staged' &&
    String(statement.status || '').toLowerCase() !== 'confirmed'
  );
}

export async function syncStatementPackAfterValues(
  statementId: string,
  statement: Record<string, any>
): Promise<string | null> {
  return shouldDeferStatementPackSync(statement) ? null : await syncStatementToPack(statementId);
}

export async function saveStatementValuesFlow(params: {
  statementId: string;
  organizationId?: string;
  userId: string;
  statement: Record<string, any>;
  values: any[];
}) {
  const { statementId, organizationId, userId, statement, values } = params;
  const ingestRunId = await ensureStatementIngestRun({
    statementId,
    organizationId,
    createdBy: userId,
    sourceFileName: statement.source_file_name,
    sourceFilePath: statement.source_file_path,
    parseMethod: statement.parse_method,
    documentClass: statement.document_class,
    extractionStrategy: statement.extraction_strategy,
    templateFamily: statement.template_family,
  });
  const candidateRowLookup = await loadCandidateRowLookup(statementId);
  const selectedMappingLookup = await loadSelectedMappingLookup(statementId);
  const allowedMappingStatuses = new Set(['auto', 'suggested', 'manual', 'unmapped']);

  const normalizedValues: Array<{
    canonicalLineId: string | null;
    originalLabel: string;
    value: number;
    confidence: number;
    sourcePage?: number | null;
    sourceRow?: number;
    mappingStatus: string;
    isNonFinancial: boolean;
    classificationReason?: string;
    valueOrigin: 'source' | 'mapped' | 'manual' | 'computed' | 'estimated';
    mappingConfidence: number;
    sourceCandidateRowId: string | null;
    selectedMappingCandidateId: string | null;
    periodGranularity: string | null;
    periodLabel: string | null;
    periodIndex: number | null;
    lineageType: 'direct' | 'aggregated' | 'split' | 'derived' | 'manual_note';
    derivedFromLineCodes: string[] | null;
    evidenceJson: Record<string, unknown> | null;
    manualOverrideReason: string | null;
  }> = values.map((value: any) => {
    const sourceRow = value.sourceRow != null ? Number(value.sourceRow) : undefined;
    const candidate = sourceRow != null ? candidateRowLookup.get(sourceRow) : undefined;
    const canonicalLineId = value.canonicalLineId || null;
    const isNonFinancial = Boolean(value.isNonFinancial);
    const requestedMappingStatus = String(
      value.mappingStatus || (canonicalLineId ? 'auto' : 'unmapped')
    );
    const mappingStatus =
      isNonFinancial && !allowedMappingStatuses.has(requestedMappingStatus)
        ? 'unmapped'
        : requestedMappingStatus;
    if (!allowedMappingStatuses.has(mappingStatus)) {
      throw new Error(`Unsupported financial statement mapping status: ${requestedMappingStatus}`);
    }
    if (value.value === null || value.value === undefined || value.value === '') {
      throw new Error(
        `Missing financial statement value for source row ${sourceRow ?? 'unknown'}; zero substitution is forbidden`
      );
    }
    const numericValue = Number(value.value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(
        `Invalid financial statement value for source row ${sourceRow ?? 'unknown'}; a finite number is required`
      );
    }
    const valueOrigin = (String(value.valueOrigin || '').trim() ||
      (mappingStatus === 'manual'
        ? 'manual'
        : mappingStatus === 'computed'
          ? 'computed'
          : canonicalLineId
            ? 'mapped'
            : 'source')) as 'source' | 'mapped' | 'manual' | 'computed' | 'estimated';
    const evidenceJson =
      value.evidenceJson && typeof value.evidenceJson === 'object'
        ? value.evidenceJson
        : {
            sourceRow,
            sourcePage:
              value.sourcePage != null ? Number(value.sourcePage) : candidate?.sourcePage || null,
            candidateRowId: candidate?.candidateRowId || null,
            originalLabel: String(value.originalLabel || candidate?.rowLabel || ''),
            mappingStatus,
            periodLabel: value.periodLabel ? String(value.periodLabel) : null,
            periodIndex: value.periodIndex != null ? Number(value.periodIndex) : 0,
            lineageType: value.lineageType ? String(value.lineageType) : 'direct',
            derivedFromLineCodes: Array.isArray(value.derivedFromLineCodes)
              ? value.derivedFromLineCodes.map((code: unknown) => String(code))
              : [],
          };
    const selectedMappingCandidateId =
      value.selectedMappingCandidateId ||
      (candidate?.candidateRowId && canonicalLineId
        ? selectedMappingLookup.get(`${candidate.candidateRowId}:${canonicalLineId}`) || null
        : null);

    return {
      canonicalLineId,
      originalLabel: String(value.originalLabel || ''),
      value: numericValue,
      confidence: Number(value.confidence || 0),
      sourcePage:
        value.sourcePage != null ? Number(value.sourcePage) : (candidate?.sourcePage ?? null),
      sourceRow,
      mappingStatus,
      isNonFinancial,
      classificationReason: value.classificationReason
        ? String(value.classificationReason)
        : isNonFinancial
          ? 'NON_FINANCIAL_LINE'
          : undefined,
      valueOrigin,
      mappingConfidence: Number(value.mappingConfidence ?? value.confidence ?? 0),
      sourceCandidateRowId: value.sourceCandidateRowId || candidate?.candidateRowId || null,
      selectedMappingCandidateId,
      periodGranularity: String(value.periodGranularity || 'annual'),
      periodLabel: value.periodLabel ? String(value.periodLabel) : null,
      periodIndex: value.periodIndex != null ? Number(value.periodIndex) : 0,
      lineageType: (value.lineageType ? String(value.lineageType) : 'direct') as
        | 'direct'
        | 'aggregated'
        | 'split'
        | 'derived'
        | 'manual_note',
      derivedFromLineCodes: Array.isArray(value.derivedFromLineCodes)
        ? value.derivedFromLineCodes.map((code: unknown) => String(code))
        : [],
      evidenceJson,
      manualOverrideReason: value.manualOverrideReason ? String(value.manualOverrideReason) : null,
    };
  });

  await snapshotStatementValueVersion({
    statementId,
    sourceStage: 'values',
    values: normalizedValues,
    createdBy: userId,
  });

  await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [statementId]);

  const insertedValues = await saveStatementValues(statementId, normalizedValues);
  await persistStatementValueEvidence(
    insertedValues.flatMap((row: any, index: number) => {
      const normalized = normalizedValues[index];
      const provided = Array.isArray((values[index] as any)?.evidences)
        ? (values[index] as any).evidences
        : [];
      if (provided.length > 0) {
        return provided.map((evidence: any) => ({
          statementValueId: row.id,
          candidateRowId: evidence.candidateRowId
            ? String(evidence.candidateRowId)
            : row.sourceCandidateRowId || null,
          evidenceType: String(evidence.evidenceType || normalized?.lineageType || 'direct') as
            | 'direct'
            | 'aggregated'
            | 'split'
            | 'derived'
            | 'manual_note',
          weight: evidence.weight != null ? Number(evidence.weight) : 1,
          contributionValue:
            evidence.contributionValue != null ? Number(evidence.contributionValue) : row.value,
          explanation: evidence.explanation
            ? String(evidence.explanation)
            : `Persisted ${String(normalized?.lineageType || 'direct')} lineage for "${row.originalLabel}".`,
        }));
      }
      if (!row.sourceCandidateRowId) return [];
      return [
        {
          statementValueId: row.id,
          candidateRowId: row.sourceCandidateRowId || null,
          evidenceType: 'direct' as const,
          contributionValue: row.value,
          explanation: `Mapped from source row for "${row.originalLabel}".`,
        },
      ];
    })
  );

  const validationResult = validateStatement(
    normalizedValues.map((value: any) => ({
      canonicalLineId: value.canonicalLineId,
      value: value.value,
      originalLabel: value.originalLabel,
      mappingStatus: value.mappingStatus,
      isNonFinancial: value.isNonFinancial,
      periodLabel: value.periodLabel,
    })),
    statement.statement_type
  );
  const readiness = evaluateStatementReadiness({
    rawStatus: 'mapped',
    statementType: statement.statement_type,
    validationStatus: validationResult.status,
    currency: statement.currency,
    scaling: statement.scaling,
    validationMessages: validationResult.messages,
    values: normalizedValues.map((value: any) => ({
      canonicalLineId: value.canonicalLineId,
      value: value.value,
      isNonFinancial: value.isNonFinancial,
    })),
  });

  const cfoInput = normalizedValues
    .filter((value: any) => !value.isNonFinancial && value.canonicalLineId)
    .map((value: any) => ({
      canonicalLineId: value.canonicalLineId,
      value: Number(value.value || 0),
      originalLabel: value.originalLabel,
      statementType: statement.statement_type,
      isNonFinancial: false,
    }));
  const cfoResult = runCfoAutoValidation(cfoInput, {
    currency: statement.currency,
    scaling: statement.scaling,
    period: statement.period_label,
    documentName: statement.source_file_name,
  });

  for (const derived of cfoResult.derivedLines) {
    if (!derived.canonicalLineId) continue;
    const existsAlready = normalizedValues.some(
      (value: any) => value.canonicalLineId === derived.canonicalLineId && !value.isNonFinancial
    );
    if (existsAlready) continue;
    normalizedValues.push({
      canonicalLineId: derived.canonicalLineId,
      value: derived.value,
      originalLabel: derived.originalLabel || '[CFO-derived]',
      mappingStatus: 'auto',
      isNonFinancial: false,
      confidence: 0.8,
      sourcePage: null,
      sourceRow: undefined,
      classificationReason: undefined,
      valueOrigin: 'computed',
      mappingConfidence: 0.8,
      sourceCandidateRowId: null,
      selectedMappingCandidateId: null,
      periodGranularity: 'annual',
      periodLabel: statement.period_label || null,
      periodIndex: 0,
      lineageType: 'derived',
      derivedFromLineCodes: [],
      evidenceJson: null,
      manualOverrideReason: null,
    });
  }

  await updateStatementStatus(
    statementId,
    'mapped',
    validationResult.status,
    validationResult.messages
  );
  await persistStatementValidationLedger({
    statementId,
    statementType: statement.statement_type,
    messages: [
      ...validationResult.messages,
      ...cfoResult.checks
        .filter((check: any) => check.severity !== 'pass')
        .map((check: any) => ({
          type:
            check.severity === 'error'
              ? ('error' as const)
              : check.severity === 'warning'
                ? ('warning' as const)
                : ('info' as const),
          code: `CFO_${check.code}`,
          message: check.message,
          details: check.details,
        })),
    ],
    values: normalizedValues.map((value: any) => ({
      canonicalLineId: value.canonicalLineId,
      value: value.value,
      isNonFinancial: value.isNonFinancial,
    })),
  });
  await updateStatementReadinessState(statementId, readiness);
  await snapshotCanonicalStatementVersion({
    statementId,
    versionKind: readiness.isReady ? 'validated' : 'mapped',
    readinessStatus: readiness.readinessStatus,
    values: normalizedValues,
    validations: validationResult.messages,
    createdBy: userId,
    summary: readiness.summary,
  });
  const statementPackId = await syncStatementPackAfterValues(statementId, statement);
  await recordStatementSourceArtifact({
    statementId,
    ingestRunId,
    artifactType: 'confirmed_values',
    stage: 'values',
    contentJson: {
      values: normalizedValues,
      validation: validationResult,
      readiness,
    },
    createdBy: userId,
  });
  await updateStatementIngestRun({
    ingestRunId,
    currentStage: 'validate',
    runStatus: readiness.isReady ? 'completed' : 'running',
    reasonCodes: readiness.reasonCodes,
    summary: {
      readinessStatus: readiness.readinessStatus,
      mapped: readiness.mappedLineCount,
      eligible: readiness.eligibleLineCount,
    },
  });
  if (organizationId && !readiness.isReady) {
    await openStatementRepairSession({
      statementId,
      organizationId,
      ingestRunId,
      startedBy: userId,
      summary: readiness.summary,
      payload: {
        reasonCodes: readiness.reasonCodes,
        validation: validationResult,
      },
    });
  }
  if (organizationId) {
    await learnStatementAliases({
      organizationId,
      statementType: statement.statement_type,
      templateFamily: statement.template_family,
      values: normalizedValues
        .filter((value: any) => value.canonicalLineId && !value.isNonFinancial)
        .map((value: any) => ({
          canonicalLineId: value.canonicalLineId,
          originalLabel: value.originalLabel,
        })),
      createdBy: userId,
    });
    await recordStatementQualityRun({
      statementId,
      organizationId,
      stage: 'validate',
      resultStatus:
        readiness.readinessStatus === 'ready'
          ? 'pass'
          : readiness.readinessStatus === 'recoverable'
            ? 'warning'
            : 'fail',
      readinessStatus: readiness.readinessStatus,
      strategy: statement.extraction_strategy || 'manual_mapping',
      summary: readiness.summary,
      reasonCodes: readiness.reasonCodes,
      payload: {
        validation: validationResult,
        counts: {
          eligible: readiness.eligibleLineCount,
          mapped: readiness.mappedLineCount,
          unmapped: readiness.unmappedLineCount,
          nonFinancial: readiness.nonFinancialLineCount,
        },
      },
      createdBy: userId,
    });
  }

  return {
    statementId,
    statementPackId,
    ingestRunId,
    savedCount: normalizedValues.length,
    readiness,
    validation: validationResult,
  };
}
