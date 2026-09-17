/**
 * [ODMROZENIE WSPOLNE DEC-461] Warstwa tekstowa PPTX i PDF raportu oceny —
 * asercje wydzielone z `g1.reportLanguage.test.ts` do osobnego pliku, czyli
 * osobnego procesu vitest.
 *
 * ★ POMIAR, KTÓRY WYMUSIŁ TEN PODZIAŁ. `pdf-parse` ciągnie własną, zagnieżdżoną
 * kopię natywnego `@napi-rs/canvas` (0.1.80), a rasteryzator bloku `chart`
 * w `renderDocumentSchemaToDocxBuffer` ładuje kopię aplikacyjną (1.0.9). Dwa
 * fizyczne buildy Skia w jednym procesie Node → SIGSEGV/SIGTRAP przy pierwszym
 * rysowaniu po imporcie `pdf-parse` (zmierzone: bez `pdf-parse` render DOCX
 * daje 226 614 B i RC=0, z importem RC=139; dwa raporty macOS `.ips`
 * z dwoma obrazami `skia.darwin-arm64.node` w `usedImages`). Żaden przełącznik
 * konfiguracji vitest tego nie skleja, bo `pdfjs-dist` woła natywny moduł
 * top-levelowym `createRequire(...)`, poza resolverem Vite.
 *
 * Dlatego: ten plik NIE renderuje DOCX (nie ładuje Skia 1.0.9) i dodatkowo
 * importuje `pdf-parse` leniwie, dopiero po zakończeniu renderów PPTX/PDF.
 * `g1.reportLanguage.test.ts` nie importuje `pdf-parse` wcale.
 *
 * DOWÓD MUTACYJNY: przywrócenie w kompozytorze zaszytego polskiego literału
 * robi te asercje czerwonymi — tak samo, jak przed podziałem pliku.
 */
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';

// Language proof does not depend on the repository's binary font assets.
// Standard PDF fonts keep the real renderer path measurable in source-only clones.
vi.mock('../../../utils/pdfFonts.js', () => ({
  PDF_FONT: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
  },
  registerPdfFonts: (doc: { font(name: string): unknown }) => doc.font('Helvetica'),
}));

import { buildAssessmentDeckModel } from '../assessmentDeckModel.js';
import { renderAssessmentDeckPdf } from '../assessmentDeckPdfRenderer.js';
import { renderAssessmentDeckPptx } from '../assessmentDeckPptxRenderer.js';
import { POLSKIE_DIAKRYTYKI, zFindingami, zOgraniczeniem } from './g1.reportFixture.js';

const ORGANIZATION = 'Northwind Manufacturing Ltd.';

async function tekstSlajdow(pptx: Uint8Array | Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(pptx);
  // Kolejność wpisów w zip nie jest stabilna — sortujemy, żeby złączenie było
  // deterministyczne między przebiegami.
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    .sort((a, b) => {
      const numer = (value: string): number => Number(/slide(\d+)\.xml$/u.exec(value)?.[1] ?? 0);
      return numer(a) - numer(b);
    });
  return (await Promise.all(slideNames.map((name) => zip.file(name)!.async('string')))).join('\n');
}

async function tekstPdf(pdf: Uint8Array | Buffer): Promise<string> {
  // Leniwie i PO renderach: patrz nagłówek pliku (dwie kopie natywnego Skia).
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: pdf });
  try {
    return String((await parser.getText()).text ?? '');
  } finally {
    await parser.destroy();
  }
}

describe('K3 / W73 — warstwa tekstowa PPTX i PDF z findingami jest zgodna z językiem raportu', () => {
  it('PPTX i PDF EN z findingami mają 0 polskich znaków w warstwie tekstowej', async () => {
    const model = buildAssessmentDeckModel(zFindingami('en'), ORGANIZATION);
    const slideXml = await tekstSlajdow(await renderAssessmentDeckPptx(model));
    const pdfText = await tekstPdf(await renderAssessmentDeckPdf(model));

    expect(slideXml).toBeTruthy();
    expect(pdfText).toBeTruthy();
    expect(slideXml.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
    expect(pdfText.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
  });
});

describe('R1 / DEC-461 — warstwa tekstowa PPTX i PDF z ograniczeniem legacy', () => {
  it('PPTX i PDF EN z niepustym limitations mają 0 polskich znaków w warstwie tekstowej', async () => {
    const model = buildAssessmentDeckModel(zOgraniczeniem('en'), ORGANIZATION);
    const slideXml = await tekstSlajdow(await renderAssessmentDeckPptx(model));
    const pdfText = await tekstPdf(await renderAssessmentDeckPdf(model));

    expect(slideXml).toBeTruthy();
    expect(pdfText).toBeTruthy();
    expect(slideXml.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
    expect(pdfText.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
  });
});
