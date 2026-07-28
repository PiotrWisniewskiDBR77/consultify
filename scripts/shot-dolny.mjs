/**
 * Odbiór dolnego paska Idei — 8 scenariuszy × 4 narzędzia × 2 motywy.
 * node scripts/shot-dolny.mjs <katalog> [ff]   ff = '' | '0' | '1'
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || '/private/tmp/u-dolny-shots/base';
const FF = process.argv[3] ?? '';
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  ['mapa', 'mindmap-canvas'],
  ['tablica', 'whiteboard-canvas'],
  ['przeplyw', 'processflow-canvas'],
  ['tabela', 'idea-table-timeline-stuck'],
];
const CORNER = { x: 820, y: 470, width: 660, height: 370 };

/** Pigułki harnessu („← Lista" / „Uwagi", dev-render/PanelUwag.tsx) zasłaniają
 *  róg. To leki testowe, nie produkt — chowamy je przed pomiarem i zrzutem. */
const SCHOWAJ_HARNESS = () => {
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' && Number(cs.zIndex) > 2000000000) {
      el.style.display = 'none';
      el.setAttribute('data-harness-hidden', '1');
    }
  }
};

const inwentarz = () =>
  new Function(
    `
  const vw=innerWidth, vh=innerHeight, out=[];
  for (const el of document.querySelectorAll('button,[data-testid]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.right < vw-520 || r.bottom < vh-170) continue;
    if (el.getAttribute('data-testid') && el.getAttribute('data-testid').startsWith('mels-')) continue;
    out.push({ id: el.getAttribute('data-testid')||'', t: el.getAttribute('title')||el.getAttribute('aria-label')||'', x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  }
  out.sort((a,b)=>a.x-b.x);
  const pig = [...document.querySelectorAll('div')].filter(d=>/^\\d{1,3}%$/.test((d.textContent||'').trim()) && d.children.length===0).map(d=>d.textContent.trim());
  const vp = document.querySelector('.react-flow__viewport');
  let real=null; if (vp){const m=/matrix\\(([-\\d.]+)/.exec(getComputedStyle(vp).transform); if(m) real=Math.round(parseFloat(m[1])*100);}
  const mini = document.querySelector('.react-flow__minimap');
  let minimapa=null; if(mini){const r=mini.getBoundingClientRect(); minimapa={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),z:getComputedStyle(mini).zIndex};}
  return { out, pig, real, minimapa };
`
  );

const browser = await chromium.launch();
const raport = {};

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    viewport: { width: 1480, height: 840 },
    colorScheme: theme,
    deviceScaleFactor: 2,
  });
  for (const [name, screen] of SCREENS) {
    const klucz = `${name}-${theme}`;
    const r = (raport[klucz] = { errs: [] });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && r.errs.push(m.text().slice(0, 160)));
    page.on('pageerror', (e) => r.errs.push('PAGEERROR ' + String(e).slice(0, 240)));
    let url = `http://localhost:3332/?screen=${screen}&theme=${theme}`;
    if (FF !== '') url += `&ff_ideaBottomBarUnified=${FF}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(4800);
    // Zimny start vite potrafi nie zdazyc z ciezkim modulem — czekamy na pasek.
    await page
      .locator('[data-testid="idea-view-switcher"]')
      .first()
      .waitFor({ state: 'attached', timeout: 25000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(SCHOWAJ_HARNESS);
    await page.waitForTimeout(200);

    // S1+S2: układ i zestaw ikon
    r.start = await page.evaluate(inwentarz());
    await page.screenshot({ path: `${OUT}/${klucz}-1-start.png`, clip: CORNER });

    const klik = async (tytul) => {
      const b = page.locator(`button[title="${tytul}"]`).first();
      if ((await b.count()) === 0) return false;
      await b.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      return true;
    };

    // S3a: „−" i „+" realnie zmieniaja zoom, procent nadaza
    if (await klik('Oddal')) {
      r.poOddal = await page.evaluate(inwentarz());
      await klik('Przybliż');
      await klik('Przybliż');
      r.poPrzybliz = await page.evaluate(inwentarz());
      await page.screenshot({ path: `${OUT}/${klucz}-2-zoom.png`, clip: CORNER });
    }

    // S3b: procent przy zoomie KÓŁKIEM (ctrl+wheel = pewny zoom w react-flow)
    const pane = page.locator('.react-flow__pane').first();
    if ((await pane.count()) > 0) {
      await page.mouse.move(640, 460);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -160);
        await page.keyboard.up('Control');
        await page.waitForTimeout(90);
      }
      await page.waitForTimeout(700);
      r.poKolku = await page.evaluate(inwentarz());
      await page.screenshot({ path: `${OUT}/${klucz}-3-kolko.png`, clip: CORNER });
    }

    // S5: mini-mapa wlacz => nie chowa sie pod paskiem
    if (await klik('Pokaż mini mapę')) {
      r.miniOn = await page.evaluate(inwentarz());
      await page.screenshot({ path: `${OUT}/${klucz}-4-minimapa.png`, clip: CORNER });
      await klik('Ukryj mini mapę');
      r.miniOff = await page.evaluate(inwentarz());
    }

    // S4: pelny ekran (element requestFullscreen w headless bywa odrzucany —
    // sprawdzamy, czy handler w ogole odpala, po zmianie tytulu przycisku)
    r.pelnyEkran = await page.evaluate(async () => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('title') === 'Pełny ekran'
      );
      if (!b) return 'brak przycisku';
      let wywolane = false;
      const org = Element.prototype.requestFullscreen;
      Element.prototype.requestFullscreen = function () {
        wywolane = true;
        return Promise.resolve();
      };
      b.click();
      await new Promise((res) => setTimeout(res, 400));
      Element.prototype.requestFullscreen = org;
      return wywolane ? 'requestFullscreen wywolany' : 'handler nie ruszyl';
    });

    // S6: przelacznik realnie przelacza (Mapa -> Tablica)
    const cel = name === 'tablica' ? 'mindmap' : 'whiteboard';
    const btn = page.locator(`[data-testid="idea-view-switcher-${cel}"]`).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2600);
      await page.evaluate(SCHOWAJ_HARNESS);
      r.poPrzelaczeniu = await page.evaluate(() => {
        const akt = document.querySelector('[data-testid^="idea-view-switcher-"][aria-pressed="true"]');
        return akt ? akt.getAttribute('data-testid') : 'brak';
      });
      await page.screenshot({ path: `${OUT}/${klucz}-5-przelaczone.png`, clip: CORNER });
    } else {
      r.poPrzelaczeniu = 'brak przelacznika';
    }

    r.errs = r.errs.slice(0, 6);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/raport.json`, JSON.stringify(raport, null, 2));
console.log('OK ->', OUT);
