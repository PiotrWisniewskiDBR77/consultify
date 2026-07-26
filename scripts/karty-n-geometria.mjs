#!/usr/bin/env node
/**
 * APARAT POMIAROWY 6 KART n-Type — geometria REALNYCH PASÓW + higiena ekranu.
 *
 * PO CO: przed migracją kart na wspólną powłokę robimy odcisk palca stanu „przed";
 * po migracji ten sam skrypt musi dać wynik NIE GORSZY. Bez tego nikt nie udowodni,
 * że nic się nie rozjechało.
 *
 * ★ CZEGO NIE MIERZYMY: kontenerów `max-w-*`. Poprzedni pomiar (2026-07-24) porównał
 *   szerokości limitów, a nie realnie namalowanych pasów — i pokazał zgodność tam,
 *   gdzie Menu 2 było węższe od Menu 1 o 2×24 px. Każdy pas jest tu rozwiązywany do
 *   ELEMENTU, który faktycznie ma tło/ramkę, a jeżeli rozwiązanie trafi w kontener
 *   z klasą `max-w-`, wynik dostaje flagę `podejrzanyKontener` i idzie do raportu.
 *
 * ★ CZEGO NIE UFAMY: samemu sobie. `--self-test` wstrzykuje w żywą stronę sztuczny
 *   błąd konsoli, sztuczny crimson, sztuczny enum i sztuczny komunikat błędu, i sprawdza,
 *   że detektory je ŁAPIĄ — oraz że usunięcie Menu 2 z DOM daje „brak", a nie po cichu
 *   rect rodzica. Skrypt, który zawsze mówi „czysto", jest bezwartościowy
 *   (bramka `check-triada` była tak ślepa przez `grep` w trybie BRE na macOS).
 *
 * WYMAGA: dev-render na porcie z `--baza` (domyślnie 3201):
 *   npx vite --config dev-render/vite.config.ts --port 3201 --strictPort
 *
 * URUCHOMIENIE:
 *   node scripts/karty-n-geometria.mjs                      # pomiar + JSON + MD
 *   node scripts/karty-n-geometria.mjs --self-test          # kontrolki pozytywne
 *   node scripts/karty-n-geometria.mjs --zrzuty             # + PNG 6×2
 *   node scripts/karty-n-geometria.mjs --porownaj=<baseline.json>   # regresje vs baseline
 *   node scripts/karty-n-geometria.mjs --wyjscie=<katalog>  # gdzie zapisać wyniki
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

// ── Parametry wywołania ──────────────────────────────────────────────────────
const ARG = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const BAZA = typeof ARG.baza === 'string' ? ARG.baza : 'http://localhost:3201';
const WYJSCIE = typeof ARG.wyjscie === 'string' ? ARG.wyjscie : process.cwd();
const SELF_TEST = !!ARG['self-test'];
const ZRZUTY = !!ARG.zrzuty;
const POROWNAJ = typeof ARG.porownaj === 'string' ? ARG.porownaj : null;

const KARTY = [
  ['Decyzja', 'karta-decision'],
  ['Zadanie', 'karta-task'],
  ['Powiadomienie', 'karta-notification'],
  ['Insight', 'karta-insight'],
  ['Narzędzie', 'karta-tool'],
  ['Inicjatywa', 'karta-initiative'],
];
// ★ 1024 dodane 2026-07-26: to szerokość, na której żył najgroźniejszy regres
//   stabilizacji gridu (prawy panel znikał w 3/6 kart) — złapany wtedy WYŁĄCZNIE
//   ręcznym QA, bo aparat mierzył tylko [1280,1440]. Bez tej kolumny narzędzie
//   regresyjne było ślepe dokładnie tam, gdzie regresja faktycznie się zdarza.
const VIEWPORTY = [1024, 1280, 1440];

// ── Filtr szumu konsoli ──────────────────────────────────────────────────────
// Świadomie WĄSKI: łapie tylko to, co w harnessie jest oczekiwane (brak backendu AI,
// favicon, HMR/vite, DevTools). Wszystko inne to realny błąd i ma iść do raportu.
const SZUM =
  /favicon|\[vite\]|vite:|\bHMR\b|net::ERR_|Failed to load resource|the server responded with a status of 404|Download the React DevTools|AI returned no JSON|Analyze with AI failed/i;

/**
 * ═══ POMIAR W PRZEGLĄDARCE ═══
 * Cała funkcja leci przez `page.evaluate`, więc musi być samowystarczalna.
 */
function pomiarWStronie() {
  const W = window;
  const D = document;

  const widoczny = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = W.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05;
  };

  /** Rect + metryki diagnostyczne pasa. `l/r` liczone w układzie DOKUMENTU (scroll-safe). */
  const opisz = (el, zrodlo) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const kl = typeof el.className === 'string' ? el.className : '';
    return {
      zrodlo,
      tag: el.tagName.toLowerCase(),
      klasa: kl.slice(0, 90),
      l: Math.round(r.left + W.scrollX),
      r: Math.round(r.right + W.scrollX),
      w: Math.round(r.width),
      h: Math.round(r.height),
      t: Math.round(r.top + W.scrollY),
      // ★ Strażnik błędu poprzedniego pomiaru: czy trafiliśmy w limit szerokości zamiast w pas.
      podejrzanyKontener: /\bmax-w-/.test(kl),
    };
  };

  const wszystkie = [...D.querySelectorAll('*')];

  // ── Menu 2 ────────────────────────────────────────────────────────────────
  // Kotwica właścicielska komponentu (NModeMenu2). Zapasowo: pasek z pstryczkiem
  // Edycja|Podgląd. Zapas MA INNE `zrodlo`, żeby regres kotwicy było widać w raporcie.
  let menu2 = D.querySelector('[data-testid="nmode-menu2"]');
  let menu2Zrodlo = 'testid:nmode-menu2';
  if (!widoczny(menu2)) {
    menu2 = null;
    const kandydat = wszystkie.find(
      (el) =>
        widoczny(el) &&
        el.querySelector('[data-menu2-zone="left"]') &&
        el.querySelector('[data-menu2-zone="right"]'),
    );
    if (kandydat) {
      menu2 = kandydat;
      menu2Zrodlo = 'heurystyka:strefy-menu2';
    }
  }

  // ── Menu 1 (pas nagłówka) ─────────────────────────────────────────────────
  // Root `NModeHeader`: pas z tłem surface + backdrop-blur + zaokrągleniem, leżący
  // NAD Menu 2 i zawierający tytuł artefaktu. Nie kontener układu.
  let menu1 = D.querySelector('[data-testid="nmode-header"]');
  let menu1Zrodlo = 'testid:nmode-header';
  if (!widoczny(menu1)) {
    menu1 = null;
    const yMenu2 = menu2 ? menu2.getBoundingClientRect().top : Infinity;
    const kandydaci = wszystkie.filter((el) => {
      if (!widoczny(el)) return false;
      const kl = typeof el.className === 'string' ? el.className : '';
      if (!/backdrop-blur/.test(kl) || !/rounded-2xl/.test(kl)) return false;
      const r = el.getBoundingClientRect();
      return r.height >= 40 && r.height <= 200 && r.width > 300 && r.top < yMenu2;
    });
    if (kandydaci.length) {
      menu1 = kandydaci.sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      )[0];
      menu1Zrodlo = 'klasa:backdrop+rounded-2xl';
    } else {
      // Ostatnia deska: najwyżej położony pas zawierający najgrubszy tekst nagłówka.
      const tytuly = wszystkie.filter((el) => {
        if (!widoczny(el) || el.children.length) return false;
        const s = W.getComputedStyle(el);
        return parseFloat(s.fontSize) >= 18 && parseInt(s.fontWeight, 10) >= 600;
      });
      if (tytuly.length) {
        let p = tytuly[0];
        while (p && p.getBoundingClientRect().width < 300) p = p.parentElement;
        menu1 = p;
        menu1Zrodlo = 'heurystyka:pas-tytulu';
      }
    }
  }

  // ── Lewa nawigacja sekcji ─────────────────────────────────────────────────
  const nawigacje = wszystkie.filter((el) => {
    if (el.tagName !== 'NAV' || !widoczny(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 80 && r.width < 400 && r.height > 80 && el.querySelectorAll('button').length >= 1;
  });
  const lewaNaw = nawigacje.sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  )[0];

  // ── Pas sekcji ────────────────────────────────────────────────────────────
  // Realny wiersz treści: rodzic obejmujący lewą nawigację i kanwę sekcji.
  // Nie `max-w-*` — jeśli mimo to nim będzie, flaga `podejrzanyKontener` to pokaże.
  let pasSekcji = null;
  let pasZrodlo = 'rodzic-nawigacji';
  if (lewaNaw && lewaNaw.parentElement) {
    pasSekcji = lewaNaw.parentElement;
  } else {
    // Karta bez lewej nawigacji (tryb C / wąski viewport): bierzemy kontener sekcji kanwy.
    const kanwa = wszystkie.find(
      (el) => widoczny(el) && el.querySelectorAll(':scope > section').length >= 2,
    );
    if (kanwa) {
      pasSekcji = kanwa;
      pasZrodlo = 'kontener-sekcji-kanwy';
    }
  }

  // ── Prawy panel ───────────────────────────────────────────────────────────
  const panel = wszystkie.find(
    (el) => el.tagName === 'ASIDE' && widoczny(el) && el.getBoundingClientRect().width > 200,
  );
  const sekcjePanelu = panel
    ? [...panel.querySelectorAll(':scope > section')].map((s) =>
        ((s.innerText || '').split('\n')[0] || '').trim().slice(0, 40),
      )
    : [];

  // ── Crimson ───────────────────────────────────────────────────────────────
  // Dwa warianty tokenu: #85182F (jasny) i #c8324a (ciemny --c-accent).
  const CRIMSON = /rgb\(133, 24, 47\)|rgb\(200, 50, 74\)/;
  const POLA = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
  ];
  let crimson = 0;
  const crimsonPrzyklady = [];
  wszystkie.forEach((el) => {
    if (!widoczny(el)) return;
    const s = W.getComputedStyle(el);
    let trafien = 0;
    POLA.forEach((p) => {
      if (CRIMSON.test(s[p])) trafien++;
    });
    if (CRIMSON.test(s.backgroundImage) || CRIMSON.test(s.boxShadow)) trafien++;
    if (trafien) {
      crimson += trafien;
      if (crimsonPrzyklady.length < 8) {
        crimsonPrzyklady.push(
          `${el.tagName.toLowerCase()}: „${(el.textContent || '').trim().slice(0, 28)}"`,
        );
      }
    }
  });

  // ── Tekst ekranu ──────────────────────────────────────────────────────────
  // ★ `innerText` NIE pokazuje `.value` pól formularza — to była realna dziura
  //   w poprzednim pomiarze (enumy siedziały w inputach i „nie istniały").
  const kawalki = [D.body.innerText || ''];
  D.querySelectorAll('input, textarea').forEach((el) => {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (['checkbox', 'radio', 'password', 'file', 'hidden', 'range'].includes(t)) return;
    if (el.value) kawalki.push(String(el.value));
  });
  D.querySelectorAll('select').forEach((s) => {
    const o = s.selectedOptions && s.selectedOptions[0];
    if (o) kawalki.push(o.textContent || '');
  });
  D.querySelectorAll('[placeholder]').forEach((el) =>
    kawalki.push(el.getAttribute('placeholder') || ''),
  );
  const tekst = kawalki.join('\n');

  return {
    pasy: {
      menu1: opisz(menu1, menu1Zrodlo),
      menu2: opisz(menu2, menu2Zrodlo),
      sekcje: opisz(pasSekcji, pasZrodlo),
      prawyPanel: opisz(panel, 'aside'),
      lewaNawigacja: opisz(lewaNaw, 'nav'),
    },
    prawyPanelEtykieta: panel ? panel.getAttribute('aria-label') : null,
    sekcjePanelu,
    liczbaSekcjiPanelu: sekcjePanelu.length,
    crimson,
    crimsonPrzyklady,
    bladNaEkranie:
      /Coś poszło nie tak|Something went wrong|Wystąpił nieoczekiwany błąd|Unknown <code>|Cannot read propert|is not defined|ChunkLoadError/.test(
        tekst,
      ),
    znaki: (D.body.innerText || '').trim().length,
    klikalne: wszystkie.filter(
      (el) =>
        widoczny(el) &&
        (el.tagName === 'BUTTON' ||
          el.tagName === 'A' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'INPUT' ||
          el.getAttribute('role') === 'button'),
    ).length,
    tekst,
  };
}

// ── Detektor surowych enumów (poza przeglądarką — łatwiej testować) ──────────
/**
 * Surowy enum = identyfikator maszyny, który wyciekł na ekran zamiast etykiety PL.
 *  · SCREAMING_SNAKE: IN_PROGRESS, HIGH_RISK
 *  · slug: in-progress, high-risk
 * WYJĄTKI (świadome, żeby detektor nie krzyczał na poprawną polszczyznę i dane):
 *  trade-off/trade-offs, daty ISO, nazwy plików (kropka+rozszerzenie), adresy,
 *  utrwalone złożenia (know-how, e-mail, ad-hoc, on-line, non-stop, follow-up,
 *  must-have, nice-to-have, real-time, end-to-end, top-down, bottom-up, go-to-market),
 *  polskie „-by/-że" nie występuje z myślnikiem, więc nie ma ryzyka.
 */
const WYJATKI_SLUG = new Set([
  'trade-off',
  'trade-offs',
  'trade-offy',
  'know-how',
  'e-mail',
  'ad-hoc',
  'on-line',
  'non-stop',
  'follow-up',
  'must-have',
  'nice-to-have',
  'real-time',
  'end-to-end',
  'top-down',
  'bottom-up',
  'go-to-market',
  'up-to-date',
  'out-of-the-box',
  'time-to-market',
  'peer-to-peer',
  'drag-and-drop',
  // Terminologia Lean/5S w treści demo karty Inicjatywa („wózek SMED z obrysami
  // narzędzi (shadow-board)") — to słownictwo doradcze, nie enum systemowy.
  // Zweryfikowane w źródle: dev-render/screens/karta-initiative.tsx:213.
  'shadow-board',
]);
const WYJATKI_SCREAMING = new Set(['RACI_', 'AI_ACT']);

export function znajdzSuroweEnumy(tekst) {
  const trafienia = [];
  const doWyciecia = tekst
    // daty ISO i zakresy dat
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    // nazwy plików i URL-e (mają kropkę lub ukośnik w tokenie)
    .replace(/\S*[./]\S*/g, ' ');

  const screaming = doWyciecia.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) || [];
  screaming.forEach((m) => {
    if (!WYJATKI_SCREAMING.has(m)) trafienia.push({ rodzaj: 'SCREAMING_SNAKE', wartosc: m });
  });

  const slugi = doWyciecia.match(/\b[a-z]{2,}(?:-[a-z]{2,})+\b/g) || [];
  slugi.forEach((m) => {
    if (!WYJATKI_SLUG.has(m)) trafienia.push({ rodzaj: 'slug', wartosc: m });
  });

  // Zliczenie unikatów, ale z zachowaniem liczby wystąpień.
  const licznik = new Map();
  trafienia.forEach((t) => {
    const k = `${t.rodzaj}|${t.wartosc}`;
    licznik.set(k, (licznik.get(k) || 0) + 1);
  });
  return [...licznik.entries()].map(([k, ile]) => {
    const [rodzaj, wartosc] = k.split('|');
    return { rodzaj, wartosc, ile };
  });
}

export function odfiltrujSzum(bledy) {
  return bledy.filter((b) => !SZUM.test(b));
}

// ── Jedno przejście: karta × viewport ────────────────────────────────────────
async function zmierzKarte(przegladarka, ekran, szerokosc, { wstrzyknij = false } = {}) {
  const ctx = await przegladarka.newContext({ viewport: { width: szerokosc, height: 900 } });
  const strona = await ctx.newPage();
  const bledy = [];
  strona.on('console', (m) => {
    if (m.type() === 'error') bledy.push(m.text().slice(0, 160));
  });
  strona.on('pageerror', (e) => bledy.push('PAGEERROR: ' + String(e.message).slice(0, 160)));

  let wynik;
  try {
    await strona.goto(`${BAZA}/?screen=${ekran}&lang=pl&theme=light`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    await strona.waitForTimeout(2500); // animacja wejścia powłoki

    if (wstrzyknij) {
      // ★ KONTROLKI POZYTYWNE — sztuczne defekty wstrzykiwane do żywej strony.
      await strona.evaluate(() => {
        // 1. realny błąd konsoli (ma przejść przez filtr szumu)
        console.error('SELF-TEST: sztuczny blad konsoli aparatu pomiarowego');
        // 2. szum (ma zostać ODFILTROWANY — kontrola negatywna filtra)
        console.error('Failed to load resource: favicon.ico 404');
        // 3. crimson
        const c = document.createElement('div');
        c.id = 'self-test-crimson';
        c.style.cssText = 'color: rgb(133, 24, 47); position: fixed; top: 0; left: 0;';
        c.textContent = 'SELF-TEST crimson';
        document.body.appendChild(c);
        // 4. surowe enumy + komunikat błędu
        const t = document.createElement('div');
        t.id = 'self-test-enum';
        t.style.cssText = 'position: fixed; top: 20px; left: 0;';
        t.textContent = 'STATUS_W_TOKU · priority-high · Coś poszło nie tak';
        document.body.appendChild(t);
        // 5. usunięcie kotwicy Menu 2 — pomiar MA zgłosić brak/zapas, nie rect rodzica
        const m2 = document.querySelector('[data-testid="nmode-menu2"]');
        if (m2) m2.remove();
      });
      await strona.waitForTimeout(200);
    }

    const p = await strona.evaluate(pomiarWStronie);
    wynik = { ...p, enumy: znajdzSuroweEnumy(p.tekst) };
    delete wynik.tekst;
  } catch (e) {
    wynik = { blad: String(e.message).slice(0, 160), pasy: {}, sekcjePanelu: [], enumy: [] };
  }
  wynik.bledyKonsoli = odfiltrujSzum(bledy);
  wynik.bledyKonsoliSurowo = bledy.length;
  return { wynik, strona, ctx };
}

// ═══ SELF-TEST ═══════════════════════════════════════════════════════════════
async function selfTest() {
  console.log('KONTROLKI POZYTYWNE APARATU (--self-test)\n');
  console.log(`Baza: ${BAZA} · karta wzorcowa: karta-decision @1440 (geometria) + @1024 (detektory)\n`);
  const przegladarka = await chromium.launch();

  const czysty = await zmierzKarte(przegladarka, 'karta-decision', 1440);
  await czysty.ctx.close();
  const brudny = await zmierzKarte(przegladarka, 'karta-decision', 1440, { wstrzyknij: true });
  await brudny.ctx.close();
  // ★ Drugi viewport (1024) — detektory konsoli/crimson/enum/error-boundary są
  //   niezależne od szerokości i MUSZĄ łapać wstrzyknięte defekty także na wąskim
  //   ekranie. Bez tego self-test walidował aparat tylko na jednej kombinacji
  //   (decision@1440) — luka zgłoszona w handoffie 2026-07-24. Kontrolki GEOMETRII
  //   zostają na 1440, bo na 1024 część pasów bywa świadomie ukryta (responsywność).
  const czysty1024 = await zmierzKarte(przegladarka, 'karta-decision', 1024);
  await czysty1024.ctx.close();
  const brudny1024 = await zmierzKarte(przegladarka, 'karta-decision', 1024, { wstrzyknij: true });
  await brudny1024.ctx.close();
  await przegladarka.close();

  const A = czysty.wynik;
  const B = brudny.wynik;
  const A2 = czysty1024.wynik;
  const B2 = brudny1024.wynik;

  const probki = [
    {
      nazwa: 'Błąd konsoli — sztuczny błąd zostaje ZŁAPANY',
      ok: B.bledyKonsoli.some((b) => /SELF-TEST: sztuczny blad/.test(b)),
      szczegol: `przed: ${A.bledyKonsoli.length}, po wstrzyknięciu: ${B.bledyKonsoli.length}`,
    },
    {
      nazwa: 'Filtr szumu — sztuczny favicon 404 zostaje ODFILTROWANY',
      ok: !B.bledyKonsoli.some((b) => /favicon/i.test(b)) && B.bledyKonsoliSurowo > A.bledyKonsoliSurowo,
      szczegol: `surowo ${A.bledyKonsoliSurowo} → ${B.bledyKonsoliSurowo}, po filtrze ${A.bledyKonsoli.length} → ${B.bledyKonsoli.length}`,
    },
    {
      nazwa: 'Crimson — wstrzyknięty rgb(133,24,47) podnosi licznik',
      ok: B.crimson > A.crimson,
      szczegol: `przed: ${A.crimson}, po: ${B.crimson}`,
    },
    {
      nazwa: 'Enum SCREAMING_SNAKE — „STATUS_W_TOKU" zostaje ZŁAPANY',
      ok: B.enumy.some((e) => e.wartosc === 'STATUS_W_TOKU'),
      szczegol: `złapane: ${B.enumy.map((e) => e.wartosc).join(', ') || '—'}`,
    },
    {
      nazwa: 'Enum slug — „priority-high" zostaje ZŁAPANY',
      ok: B.enumy.some((e) => e.wartosc === 'priority-high'),
      szczegol: `slugów: ${B.enumy.filter((e) => e.rodzaj === 'slug').length}`,
    },
    {
      nazwa: 'Error-boundary — „Coś poszło nie tak" zostaje ZŁAPANE',
      ok: B.bladNaEkranie === true && A.bladNaEkranie === false,
      szczegol: `przed: ${A.bladNaEkranie}, po: ${B.bladNaEkranie}`,
    },
    {
      nazwa: 'Geometria — usunięcie Menu 2 NIE daje po cichu rect-u rodzica',
      ok:
        !B.pasy.menu2 ||
        (B.pasy.menu2.zrodlo !== 'testid:nmode-menu2' &&
          !(A.pasy.menu2 && B.pasy.menu2.w === A.pasy.menu2.w && B.pasy.menu2.h === A.pasy.menu2.h)),
      szczegol: `przed: ${A.pasy.menu2 ? `${A.pasy.menu2.zrodlo} ${A.pasy.menu2.w}×${A.pasy.menu2.h}` : 'brak'} · po: ${
        B.pasy.menu2 ? `${B.pasy.menu2.zrodlo} ${B.pasy.menu2.w}×${B.pasy.menu2.h}` : 'brak'
      }`,
    },
    {
      nazwa: 'Geometria — pas zmierzony na czystej karcie to NIE kontener max-w-*',
      ok: Object.values(A.pasy).every((p) => !p || p.podejrzanyKontener === false),
      szczegol: Object.entries(A.pasy)
        .map(([k, v]) => `${k}=${v ? v.zrodlo : 'brak'}`)
        .join(' · '),
    },
    {
      nazwa: 'Geometria — na czystej karcie komplet 5 pasów jest zmierzony',
      ok: Object.values(A.pasy).every((p) => p && p.w > 0),
      szczegol: Object.entries(A.pasy)
        .map(([k, v]) => `${k}=${v ? `${v.w}px` : 'BRAK'}`)
        .join(' · '),
    },
  ];

  // Kontrolki czysto tekstowe (bez przeglądarki) — wyjątki detektora enumów.
  probki.push(
    {
      nazwa: 'Wyjątek detektora — „trade-off" NIE jest zgłaszany',
      ok: znajdzSuroweEnumy('Analiza trade-off i trade-offy w projekcie').length === 0,
      szczegol: 'wyjątek świadomy (słownictwo doradcze)',
    },
    {
      nazwa: 'Wyjątek detektora — data ISO i nazwa pliku NIE są zgłaszane',
      ok: znajdzSuroweEnumy('2026-07-24 raport-kwartalny.pdf https://a.pl/b-c-d').length === 0,
      szczegol: 'daty, pliki, adresy poza zakresem',
    },
    {
      nazwa: 'Detektor tekstowy — łapie enum w treści pola formularza',
      ok: znajdzSuroweEnumy('NOT_STARTED').length === 1,
      szczegol: 'źródłem tekstu są też .value inputów, nie tylko innerText',
    },
  );

  // ── Kontrolki detektorów na WĄSKIM viewportcie (1024) ───────────────────────
  // Te same detektory, druga szerokość: dowód, że nie są po cichu zależne od
  // viewportu. Tylko kontrolki niezależne od geometrii (konsola/crimson/enum/błąd).
  probki.push(
    {
      nazwa: '@1024 Błąd konsoli — sztuczny błąd ZŁAPANY na wąskim ekranie',
      ok: B2.bledyKonsoli.some((b) => /SELF-TEST: sztuczny blad/.test(b)),
      szczegol: `przed: ${A2.bledyKonsoli.length}, po: ${B2.bledyKonsoli.length}`,
    },
    {
      nazwa: '@1024 Filtr szumu — favicon 404 ODFILTROWANY na wąskim ekranie',
      ok:
        !B2.bledyKonsoli.some((b) => /favicon/i.test(b)) &&
        B2.bledyKonsoliSurowo > A2.bledyKonsoliSurowo,
      szczegol: `surowo ${A2.bledyKonsoliSurowo} → ${B2.bledyKonsoliSurowo}, po filtrze ${A2.bledyKonsoli.length} → ${B2.bledyKonsoli.length}`,
    },
    {
      nazwa: '@1024 Crimson — wstrzyknięty rgb(133,24,47) podnosi licznik',
      ok: B2.crimson > A2.crimson,
      szczegol: `przed: ${A2.crimson}, po: ${B2.crimson}`,
    },
    {
      nazwa: '@1024 Enum SCREAMING_SNAKE — „STATUS_W_TOKU" ZŁAPANY',
      ok: B2.enumy.some((e) => e.wartosc === 'STATUS_W_TOKU'),
      szczegol: `złapane: ${B2.enumy.map((e) => e.wartosc).join(', ') || '—'}`,
    },
    {
      nazwa: '@1024 Enum slug — „priority-high" ZŁAPANY',
      ok: B2.enumy.some((e) => e.wartosc === 'priority-high'),
      szczegol: `slugów: ${B2.enumy.filter((e) => e.rodzaj === 'slug').length}`,
    },
    {
      nazwa: '@1024 Error-boundary — „Coś poszło nie tak" ZŁAPANE',
      ok: B2.bladNaEkranie === true && A2.bladNaEkranie === false,
      szczegol: `przed: ${A2.bladNaEkranie}, po: ${B2.bladNaEkranie}`,
    },
  );

  let zdane = 0;
  probki.forEach((p) => {
    if (p.ok) zdane++;
    console.log(`${p.ok ? '✔' : '✘'} ${p.nazwa}\n   ${p.szczegol}`);
  });
  console.log(`\nKontrolki: ${zdane}/${probki.length} zdanych.`);
  if (zdane !== probki.length) {
    console.log('★ APARAT NIEZDATNY — nie używaj wyniku do odbioru migracji.');
    process.exit(1);
  }
  console.log('★ Aparat łapie wstrzyknięte defekty — pomiar ma wartość dowodową.');
}

// ═══ POMIAR PEŁNY ════════════════════════════════════════════════════════════
async function pomiarPelny() {
  const przegladarka = await chromium.launch();
  const wyniki = [];
  const katalogZrzutow = path.join(WYJSCIE, 'zrzuty');
  if (ZRZUTY) fs.mkdirSync(katalogZrzutow, { recursive: true });

  for (const [nazwa, ekran] of KARTY) {
    for (const szer of VIEWPORTY) {
      const { wynik, strona, ctx } = await zmierzKarte(przegladarka, ekran, szer);
      if (ZRZUTY && !wynik.blad) {
        await strona.screenshot({
          path: path.join(katalogZrzutow, `${ekran}-${szer}-light.png`),
        });
      }
      await ctx.close();
      wyniki.push({ nazwa, ekran, viewport: szer, ...wynik });
      process.stdout.write('.');
    }
  }
  await przegladarka.close();
  process.stdout.write('\n\n');

  const raport = {
    wygenerowano: new Date().toISOString(),
    baza: BAZA,
    viewporty: VIEWPORTY,
    motyw: 'light',
    karty: KARTY.map(([, e]) => e),
    pomiary: wyniki,
  };

  const jsonPlik = path.join(WYJSCIE, 'karty-n-geometria.json');
  fs.writeFileSync(jsonPlik, JSON.stringify(raport, null, 2), 'utf8');

  const md = zbudujRaportMd(raport);
  const mdPlik = path.join(WYJSCIE, 'karty-n-geometria.md');
  fs.writeFileSync(mdPlik, md, 'utf8');

  console.log(md);
  console.log(`\nZapisano: ${jsonPlik}\n           ${mdPlik}`);
  if (ZRZUTY) console.log(`Zrzuty:   ${katalogZrzutow}`);

  if (POROWNAJ) porownaj(JSON.parse(fs.readFileSync(POROWNAJ, 'utf8')), raport);
}

function pas(p) {
  if (!p) return 'BRAK';
  return `l=${p.l} w=${p.w}${p.podejrzanyKontener ? ' ⚠max-w' : ''}`;
}

function zbudujRaportMd(raport) {
  const l = [];
  l.push('# Geometria 6 kart n-Type — pomiar realnych pasów\n');
  l.push(`Wygenerowano: ${raport.wygenerowano} · baza: ${raport.baza} · motyw: light`);
  l.push(`Viewporty: ${raport.viewporty.join(', ')} px\n`);
  l.push('## Tabela pasów\n');
  l.push(
    '| Karta | VP | Menu 1 | Menu 2 | Sekcje | Lewa naw. | Prawy panel | Wyrównanie L | Sekcji panelu | Konsola | Crimson | Enumy |',
  );
  l.push('|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|');
  for (const p of raport.pomiary) {
    if (p.blad) {
      l.push(`| ${p.nazwa} | ${p.viewport} | ❌ ${p.blad} | | | | | | | | | |`);
      continue;
    }
    const { menu1, menu2, sekcje, lewaNawigacja, prawyPanel } = p.pasy;
    const lewe = [menu1, menu2, sekcje].filter(Boolean).map((x) => x.l);
    const zgodne = lewe.length === 3 && new Set(lewe).size === 1;
    l.push(
      `| ${p.nazwa} | ${p.viewport} | ${pas(menu1)} | ${pas(menu2)} | ${pas(sekcje)} | ${pas(
        lewaNawigacja,
      )} | ${pas(prawyPanel)} | ${zgodne ? `✔ ${lewe[0]}` : `✘ ${lewe.join('/')}`} | ${
        p.liczbaSekcjiPanelu
      } | ${p.bledyKonsoli.length} | ${p.crimson} | ${p.enumy.length} |`,
    );
  }
  l.push('\n## Sekcje prawego panelu (kolejność)\n');
  for (const p of raport.pomiary.filter((x) => x.viewport === 1440 && !x.blad)) {
    l.push(
      `- **${p.nazwa}** (${p.prawyPanelEtykieta ?? 'brak aria-label'}) — ${
        p.sekcjePanelu.length
      }: ${p.sekcjePanelu.join(' · ') || '—'}`,
    );
  }
  const zEnumami = raport.pomiary.filter((p) => (p.enumy || []).length);
  l.push('\n## Surowe enumy w tekście\n');
  if (!zEnumami.length) l.push('Brak.');
  for (const p of zEnumami) {
    l.push(
      `- **${p.nazwa}** @${p.viewport}: ${p.enumy
        .map((e) => `\`${e.wartosc}\` (${e.rodzaj}${e.ile > 1 ? ` ×${e.ile}` : ''})`)
        .join(', ')}`,
    );
  }
  const zBledami = raport.pomiary.filter((p) => (p.bledyKonsoli || []).length || p.bladNaEkranie);
  l.push('\n## Błędy konsoli i error-boundary\n');
  if (!zBledami.length) l.push('Brak (po odfiltrowaniu szumu harnessu).');
  for (const p of zBledami) {
    l.push(
      `- **${p.nazwa}** @${p.viewport}${p.bladNaEkranie ? ' — ★ BŁĄD NA EKRANIE' : ''}: ${
        p.bledyKonsoli.slice(0, 4).join(' | ') || '—'
      }`,
    );
  }
  const zCrimson = raport.pomiary.filter((p) => p.crimson);
  l.push('\n## Crimson\n');
  if (!zCrimson.length) l.push('Zero wystąpień.');
  for (const p of zCrimson) {
    l.push(`- **${p.nazwa}** @${p.viewport}: ${p.crimson} × — ${(p.crimsonPrzyklady || []).join(' · ')}`);
  }
  return l.join('\n');
}

// ═══ PORÓWNANIE Z BASELINE ═══════════════════════════════════════════════════
function porownaj(bazowy, biezacy) {
  console.log('\n\n═══ PORÓWNANIE Z BASELINE ═══\n');
  const klucz = (p) => `${p.ekran}@${p.viewport}`;
  const mapaB = new Map(bazowy.pomiary.map((p) => [klucz(p), p]));
  const regresje = [];
  for (const t of biezacy.pomiary) {
    const b = mapaB.get(klucz(t));
    if (!b) continue;
    const g = (co) => `${t.nazwa} @${t.viewport}: ${co}`;
    if (t.blad && !b.blad) regresje.push(g(`karta przestała się ładować (${t.blad})`));
    if (t.bladNaEkranie && !b.bladNaEkranie) regresje.push(g('NOWY błąd na ekranie'));
    if ((t.bledyKonsoli || []).length > (b.bledyKonsoli || []).length)
      regresje.push(
        g(`błędy konsoli ${b.bledyKonsoli.length} → ${t.bledyKonsoli.length}`),
      );
    if (t.crimson > b.crimson) regresje.push(g(`crimson ${b.crimson} → ${t.crimson}`));
    if ((t.enumy || []).length > (b.enumy || []).length)
      regresje.push(g(`surowe enumy ${b.enumy.length} → ${t.enumy.length}`));
    if (t.liczbaSekcjiPanelu < b.liczbaSekcjiPanelu)
      regresje.push(g(`sekcji panelu ${b.liczbaSekcjiPanelu} → ${t.liczbaSekcjiPanelu}`));
    const brakujace = (b.sekcjePanelu || []).filter((s) => !(t.sekcjePanelu || []).includes(s));
    if (brakujace.length) regresje.push(g(`zniknęły sekcje panelu: ${brakujace.join(', ')}`));
    for (const nazwaPasa of ['menu1', 'menu2', 'sekcje', 'prawyPanel', 'lewaNawigacja']) {
      const pb = (b.pasy || {})[nazwaPasa];
      const pt = (t.pasy || {})[nazwaPasa];
      if (pb && !pt) regresje.push(g(`zniknął pas „${nazwaPasa}"`));
      if (pb && pt && pt.podejrzanyKontener && !pb.podejrzanyKontener)
        regresje.push(g(`pas „${nazwaPasa}" rozwiązał się do kontenera max-w-*`));
    }
    const lewe = ['menu1', 'menu2', 'sekcje']
      .map((k) => (t.pasy || {})[k])
      .filter(Boolean)
      .map((x) => x.l);
    if (lewe.length === 3 && new Set(lewe).size !== 1)
      regresje.push(g(`rozjazd lewych krawędzi Menu1/Menu2/Sekcje: ${lewe.join('/')}`));
  }
  if (!regresje.length) {
    console.log('✔ Brak regresji względem baseline (i lewe krawędzie zgodne w każdej karcie).');
  } else {
    console.log(`✘ Regresji: ${regresje.length}`);
    regresje.forEach((r) => console.log('  - ' + r));
    process.exitCode = 1;
  }
}

if (SELF_TEST) await selfTest();
else await pomiarPelny();
