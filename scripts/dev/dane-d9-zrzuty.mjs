#!/usr/bin/env node
/**
 * D9 — zrzuty dowodowe PO dosiewie (RAPORT_DANE.md §5, piec brakow).
 *
 * Pieć ekranow, po jednym na kazdy brak. Zrzuty PRZED sa juz w repo —
 * `evidence/test-jezyk-dane-0909/dane/` (przebieg 2 testu TEST-DANE na tym
 * SAMYM szablonie bazy `consultify_staging_czysta`), wiec nie robimy ich
 * ponownie: pare PRZED/PO zestawia README.
 *
 * Haslo czytane z pliku POZA repo w czasie wykonania — NIGDY nie jest
 * wypisywane ani zapisywane w zrzucie (defekt D-21 raportu: hasło raz
 * wypisane w logu narzedzia).
 *
 * UZYCIE
 *   BASE=http://127.0.0.1:3228 node scripts/dev/dane-d9-zrzuty.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3228';
const OUT = process.env.OUT || path.join(process.cwd(), 'evidence/dane-pokazowe-en/d9');
const SEKRETY = '/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt';
const EMAIL = process.env.EMAIL || 'james.whitfield@northwind.example';

fs.mkdirSync(OUT, { recursive: true });

/**
 * UWAGA — PULAPKA ZMIERZONA 09.09. Harness TEST-DANE czytal haslo wzorcem
 * `/has(?:ł|l)o[^:]*:\s*(\S+)/i`. Po rotacji z 09.09 18:23 plik sekretow ma
 * NOWA PIERWSZA linie „Rotacja hasła: 2026-09-09T18:23…", w ktora ten wzorzec
 * trafia PIERWSZA — i zwraca DATE zamiast hasla. Objaw: logowanie wisi
 * i `waitForURL` konczy sie timeoutem, bez ani jednego slowa o hasle.
 * Dlatego celujemy w konkretna linie, nie w slowo „haslo".
 */
function haslo() {
  const t = fs.readFileSync(SEKRETY, 'utf8');
  const m =
    t.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/) ??
    t.match(/^\s*(?:HASLO|HASŁO|PASSWORD)\s*[:=]\s*(.+)$/im);
  if (!m) throw new Error('brak hasla w pliku sekretow');
  return m[1].trim();
}

/** Piec ekranow = piec brakow. `czekaj` to tekst, ktory MUSI sie pojawic. */
const EKRANY = [
  { id: 'brak1-organizacja-profil', route: '/organization/profile', brak: 'BRAK 1 — profil organizacji' },
  { id: 'brak2-wywiad-inbox', route: '/interview', brak: 'BRAK 2 — Wywiad / Inbox' },
  { id: 'brak3-wyniki-karta-kpi', route: '/results/kpi', brak: 'BRAK 3 — Wyniki / przeglad karty KPI' },
  { id: 'brak4-realizacja-zasoby', route: '/execution', brak: 'BRAK 4 — Realizacja / Resources', zakladka: 'Resources' },
  { id: 'brak5-materialy-lista', route: '/presentations', brak: 'BRAK 5 — Materialy / kolumny pochodne' },
  // Zakladka „All" (Outputs) — to TU zyja kolumny FORMAT i SOURCE; domyslnym
  // ekranem Materialow jest „Presentations" (2 wiersze), a nie caly rejestr (7).
  { id: 'brak5-materialy-all', route: '/presentations', brak: 'BRAK 5 — Materialy / zakladka All', zakladka: 'All' },
  // Inicjatywy — to TU sa kolumny LEVEL, VARIANCE i AREA/AXIS.
  { id: 'brak5-inicjatywy-rejestr', route: '/initiatives', brak: 'BRAK 5 — Inicjatywy / LEVEL·VARIANCE·AREA' },
  // Realizacja → tabela Work: LEVEL i VARIANCE (deviation) per inicjatywa.
  { id: 'brak5-realizacja-work', route: '/execution', brak: 'BRAK 5 — Realizacja / Work', zakladka: 'Work' },
];

const wynik = { start: new Date().toISOString(), base: BASE, ekrany: [] };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB' });
  const page = await ctx.newPage();

  const konsola = [];
  const siec = [];
  page.on('console', (m) => {
    if (m.type() === 'error') konsola.push(m.text().slice(0, 200));
  });
  page.on('response', (r) => {
    if (r.status() >= 400) siec.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 140)}`);
  });

  // Logowanie
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', haslo());
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 30000 });
  await page.waitForTimeout(2500);

  for (const e of EKRANY) {
    konsola.length = 0;
    siec.length = 0;
    await page.goto(`${BASE}${e.route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    if (e.zakladka) {
      const tab = page.getByRole('tab', { name: new RegExp(e.zakladka, 'i') }).first();
      const btn = page.getByRole('button', { name: new RegExp(`^${e.zakladka}`, 'i') }).first();
      if (await tab.count().catch(() => 0)) await tab.click().catch(() => {});
      else if (await btn.count().catch(() => 0)) await btn.click().catch(() => {});
      await page.waitForTimeout(3500);
    }

    const plik = path.join(OUT, `PO-${e.id}.png`);
    await page.screenshot({ path: plik, fullPage: false });

    const tekst = await page.evaluate(() => (document.querySelector('main') || document.body).innerText || '');
    wynik.ekrany.push({
      id: e.id,
      brak: e.brak,
      route: e.route,
      plik: path.basename(plik),
      dlugoscTekstu: tekst.length,
      wierszeTabeli: await page.evaluate(() => document.querySelectorAll('tbody tr').length),
      myslnikow: (tekst.match(/—/g) || []).length,
      bledyKonsoli: [...konsola],
      odpowiedzi4xx5xx: [...siec],
    });
    console.log(
      `[d9-zrzuty] ${e.id}: wierszy=${wynik.ekrany.at(-1).wierszeTabeli} ` +
        `bledow=${konsola.length} 4xx/5xx=${siec.length}`
    );
  }

  // ---- BRAK 3: EKRAN PRZEGLADU KARTY (nie sama lista raportow) ----------
  // Lista `/results/kpi` pokazuje raport, ale opublikowana migawke widac
  // dopiero PO otwarciu karty — i to ta nawigacja wolala `GET
  // …/review-snapshots/published`, jedyne 4xx calego testu TEST-DANE.
  {
    konsola.length = 0;
    siec.length = 0;
    await page.goto(`${BASE}/results/kpi`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const wiersz = page.locator('tbody tr').first();
    if (await wiersz.count().catch(() => 0)) {
      await wiersz.dblclick().catch(() => {});
      await page.waitForTimeout(5000);
    }
    const plik = path.join(OUT, 'PO-brak3b-wyniki-przeglad-karty.png');
    await page.screenshot({ path: plik, fullPage: false });
    const tekst = await page.evaluate(() => (document.querySelector('main') || document.body).innerText || '');
    wynik.ekrany.push({
      id: 'brak3b-wyniki-przeglad-karty',
      brak: 'BRAK 3 — Wyniki / otwarta karta KPI (sciezka, ktora dawala 404)',
      route: '/results/kpi → otwarcie raportu',
      plik: path.basename(plik),
      dlugoscTekstu: tekst.length,
      wierszeTabeli: await page.evaluate(() => document.querySelectorAll('tbody tr').length),
      myslnikow: (tekst.match(/—/g) || []).length,
      bledyKonsoli: [...konsola],
      odpowiedzi4xx5xx: [...siec],
    });
    console.log(
      `[d9-zrzuty] brak3b-wyniki-przeglad-karty: wierszy=${wynik.ekrany.at(-1).wierszeTabeli} ` +
        `bledow=${konsola.length} 4xx/5xx=${siec.length}`
    );
  }

  // ---- BRAK 5: dowod z API (kolumny FORMAT/SOURCE sa domyslnie UKRYTE) ---
  // `OutputsAggregateTabContent.tsx` ma `defaultVisible: false` na FORMAT
  // i SOURCE, wiec zrzut listy ich NIE POKAZE bez recznego pstryczka kolumn.
  // Zeby dowod nie byl „na slowo", zapisujemy odpowiedz tej samej trasy,
  // z ktorej lista je bierze.
  const artefakty = await page.evaluate(async () => {
    const r = await fetch('/api/artifacts?limit=100', { credentials: 'include' });
    if (!r.ok) return { status: r.status, items: [] };
    const j = await r.json();
    const lista = j.items || j.data?.items || j.artifacts || j.data || [];
    return {
      status: r.status,
      items: (Array.isArray(lista) ? lista : [])
        .map((a) => ({
          title: a.resolvedTitle || a.title || a.titleSnapshot,
          exportFormat: a.exportFormat ?? null,
          originRuntime: a.originRuntime ?? null,
          artifactFamily: a.artifactFamily ?? a.artifact_family ?? null,
        }))
        .filter((a) => a.artifactFamily && a.artifactFamily !== 'template'),
    };
  });
  fs.writeFileSync(path.join(OUT, 'brak5-artefakty-api.json'), JSON.stringify(artefakty, null, 2));
  console.log(
    `[d9-zrzuty] BRAK 5 (API /api/artifacts): status=${artefakty.status} ` +
      `nie-szablonow=${artefakty.items.length} ` +
      `z FORMAT=${artefakty.items.filter((a) => a.exportFormat).length} ` +
      `z SOURCE=${artefakty.items.filter((a) => a.originRuntime).length}`
  );

  await browser.close();
  wynik.koniec = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'zrzuty-wynik.json'), JSON.stringify(wynik, null, 2));
  console.log(`[d9-zrzuty] gotowe: ${wynik.ekrany.length} zrzutow w ${OUT}`);
}

main().catch((e) => {
  console.error('[d9-zrzuty] BLAD:', e.message);
  process.exit(1);
});
