#!/usr/bin/env tsx
/**
 * Autonomous Financial Pipeline Loop
 *
 * Self-improving loop that:
 * 1. CLEAN: deletes old data
 * 2. IMPORT: runs 3-phase LLM pipeline on all documents
 * 3. EVALUATE: compares results against ground truth
 * 4. ANALYZE: uses LLM to diagnose errors and generate lessons
 * 5. LEARN: persists lessons for next iteration
 * 6. REPEAT: until accuracy target reached or max iterations
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging.local npx tsx server/scripts/autonomous-pipeline-loop.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import PDFParserService from '../src/services/pdfParserService.js';
import {
  classifyStatementDocument,
  detectStatementType,
} from '../src/services/financialStatementService.js';
import {
  runLlmFinancialPipeline,
  type PipelineResult,
  type PipelineLine,
} from '../src/services/llmFinancialPipelineService.js';
import {
  loadLearningStore,
  saveLearningStore,
  buildLearningContext,
  addIterationResult,
  type LearningStoreData,
  type MappingLesson,
  type DocumentLesson,
  type ValueCorrection,
  type PromptImprovement,
} from '../src/services/llmPipelineLearningStore.js';

// ─── Config ─────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 5;
const TARGET_ACCURACY = 0.95;
const VALUE_TOLERANCE = 0.02; // 2% tolerance for value matching
const STAGNATION_LIMIT = 2;  // stop if no improvement for N iterations

const DOCUMENTS = [
  { label: 'Apator SA Raport R 2024', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
  { label: 'Grupa Apator Raport RS 2024', file: 'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf' },
  { label: 'BMW Group Financial Statements 2024', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
  { label: 'KGHM Skonsolidowane SRR 2024', file: 'knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf' },
  { label: 'BP Annual Report 2025', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
  { label: 'Coca-Cola 10-K 2025', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla 10-K 2024', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
];

const TYPES: Array<'BS' | 'P&L' | 'CF'> = ['BS', 'P&L', 'CF'];

// ─── Ground Truth ───────────────────────────────────────────────────────────

interface GroundTruthData {
  _meta: { tolerance: number };
  documents: Record<string, {
    currency: string;
    scaling: string;
    period: string;
    BS?: Record<string, number | null>;
    'P&L'?: Record<string, number | null>;
    CF?: Record<string, number | null>;
  }>;
}

function loadGroundTruth(): GroundTruthData {
  const gtPath = path.resolve(process.cwd(), 'server/scripts/ground-truth.json');
  return JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
}

// ─── Evaluation Engine ──────────────────────────────────────────────────────

interface EvalCheck {
  document: string;
  statementType: string;
  canonicalId: string;
  expectedValue: number;
  extractedValue: number | null;
  errorPct: number;
  passed: boolean;
  issue: string;
}

interface EvalResult {
  checks: EvalCheck[];
  accuracy: number;
  totalChecks: number;
  passed: number;
  failed: number;
  missingCount: number;
}

function evaluateResults(
  pipelineResults: Map<string, Map<string, PipelineResult>>,
  groundTruth: GroundTruthData
): EvalResult {
  const checks: EvalCheck[] = [];
  const tolerance = groundTruth._meta.tolerance || VALUE_TOLERANCE;

  for (const [docName, gtDoc] of Object.entries(groundTruth.documents)) {
    const docResults = pipelineResults.get(docName);
    if (!docResults) continue;

    for (const stType of TYPES) {
      const gtValues = gtDoc[stType];
      if (!gtValues) continue;

      const pipeResult = docResults.get(stType);
      if (!pipeResult) continue;

      for (const [canonicalId, expectedValue] of Object.entries(gtValues)) {
        if (expectedValue == null) continue;

        const matchingLine = pipeResult.lines.find((l) => l.canonicalId === canonicalId);
        const extractedValue = matchingLine?.value ?? null;

        let errorPct = 0;
        let passed = false;
        let issue = '';

        if (extractedValue == null) {
          issue = `MISSING: ${canonicalId} not found in extraction`;
        } else if (expectedValue === 0) {
          passed = extractedValue === 0;
          issue = passed ? 'OK' : `Expected 0, got ${extractedValue}`;
        } else {
          errorPct = Math.abs((extractedValue - expectedValue) / expectedValue);
          passed = errorPct <= tolerance;
          if (!passed) {
            const direction = extractedValue > expectedValue ? 'too high' : 'too low';
            issue = `VALUE_MISMATCH: expected=${expectedValue}, got=${extractedValue} (${(errorPct * 100).toFixed(1)}% ${direction})`;
          } else {
            issue = 'OK';
          }
        }

        checks.push({
          document: docName,
          statementType: stType,
          canonicalId,
          expectedValue,
          extractedValue,
          errorPct,
          passed,
          issue,
        });
      }
    }
  }

  const totalChecks = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  const missingCount = checks.filter((c) => c.extractedValue == null).length;
  const accuracy = totalChecks > 0 ? passed / totalChecks : 0;

  return { checks, accuracy, totalChecks, passed, failed, missingCount };
}

// ─── LLM Error Analysis & Learning ─────────────────────────────────────────

async function analyzeErrorsWithLLM(
  evalResult: EvalResult,
  iteration: number,
  store: LearningStoreData
): Promise<{
  mappingLessons: MappingLesson[];
  documentLessons: DocumentLesson[];
  valueCorrections: ValueCorrection[];
  promptImprovements: PromptImprovement[];
  summary: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      mappingLessons: [],
      documentLessons: [],
      valueCorrections: [],
      promptImprovements: [],
      summary: 'No OpenAI key — cannot analyze errors',
    };
  }

  const failedChecks = evalResult.checks.filter((c) => !c.passed);
  if (failedChecks.length === 0) {
    return {
      mappingLessons: [],
      documentLessons: [],
      valueCorrections: [],
      promptImprovements: [],
      summary: 'All checks passed — no errors to analyze',
    };
  }

  const errorSummary = failedChecks
    .map((c) => `  - [${c.document}] ${c.statementType} ${c.canonicalId}: ${c.issue}`)
    .join('\n');

  const previousLessons = store.iterationHistory.length > 0
    ? `\nPREVIOUS ITERATIONS:\n${store.iterationHistory.map((h) => `  Iter ${h.iteration}: accuracy=${(h.accuracy * 100).toFixed(1)}% (${h.passed}/${h.totalChecks})`).join('\n')}`
    : '';

  const prompt = `You are a financial data extraction expert analyzing errors from an automated pipeline.

ITERATION: ${iteration}
ACCURACY: ${(evalResult.accuracy * 100).toFixed(1)}% (${evalResult.passed}/${evalResult.totalChecks} checks passed)
${previousLessons}

FAILED CHECKS:
${errorSummary}

TASK: Analyze these errors and generate specific, actionable lessons for the next iteration.

For each error, determine:
1. Is it a MAPPING error (wrong canonical ID assigned)?
2. Is it a VALUE error (right line, wrong number — column selection, sign, scaling)?
3. Is it a MISSING error (line not extracted at all)?

Generate lessons in these categories:
- mappingLessons: specific label → canonicalId corrections
- documentLessons: document-specific notes (e.g., "this PDF has unusual formatting")
- promptImprovements: instructions to add to the LLM prompt to avoid this error

Return ONLY valid JSON:
{
  "mappingLessons": [
    { "originalLabel": "Aktywa razem", "correctCanonicalId": "fsl-bs-total-assets", "statementType": "BS", "confidence": 0.99 }
  ],
  "documentLessons": [
    { "documentName": "BMW Group Financial Statements 2024", "statementType": "BS", "lesson": "BMW uses 'Total equity and liabilities' not 'Total liabilities'", "severity": "important" }
  ],
  "promptImprovements": [
    { "phase": "phase2", "statementType": "BS", "improvement": "When extracting BS, always check that Total Assets equals Total Liabilities + Total Equity" }
  ],
  "summary": "Brief analysis of the main error patterns"
}`;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const outputText = response.choices?.[0]?.message?.content || '';
    const fenced = outputText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() || outputText;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('No JSON found');

    const parsed = JSON.parse(candidate.slice(start, end + 1));
    const now = new Date().toISOString();

    return {
      mappingLessons: (parsed.mappingLessons || []).map((l: any) => ({
        ...l,
        learnedAt: now,
        iteration,
        confidence: l.confidence || 0.9,
      })),
      documentLessons: (parsed.documentLessons || []).map((l: any) => ({
        ...l,
        learnedAt: now,
        iteration,
      })),
      valueCorrections: failedChecks
        .filter((c) => c.extractedValue != null && c.extractedValue !== c.expectedValue)
        .map((c) => ({
          canonicalId: c.canonicalId,
          documentName: c.document,
          expectedValue: c.expectedValue,
          extractedValue: c.extractedValue!,
          errorPct: c.errorPct * 100,
          possibleCause: c.issue,
          learnedAt: now,
          iteration,
        })),
      promptImprovements: (parsed.promptImprovements || []).map((p: any) => ({
        ...p,
        learnedAt: now,
        iteration,
      })),
      summary: parsed.summary || 'Analysis complete',
    };
  } catch (error) {
    console.log(`  ⚠ LLM error analysis failed: ${(error as Error).message?.slice(0, 100)}`);
    return {
      mappingLessons: [],
      documentLessons: [],
      valueCorrections: failedChecks
        .filter((c) => c.extractedValue != null)
        .map((c) => ({
          canonicalId: c.canonicalId,
          documentName: c.document,
          expectedValue: c.expectedValue,
          extractedValue: c.extractedValue!,
          errorPct: c.errorPct * 100,
          possibleCause: c.issue,
          learnedAt: new Date().toISOString(),
          iteration,
        })),
      promptImprovements: [],
      summary: 'LLM analysis failed — using basic error recording',
    };
  }
}

// ─── Main Orchestrator Loop ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AUTONOMOUS FINANCIAL PIPELINE LOOP                      ║');
  console.log('║     Target accuracy: ' + (TARGET_ACCURACY * 100).toFixed(0) + '%  Max iterations: ' + MAX_ITERATIONS + '              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const groundTruth = loadGroundTruth();
  let store = loadLearningStore();
  let bestAccuracy = 0;
  let stagnationCount = 0;

  for (let iteration = store.lastIteration + 1; iteration <= store.lastIteration + MAX_ITERATIONS; iteration++) {
    console.log(`\n${'█'.repeat(70)}`);
    console.log(`  ITERATION ${iteration}`);
    console.log(`  Learned: ${store.mappingLessons.length} mappings, ${store.documentLessons.length} doc lessons, ${store.promptImprovements.length} prompt improvements`);
    console.log(`${'█'.repeat(70)}\n`);

    // ── STEP 1: Run pipeline on all documents ──
    const allResults = new Map<string, Map<string, PipelineResult>>();

    for (const doc of DOCUMENTS) {
      console.log(`\n── ${doc.label} ──`);

      let text: string;
      try {
        text = await PDFParserService.extractText(doc.file);
      } catch (e: any) {
        console.log(`  ⚠ PDF extraction failed: ${e.message?.slice(0, 80)}`);
        continue;
      }

      const detection = detectStatementType(text);
      const documentProfile = classifyStatementDocument({
        fileName: doc.file.split('/').pop()!,
        parseMethod: 'text_extraction',
        text,
      });

      const docResults = new Map<string, PipelineResult>();

      for (const stType of TYPES) {
        const learningCtx = buildLearningContext(store, doc.label, stType);

        const result = await runLlmFinancialPipeline(text, stType, {
          organizationId: 'auto-loop',
          templateFamily: documentProfile.templateFamily,
          documentName: doc.label,
          currency: detection.currency || 'PLN',
          scaling: detection.scaling || 'thousands',
          periodLabel: detection.periodLabel || undefined,
          learningContext: learningCtx || undefined,
        });

        docResults.set(stType, result);

        const icon = result.verdict === 'APPROVED' ? '✅' : result.verdict === 'APPROVED_WITH_NOTES' ? '🟡' : result.verdict === 'NEEDS_REVIEW' ? '⚠️' : '❌';
        console.log(
          `  [${stType}] ${icon} Score=${result.qualityScore} Lines=${result.lines.length} Verdict=${result.verdict}`
        );
      }

      allResults.set(doc.label, docResults);
    }

    // ── STEP 2: Evaluate against ground truth ──
    console.log(`\n${'─'.repeat(70)}`);
    console.log('  EVALUATION');
    console.log(`${'─'.repeat(70)}`);

    const evalResult = evaluateResults(allResults, groundTruth);

    console.log(`\n  ACCURACY: ${(evalResult.accuracy * 100).toFixed(1)}% (${evalResult.passed}/${evalResult.totalChecks})`);
    console.log(`  Passed: ${evalResult.passed} | Failed: ${evalResult.failed} | Missing: ${evalResult.missingCount}`);

    // Print failed checks
    const failedChecks = evalResult.checks.filter((c) => !c.passed);
    if (failedChecks.length > 0) {
      console.log('\n  FAILED CHECKS:');
      for (const c of failedChecks) {
        const icon = c.extractedValue == null ? '🔍' : '❌';
        console.log(`    ${icon} [${c.document.substring(0, 30)}] ${c.statementType} ${c.canonicalId}: ${c.issue}`);
      }
    }

    // Print passed checks summary
    const passedByDoc = new Map<string, number>();
    const totalByDoc = new Map<string, number>();
    for (const c of evalResult.checks) {
      totalByDoc.set(c.document, (totalByDoc.get(c.document) || 0) + 1);
      if (c.passed) passedByDoc.set(c.document, (passedByDoc.get(c.document) || 0) + 1);
    }
    console.log('\n  PER-DOCUMENT ACCURACY:');
    for (const [doc, total] of totalByDoc) {
      const passed = passedByDoc.get(doc) || 0;
      const pct = ((passed / total) * 100).toFixed(0);
      const icon = passed === total ? '✅' : passed / total >= 0.8 ? '🟡' : '❌';
      console.log(`    ${icon} ${doc.substring(0, 45).padEnd(45)} ${passed}/${total} (${pct}%)`);
    }

    // ── STEP 3: Check stopping conditions ──
    if (evalResult.accuracy >= TARGET_ACCURACY) {
      console.log(`\n  🏆 TARGET ACCURACY REACHED: ${(evalResult.accuracy * 100).toFixed(1)}% ≥ ${(TARGET_ACCURACY * 100).toFixed(0)}%`);
      addIterationResult(store, iteration, evalResult.accuracy, evalResult.totalChecks, evalResult.passed, evalResult.failed, ['Target reached']);
      saveLearningStore(store);
      break;
    }

    if (evalResult.accuracy <= bestAccuracy) {
      stagnationCount++;
      if (stagnationCount >= STAGNATION_LIMIT) {
        console.log(`\n  ⚠ STAGNATION: No improvement for ${STAGNATION_LIMIT} iterations. Stopping.`);
        addIterationResult(store, iteration, evalResult.accuracy, evalResult.totalChecks, evalResult.passed, evalResult.failed, ['Stagnation stop']);
        saveLearningStore(store);
        break;
      }
    } else {
      bestAccuracy = evalResult.accuracy;
      stagnationCount = 0;
    }

    // ── STEP 4: Analyze errors and learn ──
    console.log(`\n${'─'.repeat(70)}`);
    console.log('  LEARNING (analyzing errors with LLM...)');
    console.log(`${'─'.repeat(70)}`);

    const analysis = await analyzeErrorsWithLLM(evalResult, iteration, store);

    console.log(`\n  Analysis: ${analysis.summary}`);
    console.log(`  New lessons: ${analysis.mappingLessons.length} mappings, ${analysis.documentLessons.length} doc, ${analysis.promptImprovements.length} prompt`);

    // Merge new lessons into store
    store.mappingLessons.push(...analysis.mappingLessons);
    store.documentLessons.push(...analysis.documentLessons);
    store.valueCorrections.push(...analysis.valueCorrections);
    store.promptImprovements.push(...analysis.promptImprovements);

    const improvements = [
      ...analysis.mappingLessons.map((l) => `mapping: ${l.originalLabel} → ${l.correctCanonicalId}`),
      ...analysis.documentLessons.map((l) => `doc: ${l.lesson.substring(0, 60)}`),
      ...analysis.promptImprovements.map((p) => `prompt: ${p.improvement.substring(0, 60)}`),
    ];

    addIterationResult(
      store,
      iteration,
      evalResult.accuracy,
      evalResult.totalChecks,
      evalResult.passed,
      evalResult.failed,
      improvements
    );

    saveLearningStore(store);
    console.log(`  💾 Learning store saved (${store.mappingLessons.length} total mappings, ${store.promptImprovements.length} total prompt improvements)`);
  }

  // ── FINAL SUMMARY ──
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('  AUTONOMOUS LOOP COMPLETE');
  console.log(`${'═'.repeat(70)}`);

  if (store.iterationHistory.length > 0) {
    console.log('\n  ITERATION HISTORY:');
    for (const h of store.iterationHistory) {
      const icon = h.accuracy >= TARGET_ACCURACY ? '🏆' : h.accuracy >= 0.8 ? '🟡' : '❌';
      console.log(`    ${icon} Iter ${h.iteration}: ${(h.accuracy * 100).toFixed(1)}% (${h.passed}/${h.totalChecks}) — ${h.improvements.length} lessons learned`);
    }

    const first = store.iterationHistory[0];
    const last = store.iterationHistory[store.iterationHistory.length - 1];
    const improvement = last.accuracy - first.accuracy;
    console.log(`\n  IMPROVEMENT: ${(first.accuracy * 100).toFixed(1)}% → ${(last.accuracy * 100).toFixed(1)}% (${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}pp)`);
  }

  console.log(`  TOTAL LESSONS: ${store.mappingLessons.length} mappings, ${store.documentLessons.length} doc, ${store.promptImprovements.length} prompt`);
  console.log();
}

main().catch((error) => {
  console.error('Fatal:', (error as Error).message);
  process.exit(1);
});
