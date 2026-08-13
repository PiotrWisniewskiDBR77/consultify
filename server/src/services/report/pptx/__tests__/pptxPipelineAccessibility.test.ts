import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxPipelineService } from '../PptxPipelineService.js';
import type { UnifiedReportJSON } from '../types.js';

describe('PptxPipelineService accessibility OOXML', () => {
  it('names semantic objects in reading order and marks empty layout shapes decorative', async () => {
    const report: UnifiedReportJSON = {
      meta: {
        client: 'North Region',
        project: 'CRM decision',
        date: '2026-08-12',
        author: 'Consultify',
        confidentiality: 'internal',
        language: 'en',
      },
      slides: [
        {
          intent: 'key_messages',
          key_message: 'Validate the baseline before approval',
          content: {
            type: 'key_messages',
            messages: [
              { title: 'Decision gate', description: 'Validate the CRM baseline.' },
              { title: 'Owner', description: 'Sales Ops.' },
            ],
          },
        },
      ],
    };

    const result = await new PptxPipelineService().generateFromUnifiedJson(report, {
      addClosingSlide: false,
      skipValidation: true,
    });
    const zip = await JSZip.loadAsync(result.buffer);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) || '';
    const names = [
      ...xml.matchAll(/<p:cNvPr[^>]*\bname="(\d+ (?:Text|Table|Chart|Image):[^"]+)"/g),
    ].map((match) => match[1]);
    const ordinals = names.map((name) => Number(name.slice(0, 2)));

    expect(names.length).toBeGreaterThan(2);
    expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
    expect(new Set(ordinals).size).toBe(ordinals.length);
    expect(xml).toContain('Text: Decision gate');
    expect(xml).toContain('<adec:decorative');
    expect(xml).toContain('val="1"');
    expect(xml).not.toContain('descr="Slide content"');
  });
});
