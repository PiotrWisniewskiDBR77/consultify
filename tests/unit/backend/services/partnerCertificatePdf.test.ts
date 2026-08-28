/** @vitest-environment node */

/**
 * Characterization test for generatePartnerCertificatePdf — added as the safety
 * net BEFORE migrating its pdfkit plumbing onto UnifiedExportService.renderPdf.
 * Layout is unchanged by that migration, so this guards "still produces a valid,
 * non-empty PDF without throwing" across EN/PL and certificate types.
 */

import { describe, expect, it } from 'vitest';

import { generatePartnerCertificatePdf } from '../../../../server/src/services/partnerCertificatePdf.js';

const base = {
  certificateId: 'cert-123',
  partnerOrgName: 'Acme Partner Sp. z o.o.',
  userName: 'Jan Kowalski',
  certificateType: 'sales',
  earnedAt: '2026-06-02T00:00:00.000Z',
};

describe('generatePartnerCertificatePdf', () => {
  it('produces a valid non-empty PDF (English)', async () => {
    const buf = await generatePartnerCertificatePdf({ ...base, language: 'en' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('produces a valid PDF (Polish + non-sales type)', async () => {
    const buf = await generatePartnerCertificatePdf({
      ...base,
      certificateType: 'delivery',
      language: 'pl',
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('integration contract: application font renders Polish glyph input into a valid PDF', async () => {
    const buf = await generatePartnerCertificatePdf({
      ...base,
      partnerOrgName: 'Zażółć Gęślą Jaźń Sp. z o.o.',
      userName: 'Łukasz Świątek',
      certificateType: 'delivery',
      language: 'pl',
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
