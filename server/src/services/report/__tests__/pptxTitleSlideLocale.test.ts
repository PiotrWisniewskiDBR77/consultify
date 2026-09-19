/** @vitest-environment node */

/**
 * D-46 — the locale that reaches the deck renderer is what the client sees.
 *
 * WHY THIS SUITE EXISTS: the route-level test asserts the ARGUMENT
 * (`options.language`) handed to the renderer. That assertion is only worth
 * something if the argument actually changes the bytes, so this suite renders a
 * real deck and reads the title slide out of the OOXML: same report, same
 * `createdAt`, English month name for `language: 'en'` and the Polish one for
 * `language: 'pl'`. This is the measured defect of D-46 — the English Northwind
 * report carried "16 września 2026" on slide 1.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxExportService, type ReportData } from '../PptxExportService.js';

const report: ReportData = {
  id: 'rb-1',
  name: 'Operational maturity review',
  sourceType: 'ASSESSMENT',
  organizationName: 'Northwind Manufacturing Ltd.',
  createdAt: '2026-09-16T12:00:00.000Z',
  sections: [
    { key: 'summary', title: 'Executive summary', type: 'text', content: 'Baseline confirmed.' },
  ],
};

async function titleSlideXml(language: 'en' | 'pl'): Promise<string> {
  const buffer = await new PptxExportService().generatePresentation(report, {
    language,
    includeCharts: false,
    includeToc: false,
  });
  const zip = await JSZip.loadAsync(buffer as unknown as Buffer);
  return (await zip.file('ppt/slides/slide1.xml')?.async('string')) || '';
}

describe('PptxExportService title-slide date locale', () => {
  it('writes the English date when the export resolved to English', async () => {
    const xml = await titleSlideXml('en');
    expect(xml).toContain('September');
    expect(xml).not.toContain('września');
  });

  it('writes the Polish date when the export resolved to Polish', async () => {
    const xml = await titleSlideXml('pl');
    expect(xml).toContain('września');
    expect(xml).not.toContain('September');
  });
});
