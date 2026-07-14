/**
 * brandIngestion (F8.1) — wyciągnij motyw klienta z .pptx/.docx (OOXML).
 *
 * Klient wrzuca swoją prezentację/dokument → czytamy `theme1.xml` (paleta +
 * para fontów) i zwracamy override, którym brand klienta NADPISUJE nasz motyw
 * (DELIVERABLE_FORMATTING_SPEC §6/§80: brand > motyw > default). Klon layoutu = v2.
 *
 * OOXML: plik = zip; motyw w `ppt/theme/theme1.xml` (pptx) lub
 * `word/theme/theme1.xml` (docx). clrScheme = kolory (accent1.. dk1..),
 * fontScheme = majorFont (nagłówki) / minorFont (treść).
 *
 * SAFETY: fail-soft — uszkodzony/nietypowy plik → null (caller zostaje przy
 * naszym motywie). Nigdy nie rzuca.
 */

import logger from '../../utils/Logger.js';
import type { ThemeFontPair, ThemePalette } from './themeRegistry.js';

const LOG = '[brandIngestion]';

export interface BrandThemeOverride {
  fontPair?: Partial<ThemeFontPair>;
  palette?: Partial<ThemePalette>;
  /** Nazwa motywu z pliku (clrScheme/fontScheme @name) — do UI/etykiety. */
  sourceName?: string;
}

function toHex(v?: string): string | undefined {
  if (!v) return undefined;
  const clean = v.replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(clean) ? `#${clean}` : undefined;
}

// Wyciągnij kolor z węzła clrScheme (srgbClr @val LUB sysClr @lastClr).
function colorFromNode(node: any): string | undefined {
  if (!node) return undefined;
  const srgb = node['a:srgbClr'];
  if (srgb && (srgb['@_val'] || srgb.val)) return toHex(srgb['@_val'] ?? srgb.val);
  const sys = node['a:sysClr'];
  if (sys && (sys['@_lastClr'] || sys.lastClr)) return toHex(sys['@_lastClr'] ?? sys.lastClr);
  return undefined;
}

// Wyciągnij font z węzła majorFont/minorFont (a:latin @typeface).
function fontFromNode(node: any): string | undefined {
  const latin = node?.['a:latin'];
  const tf = latin?.['@_typeface'] ?? latin?.typeface;
  return typeof tf === 'string' && tf.trim().length > 0 ? tf.trim() : undefined;
}

/** Zlokalizuj theme1.xml w rozpakowanym zipie (pptx/docx/xlsx). */
function findThemePath(fileNames: string[]): string | undefined {
  const prefs = ['ppt/theme/theme1.xml', 'word/theme/theme1.xml', 'xl/theme/theme1.xml'];
  for (const p of prefs) if (fileNames.includes(p)) return p;
  // dowolny theme*.xml jako fallback
  return fileNames.find((n) => /(^|\/)theme\/theme\d*\.xml$/i.test(n));
}

/**
 * Wyciągnij brand-override z bufora .pptx/.docx/.xlsx. Zwraca palette+fontPair
 * (częściowe — tylko pola, które udało się sparsować) lub null (fail-soft).
 */
export async function extractBrandTheme(buffer: Buffer): Promise<BrandThemeOverride | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    const themePath = findThemePath(names);
    if (!themePath) {
      logger.info(`${LOG} no theme part found`);
      return null;
    }

    const xml = await zip.files[themePath].async('string');
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const doc = parser.parse(xml);

    const themeElements =
      doc?.['a:theme']?.['a:themeElements'] ?? doc?.theme?.themeElements ?? null;
    if (!themeElements) return null;

    const clr = themeElements['a:clrScheme'] ?? themeElements.clrScheme;
    const fonts = themeElements['a:fontScheme'] ?? themeElements.fontScheme;

    const palette: Partial<ThemePalette> = {};
    if (clr) {
      const dominant = colorFromNode(clr['a:accent1']) ?? colorFromNode(clr['a:dk2']);
      const accent = colorFromNode(clr['a:accent2']) ?? colorFromNode(clr['a:accent1']);
      const supporting = colorFromNode(clr['a:dk2']) ?? colorFromNode(clr['a:lt2']);
      const neutralText = colorFromNode(clr['a:dk1']);
      if (dominant) palette.dominant = dominant;
      if (accent) palette.accent = accent;
      if (supporting) palette.supporting = supporting;
      if (neutralText) palette.neutralText = neutralText;
    }

    const fontPair: Partial<ThemeFontPair> = {};
    if (fonts) {
      const heading = fontFromNode(fonts['a:majorFont']);
      const body = fontFromNode(fonts['a:minorFont']);
      if (heading) fontPair.heading = heading;
      if (body) fontPair.body = body;
    }

    const sourceName: string | undefined = clr?.['@_name'] ?? fonts?.['@_name'] ?? undefined;

    if (Object.keys(palette).length === 0 && Object.keys(fontPair).length === 0) {
      logger.info(`${LOG} theme part present but no usable colors/fonts`);
      return null;
    }

    const result: BrandThemeOverride = {};
    if (Object.keys(palette).length) result.palette = palette;
    if (Object.keys(fontPair).length) result.fontPair = fontPair;
    if (sourceName) result.sourceName = sourceName;

    logger.info(
      `${LOG} extracted brand theme: colors=${Object.keys(palette).length} fonts=${Object.keys(fontPair).length}`
    );
    return result;
  } catch (err) {
    logger.warn(`${LOG} extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
