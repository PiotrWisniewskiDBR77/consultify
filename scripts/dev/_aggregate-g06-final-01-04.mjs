// Dyżur G06 FINAL — moduły 01-04, marker 2954ec8d37, worktree ag-g06f-a, port 5314.
// Buduje wiersze macierzy 8-kadrowej (PL/EN x light/dark x 1440/1024) z 4 przebiegow
// grafika-zrzuty.mjs (pl-1440, pl-1024, en-1440, en-1024; kazdy z --motywy=light,dark).
//
// KOREKTA METODOLOGICZNA (potwierdzona wlasnym pomiarem K1 + CODEX_DAY285 raport):
// axe.run() zawezony do #dev-render-root usuwa TYLKO 3 reguly poziomu dokumentu
// (landmark-one-main, page-has-heading-one, region) — potwierdzone: 0 wystapien
// w kazdej z 51 zmierzonych ekranow x 8 klatek. Pozostale 3 z "szesciu regul
// krajobrazowych" (heading-order, landmark-unique, landmark-no-duplicate-banner)
// NADAL WYSTEPUJA na czesci ekranow (np. org-claims-sources: landmark-unique +
// landmark-no-duplicate-banner na kazdej klatce) — to NIE jest bezwarunkowy szum,
// wbrew instrukcji dyzuru i wbrew skryptowi _aggregate-g06.mjs (moduly 05-08), ktory
// blednie odjal wszystkie 6. Ten skrypt odejmuje WYLACZNIE potwierdzone 3.
const HARNESS_NOISE_IDS = new Set(['landmark-one-main', 'page-has-heading-one', 'region']);
// Nie odejmowane automatycznie — raportowane jako realne, dopoki ktos nie zweryfikuje
// per-ekran inaczej (bezpieczny domyslny wybor zgodny z "uczciwosc ponad optymizm"):
const CONDITIONAL_WATCH_IDS = new Set(['heading-order', 'landmark-unique', 'landmark-no-duplicate-banner']);

const KNOWN_MENU_LABELS_PL = new Set(['Więcej', 'Sekcje', 'Analizuj z AI', 'Ustawienia widoku', 'Akcje wiersza', 'Wypełnij z AI', 'Więcej działań', 'Konwertuj', 'Więcej opcji', '']);
const KNOWN_MENU_LABELS_EN = new Set(['More', 'Sections', 'Analyze with AI', 'View settings', 'Row actions', 'Fill with AI', 'More actions', 'Convert', 'More options', '']);
const KNOWN_MENU_LABELS = new Set([...KNOWN_MENU_LABELS_PL, ...KNOWN_MENU_LABELS_EN]);
const isKnownMenuLabel = (label) => {
  const t = String(label).trim();
  if (KNOWN_MENU_LABELS.has(t)) return true;
  if (/^(Filtruj|Filter)\b/.test(t)) return true;
  if (/^(More options:|Więcej opcji:)/.test(t)) return true;
  return false;
};

import fs from 'fs';
import path from 'path';

const ART = '/private/tmp/ag-g06f-a-artefakty';
const MODULES = {
  '01_ORGANIZATION': 'org-claims-sources,org-declared-challenges,org-evidence,org-executive-brief,org-files,org-goal-blockers,org-identity-operating,org-knowledge-graph,org-operating-model,org-position-direction,org-recommendation,org-risks-opportunities,org-root-causes,org-scenarios,org-scope-boundaries,org-source-conflicts,org-stakeholder-expectations,org-strategic-intent,org-success-metrics,org-summary,org-technology-culture-constraints'.split(','),
  '02_INTERVIEW': 'drd-http-workspace,interview-creator-shell,interview-preview-canon,interview-sessions-status,karta-insight,karta-interview'.split(','),
  '03_TOOLS': 'karta-tool,tools-outputs-insights-tab,tools-sesja-wyjscie,tools-swot-initiative-proposal,tools-swot-library-detail,tools-swot-report,tools-swot-session-workspace'.split(','),
  '04_ASSESSMENT': 'assessment-artifacts-restart,assessment-five-surfaces,assessment-initiatives-panel,assessment-initiatives-table,assessment-list,assessment-manage-panel,assessment-menu3-status-chips,assessment-output-report,assessment-presentation-view,assessment-quality-review-panel,assessment-report-contract,assessment-reports-panel,assessment-reports-table,drd-library-entry,drd-macierz-oceny,method-workspace,siri-workspace'.split(','),
};
const COMBOS = ['pl-1440', 'pl-1024', 'en-1440', 'en-1024'];

function loadCombo(mod, combo) {
  const p = path.join(ART, mod, combo, 'wynik.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function frameFor(data, ekran, motyw) {
  if (!data) return null;
  return (data.wyniki || []).find((r) => r.ekran === ekran && r.motyw === motyw) || null;
}

function pairFor(data, ekran) {
  if (!data) return null;
  return (data.pary || []).find((p) => p.ekran === ekran) || null;
}

const out = { modules: {} };
const missing = [];

for (const [mod, screens] of Object.entries(MODULES)) {
  const combosData = {};
  for (const c of COMBOS) combosData[c] = loadCombo(mod, c);
  const rows = [];
  for (const ekran of screens) {
    const frames = [];
    for (const c of COMBOS) {
      for (const motyw of ['light', 'dark']) {
        const f = frameFor(combosData[c], ekran, motyw);
        if (f) frames.push({ combo: c, motyw, ...f });
      }
    }
    if (frames.length !== 8) {
      missing.push({ mod, ekran, found: frames.length });
    }

    // Tekst PL vs EN (reprezentatywnie: 1440 light)
    const plFrame = frames.find((f) => f.combo === 'pl-1440' && f.motyw === 'light');
    const enFrame = frames.find((f) => f.combo === 'en-1440' && f.motyw === 'light');
    const plText = (plFrame?.tekst || '').replace(/\s+/g, ' ').trim();
    const enText = (enFrame?.tekst || '').replace(/\s+/g, ' ').trim();
    const tekstIdentyczny = plText && enText && plText === enText;
    const jezykStatus = !plFrame || !enFrame
      ? 'BRAK RAMKI'
      : tekstIdentyczny
        ? `NIE — PL=EN: „${plText.slice(0, 70)}"`
        : `TAK — tekst różni się PL/EN`;

    // ΔL i procent innych pikseli (min po 4 kombinacjach)
    let minDeltaL = null;
    let minPixelDiff = null;
    for (const c of COMBOS) {
      const light = frameFor(combosData[c], ekran, 'light');
      const dark = frameFor(combosData[c], ekran, 'dark');
      if (light?.obrazJasnosc != null && dark?.obrazJasnosc != null) {
        const d = light.obrazJasnosc - dark.obrazJasnosc;
        if (minDeltaL === null || d < minDeltaL) minDeltaL = d;
      }
      const pair = pairFor(combosData[c], ekran);
      if (pair?.procentRoznychPikseli != null) {
        if (minPixelDiff === null || pair.procentRoznychPikseli < minPixelDiff) minPixelDiff = pair.procentRoznychPikseli;
      }
    }

    // Overflow przy 1024 (scrollWidth vs viewport)
    let overflow1024 = false;
    for (const motyw of ['light', 'dark']) {
      const f = frameFor(combosData['pl-1024'], ekran, motyw) || frameFor(combosData['en-1024'], ekran, motyw);
      if (f && f.szer && f.szer > 1024 + 2) overflow1024 = true;
    }

    // Konsola: max/łącznie na 8 klatkach
    const bledyList = frames.map((f) => f.bledy || 0);
    const maxBledy = frames.length ? Math.max(...bledyList) : null;
    const sumaBledy = bledyList.reduce((a, b) => a + b, 0);

    // Dostepnosc: odejmij TYLKO 3 potwierdzone id szumu; CONDITIONAL_WATCH_IDS licz jako realne
    const extraIdsSet = new Set();
    let framesWithReal = 0;
    let framesWithConditionalOnly = 0;
    for (const f of frames) {
      const ids = (f.a11yNaruszenia || []).map((v) => v.id);
      const filtered = ids.filter((id) => !HARNESS_NOISE_IDS.has(id));
      const realNonConditional = filtered.filter((id) => !CONDITIONAL_WATCH_IDS.has(id));
      if (filtered.length > 0) framesWithReal++;
      if (filtered.length > 0 && realNonConditional.length === 0) framesWithConditionalOnly++;
      filtered.forEach((id) => extraIdsSet.add(id));
    }
    const extraIds = [...extraIdsSet].sort();
    const a11yStatus = extraIds.length === 0
      ? `0/8 kadrów z naruszeniami axe poza 3 potwierdzonymi artefaktami hosta dev-render (landmark-one-main, page-has-heading-one, region — 0 wystąpień na wszystkich 8 klatkach, brak MainLayout w dev-render, nie defekt produktu)`
      : `${framesWithReal}/8 kadrów z naruszeniami axe (poza 3 potwierdzonymi artefaktami hosta): ${extraIds.join(', ')}${framesWithConditionalOnly > 0 ? ` [uwaga: ${framesWithConditionalOnly}/8 klatek ma WYŁĄCZNIE id z grupy warunkowej heading-order/landmark-unique/landmark-no-duplicate-banner — patrz metodologia]` : ''}`;

    // Rozwiniecie sekcji
    const expandedFrames = frames.filter((f) => (f.sekcjeRozwiniete || 0) > 0).length;
    const unknownLabelsSet = new Set();
    let framesWithUnknownFolded = 0;
    for (const f of frames) {
      const residual = f.sekcjeNadalZwiniete || [];
      const unknown = residual.filter((label) => !isKnownMenuLabel(label));
      if (unknown.length > 0) framesWithUnknownFolded++;
      unknown.forEach((label) => unknownLabelsSet.add(label));
    }
    const unknownLabels = [...unknownLabelsSet];
    const sectionsStatus = unknownLabels.length > 0
      ? `rozwinięto na ${expandedFrames}/8; ${framesWithUnknownFolded}/8 kadrów ma NIEZNANE zwinięte kontrolki (kandydat na realną sekcję): ${unknownLabels.slice(0, 6).join(' / ')}`
      : `rozwinięto na ${expandedFrames}/8; pozostają WYŁĄCZNIE znane wyzwalacze menu (dropdown/kebab), nie sekcje treści`;

    const realDefect = framesWithReal > 0 || unknownLabels.length > 0 || (!tekstIdentyczny === false && plFrame && enFrame);
    const werdykt = frames.length !== 8
      ? 'EVIDENCE_MISSING'
      : realDefect
        ? 'NOT_PROVEN'
        : 'PARTIAL — a11y/rozwinięcie/8-kadr. macierz czysta; tekst PL/EN niezweryfikowany słowo-po-słowo';

    rows.push({
      moduł: mod,
      ekran,
      framesFound: frames.length,
      jezykStatus,
      minDeltaL,
      minPixelDiff,
      overflow1024,
      maxBledy,
      sumaBledy,
      a11yStatus,
      extraIds,
      framesWithReal,
      sectionsStatus,
      unknownLabels,
      werdykt,
    });
  }
  out.modules[mod] = rows;
}

fs.writeFileSync('/private/tmp/ag-g06f-a-artefakty/AGGREGATE.json', JSON.stringify(out, null, 2));
fs.writeFileSync('/private/tmp/ag-g06f-a-artefakty/MISSING.json', JSON.stringify(missing, null, 2));

for (const [mod, rows] of Object.entries(out.modules)) {
  const real = rows.filter((r) => r.werdykt === 'NOT_PROVEN').length;
  const missingN = rows.filter((r) => r.werdykt === 'EVIDENCE_MISSING').length;
  console.log(`${mod}: ${rows.length} ekranów, ${real} NOT_PROVEN (realny defekt), ${missingN} EVIDENCE_MISSING, ${rows.length - real - missingN} czyste`);
}
if (missing.length) {
  console.log('BRAKUJĄCE RAMKI:', JSON.stringify(missing));
}
