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

  // Klucz uwag: ekran, a dla obiektu bez ekranu — stabilny klucz z nazwy,
  // żeby braki też dało się skomentować.
  const kluczUwag = o.ekran || 'obiekt-' + o.nazwa.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `      <div class="obiekt${brakuje ? ' obiekt-brak' : ''}" data-klucz="${esc(kluczUwag)}">
        <div class="obiekt-glowna">
          <div class="obiekt-nazwa">
            ${esc(o.nazwa)}
            <span class="stan" data-stan-dla="${esc(kluczUwag)}"></span>
          </div>
          <div class="obiekt-akcje">
            <button class="btn btn-uwaga" data-uwaga-dla="${esc(kluczUwag)}">uwaga</button>
            ${otworz}
          </div>
        </div>
        ${brakuje ? `<div class="powod">${esc(powod)}</div>` : ''}
        ${szczegolyHtml}
        <div class="uwagi-box" data-box-dla="${esc(kluczUwag)}" hidden>
          <div class="uwagi-lista"></div>
          <div class="werdykty">
            <button class="w" data-w="bierzemy">bierzemy</button>
            <button class="w" data-w="popraw">popraw</button>
            <button class="w" data-w="nie">nie</button>
          </div>
          <textarea rows="2" placeholder="Co jest nie tak w tym obiekcie…"></textarea>
          <div class="uwagi-stopka">
            <button class="btn btn-dodaj">Dodaj uwagę</button>
            <span class="uwagi-stan"></span>
          </div>
        </div>
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
  .btn-uwaga { background: #fff; }
  .uwagi-box {
    margin-top: 10px; padding: 12px 13px; background: #f8fafc;
    border: 1px solid #e2e8f0; border-radius: 10px;
  }
  .uwagi-lista { margin-bottom: 9px; }
  .uwagi-lista .u {
    background: #fff; border: 1px solid #e8edf3; border-radius: 7px;
    padding: 6px 9px; margin-bottom: 5px; font-size: 13px; line-height: 1.45;
  }
  .uwagi-lista .u i { color: #94a3b8; font-style: normal; font-size: 11.5px; margin-right: 5px; }
  .uwagi-lista .pusto { color: #94a3b8; font-size: 12.5px; margin-bottom: 8px; }
  .werdykty { display: flex; gap: 6px; margin-bottom: 9px; }
  .werdykty .w {
    flex: 1; padding: 5px 6px; border-radius: 7px; border: 1px solid #d7dee9;
    background: #fff; color: #334155; font-size: 12.5px; cursor: pointer;
  }
  .werdykty .w:hover { background: #eef2f7; }
  .werdykty .w[data-wybrany="1"][data-w="bierzemy"] { background: #dcfce7; border-color: #86efac; color: #166534; font-weight: 600; }
  .werdykty .w[data-wybrany="1"][data-w="popraw"] { background: #ffedd5; border-color: #fdba74; color: #9a3412; font-weight: 600; }
  .werdykty .w[data-wybrany="1"][data-w="nie"] { background: #fee2e2; border-color: #fca5a5; color: #991b1b; font-weight: 600; }
  .uwagi-box textarea {
    width: 100%; resize: vertical; border: 1px solid #d7dee9; border-radius: 8px;
    padding: 7px 9px; font: inherit; font-size: 13px; margin-bottom: 8px; background: #fff;
  }
  .uwagi-stopka { display: flex; align-items: center; gap: 10px; }
  .btn-dodaj { background: #2563eb; color: #fff; border-color: #2563eb; margin-left: 0; cursor: pointer; }
  .btn-dodaj:hover { background: #1d4ed8; }
  .uwagi-stan { color: #64748b; font-size: 11.5px; }
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
  // Uwagi zapisujemy tam samo, co panel na ekranach (/__uwagi) — jedno źródło prawdy,
  // więc uwaga dodana z listy i z ekranu trafia do tego samego pliku.
  var STAN = {};

  function odswiezWiersz(klucz) {
    var z = STAN[klucz] || { ekran: klucz, werdykt: null, uwagi: [] };

    var chip = document.querySelector('[data-stan-dla="' + klucz + '"]');
    if (chip) {
      var czesci = [];
      if (z.werdykt) czesci.push(z.werdykt);
      if (z.uwagi.length) czesci.push(z.uwagi.length + (z.uwagi.length === 1 ? ' uwaga' : ' uwagi'));
      chip.textContent = czesci.join(' · ');
      chip.className = 'stan ' + (czesci.length ? (z.werdykt ? 'stan-' + z.werdykt : 'stan-uwagi') : '');
    }

    var box = document.querySelector('[data-box-dla="' + klucz + '"]');
    if (!box) return;
    var lista = box.querySelector('.uwagi-lista');
    lista.innerHTML = z.uwagi.length
      ? z.uwagi.map(function (u, i) {
          var d = document.createElement('div');
          d.textContent = u.tekst;
          return '<div class="u"><i>' + (i + 1) + '.</i>' + d.innerHTML + '</div>';
        }).join('')
      : '<div class="pusto">Brak uwag do tego obiektu.</div>';
    box.querySelectorAll('.w').forEach(function (b) {
      if (z.werdykt === b.getAttribute('data-w')) b.setAttribute('data-wybrany', '1');
      else b.removeAttribute('data-wybrany');
    });
  }

  function zapisz(klucz, zmiana, stanEl) {
    var z = STAN[klucz] || { ekran: klucz, werdykt: null, uwagi: [] };
    var nowy = { ekran: klucz, werdykt: 'werdykt' in zmiana ? zmiana.werdykt : z.werdykt,
                 uwagi: zmiana.uwagi || z.uwagi };
    if (stanEl) stanEl.textContent = 'zapisuję…';
    return fetch('/__uwagi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(nowy),
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      STAN[klucz] = nowy;
      odswiezWiersz(klucz);
      if (stanEl) { stanEl.textContent = 'zapisano'; setTimeout(function () { stanEl.textContent = ''; }, 1500); }
    }).catch(function () { if (stanEl) stanEl.textContent = 'błąd zapisu'; });
  }

  document.addEventListener('click', function (e) {
    var przycisk = e.target.closest('.btn-uwaga');
    if (przycisk) {
      var k = przycisk.getAttribute('data-uwaga-dla');
      var box = document.querySelector('[data-box-dla="' + k + '"]');
      box.hidden = !box.hidden;
      if (!box.hidden) box.querySelector('textarea').focus();
      return;
    }
    var w = e.target.closest('.werdykty .w');
    if (w) {
      var box2 = w.closest('.uwagi-box');
      var k2 = box2.getAttribute('data-box-dla');
      var biezacy = (STAN[k2] || {}).werdykt;
      var nowy = w.getAttribute('data-w');
      zapisz(k2, { werdykt: biezacy === nowy ? null : nowy }, box2.querySelector('.uwagi-stan'));
      return;
    }
    var dodaj = e.target.closest('.btn-dodaj');
    if (dodaj) {
      var box3 = dodaj.closest('.uwagi-box');
      var k3 = box3.getAttribute('data-box-dla');
      var ta = box3.querySelector('textarea');
      var tekst = ta.value.trim();
      if (!tekst) return;
      var poprzednie = (STAN[k3] || {}).uwagi || [];
      zapisz(k3, { uwagi: poprzednie.concat([{ tekst: tekst, czas: new Date().toISOString() }]) },
             box3.querySelector('.uwagi-stan'));
      ta.value = '';
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.tagName === 'TEXTAREA') {
      var box = e.target.closest('.uwagi-box');
      if (box) box.querySelector('.btn-dodaj').click();
    }
  });

  fetch('/__uwagi/wszystkie')
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (dane) {
      STAN = dane || {};
      Object.keys(STAN).forEach(odswiezWiersz);
      document.querySelectorAll('[data-box-dla]').forEach(function (b) {
        odswiezWiersz(b.getAttribute('data-box-dla'));
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
