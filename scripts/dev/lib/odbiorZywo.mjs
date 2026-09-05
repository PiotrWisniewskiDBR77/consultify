/**
 * ODBIÓR NA ŻYWO 05.09 — dane i HTML strony `/zywo`.
 *
 * Po co ten plik istnieje osobno: `odbior-serwer.mjs` już jest duży (877 linii)
 * i miesza w sobie HTTP, SQLite i budowanie stron. Ta strona jest NOWYM,
 * niezależnym kawałkiem (inne źródło danych — `evidence/odbior-zywo-<data>/`,
 * inny cel — porównanie zatwierdzone vs na żywo, nie sam odbiór zrzutów), więc
 * trzymamy ją w osobnym module, żeby dało się przetestować bez uruchamiania
 * prawdziwego serwera HTTP (wzór: `lib/kartyModulow.mjs` + `lib/stylModulow.mjs`
 * dla widoku modułowego).
 *
 * WEJŚCIE (produkują je równolegle inni agenci, struktura ustalona z góry):
 *   evidence/odbior-zywo-<data>/<katalog>/wyniki.json — tablica obiektów:
 *   { id, werdykt: 'ZGODNY'|'ROZNI_SIE'|'NIE_DOTARLEM', opis, zrzut, trasa, kliki, kiedy }
 *
 * Katalog może NIE ISTNIEĆ w momencie odczytu (inni agenci jeszcze piszą) —
 * każda funkcja tutaj musi to przeżyć w ciszy, zwracając pustą mapę, nigdy
 * rzucając wyjątkiem. To jest jedyny powód klauzul try/catch poniżej.
 */
import fs from 'node:fs';
import path from 'node:path';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Scala WSZYSTKIE `evidence/odbior-zywo-<data>/<katalog>/wyniki.json` w jedną
 * mapę id → wynik. Brak katalogu głównego, brak pliku w podkatalogu, zepsuty
 * JSON, wpis bez `id` — każdy z tych przypadków jest po prostu pomijany.
 * Zero pomiaru NIE JEST wynikiem (patrz: `brak-pomiaru-nie-jest-wynikiem` w
 * pamięci nadzorcy) — dlatego strona wyżej musi odróżniać „BRAK WYNIKU" od
 * jakiegokolwiek werdyktu, a ta funkcja nigdy nie zgaduje wartości domyślnej.
 */
export function indeksWynikowZywo(zywoDir) {
  const out = {};
  if (!zywoDir) return out;
  let wpisy;
  try {
    wpisy = fs.readdirSync(zywoDir);
  } catch {
    return out; // katalog jeszcze nie istnieje — to jest oczekiwany stan startowy
  }
  for (const katalog of wpisy) {
    const full = path.join(zywoDir, katalog);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const wynikiPath = path.join(full, 'wyniki.json');
    if (!fs.existsSync(wynikiPath)) continue;
    let dane;
    try {
      dane = JSON.parse(fs.readFileSync(wynikiPath, 'utf8'));
    } catch {
      continue; // JSON zepsuty w trakcie zapisu przez innego agenta — pomijamy, nie wywalamy strony
    }
    if (!Array.isArray(dane)) continue;
    for (const w of dane) {
      if (w && typeof w.id === 'string' && w.id) out[w.id] = { ...w, _katalog: katalog };
    }
  }
  return out;
}

/**
 * Dla każdego id ekranu — NAJNOWSZY plik pasujący do wzorca
 * evidence/grafika/(dowolny podkatalog)/<id>*light*.png.
 * Wygrywa mtime, nie kolejność katalogów (ta sama pułapka co w `indeksZrzutow()`
 * w `odbior-serwer.mjs`: katalogi `evidence/grafika/*` sortują się tekstowo,
 * „15-" potrafi wylądować alfabetycznie za „144-", więc branie „ostatniego
 * napotkanego" przykrywałoby świeży zrzut starym).
 */
export function indeksZatwierdzonychLight(evidDir) {
  const out = {};
  if (!evidDir) return out;
  const walk = (dir) => {
    let wpisy;
    try {
      wpisy = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const w of wpisy) {
      const full = path.join(dir, w.name);
      if (w.isDirectory()) {
        walk(full);
        continue;
      }
      if (!w.name.endsWith('.png') || !w.name.toLowerCase().includes('light')) continue;
      const id = w.name.split('__')[0];
      if (!id) continue;
      let mtime;
      try {
        mtime = fs.statSync(full).mtimeMs;
      } catch {
        continue;
      }
      if (!out[id] || mtime > out[id].mtime) out[id] = { pelna: full, mtime };
    }
  };
  try {
    walk(evidDir);
  } catch {
    /* brak katalogu evidence/grafika — pusta mapa, nie awaria */
  }
  return out;
}

export const WERDYKT_ETYKIETA = {
  ZGODNY: 'ZGODNY',
  ROZNI_SIE: 'RÓŻNI SIĘ',
  NIE_DOTARLEM: 'NIE DOTARŁEM',
};

/** Liczniki nagłówka — ile ekranów A/B ma który werdykt, ile jeszcze bez wyniku. */
export function liczZywe(ekranyAB, wyniki) {
  const n = { razem: ekranyAB.length, ZGODNY: 0, ROZNI_SIE: 0, NIE_DOTARLEM: 0, BRAK: 0 };
  for (const e of ekranyAB) {
    const w = wyniki[e.id];
    const kod = w && w.werdykt;
    if (kod && Object.prototype.hasOwnProperty.call(WERDYKT_ETYKIETA, kod)) n[kod]++;
    else n.BRAK++;
  }
  return n;
}

/** Ścieżka pliku (absolutna) → segment URL pod `/ev/…`, względem katalogu evidence/. */
function urlEv(evidenceRoot, pelnaSciezka) {
  const rel = path.relative(evidenceRoot, pelnaSciezka).split(path.sep).join('/');
  return '/ev/' + rel.split('/').map(encodeURIComponent).join('/');
}

/** `zrzut` z wyniki.json bywa podane jako `evidence/...` (od korzenia repo) — zdejmujemy prefiks. */
function urlEvZRelacji(zrzutRel) {
  const bezPrefiksu = String(zrzutRel || '').replace(/^evidence[\\/]/, '');
  return '/ev/' + bezPrefiksu.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/');
}

function obraz(etykieta, url, dostepny) {
  if (!dostepny || !url) {
    return `<figure class="brak"><figcaption>${esc(etykieta)}</figcaption><div class="brakObrazu">brak obrazu</div></figure>`;
  }
  return `<figure><figcaption>${esc(etykieta)}</figcaption><a href="${url}" target="_blank" rel="noopener"><img loading="lazy" src="${url}" alt="${esc(etykieta)}"></a></figure>`;
}

/**
 * Jedna karta ekranu na stronie `/zywo`.
 * `ctx`: { evidenceRoot, decyzjaGlowna (uwaga z ODBIOR_DECYZJE.json), decyzjaZywo }
 */
export function kartaZywo(e, wynik, zatwLight, ctx) {
  const werdykt = wynik && wynik.werdykt;
  const znanyWerdykt = werdykt && WERDYKT_ETYKIETA[werdykt];
  const etykietaWerdyktu = znanyWerdykt ? WERDYKT_ETYKIETA[werdykt] : 'BRAK WYNIKU (jeszcze nie sprawdzony)';
  const klasaWerdyktu = znanyWerdykt ? 'w-' + werdykt : 'w-BRAK';

  const zatw = zatwLight[e.id];
  const zatwUrl = zatw ? urlEv(ctx.evidenceRoot, zatw.pelna) : '';
  const zywyUrl = wynik && wynik.zrzut ? urlEvZRelacji(wynik.zrzut) : '';

  const dGlowna = ctx.decyzjaGlowna || {};
  const dZywo = ctx.decyzjaZywo || {};

  const btn = (kod, etykieta) =>
    `<button type="button" class="bz ${kod} ${dZywo.decyzja === kod ? 'on' : ''}" data-id="${esc(e.id)}" data-d="${kod}">${esc(etykieta)}</button>`;

  return `<article class="kz ${klasaWerdyktu}" id="z-${esc(e.id)}" data-werdykt="${esc(werdykt || '')}" data-stan="${esc(dZywo.decyzja || '')}">
  <header>
    <h3>${esc(e.nazwa)} <code>${esc(e.id)}</code></h3>
    <span class="o o${esc(e.ocena)}">${esc(e.ocena)}</span>
  </header>
  <span class="werdykt ${klasaWerdyktu}">${esc(etykietaWerdyktu)}</span>
  ${wynik && wynik.opis ? `<p class="opisRoznicy">${esc(wynik.opis)}</p>` : ''}
  ${wynik && wynik.trasa ? `<p class="trasa">trasa: <code>${esc(wynik.trasa)}</code></p>` : ''}
  ${wynik && Array.isArray(wynik.kliki) && wynik.kliki.length ? `<p class="kliki">kliki: ${wynik.kliki.map((k) => `<code>${esc(k)}</code>`).join(' → ')}</p>` : ''}
  <div class="obrazyZ">
    ${obraz('Zatwierdzone', zatwUrl, !!zatw)}
    ${obraz('Na żywo 05.09', zywyUrl, !!(wynik && wynik.zrzut))}
  </div>
  ${dGlowna.uwaga ? `<div class="uwagaGlowna"><b>Uwaga właściciela (odbiór grafiki):</b> ${esc(dGlowna.uwaga)}</div>` : ''}
  <div class="akcjeZ">
    ${btn('ok', 'OK na żywo')}
    ${btn('poprawka', 'Do poprawki')}
  </div>
  <input class="uwz" data-id="${esc(e.id)}" placeholder="uwaga o stanie na żywo (opcjonalnie) — zapisuje się sama" value="${esc(dZywo.uwaga || '')}">
  <div class="zapisZ ${dZywo.kiedy ? 'jest' : ''}">${dZywo.kiedy ? `w bazie: ${esc(dZywo.decyzja === 'ok' ? 'OK na żywo' : dZywo.decyzja === 'poprawka' ? 'Do poprawki' : 'bez decyzji')}${dZywo.uwaga ? ', z uwagą' : ''} · ${esc(new Date(dZywo.kiedy).toLocaleString('pl-PL'))}` : ''}</div>
</article>`;
}

export const STYL_ZYWO = `
:root{--tlo:#f7f8fa;--karta:#fff;--tekst:#0f172a;--drugi:#475569;--kres:#e2e8f0;--ok:#15803d;--pop:#b45309;--zle:#9f1239;--nieb:#1d4ed8}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--kres);padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.pasek h1{font-size:16px;margin:0;font-weight:650}
.licznikiZ{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--drugi)}
.licznikiZ b{color:var(--tekst);font-variant-numeric:tabular-nums}
.licznikiZ .zgodny b{color:var(--ok)}
.licznikiZ .rozni b{color:var(--zle)}
.licznikiZ .niedotarlem b{color:var(--pop)}
.filtryZ{display:flex;gap:7px;margin-left:auto}
.filtryZ button{border:1px solid var(--kres);background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer}
.filtryZ button.on{background:var(--tekst);color:#fff;border-color:var(--tekst)}
.stanZ{font-size:12.5px;padding:3px 10px;border-radius:999px;background:#f1f5f9;color:var(--drugi)}
.stanZ.dobrze{background:#dcfce7;color:#14532d}
.stanZ.zle{background:#fee2e2;color:#7f1d1d;font-weight:650}
main{padding:20px;max-width:1500px;margin:0 auto}
.mz{margin-bottom:34px}
.mz h2{font-size:19px;margin:0 0 12px;font-weight:650}
.mz h2 small{color:var(--drugi);font-weight:500;font-size:13px;margin-left:6px}
.kartyZ{display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:16px}
.kz{background:var(--karta);border:1px solid var(--kres);border-radius:12px;padding:14px}
.kz.w-ROZNI_SIE{border-color:var(--zle);box-shadow:inset 3px 0 0 var(--zle)}
.kz.w-NIE_DOTARLEM{border-color:var(--pop);box-shadow:inset 3px 0 0 var(--pop)}
.kz.w-ZGODNY{border-color:var(--ok)}
.kz header{display:flex;justify-content:space-between;align-items:start;gap:10px}
.kz h3{font-size:15px;margin:0 0 6px;font-weight:620}
.kz h3 code{font-weight:400;font-size:11.5px;color:var(--drugi);margin-left:6px}
.o{font-size:11px;font-weight:700;border-radius:5px;padding:2px 7px;flex:none}
.oA{background:#dcfce7;color:#14532d}.oB{background:#fef3c7;color:#78350f}
.werdykt{display:inline-block;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;margin:2px 0 8px;background:#f1f5f9;color:var(--drugi)}
.werdykt.w-ZGODNY{background:#dcfce7;color:#14532d}
.werdykt.w-ROZNI_SIE{background:#fee2e2;color:#7f1d1d}
.werdykt.w-NIE_DOTARLEM{background:#fef3c7;color:#78350f}
.werdykt.w-BRAK{background:#f1f5f9;color:var(--drugi)}
.opisRoznicy{margin:0 0 6px;font-size:13.5px;color:var(--drugi)}
.trasa,.kliki{margin:0 0 4px;font-size:12px;color:var(--drugi)}
.trasa code,.kliki code{background:#f1f5f9;border-radius:4px;padding:1px 5px}
.obrazyZ{display:flex;gap:8px;margin:10px 0}
.obrazyZ figure{margin:0;flex:1;min-width:0;max-width:50%}
.obrazyZ figcaption{font-size:11px;color:var(--drugi);margin-bottom:3px}
.obrazyZ img{width:100%;border:1px solid var(--kres);border-radius:7px;display:block;background:#fff}
.brakObrazu{border:1px dashed var(--kres);border-radius:7px;padding:24px 10px;text-align:center;font-size:12px;color:#94a3b8;background:#fbfcfd}
.uwagaGlowna{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 10px;font-size:12.5px;color:#1e3a8a;margin:8px 0}
.akcjeZ{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px}
.bz{border:1px solid var(--kres);background:#fff;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;font-weight:550}
.bz.ok.on{background:var(--ok);color:#fff;border-color:var(--ok)}
.bz.poprawka.on{background:var(--pop);color:#fff;border-color:var(--pop)}
.bz:focus-visible,.uwz:focus-visible{outline:2px solid var(--nieb);outline-offset:1px}
.uwz{width:100%;margin-top:8px;border:1px solid var(--kres);border-radius:8px;padding:6px 9px;font-size:13px;font-family:inherit}
.zapisZ{font-size:11.5px;margin-top:6px;min-height:15px;color:var(--drugi)}
.zapisZ.jest{color:var(--ok)}
.ukrytaZ{display:none}
`;

/**
 * Skrypt front-endu strony `/zywo` — filtr + zapis decyzji (identyczny debounce
 * uwagi co na stronie głównej: 800 ms ciszy, natychmiast przy `focusout`, i
 * `sendBeacon` przy zamknięciu karty, żeby ostatnia uwaga nie zginęła).
 */
export const SKRYPT_ZYWO = `
const stanZ = document.getElementById('stanZ');
const pokazZ = (t, zle) => { stanZ.textContent = t; stanZ.className = 'stanZ ' + (zle ? 'zle' : 'dobrze'); };
const SLOWO_Z = { ok: 'OK na żywo', poprawka: 'Do poprawki' };
function wyslijZ(id, dane) {
  const karta = document.getElementById('z-' + id);
  const znacznik = karta && karta.querySelector('.zapisZ');
  if (znacznik) { znacznik.textContent = 'zapisuję…'; znacznik.className = 'zapisZ'; }
  pokazZ('zapisuję…', false);
  return fetch('/decyzja-zywo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...dane }) })
    .then(async (r) => {
      const dane = await r.json().catch(() => ({}));
      if (!r.ok || !dane.ok) throw new Error(dane.blad || ('serwer odpowiedział ' + r.status));
      const w = dane.wiersz || {};
      const godzina = new Date(w.kiedy).toLocaleTimeString('pl-PL');
      const opis = [w.decyzja ? SLOWO_Z[w.decyzja] : 'bez decyzji', w.uwaga ? 'z uwagą' : null].filter(Boolean).join(', ');
      if (znacznik) { znacznik.textContent = 'w bazie: ' + opis + ' · ' + godzina; znacznik.className = 'zapisZ jest'; }
      pokazZ('zapisane w bazie', false);
    })
    .catch((e) => {
      if (znacznik) { znacznik.textContent = 'NIE ZAPISANO'; znacznik.className = 'zapisZ'; }
      pokazZ('NIE ZAPISANO — ' + e.message, true);
    });
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.bz');
  if (b) {
    const karta = b.closest('.kz');
    const nowa = karta.dataset.stan === b.dataset.d ? '' : b.dataset.d;
    karta.dataset.stan = nowa;
    karta.querySelectorAll('.bz').forEach((x) => x.classList.toggle('on', !!nowa && x.dataset.d === nowa));
    wyslijZ(b.dataset.id, { decyzja: nowa });
    return;
  }
  const f = ev.target.closest('.filtryZ button');
  if (f) {
    document.querySelectorAll('.filtryZ button').forEach((x) => x.classList.toggle('on', x === f));
    const tryb = f.dataset.f;
    document.querySelectorAll('.kz').forEach((k) => {
      const w = k.dataset.werdykt;
      const pokaz = tryb === 'wszystkie' ? true : tryb === 'roznice' ? w === 'ROZNI_SIE' : tryb === 'niedotarlem' ? w === 'NIE_DOTARLEM' : true;
      k.classList.toggle('ukrytaZ', !pokaz);
    });
  }
});
const uwagiStanZ = new Map();
function stanPolaZ(id) { let s = uwagiStanZ.get(id); if (!s) { s = { timer: null, ostatnia: undefined }; uwagiStanZ.set(id, s); } return s; }
function wyslijUwageTerazZ(u) {
  const id = u.dataset.id; const s = stanPolaZ(id);
  clearTimeout(s.timer); s.timer = null;
  if (s.ostatnia === u.value) return;
  s.ostatnia = u.value;
  wyslijZ(id, { uwaga: u.value });
}
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uwz'); if (!u) return;
  const s = stanPolaZ(u.dataset.id);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => wyslijUwageTerazZ(u), 800);
});
document.addEventListener('focusout', (ev) => { const u = ev.target.closest('.uwz'); if (u) wyslijUwageTerazZ(u); });
window.addEventListener('pagehide', () => {
  document.querySelectorAll('.uwz').forEach((u) => {
    const s = stanPolaZ(u.dataset.id);
    if (!s.timer && s.ostatnia === u.value) return;
    clearTimeout(s.timer);
    if (s.ostatnia === u.value) return;
    s.ostatnia = u.value;
    const cialo = JSON.stringify({ id: u.dataset.id, uwaga: u.value });
    navigator.sendBeacon('/decyzja-zywo', new Blob([cialo], { type: 'application/json' }));
  });
});
`;

/**
 * Buduje całą stronę `/zywo`.
 * `params`: { status, zywoDir, evidenceRoot, decyzjeGlowne, decyzjeZywo }
 *  - status: obiekt z docs/program/grafika/status.json (już wczytany)
 *  - decyzjeGlowne: mapa id → { decyzja, uwaga, kiedy } z ODBIOR_DECYZJE.json (odbiór grafiki)
 *  - decyzjeZywo: mapa id → { decyzja, uwaga, kiedy } z decyzje_zywo
 */
export function stronaZywo(params) {
  const { status, zywoDir, evidenceRoot, decyzjeGlowne = {}, decyzjeZywo = {} } = params;
  const wyniki = indeksWynikowZywo(zywoDir);
  const zatwLight = indeksZatwierdzonychLight(path.join(evidenceRoot, 'grafika'));

  const wszystkieAB = [];
  const sekcje = [];
  // Kolejność: tak jak w pliku status.json (pole `_kolejnosc` jest opisem
  // słownym ustalonej kolejności menu, nie tablicą do sortowania — kolejność
  // modułów w samym `status.moduly` JEST tą ustaloną kolejnością).
  for (const m of status.moduly || []) {
    const ekrany = (m.ekrany || []).filter((e) => e.ocena === 'A' || e.ocena === 'B');
    if (!ekrany.length) continue;
    wszystkieAB.push(...ekrany);
    const karty = ekrany
      .map((e) =>
        kartaZywo(e, wyniki[e.id], zatwLight, {
          evidenceRoot,
          decyzjaGlowna: decyzjeGlowne[e.id],
          decyzjaZywo: decyzjeZywo[e.id],
        })
      )
      .join('');
    sekcje.push(`<section class="mz">
  <h2>${esc(m.nazwa)}<small>${ekrany.length}</small></h2>
  <div class="kartyZ">${karty}</div>
</section>`);
  }

  const n = liczZywe(wszystkieAB, wyniki);

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Na żywo 05.09 — zatwierdzone vs jak jest</title><style>${STYL_ZYWO}</style></head><body>
<div class="pasek">
  <h1>Na żywo 05.09 — jak zatwierdzone vs jak jest</h1>
  <span class="licznikiZ">
    <span><b>${n.razem}</b> ekranów A/B</span>
    <span class="zgodny"><b>${n.ZGODNY}</b> zgodny</span>
    <span class="rozni"><b>${n.ROZNI_SIE}</b> różni się</span>
    <span class="niedotarlem"><b>${n.NIE_DOTARLEM}</b> nie dotarłem</span>
    <span><b>${n.BRAK}</b> brak wyniku</span>
  </span>
  <span class="stanZ" id="stanZ">gotowe</span>
  <span class="filtryZ">
    <button data-f="wszystkie" class="on">wszystkie</button>
    <button data-f="roznice">tylko różnice</button>
    <button data-f="niedotarlem">tylko nie dotarłem</button>
  </span>
</div>
<main>
${sekcje.join('\n') || '<p style="padding:20px;color:#475569">Brak ekranów A/B w status.json.</p>'}
</main>
<script>${SKRYPT_ZYWO}</script>
</body></html>`;
}
