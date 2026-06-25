// @vitest-environment node
/**
 * Unit tests — theme → renderer wiring (F3.1 "→ 4 renderery")
 *
 * TRW-1: contentToDocumentSchema sets formattingSchema.fonts from theme
 * TRW-2: tableSchemaToWorkbook applies theme dominant as header bgColor
 */

import { describe, expect, it } from 'vitest';
import { contentToDocumentSchema } from '../../../server/src/services/deliverables/bundleExportRuntime.js';
import { tableSchemaToWorkbook } from '../../../server/src/services/workbook/WorkbookBuilder.js';
import { resolveTheme } from '../../../server/src/services/deliverables/themeRegistry.js';

const SPINE_STUB: any = {
  meta: { company: 'Acme', language: 'PL' },
};

const CONTENT_STUB: any = {
  sections: [
    { heading: 'Executive Summary', blocks: [{ type: 'text', content: 'Body text here' }] },
  ],
};

// ── TRW-1: DOCX fonts from theme ───────────────────────────────────────────

describe('theme → DOCX wiring', () => {
  it('TRW-1.1: default (no themeId) → executive fonts', () => {
    const schema = contentToDocumentSchema(CONTENT_STUB, SPINE_STUB);
    const exec = resolveTheme('executive');
    expect(schema.formattingSchema.fonts.heading).toBe(exec.fontPair.heading);
    expect(schema.formattingSchema.fonts.body).toBe(exec.fontPair.body);
  });

  it('TRW-1.2: themeId="modern" → Inter/Inter in formattingSchema', () => {
    const schema = contentToDocumentSchema(CONTENT_STUB, SPINE_STUB, 'modern');
    expect(schema.formattingSchema.fonts.heading).toBe('Inter');
    expect(schema.formattingSchema.fonts.body).toBe('Inter');
  });

  it('TRW-1.3: unknown themeId → falls back to executive fonts', () => {
    const schema = contentToDocumentSchema(CONTENT_STUB, SPINE_STUB, 'bogus');
    const exec = resolveTheme('executive');
    expect(schema.formattingSchema.fonts.heading).toBe(exec.fontPair.heading);
  });
});

// ── TRW-2: XLSX header tint from theme ─────────────────────────────────────

describe('theme → XLSX wiring', () => {
  const tableStub: any = {
    fields: [
      { key: 'name', header: 'Name', type: 'singleLineText' },
      { key: 'value', header: 'Value', type: 'currency' },
    ],
    seedRows: [{ name: 'Row 1', value: 100 }],
  };

  it('TRW-2.1: headerColor applied as 6-char hex (strips #)', () => {
    const modern = resolveTheme('modern');
    const wb = tableSchemaToWorkbook(tableStub, { title: 'T', headerColor: modern.palette.dominant });
    const header = wb.sheets[0].headerStyle;
    // modern dominant '#4338CA' → '4338CA'
    expect(header?.bgColor).toBe(modern.palette.dominant.replace('#', '').toUpperCase());
  });

  it('TRW-2.2: no headerColor → default 4472C4 preserved', () => {
    const wb = tableSchemaToWorkbook(tableStub, { title: 'T' });
    expect(wb.sheets[0].headerStyle?.bgColor).toBe('4472C4');
  });

  it('TRW-2.3: invalid headerColor → default fallback', () => {
    const wb = tableSchemaToWorkbook(tableStub, { title: 'T', headerColor: 'not-a-hex' });
    expect(wb.sheets[0].headerStyle?.bgColor).toBe('4472C4');
  });
});
