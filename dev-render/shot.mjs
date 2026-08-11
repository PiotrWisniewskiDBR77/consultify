/* eslint-disable */
/**
 * Zrzutownik dla harnessu dev-render (port 3350) — Playwright bez MCP
 * (przeglądarkowe zakładki MCP są zajęte przez równoległe sesje).
 *
 * node dev-render/shot.mjs <plik.png> <url> [opcje]
 *   --w=1440 --h=900        rozmiar okna
 *   --click=<selektor>      klik po załadowaniu (może być wielokrotnie)
 *   --clickxy=x,y           klik we współrzędne
 *   --hover=<selektor>      prawdziwy page.hover (aktywuje CSS :hover, w
 *                           odróżnieniu od dispatchEvent w --eval)
 *   --wait=2000             dodatkowa pauza po akcjach
 *   --clip=0,0,1440,220     wycinek zrzutu
 *   --eval=<js>             wykonaj JS w stronie po akcjach
 *   --dump=<selektor>       wypisz outerHTML (skrót) do stdout
 *   --key=<klawisz>         page.keyboard.press (Tab/Shift+Tab/Enter/Space/Escape...)
 *
 * Zawsze na stdout: KONSOLA-BLEDY (wszystkie, nie ucięte do 8) i SIEC-4XX5XX
 * (każda odpowiedź >=400 z hosta localhost, do re-weryfikacji interaktywnej
 * FALA 0 RN-G3 — pełna lista błędów konsoli/sieci per krok).
 */
import { chromium } from 'playwright';

(async () => {
  const [out, url, ...rest] = process.argv.slice(2);
  const opt = (name, def) => {
    const hit = rest.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : def;
  };
  const all = (name) =>
    rest.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));

  const width = parseInt(opt('w', '1440'), 10);
  const height = parseInt(opt('h', '900'), 10);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  const netErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
  page.on('response', (res) => {
    const st = res.status();
    if (st >= 400) {
      netErrors.push(`${st} ${res.request().method()} ${res.url()}`);
    }
  });

  // Bez sieci zewnętrznej: fonty z CDN nigdy się nie ładują, a `page.screenshot`
  // czeka na `document.fonts.ready` → timeout. Ucinamy je od razu.
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(parseInt(opt('settle', '3500'), 10));

  for (const sel of all('click')) {
    try {
      await page.locator(sel).first().click({ timeout: 8000 });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log(`KLIK-BLAD ${sel}: ${String(e).split('\n')[0]}`);
    }
  }
  for (const xy of all('clickxy')) {
    const [x, y] = xy.split(',').map(Number);
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
  }
  for (const sel of all('hover')) {
    try {
      await page.locator(sel).first().hover({ timeout: 8000 });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log(`HOVER-BLAD ${sel}: ${String(e).split('\n')[0]}`);
    }
  }
  // Klik „na siłę" — pasek edycji siedzi w rzędzie, który react-flow potrafi
  // przerysowywać, więc Playwright bywa, że nigdy nie uzna elementu za
  // stabilny. Celujemy w środek prostokąta myszą, z pominięciem actionability.
  for (const sel of all('hit')) {
    try {
      const box = await page.locator(sel).first().boundingBox({ timeout: 8000 });
      if (!box) throw new Error('brak boundingBox');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
    } catch (e) {
      console.log(`HIT-BLAD ${sel}: ${String(e).split('\n')[0]}`);
    }
  }
  // Klik MYSZĄ w środek elementu, ale prostokąt liczony w stronie (bez
  // actionability Playwrighta). Do węzłów płótna: react-flow słucha
  // `mousedown`, więc syntetyczny `el.click()` ich nie zaznaczy.
  for (const sel of all('hitjs')) {
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, sel);
    if (!r) {
      console.log(`HITJS-BLAD ${sel}: brak elementu`);
      continue;
    }
    await page.mouse.click(r.x, r.y);
    await page.waitForTimeout(600);
  }
  // Klik przez DOM (`el.click()`), gdy Playwright nie chce uznać elementu za
  // stabilny — react-flow przerysowuje płótno w pętli.
  for (const sel of all('jsclick')) {
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return 'BRAK ELEMENTU';
      el.click();
      return 'ok';
    }, sel);
    if (r !== 'ok') console.log(`JSCLICK-BLAD ${sel}: ${r}`);
    await page.waitForTimeout(500);
  }
  for (const k of all('key')) {
    await page.keyboard.press(k);
    await page.waitForTimeout(500);
  }
  const ev = opt('eval', null);
  if (ev) {
    try {
      const r = await page.evaluate(ev);
      console.log('EVAL:', JSON.stringify(r));
    } catch (e) {
      console.log('EVAL-BLAD:', String(e).split('\n')[0]);
    }
  }
  await page.waitForTimeout(parseInt(opt('wait', '600'), 10));

  for (const sel of all('dump')) {
    const html = await page
      .locator(sel)
      .first()
      .evaluate((el) => el.outerHTML)
      .catch((e) => 'BRAK: ' + String(e).split('\n')[0]);
    console.log(`DUMP ${sel}:\n${html.slice(0, 4000)}\n`);
  }

  const clip = opt('clip', null);
  const shotOpts = { path: out };
  if (clip) {
    const [x, y, w, h] = clip.split(',').map(Number);
    shotOpts.clip = { x, y, width: w, height: h };
  }
  await page.screenshot(shotOpts);
  if (errors.length) console.log('KONSOLA-BLEDY:\n' + errors.join('\n'));
  if (netErrors.length) console.log('SIEC-4XX5XX:\n' + netErrors.join('\n'));
  console.log('OK ->', out);
  await browser.close();
})();
