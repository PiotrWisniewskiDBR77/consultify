#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

import * as XLSX from 'xlsx';

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
import {
  mapUnmappedLinesWithLLM,
  applyLlmProposals,
  mapDuplicateConflictLinesWithLLM,
  applySecondPassProposals,
} from '../src/services/llmFinancialMappingService.js';
import {
  classifyMappingTier,
  assessCoverage,
  MappingTier,
  isNonFinancialByPolicy,
  isLikelySubtotalOrAggregate,
} from '../src/services/financeMappingPolicy.js';

type RealCorpusTarget = {
  statementType: 'BS' | 'P&L' | 'CF';
  periodLabel?: string;
};

type RealCorpusEntry = {
  label: string;
  filePath: string;
  targets: RealCorpusTarget[];
};

type TargetAuditResult = {
  statementType: 'BS' | 'P&L' | 'CF';
  selectedPeriodLabel: string | null;
  comparisonPeriodLabel: string | null;
  selectionStrategy: string;
  extractedLineCount: number;
  mappedLineCount: number;
  nonFinancialLineCount: number;
  coveragePct: number;
  readinessStatus: string;
  readinessScore: number;
  reasonCodes: string[];
  warnings: string[];
  topMappedLines: Array<{ label: string; canonicalId: string | null; value: number }>;
  topUnmappedLines: Array<{ label: string; value: number }>;
};

type DocumentAuditResult = {
  label: string;
  filePath: string;
  detectedStatementType: string;
  containedStatementTypes: string[];
  documentClass: string;
  extractionStrategy: string;
  currency: string;
  scaling: string;
  textLength: number;
  targets: TargetAuditResult[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readFlagValue(flag: string): string | null {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : null;
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

const USE_LLM_MAPPING = process.argv.includes('--llm');

async function auditEntry(root: string, entry: RealCorpusEntry): Promise<DocumentAuditResult> {
  const sourcePath = path.isAbsolute(entry.filePath) ? entry.filePath : path.join(root, entry.filePath);
  const { text, parseMethod } = await extractTextFromSource(sourcePath);
  const detection = detectStatementType(text);
  const documentProfile = classifyStatementDocument({
    fileName: path.basename(sourcePath),
    parseMethod,
    text,
  });
  const containedStatementTypes = detectContainedStatementTypes(text);

  const targets: TargetAuditResult[] = [];
  for (const target of entry.targets) {
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
    const heuristicResult = await autoMapLines(extracted.lines, target.statementType, {
      organizationId: '',
      templateFamily: documentProfile.templateFamily,
    });

    if (USE_LLM_MAPPING) {
      const unmappedCount = heuristicResult.filter(
        (l) => !l.suggestedCanonicalId && !l.isNonFinancial && l.originalLabel
      ).length;
      if (unmappedCount > 0) {
        try {
          const llmResult = await mapUnmappedLinesWithLLM({
            allLines: heuristicResult,
            statementType: target.statementType,
            traceId: `audit-${entry.label}-${target.statementType}`,
          });
          if (llmResult.proposals.length > 0) {
            const { applied } = applyLlmProposals(heuristicResult, llmResult.proposals);
            console.log(
              `  [LLM] ${entry.label} ${target.statementType}: ${applied} lines mapped by ${llmResult.provider} (${llmResult.durationMs}ms)`
            );
          }
        } catch (err) {
          console.error(`  [LLM] Error for ${entry.label} ${target.statementType}:`, err);
        }
      }
    }

    const mapped = resolveDuplicateSuggestedMappings(heuristicResult);

    if (USE_LLM_MAPPING) {
      const conflictCount = mapped.filter(
        (l) => l.mappingReason === 'duplicate_candidate_conflict'
      ).length;
      if (conflictCount > 0) {
        try {
          const secondPass = await mapDuplicateConflictLinesWithLLM({
            allLines: mapped,
            statementType: target.statementType,
            traceId: `audit-2nd-${entry.label}-${target.statementType}`,
          });
          if (secondPass.proposals.length > 0) {
            const { applied } = applySecondPassProposals(mapped, secondPass.proposals);
            console.log(
              `  [LLM-2nd] ${entry.label} ${target.statementType}: ${applied}/${conflictCount} conflicts resolved by ${secondPass.provider} (${secondPass.durationMs}ms)`
            );
          }
        } catch (err) {
          console.error(`  [LLM-2nd] Error for ${entry.label} ${target.statementType}:`, err);
        }
      }
    }

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

    for (const line of mapped) {
      if (!line.isNonFinancial && isNonFinancialByPolicy(line.originalLabel)) {
        line.isNonFinancial = true;
        line.classificationReason = 'policy_non_financial';
      }
      if (!line.isNonFinancial && !line.suggestedCanonicalId && isLikelySubtotalOrAggregate(line.originalLabel)) {
        line.isNonFinancial = true;
        line.classificationReason = 'policy_subtotal_aggregate';
      }
    }

    const eligibleLines = mapped.filter((line) => !line.isNonFinancial);
    const mappedLines = eligibleLines.filter((line) => line.suggestedCanonicalId);
    const unmappedLines = eligibleLines.filter((line) => !line.suggestedCanonicalId);

    const tiers = mapped.map((line) =>
      classifyMappingTier({
        suggestedCanonicalId: line.suggestedCanonicalId,
        mappingReason: line.mappingReason,
        isNonFinancial: line.isNonFinancial,
        originalLabel: line.originalLabel,
      })
    );
    const coverage = assessCoverage(tiers, mapped.length);
    targets.push({
      statementType: target.statementType,
      selectedPeriodLabel: columnSelection.selectedPeriodLabel,
      comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
      selectionStrategy: columnSelection.selectionStrategy,
      extractedLineCount: eligibleLines.length,
      mappedLineCount: mappedLines.length,
      nonFinancialLineCount: mapped.filter((line) => line.isNonFinancial).length,
      coveragePct: eligibleLines.length > 0 ? Math.round((mappedLines.length / eligibleLines.length) * 100) : 0,
      readinessStatus: readiness.readinessStatus,
      readinessScore: readiness.readinessScore,
      reasonCodes: readiness.reasonCodes,
      warnings: validation.messages
        .filter((message) => message.type === 'warning' || message.type === 'error')
        .map((message) => message.code),
      topMappedLines: mappedLines.map((line) => ({
        label: line.originalLabel,
        canonicalId: line.suggestedCanonicalId || null,
        value: Number(line.value || 0),
      })),
      topUnmappedLines: unmappedLines.map((line) => ({
        label: line.originalLabel,
        value: Number(line.value || 0),
        reason: line.mappingReason || null,
      })),
      policyAssessment: {
        effectiveCoveragePct: coverage.effectiveCoveragePct,
        tier1Auto: coverage.tier1Auto,
        tier2LlmConfirmed: coverage.tier2LlmConfirmed,
        tier3ReviewRequired: coverage.tier3ReviewRequired,
        tier4Excluded: coverage.tier4Excluded,
        meetsTarget: coverage.meetsTarget,
        canAutoConfirm: coverage.canAutoConfirm,
        summary: coverage.summary,
      },
    });
  }

  return {
    label: entry.label,
    filePath: entry.filePath,
    detectedStatementType: detection.statementType,
    containedStatementTypes,
    documentClass: documentProfile.documentClass,
    extractionStrategy: documentProfile.extractionStrategy,
    currency: detection.currency,
    scaling: detection.scaling,
    textLength: text.length,
    targets,
  };
}

function buildMarkdownReport(results: DocumentAuditResult[]): string {
  const lines: string[] = ['# Real Statement Import Audit', ''];
  for (const result of results) {
    lines.push(`## ${result.label}`);
    lines.push('');
    lines.push(`- File: \`${result.filePath}\``);
    lines.push(`- Detected type: \`${result.detectedStatementType}\``);
    lines.push(
      `- Contained statement types: ${result.containedStatementTypes.length ? result.containedStatementTypes.map((value) => `\`${value}\``).join(', ') : 'none'}`
    );
    lines.push(`- Document class: \`${result.documentClass}\``);
    lines.push(`- Extraction strategy: \`${result.extractionStrategy}\``);
    lines.push(`- Currency / scaling: \`${result.currency}\` / \`${result.scaling}\``);
    lines.push(`- Extracted text length: ${result.textLength}`);
    lines.push('');

    for (const target of result.targets) {
      lines.push(`### ${target.statementType}`);
      lines.push('');
      lines.push(`- Selected period: \`${target.selectedPeriodLabel || 'n/a'}\``);
      lines.push(`- Comparison period: \`${target.comparisonPeriodLabel || 'n/a'}\``);
      lines.push(`- Selection strategy: \`${target.selectionStrategy}\``);
      lines.push(`- Extracted lines: ${target.extractedLineCount}`);
      lines.push(`- Mapped lines: ${target.mappedLineCount}`);
      lines.push(`- Coverage: ${target.coveragePct}%`);
      lines.push(`- Readiness: \`${target.readinessStatus}\` (${target.readinessScore})`);
      lines.push(
        `- Reason codes: ${target.reasonCodes.length ? target.reasonCodes.map((value) => `\`${value}\``).join(', ') : 'none'}`
      );
      lines.push(
        `- Validation blockers: ${target.warnings.length ? target.warnings.map((value) => `\`${value}\``).join(', ') : 'none'}`
      );
      if (target.policyAssessment) {
        const pa = target.policyAssessment;
        lines.push('');
        lines.push('**Policy Assessment:**');
        lines.push(`- Effective coverage: **${pa.effectiveCoveragePct}%** ${pa.meetsTarget ? '✅' : '⚠️'}`);
        lines.push(`- Tier 1 (auto): ${pa.tier1Auto} | Tier 2 (LLM confirmed): ${pa.tier2LlmConfirmed} | Tier 3 (review): ${pa.tier3ReviewRequired} | Tier 4 (excluded): ${pa.tier4Excluded}`);
        lines.push(`- Auto-confirm eligible: ${pa.canAutoConfirm ? 'YES' : 'NO'}`);
        lines.push(`- ${pa.summary}`);
      }
      lines.push('');
      lines.push('| Mapped labels | Canonical ID | Value |');
      lines.push('| --- | --- | ---: |');
      for (const row of target.topMappedLines) {
        lines.push(`| ${row.label} | ${row.canonicalId || '—'} | ${row.value} |`);
      }
      if (target.topMappedLines.length === 0) {
        lines.push('| none | — | — |');
      }
      lines.push('');
      lines.push('| Unmapped labels | Value |');
      lines.push('| --- | ---: |');
      for (const row of target.topUnmappedLines) {
        lines.push(`| ${row.label} | ${row.value} |`);
      }
      if (target.topUnmappedLines.length === 0) {
        lines.push('| none | — |');
      }
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('## Policy Summary');
  lines.push('');
  lines.push('| Document | Statement | Raw Coverage | Effective Coverage | T1 Auto | T2 LLM | T3 Review | T4 Excluded | Auto-Confirm |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const result of results) {
    for (const target of result.targets) {
      const pa = target.policyAssessment;
      if (pa) {
        lines.push(
          `| ${result.label} | ${target.statementType} | ${target.coveragePct}% | **${pa.effectiveCoveragePct}%** | ${pa.tier1Auto} | ${pa.tier2LlmConfirmed} | ${pa.tier3ReviewRequired} | ${pa.tier4Excluded} | ${pa.canAutoConfirm ? '✅' : '—'} |`
        );
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const root = process.cwd();
  const manifestPath =
    readFlagValue('--manifest') ||
    path.join(root, 'server/scripts/fixtures/statement-ready-corpus.real.json');
  const outputJson =
    readFlagValue('--outJson') ||
    path.join(root, 'docs/validation/finance-v3/generated/REAL_STATEMENT_IMPORT_AUDIT.json');
  const outputMd =
    readFlagValue('--outMd') ||
    path.join(root, 'docs/validation/finance-v3/generated/REAL_STATEMENT_IMPORT_AUDIT.md');
  const manifest = readJson<RealCorpusEntry[]>(manifestPath);

  const results: DocumentAuditResult[] = [];
  for (const entry of manifest) {
    results.push(await auditEntry(root, entry));
  }

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(results, null, 2));
  fs.writeFileSync(outputMd, buildMarkdownReport(results));

  console.log(`[audit-statement-import-real-corpus] Wrote ${outputJson}`);
  console.log(`[audit-statement-import-real-corpus] Wrote ${outputMd}`);
}

main().catch((error) => {
  console.error('[audit-statement-import-real-corpus] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
