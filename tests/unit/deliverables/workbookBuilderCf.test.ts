// @vitest-environment node
/**
 * Unit tests — WorkbookBuilder CF support (X2, W5 / Seria X)
 *
 * KRYTYCZNE: FT-4 demaskuje fasadę. Generujemy .xlsx, parsujemy jako ZIP+XML,
 * asercja że w `xl/worksheets/sheet1.xml` JEST `<conditionalFormatting>`
 * (lub `<x14:conditionalFormatting>` dla iconSet w extended namespace).
 *
 * To jest test "evidence-grade" — nie wystarcza, że builder wywołał exceljs API.
 * Sprawdzamy że w prawdziwym pliku jest CF w XML.
 *
 * FT-1: ≥3 (dataBar, colorScale, iconSet → CF block w sheet XML)
 * FT-4: ≥2 (cell fills color present in styles.xml; cellIs rule w XML)
 * FT-8: ≥1 (workbook bez CF nadal działa, nie psuje istniejących funkcji)
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildWorkbookBuffer } from '../../../server/src/services/workbook/WorkbookBuilder.js';
import type { WorkbookSchema } from '../../../server/src/services/workbook/WorkbookSchema.js';

const BASE_SCHEMA: WorkbookSchema = {
  title: 'X2 CF Test',
  author: 'tests',
  sheets: [
    {
      name: 'Sheet1',
      columns: [
        { key: 'name', header: 'Name', width: 20 },
        { key: 'score', header: 'Score', width: 12, type: 'number' },
      ],
      rows: [
        { cells: { name: { value: 'Alpha' }, score: { value: 10 } } },
        { cells: { name: { value: 'Beta' }, score: { value: 50 } } },
        { cells: { name: { value: 'Gamma' }, score: { value: 90 } } },
      ],
    },
  ],
};

async function extractSheetXml(buf: Buffer, sheetIndex = 1): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file(`xl/worksheets/sheet${sheetIndex}.xml`);
  expect(file).not.toBeNull();
  return await file!.async('string');
}

async function extractStylesXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file('xl/styles.xml');
  expect(file).not.toBeNull();
  return await file!.async('string');
}

describe('WorkbookBuilder CF support (X2)', () => {
  // ──────────────────────────────────────────────────────────────
  // FT-1 — dataBar
  // ──────────────────────────────────────────────────────────────

  it('FT-1/1: dataBar CF rule → produces <conditionalFormatting> block w sheet XML', async () => {
    const schema: WorkbookSchema = {
      ...BASE_SCHEMA,
      sheets: [
        {
          ...BASE_SCHEMA.sheets[0],
          conditionalFormatting: [
            {
              ref: 'B2:B4',
              rules: [{ type: 'dataBar', color: '#16A34A' }],
            },
          ],
        },
      ],
    };

    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: false });
    const xml = await extractSheetXml(buf);

    expect(xml).toContain('conditionalFormatting');
    expect(xml).toContain('B2:B4');
    expect(xml.toLowerCase()).toContain('databar');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — colorScale (2-color + 3-color)
  // ──────────────────────────────────────────────────────────────

  it('FT-1/2: 3-color colorScale → all 3 colors present in CF block', async () => {
    const schema: WorkbookSchema = {
      ...BASE_SCHEMA,
      sheets: [
        {
          ...BASE_SCHEMA.sheets[0],
          conditionalFormatting: [
            {
              ref: 'B2:B4',
              rules: [
                {
                  type: 'colorScale',
                  colors: ['#DC2626', '#F59E0B', '#16A34A'],
                },
              ],
            },
          ],
        },
      ],
    };

    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: false });
    const xml = await extractSheetXml(buf);

    expect(xml).toContain('colorScale');
    // Wszystkie 3 kolory ARGB (FF + hex) — ExcelJS zapisuje w XML jako FF<HEX>
    expect(xml.toUpperCase()).toContain('FFDC2626');
    expect(xml.toUpperCase()).toContain('FFF59E0B');
    expect(xml.toUpperCase()).toContain('FF16A34A');
  });

  it('FT-1/3: 2-color colorScale → 2 cfvo + 2 colors', async () => {
    const schema: WorkbookSchema = {
      ...BASE_SCHEMA,
      sheets: [
        {
          ...BASE_SCHEMA.sheets[0],
          conditionalFormatting: [
            {
              ref: 'B2:B4',
              rules: [{ type: 'colorScale', colors: ['#FFFFFF', '#000000'] }],
            },
          ],
        },
      ],
    };

    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: false });
    const xml = await extractSheetXml(buf);

    expect(xml).toContain('colorScale');
    expect(xml.toUpperCase()).toContain('FFFFFFFF');
    expect(xml.toUpperCase()).toContain('FF000000');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — iconSet
  // ──────────────────────────────────────────────────────────────

  it('FT-1/4: iconSet=3TrafficLights1 → CF block references the icon set', async () => {
    const schema: WorkbookSchema = {
      ...BASE_SCHEMA,
      sheets: [
        {
          ...BASE_SCHEMA.sheets[0],
          conditionalFormatting: [
            {
              ref: 'B2:B4',
              rules: [{ type: 'iconSet', iconSet: '3TrafficLights1' }],
            },
          ],
        },
      ],
    };

    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: false });
    const xml = await extractSheetXml(buf);

    // ExcelJS może serializować iconSet w extLst extension namespace; szukamy po keyword.
    const hasIconSet = xml.includes('iconSet') || xml.includes('3TrafficLights');
    expect(hasIconSet).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // FT-4 — cellIs (klasyczne kolorowanie z warunkiem)
  // ──────────────────────────────────────────────────────────────

  it('FT-4/5: cellIs greaterThan 50 → CF rule + style applied', async () => {
    const schema: WorkbookSchema = {
      ...BASE_SCHEMA,
      sheets: [
        {
          ...BASE_SCHEMA.sheets[0],
          conditionalFormatting: [
            {
              ref: 'B2:B4',
              rules: [
                {
                  type: 'cellIs',
                  operator: 'greaterThan',
                  formulae: ['50'],
                  style: { bgColor: '#16A34A', fontColor: '#FFFFFF', bold: true },
                },
              ],
            },
          ],
        },
      ],
    };

    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: false });
    const xml = await extractSheetXml(buf);

    expect(xml).toContain('cellIs');
    expect(xml).toContain('greaterThan');
    expect(xml).toContain('50');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-4 — KRYTYCZNE: tabela CF + zwykłe fills powinny mieć kolor w styles.xml
  //         (asercja że ExcelJS NIE wyrzuca koloru komórki — to dokładnie
  //         fasada którą demaskujemy)
  // ──────────────────────────────────────────────────────────────

  it('FT-4/6: cell with bgColor → fgColor argb obecny w styles.xml (NIE fasada)', async () => {
    const schema: WorkbookSchema = {
      ...BASE_SCHEMA,
      sheets: [
        {
          name: 'Sheet1',
          columns: [{ key: 'risk', header: 'Risk', width: 20 }],
          rows: [
            {
              cells: {
                risk: {
                  value: 'HIGH',
                  style: { bgColor: '#DC2626', fontColor: '#FFFFFF', bold: true },
                },
              },
            },
          ],
        },
      ],
    };

    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: false });
    const stylesXml = await extractStylesXml(buf);

    // SheetJS dropuje kolory; ExcelJS je zachowuje. Sprawdzamy hex.
    expect(stylesXml.toUpperCase()).toContain('FFDC2626');
    expect(stylesXml.toUpperCase()).toContain('FFFFFFFF');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-8 — workbook bez CF nadal produkuje poprawny .xlsx (regresja)
  // ──────────────────────────────────────────────────────────────

  it('FT-8/7: workbook bez conditionalFormatting → builduje się normalnie', async () => {
    const buf = await buildWorkbookBuffer(BASE_SCHEMA, { applyConsultantStyling: false });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000); // realistic .xlsx size

    // PK magic bytes ZIP
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
