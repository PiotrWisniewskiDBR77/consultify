/**
 * TOR GRAFIKA — generator strony odbioru (2026-08-30).
 *
 * Po co: właściciel woli oglądać ekrany NA ŻYWO, nie na zrzutach. Ta strona jest
 * jego ścieżką: lista ekranów gotowych do odbioru, z linkiem do harnessu
 * (jasny/ciemny), z wyjątkami wypisanymi PRZED spojrzeniem (reguła nr 2 i nr 7
 * z docs/program/grafika/00_ZASADY_PRACY.md).
 *
 * ★ Strona pokazuje WYŁĄCZNIE oceny A i B. Ekrany C i D są wypisane osobno,
 *   jako „nie do odbioru" z podanym powodem — właściciel ma widzieć, czego
 *   świadomie mu nie pokazujemy, ale nie ma tego oglądać jako produktu.
 *
 * Źródło: docs/program/grafika/status.json (utrzymywany przez nadzorcę).
 * Wynik:  dev-render/odbior-grafika.html
 *
 * Uruchomienie: node scripts/dev/grafika-strona-odbioru.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const stat = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/program/grafika/status.json'), 'utf8')
);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const BASE = 'http://127.0.0.1:3020';
const link = (id, theme) => `${BASE}/?screen=${id}&lang=pl&theme=${theme}`;

const wszystkie = stat.moduly.flatMap((m) => m.ekrany.map((e) => ({ ...e, _mod: m })));
const doOdbioru = wszystkie.filter((e) => e.ocena === 'A' || e.ocena === 'B');
const odrzucone = wszystkie.filter((e) => e.ocena === 'C' || e.ocena === 'D');
const naprawionych = wszystkie.reduce((n, e) => n + (e.naprawione?.length || 0), 0);

const ekranHtml = (e) => `
      <div class="ekran">
        <div class="glowna">
          <span class="nazwa">${esc(e.nazwa)}<span class="ocena o-${e.ocena}">${e.ocena}</span></span>
          <span class="akcje">
            <a class="btn btn-glowny" href="${link(e.id, 'light')}" target="_blank" rel="noopener">Otwórz</a>
            <a class="btn" href="${link(e.id, 'dark')}" target="_blank" rel="noopener">Ciemny</a>
          </span>
        </div>
        <p class="co">${esc(e.co)}</p>
        ${
          e.naprawione?.length
            ? `<p class="naprawione"><b>Naprawione:</b> ${e.naprawione.map(esc).join(' · ')}</p>`
            : ''
        }
        ${
          e.wyjatki?.length
            ? `<div class="wyjatki"><b>Wiesz o tym przed spojrzeniem:</b><ul>${e.wyjatki
                .map((w) => `<li>${esc(w)}</li>`)
                .join('')}</ul></div>`
            : ''
        }
      </div>`;

const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Odbiór grafiki — ${esc(stat._zaktualizowano)}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;padding:32px 26px 80px;background:#f7f8fa;color:#0f172a;
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
  .wrap{max-width:980px;margin:0 auto}
  h1{font-size:26px;margin:0 0 8px;letter-spacing:-.02em}
  .lead{color:#475569;margin:0 0 20px;max-width:72ch}
  .licz{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 26px}
  .kafel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:120px}
  .kafel b{display:block;font-size:24px;line-height:1.1;font-variant-numeric:tabular-nums}
  .kafel span{font-size:12.5px;color:#64748b}
  .jak{background:#fff;border:1px solid #e2e8f0;border-left:3px solid #2563eb;border-radius:10px;
    padding:14px 18px;margin:0 0 26px}
  .modul{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:16px}
  .modul h2{font-size:16px;margin:0 0 4px}
  .modul .opis{color:#64748b;font-size:13.5px;margin:0 0 14px}
  .ekran{border-top:1px solid #eef1f6;padding:14px 0 10px}
  .ekran:first-of-type{border-top:0}
  .glowna{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
  .nazwa{font-size:15px;font-weight:600;display:flex;align-items:center;gap:9px}
  .ocena{font-size:11px;font-weight:700;border-radius:20px;padding:2px 9px}
  .o-A{background:#dcfce7;color:#166534}
  .o-B{background:#fef3c7;color:#92400e}
  .o-C{background:#fee2e2;color:#991b1b}
  .o-D{background:#e2e8f0;color:#475569}
  .btn{display:inline-block;padding:6px 13px;border-radius:8px;border:1px solid #d7dee9;
    background:#f1f5f9;color:#0f172a;text-decoration:none;font-size:13px;margin-left:6px}
  .btn:hover{background:#e2e8f0}
  .btn-glowny{background:#0f172a;color:#fff;border-color:#0f172a}
  .btn-glowny:hover{background:#1e293b}
  .co{color:#475569;font-size:13.5px;margin:8px 0 0;max-width:80ch}
  .naprawione{font-size:13px;color:#166534;margin:7px 0 0;max-width:80ch}
  .wyjatki{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:9px 13px;margin-top:9px;
    font-size:13px;color:#92400e;max-width:80ch}
  .wyjatki ul{margin:5px 0 0;padding-left:18px}
  .odrzucone{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-top:26px}
  .odrzucone h2{font-size:16px;margin:0 0 4px}
  a{color:#1d4ed8}
</style></head><body><div class="wrap">

<h1>Odbiór grafiki</h1>
<p class="lead">Ekrany gotowe do obejrzenia na żywo. Każdy z nich oglądałem sam, w obu motywach, zanim tu trafił — <b>dostajesz je do akceptu, nie do odkrywania zepsucia</b>.</p>

<div class="licz">
  <div class="kafel"><b>${doOdbioru.length}</b><span>do odbioru</span></div>
  <div class="kafel"><b>${doOdbioru.filter((e) => e.ocena === 'A').length}</b><span>bez zastrzeżeń</span></div>
  <div class="kafel"><b>${doOdbioru.filter((e) => e.ocena === 'B').length}</b><span>z nazwanymi wyjątkami</span></div>
  <div class="kafel"><b>${naprawionych}</b><span>defektów naprawionych</span></div>
  <div class="kafel"><b>${odrzucone.length}</b><span>świadomie niepokazane</span></div>
</div>

<div class="jak">
  <b>Jak to czytać.</b> <b>A</b> = przechodzi kanon, nie mam zastrzeżeń.
  <b>B</b> = przechodzi, ale wyjątki są wypisane <i>zanim</i> spojrzysz — żółta ramka.
  Przy każdym ekranie „Otwórz" pokazuje go w jasnym motywie, „Ciemny" w ciemnym.
  Ekran dociąga dane kilkanaście sekund — daj mu chwilę.
  Wystarczy, że powiesz <b>„ta ok"</b> albo <b>„ta nie"</b>; uzasadnienie nie jest potrzebne.
</div>

${stat.moduly
  .map((m) => {
    const widoczne = m.ekrany.filter((e) => e.ocena === 'A' || e.ocena === 'B');
    if (!widoczne.length) return '';
    return `<div class="modul">
      <h2>${esc(m.nazwa)}</h2>
      <p class="opis">${esc(m.opis)}</p>
      ${widoczne.map(ekranHtml).join('')}
    </div>`;
  })
  .join('')}

${
  odrzucone.length
    ? `<div class="odrzucone">
  <h2>Świadomie Ci nie pokazuję — ${odrzucone.length}</h2>
  <p class="opis">Te ekrany nie przeszły mojej oceny albo wymagają decyzji, nie naprawy. Wypisuję je, żebyś wiedział, czego brakuje w tej partii i dlaczego.</p>
  ${odrzucone
    .map(
      (e) => `<div class="ekran"><div class="glowna"><span class="nazwa">${esc(e.nazwa)}<span class="ocena o-${e.ocena}">${e.ocena}</span></span></div>
      <p class="co">${esc(e.co)}</p>
      ${e.wyjatki?.length ? `<div class="wyjatki"><b>Powód:</b><ul>${e.wyjatki.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}</div>`
    )
    .join('')}
</div>`
    : ''
}

</div></body></html>`;

const out = path.join(ROOT, 'dev-render/odbior-grafika.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`Strona odbioru → ${out}`);
console.log(`  do odbioru: ${doOdbioru.length} (A: ${doOdbioru.filter((e) => e.ocena === 'A').length}, B: ${doOdbioru.filter((e) => e.ocena === 'B').length})`);
console.log(`  niepokazane: ${odrzucone.length}`);
console.log(`  napraw: ${naprawionych}`);
