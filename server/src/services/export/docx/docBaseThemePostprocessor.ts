import JSZip from 'jszip';

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Consultify DOC-BASE">
  <a:themeElements>
    <a:clrScheme name="Consultify"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0C447C"/></a:dk2><a:lt2><a:srgbClr val="F3F7FB"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="1D9E75"/></a:accent2><a:accent3><a:srgbClr val="46556B"/></a:accent3><a:accent4><a:srgbClr val="667085"/></a:accent4><a:accent5><a:srgbClr val="D8DEE8"/></a:accent5><a:accent6><a:srgbClr val="DBE7FF"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Consultify Aptos"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Consultify">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

export async function applyDocBaseThemeContract(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const stylesFile = zip.file('word/styles.xml');
  const fontTableFile = zip.file('word/fontTable.xml');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!stylesFile || !fontTableFile || !relsFile || !contentTypesFile) {
    throw new Error('DOC_BASE_OOXML_PARTS_MISSING');
  }

  const styles = await stylesFile.async('string');
  const themedStyles = styles.replace(
    /<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts\b[^>]*\/>/,
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/>'
  );
  if (themedStyles === styles) throw new Error('DOC_BASE_STYLE_DEFAULTS_MISSING');
  zip.file('word/styles.xml', themedStyles);

  let fontTable = await fontTableFile.async('string');
  const fonts =
    '<w:font w:name="Aptos"><w:altName w:val="Arial"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>' +
    '<w:font w:name="Aptos Display"><w:altName w:val="Arial"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>';
  const themedFontTable = fontTable.replace(/<w:fonts([^>]*)\/>/, `<w:fonts$1>${fonts}</w:fonts>`);
  if (themedFontTable === fontTable) throw new Error('DOC_BASE_FONT_TABLE_ROOT_INVALID');
  fontTable = themedFontTable;
  zip.file('word/fontTable.xml', fontTable);

  zip.file('word/theme/theme1.xml', THEME_XML);

  let rels = await relsFile.async('string');
  if (!rels.includes('relationships/theme')) {
    rels = rels.replace(
      '</Relationships>',
      '<Relationship Id="rIdDocBaseTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>'
    );
  }
  zip.file('word/_rels/document.xml.rels', rels);

  let contentTypes = await contentTypesFile.async('string');
  if (!contentTypes.includes('/word/theme/theme1.xml')) {
    contentTypes = contentTypes.replace(
      '</Types>',
      '<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>'
    );
  }
  zip.file('[Content_Types].xml', contentTypes);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
