#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname);
const reference = resolve(root, '../EXPORT_1_KROK0_20260916/pliki-makieta/deck-board.pptx');
const actual = resolve(root, 'dowody/northwind-board-deck.pptx');

function list(file) {
  return spawnSync('/usr/bin/unzip', ['-Z1', file], { encoding: 'utf8' }).stdout.trim().split('\n');
}

function text(file, entry) {
  return spawnSync('/usr/bin/unzip', ['-p', file, entry], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).stdout;
}

function framePosition(xml, kind) {
  const blocks = [...xml.matchAll(/<p:graphicFrame>.*?<\/p:graphicFrame>/gs)].map(
    (match) => match[0]
  );
  const block = blocks.find((candidate) =>
    kind === 'table' ? candidate.includes('<a:tbl>') : candidate.includes('<c:chart')
  );
  if (!block) return null;
  const offset = block.match(/<a:off x="(\d+)" y="(\d+)"/);
  return offset ? { x: Number(offset[1]), y: Number(offset[2]) } : null;
}

function textPosition(xml, label) {
  const block = [...xml.matchAll(/<p:sp>.*?<\/p:sp>/gs)]
    .map((match) => match[0])
    .find((candidate) => candidate.includes(label));
  if (!block) return null;
  const offset = block.match(/<a:off x="(\d+)" y="(\d+)"/);
  return offset ? { x: Number(offset[1]), y: Number(offset[2]) } : null;
}

function normalized(position, slideSize) {
  return position ? { x: position.x / slideSize.cx, y: position.y / slideSize.cy } : null;
}

function inspect(file) {
  const entries = list(file);
  const slides = entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const slideXml = slides.map((name) => text(file, name)).join('\n');
  const allXml = entries
    .filter((name) => name.endsWith('.xml'))
    .map((name) => text(file, name))
    .join('\n');
  const theme = text(file, 'ppt/theme/theme1.xml');
  const presentation = text(file, 'ppt/presentation.xml');
  const sizeMatch = presentation.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const slideSize = { cx: Number(sizeMatch?.[1]), cy: Number(sizeMatch?.[2]) };
  const slideSix = slides[5] ? text(file, slides[5]) : '';
  const slideFour = slides[3] ? text(file, slides[3]) : '';
  const slideSeven = slides[6] ? text(file, slides[6]) : '';
  const slideEight = slides[7] ? text(file, slides[7]) : '';
  const chartXml = entries
    .filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))
    .map((name) => text(file, name))
    .join('\n');
  const tableRowHeights = [...slideSix.matchAll(/<a:tr h="(\d+)"/g)].map((match) =>
    Number(match[1])
  );
  const colors = [...slideXml.matchAll(/srgbClr val="([A-Fa-f0-9]{6})"/g)].map((match) =>
    match[1].toUpperCase()
  );
  const colorCounts = Object.fromEntries(
    [...new Set(colors)]
      .map((color) => [color, colors.filter((candidate) => candidate === color).length])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  );
  return {
    bytes: readFileSync(file).length,
    slides: slides.length,
    layouts: entries.filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).length,
    masters: entries.filter((name) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)).length,
    charts: entries.filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)).length,
    tables: (slideXml.match(/<a:tbl>/g) || []).length,
    themeAptos: /Aptos/.test(theme),
    literalFonts: [
      ...new Set([...allXml.matchAll(/typeface="([^"]+)"/g)].map((match) => match[1])),
    ],
    literalArialHits: (allXml.match(/typeface="Arial"/gi) || []).length,
    coBranding: {
      consultify: /Consultify/i.test(allXml),
      dbr77: /DBR77/i.test(allXml),
      client: /Northwind Manufacturing Ltd\./i.test(allXml),
    },
    brandCrimsonHits: (allXml.match(/85182F/gi) || []).length,
    composition: {
      tableRows: tableRowHeights.length,
      tableRowHeightVariants: new Set(tableRowHeights).size,
      tableMaxRowHeight: tableRowHeights.length ? Math.max(...tableRowHeights) : null,
      chartSeries: (chartXml.match(/<c:ser>/g) || []).length,
      chartShowsValues: /<c:showVal val="1"\/>/.test(chartXml),
      chartDecimalLabels: /formatCode="0\.0"/.test(chartXml),
      contentBlueSquares: (slideFour.match(/2563EB/g) || []).length >= 4,
      tableRightAlignedNumbers: /<a:pPr[^>]*algn="r"/.test(slideSix),
      tableKeepsOneDecimal: slideSix.includes('1.0'),
      chartTargetLatest: slideSeven.includes('TARGET') && slideSeven.includes('LATEST'),
      decisionFields: ['DECISION OWNER', 'DUE BY', 'LINKED RAID'].filter((label) =>
        slideEight.includes(label)
      ),
      decisionOptionMeta: slideEight.includes('£410k · MES Line 3'),
      decisionRecommendedFill: slideEight.includes('DCE6FA'),
      positions: {
        table: normalized(framePosition(slideSix, 'table'), slideSize),
        chart: normalized(
          framePosition(slides[6] ? text(file, slides[6]) : '', 'chart'),
          slideSize
        ),
        decisionOwner: normalized(textPosition(slideEight, 'DECISION OWNER'), slideSize),
        dueBy: normalized(textPosition(slideEight, 'DUE BY'), slideSize),
        linkedRaid: normalized(textPosition(slideEight, 'LINKED RAID'), slideSize),
      },
    },
    dominantColors: colorCounts,
  };
}

const expectedRoles = [
  'cover',
  'agenda',
  'section',
  'content-one',
  'content-two',
  'table',
  'chart',
  'decision',
];
const referenceInfo = inspect(reference);
const actualInfo = inspect(actual);
const positionTolerance = 0.05;
const positionKeys = ['table', 'chart', 'decisionOwner', 'dueBy', 'linkedRaid'];
const positionsWithinTolerance = positionKeys.every((key) => {
  const expected = referenceInfo.composition.positions[key];
  const received = actualInfo.composition.positions[key];
  return (
    expected &&
    received &&
    Math.abs(expected.x - received.x) <= positionTolerance &&
    Math.abs(expected.y - received.y) <= positionTolerance
  );
});
const checks = {
  slideCount:
    actualInfo.slides === referenceInfo.slides && actualInfo.slides === expectedRoles.length,
  packageLayouts: actualInfo.layouts === referenceInfo.layouts,
  packageMasters: actualInfo.masters === referenceInfo.masters,
  nativeChartCount: actualInfo.charts === referenceInfo.charts,
  nativeTableCount: actualInfo.tables === referenceInfo.tables,
  approvedPalette: ['1B2A41', '101828', '2563EB', '667085', 'D8DEE8', 'F1F4F8'].every(
    (color) => color in actualInfo.dominantColors
  ),
  aptosTheme: actualInfo.themeAptos,
  zeroLiteralArial: actualInfo.literalArialHits === 0,
  coBranding: Object.values(actualInfo.coBranding).every(Boolean),
  zeroBrandCrimson: actualInfo.brandCrimsonHits === 0,
  tableComposition:
    actualInfo.composition.tableRows === 7 &&
    actualInfo.composition.tableRowHeightVariants > 1 &&
    actualInfo.composition.tableMaxRowHeight < 914400,
  chartComposition:
    actualInfo.composition.chartSeries === 2 &&
    actualInfo.composition.chartShowsValues &&
    actualInfo.composition.chartDecimalLabels &&
    actualInfo.composition.chartTargetLatest,
  contentComposition: actualInfo.composition.contentBlueSquares,
  tableNumberFormatting:
    actualInfo.composition.tableRightAlignedNumbers && actualInfo.composition.tableKeepsOneDecimal,
  decisionComposition:
    actualInfo.composition.decisionFields.length === 3 &&
    actualInfo.composition.decisionOptionMeta &&
    actualInfo.composition.decisionRecommendedFill,
  normalizedKeyPositionsWithinTolerance: positionsWithinTolerance,
};

const result = {
  generatedAt: new Date().toISOString(),
  expectedRoles,
  reference: referenceInfo,
  actual: actualInfo,
  checks,
  positionTolerance,
  status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
  note: 'The reference uses literal Arial. W118 supersedes that font mechanism: the implementation uses Aptos in the PPTX theme and has zero literal Arial in all PPTX XML, including charts and masters; renderer substitution is evidenced separately on a machine without Aptos.',
};

writeFileSync(resolve(root, 'dowody/parity.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
