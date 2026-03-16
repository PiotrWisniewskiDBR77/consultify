#!/usr/bin/env tsx
/**
 * Full reimport of ALL financial statements with dual-period support.
 *
 * For each document × statement type:
 *   1. Extract current period values
 *   2. Extract comparison period values
 *   3. Map both via autoMapLines
 *   4. Store BOTH sets as separate value rows with evidence_json containing
 *      { periodLabel, periodIndex } so the analytics layer can build
 *      multi-period views.
 */
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import PDFParserService from '../src/services/pdfParserService.js';
import {
  autoMapLines,
  classifyStatementDocument,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  runCfoAutoValidation,
  validateStatement,
  type CfoAutoValidationResult,
  type ExtractedLine,
} from '../src/services/financialStatementService.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_URL = process.env.DATABASE_URL || process.env.FINANCE_IMPORT_DATABASE_URL;
if (!DB_URL) {
  console.error('Set DATABASE_URL or FINANCE_IMPORT_DATABASE_URL');
  process.exit(1);
}

const ORG_ID =
  process.env.FINANCE_IMPORT_ORG_ID ||
  process.env.TARGET_ORG_ID ||
  'a3e05d4a-5397-419d-b486-8e44366c0063';

const DOCUMENTS = [
  // Apator (Polish, PLN, thousands)
  { label: 'Apator SA Raport R 2024', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
  { label: 'Grupa Apator Raport RS 2023', file: 'knowledge/Finanse/Grupa Apator Raport RS 2023.pdf' },
  { label: 'Grupa Apator Raport RS 2024', file: 'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf' },
  { label: 'Raport skonsolidowany Apator RS 2022', file: 'knowledge/Finanse/Raport-skonsolidowany-Apator.pdf' },
  // Global samples
  { label: 'BMW Group Financial Statements 2024', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
  { label: 'KGHM Skonsolidowane SRR 2024', file: 'knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf' },
  { label: 'BP Annual Report 2025', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
  { label: 'Coca-Cola 10-K 2025', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla 10-K 2024', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
];

const TYPES: Array<'BS' | 'P&L' | 'CF'> = ['BS', 'P&L', 'CF'];

interface ImportResult {
  document: string;
  type: string;
  statementId: string;
  eligibleCurrent: number;
  mappedCurrent: number;
  eligibleComparison: number;
  mappedComparison: number;
  coverage: number;
  readiness: string;
  currentPeriod: string;
  comparisonPeriod: string;
  cfoVerdict: string;
  cfoScore: number;
  cfoRepairs: number;
}

interface DocumentCfoReport {
  document: string;
  cfoResult: CfoAutoValidationResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function deleteAllStatements(client: pg.Client): Promise<void> {
  console.log('\n🗑  Deleting all existing financial statement data...');

  const tables = [
    'financial_statement_values',
    'financial_statement_mapping_candidates',
    'financial_statement_candidate_rows',
    'financial_statement_extracted_sections',
    'financial_statement_validations',
    'financial_statement_versions',
    'financial_statement_source_artifacts',
    'financial_statement_quality_runs',
    'financial_statement_repair_sessions',
    'financial_statement_ingest_runs',
    'financial_statement_packs',
    'financial_statements',
  ];

  for (const table of tables) {
    try {
      const result = await client.query(`DELETE FROM ${table}`);
      console.log(`   ${table}: ${result.rowCount} rows deleted`);
    } catch (e: any) {
      if (e.message?.includes('does not exist')) {
        console.log(`   ${table}: table does not exist (skip)`);
      } else {
        console.log(`   ${table}: ⚠ ${e.message?.slice(0, 80)}`);
      }
    }
  }
  console.log('   ✓ Cleanup complete\n');
}

function findComparisonValue(
  currentLine: ExtractedLine,
  comparisonPeriodLabel: string | null,
  comparisonPeriodIndex: number | null
): number | null {
  const tokens = currentLine.numericTokens;
  if (!tokens || tokens.length === 0) return null;

  const valueTokens = tokens.filter(
    (t) => t.tokenType === 'value' && t.normalizedValue != null
  );

  if (valueTokens.length < 2) return null;

  const selectedToken = currentLine.selectedNumericToken;
  const selectedIndex = selectedToken?.index;

  // Strategy 1: match comparison period label from inline period tokens
  if (comparisonPeriodLabel) {
    const normalizedComp = comparisonPeriodLabel.trim();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (
        token.tokenType === 'period' &&
        (token.periodLabel?.trim() === normalizedComp || token.raw?.trim() === normalizedComp)
      ) {
        const paired = tokens.slice(i + 1).find((t) => t.tokenType === 'value' && t.normalizedValue != null);
        if (paired && paired.index !== selectedIndex) {
          return paired.normalizedValue;
        }
      }
    }
  }

  // Strategy 2: use comparison column index from period grid
  const hasPeriodTokens = tokens.some((t) => t.tokenType === 'period');
  if (!hasPeriodTokens && comparisonPeriodIndex != null && comparisonPeriodIndex < valueTokens.length) {
    const target = valueTokens[comparisonPeriodIndex];
    if (target && target.index !== selectedIndex) {
      return target.normalizedValue;
    }
  }

  // Strategy 3: positional fallback — next value after selected
  const selectedValueIdx = valueTokens.findIndex((t) => t.index === selectedIndex);
  const compIdx = selectedValueIdx >= 0 ? selectedValueIdx + 1 : 1;
  if (compIdx < valueTokens.length) {
    return valueTokens[compIdx].normalizedValue;
  }

  // Strategy 4: any other value token
  const otherValue = valueTokens.find((t) => t.index !== selectedIndex);
  return otherValue?.normalizedValue ?? null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const client = new pg.Client(DB_URL);
  await client.connect();
  console.log(`Connected to database. Target org=${ORG_ID}`);

  await deleteAllStatements(client);

  const results: ImportResult[] = [];
  const docCfoReports: DocumentCfoReport[] = [];

  // Collect all lines per document for cross-statement CFO validation
  const docAllLines: Map<string, Array<{ canonicalLineId: string | null; value: number; originalLabel?: string; statementType: string; isNonFinancial?: boolean }>> = new Map();
  const docStatementIds: Map<string, string[]> = new Map();

  for (const doc of DOCUMENTS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${doc.label}`);
    console.log(`${'═'.repeat(60)}`);

    let text: string;
    try {
      text = await PDFParserService.extractText(doc.file);
    } catch (e: any) {
      console.log(`  ⚠ Could not extract text: ${e.message?.slice(0, 80)}`);
      continue;
    }

    const detection = detectStatementType(text);
    const documentProfile = classifyStatementDocument({
      fileName: doc.file.split('/').pop()!,
      parseMethod: 'text_extraction',
      text,
    });

    console.log(
      `  Detected: type=${detection.statementType} period=${detection.periodLabel} currency=${detection.currency} scaling=${detection.scaling}`
    );

    const packId = uuidv4();
    try {
      await client.query(
        `INSERT INTO financial_statement_packs (
          id, organization_id, entity_name, period_start, period_end, period_label,
          currency, scaling, metadata_json, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING`,
        [
          packId,
          ORG_ID,
          doc.label,
          detection.periodStart || `${new Date().getFullYear()}-01-01`,
          detection.periodEnd || `${new Date().getFullYear()}-12-31`,
          detection.periodLabel || null,
          detection.currency || 'PLN',
          detection.scaling || 'thousands',
          JSON.stringify({
            sourceFileName: doc.file.split('/').pop()!,
            documentClass: documentProfile.documentClass,
            templateFamily: documentProfile.templateFamily,
          }),
        ]
      );
    } catch (e: any) {
      console.log(`  ⚠ Pack insert failed: ${e.message?.slice(0, 100)}`);
    }

    for (const stType of TYPES) {
      const tag = `  [${stType}]`;
      const statementId = uuidv4();

      // Section detection
      const sections = locateStatementSections(text, stType);
      const scopedText = sections[0]?.text || text;

      // Column / period detection
      const columnSelection = resolveStatementColumnSelection(scopedText, {
        ...detection,
        statementType: stType,
      });

      const currentPeriod = columnSelection.selectedPeriodLabel || detection.periodLabel || 'Current';
      const comparisonPeriod = columnSelection.comparisonPeriodLabel || null;

      console.log(
        `${tag} periods: current="${currentPeriod}" comparison="${comparisonPeriod || 'none'}"`
      );

      // Extract current period lines (numericTokens on each line contains ALL column values)
      const extractionCurrent = extractFinancialLines(scopedText, stType, {
        selectedPeriodLabel: currentPeriod,
        comparisonPeriodLabel: comparisonPeriod,
      });

      // Map current period lines
      const mappedCurrent = resolveDuplicateSuggestedMappings(
        await autoMapLines(extractionCurrent.lines, stType, {
          organizationId: ORG_ID,
          templateFamily: documentProfile.templateFamily,
        })
      );

      // Build comparison values from numericTokens (second value column)
      const comparisonValues = new Map<number, number | null>();
      if (comparisonPeriod) {
        for (let i = 0; i < mappedCurrent.length; i++) {
          const compValue = findComparisonValue(
            mappedCurrent[i],
            comparisonPeriod,
            columnSelection.comparisonPeriodIndex
          );
          comparisonValues.set(i, compValue);
        }
      }

      const eligibleCurrent = mappedCurrent.filter((l) => !l.isNonFinancial);
      const mappedCurrentLines = eligibleCurrent.filter((l) => l.suggestedCanonicalId);

      let comparisonMappedCount = 0;
      let comparisonEligibleCount = 0;
      if (comparisonPeriod) {
        for (let i = 0; i < mappedCurrent.length; i++) {
          if (mappedCurrent[i].isNonFinancial) continue;
          const cv = comparisonValues.get(i);
          if (cv != null) {
            comparisonEligibleCount++;
            if (mappedCurrent[i].suggestedCanonicalId) comparisonMappedCount++;
          }
        }
      }

      const totalEligible = eligibleCurrent.length + comparisonEligibleCount;
      const totalMapped = mappedCurrentLines.length + comparisonMappedCount;
      const coverage = totalEligible > 0 ? Math.round((totalMapped / totalEligible) * 100) : 0;

      // Validate (on current period)
      const validation = validateStatement(
        mappedCurrent.map((l) => ({
          canonicalLineId: l.suggestedCanonicalId || null,
          value: Number(l.value || 0),
          originalLabel: l.originalLabel,
          mappingStatus: l.suggestedCanonicalId ? 'auto' : 'unmapped',
          isNonFinancial: !!l.isNonFinancial,
        })),
        stType
      );

      const readiness = evaluateStatementReadiness({
        rawStatus: 'mapped',
        statementType: stType,
        validationStatus: validation.status,
        currency: detection.currency,
        scaling: detection.scaling,
        validationMessages: validation.messages,
        values: mappedCurrent.map((l) => ({
          canonicalLineId: l.suggestedCanonicalId || null,
          value: Number(l.value || 0),
          isNonFinancial: !!l.isNonFinancial,
        })),
      });

      // Collect lines for document-level CFO validation
      const linesForCfo = mappedCurrent
        .filter((l) => !l.isNonFinancial)
        .map((l) => ({
          canonicalLineId: l.suggestedCanonicalId || null,
          value: Number(l.value || 0),
          originalLabel: l.originalLabel,
          statementType: stType,
          isNonFinancial: false,
        }));
      const existing = docAllLines.get(doc.label) || [];
      docAllLines.set(doc.label, [...existing, ...linesForCfo]);
      const stIds = docStatementIds.get(doc.label) || [];
      stIds.push(statementId);
      docStatementIds.set(doc.label, stIds);

      console.log(
        `${tag} current: ${mappedCurrentLines.length}/${eligibleCurrent.length} mapped | ` +
          `comparison: ${comparisonMappedCount}/${comparisonEligibleCount} mapped | ` +
          `readiness=${readiness.readinessStatus}`
      );

      // Insert statement record
      try {
        await client.query(
          `INSERT INTO financial_statements (
            id, organization_id, statement_type, period_start, period_end, period_label,
            currency, scaling, source_file_name, source_file_path, parse_method, status,
            notes, overall_confidence, readiness_status, document_class, extraction_strategy,
            template_family, statement_pack_id,
            created_by, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING`,
          [
            statementId,
            ORG_ID,
            stType,
            detection.periodStart || `${new Date().getFullYear()}-01-01`,
            detection.periodEnd || `${new Date().getFullYear()}-12-31`,
            currentPeriod,
            detection.currency || 'PLN',
            detection.scaling || 'thousands',
            doc.file.split('/').pop()!,
            doc.file,
            'text_extraction',
            readiness.isReady ? 'confirmed' : 'mapped',
            null,
            detection.confidence,
            readiness.readinessStatus,
            documentProfile.documentClass,
            'local_parser',
            documentProfile.templateFamily,
            packId,
            'auto-import',
          ]
        );
      } catch (e: any) {
        console.log(`${tag}   ⚠ Statement insert: ${e.message?.slice(0, 100)}`);
      }

      // Save values — CURRENT PERIOD (periodIndex=0)
      let savedCurrent = 0;
      for (const line of eligibleCurrent) {
        try {
          await client.query(
            `INSERT INTO financial_statement_values (
              id, statement_id, canonical_line_id, original_label, value, confidence,
              source_row, mapping_status, is_non_financial, value_origin, mapping_confidence,
              period_granularity, evidence_json, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [
              uuidv4(),
              statementId,
              line.suggestedCanonicalId || null,
              line.originalLabel,
              Number(line.value || 0),
              Number(line.confidence || 0),
              line.sourceRow || null,
              line.suggestedCanonicalId ? 'auto' : 'unmapped',
              false,
              'source',
              Number(line.confidence || 0),
              'annual',
              JSON.stringify({
                periodLabel: currentPeriod,
                periodIndex: 0,
                selectionReason: 'primary_period',
              }),
            ]
          );
          savedCurrent++;
        } catch (e: any) {
          if (savedCurrent === 0) console.log(`${tag}   ⚠ Current value insert: ${e.message?.slice(0, 100)}`);
        }
      }

      // Save values — COMPARISON PERIOD (periodIndex=1)
      // Uses numericTokens from the current extraction to find the second value column
      let savedComparison = 0;
      if (comparisonPeriod) {
        const allCurrentIdx = mappedCurrent.map((l, i) => ({ line: l, globalIdx: i }));
        for (const { line, globalIdx } of allCurrentIdx) {
          if (line.isNonFinancial) continue;
          const compValue = comparisonValues.get(globalIdx);
          if (compValue == null) continue;
          try {
            await client.query(
              `INSERT INTO financial_statement_values (
                id, statement_id, canonical_line_id, original_label, value, confidence,
                source_row, mapping_status, is_non_financial, value_origin, mapping_confidence,
                period_granularity, evidence_json, created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
              [
                uuidv4(),
                statementId,
                line.suggestedCanonicalId || null,
                line.originalLabel,
                compValue,
                Number(line.confidence || 0),
                line.sourceRow || null,
                line.suggestedCanonicalId ? 'auto' : 'unmapped',
                false,
                'source',
                Number(line.confidence || 0),
                'annual',
                JSON.stringify({
                  periodLabel: comparisonPeriod,
                  periodIndex: 1,
                  selectionReason: 'comparison_period',
                }),
              ]
            );
            savedComparison++;
          } catch (e: any) {
            if (savedComparison === 0) console.log(`${tag}   ⚠ Comparison value insert: ${e.message?.slice(0, 100)}`);
          }
        }
      }

      console.log(
        `${tag}   → saved ${savedCurrent} current + ${savedComparison} comparison values`
      );

      results.push({
        document: doc.label,
        type: stType,
        statementId,
        eligibleCurrent: eligibleCurrent.length,
        mappedCurrent: mappedCurrentLines.length,
        eligibleComparison: comparisonEligibleCount,
        mappedComparison: comparisonMappedCount,
        coverage,
        readiness: readiness.readinessStatus,
        currentPeriod,
        comparisonPeriod: comparisonPeriod || '-',
        cfoVerdict: '',
        cfoScore: 0,
        cfoRepairs: 0,
      });
    }

    // ── DOCUMENT-LEVEL CFO AUTO-VALIDATION (cross-statement) ──
    const allDocLines = docAllLines.get(doc.label) || [];
    if (allDocLines.length > 0) {
      const docResults = results.filter((r) => r.document === doc.label);
      const anyComparison = docResults.some((r) => r.comparisonPeriod !== '-');
      const cfoResult = runCfoAutoValidation(allDocLines, {
        currency: detection.currency,
        scaling: detection.scaling,
        period: detection.periodLabel || 'Current',
        documentName: doc.label,
        hasComparisonData: anyComparison,
      });

      console.log(`\n  📊 CFO VALIDATION [${doc.label}]: ${cfoResult.verdict} (score=${cfoResult.qualityScore}) repairs=${cfoResult.repairs.length}`);
      for (const check of cfoResult.checks) {
        if (check.severity === 'error') {
          console.log(`     ❌ ${check.code}: ${check.message}${check.details ? ` — ${check.details}` : ''}`);
        } else if (check.severity === 'warning') {
          console.log(`     ⚠️  ${check.code}: ${check.message}${check.details ? ` — ${check.details}` : ''}`);
        }
      }
      const passes = cfoResult.checks.filter((c) => c.severity === 'pass');
      if (passes.length > 0) {
        console.log(`     ✅ ${passes.map((c) => `${c.code}: ${c.message}`).join(' | ')}`);
      }
      if (cfoResult.repairs.length > 0) {
        console.log(`     🔧 ${cfoResult.repairs.map((r) => `${r.canonicalLineId}=${r.repairedValue.toFixed(2)} (${r.reason})`).join('; ')}`);
      }

      // Save derived values — attach to the statement that matches the derived line's type
      const stIds = docStatementIds.get(doc.label) || [];
      const currentPeriodForDoc = results.find((r) => r.document === doc.label)?.currentPeriod || 'Current';
      let savedDerived = 0;
      for (const derived of cfoResult.derivedLines) {
        if (!derived.canonicalLineId) continue;
        const typePrefix = derived.canonicalLineId.startsWith('fsl-bs-') ? 'BS' : derived.canonicalLineId.startsWith('fsl-pl-') ? 'P&L' : 'CF';
        const matchingResult = docResults.find((r) => r.type === typePrefix);
        const targetStatementId = matchingResult?.statementId;
        if (!targetStatementId) continue;

        try {
          await client.query(
            `INSERT INTO financial_statement_values (
              id, statement_id, canonical_line_id, original_label, value, confidence,
              source_row, mapping_status, is_non_financial, value_origin, mapping_confidence,
              period_granularity, evidence_json, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [
              uuidv4(),
              targetStatementId,
              derived.canonicalLineId,
              derived.originalLabel || '[CFO-derived]',
              derived.value,
              0.8,
              null,
              'auto',
              false,
              'computed',
              0.8,
              'annual',
              JSON.stringify({
                periodLabel: currentPeriodForDoc,
                periodIndex: 0,
                selectionReason: 'cfo_auto_validation',
                derivedBy: 'runCfoAutoValidation',
              }),
            ]
          );
          savedDerived++;
        } catch (e: any) {
          console.log(`     ⚠ Derived insert (${derived.canonicalLineId}): ${e.message?.slice(0, 100)}`);
        }
      }
      if (savedDerived > 0) {
        console.log(`     💾 Saved ${savedDerived} derived values to DB`);
      }

      // Update result records with CFO scores
      for (const r of results) {
        if (r.document === doc.label) {
          r.cfoVerdict = cfoResult.verdict;
          r.cfoScore = cfoResult.qualityScore;
          r.cfoRepairs = cfoResult.repairs.length;
        }
      }

      docCfoReports.push({ document: doc.label, cfoResult });
    }
  }

  await client.end();

  // Summary
  console.log(`\n\n${'═'.repeat(120)}`);
  console.log('                              IMPORT SUMMARY');
  console.log(`${'═'.repeat(120)}\n`);

  console.log(
    'Document'.padEnd(42) +
      'Type'.padEnd(6) +
      'Current'.padEnd(12) +
      'Comp.'.padEnd(12) +
      'Cov%'.padEnd(8) +
      'CFO'.padEnd(22) +
      'Readiness'.padEnd(14) +
      'Periods'
  );
  console.log('-'.repeat(140));

  let totalMapped = 0;
  let totalEligible = 0;
  let totalDerived = 0;
  for (const r of results) {
    const curMapped = r.mappedCurrent;
    const curTotal = r.eligibleCurrent;
    const compMapped = r.mappedComparison;
    const compTotal = r.eligibleComparison;
    totalMapped += curMapped + compMapped;
    totalEligible += curTotal + compTotal;
    totalDerived += r.cfoRepairs;

    const icon = r.cfoVerdict === 'APPROVED' ? '✅' : r.cfoVerdict === 'APPROVED_WITH_NOTES' ? '🟡' : r.cfoVerdict === 'NEEDS_REVIEW' ? '⚠️' : '❌';
    console.log(
      `${icon} ${r.document.padEnd(39)} ${r.type.padEnd(6)}` +
        `${curMapped}/${curTotal}`.padEnd(12) +
        `${compMapped}/${compTotal}`.padEnd(12) +
        `${r.coverage}%`.padEnd(8) +
        `${r.cfoVerdict}(${r.cfoScore})`.padEnd(22) +
        `${r.readiness}`.padEnd(14) +
        `${r.currentPeriod} / ${r.comparisonPeriod}`
    );
  }
  console.log('-'.repeat(140));
  const totalCoverage = totalEligible > 0 ? Math.round((totalMapped / totalEligible) * 100) : 0;
  console.log(`   TOTAL: ${totalMapped}/${totalEligible} lines mapped (${totalCoverage}%)`);
  console.log(`   CFO auto-repairs: ${totalDerived} derived values inserted`);
  console.log(`   Documents: ${DOCUMENTS.length} | Statements: ${results.length}`);

  // ── CFO DETAILED REPORT ──
  console.log(`\n\n${'═'.repeat(120)}`);
  console.log('                        CFO AUTO-VALIDATION REPORT');
  console.log(`${'═'.repeat(120)}`);

  for (const report of docCfoReports) {
    const r = report.cfoResult;
    const verdictIcon = r.verdict === 'APPROVED' ? '✅' : r.verdict === 'APPROVED_WITH_NOTES' ? '🟡' : r.verdict === 'NEEDS_REVIEW' ? '⚠️' : '❌';
    console.log(`\n${verdictIcon} ${report.document} — Score: ${r.qualityScore}/100 — ${r.verdict}`);

    const passes = r.checks.filter((c) => c.severity === 'pass');
    const warnings = r.checks.filter((c) => c.severity === 'warning');
    const errors = r.checks.filter((c) => c.severity === 'error');
    const infos = r.checks.filter((c) => c.severity === 'info');

    if (errors.length > 0) {
      for (const c of errors) {
        console.log(`   ❌ ${c.code}: ${c.message}${c.details ? ` (${c.details})` : ''}`);
      }
    }
    if (warnings.length > 0) {
      for (const c of warnings) {
        console.log(`   ⚠️  ${c.code}: ${c.message}${c.details ? ` (${c.details})` : ''}`);
      }
    }
    if (infos.length > 0) {
      for (const c of infos) {
        console.log(`   ℹ️  ${c.code}: ${c.message}`);
      }
    }
    if (passes.length > 0) {
      console.log(`   ✅ ${passes.map((c) => c.code).join(', ')}`);
    }
    if (r.repairs.length > 0) {
      console.log(`   🔧 Repairs: ${r.repairs.map((rp) => `${rp.canonicalLineId}=${rp.repairedValue.toFixed(2)} (${rp.reason})`).join('; ')}`);
    }
  }

  // Overall verdict
  const approvedCount = results.filter((r) => r.cfoVerdict === 'APPROVED' || r.cfoVerdict === 'APPROVED_WITH_NOTES').length;
  const reviewCount = results.filter((r) => r.cfoVerdict === 'NEEDS_REVIEW').length;
  const rejectedCount = results.filter((r) => r.cfoVerdict === 'REJECTED').length;

  console.log(`\n${'─'.repeat(120)}`);
  console.log(`CFO SUMMARY: ${approvedCount}/${results.length} approved | ${reviewCount} need review | ${rejectedCount} rejected`);
  console.log(`Total derived values: ${totalDerived}`);
  if (rejectedCount === 0 && reviewCount === 0) {
    console.log('🏆 ALL STATEMENTS PASSED CFO AUTO-VALIDATION');
  } else if (rejectedCount === 0) {
    console.log('📋 System ready with notes — manual review recommended for flagged items');
  } else {
    console.log('🚨 Some statements rejected — requires investigation before use');
  }
  console.log();
}

main().catch((error) => {
  console.error('Fatal:', (error as Error).message);
  process.exit(1);
});
