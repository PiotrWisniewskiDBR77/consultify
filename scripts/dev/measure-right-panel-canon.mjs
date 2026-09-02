/* eslint-disable */
/**
 * Pomiar kanonu PRAWEGO PASA artefaktu — mechaniczny, nie „na oko".
 *
 * ── PO CO ──────────────────────────────────────────────────────────────────
 * Właściciel zgłosił rozjazd prawego pasa DWA RAZY (01.09 — rodzina R2 na
 * sześciu ekranach; 02.09 — cztery pozycje w KORPUS_UWAG_20260902.md), a jego
 * warunek odbioru brzmi porównawczo: „Prawy pas Notatnika i prawy pas Idei
 * mają te same sekcje w tej samej kolejności" i „identycznie jak
 * w ideas-teresa-panel".
 *
 * Zdanie „te same sekcje w tej samej kolejności" jest sprawdzalne LICZBĄ,
 * nie wrażeniem. Skrypt czyta `[data-artifact-section]` z żywego DOM-u
 * i porównuje:
 *   • zgodność z `ARTIFACT_PANEL_SECTION_ORDER`
 *     (actions · properties · relations · evidence · results · comments · history),
 *   • RÓWNOŚĆ zestawów między ekranami tej samej rodziny.
 *
 * Sekcja NIEOBECNA nie jest błędem sama w sobie — błędem jest inna KOLEJNOŚĆ
 * i różnica między ekranami, które mają być takie same.
 *
 * Użycie (harness dev-render musi już działać):
 *   node scripts/dev/measure-right-panel-canon.mjs --port=3350
 */
import { chromium } from 'playwright';

const arg = (n, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};

const PORT = arg('port', '3350');
const W = parseInt(arg('w', '1600'), 10);
const H = parseInt(arg('h', '1000'), 10);

/** `ARTIFACT_PANEL_SECTION_ORDER` z src/components/standard/ArtifactRightPanel.tsx */
const CANON_ORDER = [
  'actions',
  'properties',
  'relations',
  'evidence',
  'results',
  'comments',
  'history',
];

/**
 * Ekrany rodziny „prawy panel" z rejestru (poz. 31-34) + wzorce porównawcze.
 * `rodzina` grupuje ekrany, które wg warunku odbioru mają mieć TE SAME sekcje.
 */
const SCREENS = [
  { id: 'ideas-teresa-panel', rodzina: 'idea' },
  { id: 'idea-table-timeline-stuck', rodzina: 'idea' },
  { id: 'mywork-notebook-rail-speca', rodzina: 'idea' },
  { id: 'prawy-panel-szyna-ikon', rodzina: 'szyna' },
  { id: 'karta-tool', rodzina: 'odniesienie' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')
      ? r.continue()
      : r.abort();
  });

  const wyniki = [];
  console.log(`# Pomiar kanonu prawego pasa — viewport ${W}px\n`);
  console.log(`Kanon kolejności: ${CANON_ORDER.join(' → ')}\n`);

  for (const s of SCREENS) {
    await page
      .goto(`http://localhost:${PORT}/?screen=${s.id}&lang=pl&theme=light&uwagi=0`, {
        waitUntil: 'networkidle',
      })
      .catch(() => {});
    await page.waitForTimeout(2200);

    const sekcje = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-artifact-section]')).map((e) =>
        e.getAttribute('data-artifact-section')
      )
    );

    const kolejnoscOK = (() => {
      if (!sekcje.length) return 'BRAK PANELU';
      const idx = sekcje.map((x) => CANON_ORDER.indexOf(x));
      if (idx.some((x) => x < 0)) return 'NIEZNANA SEKCJA';
      return idx.every((x, k) => k === 0 || x > idx[k - 1]) ? 'OK' : 'ZLA KOLEJNOSC';
    })();

    wyniki.push({ ...s, sekcje, kolejnoscOK });
    console.log(`## ${s.id} (rodzina: ${s.rodzina})`);
    console.log(`   sekcje: ${sekcje.join(' → ') || '(brak)'}`);
    console.log(`   kolejność wg kanonu: ${kolejnoscOK}\n`);
  }

  // Porównanie wewnątrz rodziny — warunek odbioru „te same sekcje".
  const rodziny = [...new Set(wyniki.map((w) => w.rodzina))];
  let rozjazdy = 0;
  for (const r of rodziny) {
    const grupa = wyniki.filter((w) => w.rodzina === r && w.sekcje.length);
    if (grupa.length < 2) continue;
    const wzorzec = grupa[0].sekcje.join(',');
    const rozne = grupa.filter((g) => g.sekcje.join(',') !== wzorzec);
    if (rozne.length) {
      rozjazdy += rozne.length;
      console.log(`### RODZINA "${r}" — ROZJAZD`);
      console.log(`   wzorzec (${grupa[0].id}): ${wzorzec.split(',').join(' → ')}`);
      rozne.forEach((g) => console.log(`   różni się: ${g.id}: ${g.sekcje.join(' → ')}`));
      console.log('');
    } else {
      console.log(`### RODZINA "${r}" — ${grupa.length} ekranów ma IDENTYCZNY zestaw sekcji.\n`);
    }
  }

  await browser.close();
  const zle = wyniki.filter((w) => w.kolejnoscOK !== 'OK').length;
  console.log(
    zle === 0 && rozjazdy === 0
      ? 'WYNIK: kanon prawego pasa spełniony; rodziny zgodne.'
      : `WYNIK: ${zle} ekranów poza kanonem kolejności, ${rozjazdy} rozjazdów wewnątrz rodzin.`
  );
  process.exit(0);
})();
