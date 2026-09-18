// H1c (Wpis 97, DEC-607, wiersz 53) — dowód wzrokowy: pill „Faza" w PRAWDZIWEJ
// karcie inicjatywy (<InitiativeDocumentView>) w statusie PROPOSED, EN, light+dark.
//
// DEFECT: przed naprawą gałąź `else` phaseDisplayLabel spadała na NAZWĘ MODUŁU
// (getModuleFromStatus(PROPOSED) → MODULE_CONFIG.TOOLS.label) → pill pokazywał
// „Tools" zamiast fazy. Po naprawie: t(phaseLabelKeyForStatus(PROPOSED)) →
// „Discovery" (klucz initiatives.phaseLabel.discovery).
//
// Uruchomienie:
//   npx vite --config dev-render/vite.config.ts --port 5437 --strictPort &
//   node evidence/qoder-h1c-20260917/shot.mjs 5437 evidence/qoder-h1c-20260917
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5437';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-h1c-20260917');
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_BAZA = `http://localhost:${PORT}/?screen=karta-initiative&status=PROPOSED&lang=en&uwagi=0`;

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
    await page.addInitScript(() => {
      try {
        localStorage.setItem('demo_story_rail_dismissed', 'true');
      } catch {
        /* best-effort */
      }
    });

    await page.goto(`${URL_BAZA}&theme=${theme}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Onboarding pierwszego logowania może przykryć kartę — zamknij jak powracający user.
    const skip = page.getByRole('button', { name: /Skip for now/i });
    if (await skip.count()) await skip.first().click();

    // Karta montuje się asynchronicznie (mock window.fetch w ekranie). Czekaj aż
    // pill fazy pokaże „Discovery" (EN) — to jest dokładnie mierzona wartość.
    await page
      .waitForFunction(() => (document.body.textContent || '').includes('Discovery'), {
        timeout: 30000,
      })
      .catch(() => braki.push(`${theme}: phase value "Discovery" not rendered`));

    // Odczyt na głos: znajdź pasek właściwości i wyciągnij parę etykieta→wartość
    // dla pillu „Phase" (oraz sąsiadów), żeby udowodnić, że to pole fazy, nie modułu.
    const odczyt = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.truncate'));
      const phaseSpan = spans.find((s) => (s.textContent || '').trim() === 'Discovery');
      // Pasek właściwości to tabela: <td>Phase</td> (etykieta) + <td>Discovery</td>
      // (wartość). W sklejonym textContent nie ma między nimi spacji, więc szukamy
      // węzła-etykiety o DOKŁADNYM tekście „Phase"/„Faza", nie regexa po body.
      const labelNode = Array.from(document.querySelectorAll('td, th, label, span, div')).find(
        (e) => e.children.length === 0 && /^(Phase|Faza)$/i.test((e.textContent || '').trim())
      );
      // Rząd fazy: etykieta i wartość w tym samym wierszu tabeli.
      const row = labelNode ? labelNode.closest('tr') : null;
      const rowText = row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return {
        phaseValue: phaseSpan ? (phaseSpan.textContent || '').trim() : null,
        hasPhaseLabel: Boolean(labelNode),
        phaseRowPairsLabelWithValue: /Phase\s*Discovery|Faza\s*Discovery/i.test(rowText),
        rowText: rowText.slice(0, 120),
        // Przed naprawą pill fazy dla PROPOSED pokazywał „Tools" (nazwa modułu).
        phasePillSaysTools: Boolean(phaseSpan && /tools/i.test(phaseSpan.textContent || '')),
        anyToolsPill: spans
          .map((s) => (s.textContent || '').trim())
          .filter((t) => /^Tools$/i.test(t)),
      };
    });

    if (odczyt.phaseValue !== 'Discovery')
      braki.push(`${theme}: pill fazy = ${JSON.stringify(odczyt.phaseValue)}, oczekiwano "Discovery"`);
    if (!odczyt.hasPhaseLabel) braki.push(`${theme}: brak etykiety pola "Phase"/"Faza"`);
    if (!odczyt.phaseRowPairsLabelWithValue)
      braki.push(`${theme}: wiersz fazy nie paruje etykiety z "Discovery" (${odczyt.rowText})`);
    if (odczyt.phasePillSaysTools) braki.push(`${theme}: REGRESJA — pill fazy wciąż mówi "Tools"`);

    raport.push(
      `${theme} | phaseValue=${JSON.stringify(odczyt.phaseValue)} | hasPhaseLabel=${odczyt.hasPhaseLabel} | rowPairs=${odczyt.phaseRowPairsLabelWithValue} | phasePillSaysTools=${odczyt.phasePillSaysTools} | toolsPills=${odczyt.anyToolsPill.length} | row="${odczyt.rowText}"`
    );

    await page.screenshot({ path: path.join(OUT_DIR, `h1c-phase-proposed-${theme}.png`), fullPage: false });
    await page.close();
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  raport.push(`braki=${braki.length}`);
  raport.push(`zadania404=${sieci404.length}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  if (braki.length) raport.push(...braki.map((b) => `  BRAK ${b}`));
  if (sieci404.length) raport.push(...sieci404.slice(0, 20).map((u) => `  404 ${u}`));
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
