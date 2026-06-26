// @vitest-environment node
/**
 * Unit test — W1.6: brand-ingestion wired into exportBundleFiles.
 * Proves that BrandThemeOverride returned by extractBrandTheme is honoured:
 *  - fontPair override → DOCX schema uses override font (not base theme font)
 *  - palette override → XLSX headerColor uses override colour
 *  - PPTX call receives brandOverride (threaded through deckPlansToPptxBuffer)
 * Strategy: mock renderers to capture what they're called with; real
 * contentToDocumentSchema + resolveTheme run (no mocks on theme layer).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockDocxRender = vi.fn();
const mockBuildWorkbook = vi.fn();
const mockTableToWorkbook = vi.fn();
const mockDeckPptx = vi.fn();
const mockBoardVariant = vi.fn();

vi.mock('../../../server/src/services/documentStudio/documentDocxRenderer.js', () => ({
  renderDocumentSchemaToDocxBuffer: (...a: any[]) => mockDocxRender(...a),
}));
vi.mock('../../../server/src/services/workbook/WorkbookBuilder.js', () => ({
  buildWorkbookBuffer: (...a: any[]) => mockBuildWorkbook(...a),
  tableSchemaToWorkbook: (...a: any[]) => mockTableToWorkbook(...a),
}));
vi.mock('../../../server/src/services/deliverables/bundlePptxRuntime.js', () => ({
  deckPlansToPptxBuffer: (...a: any[]) => mockDeckPptx(...a),
}));
vi.mock('../../../server/src/services/deliverables/deckAudienceVariants.js', () => ({
  buildAudienceVariant: (...a: any[]) => mockBoardVariant(...a),
}));

import { exportBundleFiles } from '../../../server/src/services/deliverables/bundleExportRuntime.js';

const SPINE_STUB = {
  meta: { company: 'AcmeCo', language: 'PL' },
} as any;

const DECK_STUB = {
  plans: [{ slideIndex: 0, layoutIntent: 'cover', title: 'T', keyMessage: 'K' }],
};

function makeBundle(overrides = {}) {
  return {
    spine: SPINE_STUB,
    doc: { sections: [{ heading: 'Intro', blocks: [{ type: 'text', content: { text: 'Hello world.' } }] }] },
    table: { fields: [{ key: 'rok', header: 'Rok', type: 'text' }], seedRows: [] },
    deck: DECK_STUB,
    produced: { doc: true, table: true, deck: true },
    ...overrides,
  } as any;
}

const BRAND_OVERRIDE = {
  fontPair: { heading: 'Georgia', body: 'Calibri' },
  palette: { dominant: '#FF0000' },
};

describe('W1.6 — brand override threaded through exportBundleFiles', () => {
  beforeEach(() => {
    mockDocxRender.mockReset().mockResolvedValue(Buffer.from('docx'));
    mockBuildWorkbook.mockReset().mockResolvedValue(Buffer.from('xlsx'));
    mockTableToWorkbook.mockReset().mockReturnValue({ sheets: [] });
    mockDeckPptx.mockReset().mockResolvedValue(Buffer.from('pptx'));
    mockBoardVariant.mockReset().mockReturnValue({ plans: DECK_STUB.plans, droppedSlideIndices: [] });
  });

  it('bez brand override: DOCX używa domyślnego fontu motywu (Merriweather/Inter)', async () => {
    await exportBundleFiles(makeBundle(), 'executive');
    const schema = mockDocxRender.mock.calls[0][0];
    expect(schema.formattingSchema.fonts.heading).toBe('Merriweather');
    expect(schema.formattingSchema.fonts.body).toBe('Inter');
  });

  it('z brand override: DOCX schema fonts = override (Georgia/Calibri)', async () => {
    await exportBundleFiles(makeBundle(), 'executive', BRAND_OVERRIDE);
    const schema = mockDocxRender.mock.calls[0][0];
    expect(schema.formattingSchema.fonts.heading).toBe('Georgia');
    expect(schema.formattingSchema.fonts.body).toBe('Calibri');
  });

  it('z brand override: XLSX headerColor = override dominant (#FF0000)', async () => {
    await exportBundleFiles(makeBundle(), 'executive', BRAND_OVERRIDE);
    const [, opts] = mockTableToWorkbook.mock.calls[0];
    expect(opts.headerColor).toBe('#FF0000');
  });

  it('z brand override: deckPlansToPptxBuffer otrzymuje brandOverride', async () => {
    await exportBundleFiles(makeBundle(), 'executive', BRAND_OVERRIDE);
    const [, opts] = mockDeckPptx.mock.calls[0];
    expect(opts.brandOverride).toEqual(BRAND_OVERRIDE);
  });

  it('bez brand override: deckPlansToPptxBuffer.opts.brandOverride = undefined', async () => {
    await exportBundleFiles(makeBundle(), 'executive');
    const [, opts] = mockDeckPptx.mock.calls[0];
    expect(opts.brandOverride).toBeUndefined();
  });
});
