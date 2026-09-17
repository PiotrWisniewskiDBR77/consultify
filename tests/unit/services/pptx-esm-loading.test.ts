import { describe, expect, it } from 'vitest';

describe('PPTX services in the Node ESM runtime', () => {
  it('loads the legacy report exporter without a global require', async () => {
    const module = await import('../../../server/src/services/report/PptxExportService.js');
    const service = new module.PptxExportService();
    const buffer = await service.generatePresentation(
      {
        id: 'report-1',
        name: 'Northwind — Review',
        sourceType: 'ASSESSMENT',
        createdAt: '2026-09-17T00:00:00.000Z',
        sections: [],
      },
      { includeToc: false, includeCharts: false, language: 'en' }
    );

    expect(module.PptxExportService).toBeTypeOf('function');
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('loads the assessment deck exporter without a global require', async () => {
    const module = await import('../../../server/src/services/assessmentDeckService.js');

    expect(module.generateAssessmentDeck).toBeTypeOf('function');
  });
});
