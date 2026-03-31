/**
 * WorkbookGeneratorService — orchestrates LLM-driven workbook generation.
 *
 * Flow: user prompt → (optional web research) → LLM generates WorkbookSchema JSON
 *       → validate → build .xlsx via ExcelJS → return buffer + metadata.
 *
 * Domain-agnostic: works for budgets, project plans, risk matrices, comparisons, etc.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import { AIPipeline } from '../ai/AIPipeline.js';
import { buildWorkbookBuffer, validateWorkbookSchema } from './WorkbookBuilder.js';
import { WorkbookSchemaValidator, type WorkbookSchema } from './WorkbookSchema.js';

// ---------------------------------------------------------------------------
// LLM prompt
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Two-phase LLM process:
//   Phase 1 (PLANNING): Think about the workbook structure
//   Phase 2 (GENERATION): Produce the WorkbookSchema JSON
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
  } catch { /* not direct JSON */ }

  // Try extracting from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* invalid JSON in code block */ }
  }

  // Try finding the outermost { ... }
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch { /* invalid JSON */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface WorkbookGenerationResult {
  id: string;
  schema: WorkbookSchema;
  buffer: Buffer;
  fileName: string;
  validationErrors: string[];
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
   * Uses `promptKey: '__raw__'` convention + `systemInstruction` override
   * so the pipeline doesn't prepend the general chat persona.
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    params: { userId: string; organizationId: string; projectId?: string },
    maxTokens: number = 12000,
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

  async generate(params: WorkbookGenerationParams): Promise<WorkbookGenerationResult> {
    const { prompt, userId, organizationId, projectId, researchContext, language } = params;
    const id = uuidv4();

    logger.info(`[WorkbookGenerator] Starting generation: ${id}`);

    // Build the user prompt with optional research context
    let userPrompt = prompt;
    if (researchContext) {
      userPrompt = `${prompt}\n\nResearch context (use this data to populate the workbook):\n${researchContext}`;
    }
    if (language && language.startsWith('pl')) {
      userPrompt += '\n\nUse Polish headers and labels where appropriate, but keep column keys in English.';
    }

    // -----------------------------------------------------------------------
    // PHASE 1: PLANNING — LLM thinks about the workbook structure
    // -----------------------------------------------------------------------
    logger.info(`[WorkbookGenerator] Phase 1: Planning workbook structure`);

    let plan: string;
    try {
      plan = await this.callLLM(
        PLANNING_SYSTEM_PROMPT,
        `User request: ${userPrompt}\n\nAnalyze this request and produce a workbook plan as JSON.`,
        { userId, organizationId, projectId },
        4000,
      );
      logger.info(`[WorkbookGenerator] Phase 1 complete: plan received (${plan.length} chars)`);
    } catch (err) {
      logger.warn(`[WorkbookGenerator] Phase 1 failed, proceeding directly to generation:`, err);
      plan = '';
    }

    // -----------------------------------------------------------------------
    // PHASE 2: GENERATION — LLM produces the WorkbookSchema JSON
    // -----------------------------------------------------------------------
    logger.info(`[WorkbookGenerator] Phase 2: Generating WorkbookSchema`);

    let schema: WorkbookSchema;
    const maxAttempts = 3;

    const generationPrompt = plan
      ? `PLAN (from Phase 1 analysis):\n${plan}\n\nORIGINAL USER REQUEST:\n${userPrompt}\n\nNow produce the complete WorkbookSchema JSON following the plan above. Return ONLY the JSON.`
      : `USER REQUEST:\n${userPrompt}\n\nProduce a complete WorkbookSchema JSON. Return ONLY the JSON.`;

    let currentPrompt = generationPrompt;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const content = await this.callLLM(
          GENERATION_SYSTEM_PROMPT,
          currentPrompt,
          { userId, organizationId, projectId },
          16000,
        );

        const parsed = extractJsonFromResponse(content);

        if (!parsed) {
          logger.warn(`[WorkbookGenerator] Attempt ${attempt}: Could not extract JSON from LLM response (${content.length} chars)`);
          if (attempt === maxAttempts) throw new Error('LLM did not return valid JSON after 3 attempts');
          currentPrompt = `${generationPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a JSON object starting with { and ending with }. No markdown, no backticks, no explanation.`;
          continue;
        }

        const validated = WorkbookSchemaValidator.safeParse(parsed);
        if (!validated.success) {
          const errorSummary = validated.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
          logger.warn(`[WorkbookGenerator] Attempt ${attempt}: Schema validation failed: ${errorSummary}`);
          if (attempt === maxAttempts) {
            schema = this.repairSchema(parsed as any);
            break;
          }
          currentPrompt = `${generationPrompt}\n\nYour previous JSON had these validation errors:\n${errorSummary}\n\nFix these issues and return valid JSON only.`;
          continue;
        }

        schema = validated.data;
        logger.info(`[WorkbookGenerator] Phase 2 complete on attempt ${attempt}: "${schema.title}" with ${schema.sheets.length} sheets`);
        break;
      } catch (err) {
        logger.error(`[WorkbookGenerator] Attempt ${attempt} failed:`, err);
        if (attempt === maxAttempts) throw err;
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 3: VALIDATE + BUILD
    // -----------------------------------------------------------------------
    const validation = validateWorkbookSchema(schema!);
    if (!validation.valid) {
      logger.warn(`[WorkbookGenerator] Schema has validation warnings:`, validation.errors);
    }

    const buffer = await buildWorkbookBuffer(schema!);
    const safeTitle = (schema!.title || 'Workbook').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const fileName = `${safeTitle.replace(/\s+/g, '_')}.xlsx`;

    logger.info(`[WorkbookGenerator] Generated workbook "${schema!.title}" with ${schema!.sheets.length} sheets, ${buffer.length} bytes`);

    return {
      id,
      schema: schema!,
      buffer,
      fileName,
      validationErrors: validation.errors,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Attempts to repair a partially valid schema by filling in defaults.
   */
  private repairSchema(raw: any): WorkbookSchema {
    const sheets = Array.isArray(raw?.sheets) ? raw.sheets : [{ name: 'Sheet1', columns: [], rows: [] }];

    return {
      title: raw?.title || 'Generated Workbook',
      description: raw?.description,
      sheets: sheets.map((s: any, idx: number) => ({
        name: s?.name || `Sheet${idx + 1}`,
        purpose: s?.purpose,
        columns: Array.isArray(s?.columns) ? s.columns.map((c: any) => ({
          key: c?.key || `col_${Math.random().toString(36).slice(2, 6)}`,
          header: c?.header || c?.key || 'Column',
          width: c?.width,
          type: c?.type,
          numberFormat: c?.numberFormat,
        })) : [],
        rows: Array.isArray(s?.rows) ? s.rows.map((r: any) => ({
          cells: r?.cells || {},
          style: r?.style,
          isSummary: r?.isSummary,
        })) : [],
        freezeRow: s?.freezeRow ?? 1,
        alternateRowColor: s?.alternateRowColor,
        headerStyle: s?.headerStyle,
      })),
    };
  }
}

export default new WorkbookGeneratorService();
