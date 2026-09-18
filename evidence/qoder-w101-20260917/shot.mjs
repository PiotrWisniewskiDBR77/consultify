// W101 (DEC-612 P2 pkt 3) — skrzynka „For approval" w REALNEJ powłoce:
// harness `w101-dec612-skrzynka-powloka` montuje produkcyjny <InitiativesHub>
// (jedyny wołacz `TransitionInboxSurface` w `src/`: `InitiativesHub.tsx:2106`),
// nie goły surface w `MemoryRouter` jak `w51-dec612-skrzynka` (zrzut odrzucony).
// Dane wiersza = pomiar z bazy `consultify_kopia_d3` (1 propozycja pending).
// Motyw przez store aplikacji (`dev-render/main.tsx`), NIE emulateMedia.
//
// Uruchomienie:
//   VITE_INITIATIVES_WORKLOAD=true VITE_INITIATIVES_FOUR_BUTTONS=true \
//   VITE_TRANSITION_INBOX=true \
//     npx vite --config dev-render/vite.config.ts --port 5431 --strictPort &
//   node evidence/qoder-w101-20260917/shot.mjs 5431 evidence/qoder-w101-20260917
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5431';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-w101-20260917');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EKRAN = {
  nazwa: 'inbox-powloka',
  url: `http://localhost:${PORT}/?screen=w101-dec612-skrzynka-powloka&tab=transitionInbox&lang=en&uwagi=0`,
};

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
    // Pasek „Start the tour" (StoryRail) przykrywa canvas; produkt pamięta
    // zamknięcie w localStorage (`storyRailStops.ts:71`).
    await page.addInitScript(() => {
      try {
        localStorage.setItem('demo_story_rail_dismissed', 'true');
      } catch {
        /* best-effort */
      }
    });
    // Harness nie ma backendu — niespełnione GET-y /api/* oddają 200, żeby
    // licznik mierzył PRAWDZIWE błędy ekranu (wzór z przyjętych dowodów M6/RB-1/W51).
    await page.route(
      (url) => new URL(url).pathname.startsWith('/api/'),
      (route) => {
        const req = route.request();
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
              organization: {
                id: 'org-northwind',
                name: 'Northwind Manufacturing Ltd.',
                plan: 'enterprise',
              },
              organizations: [{ id: 'org-northwind', name: 'Northwind Manufacturing Ltd.' }],
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

    await page.goto(`${EKRAN.url}&theme=${theme}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Onboarding pierwszego logowania przykrywa i rozmywa powłokę.
    const skip = page.getByRole('button', { name: /Skip for now/i });
    if (await skip.count()) await skip.first().click();

    await page
      .waitForFunction(() => (document.body.textContent || '').includes('MES Rollout Line 3'), {
        timeout: 30000,
      })
      .catch(() => braki.push(`${theme}: brak wiersza propozycji (skrzynka pusta?)`));

    // „Governance area" (Closure) nie jest kolumną tabeli, tylko polem
    // StandardPreview (`TransitionInboxSurface.tsx:253`) — trzeba otworzyć
    // podgląd kliknięciem w wiersz.
    await page
      .locator('tbody tr', { hasText: 'MES Rollout Line 3' })
      .first()
      .click({ timeout: 15000 })
      .catch(() => braki.push(`${theme}: nie dało się otworzyć podglądu propozycji`));
    await page
      .waitForFunction(() => (document.body.textContent || '').includes('Governance area'), {
        timeout: 20000,
      })
      .catch(() => braki.push(`${theme}: podgląd bez pola „Governance area"`));

    const odczyt = await page.evaluate(() => {
      const tekst = (document.body.textContent || '').replace(/\s+/g, ' ');
      // Podgląd (StandardPreview) renderuje pola jako tabelę `Property | Value`
      // Z `thead` — więc sam `thead` nie rozróżnia. Tabelę skrzynki poznajemy po
      // nagłówkach kolumn (`TransitionInboxSurface.tsx:288-300`).
      const naglowki = (t) =>
        Array.from(t.querySelectorAll('thead th'))
          .map((th) => (th.textContent || '').trim())
          .join('|');
      const tabeleDanych = Array.from(document.querySelectorAll('table')).filter((t) => {
        const h = naglowki(t);
        return h.includes('Initiative') && h.includes('Transition') && h.includes('Status');
      });
      const wierszePropozycji = tabeleDanych
        .flatMap((t) => Array.from(t.querySelectorAll('tbody tr')))
        .filter((tr) =>
          (tr.textContent || '').replace(/\s+/g, ' ').includes('MES Rollout Line 3')
        );
      const wiersz = wierszePropozycji[0];
      return {
        // POWŁOKA: zakładka Menu 1 musi być widoczna razem z sąsiadami, inaczej
        // to znowu goły surface (defekt, za który CTO cofnął zrzuty W51).
        zakladkaForApproval: tekst.includes('For approval'),
        zakladkiMenu1: ['Initiatives', 'Plan', 'For approval'].filter((z) => tekst.includes(z)),
        modulInicjatywy: !!document.querySelector(
          '[data-testid="initiatives-hub"], [class*="StandardModuleBar"]'
        ),
        wierszyPropozycji: wierszePropozycji.length,
        tabelDanych: tabeleDanych.length,
        polPodgladu: Array.from(document.querySelectorAll('table'))
          .filter((t) => naglowki(t) === 'Property|Value')
          .reduce((n, t) => n + t.querySelectorAll('tbody tr').length, 0),
        inicjatywa: tekst.includes('MES Rollout Line 3'),
        autor: tekst.includes('Laura Novak'),
        przejscie: /Executing/i.test(tekst) && /Done/i.test(tekst),
        // Podgląd (StandardPreview): obszar nadzoru PMO z seeda = CLOSURE.
        domena: /Governance area/.test(tekst) && /Closure/.test(tekst),
        uzasadnienie: tekst.includes('passed its last quality gate'),
        akcje: ['Approve', 'Reject with a reason'].filter((a) => tekst.includes(a)),
        tekstWiersza: wiersz ? (wiersz.textContent || '').replace(/\s+/g, ' ').slice(0, 220) : null,
      };
    });

    if (odczyt.wierszyPropozycji !== 1)
      braki.push(`${theme}: wierszy propozycji=${odczyt.wierszyPropozycji} (oczekiwane 1)`);
    if (!odczyt.zakladkaForApproval) braki.push(`${theme}: brak zakładki „For approval" (powłoka?)`);
    if (odczyt.zakladkiMenu1.length < 3)
      braki.push(`${theme}: zakładki Menu 1 ${odczyt.zakladkiMenu1.length}/3`);
    if (!odczyt.inicjatywa || !odczyt.autor || !odczyt.przejscie || !odczyt.domena)
      braki.push(`${theme}: wiersz/podgląd niepełny ${JSON.stringify(odczyt)}`);
    if (odczyt.akcje.length < 2) braki.push(`${theme}: akcje recenzenta ${odczyt.akcje.length}/2`);
    if (odczyt.polPodgladu < 5) braki.push(`${theme}: pola podglądu ${odczyt.polPodgladu}/5`);

    raport.push(`${EKRAN.nazwa}/${theme} | ${JSON.stringify(odczyt)}`);
    await page.screenshot({
      path: path.join(OUT_DIR, `${EKRAN.nazwa}-${theme}.png`),
      fullPage: false,
    });
    await page.close();
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  raport.push(`braki=${braki.length}`);
  raport.push(`zadania404=${sieci404.length}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  if (braki.length) raport.push(...braki.map((b) => `  BRAK ${b}`));
  if (sieci404.length) raport.push(...sieci404.map((u) => `  404 ${u}`));
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'shot-wynik.json'),
    JSON.stringify(
      { bledyKonsoli, braki: braki.length, zadania404: sieci404.length, raport, braki, sieci404 },
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
