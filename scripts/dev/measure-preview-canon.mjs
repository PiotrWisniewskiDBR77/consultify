/* eslint-disable */
/**
 * Pomiar kanonu podglądu — mechaniczny, nie „na oko".
 *
 * ── PO CO ──────────────────────────────────────────────────────────────────
 * Właściciel zgłosił TRZY RAZY (30.08, 01.09, 02.09) to samo zdanie:
 * „Preview nie jest zgodny z wzorem". Za każdym razem odpowiedzią było
 * spojrzenie na zrzut i opinia. Opinia nie odróżnia panelu 403 px od 428 px
 * ani kolejności `meta → details → ai` od `details → meta → ai`.
 *
 * Ten skrypt czyta z ŻYWEGO DOM-u dwie liczby, które kanon (§6/§7.0
 * `TABLE_AND_PREVIEW_CANON.md`) uznaje za rozstrzygające:
 *   • szerokość kontenera `[data-preview-pane]` — ma wynikać z
 *     `PREVIEW_PANE_WIDTH` = clamp(340px, 28%, 480px), nie z literału ekranu;
 *   • kolejność bloków `[data-preview-block]` — header · meta · details ·
 *     ai · relations · actions (+ opcjonalny whatsnext na końcu).
 *
 * Blok NIEOBECNY nie jest błędem (kanon: „blok bez danych = ukryty"), błędem
 * jest ZŁA KOLEJNOŚĆ obecnych bloków i szerokość spoza kanonu.
 *
 * Użycie (harness dev-render musi już działać):
 *   node scripts/dev/measure-preview-canon.mjs --port=3350 [--w=1600]
 */
import { chromium } from 'playwright';

const arg = (n, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};

const PORT = arg('port', '3350');
const W = parseInt(arg('w', '1600'), 10);
const H = parseInt(arg('h', '1000'), 10);

/** Kolejność z `CANON_PREVIEW_BLOCK_ORDER` (src/contracts/tableSurface/canon.ts). */
const CANON_ORDER = ['header', 'meta', 'details', 'ai', 'relations', 'actions', 'whatsnext'];

/** Ekrany rodziny „podgląd" z rejestru KORPUS_UWAG_20260902.md (poz. 26-30). */
const SCREENS = [
  { id: 'idea-table', wiersz: 'Automatyzacja raportowania OEE' },
  { id: 'interview-preview-canon' },
  { id: 'interview-preview-canon', variant: 'initiative', extra: '&variant=initiative' },
  { id: 'drd-library-entry', wiersz: 'DBR77' },
  { id: 'preview-4-zakladki' },
  { id: 'assessment-five-surfaces', wariantOpisu: 'Biblioteka', klik: [300, 224] },
  { id: 'assessment-five-surfaces', wariantOpisu: 'Procesy', zakladka: 'Procesy', klik: [300, 224] },
];

const CANON = { min: 340, ratio: 0.28, max: 480 };
const oczekiwanaSzerokosc = (viewport) =>
  Math.min(CANON.max, Math.max(CANON.min, Math.round(viewport * CANON.ratio)));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')
      ? r.continue()
      : r.abort();
  });

  let bledy = 0;
  console.log(`# Pomiar kanonu podglądu — viewport ${W}px, oczekiwana szerokość panelu: ${oczekiwanaSzerokosc(W)}px\n`);

  for (const s of SCREENS) {
    const url = `http://localhost:${PORT}/?screen=${s.id}&lang=pl&theme=light&uwagi=0${s.extra || ''}`;
    await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    if (s.zakladka) {
      await page
        .getByText(s.zakladka, { exact: true })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(1200);
    }
    if (s.klik) {
      await page.mouse.click(s.klik[0], s.klik[1]).catch(() => {});
      await page.waitForTimeout(1500);
    }
    if (s.wiersz) {
      await page
        .getByText(s.wiersz, { exact: false })
        .first()
        .click({ timeout: 4000 })
        .catch(() => {});
      await page.waitForTimeout(1500);
    }

    const wynik = await page.evaluate(() => {
      const panes = Array.from(document.querySelectorAll('[data-preview-pane]'));
      const bloki = Array.from(document.querySelectorAll('[data-preview-block]'));
      const grupuj = (root) =>
        Array.from(root.querySelectorAll('[data-preview-block]')).map((e) =>
          e.getAttribute('data-preview-block')
        );
      return {
        panele: panes.map((p) => ({
          w: Math.round(p.getBoundingClientRect().width),
          bloki: grupuj(p),
        })),
        blokiLuzem: panes.length === 0 ? bloki.map((e) => e.getAttribute('data-preview-block')) : [],
      };
    });

    const etykieta = s.variant || s.wariantOpisu ? `${s.id} (${s.variant || s.wariantOpisu})` : s.id;
    if (wynik.panele.length === 0 && wynik.blokiLuzem.length === 0) {
      console.log(`## ${etykieta}\n   BRAK PANELU — podgląd się nie otworzył (klik nie trafił albo ekran go nie ma)\n`);
      bledy++;
      continue;
    }

    const listy = wynik.panele.length
      ? wynik.panele
      : [{ w: null, bloki: wynik.blokiLuzem }];

    console.log(`## ${etykieta} — paneli: ${listy.length}`);
    listy.forEach((p, i) => {
      const kolejnoscOK = (() => {
        const idx = p.bloki.map((b) => CANON_ORDER.indexOf(b));
        if (idx.some((x) => x < 0)) return 'NIEZNANY BLOK';
        return idx.every((x, k) => k === 0 || x >= idx[k - 1]) ? 'OK' : 'ZLA KOLEJNOSC';
      })();
      const rowneKolumny = listy.length > 1 && listy.every((x) => x.w === listy[0].w);
      const szerOK =
        listy.length > 1 && rowneKolumny
          ? `OK (${p.w}px — wszystkie ${listy.length} kolumny równe; przyrząd skaluje wiersz do kadru)`
        : p.w === null
          ? 'n/d (brak [data-preview-pane])'
          : Math.abs(p.w - oczekiwanaSzerokosc(W)) <= 2
            ? `OK (${p.w}px)`
            : `POZA KANONEM (${p.w}px, oczekiwane ${oczekiwanaSzerokosc(W)}px)`;
      if (kolejnoscOK !== 'OK' || szerOK.startsWith('POZA') || szerOK.startsWith('n/d')) bledy++;
      console.log(`   [${i}] szerokość: ${szerOK}`);
      console.log(`   [${i}] bloki: ${p.bloki.join(' → ') || '(brak znaczników)'} — kolejność: ${kolejnoscOK}`);
    });
    console.log('');
  }

  await browser.close();
  console.log(bledy === 0 ? 'WYNIK: kanon podglądu spełniony na wszystkich mierzonych ekranach.' : `WYNIK: ${bledy} odchyleń od kanonu.`);
  process.exit(0);
})();
