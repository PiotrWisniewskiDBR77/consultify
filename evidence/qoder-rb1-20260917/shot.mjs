// RB-1 v2 (Wpis 79, P2#1) — dowód wzrokowy: karta „Voice & Detail" w PRAWDZIWYM
// Report Builderze w PRAWDZIWEJ powłoce aplikacji (`MainLayout` → Menu 1
// `<aside>`, breadcrumbs `<nav>`, kebab/FAB rail, canvas bloków, prawy pas),
// a nie sam `<SettingsPanel>` na pustym tle jak we Wpisie 76.
//
// Uruchomienie:
//   npx vite --config dev-render/vite.config.ts --port 5430 --strictPort &
//   node evidence/qoder-rb1-20260917/shot.mjs 5430 evidence/qoder-rb1-20260917
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5430';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-rb1-20260917');
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_BAZA = `http://localhost:${PORT}/?screen=report-builder-voice-detail&lang=en&uwagi=0`;

async function run() {
  const browser = await chromium.launch();
  const raport = [];
  const bledy = [];
  const braki = [];
  const sieci404 = [];

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => {
      if (m.type() === 'error') bledy.push(`${theme}: ${m.text()}`);
    });
    page.on('pageerror', (e) => bledy.push(`${theme} pageerror: ${e.message}`));
    page.on('response', (r) => {
      if (r.status() === 404) sieci404.push(`${theme} ${r.request().method()} ${r.url()}`);
    });
    // Pasek „Start the tour" (StoryRail) przykrywa canvas pierwszego bloku;
    // produkt zapamiętuje zamknięcie w localStorage (`storyRailStops.ts:71`).
    await page.addInitScript(() => {
      try {
        localStorage.setItem('demo_story_rail_dismissed', 'true');
      } catch {
        /* best-effort */
      }
    });

    // Harness dev-render nie ma backendu (wtyczka apiNoBackendPlugin uczciwie
    // oddaje 404 na /api/*) — zmierzone: 4170 błędów konsoli i 4166 żądań w 9 s,
    // czyli sam brak backendu, nie defekt ekranu. Ten sam wzór co w przyjętym
    // dowodzie M6 (`evidence/qoder-m6-higiena-20260917/shot-1280.mjs:31`):
    // niespełnione GET-y /api/* oddają 200, żeby licznik mierzył PRAWDZIWE
    // błędy ekranu. Predykat po pathname — glob `**/api/**` łapie też URL-e
    // modułów vite (ścieżka zależności może zawierać segment `/api/`).
    await page.route(
      (url) => new URL(url).pathname.startsWith('/api/'),
      (route) => {
        const req = route.request();
        // Zapisy (np. PUT /api/preferences przy zmianie motywu) też nie mają
        // backendu w harnessie — bez stuba vite oddaje 404 i psuje licznik.
        if (req.method() !== 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        }
        const sciezka = new URL(req.url()).pathname;
        const cialo = sciezka.startsWith('/api/organizations')
          ? {
              organization: { id: 'org-northwind', name: 'Northwind Packaging', plan: 'enterprise' },
              organizations: [{ id: 'org-northwind', name: 'Northwind Packaging' }],
            }
          : sciezka.startsWith('/api/preferences')
            ? { preferences: { language: 'en', theme } }
            : sciezka.startsWith('/api/demo/status')
              ? { isActive: false }
              : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(cialo),
        });
      }
    );

    await page.goto(`${URL_BAZA}&theme=${theme}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('nav', { timeout: 30000 });

    // Harness klika nagłówek karty po ~120 ms; poczekaj aż kontrolki będą widoczne.
    await page.waitForSelector('main', { timeout: 30000 });

    // Onboarding pierwszego logowania („Meet Teresa") przykrywa i rozmywa całą
    // powłokę (zmierzone na zrzucie) — zamknij go jak powracający użytkownik.
    const skip = page.getByRole('button', { name: /Skip for now/i });
    if (await skip.count()) await skip.first().click();
    await page
      .waitForFunction(
        () => {
          const labels = Array.from(document.querySelectorAll('label')).map((l) =>
            (l.textContent || '').trim()
          );
          return (
            labels.includes('Verbosity') &&
            labels.includes('Writing style') &&
            labels.includes('Examples') &&
            labels.includes('Custom tone (optional)')
          );
        },
        { timeout: 20000 }
      )
      .catch(() => braki.push(`${theme}: controls not revealed`));

    // Tytuły bloków i raportu są wartościami <input> — nie ma ich w
    // body.textContent, więc czekamy na value ostatniego bloku.
    await page
      .waitForFunction(() =>
        Array.from(document.querySelectorAll('input')).some((i) => i.value === 'Investment case')
      , { timeout: 15000 })
      .catch(() => braki.push(`${theme}: canvas blocks not mounted`));

    // Wpis 88: blok cover ma ogrodzony JSON — podgląd musi go sparsować
    // (subtitle „Board decision pack" w DOM), a nie zrzucić surowe pola.
    await page
      .waitForFunction(() => (document.body.textContent || '').includes('Board decision pack'), {
        timeout: 15000,
      })
      .catch(() => braki.push(`${theme}: cover subtitle not rendered`));

    // Odczyt na głos: powłoka (Menu 1 / breadcrumbs / kebab / canvas) + kontrolki.
    const odczyt = await page.evaluate(() => {
      // Tytuły bloków i raportu siedzą w `value` elementów <input> —
      // textContent ich nie zawiera, więc dokładam wartości kontrolek.
      const tekst =
        (document.body.textContent || '') +
        ' ' +
        Array.from(document.querySelectorAll('input, textarea'))
          .map((i) => i.value || '')
          .join(' ');
      const aside = document.querySelectorAll('aside');
      const nav = Array.from(document.querySelectorAll('nav'))
        .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
        .join(' | ');
      const fab = document.querySelector('[data-testid="global-fab-rail"]');
      const card = Array.from(document.querySelectorAll('h3')).find((h) =>
        /Voice & Detail/i.test(h.textContent || '')
      )?.closest('div');
      const root = card?.parentElement || document;
      const picks = Array.from(root.querySelectorAll('select')).map((s) => ({
        label: s.closest('div')?.querySelector('label')?.textContent?.trim() || '?',
        value: s.value,
        options: Array.from(s.options).map((o) => o.textContent?.trim()),
      }));
      const tone = root.querySelector('input[type="text"]');
      return {
        powloka: {
          asides: aside.length,
          asidePierwszyWidoczny: Boolean(aside[0]?.offsetParent),
          breadcrumbs: nav.slice(0, 120),
          kebabFab: Boolean(fab),
          blokiNaCanvasie: ['Executive summary', '90-day roadmap', 'Investment case'].filter((t) =>
            new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(tekst)
          ),
          tytulRaportu: tekst.includes('Northwind Packaging — Digital Readiness Diagnosis'),
        },
        coverPodglad: {
          subtitle: tekst.includes('Board decision pack'),
          firma: tekst.includes('Northwind Packaging'),
          data: tekst.includes('8 September 2026'),
          typ: tekst.includes('DRD'),
          // Przed naprawą (Wpis 88) markdown wyrzucał surowe pola JSON —
          // ich obecność w tekście strony = regresja.
          surowyJson: ['"title":', '"companyName":'].filter((m) => tekst.includes(m)),
        },
        selects: picks,
        customTone: tone ? { value: tone.value, placeholder: tone.placeholder } : null,
      };
    });

    if (odczyt.powloka.asides < 1) braki.push(`${theme}: brak <aside> (Menu 1)`);
    if (!odczyt.powloka.kebabFab) braki.push(`${theme}: brak kebaba/FAB rail`);
    if (!odczyt.powloka.breadcrumbs?.includes('Report Builder'))
      braki.push(`${theme}: breadcrumbs bez „Report Builder" (${odczyt.powloka.breadcrumbs})`);
    if (odczyt.powloka.blokiNaCanvasie.length < 3)
      braki.push(
        `${theme}: canvas pokazuje ${odczyt.powloka.blokiNaCanvasie.length}/3 bloków raportu`
      );
    if (!odczyt.powloka.tytulRaportu) braki.push(`${theme}: brak tytułu raportu w powłoce`);
    if (!odczyt.coverPodglad.subtitle)
      braki.push(`${theme}: cover bez sparsowanego subtitle (podgląd nie renderuje pól)`);
    if (odczyt.coverPodglad.surowyJson.length > 0)
      braki.push(
        `${theme}: cover zrzuca surowy JSON na kartę: ${odczyt.coverPodglad.surowyJson.join(', ')}`
      );

    raport.push(
      `${theme} | powloka=${JSON.stringify(odczyt.powloka)} | cover=${JSON.stringify(
        odczyt.coverPodglad
      )} | selects=${JSON.stringify(odczyt.selects)} | customTone=${JSON.stringify(
        odczyt.customTone
      )}`
    );

    await page.screenshot({ path: path.join(OUT_DIR, `voice-detail-${theme}.png`), fullPage: false });
    await page.close();
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  raport.push(`brakiPowloki=${braki.length}`);
  raport.push(`zadania404=${sieci404.length}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  if (braki.length) raport.push(...braki.map((b) => `  BRAK ${b}`));
  if (sieci404.length) raport.push(...sieci404.map((u) => `  404 ${u}`));
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'shot-wynik.json'),
    JSON.stringify(
      { bledyKonsoli, brakiPowloki: braki.length, zadania404: sieci404.length, raport, braki, sieci404 },
      null,
      2
    )
  );
  console.log(raport.join('\n'));
  console.log('Zrzuty:', OUT_DIR);
  if (bledyKonsoli > 0 || braki.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
