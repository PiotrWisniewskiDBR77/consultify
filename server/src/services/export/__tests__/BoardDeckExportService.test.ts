/** @vitest-environment node */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { generatePartnerToolkitResourceFile } from '../../partnerToolkitResources.js';
import { boardDeckExportService } from '../BoardDeckExportService.js';

async function inspectPptx(buffer: Buffer): Promise<{ names: string[]; xml: string }> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const xml = (
    await Promise.all(
      names.filter((name) => name.endsWith('.xml')).map((name) => zip.file(name)!.async('string'))
    )
  ).join('\n');
  return { names, xml };
}

describe('BoardDeckExportService production callers', () => {
  it('projects Deck Builder cards onto the approved board-deck family', async () => {
    const result = await inspectPptx(
      await boardDeckExportService.exportPresentationDeck({
        deck: {
          title: 'Q3 Steering Deck',
          organization_id: 'Northwind Manufacturing Ltd.',
          meta: { language: 'en', confidentiality: 'Internal' },
          lifecycle: { updatedAt: '2026-09-16T13:00:00.000Z' },
          cards: [
            {
              intent: 'cover',
              title: 'Q3 Steering Deck',
              key_message: 'A board-ready decision brief',
              blocks: [],
            },
            {
              intent: 'key_messages',
              title: 'What changed',
              key_message: 'Lead time improved while quality held.',
              blocks: [{ type: 'text', content: { body: 'Cycle time fell by 18%.' } }],
              source_refs: [{ artifact_name: 'Operations review' }],
            },
          ],
        },
      })
    );

    expect(result.names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))).toHaveLength(
      2
    );
    expect(result.xml).toContain('Q3 Steering Deck');
    expect(result.xml).toContain('Cycle time fell by 18%.');
    expect(result.xml).toContain('Operations review');
    expect(result.xml).not.toMatch(/typeface="Arial"/i);
  });

  it('projects Work Canvas sections onto the approved board-deck family', async () => {
    const result = await inspectPptx(
      await boardDeckExportService.exportCanvasDeck({
        title: 'Transformation brief',
        organizationName: 'Northwind Manufacturing Ltd.',
        sourceId: 'canvas-1',
        lifecycle: 'approved',
        updatedAt: '2026-09-16T12:00:00.000Z',
        sections: [
          { title: 'Current position', body: 'The evidence shows a shared data gap.' },
          { title: 'Next decision', body: 'The board needs to sequence the work.' },
        ],
      })
    );

    expect(result.names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))).toHaveLength(
      4
    );
    expect(result.xml).toContain('WORK CANVAS');
    expect(result.xml).toContain('Work Canvas canvas-1');
    expect(result.xml).toContain('Northwind Manufacturing Ltd.');
    expect(result.xml).not.toContain('85182F');
    expect(result.xml).not.toMatch(/typeface="Arial"/i);
  });

  it('preserves every Work Canvas section beyond the eight-role layout family', async () => {
    const sections = Array.from({ length: 9 }, (_, index) => ({
      title: `Section ${index + 1}`,
      body: `Body ${index + 1}`,
    }));
    const result = await inspectPptx(
      await boardDeckExportService.exportCanvasDeck({
        title: 'Nine-section canvas',
        organizationName: 'Northwind Manufacturing Ltd.',
        sourceId: 'canvas-nine',
        lifecycle: 'approved',
        updatedAt: '2026-09-16T12:00:00.000Z',
        sections,
      })
    );

    expect(result.names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))).toHaveLength(
      11
    );
    sections.forEach((section) => expect(result.xml).toContain(section.title));
  });

  it('routes the generated partner sales deck through the same family', async () => {
    const file = await generatePartnerToolkitResourceFile({
      fileKey: 'generated:sales_deck',
      language: 'en',
    });
    const result = await inspectPptx(file.buffer);

    expect(file.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(result.names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))).toHaveLength(
      2
    );
    expect(result.xml).toContain('PARTNER MATERIAL');
    expect(result.xml).toContain('What is Consultify?');
    expect(result.xml).not.toContain('4F46E5');
    expect(result.xml).not.toMatch(/typeface="Arial"/i);
  });
});
