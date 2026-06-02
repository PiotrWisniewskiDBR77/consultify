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
});
