/**
 * STRONA `/final` — EKRAN FINALNYCH ZATWIERDZEŃ MODUŁÓW MVP (2026-09-05).
 *
 * POWÓD ISTNIENIA: właściciel, wyczerpany po rundach `/decyzje`/`/krok`/`/zywo`
 * (ekran po ekranie, dzień w dzień), poprosił wprost o coś prostszego — "zrób mi
 * ekran finalnych zatwierdzeń ... nie chcę się już wkurwiać". To NIE jest kolejny
 * przegląd zrzutów: to jest JEDNA karta na moduł z 16-modułowego menu, jeden
 * werdykt CTO zdaniem po polsku, i jeden przycisk — widoczny i klikalny tylko
 * wtedy, gdy moduł jest naprawdę gotowy do zatwierdzenia.
 *
 * ŹRÓDŁO DANYCH: `docs/program/ODBIOR_CTO_20260905/status.json`. CTO edytuje ten
 * plik RĘCZNIE w miarę odbioru kolejnych modułów — strona nie liczy niczego sama,
 * tylko go czyta, przy KAŻDYM żądaniu (zero cache), żeby zmiana w pliku była
 * widoczna natychmiast po zapisaniu, bez restartu serwera.
 *
 * KOLEJNOŚĆ I NAZWY MODUŁÓW: `scripts/mvp-final/moduly.mjs` (ten sam SSOT co
 * zamrożenie i `docs/FUNCTIONAL_DOCUMENTATION.md`) — 16 modułów, ID w kształcie
 * `NN_NAZWA`. Ta strona NIE zgaduje nazw ani kolejności z żadnego innego miejsca.
 *
 * ZATWIERDZENIE: klik zapisuje się przez ISTNIEJĄCY `/decyzja-zywo` (ta sama
 * tabela `decyzje_zywo` co `/decyzje`/`/zywo` — klucz `FINAL:<MODUL_ID>`), więc
 * nie powstaje trzeci, sprzeczny rejestr odpowiedzi właściciela. Serwer
 * (`odbior-serwer.mjs`) dopisuje przy tej okazji linię do `DO_ZAMROZENIA.txt` —
 * logika dopisywania osobno w `dopiszDoZamrozenia()` niżej, żeby dało się ją
 * przetestować bez stawiania HTTP.
 *
 * Osobny moduł z tego samego powodu co `lib/odbiorZywo.mjs`/`lib/odbiorDecyzje.mjs`:
 * `odbior-serwer.mjs` już jest duży, a to jest NOWY, niezależny ekran.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MODULY } from '../../mvp-final/moduly.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Kolejność + nazwy modułów wprost z `scripts/mvp-final/moduly.mjs` — 16 pozycji, bez zgadywania. */
export function listaModulow() {
  return Object.entries(MODULY).map(([kod, def]) => ({ kod, nazwa: def.nazwa }));
}

const STANY = new Set(['GOTOWY', 'W_TOKU', 'ZAMROZONY']);

/** Czyta `status.json` przy KAŻDYM wywołaniu — brak pliku/zepsuty JSON nie ma prawa ubić strony. */
export function czytajStatusFinal(statusPath) {
  try {
    const dane = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    return (dane && typeof dane.moduly === 'object' && dane.moduly) || {};
  } catch (e) {
    console.error('czytajStatusFinal: nie wczytano', statusPath, String(e && e.message));
    return {};
  }
}

/**
 * Rozwija wpisy `zrzuty` do konkretnych plików .png, max `limit` łącznie.
 * Dwa kształty wejścia (współistnieją w tej samej tablicy):
 *  - ścieżka LITERALNA do pliku (`evidence/.../nazwa.png`) — bierzemy wprost;
 *  - GLOB katalogowy (`evidence/.../*.png`) — czytamy katalog, bierzemy pliki
 *    .png posortowane alfabetycznie. Dzięki temu CTO może wskazać jeden plik
 *    ręcznie ALBO cały katalog naraz, bez wymyślania nazw z góry.
 * Brak katalogu/pliku jest CISZĄ, nie błędem — karta ma wtedy po prostu mniej
 * (albo zero) zrzutów, nie wywraca strony.
 */
export function rozwinZrzuty(root, wpisy, limit = 4) {
  const out = [];
  for (const w of wpisy || []) {
    if (out.length >= limit) break;
    const s = String(w || '').trim();
    if (!s) continue;
    if (s.includes('*')) {
      const dir = path.join(root, path.dirname(s));
      let pliki = [];
      try {
        pliki = fs
          .readdirSync(dir)
          .filter((f) => f.toLowerCase().endsWith('.png'))
          .sort();
      } catch {
        pliki = []; // katalog jeszcze nie istnieje — CTO nie dodał zrzutów, to nie awaria
      }
      for (const f of pliki) {
        if (out.length >= limit) break;
        out.push(path.posix.join(path.dirname(s).split(path.sep).join('/'), f));
      }
    } else if (fs.existsSync(path.join(root, s))) {
      out.push(s);
    }
  }
  return out.slice(0, limit);
}

/** `evidence/podkatalog/plik.png` (ścieżka względem roota repo) → `/ev/podkatalog/plik.png`. */
export function urlEvidence(relOdRoota) {
  const bez = String(relOdRoota || '').replace(/^evidence[\\/]/, '');
  if (!bez) return '';
  return '/ev/' + bez.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/');
}

/** `2026-09-05T10:33:27.379Z` → `10:33`. */
function godzina(kiedy) {
  if (!kiedy) return '';
  const d = new Date(kiedy);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `2026-09-05T10:33:27.379Z` → `05.09.2026`. */
function dataPl(kiedy) {
  if (!kiedy) return '';
  const d = new Date(kiedy);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const ETYKIETA_STANU = { GOTOWY: 'Gotowy do zatwierdzenia', W_TOKU: 'W toku', ZAMROZONY: 'Zamrożony' };
const KLASA_STANU = { GOTOWY: 'gotowy', W_TOKU: 'wtoku', ZAMROZONY: 'zamrozony' };

/**
 * Jedna karta modułu.
 * `zapis`: wiersz `decyzje_zywo` dla klucza `FINAL:<kod>` (jeśli właściciel już
 * kliknął) — pokazujemy wtedy "zatwierdzono HH:MM" NAWET jeśli `status.json`
 * dalej mówi GOTOWY (CTO jeszcze nie zdążył przestawić na ZAMROZONY po odebraniu
 * kliknięcia) i chowamy przycisk, żeby jeden klik nie dopisywał wielu linii do
 * `DO_ZAMROZENIA.txt` przy każdym odświeżeniu strony.
 */
function kartaModulu(root, kod, wpis, zapis) {
  const nazwa = (wpis && wpis.nazwa) || kod;
  const stanSurowy = wpis && STANY.has(wpis.stan) ? wpis.stan : 'W_TOKU';
  const zamrozony = !!(wpis && wpis.zamrozony);
  const stan = zamrozony ? 'ZAMROZONY' : stanSurowy;
  const werdykt = (wpis && wpis.cto_werdykt) || 'Odbiór CTO w toku.';
  const zrzuty = rozwinZrzuty(root, wpis && wpis.zrzuty, 4).map(urlEvidence);
  const jużZatwierdzone = !!(zapis && zapis.decyzja === 'AKCEPT');
  const uwaga = (zapis && zapis.uwaga) || '';

  const pasekObrazow = zrzuty.length
    ? `<div class="zrzuty">${zrzuty
        .map(
          (u) =>
            `<a href="${u}" target="_blank" rel="noopener"><img loading="lazy" src="${u}" alt="${esc(nazwa)}"></a>`
        )
        .join('')}</div>`
    : `<div class="zrzuty puste"><span>zrzuty w przygotowaniu</span></div>`;

  let ogon;
  if (zamrozony) {
    ogon = `<div class="zamrTekst">Zamrożony ${esc(dataPl(wpis && wpis.sprawdzono) || '')}</div>`;
  } else if (jużZatwierdzone) {
    ogon = `<div class="zatwTekst">zatwierdzono ${esc(godzina(zapis.kiedy))}</div>`;
  } else {
    ogon = `<button type="button" class="zatwBtn" data-modul="${esc(kod)}" ${stan !== 'GOTOWY' ? 'disabled' : ''}>Zatwierdzam moduł jako MVP final</button>
    <label class="uwPole">
      <span>Uwaga (opcjonalnie)</span>
      <textarea class="uw" data-modul="${esc(kod)}" rows="2" placeholder="napisz, jeśli coś jest nie tak" ${stan !== 'GOTOWY' ? 'disabled' : ''}>${esc(uwaga)}</textarea>
    </label>
    <div class="zapisSlot" data-modul="${esc(kod)}"></div>`;
  }

  return `<article class="karta ${KLASA_STANU[stan]}" data-modul="${esc(kod)}" data-stan="${esc(stan)}">
  <header>
    <h2>${esc(nazwa)}</h2>
    <span class="pill ${KLASA_STANU[stan]}">${esc(ETYKIETA_STANU[stan])}</span>
  </header>
  <p class="werdykt">${esc(werdykt)}</p>
  ${pasekObrazow}
  <div class="ogon">${ogon}</div>
</article>`;
}

/**
 * Buduje całą stronę `/final`.
 * `p`: { root, statusPath, zapisaneZywo } — `zapisaneZywo` to mapa klucz→wiersz
 * z tabeli `decyzje_zywo` (ta sama, którą czyta `/decyzje`), żeby "zatwierdzono
 * HH:MM" przeżyło odświeżenie strony i restart serwera (baza sqlite jest trwała
 * per-plik, w przeciwieństwie do stanu w przeglądarce).
 */
export function stronaFinal(p) {
  const { root, statusPath, zapisaneZywo = {} } = p;
  const status = czytajStatusFinal(statusPath);
  const moduly = listaModulow();

  let zamrozone = 0;
  let gotowe = 0;
  let wtoku = 0;
  const karty = moduly
    .map(({ kod, nazwa }) => {
      const wpis = status[kod] || { nazwa, stan: 'W_TOKU', cto_werdykt: 'Odbiór CTO w toku.', zrzuty: [], zamrozony: false };
      const efektywnyStan = wpis.zamrozony ? 'ZAMROZONY' : STANY.has(wpis.stan) ? wpis.stan : 'W_TOKU';
      if (efektywnyStan === 'ZAMROZONY') zamrozone++;
      else if (efektywnyStan === 'GOTOWY') gotowe++;
      else wtoku++;
      return kartaModulu(root, kod, wpis, zapisaneZywo['FINAL:' + kod]);
    })
    .join('\n');

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Finalne zatwierdzenia MVP</title><style>${STYL_FINAL}</style></head><body>
<header class="pasek">
  <h1>Finalne zatwierdzenia MVP</h1>
  <span class="liczniki"><b class="lz">${zamrozone}</b> zamrożone · <b class="lg">${gotowe}</b> gotowe · <b class="lw">${wtoku}</b> w toku</span>
  <a class="pytania" href="/pytania">pytania do Ciebie →</a>
</header>
<main class="karty">
${karty}
</main>
<script>${SKRYPT_FINAL}</script>
</body></html>`;
}

export const STYL_FINAL = `
:root{--tlo:#f7f8fa;--karta:#fff;--tekst:#111827;--drugi:#525a67;--kres:#e2e6ec;--ok:#166534;--nieb:#1d4ed8;--wtoku:#78350f}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:18px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid var(--kres);padding:18px 32px;display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.pasek h1{font-size:24px;margin:0;font-weight:700;letter-spacing:-.2px}
.liczniki{font-size:16px;color:var(--drugi)}
.liczniki b{color:var(--tekst);font-variant-numeric:tabular-nums}
.pytania{margin-left:auto;font-size:15px;color:var(--nieb);text-decoration:none}
.pytania:hover{text-decoration:underline}
main.karty{max-width:900px;margin:0 auto;padding:28px 24px 100px;display:flex;flex-direction:column;gap:22px}
.karta{background:var(--karta);border:1px solid var(--kres);border-radius:16px;padding:24px 26px}
.karta header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px}
.karta h2{font-size:22px;margin:0;font-weight:700;letter-spacing:-.2px}
.pill{font-size:14px;font-weight:650;border-radius:999px;padding:6px 14px;white-space:nowrap;background:#eef1f5;color:var(--drugi)}
.pill.gotowy{background:#dbeafe;color:#1e3a8a}
.pill.zamrozony{background:#dcfce7;color:var(--ok)}
.pill.wtoku{background:#fef3c7;color:var(--wtoku)}
.werdykt{font-size:17px;color:var(--drugi);margin:0 0 16px;line-height:1.55}
.zrzuty{display:flex;gap:10px;margin-bottom:18px;overflow-x:auto}
.zrzuty a{flex:1 1 0;min-width:0;display:block}
.zrzuty img{width:100%;height:150px;object-fit:contain;background:#f8fafc;border:1px solid var(--kres);border-radius:10px;display:block;cursor:zoom-in}
.zrzuty.puste{border:1px dashed var(--kres);border-radius:10px;padding:24px;justify-content:center;background:#fbfcfd}
.zrzuty.puste span{color:#9aa3ad;font-size:15px}
.ogon{margin-top:4px}
.zatwBtn{width:100%;border:1.5px solid var(--kres);background:#fff;color:#9aa3ad;border-radius:12px;padding:16px 18px;font:700 17px/1.2 inherit;cursor:not-allowed}
.karta.gotowy .zatwBtn{color:#fff;background:var(--nieb);border-color:var(--nieb);cursor:pointer}
.karta.gotowy .zatwBtn:hover{background:#1741ad}
.uwPole{display:block;margin-top:12px}
.uwPole span{display:block;font-size:14.5px;color:var(--drugi);margin-bottom:6px}
.uw{width:100%;border:1px solid var(--kres);border-radius:10px;padding:11px 13px;font:16px/1.5 inherit;resize:vertical;background:#fff;color:var(--tekst)}
.uw:disabled{background:#f8fafc;color:#9aa3ad}
.zapisSlot{min-height:20px;margin-top:8px;font-size:14.5px;color:var(--ok);font-weight:650}
.zapisSlot.blad{color:#9f1239}
.zatwTekst,.zamrTekst{font-size:16px;font-weight:650;color:var(--ok)}
`;

export const SKRYPT_FINAL = `
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.zatwBtn');
  if (!b || b.disabled) return;
  const modul = b.dataset.modul;
  b.disabled = true;
  b.textContent = 'zapisuję…';
  fetch('/decyzja-zywo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'FINAL:' + modul, decyzja: 'AKCEPT' }) })
    .then(async (r) => {
      const odp = await r.json().catch(() => ({}));
      if (!r.ok || !odp.ok) throw new Error(odp.blad || ('serwer odpowiedział ' + r.status));
      const d = new Date(odp.wiersz.kiedy);
      const godz = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const ogon = b.closest('.ogon');
      ogon.innerHTML = '<div class="zatwTekst">zatwierdzono ' + godz + '</div>';
    })
    .catch((e) => {
      b.disabled = false;
      b.textContent = 'Zatwierdzam moduł jako MVP final';
      const slot = document.querySelector('.zapisSlot[data-modul="' + modul + '"]');
      if (slot) { slot.textContent = 'NIE ZAPISANO — ' + e.message; slot.className = 'zapisSlot blad'; }
    });
});
const stanUwag = new Map();
document.querySelectorAll('.uw').forEach((u) => stanUwag.set(u.dataset.modul, u.value));
function wyslijUwage(u) {
  const modul = u.dataset.modul;
  if (stanUwag.get(modul) === u.value) return;
  stanUwag.set(modul, u.value);
  const slot = document.querySelector('.zapisSlot[data-modul="' + modul + '"]');
  if (slot) { slot.textContent = 'zapisuję…'; slot.className = 'zapisSlot'; }
  fetch('/decyzja-zywo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'FINAL:' + modul, uwaga: u.value }) })
    .then(async (r) => {
      const odp = await r.json().catch(() => ({}));
      if (!r.ok || !odp.ok) throw new Error(odp.blad || ('serwer odpowiedział ' + r.status));
      if (slot) { slot.textContent = 'uwaga zapisana'; slot.className = 'zapisSlot'; }
    })
    .catch((e) => { if (slot) { slot.textContent = 'NIE ZAPISANO — ' + e.message; slot.className = 'zapisSlot blad'; } });
}
let timer;
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uw');
  if (!u) return;
  clearTimeout(timer);
  timer = setTimeout(() => wyslijUwage(u), 800);
});
document.addEventListener('focusout', (ev) => { const u = ev.target.closest('.uw'); if (u) wyslijUwage(u); });
`;

/**
 * DOPISANIE DO `DO_ZAMROZENIA.txt` — wywoływane przez serwer HTTP z handlera
 * `/decyzja-zywo`, TYLKO gdy `id` zaczyna się od `FINAL:` i zapisywana decyzja
 * to `AKCEPT` (sama zmiana pola uwagi nie dopisuje nic — to nie jest zatwierdzenie).
 * Osobna funkcja, nie inline w serwerze, żeby dało się przetestować format
 * linii bez stawiania HTTP.
 */
export function dopiszDoZamrozenia(doZamrozeniaPath, modulKod, kiedy = new Date().toISOString()) {
  fs.appendFileSync(doZamrozeniaPath, `${kiedy} ${modulKod}\n`, 'utf8');
}

/**
 * `/pytania` — renderuje `PYTANIA.md` jako prosty HTML. Plik ma być czytelny
 * także jako zwykły tekst (dopisuje go CTO ręką), więc renderer jest CELOWO
 * ubogi: nagłówki `#`/`##`, wypunktowania `- `, reszta to akapity. Bez tabel,
 * bez linków w markdownie — to nie jest ogólny konwerter, tylko wystarczające
 * minimum dla jednej krótkiej notatki.
 */
export function markdownDoHtml(tekst) {
  const linie = String(tekst || '').split(/\r?\n/);
  const out = [];
  let listaOtwarta = false;
  const zamknijListe = () => {
    if (listaOtwarta) {
      out.push('</ul>');
      listaOtwarta = false;
    }
  };
  for (const surowa of linie) {
    const linia = surowa.trim();
    if (!linia) {
      zamknijListe();
      continue;
    }
    const nag = linia.match(/^(#{1,3})\s+(.*)$/);
    if (nag) {
      zamknijListe();
      const poziom = nag[1].length;
      out.push(`<h${poziom}>${esc(nag[2])}</h${poziom}>`);
      continue;
    }
    if (linia.startsWith('- ')) {
      if (!listaOtwarta) {
        out.push('<ul>');
        listaOtwarta = true;
      }
      out.push(`<li>${esc(linia.slice(2))}</li>`);
      continue;
    }
    zamknijListe();
    out.push(`<p>${esc(linia)}</p>`);
  }
  zamknijListe();
  return out.join('\n');
}

export function stronaPytania(mdPath) {
  let tekst = '';
  try {
    tekst = fs.readFileSync(mdPath, 'utf8');
  } catch (e) {
    tekst = 'Plik pytań jeszcze nie istnieje.';
  }
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pytania do Ciebie</title>
<style>
:root{--tlo:#f7f8fa;--tekst:#111827;--drugi:#525a67;--kres:#e2e6ec;--nieb:#1d4ed8}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:18px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 24px}
a.wroc{display:inline-block;margin-bottom:24px;color:var(--nieb);text-decoration:none;font-size:15px}
a.wroc:hover{text-decoration:underline}
h1{font-size:26px;margin:0 0 8px}
h2{font-size:21px}
h3{font-size:18px}
p{color:var(--drugi);font-size:17px}
li{color:var(--drugi);font-size:17px;margin:4px 0}
.karta{background:#fff;border:1px solid var(--kres);border-radius:14px;padding:26px 28px}
</style></head><body>
<main>
<a class="wroc" href="/final">← wróć do finalnych zatwierdzeń</a>
<div class="karta">${markdownDoHtml(tekst)}</div>
</main>
</body></html>`;
}
