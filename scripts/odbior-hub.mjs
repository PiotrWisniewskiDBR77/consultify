#!/usr/bin/env node
/**
 * GENERATOR HUBA ODBIORU (klikanego, nie zrzutowego).
 *
 * Czyta rejestr ekranów z dev-render/main.tsx i buduje dev-render/odbior.html —
 * jedną stronę, z której właściciel przeklikuje wszystkie obszary na porcie 3000.
 *
 * Konwencja (to jedyne, czego trzymają się sesje robocze):
 *   'klucz-ekranu': { label: 'OBSZAR — opis co widać', ... }
 * Prefiks przed „—" decyduje o sekcji. Prefiksy z listy OBSZARY trafiają do
 * partii bieżącej; wszystko inne ląduje w „pozostałe ekrany" na dole.
 *
 * Dodanie ekranu do odbioru = dodanie wpisu w main.tsx + `node scripts/odbior-hub.mjs`.
 *
 * Uruchom z katalogu roboczego repo/worktree.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAIN = path.join(ROOT, 'dev-render/main.tsx');
const OUT = path.join(ROOT, 'dev-render/odbior.html');

/** Obszary partii bieżącej: prefiks etykiety → nagłówek sekcji + co oceniamy. */
const OBSZARY = [
  {
    prefiks: 'KARTY N',
    tytul: 'Karty N (7 typów artefaktów)',
    czego: 'Prawy panel identyczny wszędzie (Akcje → Właściwości → Powiązania → Komentarze → Historia), ' +
      'kolory znaczą to co powinny (czerwień tylko krytyczne), ciemny motyw czytelny, powiązania klikalne.',
  },
  {
    prefiks: 'IDEE',
    tytul: 'Idee — tabela, whiteboard, process flow',
    czego: 'Tabela: sortowanie, filtr, wklejanie, grupowanie, kebab wiersza, zmiana szerokości kolumn. ' +
      'Płótna: uchwyty łączników, strzałki kierunku.',
  },
  {
    prefiks: 'DOKUMENTY',
    tytul: 'Dokumenty — generatory Deck / Word / Excel',
    czego: 'Briefing per slajd/sekcja, podgląd struktury, badge jakości, wejście do generatora szablonów.',
  },
  {
    prefiks: 'AGENT',
    tytul: 'Agent i Vault',
    czego: 'Schemat kroków agenta (przestawialny), selektor poziomu dostępu dokumentów.',
  },
];

/**
 * Nazwy pisane dla właściciela — co widać na ekranie, bez nazw komponentów,
 * flag i numerów zadań. Brak wpisu = fallback na oczyszczoną etykietę z rejestru.
 */
const OPISY = {
  // Karty N
  'karta-decision': 'Decyzja',
  'karta-task': 'Zadanie',
  'karta-interview': 'Sesja wywiadu',
  'karta-notification': 'Powiadomienie',
  'karta-insight': 'Insight',
  'karta-tool': 'Narzędzie',
  'karta-initiative': 'Inicjatywa',
  'preview-4-zakladki': 'Podgląd czterech zakładek My Work',
  // Idee
  'idea-table-tool-kebab': 'Tabela — menu wiersza pod prawym klikiem',
  'idea-table-tool-paste': 'Tabela — wklejanie danych (Cmd+V)',
  'idea-table-tool-sortfilter': 'Tabela — sortowanie klikiem w nagłówek i filtr kolumny',
  'idea-table-tool-empty-filter': 'Tabela — pusty wynik filtra, szerokość kolumn, gęstość wierszy',
  'idea-table-tool-grouping': 'Tabela — grupowanie wierszy i zwijanie grup',
  'processflow-canvas': 'Diagram procesu — strzałki kierunku i etykiety połączeń',
  'whiteboard-canvas': 'Tablica — magnetyczne uchwyty łączników',
  'ideas-teresa-panel': 'Prawy panel idei jako dokument Teresy',
  // Dokumenty
  'gen-deck-content-hints': 'Generator prezentacji — briefing treści per slajd',
  'gen-word-content-hints': 'Generator dokumentu — briefing treści per sekcja',
  'gen-excel-templates-tab': 'Generator arkuszy — zakładka szablonów',
  'deck-quality-badge': 'Prezentacja — oznaczenie jakości na wyniku kreatora',
  'word-quality-badge': 'Dokument — oznaczenie zmyślonych danych w panelu kontroli',
  'word-intake-uselm-default': 'Dokument — generowanie treści AI włączone domyślnie',
  'excele-engine-reveal': 'Arkusze — strona główna silnika',
  // Agent i Vault
  'agent-plan-view': 'Agent — wejście do planu działania',
  'agent-plan-canvas': 'Agent — przestawialny schemat kroków',
  'vault-scope-selector': 'Vault — wybór poziomu dostępu przy wgrywaniu dokumentu',
};

/** Ekrany spoza konwencji prefiksu, które i tak należą do partii. */
const DOKLEJ = {
  'agent-plan-view': 'AGENT',
  'agent-plan-canvas': 'AGENT',
  'vault-scope-selector': 'AGENT',
  'processflow-canvas': 'IDEE',
  'whiteboard-canvas': 'IDEE',
  'ideas-teresa-panel': 'IDEE',
};

function czytajRejestr() {
  const src = fs.readFileSync(MAIN, 'utf8');
  const re = /'([a-z0-9-]+)':\s*\{\s*\n?\s*label:\s*\n?\s*'((?:[^'\\]|\\.)*)'/g;
  const out = new Map();
  let m;
  while ((m = re.exec(src)) !== null) {
    out.set(m[1], m[2].replace(/\\'/g, "'"));
  }
  return [...out.entries()].map(([klucz, label]) => ({ klucz, label }));
}

function przydziel(ekrany) {
  const sekcje = OBSZARY.map((o) => ({ ...o, pozycje: [] }));
  const reszta = [];
  for (const e of ekrany) {
    const prefiksDoklejony = DOKLEJ[e.klucz];
    const sekcja = sekcje.find(
      (s) => prefiksDoklejony === s.prefiks || e.label.startsWith(s.prefiks + ' '),
    );
    if (sekcja) sekcja.pozycje.push(e);
    else reszta.push(e);
  }
  return { sekcje, reszta };
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Opis ekranu = etykieta bez prefiksu obszaru i bez technicznego ogona
 * (numery zadań, nazwy flag, daty harnessu) — właściciel czyta co widzi, nie skąd to jest.
 */
function opis(label) {
  return label
    .replace(/^[A-ZĄĆĘŁŃÓŚŹŻ /]+—\s*/, '')
    .replace(/\s*\((?:harness[^)]*|audyt[^)]*|ff[^)]*|[^)]*\b20\d\d-\d\d-\d\d[^)]*)\)/gi, '')
    .replace(/\s*[—-]\s*(?:audyt\s*)?20\d\d-\d\d-\d\d\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function link(klucz, motyw) {
  return `/?screen=${encodeURIComponent(klucz)}&cardContract=1&lang=pl&theme=${motyw}`;
}

function buduj({ sekcje, reszta }) {
  const dzis = new Date().toISOString().slice(0, 10);
  const sekcjeHtml = sekcje
    .filter((s) => s.pozycje.length)
    .map(
      (s) => `
  <section class="card">
    <h2>${esc(s.tytul)} <span class="ile">${s.pozycje.length}</span></h2>
    <p class="czego">${esc(s.czego)}</p>
    <table>
      <thead><tr><th>Ekran</th><th class="kol-otworz">Otwórz</th></tr></thead>
      <tbody>
${s.pozycje
  .map(
    (e) => `        <tr>
          <td class="nazwa">${esc(OPISY[e.klucz] || opis(e.label))}</td>
          <td class="kol-otworz">
            <a class="btn" href="${esc(link(e.klucz, 'light'))}">jasny</a>
            <a class="btn" href="${esc(link(e.klucz, 'dark'))}">ciemny</a>
          </td>
        </tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
  </section>`,
    )
    .join('\n');

  const resztaHtml = `
  <details class="card">
    <summary>Pozostałe ekrany harnessu (${reszta.length}) — spoza dzisiejszej partii</summary>
    <table>
      <tbody>
${reszta
  .map(
    (e) => `        <tr>
          <td class="nazwa">${esc(OPISY[e.klucz] || opis(e.label))}</td>
          <td class="kol-otworz">
            <a class="btn" href="${esc(link(e.klucz, 'light'))}">jasny</a>
            <a class="btn" href="${esc(link(e.klucz, 'dark'))}">ciemny</a>
          </td>
        </tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
  </details>`;

  const ileWPartii = sekcje.reduce((n, s) => n + s.pozycje.length, 0);

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Odbiór — partia ${dzis}</title>
<style>
  /* Rozdzielnik trzyma JEDEN motyw (jasny) niezależnie od ustawień systemu —
     motyw oceniamy w samych ekranach, nie tutaj. */
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 32px 64px;
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f7f8fa; color: #0f172a;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 23px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .lead { color: #475569; margin: 0 0 26px; max-width: 78ch; }
  .card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 18px 20px; margin-bottom: 16px;
  }
  h2 { font-size: 15px; margin: 0 0 6px; display: flex; align-items: center; gap: 9px; }
  .ile {
    font-size: 12px; font-weight: 600; color: #475569;
    background: #eef2f7; border-radius: 20px; padding: 2px 9px;
  }
  .czego { color: #475569; font-size: 13.5px; margin: 0 0 14px; max-width: 80ch; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 8px; border-bottom: 1px solid #eef1f6; vertical-align: middle; }
  th { font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  tr:last-child td { border-bottom: 0; }
  td.nazwa { font-size: 14px; }
  .kol-otworz { width: 190px; white-space: nowrap; }
  .btn {
    display: inline-block; padding: 5px 12px; border-radius: 7px;
    border: 1px solid #d7dee9; background: #f1f5f9; color: #0f172a;
    text-decoration: none; font-size: 13px; margin-right: 6px;
  }
  .btn:hover { background: #e2e8f0; }
  summary { cursor: pointer; font-size: 14px; font-weight: 600; color: #475569; }
  details[open] summary { margin-bottom: 12px; }
  ol { margin: 0; padding-left: 20px; } ol li { margin-bottom: 8px; }
  .stopka { color: #64748b; font-size: 13px; margin-top: 22px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
</style>
</head>
<body>
<div class="wrap">

<h1>Odbiór — partia ${dzis}</h1>
<p class="lead">
  Wszystkie obszary w jednym miejscu, do przeklikania. Dane są przykładowe (bez logowania i bez bazy) —
  oceniamy wygląd i zachowanie, nie treść. Ekrany mają krótką animację wejścia, więc przez pierwszą
  sekundę wyglądają na przygaszone; to nie usterka. Powrót tutaj: <code>/odbior.html</code>.
</p>

${sekcjeHtml}

<section class="card">
  <h2>Jak to odbieramy</h2>
  <ol>
    <li>Klikasz obszar po obszarze. Przy każdym mówisz <strong>bierzemy</strong> /
        <strong>popraw &lt;co&gt;</strong> / <strong>nie</strong>.</li>
    <li>„Bierzemy" dla obszaru = ten obszar idzie na demo. Obszary są niezależne —
        odrzucenie jednego nie blokuje reszty.</li>
    <li>Nie oceniamy tu treści pisanej przez AI ani danych — to osobna partia.</li>
  </ol>
</section>

${resztaHtml}

<p class="stopka">
  ${ileWPartii} ekranów w partii, ${reszta.length} archiwalnych.
  Stronę generuje <code>scripts/odbior-hub.mjs</code> z rejestru <code>dev-render/main.tsx</code> —
  nie edytuj jej ręcznie.
</p>

</div>
</body>
</html>
`;
}

const ekrany = czytajRejestr();
if (!ekrany.length) {
  console.error('Nie znalazłem żadnego ekranu w dev-render/main.tsx — sprawdź konwencję rejestru.');
  process.exit(1);
}
const przydzial = przydziel(ekrany);
fs.writeFileSync(OUT, buduj(przydzial), 'utf8');

const wPartii = przydzial.sekcje.reduce((n, s) => n + s.pozycje.length, 0);
console.log(`odbior.html zbudowany: ${wPartii} w partii, ${przydzial.reszta.length} archiwalnych`);
for (const s of przydzial.sekcje) console.log(`  ${s.tytul}: ${s.pozycje.length}`);
