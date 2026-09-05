#!/usr/bin/env node
/**
 * 1440-overlap-check.mjs — P6_CZERWIEN_I_1440.md §5 krok 8.
 *
 * PO CO: audyt Award 2026-09-05 znalazł nagłówek SPEC-A (NModeHeader) z tekstami
 * nachodzącymi na siebie character-w-character przy ~1440 px (Dynamic SWOT: "Sekcje"
 * dosłownie na wierzchu "Aktywne", "Baza wiedzy" na wierzchu "Zapisano"). Sama kontrola
 * wzrokiem na zrzucie już raz zawiodła w tym repo (pamięć nadzorcy: "Przyrząd kłamie, a
 * oko przywyka") — ten skrypt zamienia "ktoś kiedyś zauważy nachodzenie" w mechaniczny
 * pomiar geometryczny: mierzy `getBoundingClientRect()` każdego liścia tekstowego pod
 * podanym selektorem i FAILuje, gdy dwa prostokąty się przecinają (intersection > 0 px).
 *
 * ZAKRES DZISIAJ (uczciwe ograniczenie): mierzy ekrany osiągalne przez
 * dev-render harness (mock dane, bez loginu/backendu — CLAUDE.md #7) LUB dowolny
 * URL już zalogowanej aplikacji, jeśli podasz --port wskazujący na żywy serwer.
 * NIE odwiedza automatycznie "5 archetypów SPEC-A" z realnej bazy — do tego trzeba
 * realnego środowiska (staging + ODBIOR_AUTH_STATE), które ten skrypt umie obsłużyć
 * przez --url/--port/--host, ale listę tras + sesję dostarcza wywołujący.
 *
 * --sidebar=<px> (domyślnie 0): dev-render harness NIE renderuje globalnego
 * `<Sidebar>` aplikacji (MainLayout.tsx: `md:ltr:pl-64` = 256px + `md:pr-8` = 32px
 * = 288px zjedzone przez chrome, którego harness nie ma). Bez tego offsetu test na
 * harnessie NIE reprodukuje ciasnoty realnej produkcji przy tej samej szerokości
 * viewportu — zmierzone empirycznie 2026-09-05 (P6): overlap w tym repo pojawia się
 * dopiero gdy DOSTĘPNA szerokość (nie viewport) spada poniżej progu. `--sidebar=288`
 * wstrzykuje `margin-left`+`width:calc(100vw - Npx)` na #dev-render-root PRZED
 * pomiarem, zachowując `window.innerWidth` (więc Tailwind `lg:` breakpointy nadal
 * reagują na realną szerokość viewportu, tylko dostępna przestrzeń treści się kurczy)
 * — to NIE jest hack chowający pracę, to symulacja chrome'u, którego harness nie ma.
 *
 * Użycie:
 *   node scripts/dev/1440-overlap-check.mjs --url=http://localhost:3061/?screen=tools-swot-library-detail \
 *     --selector="[data-nmode-header]" --szerokosci=1280,1440,1920 --sidebar=288 \
 *     --out=evidence/p6-czerwien-1440/swot-header-overlap
 *
 * Wyjście: <out>-<szerokosc>.json (rects + overlaps + bledyKonsoli) per szerokość,
 * <out>-<szerokosc>.png (zrzut). Exit 1 jeśli KTÓRAKOLWIEK szerokość ma overlaps.length>0.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const url = get('url');
const selector = get('selector', '[data-nmode-header]');
const szerokosci = get('szerokosci', '1280,1440,1920')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const sidebar = Number(get('sidebar', '0'));
const out = get('out');
const czekaj = Number(get('czekaj', '1200'));

if (!url || !out) {
  console.error('Wymagane: --url oraz --out. Zob. nagłówek pliku po użycie.');
  process.exit(2);
}
fs.mkdirSync(path.dirname(out), { recursive: true });

function rectsIntersect(a, b) {
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}

const browser = await chromium.launch({ headless: true });
let anyOverlap = false;
const summary = [];

for (const szerokosc of szerokosci) {
  const ctx = await browser.newContext({
    viewport: { width: szerokosc, height: 900 },
    colorScheme: 'light',
    locale: 'pl-PL',
  });
  const page = await ctx.newPage();
  const bledyKonsoli = [];
  page.on('console', (m) => {
    if (m.type() === 'error') bledyKonsoli.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => bledyKonsoli.push('pageerror: ' + String(e).slice(0, 200)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(czekaj);

  if (sidebar > 0) {
    await page.evaluate((px) => {
      const root = document.getElementById('dev-render-root');
      if (root) {
        root.style.marginLeft = `${px}px`;
        root.style.width = `calc(100vw - ${px}px)`;
        root.style.boxSizing = 'border-box';
      }
    }, sidebar);
    await page.waitForTimeout(300);
  }

  const measured = await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return null;
    const out = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      const hasDirectText = Array.from(node.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0
      );
      if (hasDirectText) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          out.push({
            text: node.textContent.trim().slice(0, 40),
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
          });
        }
      }
      node = walker.nextNode();
    }
    return out;
  }, selector);

  const rectsFile = `${out}-${szerokosc}.png`;
  await page.screenshot({ path: rectsFile });

  const overlaps = [];
  if (measured) {
    for (let i = 0; i < measured.length; i += 1) {
      for (let j = i + 1; j < measured.length; j += 1) {
        if (rectsIntersect(measured[i], measured[j])) {
          overlaps.push([measured[i].text, measured[j].text]);
        }
      }
    }
  }
  if (overlaps.length > 0) anyOverlap = true;

  const jsonFile = `${out}-${szerokosc}.json`;
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        url: page.url(),
        selector,
        szerokosc,
        sidebarSimulated: sidebar,
        found: !!measured,
        items: measured,
        overlaps,
        bledyKonsoli,
        kiedy: new Date().toISOString(),
      },
      null,
      1
    )
  );
  summary.push({ szerokosc, found: !!measured, overlapCount: overlaps.length, bledyKonsoli: bledyKonsoli.length });
  console.log(
    `[${szerokosc}px]`,
    measured ? `${measured.length} elementów tekstowych` : 'selektor nie znaleziony',
    overlaps.length > 0 ? `✗ ${overlaps.length} par nakładających się` : '✓ brak nakładania',
    bledyKonsoli.length > 0 ? `(${bledyKonsoli.length} błędów konsoli)` : ''
  );
  await ctx.close();
}

await browser.close();

console.log('');
console.log(anyOverlap ? '✗ 1440-overlap-check: WYKRYTO nakładanie tekstu' : '✓ 1440-overlap-check: brak nakładania na żadnej z testowanych szerokości');
process.exit(anyOverlap ? 1 : 0);
