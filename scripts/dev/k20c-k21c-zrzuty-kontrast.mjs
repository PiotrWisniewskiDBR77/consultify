/**
 * K-20c / K-21c (KANAL Wpis 142/143, DEC-575) — zrzuty odbioru + POMIAR
 * PIKSELOWY kontrastu.
 *
 * DLACZEGO PIKSELOWO (reguła CTO nr 9 z 16.09): `getComputedStyle` zwraca
 * TOKEN (`--c-control-track` = rgb(100,116,139), 4,76:1) i nie widzi, że
 * rodzic ma `opacity-40` — złożony na tle piksel jest zupełnie inny. Cała
 * usterka K-20c była niewidzialna dla pomiaru ze stylów. Tu mierzymy to, co
 * naprawdę wyszło na PNG: kolor toru bierzemy z ŚRODKA prostokąta kontrolki
 * (mediana piksela), tło z paska tuż obok niej.
 *
 * Wymaga uruchomionego harnessu:
 *   npx vite --config dev-render/vite.config.ts --port 3878
 *   node scripts/dev/k20c-k21c-zrzuty-kontrast.mjs [--port 3878]
 *
 * Wynik: PNG-i 1440×900 w `evidence/k20c-k21c-20260916/` + tabela kontrastu
 * na stdout i w `KONTRAST.json`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = getArg('port', '3878');
const OUT = path.resolve('evidence/k20c-k21c-20260916');
const SKALA = 2; // deviceScaleFactor — piksele PNG = CSS × SKALA

/** Selektory mierzonych elementów, liczone W PRZEGLĄDARCE do prostokątów CSS. */
const EKRANY = [
  {
    id: 'k20c-skroty',
    tytul: 'K-20c — Keyboard Shortcuts (tor OFF/ON + nazwy skrótów)',
    url: 'screen=k20b-shortcuts-settings',
    pomiary: `(() => {
      const wiersze = [...document.querySelectorAll('div.flex.items-center.justify-between')]
        .filter((w) => w.querySelector('button.rounded-full.h-5, button.h-5.w-9, button[class*="h-5"][class*="w-9"]'));
      const wynik = [];
      for (const w of wiersze) {
        const tor = w.querySelector('button[class*="h-5"][class*="w-9"]');
        const nazwa = w.querySelector('p.font-medium');
        if (!tor) continue;
        const kl = tor.className;
        const stan = kl.includes('bg-c-control-track') ? 'OFF' : 'ON';
        wynik.push({ etykieta: 'tor ' + stan, rect: tor.getBoundingClientRect().toJSON(), rodzaj: 'kontrolka' });
        if (nazwa) wynik.push({ etykieta: 'nazwa skrótu (' + stan + ')', rect: nazwa.getBoundingClientRect().toJSON(), rodzaj: 'tekst' });
        if (wynik.length >= 8) break;
      }
      return wynik;
    })()`,
  },
  {
    id: 'k20c-godziny',
    tytul: 'K-20c — Working hours (tor OFF/ON w wierszu dnia)',
    url: 'screen=feedback-k20-pstryczki',
    pomiary: `(() => {
      const tory = [...document.querySelectorAll('button[role="switch"], button[class*="rounded-full"][class*="w-1"]')];
      const wynik = [];
      for (const tor of tory.slice(0, 6)) {
        const r = tor.getBoundingClientRect();
        if (r.width < 20 || r.width > 80) continue;
        const stan = tor.getAttribute('aria-checked') === 'true' ? 'ON' : 'OFF';
        wynik.push({ etykieta: 'tor ' + stan, rect: r.toJSON(), rodzaj: 'kontrolka' });
      }
      return wynik;
    })()`,
  },
  {
    id: 'k21c-menu',
    tytul: 'K-21c — menu profilu z wejściem „Create Organization"',
    url: 'screen=feedback-k21b-create-org&role=ADMIN&krok=menu',
    czekaj: 1400,
  },
  {
    id: 'k21c-modal',
    tytul: 'K-21c — modal „Create Organization"',
    url: 'screen=feedback-k21b-create-org&role=ADMIN&krok=modal',
    czekaj: 1800,
  },
  {
    // ★ K-21d (odbiór CTO): dowód na P2 — po utworzeniu ROZWINIĘTA lista
    // „Switch organization" zawiera NOWĄ organizację i to ona ma ptaszek.
    id: 'k21c-lista-po',
    tytul: 'K-21d — lista organizacji PO utworzeniu (nowa org z ptaszkiem)',
    url: 'screen=feedback-k21b-create-org&role=ADMIN&krok=utworzona',
    czekaj: 4000,
  },
  {
    id: 'k21c-toast',
    tytul: 'K-21c — po utworzeniu: przełączenie + komunikat „you are now in …"',
    url: 'screen=feedback-k21b-create-org&role=ADMIN&krok=utworzona',
    czekaj: 3000,
  },
];

/** Luminancja względna WCAG 2.1 dla kanału 0-255. */
const kanal = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancja = ([r, g, b]) => 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
const kontrast = (a, b) => {
  const [ja, jb] = [luminancja(a), luminancja(b)];
  const [j, c] = ja > jb ? [ja, jb] : [jb, ja];
  return (j + 0.05) / (c + 0.05);
};

const piksel = (png, x, y) => {
  const i = (png.width * Math.round(y) + Math.round(x)) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
};

/** Dominujący kolor prostokąta (moda po pikselach) — odporny na antyaliasing. */
const dominujacy = (png, r) => {
  const licznik = new Map();
  const x0 = Math.max(0, Math.round(r.x * SKALA) + 2);
  const x1 = Math.min(png.width - 1, Math.round((r.x + r.width) * SKALA) - 2);
  const y0 = Math.max(0, Math.round(r.y * SKALA) + 2);
  const y1 = Math.min(png.height - 1, Math.round((r.y + r.height) * SKALA) - 2);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const p = piksel(png, x, y).join(',');
      licznik.set(p, (licznik.get(p) || 0) + 1);
    }
  }
  let best = null;
  let ile = 0;
  for (const [k, v] of licznik) if (v > ile) [best, ile] = [k, v];
  return best ? best.split(',').map(Number) : null;
};

/** Najciemniejszy piksel prostokąta — dla TEKSTU (rdzeń glifu, nie tło). */
const skrajny = (png, r, ciemny) => {
  let wybrany = null;
  let jmin = ciemny ? 2 : -1;
  const x0 = Math.max(0, Math.round(r.x * SKALA));
  const x1 = Math.min(png.width - 1, Math.round((r.x + r.width) * SKALA));
  const y0 = Math.max(0, Math.round(r.y * SKALA));
  const y1 = Math.min(png.height - 1, Math.round((r.y + r.height) * SKALA));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const p = piksel(png, x, y);
      const j = luminancja(p);
      if (ciemny ? j < jmin : j > jmin) {
        jmin = j;
        wybrany = p;
      }
    }
  }
  return wybrany;
};

/** Tło: dominujący kolor paska NA LEWO od elementu (ta sama wysokość). */
const tlo = (png, r) => {
  const pas = { x: Math.max(0, r.x - 14), y: r.y + r.height / 4, width: 8, height: r.height / 2 };
  return dominujacy(png, pas);
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const raport = [];

  for (const ekran of EKRANY) {
    for (const motyw of ['light', 'dark']) {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: SKALA,
      });
      const page = await ctx.newPage();
      const bledy = [];
      page.on('console', (m) => m.type() === 'error' && bledy.push(m.text()));
      // `&uwagi=0` (reguła CTO nr 5): panel „Uwagi" harnessu to PRZYRZĄD i
      // zasłania produkt — bez tego mediana piksela toru czytała jego tło
      // (zmierzone: rgb(17,24,39) zamiast rgb(91,141,239)).
      const url = `http://localhost:${PORT}/?${ekran.url}&lang=en&theme=${motyw}&uwagi=0`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(ekran.czekaj || 900);

      const plik = path.join(OUT, `${ekran.id}-en-${motyw}.png`);
      await page.screenshot({ path: plik });

      let pomiary = [];
      if (ekran.pomiary) {
        const wszystkie = await page.evaluate(ekran.pomiary);
        // Bezpiecznik „brak pomiaru nie jest wynikiem" odwrócony: element POZA
        // kadrem 1440×900 nie ma swoich pikseli w PNG — odczyt spod dolnej
        // krawędzi dałby fałszywe „1,1:1". Mierzymy TYLKO to, co widać.
        const rects = wszystkie.filter(
          (m) => m.rect.top >= 0 && m.rect.bottom <= 900 && m.rect.width > 0
        );
        if (!rects.length) throw new Error(`${ekran.id}/${motyw}: zero elementów w kadrze`);
        const png = PNG.sync.read(fs.readFileSync(plik));
        pomiary = rects
          .map((m) => {
            const kolor =
              m.rodzaj === 'tekst'
                ? skrajny(png, m.rect, motyw === 'light')
                : dominujacy(png, m.rect);
            const bg = tlo(png, m.rect);
            if (!kolor || !bg) return null;
            return {
              element: m.etykieta,
              kolor: `rgb(${kolor.join(',')})`,
              tlo: `rgb(${bg.join(',')})`,
              kontrast: Number(kontrast(kolor, bg).toFixed(2)),
              prog: m.rodzaj === 'tekst' ? 4.5 : 3.0,
            };
          })
          .filter(Boolean)
          .map((w) => ({ ...w, wynik: w.kontrast >= w.prog ? 'OK' : 'PONIŻEJ PROGU' }));
      }

      raport.push({ id: ekran.id, tytul: ekran.tytul, motyw, url, png: plik, bledy, pomiary });
      console.log(
        `✓ ${ekran.id} [${motyw}] → ${path.basename(plik)}${bledy.length ? ` ⚠ ${bledy.length} błędów konsoli` : ''}`
      );
      for (const p of pomiary) {
        console.log(
          `    ${p.element.padEnd(24)} ${p.kolor.padEnd(20)} na ${p.tlo.padEnd(20)} = ${String(p.kontrast).padStart(5)}:1 (próg ${p.prog}) ${p.wynik}`
        );
      }
      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'KONTRAST.json'), JSON.stringify(raport, null, 2));
  const ponizej = raport.flatMap((r) =>
    r.pomiary.filter((p) => p.wynik !== 'OK').map((p) => `${r.id}/${r.motyw}: ${p.element}`)
  );
  console.log(
    ponizej.length ? `\n✗ PONIŻEJ PROGU: ${ponizej.join(', ')}` : '\n✓ wszystkie pomiary ≥ progu'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
