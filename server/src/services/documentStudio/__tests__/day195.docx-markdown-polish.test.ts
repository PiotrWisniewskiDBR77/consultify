import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

const schema: DocumentSchema = {
  documentId: 'day195-render',
  artifactId: 'day195-render',
  title: 'Raport dla zarządu',
  documentType: 'board_report',
  language: 'pl',
  audience: ['Zarząd'],
  goal: 'inform',
  communicationRegister: 'executive',
  density: 'comprehensive',
  languageStyle: 'consulting',
  confidentiality: 'internal',
  formattingSchema: {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 's1',
      orderIndex: 0,
      level: 1,
      title: 'Rekomendacje',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'p1',
          type: 'paragraph',
          content: { text: '**Priorytet:** uruchomić pilotaż.\n- Potwierdzić właściciela\n- Zamknąć ryzyka' },
          isAssumption: true,
        },
      ],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
};

describe('Day 195 DOCX markdown and Polish labels', () => {
  it('renders bold, real list numbering, Polish cover labels and Polish assumption marker', async () => {
    const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(schema));
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:numPr>');
    expect(xml).not.toContain('**');
    expect(xml).not.toContain('- Potwierdzić');
    expect(xml).toContain('raport dla zarządu');
    expect(xml).toContain('kompleksowy');
    expect(xml).toContain('[Założenie — wymaga źródła]');
  });
});
