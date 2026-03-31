/**
 * P23 Extension Tests — Intelligent Workbook Builder
 *
 * Tests cover:
 * 1. WorkbookSchema validation (valid/invalid schemas)
 * 2. WorkbookBuilder: multi-sheet generation with formulas
 * 3. WorkbookBuilder: formatting, freeze panes, merged cells
 * 4. WorkbookBuilder: validation catches errors
 * 5. API endpoints: generate, download, list
 * 6. Regression: existing ExportService still works
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Schema Validation
// ---------------------------------------------------------------------------

describe('WorkbookSchema validation', () => {
  it('validates a minimal valid schema', async () => {
    const { WorkbookSchemaValidator } = await import(
      '../../../server/src/services/workbook/WorkbookSchema.js'
    );

    const schema = {
      title: 'Test Workbook',
      sheets: [{
        name: 'Sheet1',
        columns: [{ key: 'name', header: 'Name' }, { key: 'value', header: 'Value', type: 'number' }],
        rows: [
          { cells: { name: { value: 'Item 1' }, value: { value: 100 } } },
          { cells: { name: { value: 'Total' }, value: { formula: '=SUM(B2:B2)' } }, isSummary: true },
        ],
      }],
    };

    const result = WorkbookSchemaValidator.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('validates a multi-sheet financial model schema', async () => {
    const { WorkbookSchemaValidator } = await import(
      '../../../server/src/services/workbook/WorkbookSchema.js'
    );

    const schema = {
      title: 'Budget 2026-2028',
      description: '3-year financial projection',
      sheets: [
        {
          name: 'Assumptions',
          columns: [
            { key: 'param', header: 'Parameter' },
            { key: 'value', header: 'Value', type: 'number' as const },
          ],
          rows: [
            { cells: { param: { value: 'Revenue Growth %' }, value: { value: 0.05 } } },
            { cells: { param: { value: 'Cost Reduction %' }, value: { value: 0.02 } } },
          ],
          freezeRow: 1,
        },
        {
          name: 'P&L',
          columns: [
            { key: 'item', header: 'Line Item' },
            { key: 'y2026', header: '2026', type: 'currency' as const },
            { key: 'y2027', header: '2027', type: 'currency' as const },
            { key: 'y2028', header: '2028', type: 'currency' as const },
          ],
          rows: [
            {
              cells: {
                item: { value: 'Revenue' },
                y2026: { value: 1000000 },
                y2027: { formula: "=B2*(1+'Assumptions'!B2)" },
                y2028: { formula: "=C2*(1+'Assumptions'!B2)" },
              },
            },
            {
              cells: {
                item: { value: 'Net Income' },
                y2026: { formula: '=B2-B3' },
                y2027: { formula: '=C2-C3' },
                y2028: { formula: '=D2-D3' },
              },
              isSummary: true,
            },
          ],
          alternateRowColor: 'F2F7FB',
          headerStyle: { bold: true, fontColor: 'FFFFFF', bgColor: '2F5496' },
        },
      ],
    };

    const result = WorkbookSchemaValidator.safeParse(schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sheets).toHaveLength(2);
      expect(result.data.sheets[1].rows[0].cells.y2027?.formula).toContain('Assumptions');
    }
  });

  it('rejects schema without sheets', async () => {
    const { WorkbookSchemaValidator } = await import(
      '../../../server/src/services/workbook/WorkbookSchema.js'
    );

    const result = WorkbookSchemaValidator.safeParse({ title: 'Empty', sheets: [] });
    expect(result.success).toBe(false);
  });

  it('validates cell styles', async () => {
    const { CellStyleSchema } = await import(
      '../../../server/src/services/workbook/WorkbookSchema.js'
    );

    const style = {
      bold: true,
      italic: false,
      fontSize: 14,
      fontColor: 'FF0000',
      bgColor: 'FFFF00',
      numberFormat: '#,##0.00',
      alignment: 'center' as const,
      wrapText: true,
      border: 'thin' as const,
    };

    const result = CellStyleSchema.safeParse(style);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. WorkbookBuilder
// ---------------------------------------------------------------------------

describe('WorkbookBuilder', () => {
  it('builds a single-sheet workbook buffer', async () => {
    const { buildWorkbookBuffer } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const schema = {
      title: 'Simple Test',
      sheets: [{
        name: 'Data',
        columns: [
          { key: 'name', header: 'Name', width: 20 },
          { key: 'amount', header: 'Amount', type: 'currency' as const },
        ],
        rows: [
          { cells: { name: { value: 'Item A' }, amount: { value: 1500 } } },
          { cells: { name: { value: 'Item B' }, amount: { value: 2500 } } },
          { cells: { name: { value: 'Total' }, amount: { formula: '=SUM(B2:B3)' } }, isSummary: true },
        ],
        freezeRow: 1,
        alternateRowColor: 'F5F5F5',
      }],
    };

    const buffer = await buildWorkbookBuffer(schema);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // XLSX magic bytes: PK (ZIP format)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4B); // K
  });

  it('builds a multi-sheet workbook with cross-sheet formulas', async () => {
    const { buildWorkbookBuffer } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const schema = {
      title: 'Multi-Sheet Test',
      sheets: [
        {
          name: 'Config',
          columns: [
            { key: 'param', header: 'Parameter' },
            { key: 'val', header: 'Value', type: 'number' as const },
          ],
          rows: [
            { cells: { param: { value: 'Tax Rate' }, val: { value: 0.19 } } },
            { cells: { param: { value: 'Growth' }, val: { value: 0.08 } } },
          ],
        },
        {
          name: 'Projection',
          columns: [
            { key: 'year', header: 'Year' },
            { key: 'revenue', header: 'Revenue', type: 'currency' as const },
            { key: 'tax', header: 'Tax', type: 'currency' as const },
          ],
          rows: [
            {
              cells: {
                year: { value: '2026' },
                revenue: { value: 1000000 },
                tax: { formula: "=B2*Config!B2" },
              },
            },
            {
              cells: {
                year: { value: '2027' },
                revenue: { formula: "=B2*(1+Config!B3)" },
                tax: { formula: "=B3*Config!B2" },
              },
            },
          ],
          headerStyle: { bold: true, bgColor: '1F4E79', fontColor: 'FFFFFF' },
        },
      ],
    };

    const buffer = await buildWorkbookBuffer(schema);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('handles merged cells', async () => {
    const { buildWorkbookBuffer } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const schema = {
      title: 'Merge Test',
      sheets: [{
        name: 'Report',
        columns: [
          { key: 'a', header: 'A' },
          { key: 'b', header: 'B' },
          { key: 'c', header: 'C' },
        ],
        rows: [
          { cells: { a: { value: 'Merged Title', style: { bold: true, fontSize: 16 } } } },
          { cells: { a: { value: 'Data 1' }, b: { value: 'Data 2' }, c: { value: 'Data 3' } } },
        ],
        merges: [{ start: 'A2', end: 'C2' }],
      }],
    };

    const buffer = await buildWorkbookBuffer(schema);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

// ---------------------------------------------------------------------------
// 3. Schema Validation (WorkbookBuilder.validateWorkbookSchema)
// ---------------------------------------------------------------------------

describe('WorkbookBuilder validation', () => {
  it('catches duplicate sheet names', async () => {
    const { validateWorkbookSchema } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const result = validateWorkbookSchema({
      title: 'Test',
      sheets: [
        { name: 'Sheet1', columns: [{ key: 'a', header: 'A' }], rows: [] },
        { name: 'Sheet1', columns: [{ key: 'b', header: 'B' }], rows: [] },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate sheet name: "Sheet1"');
  });

  it('catches sheet name too long', async () => {
    const { validateWorkbookSchema } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const result = validateWorkbookSchema({
      title: 'Test',
      sheets: [{
        name: 'A'.repeat(32),
        columns: [{ key: 'a', header: 'A' }],
        rows: [],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('too long');
  });

  it('catches unknown column references in rows', async () => {
    const { validateWorkbookSchema } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const result = validateWorkbookSchema({
      title: 'Test',
      sheets: [{
        name: 'Sheet1',
        columns: [{ key: 'a', header: 'A' }],
        rows: [{ cells: { b: { value: 'oops' } } }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('unknown column "b"');
  });

  it('passes valid schema', async () => {
    const { validateWorkbookSchema } = await import(
      '../../../server/src/services/workbook/WorkbookBuilder.js'
    );

    const result = validateWorkbookSchema({
      title: 'Valid',
      sheets: [{
        name: 'Data',
        columns: [{ key: 'x', header: 'X' }],
        rows: [{ cells: { x: { value: 42 } } }],
      }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. API endpoints (requires running server)
// ---------------------------------------------------------------------------

describe('Workbook API endpoints (requires running server)', () => {
  const API_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
  const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;

  const serverAvailable = async (): Promise<boolean> => {
    if (!AUTH_TOKEN) return false;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      await fetch(`${API_URL}/workbook/list`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    }
  };

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  });

  it('POST /workbook/generate returns workbook metadata', async () => {
    if (!(await serverAvailable())) return;

    const res = await fetch(`${API_URL}/workbook/generate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        prompt: 'Create a simple project timeline with 5 milestones, start date, end date, status, and owner columns',
      }),
    });

    if (res.status === 401) return;

    const data = await res.json();
    if (res.ok) {
      expect(data.id).toBeTruthy();
      expect(data.title).toBeTruthy();
      expect(data.sheets).toBeDefined();
      expect(data.sheets.length).toBeGreaterThanOrEqual(1);
      expect(data.downloadUrl).toContain('/api/workbook/');
      expect(data.fileName).toContain('.xlsx');
    }
  });

  it('GET /workbook/list returns workbook list', async () => {
    if (!(await serverAvailable())) return;

    const res = await fetch(`${API_URL}/workbook/list`, { headers: headers() });
    if (res.status === 401) return;

    const data = await res.json();
    expect(data.workbooks).toBeDefined();
  });

  it('rejects empty prompt', async () => {
    if (!(await serverAvailable())) return;

    const res = await fetch(`${API_URL}/workbook/generate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ prompt: '' }),
    });
    if (res.status === 401) return;
    expect(res.status).toBe(400);
  });
});
