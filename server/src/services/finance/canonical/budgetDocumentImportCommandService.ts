import { createHash } from 'node:crypto';

import {
  detectNumberNotation,
  parseStatementNumber,
  type NumberNotationProfile,
} from '../numberNotation.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

const DEFINITIONS = [
  { code: 'REVENUE', keywords: ['revenue', 'sales', 'turnover', 'przychody', 'sprzedaż'] },
  {
    code: 'COGS',
    keywords: ['cost of goods sold', 'cost of sales', 'cogs', 'koszt własny sprzedaży'],
  },
  { code: 'OPEX', keywords: ['operating expenses', 'opex', 'koszty operacyjne'] },
  { code: 'CAPEX', keywords: ['capital expenditure', 'capex', 'nakłady inwestycyjne'] },
  {
    code: 'DEPRECIATION',
    keywords: ['depreciation', 'amortization', 'amortisation', 'amortyzacja'],
  },
] as const;

export interface BudgetDocumentImportParams {
  organizationId: string;
  userId: string;
  budgetId: string;
  expectedVersion: number;
  idempotencyKey: string;
  sourceFileName: string;
  sourceMimeType: string;
  sourceFileSize: number;
  sourceFileSha256: string;
  documentText: string;
}

export interface BudgetDocumentImportResult {
  budgetId: string;
  budgetVersion: number;
  linesImported: number;
  mappings: Array<{ lineId: string; lineCode: string; value: string }>;
  unappliedDiagnostics: Array<{ sourceRow: number; raw: string; reason: string }>;
  notationProfile: NumberNotationProfile;
  source: { fileName: string; mimeType: string; fileSha256: string; textSha256: string };
  importedBy: string;
  importedAt: string;
  replay: boolean;
}

export class BudgetDocumentImportCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

function extractCandidates(
  text: string,
  profile: NumberNotationProfile
): {
  values: Map<string, string>;
  diagnostics: BudgetDocumentImportResult['unappliedDiagnostics'];
} {
  const values = new Map<string, string>();
  const diagnostics: BudgetDocumentImportResult['unappliedDiagnostics'] = [];
  const rows = text
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), sourceRow: index + 1 }))
    .filter((row) => row.raw)
    .slice(0, 5000);
  for (const row of rows) {
    const lower = row.raw.toLocaleLowerCase();
    const matches = DEFINITIONS.flatMap((item) =>
      item.keywords
        .filter((keyword) => lower.includes(keyword))
        .map((keyword) => ({ item, keywordLength: keyword.length }))
    ).sort((a, b) => b.keywordLength - a.keywordLength);
    const definition = matches[0]?.item;
    const tokens = row.raw.match(/(?:\(|[-−–—])?\d[\d\s.,'’]*(?:\)|[-−–—])?/g) || [];
    if (!definition) {
      if (tokens.length > 0 && diagnostics.length < 100)
        diagnostics.push({ sourceRow: row.sourceRow, raw: row.raw, reason: 'UNSUPPORTED_ROW' });
      continue;
    }
    const token = tokens[tokens.length - 1];
    if (!token) {
      diagnostics.push({ sourceRow: row.sourceRow, raw: row.raw, reason: 'VALUE_NOT_FOUND' });
      continue;
    }
    const parsed = parseStatementNumber(token, profile.notation);
    if (parsed.value === null || parsed.ambiguous) {
      diagnostics.push({
        sourceRow: row.sourceRow,
        raw: row.raw,
        reason: parsed.ambiguous ? 'AMBIGUOUS_NUMBER' : 'INVALID_NUMBER',
      });
      continue;
    }
    if (values.has(definition.code)) {
      throw new BudgetDocumentImportCommandError(
        'DUPLICATE_DOCUMENT_LINE',
        409,
        `Document contains more than one ${definition.code} value`
      );
    }
    values.set(definition.code, String(parsed.value));
  }
  if (values.size === 0)
    throw new BudgetDocumentImportCommandError(
      'NO_UNAMBIGUOUS_BUDGET_LINES',
      400,
      'No supported unambiguous budget values were found',
      { unappliedDiagnostics: diagnostics }
    );
  return { values, diagnostics };
}

export async function importBudgetDocumentCommand(
  params: BudgetDocumentImportParams
): Promise<BudgetDocumentImportResult> {
  const key = params.idempotencyKey.trim();
  const fileName = params.sourceFileName.trim();
  const mimeType = params.sourceMimeType.trim();
  const text = params.documentText.replace(/\0/g, '').trim();
  if (!key || key.length > 200)
    throw new BudgetDocumentImportCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1)
    throw new BudgetDocumentImportCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  if (!fileName || fileName.length > 255 || !mimeType || mimeType.length > 200)
    throw new BudgetDocumentImportCommandError(
      'INVALID_SOURCE_FILE',
      400,
      'File metadata is invalid'
    );
  if (
    !Number.isInteger(params.sourceFileSize) ||
    params.sourceFileSize < 1 ||
    params.sourceFileSize > 52_428_800 ||
    !/^[0-9a-f]{64}$/.test(params.sourceFileSha256)
  )
    throw new BudgetDocumentImportCommandError('INVALID_SOURCE_FILE', 400, 'File proof is invalid');
  if (!text || text.length > 2_000_000)
    throw new BudgetDocumentImportCommandError(
      'DOCUMENT_TEXT_UNAVAILABLE',
      400,
      'Document text is empty or too large'
    );
  const textSha256 = sha256(text);

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE')
      throw new BudgetDocumentImportCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(membership.role))
      throw new BudgetDocumentImportCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor role is required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.budgetId}:BUDGET_DOCUMENT_IMPORT`,
    ]);
    const budget = (
      await tx.query<{ status: string; version: number; currency: string }>(
        `SELECT status,version,currency FROM budgets WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.organizationId]
      )
    ).rows[0];
    if (!budget)
      throw new BudgetDocumentImportCommandError('BUDGET_NOT_FOUND', 404, 'Budget not found');
    const profile = detectNumberNotation(text, { currency: budget.currency });
    const parsed = extractCandidates(text, profile);
    const requestSha256 = sha256(
      JSON.stringify({
        budgetId: params.budgetId,
        expectedVersion: params.expectedVersion,
        sourceFileSha256: params.sourceFileSha256,
        sourceFileName: fileName,
        sourceMimeType: mimeType,
        sourceFileSize: params.sourceFileSize,
        textSha256,
        values: [...parsed.values.entries()].sort(([a], [b]) => a.localeCompare(b)),
      })
    );
    const prior = (
      await tx.query<{ request_sha256: string; response_json: BudgetDocumentImportResult }>(
        `SELECT request_sha256,response_json FROM finance_budget_document_import_receipts WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,
        [params.organizationId, params.budgetId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new BudgetDocumentImportCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another document import'
        );
      return { ...prior.response_json, replay: true };
    }
    if (budget.status !== 'DRAFT')
      throw new BudgetDocumentImportCommandError(
        'BUDGET_IMMUTABLE',
        409,
        'Only a DRAFT budget can import values'
      );
    if (Number(budget.version) !== params.expectedVersion)
      throw new BudgetDocumentImportCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget version changed',
        { currentVersion: Number(budget.version) }
      );

    const mappings: BudgetDocumentImportResult['mappings'] = [];
    for (const [lineCode, value] of parsed.values) {
      const lines = (
        await tx.query<{ id: string; is_locked: boolean }>(
          `SELECT id,is_locked FROM budget_lines WHERE budget_id=? AND UPPER(line_code)=? FOR UPDATE`,
          [params.budgetId, lineCode]
        )
      ).rows;
      if (lines.length !== 1)
        throw new BudgetDocumentImportCommandError(
          'BUDGET_LINE_IDENTITY_CONFLICT',
          409,
          `Expected exactly one canonical ${lineCode} line`
        );
      if (lines[0].is_locked)
        throw new BudgetDocumentImportCommandError(
          'BUDGET_LINE_LOCKED',
          409,
          `${lineCode} is locked`
        );
      mappings.push({ lineId: lines[0].id, lineCode, value });
    }
    for (const mapping of mappings) {
      await tx.query(
        `UPDATE budget_lines SET baseline_value=?,source='baseline' WHERE id=? AND budget_id=?`,
        [mapping.value, mapping.lineId, params.budgetId]
      );
    }
    const appliedVersion = params.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE budgets SET version=?,baseline_source=?,updated_at=now() WHERE id=? AND organization_id=? AND status='DRAFT' AND version=?`,
      [
        appliedVersion,
        `document:${params.sourceFileSha256}`,
        params.budgetId,
        params.organizationId,
        params.expectedVersion,
      ]
    );
    if (updated.rowCount !== 1)
      throw new BudgetDocumentImportCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget changed before document import'
      );
    const importedAt = new Date().toISOString();
    const result: BudgetDocumentImportResult = {
      budgetId: params.budgetId,
      budgetVersion: appliedVersion,
      linesImported: mappings.length,
      mappings,
      unappliedDiagnostics: parsed.diagnostics,
      notationProfile: profile,
      source: {
        fileName,
        mimeType,
        fileSha256: params.sourceFileSha256,
        textSha256,
      },
      importedBy: params.userId,
      importedAt,
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_budget_document_import_receipts (organization_id,budget_id,idempotency_key,request_sha256,source_file_sha256,extracted_text_sha256,source_file_name,source_mime_type,source_file_size,expected_budget_version,applied_budget_version,notation_profile_json,response_json,imported_by,imported_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        params.organizationId,
        params.budgetId,
        key,
        requestSha256,
        params.sourceFileSha256,
        textSha256,
        fileName,
        mimeType,
        params.sourceFileSize,
        params.expectedVersion,
        appliedVersion,
        JSON.stringify(profile),
        JSON.stringify(result),
        params.userId,
        importedAt,
      ]
    );
    return result;
  });
}
