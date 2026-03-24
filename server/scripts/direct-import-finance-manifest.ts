#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

import {
  resolveFinanceImportDatabaseUrl,
  resolveFinanceImportOrgId,
} from './lib/financeImportTarget.js';
import PDFParserService from '../src/services/pdfParserService.js';
import {
  autoMapLines,
  classifyStatementDocument,
  detectContainedStatementTypes,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  validateStatement,
} from '../src/services/financialStatementService.js';

type Target = {
  statementType: 'BS' | 'P&L' | 'CF';
  periodLabel?: string;
};

type Entry = {
  label: string;
  filePath: string;
  targets: Target[];
};

type ImportResult = {
  label: string;
  filePath: string;
  statementType: 'BS' | 'P&L' | 'CF';
  statementId: string;
  parseMethod: string;
  documentClass: string;
  extractionStrategy: string;
  detectedStatementType: string;
  containedStatementTypes: string[];
  selectedPeriodLabel: string | null;
  comparisonPeriodLabel: string | null;
  extractedLineCount: number;
  eligibleLineCount: number;
  mappedLineCount: number;
  coveragePct: number;
  validationStatus: string;
  readinessStatus: string;
  readinessScore: number;
  reasonCodes: string[];
  validationCodes: string[];
  topUnmappedLabels: string[];
  persistedStatus: string;
};

const DB_URL = resolveFinanceImportDatabaseUrl();
const ORG_ID = resolveFinanceImportOrgId();
const ACTOR_ID = process.env.FINANCE_IMPORT_ACTOR_ID || 'finance-import-bot';

function readFlagValue(flag: string): string | null {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : null;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

async function extractTextFromSource(filePath: string): Promise<{ text: string; parseMethod: string }> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return { text: await PDFParserService.extractText(filePath), parseMethod: 'text_extraction' };
  }
  if (ext === '.csv') {
    return { text: fs.readFileSync(filePath, 'utf8'), parseMethod: 'csv_import' };
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
      lines.push(`=== Sheet: ${sheetName} ===`, csv);
    }
    return { text: lines.join('\n'), parseMethod: 'excel_import' };
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

function buildMarkdown(results: ImportResult[]): string {
  const lines: string[] = ['# Finance Direct Import Report', ''];
  lines.push(`- Organization: \`${ORG_ID}\``);
  lines.push(`- Statements imported: ${results.length}`);
  lines.push(`- Ready: ${results.filter((result) => result.readinessStatus === 'ready').length}`);
  lines.push(
    `- Recoverable: ${results.filter((result) => result.readinessStatus === 'recoverable').length}`
  );
  lines.push(`- Rejected: ${results.filter((result) => result.readinessStatus === 'rejected').length}`);
  lines.push('');
  lines.push('| Document | Type | Eligible | Mapped | Coverage | Readiness | Persisted status |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.statementType} | ${result.eligibleLineCount} | ${result.mappedLineCount} | ${result.coveragePct}% | ${result.readinessStatus} | ${result.persistedStatus} |`
    );
  }
  lines.push('');

  for (const result of results) {
    lines.push(`## ${result.label} / ${result.statementType}`);
    lines.push('');
    lines.push(`- File: \`${result.filePath}\``);
    lines.push(`- Statement ID: \`${result.statementId}\``);
    lines.push(`- Parse method: \`${result.parseMethod}\``);
    lines.push(`- Document class: \`${result.documentClass}\``);
    lines.push(`- Extraction strategy: \`${result.extractionStrategy}\``);
    lines.push(`- Detected statement type: \`${result.detectedStatementType}\``);
    lines.push(
      `- Contained statement types: ${result.containedStatementTypes.length ? result.containedStatementTypes.map((value) => `\`${value}\``).join(', ') : 'none'}`
    );
    lines.push(`- Selected period: \`${result.selectedPeriodLabel || 'n/a'}\``);
    lines.push(`- Comparison period: \`${result.comparisonPeriodLabel || 'n/a'}\``);
    lines.push(`- Extracted lines: ${result.extractedLineCount}`);
    lines.push(`- Eligible lines: ${result.eligibleLineCount}`);
    lines.push(`- Mapped lines: ${result.mappedLineCount}`);
    lines.push(`- Coverage: ${result.coveragePct}%`);
    lines.push(`- Validation status: \`${result.validationStatus}\``);
    lines.push(`- Readiness: \`${result.readinessStatus}\` (${result.readinessScore})`);
    lines.push(
      `- Reason codes: ${result.reasonCodes.length ? result.reasonCodes.map((value) => `\`${value}\``).join(', ') : 'none'}`
    );
    lines.push(
      `- Validation codes: ${result.validationCodes.length ? result.validationCodes.map((value) => `\`${value}\``).join(', ') : 'none'}`
    );
    lines.push(
      `- Top unmapped labels: ${result.topUnmappedLabels.length ? result.topUnmappedLabels.map((value) => `\`${value}\``).join(', ') : 'none'}`
    );
    lines.push(`- Persisted status: \`${result.persistedStatus}\``);
    lines.push('');
  }

  return lines.join('\n');
}

async function insertStatement(
  client: pg.Client,
  statementId: string,
  entry: Entry,
  target: Target,
  payload: {
    detection: ReturnType<typeof detectStatementType>;
    parseMethod: string;
    documentClass: string;
    confidence: number;
    notes: string;
    validationStatus: string;
    validationMessages: unknown[];
    persistedStatus: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO financial_statements (
      id, organization_id, statement_type, period_start, period_end, period_label,
      currency, scaling, source_file_name, source_file_path, parse_method, overall_confidence,
      validation_status, validation_messages, status, notes, created_by, confirmed_by, confirmed_at,
      created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )`,
    [
      statementId,
      ORG_ID,
      target.statementType,
      payload.detection.periodStart || `${new Date().getFullYear()}-01-01`,
      payload.detection.periodEnd || `${new Date().getFullYear()}-12-31`,
      payload.detection.periodLabel || target.periodLabel || null,
      payload.detection.currency || 'PLN',
      payload.detection.scaling || 'ones',
      path.basename(entry.filePath),
      entry.filePath,
      payload.parseMethod,
      payload.confidence,
      payload.validationStatus,
      JSON.stringify(payload.validationMessages),
      payload.persistedStatus,
      payload.notes.slice(0, 100000),
      ACTOR_ID,
      payload.persistedStatus === 'confirmed' ? ACTOR_ID : null,
      payload.persistedStatus === 'confirmed' ? new Date() : null,
    ]
  );
}

async function insertValues(
  client: pg.Client,
  statementId: string,
  mapped: Array<{
    suggestedCanonicalId?: string | null;
    originalLabel: string;
    value: number;
    confidence?: number;
    sourcePage?: number | null;
    sourceRow?: number | null;
  }>
): Promise<void> {
  for (const line of mapped) {
    if (!line || Number.isNaN(Number(line.value))) continue;
    await client.query(
      `INSERT INTO financial_statement_values (
        id, statement_id, canonical_line_id, original_label, value, confidence, source_page, source_row, mapping_status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
      [
        uuidv4(),
        statementId,
        line.suggestedCanonicalId || null,
        line.originalLabel,
        Number(line.value || 0),
        Number(line.confidence || 0),
        line.sourcePage != null ? Number(line.sourcePage) : null,
        line.sourceRow != null ? Number(line.sourceRow) : null,
        line.suggestedCanonicalId ? 'auto' : 'unmapped',
      ]
    );
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const manifestPath =
    readFlagValue('--manifest') ||
    path.join(root, 'docs/validation/finance-v3/STATEMENT_IMPORT_SAMPLE_MANIFEST_2026-03-15.json');
  const outputJson =
    readFlagValue('--outJson') ||
    path.join(root, 'docs/validation/finance-v3/generated/FINANCE_DIRECT_IMPORT_RESULTS_2026-03-15.json');
  const outputMd =
    readFlagValue('--outMd') ||
    path.join(root, 'docs/validation/finance-v3/generated/FINANCE_DIRECT_IMPORT_RESULTS_2026-03-15.md');

  const manifest = readJson<Entry[]>(manifestPath);
  const client = new pg.Client(DB_URL);
  await client.connect();
  console.log(`[direct-import-finance-manifest] Target org=${ORG_ID}`);

  const results: ImportResult[] = [];
  for (const entry of manifest) {
    const absolutePath = path.isAbsolute(entry.filePath) ? entry.filePath : path.join(root, entry.filePath);
    const { text, parseMethod } = await extractTextFromSource(absolutePath);
    const detection = detectStatementType(text);
    const documentProfile = classifyStatementDocument({
      fileName: path.basename(absolutePath),
      parseMethod,
      text,
    });
    const containedStatementTypes = detectContainedStatementTypes(text);

    for (const target of entry.targets) {
      const statementId = uuidv4();
      const sections = locateStatementSections(text, target.statementType);
      const scopedText = sections[0]?.text || text;
      const columnSelection = resolveStatementColumnSelection(scopedText, {
        ...detection,
        statementType: target.statementType,
        periodLabel: target.periodLabel || detection.periodLabel,
      });
      const extracted = extractFinancialLines(text, target.statementType, {
        selectedPeriodLabel: columnSelection.selectedPeriodLabel,
        comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
      });
      const mapped = resolveDuplicateSuggestedMappings(
        await autoMapLines(extracted.lines, target.statementType, {
          organizationId: ORG_ID,
          templateFamily: documentProfile.templateFamily,
        })
      );
      const validation = validateStatement(
        mapped.map((line) => ({
          canonicalLineId: line.suggestedCanonicalId || null,
          value: Number(line.value || 0),
          originalLabel: line.originalLabel,
          mappingStatus: line.suggestedCanonicalId ? 'auto' : 'unmapped',
          isNonFinancial: !!line.isNonFinancial,
        })),
        target.statementType
      );
      const readiness = evaluateStatementReadiness({
        rawStatus: 'mapped',
        statementType: target.statementType,
        validationStatus: validation.status,
        currency: detection.currency,
        scaling: detection.scaling,
        validationMessages: validation.messages,
        values: mapped.map((line) => ({
          canonicalLineId: line.suggestedCanonicalId || null,
          value: Number(line.value || 0),
          isNonFinancial: !!line.isNonFinancial,
        })),
      });
      const eligible = mapped.filter((line) => !line.isNonFinancial);
      const mappedFinancial = eligible.filter((line) => line.suggestedCanonicalId);
      const coveragePct =
        eligible.length > 0 ? Math.round((mappedFinancial.length / eligible.length) * 100) : 0;
      const persistedStatus = readiness.isReady ? 'confirmed' : 'mapped';

      await insertStatement(client, statementId, entry, target, {
        detection,
        parseMethod,
        documentClass: documentProfile.documentClass,
        confidence: detection.confidence,
        notes: text,
        validationStatus: validation.status,
        validationMessages: validation.messages,
        persistedStatus,
      });
      await insertValues(client, statementId, eligible);

      results.push({
        label: entry.label,
        filePath: entry.filePath,
        statementType: target.statementType,
        statementId,
        parseMethod,
        documentClass: documentProfile.documentClass,
        extractionStrategy: documentProfile.extractionStrategy,
        detectedStatementType: detection.statementType,
        containedStatementTypes,
        selectedPeriodLabel: columnSelection.selectedPeriodLabel,
        comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
        extractedLineCount: extracted.lines.length,
        eligibleLineCount: eligible.length,
        mappedLineCount: mappedFinancial.length,
        coveragePct,
        validationStatus: validation.status,
        readinessStatus: readiness.readinessStatus,
        readinessScore: readiness.readinessScore,
        reasonCodes: readiness.reasonCodes,
        validationCodes: validation.messages.map((message) => message.code),
        topUnmappedLabels: eligible
          .filter((line) => !line.suggestedCanonicalId)
          .slice(0, 10)
          .map((line) => line.originalLabel),
        persistedStatus,
      });

      console.log(
        `[direct-import-finance-manifest] ${entry.label} / ${target.statementType} -> ${readiness.readinessStatus} (${coveragePct}%)`
      );
    }
  }

  await client.end();

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(results, null, 2));
  fs.writeFileSync(outputMd, buildMarkdown(results));

  console.log(`[direct-import-finance-manifest] Wrote ${outputJson}`);
  console.log(`[direct-import-finance-manifest] Wrote ${outputMd}`);
}

main().catch((error) => {
  console.error('[direct-import-finance-manifest] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
