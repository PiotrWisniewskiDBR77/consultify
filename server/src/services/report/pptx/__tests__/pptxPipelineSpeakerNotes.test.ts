import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxPipelineService } from '../PptxPipelineService.js';

describe('PptxPipelineService speaker-note provenance', () => {
  it('writes claim-level source notes into the exported PPTX', async () => {
    const result = await new PptxPipelineService().generateFromUnifiedJson(
      {
        meta: {
          client: 'Board',
          project: 'Strict provenance',
          date: '2026-08-12',
          author: 'Consultify',
          confidentiality: 'internal',
          language: 'en',
          template: 'modern',
        },
        slides: [
          {
            intent: 'key_messages',
            key_message: 'Evidence baseline',
            content: {
              type: 'key_messages',
              messages: [
                { title: 'Observed baseline', description: 'Current conversion is 2.4%.' },
              ],
            },
            speaker_notes:
              '[Sources]\n- CRM conversion baseline (kpi_roi; SRC-CRM-BASELINE-2026Q2-v1; version v1; snapshot snap-SRC-CRM-BASELINE-2026Q2-v1)\n[/Sources]',
          } as any,
        ],
      },
      { addClosingSlide: false }
    );

    const zip = await JSZip.loadAsync(result.buffer);
    const notes = await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');
    expect(notes).toContain('CRM conversion baseline');
    expect(notes).toContain('SRC-CRM-BASELINE-2026Q2-v1');
    expect(notes).toContain('version v1');
    expect(notes).toContain('snap-SRC-CRM-BASELINE-2026Q2-v1');
  });

  it('exports ordered semantic object names and decorative OOXML metadata', async () => {
    const result = await new PptxPipelineService().generateFromUnifiedJson(
      {
        meta: {
          client: 'Board',
          project: 'Accessible deck',
          date: '2026-08-12',
          author: 'Consultify',
          confidentiality: 'internal',
          language: 'en',
          template: 'modern',
        },
        slides: [
          {
            intent: 'performance_overview',
            key_message: 'Evidence baseline',
            content: {
              type: 'performance_overview',
              kpis: [{ name: 'Current conversion', value: '2.4%' }],
              context: 'Observed baseline only.',
            },
          } as any,
        ],
      },
      { addClosingSlide: false }
    );
    const zip = await JSZip.loadAsync(result.buffer);
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(slide).toMatch(/name="\d{2} Text: Evidence baseline"/);
    expect(slide).toContain('Text: Current conversion');
    expect(slide).toContain('adec:decorative');
  });
});
