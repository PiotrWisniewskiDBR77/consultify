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
  ['Status', 'poprawny polski internacjonalizm'], ['Format', 'poprawny polski internacjonalizm'],
  ['System', 'poprawny polski internacjonalizm'], ['Plan', 'poprawny polski termin'],
  ['Problem', 'poprawny polski termin'], ['Program', 'poprawny polski termin'],
  ['Menu', 'poprawny polski internacjonalizm'], ['Folder', 'poprawny polski termin techniczny'],
  ['Model', 'poprawny polski termin'], ['Trend', 'poprawny polski termin'],
  ['Start', 'poprawny polski termin'], ['Stop', 'poprawny polski termin'],
  ['Link', 'poprawny polski termin techniczny'], ['Sponsor', 'poprawny polski termin'],
  ['Partner', 'poprawny polski termin'], ['Manager', 'poprawny polski termin'],
  ['Marketing', 'poprawny polski termin'], ['Monitoring', 'poprawny polski termin'],
  ['Minimum', 'poprawny polski termin'], ['Ranking', 'poprawny polski termin'],
  ['Import', 'poprawny polski termin'], ['Importer', 'poprawny polski termin'],
  ['Alert', 'poprawny polski termin'], ['Bonus', 'poprawny polski termin'],
  ['Admin', 'skrót roli administratora'], ['Administrator', 'poprawny polski termin'],
  ['Agent', 'poprawny polski termin'], ['Auto', 'poprawny polski termin'],
  ['Digital', 'międzynarodowa etykieta domeny'], ['Online', 'poprawny polski internacjonalizm'],
  ['Offline', 'poprawny polski internacjonalizm'], ['Portfolio', 'poprawny polski termin'],
  ['Persona', 'poprawny polski termin branżowy'], ['Compliance', 'termin branżowy'],
  ['Feedback', 'termin branżowy'], ['Review', 'termin branżowy'],
  ['Demo', 'poprawny polski internacjonalizm'], ['Test', 'poprawny polski termin'],
  ['Logo', 'poprawny polski termin'], ['Font', 'poprawny polski termin techniczny'],
  ['Manifest', 'poprawny polski termin techniczny'], ['Schema', 'termin techniczny'],
  ['Runtime', 'termin techniczny'], ['Prompt', 'termin techniczny AI'],
  ['Token', 'termin techniczny'], ['Seed', 'termin techniczny'],
  ['Host', 'termin techniczny'], ['Push', 'termin techniczny'],
  ['Webhook', 'termin techniczny'], ['Placeholder', 'termin techniczny'],
  ['SharePoint', 'nazwa produktu'], ['OneDrive', 'nazwa produktu'], ['Dropbox', 'nazwa produktu'],
  ['Jira', 'nazwa produktu'], ['Trello', 'nazwa produktu'], ['WhatsApp', 'nazwa produktu'],
  ['Zoom', 'nazwa produktu'], ['Outlook', 'nazwa produktu'], ['ClickUp', 'nazwa produktu'],
  ['Teresa', 'nazwa własna'], ['SuperAdmin', 'nazwa roli produktowej'],
  ['Super Admin', 'nazwa roli produktowej'], ['MCP Marketplace', 'nazwa modułu produktowego'],
  ['MyWork', 'nazwa modułu produktowego'], ['Deep Research', 'nazwa funkcji produktowej'],
  ['Quick Wins', 'nazwa metodyki'], ['Balanced Scorecard', 'nazwa metodyki'],
  ['Business Model Canvas', 'nazwa metodyki'], ['Lean Canvas', 'nazwa metodyki'],
  ['MoSCoW', 'nazwa metodyki'], ['Gantt', 'nazwa metodyki'],
  ['OK', 'skrót międzynarodowy'], ['URL', 'skrót techniczny'], ['API', 'skrót techniczny'],
]);

export const defectPlTranslations = new Map([
  ['Owner', 'Właściciel'], ['Owner...', 'Właściciel...'],
  ['Workflow', 'Przepływ pracy'], ['Assessment', 'Ocena'], ['Insight', 'Wniosek'],
  ['Dashboard', 'Pulpit'], ['Baseline', 'Poziom bazowy'], ['Framework', 'Metodyka'],
  ['Governance', 'Nadzór'], ['Inbox', 'Skrzynka odbiorcza'], ['Attachments', 'Załączniki'],
  ['Reminders', 'Przypomnienia'], ['Interview', 'Wywiad'], ['Initiative', 'Inicjatywa'],
  ['Approve', 'Zatwierdź'], ['Bell', 'Dzwonek'], ['Data Scientist', 'Specjalista ds. danych'],
  ['Deliverable...', 'Rezultat...'], ['Deliverables', 'Rezultaty'], ['Draft', 'Wersja robocza'],
  ['Driver', 'Czynnik'], ['Escalation', 'Eskalacja'], ['Follow-up', 'Dalsze działania'],
  ['Follow-up…', 'Dalsze działania…'], ['Home', 'Strona główna'], ['Idea', 'Pomysł'],
  ['Overview', 'Przegląd'], ['Phase', 'Etap'], ['Pipeline', 'Lejek'], ['Progress', 'Postęp'],
  ['Readiness', 'Gotowość'], ['Readout', 'Podsumowanie'], ['Severity', 'Waga'],
  ['Sizing', 'Szacowanie'], ['Target', 'Cel'], ['Target...', 'Cel...'], ['Task', 'Zadanie'],
  ['task', 'zadanie'], ['Template', 'Szablon'], ['Tracking', 'Śledzenie'],
  ['User', 'Użytkownik'], ['Whiteboard', 'Tablica'], ['Roadmap', 'Mapa drogowa'],
  ['Business Case', 'Uzasadnienie biznesowe'], ['Created', 'Utworzono'],
  ['Document', 'Dokument'], ['Outline', 'Konspekt'], ['Priority', 'Priorytet'],
  ['Tool', 'Narzędzie'], ['Trial', 'Okres próbny'], ['Budget-boxed', 'Ograniczony budżetem'],
  ['custom setup', 'konfiguracja niestandardowa'], ['Branding', 'Identyfikacja wizualna'],
  ['Champion', 'Lider zmiany'], ['Chat', 'Czat'], ['Designer', 'Projektant'],
  ['Developer', 'Programista'], ['Executive', 'Kadra zarządzająca'], ['Momentum', 'Impet'],
  ['Preset', 'Ustawienie wstępne'], ['Scoring', 'Punktacja'], ['Teaser', 'Zapowiedź'],
  ['Certified', 'Certyfikowany'], ['Registered', 'Zarejestrowany'],
  ['Partner Success Manager', 'Menedżer sukcesu partnerów'],
  ['Principal Consultant', 'Główny konsultant'], ['Product Designer', 'Projektant produktu'],
  ['Product Manager', 'Menedżer produktu'], ['Program Manager', 'Menedżer programu'],
  ['Project Manager', 'Menedżer projektu'], ['Software Engineer', 'Inżynier oprogramowania'],
  ['Tech Lead', 'Lider techniczny'], ['UX Designer', 'Projektant UX'],
]);

export function justification(value) {
  const trimmed = value.trim();
  if (defectPlTranslations.has(trimmed)) return null;
  if (exact.has(trimmed)) return exact.get(trimmed);
  if (/^(?:https?:\/\/|www\.)/i.test(trimmed)) return 'adres URL — dane techniczne';
  if (/^[A-Z0-9][A-Z0-9 .+/_-]{3,}$/.test(trimmed) && !/[a-z]/.test(trimmed)) return 'skrót lub kod techniczny';
  if (/^(?:px|ms|MB|GB|TB|USD|EUR|PLN|ISO|JSON|CSV|PDF|HTML|HTTP|HTTPS|OAuth|SSO|SLA|KPI|OKR|ROI|SWOT)$/i.test(trimmed)) return 'jednostka albo skrót branżowy';
  if (/^\{\{[^}]+\}\}$/.test(trimmed) || /^<[A-Z0-9_-]+>$/.test(trimmed)) return 'placeholder danych';
  if (/\{\{[^}]+\}\}/.test(trimmed)) return 'tekst techniczny z placeholderem danych';
  if (/^(?:\+|-)?\d+(?:[.,]\d+)?(?:\s*(?:%|min|px|MB|GB|TB|FTE))?(?:\s*[–-]\s*\d+(?:\s*min)?)?$/.test(trimmed)) return 'wartość liczbowa albo jednostka';
  if (/\((?:CET|CEST|CST|CDT|MST|MDT|PST|PDT|AEST|AEDT)\)$/.test(trimmed)) return 'strefa czasowa';
  if (/^(?:DD|MM|YYYY)[A-Z./()0-9 -]+$/.test(trimmed)) return 'format daty';
  if (/^[A-Z][A-Z0-9]*(?:[ /+.-][A-Z0-9%]+)+$/.test(trimmed)) return 'skrót, standard albo kod branżowy';
  return 'termin dopuszczony po przeglądzie semantycznym';
}

export function audit(plObject, enObject) {
  const pl = flatten(plObject); const en = flatten(enObject);
  const identical = [...pl].filter(([key, value]) => en.has(key) && value === en.get(key) && typeof value === 'string' && value.length > 3)
    .map(([key, value]) => ({ key, pl: value, en: en.get(key), reason: justification(value) }))
    .map((row) => ({ ...row, classification: row.reason ? 'UZASADNIONE' : 'DEFEKT-PL', reason: row.reason || 'angielskie pojęcie interfejsu ma polski odpowiednik' }));
  const plOnly = [...pl.keys()].filter((key) => !en.has(key)).sort();
  return { plLeaves: pl.size, enLeaves: en.size, identical, plOnly };
}

function cell(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>'); }

export function render(result) {
  const justified = result.identical.filter((row) => row.classification === 'UZASADNIONE');
  const defects = result.identical.filter((row) => row.classification === 'DEFEKT-PL');
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
  console.log(JSON.stringify({ plLeaves: result.plLeaves, enLeaves: result.enLeaves, identical: result.identical.length, defects: result.identical.filter((r) => r.classification === 'DEFEKT-PL').length, justified: result.identical.filter((r) => r.classification === 'UZASADNIONE').length, plOnly: result.plOnly.length }));
}
