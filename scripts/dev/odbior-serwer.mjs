/**
 * SERWER ODBIORU GRAFIKI — właściciel klika w przeglądarce, decyzje lądują na dysku.
 *
 * POWÓD ISTNIENIA (2026-08-30): strona `odbior-grafika.html` była tylko spisem —
 * właściciel mógł ją przeczytać, ale nie mógł nią NICZEGO rozstrzygnąć. Odbiór
 * wracał do rozmowy, a rozmowa nie jest rejestrem. Tu każde kliknięcie zapisuje
 * się natychmiast do `docs/program/grafika/ODBIOR_DECYZJE.json` i przeżywa
 * zamknięcie przeglądarki.
 *
 * Zero zależności — czysty `node:http`. Uruchomienie:
 *   node scripts/dev/odbior-serwer.mjs            (port 3030)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PORT_ODBIOR || 3030);
const HARNESS = process.env.HARNESS || 'http://127.0.0.1:3020';
const STATUS = path.join(ROOT, 'docs/program/grafika/status.json');
const DECYZJE = path.join(ROOT, 'docs/program/grafika/ODBIOR_DECYZJE.json');
const EVID = path.join(ROOT, 'evidence/grafika');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Mapa id ekranu → { motyw → { faza → ścieżka } }. Wolimy PO, bo to stan po naprawach. */
function indeksZrzutow() {
  const out = {};
  for (const dir of fs.readdirSync(EVID)) {
    const full = path.join(EVID, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.png') || !f.includes('__')) continue;
      const [id, faza, motywPng] = f.split('__');
      const motyw = motywPng.replace('.png', '');
      out[id] ??= {};
      out[id][motyw] ??= {};
      out[id][motyw][faza] = path.join(dir, f);
    }
  }
  return out;
}

const czytajDecyzje = () => {
  try {
    return JSON.parse(fs.readFileSync(DECYZJE, 'utf8'));
  } catch {
    return {};
  }
};
const zapiszDecyzje = (d) => fs.writeFileSync(DECYZJE, JSON.stringify(d, null, 1), 'utf8');

function strona() {
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const zrzuty = indeksZrzutow();
  const decyzje = czytajDecyzje();

  const doOdbioru = [];
  const niepokazane = [];
  for (const m of status.moduly) {
    for (const e of m.ekrany) {
      (e.ocena === 'A' || e.ocena === 'B' ? doOdbioru : niepokazane).push({ ...e, modul: m.nazwa });
    }
  }

  const karta = (e) => {
    const z = zrzuty[e.id] || {};
    const wybierz = (motyw) => (z[motyw]?.PO || z[motyw]?.PRZED || '').replace(/\\/g, '/');
    const light = wybierz('light');
    const dark = wybierz('dark');
    const d = decyzje[e.id] || {};
    const btn = (kod, etykieta) =>
      `<button class="b ${kod} ${d.decyzja === kod ? 'on' : ''}" data-id="${esc(e.id)}" data-d="${kod}">${etykieta}</button>`;
    return `<article class="k" id="k-${esc(e.id)}" data-stan="${esc(d.decyzja || '')}">
  <header>
    <h3>${esc(e.nazwa)}</h3>
    <span class="o o${esc(e.ocena)}">${esc(e.ocena)}</span>
  </header>
  <p class="co">${esc(e.co)}</p>
  ${e.naprawione?.length ? `<ul class="nap">${e.naprawione.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${e.wyjatki?.length ? `<ul class="wyj">${e.wyjatki.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  <div class="obrazy">
    ${light ? `<figure><figcaption>jasny</figcaption><a href="/png/${esc(light)}" target="_blank"><img loading="lazy" src="/png/${esc(light)}" alt=""></a></figure>` : ''}
    ${dark ? `<figure><figcaption>ciemny</figcaption><a href="/png/${esc(dark)}" target="_blank"><img loading="lazy" src="/png/${esc(dark)}" alt=""></a></figure>` : ''}
  </div>
  <div class="akcje">
    ${btn('ok', 'Akceptuję')}
    ${btn('poprawka', 'Do poprawki')}
    ${btn('nie', 'Odrzucam')}
    <a class="zywo" href="${HARNESS}/?screen=${encodeURIComponent(e.id)}&lang=pl&theme=light" target="_blank">otwórz na żywo</a>
  </div>
  <input class="uw" data-id="${esc(e.id)}" placeholder="uwaga (opcjonalnie) — zapisuje się sama" value="${esc(d.uwaga || '')}">
</article>`;
  };

  const moduly = [];
  for (const m of status.moduly) {
    const ekrany = m.ekrany.filter((e) => e.ocena === 'A' || e.ocena === 'B');
    if (!ekrany.length) continue;
    moduly.push(`<section class="m">
  <h2>${esc(m.nazwa)} <small>${ekrany.length}</small></h2>
  <p class="opis">${esc(m.opis)}</p>
  <div class="karty">${ekrany.map(karta).join('')}</div>
</section>`);
  }

  const nieTabela = niepokazane
    .map(
      (e) =>
        `<tr><td>${esc(e.nazwa)}</td><td><span class="o o${esc(e.ocena)}">${esc(e.ocena)}</span></td><td>${esc(e.co)}</td><td>${esc((e.wyjatki || []).join(' · '))}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Odbiór grafiki — klikasz, zapisuje się</title>
<style>
:root{--tlo:#f7f8fa;--karta:#fff;--tekst:#0f172a;--drugi:#475569;--kres:#e2e8f0;--ok:#15803d;--pop:#b45309;--nie:#9f1239;--nieb:#1d4ed8}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--kres);padding:12px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.pasek h1{font-size:16px;margin:0;font-weight:650}
.lic{font-variant-numeric:tabular-nums;color:var(--drugi);font-size:14px}
.lic b{color:var(--tekst)}
.filtry button{border:1px solid var(--kres);background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer}
.filtry button.on{background:var(--tekst);color:#fff;border-color:var(--tekst)}
main{padding:20px;max-width:1500px;margin:0 auto}
.m{margin-bottom:34px}
.m h2{font-size:19px;margin:0 0 2px;font-weight:650}
.m h2 small{color:var(--drugi);font-weight:500;font-size:13px}
.opis{margin:0 0 14px;color:var(--drugi);font-size:13.5px}
.karty{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:16px}
.k{background:var(--karta);border:1px solid var(--kres);border-radius:12px;padding:14px}
.k[data-stan=ok]{border-color:var(--ok);box-shadow:inset 3px 0 0 var(--ok)}
.k[data-stan=poprawka]{border-color:var(--pop);box-shadow:inset 3px 0 0 var(--pop)}
.k[data-stan=nie]{border-color:var(--nie);box-shadow:inset 3px 0 0 var(--nie)}
.k header{display:flex;justify-content:space-between;align-items:start;gap:10px}
.k h3{font-size:15px;margin:0 0 6px;font-weight:620}
.o{font-size:11px;font-weight:700;border-radius:5px;padding:2px 7px;flex:none}
.oA{background:#dcfce7;color:#14532d}.oB{background:#fef3c7;color:#78350f}
.oC{background:#e2e8f0;color:#334155}.oD{background:#fee2e2;color:#7f1d1d}
.co{margin:0 0 8px;font-size:13.5px;color:var(--drugi)}
.nap,.wyj{margin:0 0 8px;padding-left:16px;font-size:12.5px}
.nap li{color:var(--ok)}.wyj li{color:var(--pop)}
.obrazy{display:flex;gap:8px;margin:10px 0}
.obrazy figure{margin:0;flex:1;min-width:0}
.obrazy figcaption{font-size:11px;color:var(--drugi);margin-bottom:3px}
.obrazy img{width:100%;border:1px solid var(--kres);border-radius:7px;display:block;background:#fff}
.akcje{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:6px}
.b{border:1px solid var(--kres);background:#fff;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;font-weight:550}
.b.ok.on{background:var(--ok);color:#fff;border-color:var(--ok)}
.b.poprawka.on{background:var(--pop);color:#fff;border-color:var(--pop)}
.b.nie.on{background:var(--nie);color:#fff;border-color:var(--nie)}
.b:focus-visible,.uw:focus-visible{outline:2px solid var(--nieb);outline-offset:1px}
.zywo{font-size:12.5px;color:var(--nieb);margin-left:auto}
.uw{width:100%;margin-top:8px;border:1px solid var(--kres);border-radius:8px;padding:6px 9px;font-size:13px;font-family:inherit}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid var(--kres);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--kres);vertical-align:top}
th{background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--drugi)}
.ukryta{display:none}
</style></head><body>
<div class="pasek">
  <h1>Odbiór grafiki</h1>
  <span class="lic" id="lic"></span>
  <span class="filtry">
    <button data-f="wszystkie" class="on">Wszystkie</button>
    <button data-f="nierozstrzygniete">Nierozstrzygnięte</button>
    <button data-f="ok">Zaakceptowane</button>
    <button data-f="poprawka">Do poprawki</button>
    <button data-f="nie">Odrzucone</button>
  </span>
</div>
<main>
${moduly.join('\n')}
<section class="m">
  <h2>Świadomie Ci tego nie pokazuję <small>${niepokazane.length}</small></h2>
  <p class="opis">Każda pozycja z powodem. Nic tu nie ginie — leży w rejestrze i wraca, kiedy zdecydujesz.</p>
  <table><thead><tr><th>Ekran</th><th>Ocena</th><th>Co to jest</th><th>Dlaczego nie pokazuję</th></tr></thead><tbody>${nieTabela}</tbody></table>
</section>
</main>
<script>
const licz = () => {
  const k = [...document.querySelectorAll('.k')];
  const n = (s) => k.filter((x) => x.dataset.stan === s).length;
  document.getElementById('lic').innerHTML =
    '<b>' + n('ok') + '</b> zaakceptowanych · <b>' + n('poprawka') + '</b> do poprawki · <b>' + n('nie') +
    '</b> odrzuconych · <b>' + k.filter((x) => !x.dataset.stan).length + '</b> czeka z ' + k.length;
};
const wyslij = (id, dane) =>
  fetch('/decyzja', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...dane }) });
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.b');
  if (b) {
    const karta = b.closest('.k');
    const nowa = karta.dataset.stan === b.dataset.d ? '' : b.dataset.d;
    karta.dataset.stan = nowa;
    karta.querySelectorAll('.b').forEach((x) => x.classList.toggle('on', !!nowa && x.dataset.d === nowa));
    wyslij(b.dataset.id, { decyzja: nowa });
    licz();
    return;
  }
  const f = ev.target.closest('.filtry button');
  if (f) {
    document.querySelectorAll('.filtry button').forEach((x) => x.classList.toggle('on', x === f));
    const tryb = f.dataset.f;
    document.querySelectorAll('.k').forEach((k) => {
      const pokaz =
        tryb === 'wszystkie' || (tryb === 'nierozstrzygniete' ? !k.dataset.stan : k.dataset.stan === tryb);
      k.classList.toggle('ukryta', !pokaz);
    });
    document.querySelectorAll('.m').forEach((m) => {
      const widoczne = [...m.querySelectorAll('.k')].some((k) => !k.classList.contains('ukryta'));
      if (m.querySelector('.k')) m.classList.toggle('ukryta', !widoczne);
    });
  }
});
let t;
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uw');
  if (!u) return;
  clearTimeout(t);
  t = setTimeout(() => wyslij(u.dataset.id, { uwaga: u.value }), 400);
});
licz();
</script>
</body></html>`;
}

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/decyzja') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { id, ...reszta } = JSON.parse(body);
          const d = czytajDecyzje();
          d[id] = { ...(d[id] || {}), ...reszta, kiedy: new Date().toISOString() };
          if (d[id].decyzja === '') delete d[id].decyzja;
          zapiszDecyzje(d);
          res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
        } catch (e) {
          res.writeHead(400).end(String(e));
        }
      });
      return;
    }
    if (req.url.startsWith('/png/')) {
      const rel = decodeURIComponent(req.url.slice(5));
      const p = path.join(EVID, rel);
      if (!p.startsWith(EVID) || !fs.existsSync(p)) return res.writeHead(404).end('nie ma');
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=600' });
      return fs.createReadStream(p).pipe(res);
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(strona());
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Odbiór grafiki → http://127.0.0.1:${PORT}/`);
    console.log(`Decyzje zapisują się do ${path.relative(ROOT, DECYZJE)}`);
  });
