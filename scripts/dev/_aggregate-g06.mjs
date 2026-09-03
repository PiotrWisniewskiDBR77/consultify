import fs from 'fs';
import path from 'path';

// Dyżur G06, moduły 05-08. Adaptacja update-register.mjs z dyżuru 284:
// dokłada 2 kolumny (dostępność, rozwinięcie sekcji) do WŁASNYCH wierszy,
// zachowując resztę rejestru bez zmian.
//
// Rozszerzenie względem 284: 3 axe-id (landmark-one-main, page-has-heading-one,
// region) są ZMIERZONE jako artefakt hosta dev-render (main.tsx montuje ekran
// z pominięciem src/layouts/MainLayout.tsx — patrz commit R1) i NIE liczą się
// jako naruszenie produktu. Etykiety kontrolek pozostających zwiniętych są
// klasyfikowane: ZNANE wyzwalacze menu (nie są sekcją treści) vs NIEZNANE
// (realny kandydat na defekt, wypisany wprost do ręcznej weryfikacji zrzutem).

const repo = '/private/tmp/ag-g06-b';
const artefakty = '/private/tmp/ag-g06-b-artefakty';
const register = path.join(repo, 'docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G06_JEZYKI_MOTYWY_20260902.md');

// ★★★ SPROSTOWANIE 2026-09-03 (nadzorca) — TA LISTA MIALA SZESC POZYCJI I BYLA ZA DLUGA.
// Nadzorca przekazal teze, ze SZESC regul krajobrazowych znika po zawezeniu skanu do
// '#dev-render-root'. Teza byla ZA MOCNA i zostala obalona dwoma niezaleznymi pomiarami
// (moduly 05-08 i 09-12). Autor tego skryptu zmierzyl samodzielnie TRZY i mimo to przyjal
// szesc, bo pochodzily od koordynatora - to jest dokladnie ten wzorzec, ktoremu program ma
// zapobiegac: teza nadzorcy staje sie faktem w narzedziu.
//
// ZMIERZONE I POTWIERDZONE - znikaja po zawezeniu, sa szumem hosta:
const HARNESS_AXE_IDS = new Set([
  'landmark-one-main',
  'page-has-heading-one',
  'region',
]);

// NIE POTWIERDZONE jako szum - potrafia wystapic WEWNATRZ fragmentu i wtedy sa realnym
// defektem produktu. Zmierzone: 'heading-order' na ekranie audyty-warsztat-kryterium
// wystepuje IDENTYCZNIE w obu zakresach skanu. Tych trzech NIE WOLNO odejmowac hurtem -
// kazde wystapienie wymaga rozstrzygniecia, czy dotyczy renderowanego ekranu, czy hosta.
const WYMAGA_ROZSTRZYGNIECIA_AXE_IDS = new Set([
  'heading-order',
  'landmark-no-duplicate-banner',
  'landmark-unique',
]);

// ★ Skutek dla liczb juz zapisanych: moduly 05-08 byly agregowane wersja szescioregulowa,
// wiec ich liczba naruszen jest ZANIZONA o wystapienia tych trzech id. Wymaga przeliczenia.
// Zmierzone na wielu ekranach modułów 05-08 jako wyzwalacze menu/dropdown,
// NIE sekcje treści (patrz R1 commit + logi R_initiatives): pozostają zwinięte
// PO ROZMYŚLE — to jest poprawny, oczekiwany stan (menu domyślnie zamknięte).
const KNOWN_MENU_LABELS_PL = new Set(['Więcej', 'Sekcje', 'Analizuj z AI', 'Ustawienia widoku', 'Akcje wiersza', 'Wypełnij z AI', 'Więcej działań', 'Konwertuj', '']);
const KNOWN_MENU_LABELS_EN = new Set(['More', 'Sections', 'Analyze with AI', 'View settings', 'Row actions', 'Fill with AI', 'More actions', 'Convert', '']);
const KNOWN_MENU_LABELS = new Set([...KNOWN_MENU_LABELS_PL, ...KNOWN_MENU_LABELS_EN]);
// Kolumna-filtr nagłówka tabeli (StandardTable/FilterableTable, kanon triady):
// etykieta „Filtruj <Kolumna>, <stan filtra>" / „Filter <Column>, <state>" —
// zweryfikowane zrzutem `execution-tab-list` (kolumna STATUS z chevronem w
// nagłówku) — to jest dropdown filtra, nie sekcja treści.
const isKnownMenuLabel = (label) => {
  const t = label.trim();
  if (KNOWN_MENU_LABELS.has(t)) return true;
  if (/^(Filtruj|Filter)\b/.test(t)) return true;
  // Zmierzone na module 07 (b2-template-gallery/idea-table-timeline-stuck/canvasy):
  // "More options: Insert" / "Więcej opcji: Wstaw" to przycisk paska narzędzi kanwy
  // (kebab per-narzędzie), nie sekcja treści.
  if (/^(More options:|Więcej opcji:)/.test(t)) return true;
  return false;
};

const moduleGroups = {
  '05_INITIATIVES': 'R_initiatives',
  '06_EXECUTION': 'R_execution',
  '07_MY_WORK_AGENT': 'R_mywork',
  '08_MEETINGS': 'R_meetings',
};

const byScreen = new Map();
for (const [moduleName, katalog] of Object.entries(moduleGroups)) {
  const dir = path.join(artefakty, katalog);
  if (!fs.existsSync(dir)) continue;
  const jsonFiles = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
  for (const name of jsonFiles) {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const w of parsed.wyniki || []) {
      const bucket = byScreen.get(w.ekran) || [];
      bucket.push(w);
      byScreen.set(w.ekran, bucket);
    }
  }
}

const lines = fs.readFileSync(register, 'utf8').split('\n');
const measuredModules = new Set(Object.keys(moduleGroups));
const reportRows = [];

const updated = lines.map((line) => {
  if (!line.startsWith('| ')) return line;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  const moduleName = cells[0];
  const screen = (cells[1] || '').replaceAll('`', '');
  if (moduleName === 'moduł' || moduleName.startsWith('---')) return line;
  if (!measuredModules.has(moduleName)) return line;

  const rows = byScreen.get(screen) || [];
  if (rows.length !== 8) {
    const accessibility = `EVIDENCE_MISSING — ${rows.length}/8 pomiarów`;
    const sections = `EVIDENCE_MISSING — ${rows.length}/8 pomiarów`;
    cells.splice(cells.length - 1, 0, accessibility, sections);
    reportRows.push({ moduleName, screen, rows: rows.length, status: 'EVIDENCE_MISSING' });
    return `| ${cells.join(' | ')} |`;
  }

  // dostępność: policz naruszenia PO odjęciu 3 znanych id artefaktu hosta
  const extraViolationIdsSet = new Set();
  let framesWithExtraViolations = 0;
  for (const row of rows) {
    const ids = (row.a11yNaruszenia || []).map((v) => v.id).filter((id) => !HARNESS_AXE_IDS.has(id));
    if (ids.length > 0) framesWithExtraViolations++;
    ids.forEach((id) => extraViolationIdsSet.add(id));
  }
  const extraIds = [...extraViolationIdsSet].sort();
  const accessibility = extraIds.length > 0
    ? `${framesWithExtraViolations}/8 kadrów z naruszeniami axe (poza 3 znanymi artefaktami hosta dev-render): ${extraIds.join(', ')}`
    : `0/8 kadrów z naruszeniami axe poza 3 znanymi artefaktami hosta dev-render (landmark-one-main, page-has-heading-one, region — zmierzone jako pominięcie MainLayout w dev-render/main.tsx, nie defekt produktu)`;

  // rozwinięcie sekcji: sklasyfikuj resztki jako znane menu vs nieznane
  const expandedFrames = rows.filter((r) => (r.sekcjeRozwiniete || 0) > 0).length;
  const unknownLabelsSet = new Set();
  let framesWithUnknownFolded = 0;
  for (const row of rows) {
    const residual = row.sekcjeNadalZwiniete || [];
    const unknown = residual.filter((label) => !isKnownMenuLabel(label));
    if (unknown.length > 0) framesWithUnknownFolded++;
    unknown.forEach((label) => unknownLabelsSet.add(label));
  }
  const unknownLabels = [...unknownLabelsSet];
  const sections = unknownLabels.length > 0
    ? `rozwinięto na ${expandedFrames}/8; ${framesWithUnknownFolded}/8 kadrów ma NIEZNANE zwinięte kontrolki (kandydat na realną sekcję): ${unknownLabels.slice(0, 6).join(' / ')}`
    : `rozwinięto realne akordeony treści na ${expandedFrames}/8 kadrów; pozostają WYŁĄCZNIE znane wyzwalacze menu (dropdown/kebab), nie sekcje treści`;

  cells.splice(cells.length - 1, 0, accessibility, sections);
  reportRows.push({
    moduleName,
    screen,
    rows: rows.length,
    framesWithExtraViolations,
    extraIds,
    framesWithUnknownFolded,
    unknownLabels,
  });
  return `| ${cells.join(' | ')} |`;
});

fs.writeFileSync(register, updated.join('\n'));
fs.writeFileSync(path.join(artefakty, 'aggregate-report.json'), JSON.stringify(reportRows, null, 2));
console.log(`Zaktualizowano rejestr. Wierszy przetworzonych: ${reportRows.length}`);
for (const r of reportRows) {
  console.log(`${r.moduleName} / ${r.screen}: rows=${r.rows} extraA11y=${(r.extraIds||[]).join(',')||'-'} unknownFolded=${(r.unknownLabels||[]).join(',')||'-'}`);
}
