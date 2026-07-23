/**
 * Wstawia zakładkę „Odbiór" do raportu gotowości (artefakt po prawej stronie).
 *
 * Raport zostaje kotwicą Piotra — dokładamy drugą zakładkę, nie drugi artefakt.
 * Werdykty wracają JEDYNYM dostępnym kanałem artefakt→dysk:
 * `window.claude.downloads.save()` (capability `downloads`). Artefakty nie mają
 * trwałego stanu ani callbacku, więc nadzorca czyta pobrany JSON z dysku.
 *
 * Idempotentne: gdy zakładka już jest, podmienia jej zawartość.
 * Użycie: node scripts/odbior-wstaw.mjs <ścieżka-do-raportu.html>
 */
import fs from 'node:fs';
import path from 'node:path';

const RAPORT = process.argv[2];
if (!RAPORT || !fs.existsSync(RAPORT)) {
  console.error('Podaj ścieżkę do raportu HTML');
  process.exit(1);
}

const galeria = fs.readFileSync(path.resolve('rejestr/_zrzuty/_galeria.html'), 'utf8');
let html = fs.readFileSync(RAPORT, 'utf8');

const START = '<!-- ODBIOR:START -->';
const END = '<!-- ODBIOR:END -->';

const STYLE = `
<style id="odb-style">
  .odb-tabs { display:flex; gap:8px; margin:22px 0 0; }
  .odb-tab { font-size:12.5px; font-weight:700; letter-spacing:.04em; padding:8px 16px; border-radius:10px;
    border:1px solid var(--line-2); background:var(--panel); color:var(--dim); cursor:pointer; }
  .odb-tab[aria-selected="true"] { background:var(--panel-2); color:var(--ink); border-color:var(--blue); }
  .odb-count { display:inline-block; margin-left:6px; font-size:11px; padding:1px 7px; border-radius:999px;
    background:var(--blue-bg); color:var(--blue); font-variant-numeric:tabular-nums; }
  #panel-odbior { display:none; }
  #panel-odbior.on { display:block; }
  #panel-raport.off { display:none; }
  .odb-intro { margin-top:20px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px; font-size:13px; color:var(--dim); }
  .odb-intro b { color:var(--ink); }
  .odb-card { margin-top:16px; border:1px solid var(--line); border-radius:14px; background:var(--panel); overflow:hidden; }
  .odb-head { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; padding:12px 16px; border-bottom:1px solid var(--line); background:var(--panel-2); }
  .odb-id { font-size:10.5px; font-weight:800; letter-spacing:.1em; color:var(--blue); font-variant-numeric:tabular-nums; }
  .odb-title { font-size:14.5px; font-weight:700; margin:4px 0 0; color:var(--ink); }
  .odb-flag { font-size:10.5px; color:var(--faint); border:1px solid var(--line-2); border-radius:6px; padding:2px 8px; white-space:nowrap; flex-shrink:0; }
  .odb-body { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(260px,1fr); gap:18px; padding:16px; }
  @media (max-width:900px){ .odb-body{ grid-template-columns:1fr; } }
  .odb-shot img { width:100%; height:auto; border:1px solid var(--line-2); border-radius:10px; display:block; cursor:zoom-in; }
  .odb-sec { margin-bottom:12px; }
  .odb-lbl { display:block; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin-bottom:3px; }
  .odb-sec p { margin:0; font-size:12.5px; color:var(--dim); line-height:1.5; }
  .odb-risk { color:var(--b2) !important; }
  .odb-verdict { display:flex; gap:14px; flex-wrap:wrap; margin:14px 0 8px; font-size:12.5px; color:var(--ink); }
  .odb-verdict label { display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
  .odb-comment { width:100%; font:inherit; font-size:12.5px; padding:8px 10px; border-radius:9px;
    border:1px solid var(--line-2); background:var(--panel-2); color:var(--ink); resize:vertical; }
  .odb-bar { position:sticky; bottom:0; margin-top:22px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;
    background:var(--panel); border:1px solid var(--line-2); border-radius:12px; padding:12px 16px; }
  .odb-btn { font:inherit; font-size:13px; font-weight:700; padding:9px 18px; border-radius:10px; cursor:pointer;
    border:1px solid var(--blue); background:var(--blue-bg); color:var(--blue); }
  .odb-btn:disabled { opacity:.5; cursor:not-allowed; }
  .odb-status { font-size:12.5px; color:var(--dim); }
  .odb-lightbox { position:fixed; inset:0; background:rgba(0,0,0,.82); display:none; align-items:flex-start; justify-content:center; z-index:99; overflow:auto; padding:24px; }
  .odb-lightbox.on { display:flex; }
  .odb-lightbox img { max-width:1100px; width:100%; height:auto; border-radius:10px; }
</style>`;

const SCRIPT = `
<script id="odb-script">
(function(){
  var raport = document.getElementById('panel-raport');
  var odbior = document.getElementById('panel-odbior');
  var tabs = document.querySelectorAll('.odb-tab');
  tabs.forEach(function(t){
    t.addEventListener('click', function(){
      var cel = t.getAttribute('data-panel');
      tabs.forEach(function(x){ x.setAttribute('aria-selected', String(x === t)); });
      odbior.classList.toggle('on', cel === 'odbior');
      raport.classList.toggle('off', cel === 'odbior');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // podgląd zrzutu w powiększeniu
  var lb = document.getElementById('odb-lightbox');
  var lbImg = lb ? lb.querySelector('img') : null;
  document.querySelectorAll('.odb-shot img').forEach(function(img){
    img.addEventListener('click', function(){ if(lbImg){ lbImg.src = img.src; lb.classList.add('on'); } });
  });
  if (lb) lb.addEventListener('click', function(){ lb.classList.remove('on'); });

  function zbierz(){
    var out = [];
    document.querySelectorAll('.odb-card').forEach(function(card){
      var id = card.getAttribute('data-id');
      var sel = card.querySelector('input[name="v-'+id+'"]:checked');
      var kom = card.querySelector('.odb-comment');
      out.push({
        id: id,
        tytul: (card.querySelector('.odb-title')||{}).textContent || '',
        werdykt: sel ? sel.value : null,
        komentarz: kom && kom.value.trim() ? kom.value.trim() : null
      });
    });
    return out;
  }

  function odswiezStatus(){
    var d = zbierz();
    var wyp = d.filter(function(x){ return x.werdykt; }).length;
    var st = document.getElementById('odb-status');
    if (st) st.textContent = 'Wypełnione: ' + wyp + ' z ' + d.length;
  }
  document.addEventListener('change', function(e){
    if (e.target && e.target.type === 'radio') odswiezStatus();
  });
  odswiezStatus();

  var btn = document.getElementById('odb-pobierz');
  if (btn) btn.addEventListener('click', async function(){
    var dane = zbierz();
    var payload = {
      partia: '2026-07-23',
      wystawione: new Date().toISOString(),
      pozycje: dane
    };
    var tekst = JSON.stringify(payload, null, 2);
    var st = document.getElementById('odb-status');
    try {
      if (window.claude && window.claude.downloads && window.claude.downloads.save) {
        await window.claude.downloads.save({ filename: 'odbior-2026-07-23.json', data: tekst });
        if (st) st.textContent = 'Zapisano plik — powiedz mi „werdykty gotowe", odczytam go z dysku.';
      } else {
        // zapas: gdy zdolność downloads niedostępna — kopiuj do schowka
        await navigator.clipboard.writeText(tekst);
        if (st) st.textContent = 'Pobieranie niedostępne — werdykty skopiowane do schowka, wklej mi je w czacie.';
      }
    } catch (err) {
      try { await navigator.clipboard.writeText(tekst); } catch (e2) {}
      if (st) st.textContent = 'Nie udało się zapisać pliku (' + (err && err.code ? err.code : 'błąd') + ') — werdykty w schowku, wklej mi je w czacie.';
    }
  });
})();
</script>`;

const PANEL = `${START}
${STYLE}
<div class="odb-tabs" role="tablist">
  <button class="odb-tab" data-panel="raport" role="tab" aria-selected="true">Raport gotowości</button>
  <button class="odb-tab" data-panel="odbior" role="tab" aria-selected="false">Odbiór zrzutów<span class="odb-count">9</span></button>
</div>

<div id="panel-odbior">
  <div class="odb-intro">
    <b>Partia 2026-07-23 — 9 pozycji z nocnej pętli.</b> Każdy zrzut zrobiony automatem z harnessu na mock-danych
    (bez logowania, bez bazy), w obu motywach, obejrzany przeze mnie zanim tu trafił.
    Kliknij zrzut, żeby powiększyć. Zaznacz werdykt, dopisz komentarz, na końcu <b>„Pobierz werdykty"</b> —
    plik trafia na dysk, ja go odczytam i wykonam. Pozycje żyją też w <code>rejestr/3-DO-ODBIORU/</code>,
    więc decyzje zostają w historii gita. Wersje dark: <code>rejestr/_zrzuty/&lt;ID&gt;-dark.png</code>.
  </div>
${galeria}
  <div class="odb-bar">
    <button class="odb-btn" id="odb-pobierz">Pobierz werdykty (JSON)</button>
    <span class="odb-status" id="odb-status">Wypełnione: 0 z 9</span>
  </div>
</div>
<div class="odb-lightbox" id="odb-lightbox"><img alt="podgląd" /></div>
${END}`;

// wytnij starą wersję zakładki, jeśli istnieje
if (html.includes(START) && html.includes(END)) {
  html = html.slice(0, html.indexOf(START)) + html.slice(html.indexOf(END) + END.length);
}
// usuń stary skrypt/owijkę raportu, jeśli była
html = html.replace(/<div id="panel-raport">\n?/, '').replace(/\n?<\/div>\s*<!-- \/panel-raport -->/, '');
html = html.replace(/<script id="odb-script">[\s\S]*?<\/script>/, '');

// panel wstawiamy tuż po nagłówku (po .top), resztę raportu owijamy w #panel-raport
const anchor = '  <div class="planbar">';
const idx = html.indexOf(anchor);
if (idx === -1) {
  console.error('Nie znalazłem kotwicy .planbar — raport ma inną strukturę niż zakładałem.');
  process.exit(1);
}
const before = html.slice(0, idx);
const after = html.slice(idx);
const endWrap = after.lastIndexOf('</div>'); // zamknięcie .wrap
const raportBody = after.slice(0, endWrap);
const tail = after.slice(endWrap);

html = before + PANEL + '\n<div id="panel-raport">\n' + raportBody + '\n</div>\n<!-- /panel-raport -->\n' + SCRIPT + '\n' + tail;

fs.writeFileSync(RAPORT, html);
console.log(`✓ zakładka „Odbiór" wstawiona → ${RAPORT} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
