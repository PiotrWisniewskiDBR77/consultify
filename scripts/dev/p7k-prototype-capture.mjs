import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Zrzuty + POMIAR prototypu Wyników (P7K).
 *
 * Rozszerzenie 1c (werdykt `P7K_KROK1_WERDYKT_20260905.md`, sekcja „Pomiar 1c"):
 *  · `nakladania`      — literalna miara z werdyktu: pary sąsiednich komórek
 *                        w wierszu, gdzie `right_i > left_{i+1}`. Komórki
 *                        `position: sticky` są POMIJANE, bo przykrywanie
 *                        przewijanej treści to ICH ZADANIE (KPI L2), a nie defekt.
 *  · `wyciekiTekstu`   — miara, która realnie łapie K11/K12: prostokąt tekstu
 *                        wychodzący poza boks własnej komórki (to był defekt
 *                        „…z 42 do 28 min" na „Marek Zieliński"). Prostokąty `td`
 *                        w tabeli nigdy się nie nachodzą, więc sama miara
 *                        `nakladania` NIE wykryłaby K11/K12 — dlatego są obie.
 *  · `uciete`          — komórki z `scrollWidth > clientWidth` BEZ `title`
 *                        (dymek z pełną treścią); K13.
 *  · KPI L2 — dodatkowy zrzut `kpi-l2-start--*` przewinięty na STY 2026.
 */
const base = process.env.P7K_RENDER_URL || 'http://127.0.0.1:3027';
const output = path.resolve('evidence/p7k-wyniki/prototype');
const views = ['kpi-l1', 'kpi-l2', 'kpi-l3', 'okr-l1', 'okr-l2', 'okr-l3', 'roi-l1', 'roi-l2'];
const extraShots = [{ view: 'kpi-l2', name: 'kpi-l2-start', query: '&scroll=start' }];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();

const collectMetrics = () => {
  const EPS = 1;
  const isSticky = (el) => getComputedStyle(el).position === 'sticky';
  const visibleCells = (row) =>
    [...row.children].filter(
      (el) => (el.tagName === 'TD' || el.tagName === 'TH') && getComputedStyle(el).display !== 'none'
    );

  // ── nakladania (literalnie z werdyktu) ────────────────────────────────────
  const nakladaniaSzczegoly = [];
  document.querySelectorAll('tr').forEach((row) => {
    const cells = visibleCells(row);
    for (let i = 0; i < cells.length - 1; i += 1) {
      const a = cells[i];
      const b = cells[i + 1];
      if (isSticky(a) || isSticky(b)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (ra.right > rb.left + EPS)
        nakladaniaSzczegoly.push({
          lewa: (a.textContent || '').trim().slice(0, 40),
          prawa: (b.textContent || '').trim().slice(0, 40),
          zachodzi: Math.round(ra.right - rb.left),
        });
    }
  });

  // ── wyciekiTekstu: tekst poza boksem własnej komórki ──────────────────────
  //
  // UWAGA NA PRZYRZĄD: `Range.getClientRects()` zwraca GEOMETRIĘ tekstu i nie
  // wie nic o przycięciu. Tekst w `truncate` (overflow-hidden) ma prostokąt
  // wychodzący poza komórkę, choć na ekranie jest ucięty i NIC nie wylewa się
  // na sąsiada. Dlatego tekst z przodkiem, który go przycina, nie jest wyciekiem.
  const jestPrzyciety = (node, cell) => {
    let el = node.parentElement;
    while (el && el !== cell.parentElement) {
      const ov = getComputedStyle(el);
      if (ov.overflowX !== 'visible' || ov.overflow !== 'visible') return true;
      el = el.parentElement;
    }
    return false;
  };
  const wyciekiSzczegoly = [];
  [...document.querySelectorAll('th,td')].forEach((cell) => {
    if (getComputedStyle(cell).display === 'none') return;
    const rect = cell.getBoundingClientRect();
    if (rect.width === 0) return;
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = (node.textContent || '').trim();
      if (text && !jestPrzyciety(node, cell)) {
        const range = document.createRange();
        range.selectNodeContents(node);
        [...range.getClientRects()].forEach((r) => {
          if (r.width <= 0) return;
          const poza = Math.max(r.right - rect.right, rect.left - r.left);
          if (poza > EPS)
            wyciekiSzczegoly.push({ tekst: text.slice(0, 40), poza: Math.round(poza) });
        });
      }
      node = walker.nextNode();
    }
  });

  // ── uciete: przepełnienie poziome bez dymka `title` ───────────────────────
  //
  // UWAGA NA PRZYRZĄD (2): każdy `th` poza ostatnim ma absolutnie pozycjonowany
  // uchwyt zmiany szerokości (`ColumnResizeHandle`), który dokłada 6 px do
  // `scrollWidth` samego `th`. Bez wyłączenia elementów z dziećmi-elementami
  // pomiar meldował „ucięty nagłówek" na KAŻDEJ tabeli, także idealnie
  // zmieszczonej. Mierzymy więc wyłącznie elementy-liście (te, w których
  // faktycznie siedzi tekst).
  //
  // UWAGA NA PRZYRZĄD (3): `scrollWidth > clientWidth` NIE wykrywa ucięcia
  // zrobionego przez `text-overflow: ellipsis` — przeglądarka raportuje wtedy
  // szerokość już przyciętą. Zmierzone na KPI L2: nagłówek „BENCHMARK"
  // renderował się jako „BENCHMA…", a metryka meldowała 0. Dlatego liczymy
  // NATURALNĄ szerokość tekstu na canvasie (font + `letter-spacing` z
  // `getComputedStyle`) i porównujemy ją z `clientWidth`.
  const mierz = document.createElement('canvas').getContext('2d');
  const naturalnaSzerokosc = (el) => {
    const cs = getComputedStyle(el);
    mierz.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ls = parseFloat(cs.letterSpacing) || 0;
    const text = el.textContent || '';
    return mierz.measureText(text).width + ls * text.length;
  };
  const ucieteSzczegoly = [];
  const ucieteZDymkiemSzczegoly = [];
  [...document.querySelectorAll('th,td')].forEach((cell) => {
    if (getComputedStyle(cell).display === 'none') return;
    [cell, ...cell.querySelectorAll('*')].forEach((el) => {
      if (el.children.length > 0) return;
      if (!(el.textContent || '').trim()) return;
      if (el.clientWidth === 0) return;
      // Treść zawijana do 2 linii nie jest ucięciem — mierzymy tylko jedną linię.
      const wielolinijkowy =
        getComputedStyle(el).whiteSpace !== 'nowrap' && el.getClientRects().length > 1;
      const naturalna = naturalnaSzerokosc(el);
      const przepelnienie = Math.max(el.scrollWidth - el.clientWidth, naturalna - el.clientWidth);
      if (wielolinijkowy || przepelnienie <= EPS) return;
      let hasTitle = false;
      let cursor = el;
      while (cursor && cursor !== cell.parentElement) {
        if (cursor.getAttribute && cursor.getAttribute('title')) hasTitle = true;
        cursor = cursor.parentElement;
      }
      /* K13: daty, nazwiska i miesiace nie moga byc uciete NAWET z dymkiem —
         dlatego liczymy osobno wszystkie ucieta, takze te z `title`. */
      ucieteZDymkiemSzczegoly.push({
        tekst: (el.textContent || '').trim().slice(0, 40),
        naturalna: Math.round(naturalna),
        clientWidth: el.clientWidth,
        dymek: hasTitle,
      });
      if (!hasTitle)
        ucieteSzczegoly.push({
          tekst: (el.textContent || '').trim().slice(0, 40),
          naturalna: Math.round(naturalna),
          clientWidth: el.clientWidth,
          komorka: cell.tagName,
        });
    });
  });

  const truncatedHeaders = [...document.querySelectorAll('th')]
    .map((cell) => (cell.textContent || '').trim())
    .filter((text) => text.endsWith('…'));

  // Liczby łamane w połowie (kanon: liczba nigdy nie łamie się).
  const numericCellsWithWrap = [...document.querySelectorAll('th,td')]
    .filter((cell) => {
      const text = (cell.textContent || '').trim();
      if (!/\d/.test(text)) return false;
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (/\d/.test(node.textContent || '')) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const lines = new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map((rect) => Math.round(rect.top))
          );
          if (lines.size > 1) return true;
        }
        node = walker.nextNode();
      }
      return false;
    })
    .map((cell) => (cell.textContent || '').trim());

  // Szerokości nagłówka vs wiersza — „bez pustych kolumn" (K10).
  const headRow = document.querySelector('thead tr');
  const bodyRow = document.querySelector('tbody tr:not(.p7k-group-row)');
  const kolumnyRozjazd =
    headRow && bodyRow
      ? (() => {
          const h = visibleCells(headRow).map((c) => Math.round(c.getBoundingClientRect().width));
          const b = visibleCells(bodyRow).map((c) => Math.round(c.getBoundingClientRect().width));
          if (h.length !== b.length) return { rozne: true, naglowek: h.length, wiersz: b.length };
          const diff = h.filter((w, i) => Math.abs(w - b[i]) > EPS).length;
          return { rozne: false, kolumny: h.length, rozjechane: diff };
        })()
      : null;

  const przezroczysteSticky = [...document.querySelectorAll('th,td')].filter((cell) => {
    if (getComputedStyle(cell).position !== 'sticky') return false;
    const bg = getComputedStyle(cell).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return true;
    const parts = m[1].split(',').map((v) => parseFloat(v));
    return parts.length > 3 ? parts[3] < 1 : false;
  }).length;

  return {
    nakladania: nakladaniaSzczegoly.length,
    nakladaniaSzczegoly: nakladaniaSzczegoly.slice(0, 20),
    wyciekiTekstu: wyciekiSzczegoly.length,
    wyciekiSzczegoly: wyciekiSzczegoly.slice(0, 20),
    uciete: ucieteSzczegoly.length,
    ucieteSzczegoly: ucieteSzczegoly.slice(0, 20),
    ucieteLacznie: ucieteZDymkiemSzczegoly.length,
    ucieteLacznieSzczegoly: ucieteZDymkiemSzczegoly.slice(0, 20),
    przezroczysteSticky,
    kolumnyRozjazd,
    dom: {
      aside: { count: document.querySelectorAll('aside').length },
      table: { count: document.querySelectorAll('table').length },
      truncatedHeaders,
      numericCellsWithWrap,
    },
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyText: document.body.innerText,
  };
};

const shots = [
  ...views.map((view) => ({ view, name: view, query: '' })),
  ...extraShots,
];

for (const shot of shots) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    const consoleErrors = [];
    const networkErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR ${String(error)}`));
    page.on('response', (response) => {
      if (response.status() >= 400)
        networkErrors.push({
          status: response.status(),
          method: response.request().method(),
          url: response.url(),
        });
    });
    const url = `${base}/?screen=p7k-wyniki-prototype&view=${shot.view}&theme=${theme}&lang=pl&uwagi=0${shot.query}`;
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    await page.locator('[data-dev-render-chrome]').evaluateAll((elements) =>
      elements.forEach((element) => {
        element.style.display = 'none';
      })
    );
    const metrics = await page.evaluate(collectMetrics);
    const name = `${shot.name}--${theme}`;
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    await fs.writeFile(
      path.join(output, `${name}.json`),
      `${JSON.stringify({ view: shot.view, theme, url, httpStatus: response?.status() ?? null, bledyKonsoli: consoleErrors.length, consoleErrors, networkErrors, ...metrics }, null, 2)}\n`
    );
    await page.close();
  }
}

await browser.close();
