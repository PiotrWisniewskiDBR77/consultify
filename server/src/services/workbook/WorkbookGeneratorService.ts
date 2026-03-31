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

const WORKBOOK_SYSTEM_PROMPT = `You are an expert spreadsheet architect. Given a user request, you generate a WorkbookSchema JSON that describes a professional multi-sheet Excel workbook.

RULES:
1. Return ONLY valid JSON matching the WorkbookSchema format. No markdown, no explanation.
2. Use multiple sheets when the request implies distinct sections (e.g. Assumptions + P&L + Balance Sheet).
3. Use Excel formulas (e.g. "=B2*C2", "=SUM(D2:D10)", "='Assumptions'!B3*1.05") to link data across sheets and rows. NEVER hardcode values that should be calculated.
4. Use professional formatting: bold headers, number formats (#,##0.00 for currency, 0.00% for percent), alternating row colors.
5. Include a summary/totals row where appropriate (mark with isSummary: true).
6. Column keys must be valid identifiers (no spaces, use snake_case).
7. Sheet names must be ≤31 characters.
8. For financial models: Assumptions sheet should have editable cells; projection sheets should reference Assumptions via formulas.
9. Include realistic sample data when the user doesn't provide specific numbers.
10. Add cell comments for important assumptions or formula explanations.

WorkbookSchema format:
{
  "title": "Workbook Title",
  "description": "Brief description",
  "sheets": [
    {
      "name": "Sheet Name",
      "purpose": "What this sheet does",
      "columns": [
        { "key": "col_key", "header": "Display Name", "width": 20, "type": "currency", "numberFormat": "#,##0.00" }
      ],
      "rows": [
        {
          "cells": {
            "col_key": { "value": 1000, "formula": "=SUM(B2:B5)", "style": { "bold": true }, "comment": "Total" }
          },
          "isSummary": false
        }
      ],
      "freezeRow": 1,
      "alternateRowColor": "F2F7FB",
      "headerStyle": { "bold": true, "fontColor": "FFFFFF", "bgColor": "4472C4" }
    }
  ]
}

Cell types: text, number, currency, percent, date, boolean.
Style properties: bold, italic, fontSize, fontColor, bgColor, numberFormat, alignment (left/center/right), wrapText, border (thin/medium/thick/none).`;

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

    // Call LLM to generate schema
    let schema: WorkbookSchema;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.aiPipeline.process({
          capability: 'chat',
          prompt: userPrompt,
          userId,
          organizationId,
          projectId,
          options: {
            systemInstruction: WORKBOOK_SYSTEM_PROMPT,
            maxTokens: 8000,
          },
        } as any);

        const content = response?.content || '';
        const parsed = extractJsonFromResponse(content);

        if (!parsed) {
          logger.warn(`[WorkbookGenerator] Attempt ${attempt}: Could not extract JSON from LLM response`);
          if (attempt === maxAttempts) throw new Error('LLM did not return valid JSON');
          continue;
        }

        const validated = WorkbookSchemaValidator.safeParse(parsed);
        if (!validated.success) {
          logger.warn(`[WorkbookGenerator] Attempt ${attempt}: Schema validation failed`, validated.error.errors);
          if (attempt === maxAttempts) {
            // Try to use it anyway with defaults
            schema = this.repairSchema(parsed as any);
            break;
          }
          userPrompt += `\n\nYour previous response had validation errors: ${validated.error.errors.map(e => e.message).join('; ')}. Please fix and return valid JSON only.`;
          continue;
        }

        schema = validated.data;
        break;
      } catch (err) {
        logger.error(`[WorkbookGenerator] Attempt ${attempt} failed:`, err);
        if (attempt === maxAttempts) throw err;
      }
    }

    // Validate the schema
    const validation = validateWorkbookSchema(schema!);
    if (!validation.valid) {
      logger.warn(`[WorkbookGenerator] Schema has validation warnings:`, validation.errors);
    }

    // Build the Excel buffer
    const buffer = await buildWorkbookBuffer(schema!);
    const safeTitle = (schema!.title || 'Workbook').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const fileName = `${safeTitle.replace(/\s+/g, '_')}.xlsx`;

    logger.info(`[WorkbookGenerator] Generated workbook "${schema!.title}" with ${schema!.sheets.length} sheets`);

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
