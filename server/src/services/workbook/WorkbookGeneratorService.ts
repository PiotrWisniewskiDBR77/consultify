/**
 * WorkbookGeneratorService — orchestrates LLM-driven workbook generation.
 *
 * 5-phase pipeline:
 *   Phase 1 (PLAN):     LLM analyzes request, decomposes into sheets/columns/formulas
 *   Phase 2 (CONFIRM):  LLM validates plan against user intent — catches misunderstandings
 *   Phase 3 (GENERATE): LLM produces the full WorkbookSchema JSON
 *   Phase 4 (REVIEW):   LLM self-reviews the schema for quality — catches errors before build
 *   Phase 5 (BUILD):    ExcelJS materializes validated schema into .xlsx
 *
 * Domain-agnostic: works for budgets, project plans, risk matrices, comparisons, etc.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import { AIPipeline } from '../ai/AIPipeline.js';
import { createP23Error, type P23ClassifiedError } from '../v8/exceleCanon.js';
import {
  buildWorkbookBuffer,
  classifyBuildError,
  validateWorkbookSchema,
} from './WorkbookBuilder.js';
import { type WorkbookSchema, WorkbookSchemaValidator } from './WorkbookSchema.js';
import { critiqueWorkbook, type WorkbookQualityReport } from './workbookQualityGate.js';

// ---------------------------------------------------------------------------
// Phase prompts
// ---------------------------------------------------------------------------

const PLANNING_SYSTEM_PROMPT = `You are an expert spreadsheet architect. Your ONLY job right now is to PLAN the structure of an Excel workbook.

Given a user request, analyze it and produce a structured plan. Think step by step:

1. DOMAIN ANALYSIS: What domain is this? (finance, HR, project management, operations, strategy, etc.)
2. SHEET DECOMPOSITION: What distinct sheets are needed? Each sheet should have a clear, single purpose.
3. DATA FLOW: How do sheets connect? Which sheets provide inputs to others? Draw the dependency graph.
4. COLUMN DESIGN: For each sheet, what columns are needed? What data types? What widths?
5. FORMULA STRATEGY: What calculations are needed? Which cells should use formulas vs. static values?
   - Cross-sheet references (e.g. ='Assumptions'!B3)
   - Aggregations (SUM, AVERAGE, COUNT)
   - Conditional logic (IF, VLOOKUP)
   - Row-level calculations (e.g. Revenue * Margin = Profit)
6. FORMATTING PLAN: Header colors, number formats, which rows are summaries, alternating colors.
7. REALISTIC DATA: What sample data makes sense? Use realistic numbers for the domain.

Return your plan as a structured JSON:
{
  "domain": "finance",
  "sheets": [
    {
      "name": "Assumptions",
      "purpose": "Editable input parameters that drive the model",
      "columns": ["Parameter", "Value", "Unit", "Notes"],
      "key_formulas": "None — all static inputs",
      "row_count": 8,
      "depends_on": []
    },
    {
      "name": "P&L Projection",
      "purpose": "3-year profit & loss driven by Assumptions",
      "columns": ["Line Item", "2026", "2027", "2028"],
      "key_formulas": "Revenue grows by ='Assumptions'!B2 each year; COGS = Revenue * ='Assumptions'!B3",
      "row_count": 12,
      "depends_on": ["Assumptions"]
    }
  ],
  "total_complexity": "medium"
}

Return ONLY the JSON plan. No markdown, no explanation outside JSON.`;

// ---------------------------------------------------------------------------
// Phase 2: CONFIRMATION — validate plan against user intent
// ---------------------------------------------------------------------------

const CONFIRMATION_SYSTEM_PROMPT = `You are a quality assurance reviewer for spreadsheet plans. You receive:
1. The ORIGINAL USER REQUEST
2. A PLAN produced by a spreadsheet architect

Your job is to verify the plan BEFORE generation begins. Check:

1. COMPLETENESS: Does the plan cover everything the user asked for? Any missing sheets, columns, or metrics?
2. CORRECTNESS: Are the sheet names, column designs, and formula strategies appropriate for the domain?
3. DATA FLOW: Are cross-sheet dependencies logical? No circular references? No missing source sheets?
4. FORMULA FEASIBILITY: Can the described formulas actually work in Excel? Are cell references plausible?
5. SCOPE: Is the plan too narrow (missing key aspects) or too broad (unnecessary sheets)?
6. USER INTENT: Does the plan match what the user actually wants, or did the architect misinterpret?

Return your review as JSON:
{
  "approved": true/false,
  "confidence": 0.0-1.0,
  "issues": [
    {
      "severity": "critical|major|minor",
      "sheet": "affected sheet name or null",
      "description": "what's wrong",
      "fix": "how to fix it"
    }
  ],
  "missing_elements": ["list of things the user asked for but the plan doesn't cover"],
  "revised_plan": null or { ...corrected plan if approved=false... }
}

If the plan is good, return approved=true with confidence >= 0.8 and empty issues/missing_elements.
If there are problems, return approved=false with a revised_plan that fixes all issues.
Return ONLY the JSON. No markdown, no explanation.`;

// ---------------------------------------------------------------------------
// Phase 4: QUALITY REVIEW — self-review generated schema before build
// ---------------------------------------------------------------------------

const REVIEW_SYSTEM_PROMPT = `You are a senior Excel quality reviewer. You receive a WorkbookSchema JSON that was generated by an AI architect. Your job is to review it BEFORE it gets built into a real .xlsx file.

Check these quality criteria and score each 1-5:

1. FORMULA CORRECTNESS (1-5):
   - Do formulas reference correct cells? (B2 means row 2, column B = 2nd column)
   - Are cross-sheet references syntactically correct? (='SheetName'!B2)
   - Are SUM ranges correct? (=SUM(B2:B10) should cover all data rows, not more/less)
   - Are there hardcoded values that should be formulas?
   - CRITICAL: In the schema, row index 0 = Excel row 2 (row 1 is header). So the first data row's column B is B2, second data row is B3, etc.

2. DATA INTEGRITY (1-5):
   - Are column keys consistent across rows? (every row should use the same keys as defined in columns)
   - Are data types correct? (numbers as numbers, not strings)
   - Are summary rows properly marked with isSummary: true?
   - Do cross-sheet references point to sheets that actually exist?

3. COMPLETENESS (1-5):
   - Does every sheet have enough rows to be useful?
   - Are there missing columns that the domain requires?
   - Are there empty sheets or sheets with no real content?

4. FORMATTING (1-5):
   - Do currency columns have numberFormat?
   - Do percent columns use 0.00% format?
   - Are headers styled?
   - Is alternateRowColor set for readability?

5. PROFESSIONAL QUALITY (1-5):
   - Would a domain expert find this workbook useful?
   - Are the numbers realistic for the domain?
   - Is the structure logical and easy to navigate?

Return your review as JSON:
{
  "scores": {
    "formula_correctness": 4,
    "data_integrity": 5,
    "completeness": 3,
    "formatting": 4,
    "professional_quality": 4
  },
  "overall_score": 4.0,
  "pass": true/false,
  "issues": [
    {
      "severity": "critical|major|minor",
      "category": "formula|data|completeness|formatting|quality",
      "sheet": "Sheet Name",
      "row_index": 3,
      "column_key": "revenue",
      "description": "Formula =SUM(B2:B5) should be =SUM(B2:B4) because there are only 3 data rows",
      "current_value": "=SUM(B2:B5)",
      "suggested_fix": "=SUM(B2:B4)"
    }
  ],
  "fixes_applied": null or { ...corrected WorkbookSchema if pass=false and issues are fixable... }
}

PASS threshold: overall_score >= 3.5 AND no critical issues.
If pass=false AND the issues are fixable, include the corrected schema in fixes_applied.
Return ONLY the JSON. No markdown, no explanation.`;

const GENERATION_SYSTEM_PROMPT = `You are an expert spreadsheet architect. You receive a PLAN and must produce the final WorkbookSchema JSON.

CRITICAL RULES — FOLLOW EXACTLY:
1. Return ONLY valid JSON. No markdown fences, no explanation, no text before or after the JSON.
2. Every calculated value MUST use a formula. NEVER hardcode a value that should be computed.
3. Cross-sheet references use Excel syntax: ='SheetName'!CellRef (e.g. ='Assumptions'!B2)
4. Column keys MUST be snake_case identifiers (no spaces, no special chars).
5. Sheet names MUST be ≤31 characters.
6. Include isSummary: true on totals/summary rows.
7. Use realistic sample data when the user didn't provide specific numbers.

FORMULA REFERENCE (use these in the "formula" field):
- Sum: "=SUM(B2:B10)"
- Cross-sheet: "='Assumptions'!B2"
- Multiplication: "=B2*C2"
- Growth: "=B2*(1+Config!B3)"
- Conditional: "=IF(B2>0,B2*0.19,0)"
- Percentage: "=B2/B$12"

SCHEMA FORMAT:
{
  "title": "string",
  "description": "string",
  "sheets": [
    {
      "name": "Sheet Name (≤31 chars)",
      "purpose": "What this sheet does",
      "columns": [
        { "key": "snake_case_key", "header": "Display Name", "width": 18, "type": "currency|number|percent|text|date|boolean", "numberFormat": "#,##0.00" }
      ],
      "rows": [
        {
          "cells": {
            "snake_case_key": { "value": 1000, "style": { "bold": true } }
          }
        },
        {
          "cells": {
            "snake_case_key": { "formula": "=SUM(B2:B5)", "comment": "Sum of items" }
          },
          "isSummary": true
        }
      ],
      "freezeRow": 1,
      "freezeCol": 0,
      "alternateRowColor": "F2F7FB",
      "headerStyle": { "bold": true, "fontColor": "FFFFFF", "bgColor": "4472C4", "border": "thin" },
      "tabColor": "4472C4"
    }
  ]
}

EXAMPLE — a simple 2-sheet budget:
{
  "title": "Q1 2026 Budget",
  "description": "Quarterly budget with assumptions and projections",
  "sheets": [
    {
      "name": "Assumptions",
      "purpose": "Editable input parameters",
      "columns": [
        { "key": "parameter", "header": "Parameter", "width": 25, "type": "text" },
        { "key": "value", "header": "Value", "width": 15, "type": "number" },
        { "key": "unit", "header": "Unit", "width": 10, "type": "text" }
      ],
      "rows": [
        { "cells": { "parameter": { "value": "Revenue Growth Rate" }, "value": { "value": 0.08 }, "unit": { "value": "%" } } },
        { "cells": { "parameter": { "value": "COGS Margin" }, "value": { "value": 0.35 }, "unit": { "value": "%" } } },
        { "cells": { "parameter": { "value": "Tax Rate" }, "value": { "value": 0.19 }, "unit": { "value": "%" } } }
      ],
      "freezeRow": 1,
      "headerStyle": { "bold": true, "fontColor": "FFFFFF", "bgColor": "2F5496", "border": "thin" },
      "tabColor": "2F5496"
    },
    {
      "name": "P&L",
      "purpose": "Profit & Loss projection using Assumptions",
      "columns": [
        { "key": "item", "header": "Line Item", "width": 22, "type": "text" },
        { "key": "jan", "header": "January", "width": 15, "type": "currency", "numberFormat": "#,##0" },
        { "key": "feb", "header": "February", "width": 15, "type": "currency", "numberFormat": "#,##0" },
        { "key": "q1_total", "header": "Q1 Total", "width": 15, "type": "currency", "numberFormat": "#,##0" }
      ],
      "rows": [
        { "cells": { "item": { "value": "Revenue" }, "jan": { "value": 100000 }, "feb": { "formula": "=B2*(1+'Assumptions'!B2)" }, "q1_total": { "formula": "=SUM(B2:C2)" } } },
        { "cells": { "item": { "value": "COGS" }, "jan": { "formula": "=B2*'Assumptions'!B3" }, "feb": { "formula": "=C2*'Assumptions'!B3" }, "q1_total": { "formula": "=SUM(B3:C3)" } } },
        { "cells": { "item": { "value": "Gross Profit" }, "jan": { "formula": "=B2-B3" }, "feb": { "formula": "=C2-C3" }, "q1_total": { "formula": "=SUM(B4:C4)" } }, "isSummary": true },
        { "cells": { "item": { "value": "Tax" }, "jan": { "formula": "=B4*'Assumptions'!B4" }, "feb": { "formula": "=C4*'Assumptions'!B4" }, "q1_total": { "formula": "=SUM(B5:C5)" } } },
        { "cells": { "item": { "value": "Net Income" }, "jan": { "formula": "=B4-B5" }, "feb": { "formula": "=C4-C5" }, "q1_total": { "formula": "=SUM(B6:C6)" } }, "isSummary": true }
      ],
      "freezeRow": 1,
      "alternateRowColor": "F2F7FB",
      "headerStyle": { "bold": true, "fontColor": "FFFFFF", "bgColor": "4472C4", "border": "thin" },
      "tabColor": "4472C4"
    }
  ]
}

Now produce the WorkbookSchema JSON for the given plan. Return ONLY the JSON.`;

// ---------------------------------------------------------------------------
// Schema extraction from LLM response
// ---------------------------------------------------------------------------

function extractJsonFromResponse(content: string): unknown | null {
  // Try direct parse
  try {
    return JSON.parse(content);
  } catch {
    /* not direct JSON */
  }

  // Try extracting from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      /* invalid JSON in code block */
    }
  }

  // Try finding the outermost { ... }
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      /* invalid JSON */
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelinePhaseLog {
  phase: string;
  status: 'ok' | 'warning' | 'failed' | 'skipped';
  durationMs: number;
  detail?: string;
}

export interface WorkbookGenerationResult {
  id: string;
  schema: WorkbookSchema;
  buffer: Buffer;
  fileName: string;
  validationErrors: string[];
  classifiedErrors: P23ClassifiedError[];
  qualityScore: number | null;
  /** Deterministyczny krytyk arkusza (analog deckDesignCritic). Fail-soft: raportuje, nie blokuje. */
  qualityReport: WorkbookQualityReport;
  pipelineLog: PipelinePhaseLog[];
  generatedAt: string;
}

export interface WorkbookGenerationParams {
  prompt: string;
  userId: string;
  organizationId: string;
  projectId?: string;
  researchContext?: string;
  language?: string;
}

class WorkbookGeneratorService {
  private aiPipeline = AIPipeline.getInstance();

  /**
   * Calls LLM with a dedicated system prompt, bypassing the chat persona.
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    params: { userId: string; organizationId: string; projectId?: string },
    maxTokens: number = 12000
  ): Promise<string> {
    const response = await this.aiPipeline.process({
      capability: 'chat',
      prompt: userPrompt,
      userId: params.userId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      options: {
        systemInstruction: systemPrompt,
        dedicatedSystemPrompt: true,
        maxTokens,
      },
      history: [],
    } as any);

    return response?.content || '';
  }

  // =========================================================================
  // Main pipeline: PLAN → CONFIRM → GENERATE → REVIEW → BUILD
  // =========================================================================

  async generate(params: WorkbookGenerationParams): Promise<WorkbookGenerationResult> {
    const { prompt, userId, organizationId, projectId, researchContext, language } = params;
    const id = uuidv4();
    const llmParams = { userId, organizationId, projectId };
    const pipelineLog: PipelinePhaseLog[] = [];

    logger.info(`[WorkbookGenerator] Starting 5-phase pipeline: ${id}`);

    let userPrompt = prompt;
    if (researchContext) {
      userPrompt = `${prompt}\n\nResearch context (use this data to populate the workbook):\n${researchContext}`;
    }
    if (language && language.startsWith('pl')) {
      userPrompt +=
        '\n\nUse Polish headers and labels where appropriate, but keep column keys in English.';
    }

    // =====================================================================
    // PHASE 1: PLAN — LLM analyzes request and decomposes into structure
    // =====================================================================
    let plan = '';
    const p1Start = Date.now();
    try {
      plan = await this.callLLM(
        PLANNING_SYSTEM_PROMPT,
        `User request: ${userPrompt}\n\nAnalyze this request and produce a workbook plan as JSON.`,
        llmParams,
        4000
      );
      pipelineLog.push({
        phase: 'plan',
        status: 'ok',
        durationMs: Date.now() - p1Start,
        detail: `${plan.length} chars`,
      });
      logger.info(
        `[WorkbookGenerator] Phase 1 PLAN: OK (${plan.length} chars, ${Date.now() - p1Start}ms)`
      );
    } catch (err) {
      pipelineLog.push({
        phase: 'plan',
        status: 'failed',
        durationMs: Date.now() - p1Start,
        detail: String(err),
      });
      logger.warn(`[WorkbookGenerator] Phase 1 PLAN: FAILED, continuing without plan`, err);
    }

    // =====================================================================
    // PHASE 2: CONFIRM — validate plan against user intent
    // =====================================================================
    let confirmedPlan = plan;
    const p2Start = Date.now();

    if (plan) {
      try {
        const confirmationResponse = await this.callLLM(
          CONFIRMATION_SYSTEM_PROMPT,
          `ORIGINAL USER REQUEST:\n${userPrompt}\n\nPLAN TO REVIEW:\n${plan}\n\nReview this plan and return your assessment as JSON.`,
          llmParams,
          4000
        );

        const confirmResult = extractJsonFromResponse(confirmationResponse);
        if (confirmResult && typeof confirmResult === 'object') {
          const cr = confirmResult as any;
          const approved = cr.approved === true;
          const confidence = typeof cr.confidence === 'number' ? cr.confidence : 0;
          const issueCount = Array.isArray(cr.issues) ? cr.issues.length : 0;
          const criticalIssues = Array.isArray(cr.issues)
            ? cr.issues.filter((i: any) => i.severity === 'critical').length
            : 0;
          const missingCount = Array.isArray(cr.missing_elements) ? cr.missing_elements.length : 0;

          if (!approved && cr.revised_plan) {
            confirmedPlan =
              typeof cr.revised_plan === 'string'
                ? cr.revised_plan
                : JSON.stringify(cr.revised_plan);
            pipelineLog.push({
              phase: 'confirm',
              status: 'warning',
              durationMs: Date.now() - p2Start,
              detail: `NOT approved (confidence=${confidence.toFixed(2)}, ${criticalIssues} critical, ${issueCount} total issues, ${missingCount} missing). Using revised plan.`,
            });
            logger.info(
              `[WorkbookGenerator] Phase 2 CONFIRM: Plan revised (${issueCount} issues, ${missingCount} missing)`
            );
          } else if (!approved) {
            pipelineLog.push({
              phase: 'confirm',
              status: 'warning',
              durationMs: Date.now() - p2Start,
              detail: `NOT approved but no revised plan provided (confidence=${confidence.toFixed(2)}). Proceeding with original.`,
            });
            logger.warn(
              `[WorkbookGenerator] Phase 2 CONFIRM: Not approved but no revised plan, using original`
            );
          } else {
            pipelineLog.push({
              phase: 'confirm',
              status: 'ok',
              durationMs: Date.now() - p2Start,
              detail: `Approved (confidence=${confidence.toFixed(2)}, ${issueCount} minor issues)`,
            });
            logger.info(
              `[WorkbookGenerator] Phase 2 CONFIRM: Approved (confidence=${confidence.toFixed(2)})`
            );
          }
        } else {
          pipelineLog.push({
            phase: 'confirm',
            status: 'warning',
            durationMs: Date.now() - p2Start,
            detail: 'Could not parse confirmation response',
          });
        }
      } catch (err) {
        pipelineLog.push({
          phase: 'confirm',
          status: 'failed',
          durationMs: Date.now() - p2Start,
          detail: String(err),
        });
        logger.warn(`[WorkbookGenerator] Phase 2 CONFIRM: FAILED, using original plan`, err);
      }
    } else {
      pipelineLog.push({
        phase: 'confirm',
        status: 'skipped',
        durationMs: 0,
        detail: 'No plan to confirm',
      });
    }

    // =====================================================================
    // PHASE 3: GENERATE — LLM produces the WorkbookSchema JSON
    // =====================================================================
    const p3Start = Date.now();
    let schema: WorkbookSchema;
    const maxAttempts = 3;

    const generationPrompt = confirmedPlan
      ? `CONFIRMED PLAN:\n${confirmedPlan}\n\nORIGINAL USER REQUEST:\n${userPrompt}\n\nProduce the complete WorkbookSchema JSON following the confirmed plan. Return ONLY the JSON.`
      : `USER REQUEST:\n${userPrompt}\n\nProduce a complete WorkbookSchema JSON. Return ONLY the JSON.`;

    let currentPrompt = generationPrompt;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const content = await this.callLLM(
          GENERATION_SYSTEM_PROMPT,
          currentPrompt,
          llmParams,
          16000
        );

        const parsed = extractJsonFromResponse(content);

        if (!parsed) {
          logger.warn(
            `[WorkbookGenerator] Phase 3 attempt ${attempt}: No valid JSON (${content.length} chars)`
          );
          if (attempt === maxAttempts)
            throw new Error('LLM did not return valid JSON after 3 attempts');
          currentPrompt = `${generationPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a JSON object starting with { and ending with }. No markdown, no backticks, no explanation.`;
          continue;
        }

        const validated = WorkbookSchemaValidator.safeParse(parsed);
        if (!validated.success) {
          const errorSummary = validated.error.issues
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; ');
          logger.warn(
            `[WorkbookGenerator] Phase 3 attempt ${attempt}: Validation failed: ${errorSummary}`
          );
          if (attempt === maxAttempts) {
            schema = this.repairSchema(parsed as any);
            break;
          }
          currentPrompt = `${generationPrompt}\n\nYour previous JSON had these validation errors:\n${errorSummary}\n\nFix these issues and return valid JSON only.`;
          continue;
        }

        schema = validated.data;
        break;
      } catch (err) {
        logger.error(`[WorkbookGenerator] Phase 3 attempt ${attempt} failed:`, err);
        if (attempt === maxAttempts) throw err;
      }
    }

    pipelineLog.push({
      phase: 'generate',
      status: 'ok',
      durationMs: Date.now() - p3Start,
      detail: `"${schema!.title}" — ${schema!.sheets.length} sheets, ${schema!.sheets.reduce((sum, s) => sum + s.rows.length, 0)} total rows`,
    });
    logger.info(
      `[WorkbookGenerator] Phase 3 GENERATE: OK — "${schema!.title}" with ${schema!.sheets.length} sheets`
    );

    // =====================================================================
    // PHASE 4: REVIEW — LLM self-reviews schema quality before build
    // =====================================================================
    const p4Start = Date.now();
    let qualityScore: number | null = null;

    try {
      const schemaJson = JSON.stringify(schema!, null, 2);
      const reviewResponse = await this.callLLM(
        REVIEW_SYSTEM_PROMPT,
        `ORIGINAL USER REQUEST:\n${userPrompt}\n\nGENERATED WORKBOOK SCHEMA:\n${schemaJson}\n\nReview this schema for quality. Return your assessment as JSON.`,
        llmParams,
        6000
      );

      const reviewResult = extractJsonFromResponse(reviewResponse);
      if (reviewResult && typeof reviewResult === 'object') {
        const rr = reviewResult as any;
        qualityScore = typeof rr.overall_score === 'number' ? rr.overall_score : null;
        const pass = rr.pass === true;
        const issueCount = Array.isArray(rr.issues) ? rr.issues.length : 0;
        const criticalIssues = Array.isArray(rr.issues)
          ? rr.issues.filter((i: any) => i.severity === 'critical')
          : [];

        if (!pass && rr.fixes_applied) {
          // LLM provided a corrected schema — validate and use it
          const fixedValidation = WorkbookSchemaValidator.safeParse(rr.fixes_applied);
          if (fixedValidation.success) {
            schema = fixedValidation.data;
            pipelineLog.push({
              phase: 'review',
              status: 'warning',
              durationMs: Date.now() - p4Start,
              detail: `Score ${qualityScore?.toFixed(1)}/5 — FAILED review, applied ${issueCount} fixes (${criticalIssues.length} critical). Using corrected schema.`,
            });
            logger.info(
              `[WorkbookGenerator] Phase 4 REVIEW: Applied fixes (score=${qualityScore}, ${issueCount} issues)`
            );
          } else {
            pipelineLog.push({
              phase: 'review',
              status: 'warning',
              durationMs: Date.now() - p4Start,
              detail: `Score ${qualityScore?.toFixed(1)}/5 — fixes provided but invalid, using original schema. ${issueCount} issues found.`,
            });
            logger.warn(`[WorkbookGenerator] Phase 4 REVIEW: Fixes invalid, using original schema`);
          }
        } else if (!pass && criticalIssues.length > 0) {
          // Critical issues but no fixes — try one more generation with the issues as feedback
          logger.warn(
            `[WorkbookGenerator] Phase 4 REVIEW: ${criticalIssues.length} critical issues, attempting regeneration`
          );
          const issuesFeedback = criticalIssues
            .map(
              (i: any) =>
                `- [${i.category}] ${i.sheet || 'global'}: ${i.description} → Fix: ${i.suggested_fix || 'unknown'}`
            )
            .join('\n');

          try {
            const fixContent = await this.callLLM(
              GENERATION_SYSTEM_PROMPT,
              `${generationPrompt}\n\nQUALITY REVIEW found these CRITICAL issues in your previous output:\n${issuesFeedback}\n\nFix ALL critical issues and return the corrected WorkbookSchema JSON. Return ONLY the JSON.`,
              llmParams,
              16000
            );
            const fixParsed = extractJsonFromResponse(fixContent);
            if (fixParsed) {
              const fixValidated = WorkbookSchemaValidator.safeParse(fixParsed);
              if (fixValidated.success) {
                schema = fixValidated.data;
                pipelineLog.push({
                  phase: 'review',
                  status: 'warning',
                  durationMs: Date.now() - p4Start,
                  detail: `Score ${qualityScore?.toFixed(1)}/5 — regenerated after ${criticalIssues.length} critical issues.`,
                });
              }
            }
          } catch {
            pipelineLog.push({
              phase: 'review',
              status: 'warning',
              durationMs: Date.now() - p4Start,
              detail: `Score ${qualityScore?.toFixed(1)}/5 — regeneration after review failed, using original.`,
            });
          }
        } else {
          pipelineLog.push({
            phase: 'review',
            status: pass ? 'ok' : 'warning',
            durationMs: Date.now() - p4Start,
            detail: `Score ${qualityScore?.toFixed(1)}/5 — ${pass ? 'PASSED' : 'marginal'} (${issueCount} issues, ${criticalIssues.length} critical)`,
          });
          logger.info(
            `[WorkbookGenerator] Phase 4 REVIEW: ${pass ? 'PASSED' : 'marginal'} (score=${qualityScore})`
          );
        }
      } else {
        pipelineLog.push({
          phase: 'review',
          status: 'warning',
          durationMs: Date.now() - p4Start,
          detail: 'Could not parse review response',
        });
      }
    } catch (err) {
      pipelineLog.push({
        phase: 'review',
        status: 'failed',
        durationMs: Date.now() - p4Start,
        detail: String(err),
      });
      logger.warn(
        `[WorkbookGenerator] Phase 4 REVIEW: FAILED, proceeding with unreviewed schema`,
        err
      );
    }

    // =====================================================================
    // PHASE 5: BUILD — ExcelJS materializes the validated schema
    // =====================================================================
    const p5Start = Date.now();
    const classifiedErrors: P23ClassifiedError[] = [];
    const structuralValidation = validateWorkbookSchema(schema!);
    if (!structuralValidation.valid) {
      logger.warn(`[WorkbookGenerator] Phase 5: Structural warnings:`, structuralValidation.errors);
      for (const err of structuralValidation.errors) {
        classifiedErrors.push(createP23Error('validation_failed', err));
      }
    }

    // Deterministyczny krytyk arkusza (analog deckDesignCritic w decku). Fail-soft:
    // NIGDY nie blokuje generacji — raportuje + loguje + wnosi issues do telemetrii.
    let qualityReport: WorkbookQualityReport;
    try {
      qualityReport = critiqueWorkbook(schema!);
    } catch (criticErr) {
      logger.warn('[WorkbookGenerator] Phase 5: quality gate threw, continuing', criticErr);
      qualityReport = { score: 100, issues: [], passed: true };
    }
    for (const iss of qualityReport.issues) {
      // Klasyfikuj wg kanonu P23 (kod z krytyka), dołącz do telemetrii błędów.
      classifiedErrors.push(
        createP23Error(iss.canonCode, `${iss.code} [${iss.sheet}${iss.cell ? `!${iss.cell}` : ''}] ${iss.message}`),
      );
    }
    if (qualityReport.issues.length > 0) {
      pipelineLog.push({
        phase: 'quality-gate',
        status: qualityReport.passed ? 'warning' : 'failed',
        durationMs: 0,
        detail: `Quality ${qualityReport.score}/100 — ${qualityReport.issues.length} issue(s), ${
          qualityReport.issues.filter((i) => i.severity === 'CRITICAL').length
        } critical (fail-soft: reported, build continues).`,
      });
      logger.info(
        `[WorkbookGenerator] Phase 5 QUALITY GATE: score=${qualityReport.score}, ${qualityReport.issues.length} issue(s), passed=${qualityReport.passed}`,
      );
    }

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema!, {
        // Consultant styling layer runs by default; surface provenance on the
        // Info sheet (org name resolution is intentionally deferred — the UUID
        // is not user-facing).
        meta: {
          source: 'Consultify — Intelligent Workbook Generator',
          generatedAt: new Date().toISOString().slice(0, 10),
        },
      });
    } catch (buildError) {
      const classified = classifyBuildError(buildError);
      classifiedErrors.push(classified);
      pipelineLog.push({
        phase: 'build',
        status: 'failed',
        durationMs: Date.now() - p5Start,
        detail: `Build failed: ${classified.code} — ${classified.detail}`,
      });
      throw buildError;
    }

    const safeTitle = (schema!.title || 'Workbook').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const fileName = `${safeTitle.replace(/\s+/g, '_')}.xlsx`;

    pipelineLog.push({
      phase: 'build',
      status: 'ok',
      durationMs: Date.now() - p5Start,
      detail: `${buffer.length} bytes, ${structuralValidation.errors.length} structural warnings`,
    });

    const totalMs = pipelineLog.reduce((sum, p) => sum + p.durationMs, 0);
    logger.info(
      `[WorkbookGenerator] Pipeline complete: "${schema!.title}" — ${schema!.sheets.length} sheets, ${buffer.length} bytes, quality=${qualityScore ?? 'N/A'}, ${totalMs}ms total`
    );

    return {
      id,
      schema: schema!,
      buffer,
      fileName,
      validationErrors: structuralValidation.errors,
      classifiedErrors,
      qualityScore,
      qualityReport,
      pipelineLog,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Attempts to repair a partially valid schema by filling in defaults.
   */
  private repairSchema(raw: any): WorkbookSchema {
    const sheets = Array.isArray(raw?.sheets)
      ? raw.sheets
      : [{ name: 'Sheet1', columns: [], rows: [] }];

    return {
      title: raw?.title || 'Generated Workbook',
      description: raw?.description,
      sheets: sheets.map((s: any, idx: number) => ({
        name: s?.name || `Sheet${idx + 1}`,
        purpose: s?.purpose,
        columns: Array.isArray(s?.columns)
          ? s.columns.map((c: any) => ({
              key: c?.key || `col_${Math.random().toString(36).slice(2, 6)}`,
              header: c?.header || c?.key || 'Column',
              width: c?.width,
              type: c?.type,
              numberFormat: c?.numberFormat,
            }))
          : [],
        rows: Array.isArray(s?.rows)
          ? s.rows.map((r: any) => ({
              cells: r?.cells || {},
              style: r?.style,
              isSummary: r?.isSummary,
            }))
          : [],
        freezeRow: s?.freezeRow ?? 1,
        alternateRowColor: s?.alternateRowColor,
        headerStyle: s?.headerStyle,
      })),
    };
  }
}

export default new WorkbookGeneratorService();
