/**
 * LLM Financial Pipeline Service — 3-Phase Architecture
 *
 * Phase 1: Pre-mapping — heuristic extraction + autoMap, keep ONLY high-confidence (≥0.95)
 * Phase 2: LLM Full Analysis — GPT-4o analyzes entire section text, validates Phase 1,
 *          maps unmapped lines, fixes errors, extracts comparison values
 * Phase 3: LLM CFO Review — sanity checks (BS equation, P&L waterfall, CF reconciliation),
 *          period-over-period deviation analysis, correction loop
 */
import OpenAI from 'openai';

import { llmConfigService } from './ai/llmConfigService.js';
import {
  type CanonicalLineDefinition,
  type CanonicalStatementType,
  getCanonicalLinesByStatementType,
} from './financeCanonicalRegistry.js';
import { logFinanceError, logFinanceEvent } from './financeDiagnosticsService.js';
import {
  autoMapLines,
  type ExtractedLine,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
} from './financialStatementService.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PipelineLine {
  canonicalId: string;
  canonicalLabel: string;
  originalLabel: string;
  value: number;
  comparisonValue: number | null;
  confidence: number;
  source: 'heuristic' | 'llm_phase2' | 'llm_phase3' | 'cfo_derived';
  mappingReason: string;
}

export interface PipelineCheckResult {
  code: string;
  severity: 'pass' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}

export interface PipelineResult {
  statementType: string;
  lines: PipelineLine[];
  unmappedLines: Array<{ originalLabel: string; value: number; reason: string }>;
  checks: PipelineCheckResult[];
  qualityScore: number;
  verdict: 'APPROVED' | 'APPROVED_WITH_NOTES' | 'NEEDS_REVIEW' | 'REJECTED';
  phases: {
    phase1: { total: number; accepted: number; rejected: number };
    phase2: { mapped: number; corrected: number; confirmed: number };
    phase3: { checksRun: number; issuesFound: number; corrections: number };
  };
  warnings: string[];
}

export interface LlmPipelineOptions {
  organizationId?: string;
  templateFamily?: string | null;
  documentName?: string;
  currency?: string;
  scaling?: string;
  periodLabel?: string;
  comparisonPeriodLabel?: string | null;
  traceId?: string;
  maxRetries?: number;
  learningContext?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getOpenAIClient(): { client: OpenAI; model: string } | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return { client: new OpenAI({ apiKey }), model: 'gpt-4o' };
}

function buildCanonicalCatalog(statementType: CanonicalStatementType): string {
  const lines = getCanonicalLinesByStatementType(statementType);
  return lines
    .map((l: CanonicalLineDefinition) => {
      const parent = l.parentId ? ` (parent: ${l.parentId})` : '';
      const flags: string[] = [];
      if (l.isTotal) flags.push('TOTAL');
      if (l.isSubtotal) flags.push('SUBTOTAL');
      if (l.requiredLevel === 'required') flags.push('REQUIRED');
      const flagStr = flags.length > 0 ? ` [${flags.join(',')}]` : '';
      return `- ${l.id}: ${l.labelEn} / ${l.labelPl}${parent}${flagStr}`;
    })
    .join('\n');
}

function extractJsonFromResponse(raw: string): unknown | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  const arrStart = candidate.indexOf('[');
  const arrEnd = candidate.lastIndexOf(']');
  const objStart = candidate.indexOf('{');
  const objEnd = candidate.lastIndexOf('}');

  let jsonStr: string | null = null;
  if (objStart !== -1 && objEnd > objStart) {
    if (arrStart !== -1 && arrStart < objStart) {
      jsonStr = candidate.slice(arrStart, arrEnd + 1);
    } else {
      jsonStr = candidate.slice(objStart, objEnd + 1);
    }
  } else if (arrStart !== -1 && arrEnd > arrStart) {
    jsonStr = candidate.slice(arrStart, arrEnd + 1);
  }

  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function normalizeStatementType(st: string): CanonicalStatementType {
  const upper = st.toUpperCase().trim();
  if (upper === 'BS' || upper.includes('BALANCE')) return 'BS';
  if (upper === 'CF' || upper.includes('CASH')) return 'CF';
  return 'P&L';
}

// ─── Phase 1: Pre-mapping (heuristic, high-confidence only) ─────────────────

interface Phase1Result {
  acceptedLines: PipelineLine[];
  rejectedLines: ExtractedLine[];
  allExtracted: ExtractedLine[];
  sectionText: string;
  currentPeriod: string;
  comparisonPeriod: string | null;
}

async function runPhase1(
  text: string,
  statementType: string,
  options: LlmPipelineOptions
): Promise<Phase1Result> {
  const stType = normalizeStatementType(statementType);

  const sections = locateStatementSections(text, stType);
  const scopedText = sections[0]?.text || text;

  const columnSelection = resolveStatementColumnSelection(scopedText, {
    statementType: stType,
    periodLabel: options.periodLabel || null,
  });

  const currentPeriod = columnSelection.selectedPeriodLabel || options.periodLabel || 'Current';
  const comparisonPeriod =
    columnSelection.comparisonPeriodLabel || options.comparisonPeriodLabel || null;

  const extraction = extractFinancialLines(scopedText, stType, {
    selectedPeriodLabel: currentPeriod,
    comparisonPeriodLabel: comparisonPeriod,
  });

  const mapped = resolveDuplicateSuggestedMappings(
    await autoMapLines(extraction.lines, stType, {
      organizationId: options.organizationId,
      templateFamily: options.templateFamily,
    })
  );

  const CONFIDENCE_THRESHOLD = 0.95;
  const accepted: PipelineLine[] = [];
  const rejected: ExtractedLine[] = [];

  for (const line of mapped) {
    if (line.isNonFinancial) continue;

    if (
      line.suggestedCanonicalId &&
      (line.confidence || 0) >= CONFIDENCE_THRESHOLD &&
      line.suggestedCanonicalLabel
    ) {
      accepted.push({
        canonicalId: line.suggestedCanonicalId,
        canonicalLabel: line.suggestedCanonicalLabel,
        originalLabel: line.originalLabel,
        value: line.value,
        comparisonValue: line.comparisonValue ?? null,
        confidence: line.confidence,
        source: 'heuristic',
        mappingReason: `Phase1 heuristic (conf=${line.confidence.toFixed(2)})`,
      });
    } else {
      rejected.push(line);
    }
  }

  logFinanceEvent('pipeline.phase1.completed', {
    traceId: options.traceId,
    statementType: stType,
    totalExtracted: mapped.filter((l) => !l.isNonFinancial).length,
    accepted: accepted.length,
    rejected: rejected.length,
  });

  return {
    acceptedLines: accepted,
    rejectedLines: rejected,
    allExtracted: mapped,
    sectionText: scopedText,
    currentPeriod,
    comparisonPeriod,
  };
}

// ─── Phase 2: LLM Full Analysis ────────────────────────────────────────────

function buildPhase2Prompt(
  statementType: CanonicalStatementType,
  sectionText: string,
  phase1Accepted: PipelineLine[],
  phase1Rejected: ExtractedLine[],
  catalog: string,
  currentPeriod: string,
  comparisonPeriod: string | null,
  currency: string,
  scaling: string,
  options?: { learningContext?: string }
): string {
  const acceptedSummary = phase1Accepted
    .map(
      (l, i) =>
        `  ${i + 1}. "${l.originalLabel}" → ${l.canonicalId} = ${l.value} (conf=${l.confidence.toFixed(2)})`
    )
    .join('\n');

  const rejectedSummary = phase1Rejected
    .slice(0, 80)
    .map((l, i) => {
      const cid = l.suggestedCanonicalId ? ` [heuristic suggested: ${l.suggestedCanonicalId}]` : '';
      return `  ${i + 1}. "${l.originalLabel}" = ${l.value}${cid}`;
    })
    .join('\n');

  const compPeriodNote = comparisonPeriod
    ? `The document has TWO periods: current="${currentPeriod}" and comparison="${comparisonPeriod}". Extract values for BOTH periods.`
    : `The document has one period: "${currentPeriod}".`;

  const learningBlock = options?.learningContext
    ? `\n\nLEARNED FROM PREVIOUS ITERATIONS:\n${options.learningContext}\n`
    : '';

  return `You are a senior financial analyst. Your task is to analyze a ${statementType} (${statementType === 'BS' ? 'Balance Sheet' : statementType === 'P&L' ? 'Profit & Loss' : 'Cash Flow Statement'}) extracted from a financial report.
${learningBlock}
CONTEXT:
- Currency: ${currency}, Scaling: ${scaling}
- ${compPeriodNote}

PHASE 1 RESULTS (heuristic pre-mapping, high-confidence only):
These lines were automatically mapped with confidence ≥ 0.95. Review them — confirm or correct:
${acceptedSummary || '  (none accepted by heuristic)'}

UNMAPPED/LOW-CONFIDENCE LINES from heuristic extraction:
These lines need your analysis — map them to canonical IDs or mark as non-financial:
${rejectedSummary || '  (none)'}

CANONICAL ID CATALOG for ${statementType}:
${catalog}

DOCUMENT TEXT (the actual ${statementType} section):
"""
${sectionText.slice(0, 60000)}
"""

YOUR TASKS:
1. VALIDATE Phase 1 mappings — if any are wrong, include them in your output with the correct canonicalId
2. MAP all unmapped financial lines to canonical IDs from the catalog
3. EXTRACT values correctly — check the document text directly, don't trust heuristic values blindly
4. For each line, provide the current period value AND comparison period value (if available)
5. Mark truly non-financial lines (headers, notes, page numbers) with canonicalId: null and reason: "non_financial"
6. If you find financial lines in the document text that the heuristic MISSED entirely, include them too

CRITICAL RULES:
- Each canonical ID can appear AT MOST ONCE in your output
- Values must match the document exactly — check signs carefully (costs are typically positive in display, negative in computation)
- For BS: Total Assets MUST equal Total Liabilities + Total Equity
- For P&L: Revenue - COGS = Gross Profit, etc.
- Confidence: 0.95+ = certain from document, 0.8-0.95 = very likely, 0.6-0.8 = reasonable inference, <0.6 = uncertain

COLUMN SELECTION — EXTREMELY IMPORTANT:
- Many financial documents have MULTIPLE COLUMNS of data (e.g., 2025, 2024, 2023)
- You MUST extract values from the MOST RECENT / CURRENT period column (the FIRST data column, typically the leftmost numeric column)
- The current period is: "${currentPeriod}" — extract values for THIS period
- If the document shows "2025 2024 2023", take the 2025 column values
- DO NOT accidentally take comparison period values
- For Cash Flow: investing activities are typically NEGATIVE (cash outflow), financing can be positive or negative
- For Cash Flow: "Cash inflow/outflow from investing" with a negative number means negative CF (outflow). Keep the sign as shown in the document
- Values should be in the document's native unit. If the document says "in € million" or "in millions", values are in millions — do NOT divide by 1000
- IMPORTANT: Return values as INTEGERS matching the document. If the document shows "267,732" in millions, return 267732, NOT 267.732 or 0.267732
- If the heuristic extracted a value like 267.732 but the document clearly shows 267,732 (in millions), use 267732
- The scaling parameter tells you the document's unit. "millions" means values are already in millions — just return the number as shown

Return ONLY valid JSON (no explanation text):
{
  "lines": [
    {
      "canonicalId": "fsl-bs-total-assets",
      "originalLabel": "Aktywa razem",
      "value": 1040761,
      "comparisonValue": 985432,
      "confidence": 0.98,
      "reason": "Directly from document, clear match"
    }
  ],
  "corrections": [
    {
      "canonicalId": "fsl-bs-cash",
      "previousValue": 50000,
      "correctedValue": 55000,
      "reason": "Heuristic extracted wrong column value"
    }
  ],
  "warnings": ["optional warnings about data quality"]
}`;
}

interface Phase2Result {
  lines: PipelineLine[];
  corrections: number;
  confirmed: number;
  newlyMapped: number;
  warnings: string[];
}

async function runPhase2(
  statementType: string,
  sectionText: string,
  phase1: Phase1Result,
  options: LlmPipelineOptions
): Promise<Phase2Result> {
  const stType = normalizeStatementType(statementType);
  const openai = getOpenAIClient();
  if (!openai) {
    logFinanceEvent('pipeline.phase2.skipped', {
      traceId: options.traceId,
      reason: 'no_openai_key',
    });
    return {
      lines: phase1.acceptedLines,
      corrections: 0,
      confirmed: phase1.acceptedLines.length,
      newlyMapped: 0,
      warnings: ['Phase 2 skipped: no OpenAI API key configured'],
    };
  }

  const catalog = buildCanonicalCatalog(stType);
  const prompt = buildPhase2Prompt(
    stType,
    sectionText,
    phase1.acceptedLines,
    phase1.rejectedLines,
    catalog,
    phase1.currentPeriod,
    phase1.comparisonPeriod,
    options.currency || 'PLN',
    options.scaling || 'thousands',
    { learningContext: options.learningContext }
  );

  logFinanceEvent('pipeline.phase2.started', {
    traceId: options.traceId,
    statementType: stType,
    promptLength: prompt.length,
    phase1Accepted: phase1.acceptedLines.length,
    phase1Rejected: phase1.rejectedLines.length,
  });

  try {
    const response = await openai.client.chat.completions.create({
      model: openai.model,
      temperature: 0.1,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const outputText = response.choices?.[0]?.message?.content || '';
    const parsed = extractJsonFromResponse(outputText) as {
      lines?: Array<{
        canonicalId: string | null;
        originalLabel: string;
        value: number;
        comparisonValue?: number | null;
        confidence: number;
        reason: string;
      }>;
      corrections?: Array<{
        canonicalId: string;
        previousValue: number;
        correctedValue: number;
        reason: string;
      }>;
      warnings?: string[];
    } | null;

    if (!parsed || !Array.isArray(parsed.lines)) {
      logFinanceError('pipeline.phase2.parse_failed', new Error('Invalid JSON response'), {
        traceId: options.traceId,
        outputLength: outputText.length,
      });
      return {
        lines: phase1.acceptedLines,
        corrections: 0,
        confirmed: phase1.acceptedLines.length,
        newlyMapped: 0,
        warnings: ['Phase 2: LLM returned invalid JSON, falling back to Phase 1 results'],
      };
    }

    const canonicalLines = getCanonicalLinesByStatementType(stType);
    const canonicalById = new Map(canonicalLines.map((l) => [l.id, l]));
    const usedIds = new Set<string>();
    const resultLines: PipelineLine[] = [];
    let corrections = 0;
    let confirmed = 0;
    let newlyMapped = 0;

    const correctionMap = new Map<string, { correctedValue: number; reason: string }>();
    if (Array.isArray(parsed.corrections)) {
      for (const corr of parsed.corrections) {
        if (corr.canonicalId && typeof corr.correctedValue === 'number') {
          correctionMap.set(corr.canonicalId, {
            correctedValue: corr.correctedValue,
            reason: corr.reason || 'LLM correction',
          });
        }
      }
    }

    for (const llmLine of parsed.lines) {
      if (!llmLine.canonicalId) continue;
      if (usedIds.has(llmLine.canonicalId)) continue;

      const canonical = canonicalById.get(llmLine.canonicalId);
      if (!canonical) continue;

      usedIds.add(llmLine.canonicalId);

      const phase1Match = phase1.acceptedLines.find((p) => p.canonicalId === llmLine.canonicalId);
      const correction = correctionMap.get(llmLine.canonicalId);

      let finalValue =
        typeof llmLine.value === 'number' && Number.isFinite(llmLine.value)
          ? llmLine.value
          : (phase1Match?.value ?? 0);
      let source: PipelineLine['source'] = 'llm_phase2';
      let reason = llmLine.reason || 'LLM Phase 2 mapping';

      if (correction) {
        finalValue = correction.correctedValue;
        source = 'llm_phase2';
        reason = `Corrected: ${correction.reason}`;
        corrections++;
      } else if (phase1Match && Math.abs(phase1Match.value - finalValue) < 0.01) {
        source = 'heuristic';
        reason = `Phase1 confirmed by LLM`;
        confirmed++;
      } else {
        newlyMapped++;
      }

      resultLines.push({
        canonicalId: llmLine.canonicalId,
        canonicalLabel: canonical.labelEn,
        originalLabel: llmLine.originalLabel || phase1Match?.originalLabel || canonical.labelEn,
        value: finalValue,
        comparisonValue: llmLine.comparisonValue ?? phase1Match?.comparisonValue ?? null,
        confidence: Math.min(llmLine.confidence || 0.8, 1),
        source,
        mappingReason: reason,
      });
    }

    // Keep Phase 1 lines that LLM didn't mention (they were confirmed implicitly)
    for (const p1 of phase1.acceptedLines) {
      if (!usedIds.has(p1.canonicalId)) {
        usedIds.add(p1.canonicalId);
        resultLines.push({ ...p1, mappingReason: 'Phase1 (not reviewed by LLM)' });
        confirmed++;
      }
    }

    logFinanceEvent('pipeline.phase2.completed', {
      traceId: options.traceId,
      statementType: stType,
      totalLines: resultLines.length,
      corrections,
      confirmed,
      newlyMapped,
    });

    return {
      lines: resultLines,
      corrections,
      confirmed,
      newlyMapped,
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    logFinanceError('pipeline.phase2.failed', error, {
      traceId: options.traceId,
      statementType: stType,
    });
    return {
      lines: phase1.acceptedLines,
      corrections: 0,
      confirmed: phase1.acceptedLines.length,
      newlyMapped: 0,
      warnings: [`Phase 2 failed: ${(error as Error).message?.slice(0, 100)}`],
    };
  }
}

// ─── Phase 3: LLM CFO Review ───────────────────────────────────────────────

function buildPhase3Prompt(
  statementType: CanonicalStatementType,
  lines: PipelineLine[],
  currency: string,
  scaling: string,
  documentName: string,
  currentPeriod: string,
  comparisonPeriod: string | null,
  learningContext?: string
): string {
  const linesSummary = lines
    .map((l) => {
      const comp = l.comparisonValue != null ? ` | comparison=${l.comparisonValue}` : '';
      return `  ${l.canonicalId}: ${l.originalLabel} = ${l.value}${comp} (conf=${l.confidence.toFixed(2)}, src=${l.source})`;
    })
    .join('\n');

  const checksDescription =
    statementType === 'BS'
      ? `- Total Assets = Total Liabilities + Total Equity (MUST balance, tolerance ≤ 1% of Total Assets)
- Current Assets + Fixed Assets ≈ Total Assets
- Current Liabilities + Long-term Debt + Other Non-current Liabilities ≈ Total Liabilities
- Total Equity components should sum to Total Equity
- All asset values should be positive
- Total Assets should be > 0`
      : statementType === 'P&L'
        ? `- Revenue - COGS ≈ Gross Profit (if all three present)
- Gross Profit - OPEX ≈ EBIT (approximately)
- EBIT - Interest - Tax ≈ Net Income (approximately)
- Revenue should be the largest positive number
- Net Income should be smaller than Revenue
- Signs: Revenue positive, costs typically shown as positive (display_absolute) or negative`
        : `- Operating CF + Investing CF + Financing CF ≈ Net Change in Cash
- Opening Cash + Net Change = Closing Cash (if both present)
- Operating CF should typically be positive for healthy companies
- CAPEX should typically be negative (cash outflow)
- Net Change in Cash should reconcile with BS cash movement`;

  const deviationNote = comparisonPeriod
    ? `\nPERIOD-OVER-PERIOD ANALYSIS:
For each line with both current and comparison values, check if the deviation makes financial sense:
- Revenue changes > 50% are unusual — flag for review
- Negative equity or negative total assets are red flags
- Sign flips (positive → negative) need explanation
- Zero values where comparison was non-zero need investigation`
    : '';

  const learningBlock = learningContext
    ? `\nLEARNED FROM PREVIOUS ITERATIONS:\n${learningContext}\n`
    : '';

  return `You are a CFO performing a final quality review of extracted financial data.
${learningBlock}
DOCUMENT: ${documentName}
STATEMENT TYPE: ${statementType} (${statementType === 'BS' ? 'Balance Sheet' : statementType === 'P&L' ? 'Profit & Loss' : 'Cash Flow Statement'})
CURRENCY: ${currency}, SCALING: ${scaling}
PERIOD: ${currentPeriod}${comparisonPeriod ? ` vs ${comparisonPeriod}` : ''}

EXTRACTED DATA:
${linesSummary}

SANITY CHECKS TO PERFORM:
${checksDescription}
${deviationNote}

YOUR TASKS:
1. Run ALL sanity checks listed above
2. For each check, report: pass/warning/error with explanation
3. If you find ERRORS (values that are clearly wrong), provide corrections
4. If critical lines are MISSING (e.g., Total Assets in BS), flag them
5. Check period-over-period deviations for reasonableness
6. Assign a quality score 0-100:
   - 95-100: All checks pass, data is publication-ready
   - 80-94: Minor issues, acceptable with notes
   - 60-79: Significant issues, needs human review
   - 0-59: Major problems, data unreliable

Return ONLY valid JSON:
{
  "checks": [
    {
      "code": "BS_EQUATION",
      "severity": "pass",
      "message": "Balance sheet balances: Assets=1040761, L+E=1040761",
      "details": null
    }
  ],
  "corrections": [
    {
      "canonicalId": "fsl-bs-total-assets",
      "currentValue": 1040761,
      "correctedValue": 1040762,
      "reason": "Rounding adjustment to balance BS equation"
    }
  ],
  "missingLines": [
    {
      "canonicalId": "fsl-bs-total-assets",
      "estimatedValue": 1040761,
      "reason": "Can be derived from components"
    }
  ],
  "deviations": [
    {
      "canonicalId": "fsl-pl-revenue",
      "currentValue": 500000,
      "comparisonValue": 300000,
      "deviationPct": 66.7,
      "assessment": "warning",
      "explanation": "Revenue grew 67% YoY — unusual but possible for growth company"
    }
  ],
  "qualityScore": 95,
  "verdict": "APPROVED",
  "summary": "Brief CFO assessment"
}`;
}

interface Phase3Result {
  checks: PipelineCheckResult[];
  corrections: Array<{ canonicalId: string; correctedValue: number; reason: string }>;
  missingLines: Array<{ canonicalId: string; estimatedValue: number; reason: string }>;
  qualityScore: number;
  verdict: 'APPROVED' | 'APPROVED_WITH_NOTES' | 'NEEDS_REVIEW' | 'REJECTED';
  summary: string;
  warnings: string[];
}

async function runPhase3(
  statementType: string,
  lines: PipelineLine[],
  options: LlmPipelineOptions,
  currentPeriod: string,
  comparisonPeriod: string | null
): Promise<Phase3Result> {
  const stType = normalizeStatementType(statementType);
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      checks: [
        { code: 'CFO_SKIPPED', severity: 'warning', message: 'Phase 3 skipped: no OpenAI API key' },
      ],
      corrections: [],
      missingLines: [],
      qualityScore: 50,
      verdict: 'NEEDS_REVIEW',
      summary: 'CFO review skipped — no API key',
      warnings: ['Phase 3 skipped'],
    };
  }

  const prompt = buildPhase3Prompt(
    stType,
    lines,
    options.currency || 'PLN',
    options.scaling || 'thousands',
    options.documentName || 'Unknown',
    currentPeriod,
    comparisonPeriod,
    options.learningContext
  );

  logFinanceEvent('pipeline.phase3.started', {
    traceId: options.traceId,
    statementType: stType,
    lineCount: lines.length,
    promptLength: prompt.length,
  });

  try {
    const response = await openai.client.chat.completions.create({
      model: openai.model,
      temperature: 0.1,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const outputText = response.choices?.[0]?.message?.content || '';
    const parsed = extractJsonFromResponse(outputText) as {
      checks?: Array<{ code: string; severity: string; message: string; details?: string }>;
      corrections?: Array<{ canonicalId: string; correctedValue: number; reason: string }>;
      missingLines?: Array<{ canonicalId: string; estimatedValue: number; reason: string }>;
      qualityScore?: number;
      verdict?: string;
      summary?: string;
    } | null;

    if (!parsed) {
      logFinanceError('pipeline.phase3.parse_failed', new Error('Invalid JSON'), {
        traceId: options.traceId,
      });
      return {
        checks: [
          {
            code: 'CFO_PARSE_ERROR',
            severity: 'error',
            message: 'Phase 3 LLM returned invalid JSON',
          },
        ],
        corrections: [],
        missingLines: [],
        qualityScore: 40,
        verdict: 'NEEDS_REVIEW',
        summary: 'CFO review failed to parse',
        warnings: ['Phase 3 parse error'],
      };
    }

    const checks: PipelineCheckResult[] = (parsed.checks || []).map((c) => ({
      code: c.code || 'UNKNOWN',
      severity: (['pass', 'warning', 'error', 'info'].includes(c.severity)
        ? c.severity
        : 'info') as PipelineCheckResult['severity'],
      message: c.message || '',
      details: c.details || undefined,
    }));

    const corrections = (parsed.corrections || []).filter(
      (c) => c.canonicalId && typeof c.correctedValue === 'number'
    );

    const missingLines = (parsed.missingLines || []).filter(
      (m) => m.canonicalId && typeof m.estimatedValue === 'number'
    );

    const qualityScore = Math.max(0, Math.min(100, Number(parsed.qualityScore) || 0));

    const errorCount = (parsed.checks || []).filter((c) => c.severity === 'error').length;
    const rawVerdict = String(parsed.verdict || '').toUpperCase();
    let verdict: Phase3Result['verdict'];
    if (qualityScore >= 90 && errorCount === 0) {
      verdict = 'APPROVED';
    } else if (qualityScore >= 75 && errorCount === 0) {
      verdict = 'APPROVED_WITH_NOTES';
    } else if (qualityScore >= 60 || errorCount <= 1) {
      verdict =
        rawVerdict === 'REJECTED'
          ? 'NEEDS_REVIEW'
          : (rawVerdict as Phase3Result['verdict']) || 'NEEDS_REVIEW';
    } else {
      verdict = 'REJECTED';
    }

    logFinanceEvent('pipeline.phase3.completed', {
      traceId: options.traceId,
      statementType: stType,
      qualityScore,
      verdict,
      checksCount: checks.length,
      correctionsCount: corrections.length,
      missingCount: missingLines.length,
    });

    return {
      checks,
      corrections,
      missingLines,
      qualityScore,
      verdict,
      summary: parsed.summary || '',
      warnings: [],
    };
  } catch (error) {
    logFinanceError('pipeline.phase3.failed', error, { traceId: options.traceId });
    return {
      checks: [
        {
          code: 'CFO_ERROR',
          severity: 'error',
          message: `Phase 3 failed: ${(error as Error).message?.slice(0, 80)}`,
        },
      ],
      corrections: [],
      missingLines: [],
      qualityScore: 30,
      verdict: 'NEEDS_REVIEW',
      summary: 'CFO review failed',
      warnings: [`Phase 3 error: ${(error as Error).message?.slice(0, 100)}`],
    };
  }
}

// ─── Main Pipeline Entry Point ──────────────────────────────────────────────

export async function runLlmFinancialPipeline(
  text: string,
  statementType: string,
  options: LlmPipelineOptions = {}
): Promise<PipelineResult> {
  const stType = normalizeStatementType(statementType);
  const traceId = options.traceId || `pipe-${Date.now()}`;
  const opts = { ...options, traceId };

  logFinanceEvent('pipeline.started', {
    traceId,
    statementType: stType,
    documentName: options.documentName,
    textLength: text.length,
  });

  // ── Phase 1 ──
  const phase1 = await runPhase1(text, stType, opts);

  console.log(
    `  [Phase1] ${stType}: extracted=${phase1.allExtracted.filter((l) => !l.isNonFinancial).length}, ` +
      `accepted(≥0.95)=${phase1.acceptedLines.length}, rejected=${phase1.rejectedLines.length}`
  );

  // ── Phase 2 ──
  const phase2 = await runPhase2(stType, phase1.sectionText, phase1, opts);

  console.log(
    `  [Phase2] ${stType}: total=${phase2.lines.length}, confirmed=${phase2.confirmed}, ` +
      `newlyMapped=${phase2.newlyMapped}, corrections=${phase2.corrections}`
  );

  // ── Phase 3 ──
  const phase3 = await runPhase3(
    stType,
    phase2.lines,
    opts,
    phase1.currentPeriod,
    phase1.comparisonPeriod
  );

  console.log(
    `  [Phase3] ${stType}: score=${phase3.qualityScore}, verdict=${phase3.verdict}, ` +
      `corrections=${phase3.corrections.length}, missing=${phase3.missingLines.length}`
  );

  // Apply Phase 3 corrections
  const finalLines = [...phase2.lines];
  let phase3Corrections = 0;

  for (const corr of phase3.corrections) {
    const idx = finalLines.findIndex((l) => l.canonicalId === corr.canonicalId);
    if (idx >= 0) {
      finalLines[idx] = {
        ...finalLines[idx],
        value: corr.correctedValue,
        source: 'llm_phase3',
        mappingReason: `CFO correction: ${corr.reason}`,
      };
      phase3Corrections++;
    }
  }

  // Add missing lines from Phase 3
  const canonicalLines = getCanonicalLinesByStatementType(stType);
  const canonicalById = new Map(canonicalLines.map((l) => [l.id, l]));
  const existingIds = new Set(finalLines.map((l) => l.canonicalId));

  for (const missing of phase3.missingLines) {
    if (existingIds.has(missing.canonicalId)) continue;
    const canonical = canonicalById.get(missing.canonicalId);
    if (!canonical) continue;

    finalLines.push({
      canonicalId: missing.canonicalId,
      canonicalLabel: canonical.labelEn,
      originalLabel: `[CFO-derived] ${canonical.labelEn}`,
      value: missing.estimatedValue,
      comparisonValue: null,
      confidence: 0.7,
      source: 'cfo_derived',
      mappingReason: `CFO derived: ${missing.reason}`,
    });
    existingIds.add(missing.canonicalId);
    phase3Corrections++;
  }

  // Build unmapped lines list — check both original labels and canonical IDs
  const mappedOriginals = new Set(finalLines.map((l) => l.originalLabel.toLowerCase().trim()));
  const mappedCanonicalIds = new Set(finalLines.map((l) => l.canonicalId));
  const unmappedLines = phase1.rejectedLines
    .filter((l) => {
      if (l.isNonFinancial) return false;
      if (mappedOriginals.has(l.originalLabel.toLowerCase().trim())) return false;
      if (l.suggestedCanonicalId && mappedCanonicalIds.has(l.suggestedCanonicalId)) return false;
      return true;
    })
    .map((l) => ({
      originalLabel: l.originalLabel,
      value: l.value,
      reason: 'Not mapped by heuristic or LLM',
    }));

  const allWarnings = [...phase2.warnings, ...phase3.warnings];

  const result: PipelineResult = {
    statementType: stType,
    lines: finalLines,
    unmappedLines,
    checks: phase3.checks,
    qualityScore: phase3.qualityScore,
    verdict: phase3.verdict,
    phases: {
      phase1: {
        total: phase1.allExtracted.filter((l) => !l.isNonFinancial).length,
        accepted: phase1.acceptedLines.length,
        rejected: phase1.rejectedLines.length,
      },
      phase2: {
        mapped: phase2.newlyMapped,
        corrected: phase2.corrections,
        confirmed: phase2.confirmed,
      },
      phase3: {
        checksRun: phase3.checks.length,
        issuesFound: phase3.checks.filter((c) => c.severity === 'error' || c.severity === 'warning')
          .length,
        corrections: phase3Corrections,
      },
    },
    warnings: allWarnings,
  };

  logFinanceEvent('pipeline.completed', {
    traceId,
    statementType: stType,
    documentName: options.documentName,
    totalLines: finalLines.length,
    unmapped: unmappedLines.length,
    qualityScore: phase3.qualityScore,
    verdict: phase3.verdict,
    phase1Accepted: phase1.acceptedLines.length,
    phase2NewlyMapped: phase2.newlyMapped,
    phase3Corrections,
  });

  return result;
}

// ─── Multi-statement pipeline (runs all 3 types for a document) ─────────────

export interface DocumentPipelineResult {
  documentName: string;
  results: Map<string, PipelineResult>;
  overallScore: number;
  overallVerdict: string;
}

export async function runDocumentPipeline(
  text: string,
  documentName: string,
  options: Omit<LlmPipelineOptions, 'documentName'> = {}
): Promise<DocumentPipelineResult> {
  const types: CanonicalStatementType[] = ['BS', 'P&L', 'CF'];
  const results = new Map<string, PipelineResult>();

  for (const stType of types) {
    console.log(`\n  ── ${stType} ──`);
    const result = await runLlmFinancialPipeline(text, stType, {
      ...options,
      documentName,
    });
    results.set(stType, result);
  }

  const scores = [...results.values()].map((r) => r.qualityScore);
  const overallScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const verdicts = [...results.values()].map((r) => r.verdict);
  const overallVerdict = verdicts.includes('REJECTED')
    ? 'REJECTED'
    : verdicts.includes('NEEDS_REVIEW')
      ? 'NEEDS_REVIEW'
      : verdicts.includes('APPROVED_WITH_NOTES')
        ? 'APPROVED_WITH_NOTES'
        : 'APPROVED';

  return { documentName, results, overallScore, overallVerdict };
}
