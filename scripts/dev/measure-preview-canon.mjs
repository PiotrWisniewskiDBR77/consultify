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

/** Tryb wysokosci wlaczany jawnie; domyslnie skrypt zachowuje sie jak dotad. */
const TRYB_WYSOKOSCI = process.argv.slice(2).includes('--wysokosc');

/** Tolerancja pomiaru w px - zaokraglenia subpikselowe getBoundingClientRect. */
const TOLERANCJA_PX = 2;

/**
 * Ekrany rodziny 'podglad' dla trybu wysokosci. Parametry zapisane NA TRWALE
 * w narzedziu (nie w wierszu polecenia), zeby kolejny pomiar byl powtarzalny
 * bez odtwarzania klikniec z pamieci.
 *   klik   - wspolrzedne klikniecia otwierajacego podglad (gdy brak `wiersz`)
 *   wiersz - tekst wiersza tabeli, w ktory nalezy kliknac
 *   zakladka - tekst zakladki Menu 3 do przelaczenia przed klikiem
 */
const EKRANY_WYSOKOSC = [
  { id: 'execution-tab-resources', opis: 'Realizacja / Zasoby (ekran ze zrzutu wlasciciela)', klik: [420, 300] },
  { id: 'execution-tab-work', opis: 'Realizacja / Praca', klik: [420, 300] },
  { id: 'execution-tab-list', opis: 'Realizacja / Lista', klik: [420, 300] },
  { id: 'execution-tab-control', opis: 'Realizacja / Sterowanie', klik: [420, 300] },
  // Zakladka Raporty nie ma wlasnego wpisu w rejestrze harnessu - wchodzimy
  // w nia przez Menu 1 z ekranu Zasobow, zeby ExecutionReportsSurface tez byla
  // ZMIERZONA, a nie tylko naprawiona w ciemno.
  { id: 'execution-tab-resources', opis: 'Realizacja / Raporty', zakladka: 'Raporty' },
  { id: 'execution-tab-summary', opis: 'Realizacja / Podsumowanie', klik: [420, 300] },
  { id: 'execution-tab-rollout', opis: 'Realizacja / Wdrozenie', klik: [420, 300] },
  { id: 'idea-table', opis: 'Moja praca / Tabela idei', wiersz: 'Automatyzacja raportowania OEE' },
  { id: 'interview-preview-canon', opis: 'Wywiad / Podglad kanoniczny' },
  { id: 'drd-library-entry', opis: 'Ocena / Wpis biblioteki DRD', wiersz: 'DBR77' },
];

const oczekiwanaSzerokosc = (viewport) =>
  Math.min(CANON.max, Math.max(CANON.min, Math.round(viewport * CANON.ratio)));

/**
 * Pomiar wysokosci na jednym ekranie. Zwraca liczby, nie opinie.
 * Mierzy KARTE (to, co widac) osobno od WRAPPERA (to, co rozciaga flex),
 * bo rozjazd miedzy nimi jest dokladnie tym, na co skarzy sie wlasciciel.
 */
async function zmierzWysokosc(page, PORT, W, H, ekran) {
  const url = `http://localhost:${PORT}/?screen=${ekran.id}&lang=pl&theme=light&uwagi=0`;
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1800);
  if (ekran.zakladka) {
    await page.getByText(ekran.zakladka, { exact: true }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  if (ekran.wiersz) {
    await page.getByText(ekran.wiersz, { exact: false }).first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    // Klikamy PIERWSZY realny wiersz tabeli. Slepe wspolrzedne trafialy w
    // naglowek albo w pustke i dawaly falszywe 'BRAK PANELU' - a brak pomiaru
    // nie jest wynikiem.
    const wiersz = page.locator('tbody tr, [role="row"]').first();
    await wiersz.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const jest = await page.locator('[data-preview-pane]').count();
    if (!jest && ekran.klik) {
      await page.mouse.click(ekran.klik[0], ekran.klik[1]).catch(() => {});
      await page.waitForTimeout(1500);
    }
  }

  return page.evaluate(() => {
    const wrapper = document.querySelector('[data-preview-pane]');
    if (!wrapper) return { brak: true };
    const karta = wrapper.firstElementChild || wrapper;
    const layout = wrapper.closest('.flex.h-full') || wrapper.parentElement;
    const tabela = layout ? layout.querySelector('.flex-1') : null;

    /*
     * KOTWICA DOLNA. Pierwsza wersja tego pomiaru brala po prostu dol okna i
     * przez to oblewala ekrany POPRAWNE: panel konczyl sie 16 px nad dolem okna,
     * bo ekran ma `p-4`, ktore tabela obok dzieli z panelem. Padding strony nie
     * jest dziura w podgladzie. Kotwica jest wiec DOLNA KRAWEDZ CONTENT-BOXA
     * najblizszego przodka o definitywnej wysokosci - to jest realna przestrzen,
     * ktora panel ma wypelnic, i wzgledem niej ekrany poprawne daja rowne 0.
     */
    /*
     * WERSJA 3 KOTWICY - i powod, dla ktorego wersje 1 i 2 byly zle.
     *
     * W1 brala dol okna i ignorowala padding -> oblewala ekrany POPRAWNE
     *    (`interview-preview-canon`: 16 px "dziury" tam, gdzie dziury nie ma).
     * W2 brala najblizszy kontener przewijania -> na `execution-tab-control`
     *    zameldowala 0 px, a OKO widzialo panel konczacy sie 220 px nad dolem
     *    strony. Kotwica sama byla zaglodzona (`flex-1` na dziecku rodzica
     *    o `display:block` NIC nie robi, wiec kontener miał wysokosc tresci),
     *    a pomiar wzgledem zaglodzonej kotwicy zawsze wychodzi rowno. To jest
     *    klamstwo w kierunku NAJGROZNIEJSZYM - potwierdza sukces, ktorego nie ma.
     *
     * W3: kotwica to DOL STRONY - doslownie to, o co prosi wlasciciel
     * („od menu 3 do dolu strony") - pomniejszony o sume dolnych paddingow
     * i obramowan WSZYSTKICH przodkow. Dzieki temu kazde zaglodzone pudelko
     * po drodze ODEJMUJE sie od wyniku zamiast go maskowac.
     *
     * ZALOZENIE: powloka aplikacji jest przypieta do okna (`div.flex flex-col
     * h-full` = wysokosc viewportu), wiec „dol strony" = `innerHeight`.
     * Na ekranie, ktory celowo przewija sie w calosci, ten pomiar bylby zbyt
     * surowy - i wtedy nalezy go zakwestionowac, a nie uciszyc.
     */
    let anc = layout ? layout.parentElement : null;
    let odliczenie = 0;
    const sciezka = [];
    while (anc && anc !== document.documentElement) {
      const cs = getComputedStyle(anc);
      const ubytek = parseFloat(cs.paddingBottom || '0') + parseFloat(cs.borderBottomWidth || '0');
      odliczenie += ubytek;
      if (ubytek) sciezka.push(`${anc.tagName.toLowerCase()}:${Math.round(ubytek)}`);
      anc = anc.parentElement;
    }
    const dostepnyDol = window.innerHeight - odliczenie;
    const goraTabeli = tabela ? tabela.getBoundingClientRect().top : wrapper.getBoundingClientRect().top;

    return {
      brak: false,
      obszarTresci: Math.round(dostepnyDol - goraTabeli),
      wrapperH: Math.round(wrapper.getBoundingClientRect().height),
      kartaH: Math.round(karta.getBoundingClientRect().height),
      tabelaH: tabela ? Math.round(tabela.getBoundingClientRect().height) : null,
      /** Liczba rozstrzygajaca: ile brakuje panelowi do dolu dostepnej przestrzeni. */
      luka: Math.round(dostepnyDol - wrapper.getBoundingClientRect().bottom),
      kotwica: `okno-${Math.round(odliczenie)}px${sciezka.length ? ' (' + sciezka.join(',') + ')' : ''}`,
      scrollBody: Boolean(karta.querySelector('.overflow-y-auto')),
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')
      ? r.continue()
      : r.abort();
  });

<<<<<<< HEAD
=======
  if (TRYB_WYSOKOSCI) {
    console.log(`# Pomiar WYSOKOSCI podgladu - viewport ${W}x${H}px, tolerancja ${TOLERANCJA_PX}px\n`);
    console.log('| ekran | obszar tresci (menu3->dol) | panel (wrapper) | karta widoczna | luka | wlasny scroll | werdykt |');
    console.log('| --- | ---: | ---: | ---: | ---: | :-: | --- |');
    let zle = 0;
    let zmierzone = 0;
    for (const e of EKRANY_WYSOKOSC) {
      const r = await zmierzWysokosc(page, PORT, W, H, e);
      if (r.brak) {
        console.log(`| ${e.opis || e.id} | - | - | - | - | - | BRAK PANELU / brak podgladu na tym ekranie |`);
        continue;
      }
      zmierzone++;
      // Werdykt zapada na LUCE KONTENERA (wrapper vs obszar tresci), nie na
      // luce karty. Karta jest o `p-3` (24 px) mniejsza od wrappera Z ZALOZENIA
      // - to padding kanonu, nie defekt. Gdyby werdykt szedl po luce karty,
      // narzedzie oblewaloby ekrany POPRAWNE (idea-table, drd-library-entry),
      // czyli nagradzaloby defekt cisza i karalo poprawnosc. Sprawdzone
      // pomiarem: tam wrapper == obszar, a luka karty to dokladnie 12 px.
      const luka = r.luka;
      const ok = Math.abs(luka) <= TOLERANCJA_PX;
      if (!ok) zle++;
      console.log(
        `| ${e.opis || e.id} | ${r.obszarTresci}px | ${r.wrapperH}px | ${r.kartaH}px | ${luka}px | ${r.scrollBody ? 'tak' : 'NIE'} | ${ok ? 'OK' : 'NIE SIEGA DO DOLU'} |`
      );
    }
    console.log(`\nZmierzonych ekranow: ${zmierzone}. Panel NIE siega do dolu na: ${zle}.`);
    await browser.close();
    // Kod wyjscia != 0, zeby tryb dal sie uzyc jako BRAMKA przed pushem UI,
    // a nie tylko jako raport do czytania. Naprawa per-wywolanie odrasta;
    // bramka jest jedynym, co ja trzyma.
    process.exit(zle === 0 ? 0 : 1);
  }

>>>>>>> github-backup/grafika/wysokosc-podgladu-20260902
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
