/**
 * Characterization test for partnerToolkitResources PDF generation — added as
 * the safety net BEFORE delegating its local renderPdfToBuffer helper to the
 * shared UnifiedExportService.renderPdf primitive. Layout is unchanged; this
 * guards "still produces a valid PDF resource" across the inline PDF fileKeys.
 */

import { describe, expect, it } from 'vitest';

import { generatePartnerToolkitResourceFile } from '../../../../server/src/services/partnerToolkitResources.js';

describe('generatePartnerToolkitResourceFile (PDF path)', () => {
  it('generates a valid one-pager PDF (English)', async () => {
    const res = await generatePartnerToolkitResourceFile({
      fileKey: 'generated:one_pager',
      language: 'en',
    });
    expect(res.mimeType).toBe('application/pdf');
    expect(Buffer.isBuffer(res.buffer)).toBe(true);
    expect(res.buffer.length).toBeGreaterThan(500);
    expect(res.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(res.fileName).toMatch(/\.pdf$/i);
  });

  it('generates a valid discovery-script PDF (Polish)', async () => {
    const res = await generatePartnerToolkitResourceFile({
      fileKey: 'generated:discovery_script',
      language: 'pl',
    });
    expect(res.mimeType).toBe('application/pdf');
    expect(res.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('generates a valid sales-deck PPTX (zip)', async () => {
    const res = await generatePartnerToolkitResourceFile({
      fileKey: 'generated:sales_deck',
      language: 'en',
    });
    expect(res.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(res.buffer.length).toBeGreaterThan(500);
    // OpenXML (pptx) is a zip — starts with "PK".
    expect(res.buffer[0]).toBe(0x50);
    expect(res.buffer[1]).toBe(0x4b);
  });
});
