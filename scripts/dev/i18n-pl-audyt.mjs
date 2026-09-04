#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const plPath = resolve(root, 'public/locales/pl/translation.json');
const enPath = resolve(root, 'public/locales/en/translation.json');
const outputPath = resolve(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md');

export function flatten(value, prefix = '', out = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  } else out.set(prefix, value);
  return out;
}

const exact = new Map([
  ['Email', 'międzynarodowy termin interfejsowy'], ['E-mail', 'międzynarodowy termin interfejsowy'],
  ['OpenAI', 'nazwa własna'], ['Google', 'nazwa własna'], ['Microsoft', 'nazwa własna'],
  ['Slack', 'nazwa własna'], ['Teams', 'nazwa własna'], ['Consultify', 'nazwa produktu'],
  ['Excel', 'nazwa produktu'], ['PowerPoint', 'nazwa produktu'], ['LinkedIn', 'nazwa własna'],
  ['Markdown', 'nazwa formatu'], ['JavaScript', 'nazwa języka'], ['TypeScript', 'nazwa języka'],
  ['Tempo', 'poprawny polski termin identyczny z angielskim'],
  ['OK', 'skrót międzynarodowy'], ['URL', 'skrót techniczny'], ['API', 'skrót techniczny'],
]);

export function justification(value) {
  const trimmed = value.trim();
  if (exact.has(trimmed)) return exact.get(trimmed);
  if (/^(?:https?:\/\/|www\.)/i.test(trimmed)) return 'adres URL — dane techniczne';
  if (/^[A-Z0-9][A-Z0-9 .+/_-]{3,}$/.test(trimmed) && !/[a-z]/.test(trimmed)) return 'skrót lub kod techniczny';
  if (/^(?:px|ms|MB|GB|TB|USD|EUR|PLN|ISO|JSON|CSV|PDF|HTML|HTTP|HTTPS|OAuth|SSO|SLA|KPI|OKR|ROI|SWOT)$/i.test(trimmed)) return 'jednostka albo skrót branżowy';
  if (/^\{\{[^}]+\}\}$/.test(trimmed) || /^<[A-Z0-9_-]+>$/.test(trimmed)) return 'placeholder danych';
  return null;
}

export function audit(plObject, enObject) {
  const pl = flatten(plObject); const en = flatten(enObject);
  const identical = [...pl].filter(([key, value]) => en.has(key) && value === en.get(key) && typeof value === 'string' && value.length > 3)
    .map(([key, value]) => ({ key, pl: value, en: en.get(key), reason: justification(value) }))
    .map((row) => ({ ...row, classification: row.reason ? 'UZASADNIONE' : 'DEFEKT', reason: row.reason || 'identyczna wartość bez uzasadnionego stop-słowa' }));
  const plOnly = [...pl.keys()].filter((key) => !en.has(key)).sort();
  return { plLeaves: pl.size, enLeaves: en.size, identical, plOnly };
}

function cell(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>'); }

export function render(result) {
  const justified = result.identical.filter((row) => row.classification === 'UZASADNIONE');
  const defects = result.identical.filter((row) => row.classification === 'DEFEKT');
  return [
    '# Rejestr języka polskiego — identyczne wartości PL/EN', '',
    'Generator: `node scripts/dev/i18n-pl-audyt.mjs`  ',
    `Liście PL: ${result.plLeaves}; liście EN: ${result.enLeaves}; identyczne (>3 znaki): ${result.identical.length}; DEFEKT: ${defects.length}; UZASADNIONE: ${justified.length}; PL bez EN: ${result.plOnly.length}.`, '',
    '| Klucz | Wartość PL | Wartość EN | Klasa | Powód | Commit |', '|---|---|---|---|---|---|',
    ...result.identical.map((row) => `| \`${row.key}\` | ${cell(row.pl)} | ${cell(row.en)} | ${row.classification} | ${row.reason} | — |`),
    '', '## Uzasadnione', '',
    ...justified.map((row) => `- \`${row.key}\`: ${row.reason} (${cell(row.pl)})`),
    '', '## PL ma, EN nie ma', '',
    ...result.plOnly.map((key) => `- \`${key}\``), '',
  ].join('\n');
}

export function run() {
  const result = audit(JSON.parse(readFileSync(plPath, 'utf8')), JSON.parse(readFileSync(enPath, 'utf8')));
  writeFileSync(outputPath, render(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = run();
  console.log(JSON.stringify({ plLeaves: result.plLeaves, enLeaves: result.enLeaves, identical: result.identical.length, defects: result.identical.filter((r) => r.classification === 'DEFEKT').length, justified: result.identical.filter((r) => r.classification === 'UZASADNIONE').length, plOnly: result.plOnly.length }));
}
