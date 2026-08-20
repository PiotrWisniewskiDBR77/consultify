import { canonicalPayloadHash } from './contentHash.js';
import { type PgTransactionClient, withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class StatementGovernanceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export interface RegisterStatementSourceReceiptInput {
  organizationId: string;
  statementId: string;
  ingestRunId?: string | null;
  uploadId: string;
  durableObjectId: string;
  originalFileName: string;
  contentSha256: string;
  sizeBytes: number;
  mimeType: string;
  sourceKind: 'UPLOAD' | 'CONNECTOR' | 'MANUAL_IMPORT';
  importerName: string;
  importerVersion: string;
  entityName: string;
  periods: Array<Record<string, unknown>>;
  pageRanges: Array<Record<string, unknown>>;
  userId: string;
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableJson(child)])
    );
  }
  return value;
}

async function requireEditor(tx: PgTransactionClient, organizationId: string, userId: string) {
  const row = (
    await tx.query<any>(
      `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR SHARE`,
      [organizationId, userId]
    )
  ).rows[0];
  if (String(row?.status || '').toUpperCase() !== 'ACTIVE')
    throw new StatementGovernanceError('ORG_MEMBERSHIP_REVOKED', 403, 'Active membership required');
  if (!hasFinanceEditRole(row.role))
    throw new StatementGovernanceError(
      'FINANCE_EDIT_FORBIDDEN',
      403,
      'Finance editor role required'
    );
}

async function requireActiveReader(
  tx: PgTransactionClient,
  organizationId: string,
  userId: string
) {
  const row = (
    await tx.query<any>(
      `SELECT status FROM organization_members WHERE organization_id=? AND user_id=? FOR SHARE`,
      [organizationId, userId]
    )
  ).rows[0];
  if (String(row?.status || '').toUpperCase() !== 'ACTIVE')
    throw new StatementGovernanceError('ORG_MEMBERSHIP_REVOKED', 403, 'Active membership required');
}

export async function registerStatementSourceReceipt(input: RegisterStatementSourceReceiptInput) {
  if (!/^[a-f0-9]{64}$/.test(input.contentSha256))
    throw new StatementGovernanceError('SOURCE_CHECKSUM_INVALID', 400, 'SHA-256 is required');
  if (
    !input.originalFileName ||
    !input.durableObjectId ||
    !input.entityName ||
    !input.periods.length
  )
    throw new StatementGovernanceError(
      'SOURCE_RECEIPT_INCOMPLETE',
      400,
      'Complete source provenance is required'
    );
  return withPgTransaction(async (tx) => {
    await requireEditor(tx, input.organizationId, input.userId);
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.uploadId}:STATEMENT_SOURCE`,
    ]);
    const statement = (
      await tx.query<any>(
        `SELECT id,entity_name,period_start::text,period_end::text,period_label
           FROM financial_statements WHERE id=? AND organization_id=? FOR SHARE`,
        [input.statementId, input.organizationId]
      )
    ).rows[0];
    if (!statement)
      throw new StatementGovernanceError('STATEMENT_NOT_FOUND', 404, 'Statement not found');
    if (String(statement.entity_name || '').trim() !== input.entityName.trim())
      throw new StatementGovernanceError(
        'SOURCE_ENTITY_MISMATCH',
        409,
        'Receipt entity does not match statement'
      );
    const exactPeriod = input.periods.some(
      (period) =>
        String(period.start || '') === String(statement.period_start || '') &&
        String(period.end || '') === String(statement.period_end || '') &&
        String(period.label || '') === String(statement.period_label || '')
    );
    if (!exactPeriod)
      throw new StatementGovernanceError(
        'SOURCE_PERIOD_MISMATCH',
        409,
        'Receipt periods do not cover the persisted statement period'
      );
    if (input.ingestRunId) {
      const run = (
        await tx.query<any>(
          `SELECT id FROM financial_statement_ingest_runs
            WHERE id=? AND statement_id=? AND organization_id=?`,
          [input.ingestRunId, input.statementId, input.organizationId]
        )
      ).rows[0];
      if (!run)
        throw new StatementGovernanceError(
          'SOURCE_INGEST_RUN_MISMATCH',
          409,
          'Ingest run does not belong to statement'
        );
    }
    const existing = (
      await tx.query<any>(
        `SELECT * FROM finance_statement_source_receipts WHERE organization_id=? AND upload_id=? AND statement_id=?`,
        [input.organizationId, input.uploadId, input.statementId]
      )
    ).rows[0];
    const identity = canonicalPayloadHash({
      statementId: input.statementId,
      durableObjectId: input.durableObjectId,
      originalFileName: input.originalFileName,
      contentSha256: input.contentSha256,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      sourceKind: input.sourceKind,
      importerName: input.importerName,
      importerVersion: input.importerVersion,
      entityName: input.entityName,
      periods: stableJson(input.periods),
      pageRanges: stableJson(input.pageRanges),
    });
    if (existing) {
      const prior = canonicalPayloadHash({
        statementId: existing.statement_id,
        durableObjectId: existing.durable_object_id,
        originalFileName: existing.original_file_name,
        contentSha256: existing.content_sha256,
        sizeBytes: Number(existing.size_bytes),
        mimeType: existing.mime_type,
        sourceKind: existing.source_kind,
        importerName: existing.importer_name,
        importerVersion: existing.importer_version,
        entityName: existing.entity_name,
        periods: stableJson(existing.periods_json),
        pageRanges: stableJson(existing.page_ranges_json),
      });
      if (prior !== identity)
        throw new StatementGovernanceError(
          'SOURCE_RECEIPT_COLLISION',
          409,
          'Upload identity is bound to different provenance'
        );
      return { ...existing, replay: true };
    }
    const row = (
      await tx.query<any>(
        `INSERT INTO finance_statement_source_receipts(organization_id,statement_id,ingest_run_id,upload_id,durable_object_id,original_file_name,content_sha256,size_bytes,mime_type,source_kind,importer_name,importer_version,entity_name,periods_json,page_ranges_json,imported_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
        [
          input.organizationId,
          input.statementId,
          input.ingestRunId || null,
          input.uploadId,
          input.durableObjectId,
          input.originalFileName,
          input.contentSha256,
          input.sizeBytes,
          input.mimeType,
          input.sourceKind,
          input.importerName,
          input.importerVersion,
          input.entityName,
          JSON.stringify(input.periods),
          JSON.stringify(input.pageRanges),
          input.userId,
        ]
      )
    ).rows[0];
    return { ...row, replay: false };
  });
}

export async function readStatementSourceReceipt(input: {
  organizationId: string;
  statementId: string;
  userId: string;
}) {
  return withPgTransaction(async (tx) => {
    await requireActiveReader(tx, input.organizationId, input.userId);
    const statement = (
      await tx.query<any>(
        `SELECT id FROM financial_statements WHERE id=? AND organization_id=? FOR SHARE`,
        [input.statementId, input.organizationId]
      )
    ).rows[0];
    if (!statement)
      throw new StatementGovernanceError('STATEMENT_NOT_FOUND', 404, 'Statement not found');
    const receipt = (
      await tx.query<any>(
        `SELECT receipt_id,statement_id,ingest_run_id,upload_id,durable_object_id,
                original_file_name,content_sha256,size_bytes,mime_type,source_kind,
                importer_name,importer_version,entity_name,periods_json,page_ranges_json,
                imported_by,imported_at
           FROM finance_statement_source_receipts
          WHERE organization_id=? AND statement_id=?
          ORDER BY imported_at DESC,receipt_id DESC LIMIT 1`,
        [input.organizationId, input.statementId]
      )
    ).rows[0];
    if (!receipt)
      throw new StatementGovernanceError(
        'SOURCE_RECEIPT_NOT_FOUND',
        404,
        'Source receipt not found'
      );
    return receipt;
  });
}
