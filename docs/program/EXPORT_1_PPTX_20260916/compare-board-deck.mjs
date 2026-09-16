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
  return spawnSync('/usr/bin/unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).stdout;
}

function inspect(file) {
  const entries = list(file);
  const slides = entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const slideXml = slides.map((name) => text(file, name)).join('\n');
  const allXml = entries.filter((name) => name.endsWith('.xml')).map((name) => text(file, name)).join('\n');
  const theme = text(file, 'ppt/theme/theme1.xml');
  const colors = [...slideXml.matchAll(/srgbClr val="([A-Fa-f0-9]{6})"/g)].map((match) => match[1].toUpperCase());
  const colorCounts = Object.fromEntries(
    [...new Set(colors)].map((color) => [color, colors.filter((candidate) => candidate === color).length])
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
    literalRunFonts: [...new Set([...slideXml.matchAll(/typeface="([^"]+)"/g)].map((match) => match[1]))],
    coBranding: {
      consultify: /Consultify/i.test(allXml),
      dbr77: /DBR77/i.test(allXml),
      client: /Northwind Manufacturing Ltd\./i.test(allXml),
    },
    brandCrimsonHits: (allXml.match(/85182F/gi) || []).length,
    dominantColors: colorCounts,
  };
}

const expectedRoles = ['cover', 'agenda', 'section', 'content-one', 'content-two', 'table', 'chart', 'decision'];
const referenceInfo = inspect(reference);
const actualInfo = inspect(actual);
const checks = {
  slideCount: actualInfo.slides === referenceInfo.slides && actualInfo.slides === expectedRoles.length,
  packageLayouts: actualInfo.layouts === referenceInfo.layouts,
  packageMasters: actualInfo.masters === referenceInfo.masters,
  nativeChartCount: actualInfo.charts === referenceInfo.charts,
  nativeTableCount: actualInfo.tables === referenceInfo.tables,
  approvedPalette: ['1B2A41', '101828', '2563EB', '667085', 'D8DEE8', 'F1F4F8'].every((color) => color in actualInfo.dominantColors),
  aptosTheme: actualInfo.themeAptos,
  themeDrivenRuns: actualInfo.literalRunFonts.length === 0,
  coBranding: Object.values(actualInfo.coBranding).every(Boolean),
  zeroBrandCrimson: actualInfo.brandCrimsonHits === 0,
};

const result = {
  generatedAt: new Date().toISOString(),
  expectedRoles,
  reference: referenceInfo,
  actual: actualInfo,
  checks,
  status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
  note: 'The reference uses literal Arial runs. W118 supersedes that font mechanism: the implementation uses Aptos in the PPTX theme and no literal run font names; renderer substitution is evidenced separately on a machine without Aptos.',
};

writeFileSync(resolve(root, 'dowody/parity.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
