#!/usr/bin/env node
// Generator panelu "Trzy pojemniki pracy" — czyta stan.json (JEDYNE źródło
// stanu), waliduje go, liczy podsumowania i zapisuje PANEL.html.
// Bez zależności zewnętrznych (Node wbudowany fs/path only).
'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const STAN_PATH = path.join(ROOT, 'docs', 'program', 'plan-pojemniki', 'stan.json');
const OUT_PATH = path.join(ROOT, 'docs', 'program', 'plan-pojemniki', 'PANEL.html');

const POZYCJA_STANY = new Set(['czeka', 'w_toku', 'do_odbioru', 'odebrane', 'scalone', 'odeslane', 'stop']);
const SZAMPAN_STANY = new Set(['nie', 'czesciowo', 'tak']);
const WERDYKT_STANY = new Set(['brak', 'tak', 'nie']);
const DECYZJA_STANY = new Set(['czeka', 'podjeta']);

// ---------------------------------------------------------------------------
// Walidacja
// ---------------------------------------------------------------------------

class ValidationError extends Error {}

function fail(msg) {
  throw new ValidationError(msg);
}

function requireFields(obj, fields, ctx) {
  for (const f of fields) {
    if (!(f in obj)) fail(`${ctx}: brakujące pole "${f}"`);
  }
}

export function loadStan(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`stan.json nie jest poprawnym JSON: ${e.message}`);
  }
  validateStan(data);
  return data;
}

export function validateStan(data) {
  requireFields(data, ['zaktualizowano', 'sha_rejestru', 'pojemniki', 'przejscie_wlasciciela'], 'root');
  if (!Array.isArray(data.pojemniki)) fail('root: "pojemniki" musi być tablicą');
  if (!Array.isArray(data.przejscie_wlasciciela)) fail('root: "przejscie_wlasciciela" musi być tablicą');

  const seenPojemnikIds = new Set();
  for (const pojemnik of data.pojemniki) {
    requireFields(pojemnik, ['id', 'nazwa', 'cel_termin', 'definicja', 'pozycje', 'kryteria', 'szampan', 'decyzje'], 'pojemnik');
    if (seenPojemnikIds.has(pojemnik.id)) fail(`pojemnik id=${pojemnik.id} zduplikowany`);
    seenPojemnikIds.add(pojemnik.id);

    if (!Array.isArray(pojemnik.pozycje)) fail(`pojemnik ${pojemnik.id}: "pozycje" musi być tablicą`);
    for (const p of pojemnik.pozycje) {
      requireFields(p, ['nr', 'nazwa', 'wykonawca', 'zalezy_od', 'stan', 'galaz', 'sha', 'dowod', 'uwagi', 'data'], `pojemnik ${pojemnik.id} pozycja`);
      if (!POZYCJA_STANY.has(p.stan)) {
        fail(`pojemnik ${pojemnik.id} pozycja ${p.nr}: nieznany stan "${p.stan}" (dozwolone: ${[...POZYCJA_STANY].join('|')})`);
      }
    }

    if (!Array.isArray(pojemnik.kryteria)) fail(`pojemnik ${pojemnik.id}: "kryteria" musi być tablicą`);
    for (const k of pojemnik.kryteria) {
      requireFields(k, ['nr', 'tresc', 'spelnione', 'dowod'], `pojemnik ${pojemnik.id} kryterium`);
      if (typeof k.spelnione !== 'boolean') {
        fail(`pojemnik ${pojemnik.id} kryterium ${k.nr}: "spelnione" musi być boolean`);
      }
    }

    if (!Array.isArray(pojemnik.szampan)) fail(`pojemnik ${pojemnik.id}: "szampan" musi być tablicą`);
    for (const s of pojemnik.szampan) {
      requireFields(s, ['nr', 'tresc', 'kto', 'artefakt', 'stan', 'dowod'], `pojemnik ${pojemnik.id} szampan`);
      if (!SZAMPAN_STANY.has(s.stan)) {
        fail(`pojemnik ${pojemnik.id} szampan ${s.nr}: nieznany stan "${s.stan}" (dozwolone: ${[...SZAMPAN_STANY].join('|')})`);
      }
    }

    if (!Array.isArray(pojemnik.decyzje)) fail(`pojemnik ${pojemnik.id}: "decyzje" musi być tablicą`);
    for (const d of pojemnik.decyzje) {
      requireFields(d, ['tresc', 'rekomendacja', 'stan', 'dec'], `pojemnik ${pojemnik.id} decyzja`);
      if (!DECYZJA_STANY.has(d.stan)) {
        fail(`pojemnik ${pojemnik.id} decyzja "${d.tresc}": nieznany stan "${d.stan}" (dozwolone: ${[...DECYZJA_STANY].join('|')})`);
      }
    }
  }

  for (const m of data.przejscie_wlasciciela) {
    requireFields(m, ['modul', 'werdykt', 'zdanie'], 'przejscie_wlasciciela');
    if (!WERDYKT_STANY.has(m.werdykt)) {
      fail(`przejscie_wlasciciela "${m.modul}": nieznany werdykt "${m.werdykt}" (dozwolone: ${[...WERDYKT_STANY].join('|')})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Podsumowania (liczniki)
// ---------------------------------------------------------------------------

const POZYCJA_DONE = new Set(['odebrane', 'scalone']);

export function computeSummary(pojemnik) {
  const pozycjeTotal = pojemnik.pozycje.length;
  const pozycjeDone = pojemnik.pozycje.filter((p) => POZYCJA_DONE.has(p.stan)).length;

  const kryteriaTotal = pojemnik.kryteria.length;
  const kryteriaDone = pojemnik.kryteria.filter((k) => k.spelnione === true).length;

  const szampanTotal = pojemnik.szampan.length;
  const szampanDone = pojemnik.szampan.filter((s) => s.stan === 'tak').length;

  const decyzjeCzekajace = pojemnik.decyzje.filter((d) => d.stan === 'czeka').length;

  return {
    pozycjeTotal,
    pozycjeDone,
    kryteriaTotal,
    kryteriaDone,
    szampanTotal,
    szampanDone,
    decyzjeCzekajace,
  };
}

// ---------------------------------------------------------------------------
// Render HTML
// ---------------------------------------------------------------------------

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function chipStanPozycja(stan) {
  const cls = {
    czeka: 'chip-neutral',
    w_toku: 'chip-amber',
    do_odbioru: 'chip-amber',
    odebrane: 'chip-green',
    scalone: 'chip-green',
    odeslane: 'chip-crimson',
    stop: 'chip-crimson',
  }[stan] || 'chip-neutral';
  const label = {
    czeka: 'CZEKA',
    w_toku: 'W TOKU',
    do_odbioru: 'DO ODBIORU',
    odebrane: 'ODEBRANE',
    scalone: 'SCALONE',
    odeslane: 'ODESŁANE',
    stop: 'STOP',
  }[stan] || esc(stan);
  return `<span class="chip ${cls}">${label}</span>`;
}

function chipSzampan(stan) {
  const cls = { nie: 'chip-neutral', czesciowo: 'chip-amber', tak: 'chip-green' }[stan] || 'chip-neutral';
  const label = { nie: 'NIE', czesciowo: 'CZĘŚCIOWO', tak: 'TAK' }[stan] || esc(stan);
  return `<span class="chip ${cls}">${label}</span>`;
}

function chipWerdykt(werdykt) {
  const cls = { brak: 'chip-neutral', tak: 'chip-green', nie: 'chip-crimson' }[werdykt] || 'chip-neutral';
  const label = { brak: 'BRAK', tak: 'TAK', nie: 'NIE' }[werdykt] || esc(werdykt);
  return `<span class="chip ${cls}">${label}</span>`;
}

function chipDecyzja(stan) {
  const cls = { czeka: 'chip-amber', podjeta: 'chip-green' }[stan] || 'chip-neutral';
  const label = { czeka: 'CZEKA', podjeta: 'PODJĘTA' }[stan] || esc(stan);
  return `<span class="chip ${cls}">${label}</span>`;
}

function iconCheck(on) {
  if (on) {
    return '<svg class="ico ico-ok" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.7 8.3 7 10.6l4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  return '<svg class="ico ico-open" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
}

function renderPozycjeTable(pozycje) {
  const rows = pozycje.map((p) => {
    const rowCls = p.stan === 'w_toku' ? 'row-w-toku' : (p.stan === 'stop' || p.stan === 'odeslane') ? 'row-stop' : '';
    return `<tr class="${rowCls}">
      <td class="mono nowrap">${esc(p.nr)}</td>
      <td>${esc(p.nazwa)}</td>
      <td class="nowrap">${esc(p.wykonawca)}</td>
      <td>${chipStanPozycja(p.stan)}</td>
      <td class="mono nowrap">${esc(p.galaz)}${p.sha ? ` <span class="muted">·</span> ${esc(p.sha)}` : ''}</td>
      <td>${esc(p.dowod)}${p.uwagi ? `<div class="uwagi">${esc(p.uwagi)}</div>` : ''}</td>
      <td class="mono nowrap">${esc(p.data)}</td>
    </tr>`;
  }).join('\n');

  const cards = pozycje.map((p) => {
    const rowCls = p.stan === 'w_toku' ? 'card-w-toku' : (p.stan === 'stop' || p.stan === 'odeslane') ? 'card-stop' : '';
    return `<div class="pozycja-card ${rowCls}">
      <div class="pozycja-card-top">
        <span class="mono">${esc(p.nr)}</span>
        ${chipStanPozycja(p.stan)}
      </div>
      <div class="pozycja-card-nazwa">${esc(p.nazwa)}</div>
      <div class="pozycja-card-meta">
        <span>${esc(p.wykonawca)}</span>
        ${p.zalezy_od && p.zalezy_od !== '—' ? `<span class="muted">zależy: ${esc(p.zalezy_od)}</span>` : ''}
        ${p.data ? `<span class="mono muted">${esc(p.data)}</span>` : ''}
      </div>
      ${(p.galaz || p.sha) ? `<div class="mono pozycja-card-galaz">${esc(p.galaz)}${p.sha ? ` · ${esc(p.sha)}` : ''}</div>` : ''}
      ${p.dowod ? `<div class="pozycja-card-dowod">${esc(p.dowod)}</div>` : ''}
      ${p.uwagi ? `<div class="uwagi">${esc(p.uwagi)}</div>` : ''}
    </div>`;
  }).join('\n');

  return `<div class="table-wrap">
    <table class="std-table">
      <thead><tr>
        <th>NR</th><th>POZYCJA</th><th>WYKONAWCA</th><th>STAN</th><th>GAŁĄŹ / SHA</th><th>DOWÓD</th><th>DATA</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="card-list">${cards}</div>`;
}

function renderKryteria(kryteria) {
  return `<ul class="kryteria-list">
    ${kryteria.map((k) => `<li class="kryterium-item ${k.spelnione ? 'is-done' : ''}">
      <span class="kryterium-ico">${iconCheck(k.spelnione)}</span>
      <div>
        <div class="kryterium-tresc"><span class="mono muted">${esc(k.nr)}.</span> ${esc(k.tresc)}</div>
        ${k.dowod ? `<div class="kryterium-dowod">${esc(k.dowod)}</div>` : ''}
      </div>
    </li>`).join('\n')}
  </ul>`;
}

function renderSzampan(szampan) {
  const rows = szampan.map((s) => `<tr>
    <td class="mono nowrap">${esc(s.nr)}</td>
    <td>${esc(s.tresc)}</td>
    <td class="nowrap">${esc(s.kto)}</td>
    <td>${esc(s.artefakt)}</td>
    <td>${chipSzampan(s.stan)}</td>
  </tr>`).join('\n');

  const cards = szampan.map((s) => `<div class="pozycja-card">
    <div class="pozycja-card-top"><span class="mono">${esc(s.nr)}</span>${chipSzampan(s.stan)}</div>
    <div class="pozycja-card-nazwa">${esc(s.tresc)}</div>
    <div class="pozycja-card-meta"><span>${esc(s.kto)}</span></div>
    <div class="pozycja-card-dowod">${esc(s.artefakt)}</div>
  </div>`).join('\n');

  return `<div class="table-wrap">
    <table class="std-table">
      <thead><tr><th>NR</th><th>CO MUSI BYĆ PRAWDĄ</th><th>KTO</th><th>ARTEFAKT</th><th>STAN</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="card-list">${cards}</div>`;
}

function renderDecyzje(decyzje) {
  if (decyzje.length === 0) {
    return '<p class="muted">Brak decyzji właściciela w kolejce dla tego pojemnika.</p>';
  }
  return `<ul class="decyzje-list">
    ${decyzje.map((d) => `<li class="decyzja-item">
      <div class="decyzja-top">
        <span class="decyzja-tresc">${esc(d.tresc)}</span>
        ${chipDecyzja(d.stan)}
        ${d.dec ? `<span class="mono decyzja-nr">${esc(d.dec)}</span>` : ''}
      </div>
      <div class="decyzja-rekomendacja">Rekomendacja CTO: ${esc(d.rekomendacja)}</div>
    </li>`).join('\n')}
  </ul>`;
}

function renderPrzejscie(modules) {
  return `<div class="moduly-grid">
    ${modules.map((m) => `<div class="modul-card">
      <div class="modul-card-top">
        <span class="modul-nazwa">${esc(m.modul)}</span>
        ${chipWerdykt(m.werdykt)}
      </div>
      <div class="modul-zdanie">${esc(m.zdanie)}</div>
    </div>`).join('\n')}
  </div>`;
}

function renderPojemnikTab(pojemnik, idx, summary) {
  const active = idx === 0 ? ' active' : '';
  return `<section class="tab-panel${active}" id="panel-${pojemnik.id}" role="tabpanel" aria-labelledby="tab-${pojemnik.id}" ${idx === 0 ? '' : 'hidden'}>
    <p class="pojemnik-definicja">${esc(pojemnik.definicja)}</p>

    <h3 class="section-title">Pozycje</h3>
    ${renderPozycjeTable(pojemnik.pozycje)}

    <h3 class="section-title">Kryteria gotowe</h3>
    ${renderKryteria(pojemnik.kryteria)}

    <h3 class="section-title">🍾 Lista szampana</h3>
    ${renderSzampan(pojemnik.szampan)}

    <h3 class="section-title">Decyzje właściciela</h3>
    ${renderDecyzje(pojemnik.decyzje)}

    ${pojemnik.id === 1 ? `<h3 class="section-title">Przejście właściciela</h3>${renderPrzejscie(GLOBAL_PRZEJSCIE)}` : ''}
  </section>`;
}

let GLOBAL_PRZEJSCIE = [];

function renderKafle(data, summaries) {
  return data.pojemniki.map((p, idx) => {
    const s = summaries[idx];
    const pct = s.pozycjeTotal > 0 ? Math.round((s.pozycjeDone / s.pozycjeTotal) * 100) : 0;
    const activeCls = idx === 0 ? ' kafel-active' : '';
    return `<button class="kafel${activeCls}" data-tab-target="${p.id}" id="tabbtn-${p.id}" role="tab" aria-selected="${idx === 0}" aria-controls="panel-${p.id}">
      <div class="kafel-nazwa">Pojemnik ${p.id} <span class="kafel-nazwa-pelna">— ${esc(p.nazwa)}</span></div>
      <div class="kafel-termin">${esc(p.cel_termin)}</div>
      <div class="kafel-progress">
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span class="mono progress-label">${s.pozycjeDone}/${s.pozycjeTotal} pozycji</span>
      </div>
      <div class="kafel-liczniki">
        <span class="mono">${s.kryteriaDone}/${s.kryteriaTotal} kryteriów</span>
        <span class="mono">${s.decyzjeCzekajace} decyzji czeka</span>
      </div>
    </button>`;
  }).join('\n');
}

export function renderHtml(data) {
  const summaries = data.pojemniki.map(computeSummary);
  GLOBAL_PRZEJSCIE = data.przejscie_wlasciciela;

  const tabs = data.pojemniki.map((p, idx) => {
    const activeCls = idx === 0 ? ' tab-active' : '';
    return `<button class="tab-link${activeCls}" data-tab-target="${p.id}" id="tab-${p.id}" role="tab" aria-selected="${idx === 0}" aria-controls="panel-${p.id}">Pojemnik ${p.id}</button>`;
  }).join('\n');

  const panels = data.pojemniki.map((p, idx) => renderPojemnikTab(p, idx, summaries[idx])).join('\n');

  return `<title>Trzy pojemniki Consultify</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --bg:#F7F6F3; --surface:#FFFFFF; --text:#1B1D21; --text-muted:#5F646C; --line:#E1DFD9;
  --accent:#1F5F7A;
  --green:#2E7D4F; --amber:#B7791F; --neutral:#8A8F98; --crimson:#85182F;
  --green-bg:#e7f3ec; --amber-bg:#faf1de; --neutral-bg:#eeeeec; --crimson-bg:#f9e6ea;
  --font-head:'IBM Plex Sans Condensed',system-ui,sans-serif;
  --font-body:'IBM Plex Sans',system-ui,sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,monospace;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#15171A; --surface:#1B1E22; --text:#E8E6E1; --text-muted:#A2A6AE; --line:#2B2E33;
    --accent:#7FB8D3;
    --green:#6FCF97; --amber:#E3B341; --neutral:#8A8F98; --crimson:#E06C84;
    --green-bg:#193226; --amber-bg:#332a15; --neutral-bg:#26282c; --crimson-bg:#341a20;
  }
}
:root[data-theme="dark"]{
  --bg:#15171A; --surface:#1B1E22; --text:#E8E6E1; --text-muted:#A2A6AE; --line:#2B2E33;
  --accent:#7FB8D3;
  --green:#6FCF97; --amber:#E3B341; --neutral:#8A8F98; --crimson:#E06C84;
  --green-bg:#193226; --amber-bg:#332a15; --neutral-bg:#26282c; --crimson-bg:#341a20;
}
*{box-sizing:border-box;}
body{
  background:var(--bg); color:var(--text); font-family:var(--font-body);
  font-size:14px; line-height:1.5;
}
h1,h2,h3,h4{font-family:var(--font-head); text-wrap:balance; margin:0;}
.wrap{max-width:1400px; margin:0 auto; padding:20px 20px 60px;}
.page-title{font-size:20px; font-weight:700; margin-bottom:4px;}
.page-sub{color:var(--text-muted); font-size:13px; margin-bottom:20px;}
.mono{font-family:var(--font-mono); font-variant-numeric:tabular-nums;}
.muted{color:var(--text-muted);}
.nowrap{white-space:nowrap;}
a{color:var(--accent);}
:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}

.kafle{display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px;}
@media (max-width:700px){.kafle{grid-template-columns:1fr;}}
.kafel{
  text-align:left; background:var(--surface); border:1px solid var(--line); border-radius:8px;
  padding:14px 16px; cursor:pointer; font-family:var(--font-body); color:var(--text);
  display:flex; flex-direction:column; gap:8px;
}
.kafel-active{border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset;}
.kafel-nazwa{font-family:var(--font-head); font-weight:700; font-size:16px;}
.kafel-nazwa-pelna{font-weight:500; color:var(--text-muted); font-size:13px;}
.kafel-termin{color:var(--text-muted); font-size:12px; text-transform:uppercase; letter-spacing:0.04em;}
.progress-track{background:var(--neutral-bg); border-radius:4px; height:6px; overflow:hidden; flex:1;}
.progress-fill{background:var(--accent); height:100%;}
.kafel-progress{display:flex; align-items:center; gap:8px;}
.progress-label{font-size:12px; color:var(--text-muted); white-space:nowrap;}
.kafel-liczniki{display:flex; gap:14px; font-size:12px; color:var(--text-muted);}

.tabs{display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:16px; flex-wrap:wrap;}
.tab-link{
  background:transparent; border:none; border-bottom:2px solid transparent; padding:8px 14px;
  font-family:var(--font-head); font-weight:600; font-size:14px; color:var(--text-muted); cursor:pointer;
}
.tab-active{color:var(--accent); border-bottom-color:var(--accent);}

.pojemnik-definicja{color:var(--text-muted); margin-bottom:16px; max-width:80ch;}
.section-title{
  font-size:16px; font-weight:700; margin-top:28px; margin-bottom:10px;
  text-transform:uppercase; letter-spacing:0.04em;
}
.section-title:first-of-type{margin-top:0;}

.table-wrap{overflow-x:auto; border:1px solid var(--line); border-radius:8px;}
.std-table{width:100%; border-collapse:collapse; min-width:640px; background:var(--surface);}
.std-table th{
  text-align:left; font-family:var(--font-head); font-size:12px; text-transform:uppercase;
  letter-spacing:0.04em; color:var(--text-muted); padding:10px 12px; border-bottom:1px solid var(--line);
  white-space:nowrap;
}
.std-table td{padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top;}
.std-table tbody tr:last-child td{border-bottom:none;}
.row-w-toku{box-shadow:inset 3px 0 0 var(--amber);}
.row-stop{box-shadow:inset 3px 0 0 var(--crimson);}
.uwagi{color:var(--text-muted); font-size:12.5px; margin-top:4px;}

.card-list{display:none; flex-direction:column; gap:10px;}
@media (max-width:700px){
  .table-wrap{display:none;}
  .card-list{display:flex;}
}
.pozycja-card{background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:12px 14px;}
.card-w-toku{box-shadow:inset 3px 0 0 var(--amber);}
.card-stop{box-shadow:inset 3px 0 0 var(--crimson);}
.pozycja-card-top{display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;}
.pozycja-card-nazwa{font-weight:600; margin-bottom:6px;}
.pozycja-card-meta{display:flex; gap:10px; flex-wrap:wrap; font-size:12.5px; color:var(--text-muted); margin-bottom:6px;}
.pozycja-card-galaz{font-size:12px; color:var(--text-muted); margin-bottom:6px;}
.pozycja-card-dowod{font-size:13px;}

.chip{
  display:inline-block; font-family:var(--font-head); font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.04em; padding:2px 8px; border-radius:99px; white-space:nowrap;
}
.chip-green{background:var(--green-bg); color:var(--green);}
.chip-amber{background:var(--amber-bg); color:var(--amber);}
.chip-neutral{background:var(--neutral-bg); color:var(--neutral);}
.chip-crimson{background:var(--crimson-bg); color:var(--crimson);}

.kryteria-list{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px;}
.kryterium-item{display:flex; gap:10px; align-items:flex-start;}
.kryterium-ico{color:var(--neutral); flex:0 0 auto; margin-top:2px;}
.kryterium-item.is-done .kryterium-ico{color:var(--green);}
.ico{width:16px; height:16px; display:block;}
.kryterium-tresc{font-size:13.5px;}
.kryterium-dowod{color:var(--text-muted); font-size:12.5px; margin-top:2px;}

.decyzje-list{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px;}
.decyzja-item{border:1px solid var(--line); border-radius:8px; padding:10px 14px; background:var(--surface);}
.decyzja-top{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;}
.decyzja-tresc{font-weight:600; flex:1 1 auto;}
.decyzja-nr{color:var(--text-muted); font-size:12px;}
.decyzja-rekomendacja{color:var(--text-muted); font-size:12.5px;}

.moduly-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px;}
.modul-card{border:1px solid var(--line); border-radius:8px; padding:10px 12px; background:var(--surface);}
.modul-card-top{display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;}
.modul-nazwa{font-weight:700; font-family:var(--font-head);}
.modul-zdanie{font-size:12.5px; color:var(--text-muted);}

.footer{margin-top:32px; padding-top:14px; border-top:1px solid var(--line); font-size:12px; color:var(--text-muted);}
</style>
<div class="wrap">
  <div class="page-title">Trzy pojemniki pracy — panel kontroli</div>
  <div class="page-sub">MVP rękami właściciela → MVP rękami klienta → Fala 2</div>

  <div class="kafle" id="kafle">${renderKafle(data, summaries)}</div>

  <div class="tabs" role="tablist">${tabs}</div>

  ${panels}

  <div class="footer">Stan z: <span class="mono">${esc(data.zaktualizowano)}</span> · rejestr <span class="mono">${esc(data.sha_rejestru)}</span> · źródło: <span class="mono">docs/program/plan-pojemniki/stan.json</span></div>
</div>
<script>
(function(){
  function activate(id){
    document.querySelectorAll('.tab-link').forEach(function(btn){
      var on = btn.getAttribute('data-tab-target') === String(id);
      btn.classList.toggle('tab-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.kafel').forEach(function(btn){
      btn.classList.toggle('kafel-active', btn.getAttribute('data-tab-target') === String(id));
    });
    document.querySelectorAll('.tab-panel').forEach(function(panel){
      var on = panel.id === 'panel-' + id;
      panel.classList.toggle('active', on);
      if (on) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    });
    try { localStorage.setItem('plan-pojemniki-tab', String(id)); } catch (e) {}
  }
  document.querySelectorAll('[data-tab-target]').forEach(function(el){
    el.addEventListener('click', function(){ activate(el.getAttribute('data-tab-target')); });
  });
  var saved = null;
  try { saved = localStorage.getItem('plan-pojemniki-tab'); } catch (e) {}
  if (saved && document.getElementById('panel-' + saved)) activate(saved);
})();
</script>`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  let raw;
  try {
    raw = readFileSync(STAN_PATH, 'utf8');
  } catch (e) {
    console.error(`Nie mogę odczytać ${STAN_PATH}: ${e.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = loadStan(raw);
  } catch (e) {
    console.error(`Błąd walidacji stan.json: ${e.message}`);
    process.exit(1);
  }

  const html = renderHtml(data);
  writeFileSync(OUT_PATH, html, 'utf8');

  const summaries = data.pojemniki.map(computeSummary);
  console.log(`Zapisano ${OUT_PATH}`);
  data.pojemniki.forEach((p, idx) => {
    const s = summaries[idx];
    console.log(`  Pojemnik ${p.id} (${p.nazwa}): pozycje ${s.pozycjeDone}/${s.pozycjeTotal}, kryteria ${s.kryteriaDone}/${s.kryteriaTotal}, szampan ${s.szampanDone}/${s.szampanTotal}, decyzji czeka ${s.decyzjeCzekajace}`);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
