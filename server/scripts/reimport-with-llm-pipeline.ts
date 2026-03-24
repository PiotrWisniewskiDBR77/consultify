#!/usr/bin/env tsx
/**
 * Full reimport using the 3-Phase LLM Financial Pipeline.
 *
 * Phase 1: Heuristic pre-mapping (only high-confidence ≥ 0.95)
 * Phase 2: LLM Full Analysis (GPT-4o reviews, maps, corrects)
 * Phase 3: LLM CFO Review (sanity checks, deviations, corrections)
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging.local npx tsx server/scripts/reimport-with-llm-pipeline.ts
 */
import '../src/config/loadEnv.js';

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import PDFParserService from '../src/services/pdfParserService.js';
import { requireConfirmation } from './lib/scriptDatabaseTarget.js';
import { resolveFinanceImportDatabaseUrl, resolveFinanceImportOrgId } from './lib/financeImportTarget.js';
import {
  classifyStatementDocument,
  detectStatementType,
  evaluateStatementReadiness,
  validateStatement,
} from '../src/services/financialStatementService.js';
import {
  runDocumentPipeline,
  type PipelineResult,
} from '../src/services/llmFinancialPipelineService.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_URL = resolveFinanceImportDatabaseUrl();

if (!process.env.OPENAI_API_KEY) {
  console.error('⚠ OPENAI_API_KEY not set — LLM phases will be skipped');
}

const ORG_ID = resolveFinanceImportOrgId();

requireConfirmation(
  'FINANCE_REIMPORT_LLM_CONFIRM',
  'YES_REIMPORT_WITH_LLM',
  'reimport-with-llm-pipeline'
);

const DOCUMENTS = [
  { label: 'Apator SA Raport R 2024', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
  { label: 'Grupa Apator Raport RS 2023', file: 'knowledge/Finanse/Grupa Apator Raport RS 2023.pdf' },
  { label: 'Grupa Apator Raport RS 2024', file: 'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf' },
  { label: 'Raport skonsolidowany Apator RS 2022', file: 'knowledge/Finanse/Raport-skonsolidowany-Apator.pdf' },
  { label: 'BMW Group Financial Statements 2024', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
  { label: 'KGHM Skonsolidowane SRR 2024', file: 'knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf' },
  { label: 'BP Annual Report 2025', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
  { label: 'Coca-Cola 10-K 2025', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla 10-K 2024', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
];

const TYPES: Array<'BS' | 'P&L' | 'CF'> = ['BS', 'P&L', 'CF'];

// ---------------------------------------------------------------------------
// DB Helpers
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface DocSummary {
  document: string;
  type: string;
  statementId: string;
  phase1Accepted: number;
  phase1Rejected: number;
  phase2Mapped: number;
  phase2Corrected: number;
  totalLines: number;
  unmapped: number;
  qualityScore: number;
  verdict: string;
  savedValues: number;
}

async function main(): Promise<void> {
  const client = new pg.Client(DB_URL);
  await client.connect();
  console.log(`Connected to database. Target org=${ORG_ID}`);
  console.log(`OPENAI_API_KEY set: ${!!process.env.OPENAI_API_KEY}`);

  await deleteAllStatements(client);

  const summaries: DocSummary[] = [];

  for (const doc of DOCUMENTS) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  📄 ${doc.label}`);
    console.log(`${'═'.repeat(80)}`);

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
      `  Detected: period=${detection.periodLabel} currency=${detection.currency} scaling=${detection.scaling}`
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
          packId, ORG_ID, doc.label,
          detection.periodStart || `${new Date().getFullYear()}-01-01`,
          detection.periodEnd || `${new Date().getFullYear()}-12-31`,
          detection.periodLabel || null,
          detection.currency || 'PLN',
          detection.scaling || 'thousands',
          JSON.stringify({
            sourceFileName: doc.file.split('/').pop()!,
            documentClass: documentProfile.documentClass,
            templateFamily: documentProfile.templateFamily,
            pipeline: 'llm-3phase',
          }),
        ]
      );
    } catch (e: any) {
      console.log(`  ⚠ Pack insert failed: ${e.message?.slice(0, 100)}`);
    }

    // Run 3-phase pipeline for all statement types
    const docResult = await runDocumentPipeline(text, doc.label, {
      organizationId: ORG_ID,
      templateFamily: documentProfile.templateFamily,
      currency: detection.currency || 'PLN',
      scaling: detection.scaling || 'thousands',
      periodLabel: detection.periodLabel || undefined,
    });

    // Save results to DB
    for (const stType of TYPES) {
      const pipeResult = docResult.results.get(stType);
      if (!pipeResult) continue;

      const statementId = uuidv4();
      const currentPeriod = detection.periodLabel || 'Current';

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
            statementId, ORG_ID, stType,
            detection.periodStart || `${new Date().getFullYear()}-01-01`,
            detection.periodEnd || `${new Date().getFullYear()}-12-31`,
            currentPeriod,
            detection.currency || 'PLN',
            detection.scaling || 'thousands',
            doc.file.split('/').pop()!,
            doc.file,
            'text_extraction',
            pipeResult.verdict === 'APPROVED' || pipeResult.verdict === 'APPROVED_WITH_NOTES' ? 'confirmed' : 'mapped',
            `LLM Pipeline: ${pipeResult.verdict} (score=${pipeResult.qualityScore})`,
            pipeResult.qualityScore / 100,
            pipeResult.verdict === 'APPROVED' || pipeResult.verdict === 'APPROVED_WITH_NOTES' ? 'ready' : pipeResult.verdict === 'NEEDS_REVIEW' ? 'recoverable' : 'rejected',
            documentProfile.documentClass,
            'llm_3phase_pipeline',
            documentProfile.templateFamily,
            packId,
            'llm-pipeline-import',
          ]
        );
      } catch (e: any) {
        console.log(`  [${stType}] ⚠ Statement insert: ${e.message?.slice(0, 100)}`);
      }

      // Save values — current period
      let savedValues = 0;
      for (const line of pipeResult.lines) {
        try {
          await client.query(
            `INSERT INTO financial_statement_values (
              id, statement_id, canonical_line_id, original_label, value, confidence,
              source_row, mapping_status, is_non_financial, value_origin, mapping_confidence,
              period_granularity, evidence_json, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [
              uuidv4(), statementId, line.canonicalId,
              line.originalLabel, line.value, line.confidence,
              null,
              'auto',
              false,
              line.source === 'heuristic' ? 'source' : line.source === 'cfo_derived' ? 'computed' : 'mapped',
              line.confidence,
              'annual',
              JSON.stringify({
                periodLabel: currentPeriod,
                periodIndex: 0,
                selectionReason: 'llm_pipeline',
                source: line.source,
                mappingReason: line.mappingReason,
              }),
            ]
          );
          savedValues++;
        } catch (e: any) {
          if (savedValues === 0) console.log(`  [${stType}] ⚠ Value insert: ${e.message?.slice(0, 100)}`);
        }

        // Save comparison value if available
        if (line.comparisonValue != null) {
          try {
            await client.query(
              `INSERT INTO financial_statement_values (
                id, statement_id, canonical_line_id, original_label, value, confidence,
                source_row, mapping_status, is_non_financial, value_origin, mapping_confidence,
                period_granularity, evidence_json, created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
              [
                uuidv4(), statementId, line.canonicalId,
                line.originalLabel, line.comparisonValue, line.confidence,
                null, 'auto', false,
                line.source === 'heuristic' ? 'source' : 'mapped',
                line.confidence, 'annual',
                JSON.stringify({
                  periodLabel: 'Comparison',
                  periodIndex: 1,
                  selectionReason: 'comparison_period',
                  source: line.source,
                }),
              ]
            );
          } catch {}
        }
      }

      // Print Phase 3 checks
      const errors = pipeResult.checks.filter((c) => c.severity === 'error');
      const warnings = pipeResult.checks.filter((c) => c.severity === 'warning');
      const passes = pipeResult.checks.filter((c) => c.severity === 'pass');

      if (errors.length > 0) {
        for (const c of errors) console.log(`  [${stType}] ❌ ${c.code}: ${c.message}`);
      }
      if (warnings.length > 0) {
        for (const c of warnings) console.log(`  [${stType}] ⚠️  ${c.code}: ${c.message}`);
      }
      if (passes.length > 0) {
        console.log(`  [${stType}] ✅ ${passes.map((c) => c.code).join(', ')}`);
      }

      const verdictIcon = pipeResult.verdict === 'APPROVED' ? '✅' : pipeResult.verdict === 'APPROVED_WITH_NOTES' ? '🟡' : pipeResult.verdict === 'NEEDS_REVIEW' ? '⚠️' : '❌';
      console.log(
        `  [${stType}] ${verdictIcon} Score=${pipeResult.qualityScore} Verdict=${pipeResult.verdict} ` +
        `Lines=${pipeResult.lines.length} Saved=${savedValues}`
      );

      summaries.push({
        document: doc.label,
        type: stType,
        statementId,
        phase1Accepted: pipeResult.phases.phase1.accepted,
        phase1Rejected: pipeResult.phases.phase1.rejected,
        phase2Mapped: pipeResult.phases.phase2.mapped,
        phase2Corrected: pipeResult.phases.phase2.corrected,
        totalLines: pipeResult.lines.length,
        unmapped: pipeResult.unmappedLines.length,
        qualityScore: pipeResult.qualityScore,
        verdict: pipeResult.verdict,
        savedValues,
      });
    }
  }

  await client.end();

  // ── SUMMARY TABLE ──
  console.log(`\n\n${'═'.repeat(140)}`);
  console.log('                              LLM PIPELINE IMPORT SUMMARY');
  console.log(`${'═'.repeat(140)}\n`);

  console.log(
    'Document'.padEnd(42) +
    'Type'.padEnd(6) +
    'P1:ok'.padEnd(8) +
    'P1:rej'.padEnd(8) +
    'P2:new'.padEnd(8) +
    'P2:fix'.padEnd(8) +
    'Total'.padEnd(8) +
    'Unmap'.padEnd(8) +
    'Score'.padEnd(8) +
    'Verdict'.padEnd(22) +
    'Saved'
  );
  console.log('-'.repeat(140));

  let grandTotal = 0;
  let grandUnmapped = 0;
  for (const s of summaries) {
    grandTotal += s.totalLines;
    grandUnmapped += s.unmapped;
    const icon = s.verdict === 'APPROVED' ? '✅' : s.verdict === 'APPROVED_WITH_NOTES' ? '🟡' : s.verdict === 'NEEDS_REVIEW' ? '⚠️' : '❌';
    console.log(
      `${icon} ${s.document.padEnd(39)} ${s.type.padEnd(6)}` +
      `${s.phase1Accepted}`.padEnd(8) +
      `${s.phase1Rejected}`.padEnd(8) +
      `${s.phase2Mapped}`.padEnd(8) +
      `${s.phase2Corrected}`.padEnd(8) +
      `${s.totalLines}`.padEnd(8) +
      `${s.unmapped}`.padEnd(8) +
      `${s.qualityScore}`.padEnd(8) +
      `${s.verdict}`.padEnd(22) +
      `${s.savedValues}`
    );
  }
  console.log('-'.repeat(140));

  const avgScore = summaries.length > 0
    ? Math.round(summaries.reduce((a, s) => a + s.qualityScore, 0) / summaries.length)
    : 0;
  const approved = summaries.filter((s) => s.verdict === 'APPROVED' || s.verdict === 'APPROVED_WITH_NOTES').length;
  const rejected = summaries.filter((s) => s.verdict === 'REJECTED').length;

  console.log(`\n   TOTAL: ${grandTotal} lines mapped | ${grandUnmapped} unmapped`);
  console.log(`   AVG SCORE: ${avgScore}/100`);
  console.log(`   VERDICTS: ${approved}/${summaries.length} approved | ${rejected} rejected`);
  console.log(`   Documents: ${DOCUMENTS.length} | Statements: ${summaries.length}`);

  if (rejected === 0) {
    console.log('\n🏆 ALL STATEMENTS PROCESSED SUCCESSFULLY');
  } else {
    console.log(`\n🚨 ${rejected} statements rejected — requires investigation`);
  }
  console.log();
}

main().catch((error) => {
  console.error('Fatal:', (error as Error).message);
  process.exit(1);
});
