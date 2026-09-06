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
// UWAGA: lista surowa (oryginalna wielkość liter) — potrzebna niezmieniona dla
// STRAŻNIKA BIAŁEJ LISTY poniżej (sprawdza wielkie litery), zanim zostanie
// znormalizowana do małych liter dla właściwego porównania pl/en.
const IDENTITY_WHITELIST_RAW = [
  'NPV', 'IRR', 'ROI', 'RAID', 'KPI', 'OKR', 'PDF', 'DOCX', 'XLSX', 'PPTX', 'CSV',
  'URL', 'API', 'ID', 'AI', 'Status', 'Import', 'Export', 'Sponsor', 'Portfolio',
  'Gantt', 'Webhook', 'Administrator', 'Partner', 'Teresa', 'Consultify', 'DBR77',
  'GO', 'CONDITIONAL GO', 'NO-GO', 'Conservative', 'Base', 'Upside', 'Expected',
  'Actual', 'Payback', 'CAPEX', 'OPEX', 'FTE', 'BAU', 'YTD', 'OEE', 'MES', 'IoT',
  'Hard', 'Avoided',
  'Jira', 'Slack', 'Teams', 'Google Drive', 'OneDrive', 'Dropbox', 'e-mail',
  'Email', 'OK', 'Kanban', 'Backlog', 'Sprint', 'Baseline', 'Dashboard', 'Excel',
  'Word', 'PowerPoint',
  // MVP naprawy noc 3 (05/06.09.2026) — Presentations DeckBuilder toolbar
  // "Diagrams" panel item labels: SWOT and Venn are the internationally
  // used names of these diagram archetypes, not English words with a
  // Polish equivalent (nobody calls a SWOT a "MSPZ" in Polish business
  // usage) — same category as RAID/KPI/OKR above.
  'SWOT', 'Venn (2)', 'Venn (3)',
  // ZLECENIE 1.8 (i18n-dlug-1, 06.09.2026) — dodatki do białej listy przy
  // redukcji ratchetu 484→≤300. Każdy wpis to nazwa własna (marka/produkt/
  // osoba/firma/standard), skrót branżowy, termin naukowy/medyczny identyczny
  // po polsku, literalny placeholder (URL/e-mail) lub token liczba+jednostka —
  // NIE zwykłe rzeczowniki pospolite. Uzasadnienie per wpis:
  // evidence/i18n-dlug-1/whitelist-additions.json
  'Menu',
  'VaR (5%)',
  'ISO 21500, PMBOK, PRINCE2',
  'https://…',
  'https://...',
  'https://example.com',
  'email@...',
  'min',
  'Premium',
  'Enterprise',
  'JSON',
  'Autopilot',
  'WACC',
  'SLA / SLO',
  'SLA',
  'Break-glass',
  'IP',
  'Deuteranopia',
  'Protanopia',
  'Tritanopia',
  'OpenDyslexic',
  'Inter',
  'Lato',
  'Open Sans',
  'Roboto',
  'Fira Code',
  'JetBrains Mono',
  'Poppins',
  'AI Chat V2',
  'Pop',
  'HTML',
  'Outlook',
  'SMS',
  'Microsoft Teams',
  'WhatsApp',
  'ClickUp',
  'Trello',
  'DD.MM.YYYY (31.12.2024)',
  'DD/MM/YYYY (31/12/2024)',
  'MM/DD/YYYY (12/31/2024)',
  'YYYY-MM-DD (2024-12-31)',
  'CEO',
  'CFO',
  'CMO',
  'COO',
  'CTO',
  'Chicago (CST/CDT)',
  'Denver (MST/MDT)',
  'Los Angeles (PST/PDT)',
  'Sydney (AEST/AEDT)',
  'Berlin (CET/CEST)',
  'UTC',
  'Euro',
  'Sublime Text',
  'Vim',
  'VS Code',
  'Push',
  'AI / Copilot',
  'ISO 27001',
  'SOC2 Type II',
  'DBR77 Vector',
  '20s',
  'Blog',
  'Blog Consultify',
  'Blog DBR77',
  'DPA',
  'AI Core',
  'Nordic Digital Solutions',
  'TransformACE Consulting',
  'Bartosz Sotomski',
  'FAQ',
  '45 min',
  '60 min',
  '30 min',
  'DBR77 Consultify',
  'JQL ({{optional}})',
  'Program',
  // ZLECENIE i18n-2 (06.09.2026) — "fragment" to słowo identyczne po polsku
  // (zapożyczenie z łaciny, ta sama pisownia); placeholder {{index}} sprawia,
  // że wpis dodatkowo spełnia kryterium (b) STRAŻNIKA (symbol nawiasu klamr.).
  'Fragment {{index}}',
];
const IDENTITY_WHITELIST = IDENTITY_WHITELIST_RAW.map((entry) => entry.trim().toLowerCase());
const IDENTITY_WHITELIST_SET = new Set(IDENTITY_WHITELIST);

// STRAŻNIK BIAŁEJ LISTY (zabezpieczenie) — ZLECENIE i18n-2 (06.09.2026):
// POMIAR_NIEZALEZNY.md (evidence/i18n-dlug-1) pkt 5b wykazał ZNALEZISKO: bez
// tego strażnika dowolne pospolite słowo (np. "Model") dopisane do
// IDENTITY_WHITELIST + ustawione pl===en przechodziło test na zielono — lista
// nie miała żadnej kontroli własnej zawartości. Każdy wpis musi spełniać
// JEDNO z:
//   (a) zawiera ≥2 wielkie litery (skrót typu "KPI"/"CEO" ALBO wielka litera
//       w środku słowa złożonego typu "PowerPoint"/"WhatsApp"/"ClickUp"),
//   (b) zawiera cyfrę lub symbol (np. "DBR77", "e-mail", "VaR (5%)"),
//   (c) jest w ALLOWED_PROPER_NOUNS niżej (nazwa własna/marka/termin, która
//       nie pasuje do (a)/(b) — jednosłowowa, bez cyfry/symbolu),
//   (d) ma ≤3 znaki (np. "GO", "IP", "ID").
// W przeciwnym razie to zwykłe słowo pospolite i NIE wolno go whitelistować
// bez świadomego dopisania do (c) z uzasadnieniem.
const ALLOWED_PROPER_NOUNS = [
  // Loanwordy/terminy branżowe używane w polskim oprogramowaniu biznesowym
  // identycznie jak w angielskim (nie tłumaczy się ich w praktyce rynkowej):
  'Status', 'Import', 'Export', 'Menu', 'Program', 'Push', 'Blog', 'Euro',
  'Email', 'Kanban', 'Backlog', 'Sprint', 'Baseline', 'Dashboard', 'Gantt',
  'Webhook', 'Sponsor', 'Portfolio', 'Administrator', 'Partner',
  // Marki/nazwy produktów (nie tłumaczy się nazw własnych produktów):
  'Consultify', 'Teresa', 'Jira', 'Slack', 'Teams', 'Dropbox', 'Outlook',
  'Trello', 'Excel', 'Word', 'Autopilot', 'Premium', 'Enterprise',
  // Nazwy fontów (ustawienia dostępności — nazwy własne krojów pisma):
  'Inter', 'Lato', 'Roboto', 'Poppins',
  // Terminy medyczne identyczne po polsku (ustawienia dostępności):
  'Deuteranopia', 'Protanopia', 'Tritanopia',
  // Etykiety scenariuszy finansowych — konwencja modelowania finansowego,
  // niezmienna w polskich raportach doradczych (Business Case/Wyniki):
  'Conservative', 'Base', 'Upside', 'Expected', 'Actual', 'Payback', 'Hard',
  'Avoided',
].map((entry) => entry.trim().toLowerCase());
const ALLOWED_PROPER_NOUNS_SET = new Set(ALLOWED_PROPER_NOUNS);

const countUppercase = (value: string): number => (value.match(/\p{Lu}/gu) ?? []).length;
const hasDigitOrSymbol = (value: string): boolean =>
  /[0-9]/.test(value) || /[^\p{L}\p{N}\s]/u.test(value);

type WhitelistGuardViolation = { entry: string; reason: string };

const whitelistGuardViolations: WhitelistGuardViolation[] = [];
for (const rawEntry of IDENTITY_WHITELIST_RAW) {
  const entry = rawEntry.trim();
  const normalized = entry.toLowerCase();
  const isAcronymOrMidCap = countUppercase(entry) >= 2;
  const isDigitOrSymbol = hasDigitOrSymbol(entry);
  const isAllowedProperNoun = ALLOWED_PROPER_NOUNS_SET.has(normalized);
  const isShort = entry.length <= 3;
  if (!isAcronymOrMidCap && !isDigitOrSymbol && !isAllowedProperNoun && !isShort) {
    whitelistGuardViolations.push({
      entry,
      reason:
        'zwykłe słowo pospolite — brak ≥2 wielkich liter, cyfry/symbolu, wpisu w ALLOWED_PROPER_NOUNS i długości ≤3',
    });
  }
}

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

  it('STRAŻNIK BIAŁEJ LISTY: każdy wpis IDENTITY_WHITELIST jest uzasadnioną nazwą własną/skrótem, nie zwykłym słowem pospolitym', () => {
    const preview = whitelistGuardViolations
      .map((v) => `"${v.entry}" — ${v.reason}`)
      .join('\n');
    expect(
      whitelistGuardViolations.length,
      `${whitelistGuardViolations.length} wpis(y) IDENTITY_WHITELIST bez uzasadnienia (dodaj do ALLOWED_PROPER_NOUNS z komentarzem albo usuń):\n${preview}`
    ).toBe(0);
  });
});
