// @vitest-environment node
/**
 * Unit tests — brandIngestion (F8.1)
 *
 * BI-1: extracts palette + font pair from a real OOXML theme1.xml zip
 * BI-2: fail-soft on garbage / missing theme
 * BI-3: override feeds resolveTheme (brand > theme)
 */

import { describe, expect, it } from 'vitest';
import { extractBrandTheme } from '../../../server/src/services/deliverables/brandIngestion.js';
import { resolveTheme } from '../../../server/src/services/deliverables/themeRegistry.js';

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AcmeBrand">
  <a:themeElements>
    <a:clrScheme name="AcmeColors">
      <a:dk1><a:sysClr val="windowText" lastClr="1A1A1A"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="C8102E"/></a:accent1>
      <a:accent2><a:srgbClr val="00843D"/></a:accent2>
    </a:clrScheme>
    <a:fontScheme name="AcmeFonts">
      <a:majorFont><a:latin typeface="Georgia"/></a:majorFont>
      <a:minorFont><a:latin typeface="Verdana"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;

async function makeOoxml(themeXml: string | null, path = 'ppt/theme/theme1.xml'): Promise<Buffer> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>');
  if (themeXml) zip.file(path, themeXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('brandIngestion', () => {
  it('BI-1.1: extracts palette (accent1→dominant, accent2→accent, dk2→supporting, dk1→neutral)', async () => {
    const buf = await makeOoxml(THEME_XML);
    const brand = await extractBrandTheme(buf);
    expect(brand).not.toBeNull();
    expect(brand!.palette?.dominant).toBe('#C8102E');
    expect(brand!.palette?.accent).toBe('#00843D');
    expect(brand!.palette?.supporting).toBe('#44546A');
    expect(brand!.palette?.neutralText).toBe('#1A1A1A');
  });

  it('BI-1.2: extracts font pair (majorFont→heading, minorFont→body)', async () => {
    const buf = await makeOoxml(THEME_XML);
    const brand = await extractBrandTheme(buf);
    expect(brand!.fontPair?.heading).toBe('Georgia');
    expect(brand!.fontPair?.body).toBe('Verdana');
    expect(brand!.sourceName).toBe('AcmeColors');
  });

  it('BI-1.3: works for word/theme path too', async () => {
    const buf = await makeOoxml(THEME_XML, 'word/theme/theme1.xml');
    const brand = await extractBrandTheme(buf);
    expect(brand!.palette?.dominant).toBe('#C8102E');
  });

  // ── BI-2: fail-soft ──
  it('BI-2.1: garbage buffer → null (no throw)', async () => {
    const brand = await extractBrandTheme(Buffer.from('not a zip at all'));
    expect(brand).toBeNull();
  });

  it('BI-2.2: zip without theme part → null', async () => {
    const buf = await makeOoxml(null);
    expect(await extractBrandTheme(buf)).toBeNull();
  });

  // ── BI-3: integration with resolveTheme (brand overrides theme) ──
  it('BI-3.1: brand override applied on top of base theme via resolveTheme', async () => {
    const buf = await makeOoxml(THEME_XML);
    const brand = await extractBrandTheme(buf);
    const themed = resolveTheme('executive', {
      fontPair: brand!.fontPair,
      palette: brand!.palette,
    });
    // brand wins
    expect(themed.palette.dominant).toBe('#C8102E');
    expect(themed.fontPair.heading).toBe('Georgia');
    // base theme id retained
    expect(themed.id).toBe('executive');
  });
});
