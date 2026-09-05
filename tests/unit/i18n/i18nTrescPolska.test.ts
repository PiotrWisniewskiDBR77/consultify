/**
 * i18nTrescPolska.test.ts
 *
 * STRAŻNIK TREŚCI (nie istnienia klucza) — luka zmierzona przy odbiorze P3:
 * tests/unit/koniecAngielskiegoP3.test.ts sprawdza WYŁĄCZNIE, że klucz istnieje
 * w pl i en i jest stringiem (`toBeTypeOf('string')`). Mutacja
 * `pl.initiatives.status.draft: "Szkic" → "Draft"` przechodziła na zielono —
 * osiemnasty kształt fałszywego „gotowe" (klucz istnieje ≠ przetłumaczony).
 *
 * Ten test porównuje TREŚĆ: dla każdego liścia obecnego w OBU plikach
 * (pl i en), jeśli wartość pl (po trim, case-insensitive) jest identyczna
 * z wartością en i nie jest na białej liście uzasadnionych identyczności
 * (nazwy własne, skróty, zapożyczenia, liczby/znaki, placeholdery `{{...}}`)
 * → naruszenie. Dodatkowo, niezależnie od wartości en: jeśli wartość pl jest
 * jednym z ~60 najczęstszych angielskich słów UI (Loading/Save/Cancel/...)
 * bez polskiego odpowiednika → też naruszenie (łapie martwe angielskie słowo
 * nawet gdy akurat en ma inną wartość niż pl).
 *
 * Dług zastany (pl ma dziś ~35k liści, w praktyce spora część nietłumaczona)
 * jest OGROMNY — hurtowe wykluczenie zabiłoby sens bramki. Zamiast tego:
 * RATCHET per klucz w `i18nTrescPolska.baseline.json`. Bramka failuje TYLKO
 * gdy pojawi się NOWY klucz spoza baseline (dług zastany przechodzi, dług nie
 * może rosnąć). Regeneracja baseline (tylko po świadomym audycie/naprawie):
 *   UPDATE_I18N_BASELINE=1 npx vitest run tests/unit/i18n/i18nTrescPolska.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const ROOT = process.cwd();
const BASELINE_PATH = resolve(ROOT, 'tests/unit/i18n/i18nTrescPolska.baseline.json');

const readLocale = (language: 'pl' | 'en'): Record<string, Json> =>
  JSON.parse(
    readFileSync(resolve(ROOT, `public/locales/${language}/translation.json`), 'utf8')
  ) as Record<string, Json>;

// Nazwy własne / skróty / zapożyczenia — identyczność pl===en jest tu OK.
const IDENTITY_WHITELIST = [
  'NPV', 'IRR', 'ROI', 'RAID', 'KPI', 'OKR', 'PDF', 'DOCX', 'XLSX', 'PPTX', 'CSV',
  'URL', 'API', 'ID', 'AI', 'Status', 'Import', 'Export', 'Sponsor', 'Portfolio',
  'Gantt', 'Webhook', 'Administrator', 'Partner', 'Teresa', 'Consultify', 'DBR77',
  'GO', 'CONDITIONAL GO', 'NO-GO', 'Conservative', 'Base', 'Upside', 'Expected',
  'Actual', 'Payback', 'CAPEX', 'OPEX', 'FTE', 'BAU', 'YTD', 'OEE', 'MES', 'IoT',
  'Hard', 'Avoided',
  'Jira', 'Slack', 'Teams', 'Google Drive', 'OneDrive', 'Dropbox', 'e-mail',
  'Email', 'OK', 'Kanban', 'Backlog', 'Sprint', 'Baseline', 'Dashboard', 'Excel',
  'Word', 'PowerPoint',
].map((entry) => entry.trim().toLowerCase());
const IDENTITY_WHITELIST_SET = new Set(IDENTITY_WHITELIST);

// ~60 najczęstszych angielskich słów UI bez polskiego odpowiednika — wartość pl
// będąca jednym z nich jest naruszeniem NIEZALEŻNIE od wartości en (martwe
// angielskie słowo, nie "uzasadniona identyczność").
const ENGLISH_UI_WORDS = [
  'Loading', 'Search', 'Save', 'Cancel', 'Delete', 'Edit', 'Add', 'New', 'Close',
  'Open', 'Settings', 'Unknown', 'Error', 'Success', 'Draft', 'Ready', 'Pending',
  'Approve', 'Reject', 'Submit', 'Back', 'Next', 'Previous', 'Filter', 'Sort',
  'Upload', 'Download', 'Name', 'Description', 'Owner', 'Created', 'Updated',
  'Date', 'Type', 'Category', 'Priority', 'Actions', 'Details', 'Summary',
  'Overview', 'Report', 'Reports', 'Comments', 'History', 'Attachments',
  'Members', 'Users', 'Role', 'Roles', 'Team', 'Tasks', 'Task', 'Notes', 'Note',
  'Preview', 'Publish', 'Archive', 'Restore', 'Retry', 'Refresh',
].map((entry) => entry.trim().toLowerCase());
const ENGLISH_UI_WORDS_SET = new Set(ENGLISH_UI_WORDS);

const hasLetters = (value: string): boolean => /\p{L}/u.test(value);

type Violation = { key: string; pl: string; en: string; reason: 'identical' | 'english-word' };

const flattenStrings = (node: Json, prefix: string, out: Map<string, string>): void => {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    out.set(prefix, node);
    return;
  }
  if (typeof node !== 'object') return;
  const entries = Array.isArray(node)
    ? node.map((value, index) => [String(index), value] as const)
    : Object.entries(node as Record<string, Json>);
  for (const [key, value] of entries) {
    flattenStrings(value, prefix ? `${prefix}.${key}` : key, out);
  }
};

const pl = readLocale('pl');
const en = readLocale('en');

const plLeaves = new Map<string, string>();
flattenStrings(pl, '', plLeaves);
const enLeaves = new Map<string, string>();
flattenStrings(en, '', enLeaves);

const violations: Violation[] = [];
for (const [key, plValueRaw] of plLeaves) {
  const enValueRaw = enLeaves.get(key);
  if (enValueRaw === undefined) continue; // klucz spoza wspólnego zbioru pl∩en — poza zakresem tej bramki

  const plValue = plValueRaw.trim();
  if (!plValue || plValue.startsWith('{{') || !hasLetters(plValue)) continue;

  const plNorm = plValue.toLowerCase();
  const enNorm = enValueRaw.trim().toLowerCase();

  const identical = plNorm === enNorm;
  const whitelisted = IDENTITY_WHITELIST_SET.has(plNorm);
  const isEnglishUiWord = ENGLISH_UI_WORDS_SET.has(plNorm);

  if (identical && !whitelisted) {
    violations.push({ key, pl: plValueRaw, en: enValueRaw, reason: 'identical' });
  } else if (isEnglishUiWord) {
    violations.push({ key, pl: plValueRaw, en: enValueRaw, reason: 'english-word' });
  }
}
violations.sort((a, b) => a.key.localeCompare(b.key));
const violationKeys = violations.map((v) => v.key);

if (process.env.UPDATE_I18N_BASELINE === '1') {
  writeFileSync(BASELINE_PATH, `${JSON.stringify([...violationKeys].sort(), null, 2)}\n`, 'utf8');
}

const baseline: string[] = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as string[])
  : [];
const baselineSet = new Set(baseline);

const newViolations = violations.filter((v) => !baselineSet.has(v.key));

describe('i18n — strażnik TREŚCI pl≠en (ratchet)', () => {
  it('baseline zastanego długu istnieje i jest posortowaną listą stringów', () => {
    expect(existsSync(BASELINE_PATH), `brak ${BASELINE_PATH} — uruchom UPDATE_I18N_BASELINE=1`).toBe(true);
    expect(baseline).toEqual([...baseline].sort());
    expect(baseline.every((k) => typeof k === 'string')).toBe(true);
  });

  it('żaden NOWY klucz nie ma treści pl identycznej z en (poza białą listą) ani martwego angielskiego słowa w pl', () => {
    const preview = newViolations.slice(0, 20).map(
      (v) => `${v.key} [${v.reason}] pl="${v.pl}" en="${v.en}"`
    );
    expect(
      newViolations.length,
      `${newViolations.length} NOWYCH naruszeń (dług zastany=${baseline.length} przechodzi bez zmian):\n${preview.join('\n')}`
    ).toBe(0);
  });
});
