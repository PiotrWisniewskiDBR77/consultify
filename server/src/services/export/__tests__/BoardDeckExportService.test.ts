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
