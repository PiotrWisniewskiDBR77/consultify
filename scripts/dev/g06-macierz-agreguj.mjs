// G06 — agregacja wyników pełnej macierzy z g06-macierz-uruchom.mjs.
//
// Liczy per moduł i per ekran: kadry z REALNYM naruszeniem dostępności
// (po odjęciu WYŁĄCZNIE trzech reguł potwierdzonych jako artefakt hosta
// dev-render: landmark-one-main, page-has-heading-one, region — patrz
// _aggregate-g06-final-01-04.mjs i sprostowanie z 2026-09-03), błędy konsoli
// i HTTP z podziałem na „404 harnessu na /api/*" (host nie ma backendu, oddaje
// uczciwe 404) i pozostałe (kandydat na defekt produktu), oraz kadry ze
// statusem innym niż OK / „wynik BRAK" (crash, brak renderu).
//
// Użycie: node scripts/dev/g06-macierz-agreguj.mjs --wejscie=<katalog> [--md=<plik.md>] [--json=<plik.json>]
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const WEJSCIE = arg('wejscie', '');
const MD = arg('md', '');
const JSON_OUT = arg('json', '');
if (!WEJSCIE) {
  console.error('Podaj --wejscie=<katalog z g06-macierz-uruchom>');
  process.exit(2);
}

const SZUM_HOSTA = new Set(['landmark-one-main', 'page-has-heading-one', 'region']);
// Uzasadnione wyjątki (z powodem i źródłem) — patrz g06-macierz-wyjatki.json obok.
const WYJATKI = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('./g06-macierz-wyjatki.json', import.meta.url), 'utf8'));
  } catch {
    return { plRownaEn: {}, brakTekstu: {} };
  }
})();
const KOMBINACJE = ['pl-1440', 'pl-1024', 'en-1440', 'en-1024'];

const jestHarness404 = (b) => b.status === 404 && /\/api\//.test(b.url || '');
const jestKonsola404 = (m) => /status of 404/.test(m);
// Komunikaty konsoli będące SKUTKIEM braku backendu w harnessie (fetch do /api/*
// oddaje 404, komponent loguje własny błąd). Liczone osobno — to nie jest defekt
// produktu ani szum a11y, ale nie wolno ich mieszać z realnymi wyjątkami renderu.
const jestKonsolaPochodna = (m) =>
  /(Failed to fetch|Error fetching|Failed to load|unavailable\)|NetworkError|Load failed|fetch failed|HTTP 404)/i.test(String(m));

const moduly = fs.readdirSync(WEJSCIE).filter((d) => /^\d{2}_/.test(d)).sort();
const wynik = {};
for (const mod of moduly) {
  const ekrany = {};
  const brakujace = [];
  for (const komb of KOMBINACJE) {
    const kat = path.join(WEJSCIE, mod, komb);
    if (!fs.existsSync(kat)) {
      brakujace.push(komb);
      continue;
    }
    const pliki = fs.readdirSync(kat).filter((f) => /^wynik.*\.json$/.test(f));
    if (!pliki.length) brakujace.push(komb);
    for (const f of pliki) {
      const w = JSON.parse(fs.readFileSync(path.join(kat, f), 'utf8'));
      // Para jasny/ciemny z narzędzia: powod !== null = para NIE przeszła kontroli
      // (duplikat zamiast motywu — kształt 13) albo różnica luminancji poniżej progu.
      for (const p of w.pary || []) {
        const e = (ekrany[p.ekran] ||= { kadry: 0, a11yKadry: 0, a11yIds: {}, a11yGdzie: [], harness404: 0, konsolaPochodna: 0, inneBledy: [], zleStatusy: [], zwinieteNieznane: [], paryZle: [], tekst: {} });
        if (p.powod || (p.roznicaLuminancji != null && p.roznicaLuminancji < 30)) e.paryZle.push(`${komb}: ${p.powod || `ΔL=${p.roznicaLuminancji.toFixed(1)}`}`);
      }
      for (const r of w.wyniki) {
        const e = (ekrany[r.ekran] ||= { kadry: 0, a11yKadry: 0, a11yIds: {}, a11yGdzie: [], harness404: 0, konsolaPochodna: 0, inneBledy: [], zleStatusy: [], zwinieteNieznane: [], paryZle: [], tekst: {} });
        e.kadry += 1;
        // Tekst renderu per język (do kontroli PL≠EN): bierzemy kadr light przy 1440.
        if (r.motyw === 'light' && komb.endsWith('-1440')) e.tekst[komb.slice(0, 2)] = (r.tekst || '').replace(/\s+/g, ' ').trim();
        const real = (r.a11yNaruszenia || []).filter((v) => !SZUM_HOSTA.has(v.id));
        if (real.length) {
          e.a11yKadry += 1;
          e.a11yGdzie.push(`${komb}/${r.motyw}`);
          for (const v of real) e.a11yIds[v.id] = (e.a11yIds[v.id] || 0) + 1;
        }
        const http = r.httpBledy || [];
        const konsola = r.bledyKonsoli || [];
        e.harness404 += http.filter(jestHarness404).length;
        for (const b of http.filter((x) => !jestHarness404(x))) e.inneBledy.push(`${komb}/${r.motyw}: HTTP ${b.status} ${b.url}`);
        for (const m of konsola.filter((x) => !jestKonsola404(x))) {
          if (jestKonsolaPochodna(m)) e.konsolaPochodna += 1;
          else e.inneBledy.push(`${komb}/${r.motyw}: ${String(m).slice(0, 160)}`);
        }
        if (!/^OK|^wynik BRAK/.test(r.status || '')) e.zleStatusy.push(`${komb}/${r.motyw}: ${String(r.status).slice(0, 120)}`);
      }
    }
  }
  const lista = Object.entries(ekrany).sort(([a], [b]) => a.localeCompare(b));
  // PL=EN: identyczny tekst renderu w obu językach = język się nie przełączył
  // (albo harness przybija język — kształt 18; albo ekran jest realnie nieprzetłumaczony).
  for (const [n, e] of lista) {
    e.plRownaEn = Boolean(e.tekst.pl && e.tekst.en && e.tekst.pl === e.tekst.en);
    e.brakTekstu = !e.tekst.pl || e.tekst.pl.length < 40;
    // Wyjątek uzasadniony: liczony osobno, nie blokuje bramki, ale jest wypisany.
    if (e.plRownaEn && WYJATKI.plRownaEn?.[n]) { e.plRownaEn = false; e.wyjatek = `PL=EN: ${WYJATKI.plRownaEn[n]}`; }
    if (e.brakTekstu && WYJATKI.brakTekstu?.[n]) { e.brakTekstu = false; e.wyjatek = `bez tekstu: ${WYJATKI.brakTekstu[n]}`; }
  }
  const suma = {
    ekrany: lista.length,
    kadry: lista.reduce((s, [, e]) => s + e.kadry, 0),
    ekranyZa11y: lista.filter(([, e]) => e.a11yKadry).length,
    kadryZa11y: lista.reduce((s, [, e]) => s + e.a11yKadry, 0),
    a11yIds: {},
    ekranyZinnymiBledami: lista.filter(([, e]) => e.inneBledy.length).length,
    ekranyZKonsolaPochodna: lista.filter(([, e]) => e.konsolaPochodna).length,
    ekranyZeZlymStatusem: lista.filter(([, e]) => e.zleStatusy.length).length,
    ekranyPlRownaEn: lista.filter(([, e]) => e.plRownaEn).map(([n]) => n),
    ekranyZlaPara: lista.filter(([, e]) => e.paryZle.length).map(([n]) => n),
    ekranyBezTekstu: lista.filter(([, e]) => e.brakTekstu).map(([n]) => n),
    wyjatki: lista.filter(([, e]) => e.wyjatek).map(([n, e]) => `${n} — ${e.wyjatek}`),
    ekranyNiepelne: lista.filter(([, e]) => e.kadry !== 8).map(([n, e]) => `${n}(${e.kadry})`),
    brakujaceKombinacje: brakujace,
  };
  for (const [, e] of lista) for (const [id, n] of Object.entries(e.a11yIds)) suma.a11yIds[id] = (suma.a11yIds[id] || 0) + n;
  wynik[mod] = { suma, ekrany: Object.fromEntries(lista) };
}

const linie = [];
linie.push('| Moduł | Ekranów | Kadrów | Ekrany z realnym a11y | Kadry z a11y | Reguły | Realny błąd konsoli | Konsola pochodna braku backendu | Zły status | PL=EN | Zła para jasny/ciemny | Bez tekstu | Niepełne |');
linie.push('| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
for (const [mod, { suma }] of Object.entries(wynik)) {
  const reguly = Object.entries(suma.a11yIds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', ') || '—';
  linie.push(`| ${mod} | ${suma.ekrany} | ${suma.kadry} | **${suma.ekranyZa11y}** | ${suma.kadryZa11y} | ${reguly} | ${suma.ekranyZinnymiBledami} | ${suma.ekranyZKonsolaPochodna} | ${suma.ekranyZeZlymStatusem} | ${suma.ekranyPlRownaEn.length} | ${suma.ekranyZlaPara.length} | ${suma.ekranyBezTekstu.length} | ${suma.ekranyNiepelne.join(', ') || (suma.brakujaceKombinacje.length ? `brak: ${suma.brakujaceKombinacje.join(',')}` : '—')} |`);
}
linie.push('');
for (const [mod, { ekrany }] of Object.entries(wynik)) {
  const zle = Object.entries(ekrany).filter(([, e]) => e.a11yKadry || e.inneBledy.length || e.zleStatusy.length || e.plRownaEn || e.paryZle.length || e.brakTekstu);
  if (!zle.length) continue;
  linie.push(`### ${mod} — ekrany z długiem`);
  for (const [n, e] of zle) {
    const ids = Object.entries(e.a11yIds).map(([k, v]) => `${k}×${v}`).join(', ');
    linie.push(`- \`${n}\`: a11y ${e.a11yKadry}/${e.kadry} kadrów${ids ? ` (${ids})` : ''}${e.zleStatusy.length ? `; ★ status: ${[...new Set(e.zleStatusy)].slice(0, 2).join(' · ')}` : ''}${e.inneBledy.length ? `; inne błędy: ${[...new Set(e.inneBledy.map((x) => x.replace(/^[^:]+: /, '')))].slice(0, 3).join(' · ')}` : ''}${e.plRownaEn ? '; ★ PL=EN (tekst identyczny w obu językach)' : ''}${e.paryZle.length ? `; ★ para jasny/ciemny: ${[...new Set(e.paryZle)].slice(0, 2).join(' · ')}` : ''}${e.brakTekstu ? '; ★ BEZ TEKSTU (<40 znaków)' : ''}`);
  }
  linie.push('');
}
const md = linie.join('\n');
console.log(md);
if (MD) fs.writeFileSync(MD, md + '\n');
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(wynik, null, 2));
