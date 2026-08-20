import fs from 'fs/promises';
import path from 'path';

import { run as dbRun } from '../utils/DbPromise.js';
import { withPgTransaction } from '../utils/queryHelpers.js';
import { registerStatementSourceReceipt } from './finance/canonical/statementSourceReceiptService.js';
import { recomputeStatementPack } from './financialStatementPackService.js';
import {
  autoMapLines,
  createStatement,
  extractFinancialLines,
  locateStatementSections,
  persistStatementCandidateRows,
  persistStatementExtractedSections,
  resolveStatementColumnSelection,
  sha256Hex,
  startStatementIngestRun,
  updateStatementIngestRun,
  updateStatementMetadata,
  updateStatementStatus,
} from './financialStatementService.js';

export type ImportableStatementType = 'P&L' | 'BS' | 'CF';

export interface StagedStatementSection {
  statementId: string;
  statementType: ImportableStatementType;
  periodLabel: string | null;
  comparisonOfStatementId: string | null;
  lineCount: number;
  sourceReceiptId: string;
  currency: string;
  scaling: string;
  entityName: string;
  sourceFileName: string;
  sourceSha256: string;
  lines: Array<Record<string, unknown>>;
}

function normalizeTypes(values: unknown): ImportableStatementType[] {
  if (!Array.isArray(values)) return [];
  const selected = new Set(
    values
    .map((value) =>
      String(value || '')
        .trim()
        .toUpperCase()
    )
      // Defense in depth for callers mounted behind the global JSON sanitizer.
      // This is a closed enum alias, not general entity decoding.
      .map((value) =>
        value === 'PL' || value === 'P&L' || value === 'P&AMP;L' ? 'P&L' : value
      )
      .filter((value): value is ImportableStatementType => ['P&L', 'BS', 'CF'].includes(value))
  );
  // Caller/detector order must never decide which section reuses the primary
  // upload row. Canonical order makes sibling identity stable for every input
  // permutation and keeps P&L as the primary section when selected.
  return (['P&L', 'BS', 'CF'] as const).filter((type) => selected.has(type));
}

function periodDates(label: string | null | undefined): { start?: string; end?: string } {
  const year = String(label || '').match(/(?:19|20)\d{2}/)?.[0];
  return year ? { start: `${year}-01-01`, end: `${year}-12-31` } : {};
}

/**
 * Deterministically stage every requested statement section and every detected
 * comparison column.  AI may suggest mappings later, but it never chooses the
 * section boundary or silently drops a comparative period here.
 *
 * The first selected/current-period statement reuses the upload row. All other
 * section/period statements are explicit siblings with the same source file.
 * No financial_statement_values are written: the UI must review mappings and
 * the readiness contract remains fail-closed until an explicit save/confirm.
 */
async function stageSelectedStatementSectionsTx(params: {
  primaryStatementId: string;
  organizationId: string;
  userId: string;
  statement: Record<string, any>;
  text: string;
  statementTypes: unknown;
  periodLabel?: string;
  currency?: string;
  scaling?: string;
  entityName: string;
}): Promise<{ statements: StagedStatementSection[]; selectedTypes: ImportableStatementType[] }> {
  const selectedTypes = normalizeTypes(params.statementTypes);
  if (selectedTypes.length === 0) {
    throw Object.assign(new Error('Select at least one statement section.'), {
      code: 'STATEMENT_SECTION_REQUIRED',
      statusCode: 400,
    });
  }
  if (!params.entityName.trim()) {
    throw Object.assign(new Error('Confirm the reporting entity before extraction.'), {
      code: 'STATEMENT_ENTITY_REQUIRED',
      statusCode: 400,
    });
  }

  const sourcePath = path.resolve(String(params.statement.source_file_path || ''));
  const sourceBytes = await fs.readFile(sourcePath);
  const sourceStat = await fs.stat(sourcePath);
  const extension = path.extname(String(params.statement.source_file_name || '')).toLowerCase();
  const mimeType =
    extension === '.pdf'
      ? 'application/pdf'
      : extension === '.csv'
        ? 'text/csv'
        : extension === '.xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : extension === '.xls'
            ? 'application/vnd.ms-excel'
            : 'application/octet-stream';
  const sourceSha256 = sha256Hex(sourceBytes);
  // The mounted upload/detect boundary loads the primary row through the
  // tenant-scoped Statement read and assigns its durable pack before extract.
  // Carry that already-authorized identity into this transaction; creating or
  // reclassifying a pack here would make the six-sibling proposal ambiguous.
  const statementPackId = String(params.statement.statement_pack_id || '').trim();
  if (!statementPackId) {
    throw Object.assign(new Error('Unable to establish Statement pack identity.'), {
      code: 'STATEMENT_PACK_REQUIRED',
      statusCode: 422,
    });
  }

  const staged: StagedStatementSection[] = [];
  let primaryUsed = false;

  for (const statementType of selectedTypes) {
    const sections = locateStatementSections(params.text, statementType).filter(
      (section) => section.statementType === statementType && section.confidence >= 0.5
    );
    if (sections.length === 0) {
      throw Object.assign(
        new Error(`The selected ${statementType} section was not found reliably in this file.`),
        {
          code: 'STATEMENT_SECTION_NOT_FOUND',
          statusCode: 422,
          statementType,
          // This in-memory witness is populated only after the preceding
          // section's transaction-local writes and receipts have completed.
          // It makes rollback proofs section-specific without persisting an
          // audit side channel outside the transaction.
          stagedBeforeFailure: staged.map((item) => ({
            statementId: item.statementId,
            statementType: item.statementType,
            periodLabel: item.periodLabel,
            sourceReceiptId: item.sourceReceiptId,
          })),
        }
      );
    }

    const columnSelection = resolveStatementColumnSelection(sections[0].text, {
      periodLabel: params.periodLabel,
      currency: params.currency,
      scaling: params.scaling as any,
    });
    // The located section is the authority boundary. Passing the full report
    // here allowed a selected P&L import to drift into the following BS table.
    const extraction = extractFinancialLines(sections[0].text, statementType, {
      selectedPeriodLabel: columnSelection.selectedPeriodLabel,
      comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
    });
    if (extraction.lines.length === 0) {
      throw Object.assign(new Error(`No usable ${statementType} rows were extracted.`), {
        code: 'STATEMENT_SECTION_EMPTY',
        statusCode: 422,
        statementType,
      });
    }

    const periods: Array<{
      label: string | null;
      comparisonOf: string | null;
      lines: typeof extraction.lines;
    }> = [
      {
        label: columnSelection.selectedPeriodLabel,
        comparisonOf: null,
        lines: extraction.lines.map((line) => ({
          ...line,
          selectedPeriodLabel: columnSelection.selectedPeriodLabel || undefined,
          comparisonValue: undefined,
          comparisonRawValue: undefined,
        })),
      },
    ];
    const comparisonLines = extraction.lines
      .filter((line) => line.comparisonValue !== undefined && line.comparisonValue !== null)
      .map((line) => ({
        ...line,
        value: Number(line.comparisonValue),
        rawValue: line.comparisonRawValue,
        selectedPeriodLabel: columnSelection.comparisonPeriodLabel || undefined,
        comparisonValue: undefined,
        comparisonRawValue: undefined,
      }));
    if (columnSelection.comparisonPeriodLabel && comparisonLines.length > 0) {
      periods.push({
        label: columnSelection.comparisonPeriodLabel,
        comparisonOf: 'pending',
        lines: comparisonLines,
      });
    }

    let currentPeriodStatementId: string | null = null;
    for (const period of periods) {
      const dates = periodDates(period.label);
      const reusePrimary = !primaryUsed;
      const statementId = reusePrimary
        ? params.primaryStatementId
        : await createStatement({
            organizationId: params.organizationId,
            statementType,
            periodStart: dates.start || params.statement.period_start,
            periodEnd: dates.end || params.statement.period_end,
            periodLabel: period.label || undefined,
            currency: params.currency || params.statement.currency,
            scaling: params.scaling || params.statement.scaling,
            sourceFileName: params.statement.source_file_name,
            sourceFilePath: params.statement.source_file_path,
            parseMethod: params.statement.parse_method,
            overallConfidence: Number(params.statement.overall_confidence || 0),
            documentClass: params.statement.document_class || 'mixed_report',
            extractionStrategy: 'deterministic_multi_section_staged',
            templateFamily: params.statement.template_family,
            createdBy: params.userId,
          });
      primaryUsed = true;
      if (!currentPeriodStatementId) currentPeriodStatementId = statementId;

      if (!reusePrimary) {
        await dbRun(`UPDATE financial_statements SET notes = ? WHERE id = ?`, [
          params.text.slice(0, 100000),
          statementId,
        ]);
      }
      await updateStatementMetadata(statementId, {
        statementType,
        periodLabel: period.label || undefined,
        currency: params.currency || params.statement.currency,
        scaling: params.scaling || params.statement.scaling,
        documentClass: params.statement.document_class || 'mixed_report',
        extractionStrategy: 'deterministic_multi_section_staged',
        templateFamily: params.statement.template_family,
      });
      await dbRun(
        `UPDATE financial_statements
         SET entity_name=?, period_start=COALESCE(?,period_start), period_end=COALESCE(?,period_end),
             statement_pack_id=?
         WHERE id=? AND organization_id=?`,
        [
          params.entityName.trim(),
          dates.start || null,
          dates.end || null,
          statementPackId,
          statementId,
          params.organizationId,
        ]
      );
      await updateStatementStatus(statementId, 'imported');

      const ingestRunId = await startStatementIngestRun({
        statementId,
        organizationId: params.organizationId,
        sourceFileName: params.statement.source_file_name,
        sourceFilePath: params.statement.source_file_path,
        parseMethod: params.statement.parse_method,
        documentClass: params.statement.document_class || 'mixed_report',
        extractionStrategy: 'deterministic_multi_section_staged',
        templateFamily: params.statement.template_family,
        rawTextLength: params.text.length,
        summary: {
          statementType,
          periodLabel: period.label,
          comparisonOfStatementId: period.comparisonOf ? currentPeriodStatementId : null,
        },
        createdBy: params.userId,
      });
      const persistedSections = await persistStatementExtractedSections({
        statementId,
        ingestRunId,
        sections,
      });
      const sectionIdsByKey = Object.fromEntries(
        persistedSections.map((section) => [section.sectionKey, section.sectionId])
      );
      await persistStatementCandidateRows({
        statementId,
        ingestRunId,
        rows: period.lines,
        sectionIdsByKey,
        statementType,
        currency: params.currency || params.statement.currency,
        scaling: params.scaling || params.statement.scaling,
      });
      const mapped = await autoMapLines(period.lines, statementType, {
        organizationId: params.organizationId,
      });
      await updateStatementIngestRun({
        ingestRunId,
        currentStage: 'map',
        runStatus: 'running',
        reasonCodes: ['MULTI_SECTION_STAGED_FOR_REVIEW'],
        summary: {
          statementType,
          periodLabel: period.label,
          candidateRows: period.lines.length,
        },
      });
      const sourceReceipt = await registerStatementSourceReceipt({
        organizationId: params.organizationId,
        statementId,
        ingestRunId,
        uploadId: params.primaryStatementId,
        durableObjectId: sourcePath,
        originalFileName: String(params.statement.source_file_name || ''),
        contentSha256: sourceSha256,
        sizeBytes: sourceStat.size,
        mimeType,
        sourceKind: 'UPLOAD',
        importerName: 'consultify-statement-import',
        importerVersion: '2026-08-20',
        entityName: params.entityName.trim(),
        periods: [
          {
            label: period.label,
            start: dates.start || params.statement.period_start,
            end: dates.end || params.statement.period_end,
            statementType,
            currency: params.currency || params.statement.currency,
            scaling: params.scaling || params.statement.scaling,
          },
        ],
        pageRanges: sections.map((section) => {
          const pages = period.lines
            .map((line) => line.sourcePage)
            .filter((page): page is number => Number.isInteger(page));
          return {
            statementType,
            pageStart: pages.length ? Math.min(...pages) : null,
            pageEnd: pages.length ? Math.max(...pages) : null,
            lineStart: section.lineStart,
            lineEnd: section.lineEnd,
          };
        }),
        userId: params.userId,
      });
      staged.push({
        statementId,
        statementType,
        periodLabel: period.label,
        comparisonOfStatementId: period.comparisonOf ? currentPeriodStatementId : null,
        lineCount: mapped.length,
        sourceReceiptId: String(sourceReceipt.receipt_id),
        currency: String(params.currency || params.statement.currency || ''),
        scaling: String(params.scaling || params.statement.scaling || ''),
        entityName: params.entityName.trim(),
        sourceFileName: String(params.statement.source_file_name || ''),
        sourceSha256,
        lines: mapped as unknown as Array<Record<string, unknown>>,
      });
    }
  }

  await recomputeStatementPack(statementPackId, { deferShadow: true });

  return { statements: staged, selectedTypes };
}

export async function stageSelectedStatementSections(
  params: Parameters<typeof stageSelectedStatementSectionsTx>[0]
) {
  // Six type/period siblings, candidate rows and source receipts are one
  // proposal. If any selected section is missing or malformed, leave no
  // partial sibling lineage behind.
  return withPgTransaction(async () => stageSelectedStatementSectionsTx(params));
}
