#!/usr/bin/env node
/**
 * GENERATOR STRONY ODBIORU — układ per OBIEKT, nie per funkcja.
 *
 * Właściciel odbiera OBIEKTY (artefakt, idea, dokument, generator, agent, vault),
 * a nie pojedyncze usprawnienia. Każdy obiekt otwiera się w całości; wycinki
 * funkcji wiszą pod nim jako „szczegóły". Uwagi zbiera panel wpięty w każdy ekran
 * (dev-render/PanelUwag.tsx → /__uwagi → katalog odbior-uwagi/).
 *
 * Obiekt bez ekranu jest pokazany JAWNIE jako brak — to też informacja do odbioru.
 *
 * Uruchom z katalogu worktree: node scripts/odbior-hub.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAIN = path.join(ROOT, 'dev-render/main.tsx');
const OUT = path.join(ROOT, 'dev-render/odbior.html');

/**
 * Mapa odbioru. `ekran: null` = obiekt nie ma jeszcze reprezentacji w harnessie.
 * `szczegoly` = wycinki funkcji, które dotyczą tego obiektu.
 */
const GRUPY = [
  {
    tytul: 'Artefakty (karty N)',
    opis: 'Siedem typów obiektów w My Work. Wspólna powłoka: nagłówek, lewy spis sekcji, ' +
      'prawy panel (Akcje → Właściwości → Powiązania → Komentarze → Historia), kebab.',
    obiekty: [
      { nazwa: 'Decyzja', ekran: 'karta-decision' },
      { nazwa: 'Zadanie', ekran: 'karta-task' },
      { nazwa: 'Sesja wywiadu', ekran: 'karta-interview' },
      { nazwa: 'Powiadomienie', ekran: 'karta-notification' },
      { nazwa: 'Insight', ekran: 'karta-insight' },
      { nazwa: 'Narzędzie', ekran: 'karta-tool' },
      { nazwa: 'Inicjatywa', ekran: 'karta-initiative' },
    ],
  },
  {
    tytul: 'Idea — cztery postacie tego samego obiektu',
    opis: 'Ta sama idea oglądana jako tabela, mapa myśli, tablica i diagram procesu.',
    obiekty: [
      {
        nazwa: 'Idea jako tabela',
        ekran: 'idea-table',
        szczegoly: [
          ['Menu wiersza (prawy klik)', 'idea-table-tool-kebab'],
          ['Wklejanie danych', 'idea-table-tool-paste'],
          ['Sortowanie i filtr kolumny', 'idea-table-tool-sortfilter'],
          ['Pusty filtr, szerokość kolumn, gęstość', 'idea-table-tool-empty-filter'],
          ['Grupowanie wierszy', 'idea-table-tool-grouping'],
          ['Podgląd nakładkowy', 'ideas-preview-overlay'],
          ['Prawy panel jako dokument Teresy', 'ideas-teresa-panel'],
        ],
      },
      { nazwa: 'Idea jako mapa myśli', ekran: 'mindmap-canvas' },
      {
        nazwa: 'Idea jako tablica (whiteboard)',
        ekran: 'whiteboard-canvas',
        szczegoly: [['Katalog szablonów startowych', 'idea-templates-catalog']],
      },
      { nazwa: 'Idea jako diagram procesu', ekran: 'processflow-canvas' },
    ],
  },
  {
    tytul: 'Dokumenty — gotowy wynik',
    opis: 'Dokument, prezentacja i arkusz jako obiekty, które klient dostaje do ręki.',
    obiekty: [
      {
        nazwa: 'Dokument tekstowy',
        ekran: 'document-artifact',
        szczegoly: [
          ['Oznaczenie zmyślonych danych', 'word-quality-badge'],
          ['Generowanie treści AI domyślnie', 'word-intake-uselm-default'],
          ['Puste stany bloków', 'document-studio-blocks-i18n'],
        ],
      },
      {
        nazwa: 'Prezentacja',
        ekran: 'deck-artifact',
        szczegoly: [['Oznaczenie jakości na wyniku kreatora', 'deck-quality-badge']],
      },
      {
        nazwa: 'Arkusz',
        ekran: null,
        brak: 'Arkusz nie ma jeszcze ekranu „gotowy obiekt" — jest tylko strona główna silnika.',
        szczegoly: [['Strona główna silnika arkuszy', 'excele-engine-reveal']],
      },
    ],
  },
  {
    tytul: 'Generatory dokumentów',
    opis: 'Miejsce, w którym powstaje szablon: co ma się znaleźć w każdej sekcji, slajdzie, arkuszu.',
    obiekty: [
      {
        nazwa: 'Generator dokumentu (Word)',
        ekran: 'gen-word-content-hints',
        szczegoly: [['Builder dokumentu', 'template-builder-doc']],
      },
      {
        nazwa: 'Generator prezentacji (Deck)',
        ekran: 'gen-deck-content-hints',
        szczegoly: [['Builder prezentacji', 'template-builder-deck']],
      },
      {
        nazwa: 'Generator arkusza (Excel)',
        ekran: 'gen-excel-templates-tab',
        szczegoly: [['Builder arkusza', 'template-builder-table']],
      },
    ],
  },
  {
    tytul: 'Agent i Vault',
    opis: 'Agent układa proces z klocków; Vault trzyma dokumenty klienta z poziomami dostępu.',
    obiekty: [
      {
        nazwa: 'Agent — schemat kroków',
        ekran: 'agent-plan-canvas',
        szczegoly: [['Wejście do planu działania', 'agent-plan-view']],
      },
      { nazwa: 'Vault — poziomy dostępu dokumentów', ekran: 'vault-scope-selector' },
    ],
  },
];

function znaneEkrany() {
  const src = fs.readFileSync(MAIN, 'utf8');
  const i0 = src.indexOf('const SCREENS');
  const i1 = src.indexOf('\n};\n', i0);
  const blok = src.slice(i0, i1);
  const out = new Set();
  const re = /'([a-z0-9-]+)':\s*\{/g;
  let m;
  while ((m = re.exec(blok)) !== null) out.add(m[1]);
  return out;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const link = (klucz, motyw) =>
  `/?screen=${encodeURIComponent(klucz)}&cardContract=1&lang=pl&theme=${motyw}`;

function wierszObiektu(o, znane) {
  const brakuje = !o.ekran || !znane.has(o.ekran);
  const powod = !o.ekran
    ? o.brak || 'Brak ekranu w harnessie.'
    : `Ekran „${o.ekran}" nie jest zarejestrowany w harnessie.`;

  const otworz = brakuje
    ? `<span class="brak">brak ekranu</span>`
    : `<a class="btn" href="${esc(link(o.ekran, 'light'))}">jasny</a>
       <a class="btn" href="${esc(link(o.ekran, 'dark'))}">ciemny</a>`;

  const szczegoly = (o.szczegoly || []).filter(([, k]) => znane.has(k));
  const szczegolyHtml = szczegoly.length
    ? `<div class="szczegoly">${szczegoly
        .map(
          ([etykieta, klucz]) =>
            `<a class="mini" href="${esc(link(klucz, 'light'))}">${esc(etykieta)}</a>`,
        )
        .join('')}</div>`
    : '';

  return `      <div class="obiekt${brakuje ? ' obiekt-brak' : ''}" data-ekran="${esc(o.ekran || '')}">
        <div class="obiekt-glowna">
          <div class="obiekt-nazwa">
            ${esc(o.nazwa)}
            <span class="stan" data-stan-dla="${esc(o.ekran || '')}"></span>
          </div>
          <div class="obiekt-akcje">${otworz}</div>
        </div>
        ${brakuje ? `<div class="powod">${esc(powod)}</div>` : ''}
        ${szczegolyHtml}
      </div>`;
}

function buduj(znane) {
  const dzis = new Date().toISOString().slice(0, 10);
  const grupyHtml = GRUPY.map(
    (g) => `
  <section class="card">
    <h2>${esc(g.tytul)} <span class="ile">${g.obiekty.length}</span></h2>
    <p class="opis">${esc(g.opis)}</p>
${g.obiekty.map((o) => wierszObiektu(o, znane)).join('\n')}
  </section>`,
  ).join('\n');

  const wszystkie = GRUPY.flatMap((g) => g.obiekty);
  const bezEkranu = wszystkie.filter((o) => !o.ekran || !znane.has(o.ekran));

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Odbiór — ${dzis}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 30px 28px 70px;
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f7f8fa; color: #0f172a;
  }
  .wrap { max-width: 940px; margin: 0 auto; }
  h1 { font-size: 23px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .lead { color: #475569; margin: 0 0 10px; max-width: 76ch; }
  .jak {
    background: #fff; border: 1px solid #e2e8f0; border-left: 3px solid #2563eb;
    border-radius: 10px; padding: 14px 17px; margin: 0 0 22px;
  }
  .jak b { font-weight: 600; }
  .card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 17px 19px; margin-bottom: 15px;
  }
  h2 { font-size: 15.5px; margin: 0 0 5px; display: flex; align-items: center; gap: 9px; }
  .ile { font-size: 12px; font-weight: 600; color: #475569; background: #eef2f7; border-radius: 20px; padding: 2px 9px; }
  .opis { color: #475569; font-size: 13.5px; margin: 0 0 14px; max-width: 82ch; }
  .obiekt { border-top: 1px solid #eef1f6; padding: 11px 0 9px; }
  .obiekt:first-of-type { border-top: 0; }
  .obiekt-glowna { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .obiekt-nazwa { font-size: 14.5px; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .obiekt-akcje { white-space: nowrap; }
  .btn {
    display: inline-block; padding: 5px 12px; border-radius: 7px;
    border: 1px solid #d7dee9; background: #f1f5f9; color: #0f172a;
    text-decoration: none; font-size: 13px; margin-left: 6px;
  }
  .btn:hover { background: #e2e8f0; }
  .brak { color: #b45309; font-size: 12.5px; font-weight: 600; }
  .obiekt-brak .obiekt-nazwa { color: #64748b; }
  .powod { color: #b45309; font-size: 12.5px; margin-top: 5px; max-width: 80ch; }
  .szczegoly { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .mini {
    font-size: 12px; color: #475569; text-decoration: none;
    border: 1px solid #e2e8f0; border-radius: 20px; padding: 3px 10px; background: #fbfcfe;
  }
  .mini:hover { background: #eef2f7; }
  .stan { font-size: 11.5px; font-weight: 600; border-radius: 20px; padding: 2px 8px; }
  .stan-uwagi { background: #fef3c7; color: #92400e; }
  .stan-bierzemy { background: #dcfce7; color: #166534; }
  .stan-popraw { background: #ffedd5; color: #9a3412; }
  .stan-nie { background: #fee2e2; color: #991b1b; }
  .stopka { color: #64748b; font-size: 12.5px; margin-top: 20px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
</style>
</head>
<body>
<div class="wrap">

<h1>Odbiór — ${dzis}</h1>
<p class="lead">
  Każdy obiekt otwierasz w całości i przeklikujesz. Dane są przykładowe (bez logowania i bez bazy).
</p>

<div class="jak">
  <b>Uwagi zgłaszasz na ekranie</b>, nie tutaj. W prawym dolnym rogu każdego ekranu jest przycisk
  <b>„Uwagi"</b>: wpisujesz co jest nie tak i ustawiasz werdykt (bierzemy / popraw / nie).
  Zapisuje się od razu na dysk — odczytam wszystko co zostawisz. Możesz zgłosić dowolnie dużo uwag
  do jednego ekranu. Na tej liście przy obiektach pojawiają się liczniki tego, co już zgłosiłeś.
</div>

${grupyHtml}

<p class="stopka">
  ${wszystkie.length} obiektów${bezEkranu.length ? `, w tym ${bezEkranu.length} bez ekranu (oznaczone)` : ''}.
  Strona generowana przez <code>scripts/odbior-hub.mjs</code> — nie edytuj ręcznie.
</p>

</div>
<script>
  // Liczniki uwag/werdyktów obok nazw — czytane z tego samego źródła co panel na ekranach.
  fetch('/__uwagi/wszystkie')
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (dane) {
      document.querySelectorAll('[data-stan-dla]').forEach(function (el) {
        var k = el.getAttribute('data-stan-dla');
        var z = k && dane[k];
        if (!z) return;
        var czesci = [];
        if (z.werdykt) czesci.push(z.werdykt);
        if (z.uwagi && z.uwagi.length) czesci.push(z.uwagi.length + ' uwag');
        if (!czesci.length) return;
        el.textContent = czesci.join(' · ');
        el.className = 'stan ' + (z.werdykt ? 'stan-' + z.werdykt : 'stan-uwagi');
      });
    })
    .catch(function () {});
</script>
</body>
</html>
`;
}

const znane = znaneEkrany();
if (!znane.size) {
  console.error('Nie odczytałem rejestru ekranów z dev-render/main.tsx.');
  process.exit(1);
}
fs.writeFileSync(OUT, buduj(znane), 'utf8');

const wszystkie = GRUPY.flatMap((g) => g.obiekty);
const brak = wszystkie.filter((o) => !o.ekran || !znane.has(o.ekran));
console.log(`odbior.html: ${wszystkie.length} obiektów, ${brak.length} bez ekranu`);
for (const o of brak) console.log(`  BRAK: ${o.nazwa}`);
