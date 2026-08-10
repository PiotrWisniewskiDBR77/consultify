import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { WorkbookSchemaValidator } from '../../workbook/WorkbookSchema.js';

const migrationPath = path.resolve(
  process.cwd(),
  'server/migrations/20260808_board_ready_documents_templates.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8');
const jsonPayloads = [...sql.matchAll(/\$\$([\s\S]*?)\$\$::jsonb/g)].map((match) =>
  JSON.parse(match[1])
);
const formulaRepairSql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'server/migrations/20260808_documents_template_kpi_formula_repair.sql'
  ),
  'utf8'
);

/** Authoring brief carried by every Word section in the migration payload. */
interface WordSectionBrief {
  level: number;
  title: string;
  purpose: string;
  keyMessage?: string;
  contentHints?: unknown[];
  dataNeeded?: unknown[];
  suggestedEvidence?: unknown;
}

/** Slide brief carried by every presentation outline in the migration payload. */
interface PresentationSlideBrief {
  intent: string;
  title: string;
  keyMessage?: string;
  dataNeeded?: unknown[];
  suggestedVisual?: unknown;
}

describe('board-ready Documents template migration', () => {
  it('contains the exact 3 Word, 3 workbook and 3 presentation qualification targets', () => {
    for (const id of [
      'doc-template-system-en-board_report',
      'doc-template-system-en-business_case',
      'doc-template-system-en-decision_memo',
      'f5da6891-de3e-431d-8bc8-10e97b01609a',
      '3f36a34d-51d2-455e-a952-c984cc91853c',
      '510a84dd-c9c9-4294-ac4a-20616792c785',
      'pt-steering',
      'pt-assessment',
      'pt-valuation',
    ]) {
      expect(sql).toContain(id);
    }
  });

  it('ships three valid workbook schemas with formulas, controls and decision structure', () => {
    const workbookSchemas = jsonPayloads.filter(
      (payload) => payload && !Array.isArray(payload) && Array.isArray(payload.sheets)
    );
    expect(workbookSchemas).toHaveLength(3);

    for (const schema of workbookSchemas) {
      const parsed = WorkbookSchemaValidator.safeParse(schema);
      expect(parsed.success, parsed.success ? undefined : parsed.error.message).toBe(true);
      const sheet = schema.sheets[0];
      expect(sheet.columns.length).toBeGreaterThanOrEqual(8);
      expect(sheet.freezeRow).toBe(1);
      expect(sheet.autoFilter).toBe(true);
      expect(sheet.headerStyle?.bold).toBe(true);
      expect(sheet.rows[0].cells).toEqual(
        expect.objectContaining(
          Object.fromEntries(
            Object.entries(sheet.rows[0].cells).filter(([, cell]: any) => cell.formula)
          )
        )
      );
      expect(
        Object.values(sheet.rows[0].cells).some((cell: any) => typeof cell.formula === 'string')
      ).toBe(true);
    }
  });

  it('repairs the empty KPI starter row without any division formula', () => {
    const payload = JSON.parse(
      formulaRepairSql.match(/\$\$([\s\S]*?)\$\$::jsonb/)?.[1] ?? 'null'
    );
    const parsed = WorkbookSchemaValidator.safeParse(payload);
    expect(parsed.success, parsed.success ? undefined : parsed.error.message).toBe(true);
    const sheet = payload.sheets[0];
    expect(sheet.columns.map((column: any) => column.header)).toContain('Decision / action');
    const formulas = Object.values(sheet.rows[0].cells)
      .map((cell: any) => cell.formula)
      .filter(Boolean);
    expect(formulas).toEqual(['C2-B2']);
    expect(formulas.some((formula: string) => formula.includes('/'))).toBe(false);
  });

  it('gives every Word section an evidence-governed authoring brief', () => {
    const wordBlueprints = jsonPayloads.filter(
      (payload) =>
        Array.isArray(payload) &&
        payload.length >= 6 &&
        payload.every((item) => item && item.level && item.title && item.purpose)
    );
    expect(wordBlueprints).toHaveLength(3);
    // `jsonPayloads` is JSON.parse output (`any`); name the shape the assertions read.
    for (const blueprint of wordBlueprints as WordSectionBrief[][]) {
      expect(
        blueprint.every(
          (section) =>
            section.keyMessage &&
            (section.contentHints?.length ?? 0) >= 2 &&
            (section.dataNeeded?.length ?? 0) >= 3 &&
            section.suggestedEvidence
        )
      ).toBe(true);
    }
  });

  it('gives every presentation slide a thesis, data requirements and visual contract', () => {
    const presentationOutlines = jsonPayloads.filter(
      (payload) =>
        Array.isArray(payload) &&
        payload.length >= 8 &&
        payload.every((item) => item && item.intent && item.title)
    );
    expect(presentationOutlines).toHaveLength(3);
    for (const outline of presentationOutlines as PresentationSlideBrief[][]) {
      expect(
        outline.every(
          (slide) => slide.keyMessage && (slide.dataNeeded?.length ?? 0) >= 3 && slide.suggestedVisual
        )
      ).toBe(true);
    }
  });
});
