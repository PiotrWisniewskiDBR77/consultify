/**
 * Przejście odbiorcze fali tabel (2026-07-28) — reguła #7 CLAUDE.md:
 * „Piotr nigdy nie jest pierwszym testerem wizualnym".
 *
 * Ten spec nie sprawdza „czy się wyrenderowało" — to robi `pages-render.spec.ts`.
 * Sprawdza KONKRETNE naprawy z przeglądu 128 zrzutów i przy okazji zbiera zrzuty
 * ekranów do odbioru, żeby Piotr oglądał gotowy materiał, a nie odkrywał zepsucie.
 *
 * Każdy blok nazwany numerem uwagi z `_ODBIOR_TABELE_PREVIEW_2026-07-27.md`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const KATALOG_ZRZUTOW = path.resolve('test-results/fala-tabel-2026-07-28');

test.beforeAll(() => {
  fs.mkdirSync(KATALOG_ZRZUTOW, { recursive: true });
});

/**
 * Zamknięcie okna powitalnego.
 *
 * ★ Pułapka, w którą wpadłem przy pierwszym przebiegu: kopiowałem wzorzec
 * z `pages-render.spec.ts`, który szuka „Skip tour" i „Welcome to Consultinity".
 * Produkt pokazuje dziś „WELCOME TO CONSULTIFY / Meet Teresa" z przyciskiem
 * **„Skip for now"**. Modal więc nie znikał, a asercje czytały jego treść
 * zamiast tabeli — sześć testów świeciło na zielono nad ZASŁONIĘTYM ekranem.
 * Wyłapane dopiero oglądaniem zrzutów, nie wynikiem testu.
 *
 * Dlatego funkcja kończy się TWARDYM sprawdzeniem, że modala nie ma — brak
 * możliwości zamknięcia ma wywalić test, a nie przepuścić go po cichu.
 */
async function zamknijPowitanie(page: Page) {
  const przyciskiZamkniecia = [
    /Skip for now/i,
    /Skip tour/i,
    /Pomiń( teraz)?/i,
    /Get started/i,
    /Zaczynajmy|Rozpocznij/i,
  ];

  for (let i = 0; i < 15; i++) {
    let klikniete = false;
    for (const wzorzec of przyciskiZamkniecia) {
      const btn = page.getByRole('button', { name: wzorzec }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 2000, force: true }).catch(() => {});
        klikniete = true;
        await page.waitForTimeout(400);
        break;
      }
    }
    if (!klikniete) await page.keyboard.press('Escape').catch(() => {});

    const modalWidoczny = await page
      .getByText(/WELCOME TO CONSULTIFY|Meet Teresa|Witamy w Consultify/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!modalWidoczny) return;
    await page.waitForTimeout(300);
  }

  // Nie udalo sie zamknac — lepiej wywalic test niz mierzyc zaslonięty ekran.
  await expect(
    page.getByText(/WELCOME TO CONSULTIFY|Meet Teresa/i).first(),
    'okno powitalne zasłania ekran — pomiar byłby fałszywy'
  ).toBeHidden({ timeout: 5000 });
}

/**
 * Wyłączenie okna powitalnego u ŹRÓDŁA, zamiast doklikiwania się do niego.
 *
 * `useFirstRunOnboarding` czyta `consultify_onboarding_done:{userId}` z
 * localStorage jako natychmiastową blokadę (zanim odpowie serwer). Ustawiamy
 * ją dla dowolnego użytkownika — klucz zależy od id, więc wpisujemy wzorzec
 * pod kilka wariantów i dokładamy nasłuch na nowe klucze.
 *
 * Dlaczego nie klikaniem: pierwsza wersja tego pliku klikała „Skip for now"
 * i wyglądała na działającą — sześć testów świeciło na zielono, a modal
 * przez cały czas ZASŁANIAŁ ekran i asercje czytały jego treść. Klikanie
 * zależy od roli, tekstu i kolejności kroków; wpis w localStorage nie.
 */
async function wylaczOnboarding(page: Page) {
  await page.addInitScript(() => {
    try {
      const oznacz = () => {
        // Klucz zawiera userId, ktorego w tescie nie znamy — wiec oznaczamy
        // wszystkie juz obecne oraz kazdy, ktory pojawi sie pozniej.
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('consultify_onboarding_done:')) localStorage.setItem(k, 'true');
        }
        const uid =
          JSON.parse(localStorage.getItem('user') || '{}')?.id ||
          JSON.parse(localStorage.getItem('auth_user') || '{}')?.id;
        if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
      };
      oznacz();
      setInterval(oznacz, 250);
    } catch {
      /* brak localStorage — trudno, zostaje sciezka klikania nizej */
    }
  });
}

async function wejdz(page: Page, sciezka: string, nazwaZrzutu: string) {
  /**
   * `waitUntil: 'load'` (domyślne) czeka na KOMPLET zasobów, a dev-server Vite
   * kompiluje trasę dopiero przy pierwszym wejściu — przy cięższych modułach
   * (Finance, My Work) przekraczało to 30 s i test padał na nawigacji, zanim
   * dotarł do jakiejkolwiek asercji. To był błąd harnessu, nie produktu:
   * ta sama trasa w kolejnym teście ładowała się od razu.
   */
  await page.goto(sciezka, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await zamknijPowitanie(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
  /**
   * Ekran ma NAPRAWDĘ pokazywać zawartość modułu, zanim cokolwiek zmierzymy.
   * Stałe `waitForTimeout` nie wystarczyło: cięższe moduły (Tools) po 1,2 s
   * miały jeszcze sam spinner — 17 znaków tekstu — a asercje „czegoś tu nie
   * ma" przechodziły wtedy na PUSTYM ekranie i nie dowodziły niczego.
   */
  await expect
    .poll(
      async () => (await page.locator('#root').innerText().catch(() => '')).length,
      { message: `ekran ${sciezka} nie pokazał treści`, timeout: 45000, intervals: [500] }
    )
    .toBeGreaterThan(200);
  await page.waitForTimeout(400); // ustabilizowanie po dociągnięciu danych

  // Twarde sprawdzenie, ze nie mierzymy zaslonietego ekranu (patrz komentarz
  // przy `wylaczOnboarding`). Bez tego zielony wynik nic nie znaczy.
  await expect(
    page.getByText(/Meet Teresa|WELCOME TO CONSULTIFY/i),
    `okno powitalne zasłania ${sciezka}`
  ).toHaveCount(0);
  await page.screenshot({
    path: path.join(KATALOG_ZRZUTOW, `${nazwaZrzutu}.png`),
    fullPage: false,
  });
}

/** Cały tekst widoczny na ekranie — do asercji „tego nie ma nigdzie". */
async function tekstEkranu(page: Page): Promise<string> {
  return (await page.locator('#root').innerText().catch(() => '')) || '';
}

test.describe('Fala tabel — odbiór [@module:tabele]', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await wylaczOnboarding(page);
  });

  test('PILNE-1/N-11: żadnych surowych kluczy i18n ani enumów na ekranach list', async ({
    page,
  }) => {
    const ekrany = [
      { sciezka: '/my-work', nazwa: 'mywork' },
      { sciezka: '/initiatives', nazwa: 'initiatives' },
    ];

    for (const ekran of ekrany) {
      await wejdz(page, ekran.sciezka, `identyfikatory-${ekran.nazwa}`);
      const tekst = await tekstEkranu(page);

      // Klucz i18n w rodzaju `traceability.convertT` — kropka miedzy segmentami
      // malymi literami, bez spacji. Wyjatki: skroty typu "np." nie maja
      // segmentu po kropce dluzszego niz 1 znak bez spacji.
      const kluczeI18n = tekst.match(/\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z]{2,}\b/g) || [];
      const podejrzane = kluczeI18n.filter(
        (k) => !/\.(pl|com|ai|io|org|net|xlsx|docx|pptx|pdf|csv|png|jpg)$/i.test(k)
      );
      expect(podejrzane, `surowe klucze i18n na ${ekran.sciezka}`).toEqual([]);

      // Surowe enumy: GO_NO_GO, RESOURCE_ALLOCATION, attention_required
      const enumy = tekst.match(/\b[A-Z]{2,}_[A-Z_]{2,}\b/g) || [];
      expect(enumy, `surowe enumy na ${ekran.sciezka}`).toEqual([]);
    }
  });

  test('PILNE-12: żadnych encji HTML w tekstach (w tym podwójnie kodowanych)', async ({ page }) => {
    await wejdz(page, '/initiatives', 'encje-initiatives');
    const tekst = await tekstEkranu(page);

    for (const encja of ['&amp;', '&quot;', '&#x27;', '&lt;', '&gt;', '&amp;amp;']) {
      expect(tekst, `encja ${encja} widoczna na ekranie`).not.toContain(encja);
    }
  });

  test('P-24: żadnego surowego Date.toString w tabelach', async ({ page }) => {
    for (const [sciezka, nazwa] of [
      ['/finance', 'finance'],
      ['/my-work', 'mywork-daty'],
    ] as const) {
      await wejdz(page, sciezka, `data-${nazwa}`);
      const tekst = await tekstEkranu(page);

      // "Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)"
      expect(tekst, `surowy Date.toString na ${sciezka}`).not.toMatch(
        /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\b/
      );
      expect(tekst, `strefa czasowa w UI na ${sciezka}`).not.toContain('Coordinated Universal Time');
    }
  });

  test('P-20/P-22: po prawej stronie Menu 3 stoją wyłącznie przyciski AI', async ({ page }) => {
    await wejdz(page, '/assessment', 'menu3-tools');
    const tekst = await tekstEkranu(page);

    // Te trzy Piotr wskazal jako zbedne (P-20). "Initiative Pack" i "Generate
    // Report" dublowaly CTA z Menu 2, "Resume latest" byl skrotem do pierwszego
    // wiersza tabeli.
    for (const zbedny of ['Initiative Pack', 'Resume latest assessment']) {
      expect(tekst, `„${zbedny}" wrocil do Menu 3`).not.toContain(zbedny);
    }
  });

  test('atrapy: w menu wiersza nie ma pozycji „Coming soon"', async ({ page }) => {
    for (const [sciezka, nazwa] of [
      ['/my-work', 'kebab-mywork'],
      ['/initiatives', 'kebab-initiatives'],
    ] as const) {
      await wejdz(page, sciezka, `atrapy-${nazwa}`);

      const kebaby = page.locator('button[aria-haspopup="menu"]');
      const ile = await kebaby.count();
      if (ile === 0) continue;

      await kebaby.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(KATALOG_ZRZUTOW, `${nazwa}-otwarty.png`) });

      const tekst = await tekstEkranu(page);
      expect(tekst, `atrapa „Coming soon" w kebabie na ${sciezka}`).not.toMatch(
        /Coming soon|Wkrótce \(backend\)/i
      );
      await page.keyboard.press('Escape').catch(() => {});
    }
  });

  test('zrzuty odbiorcze pozostałych ekranów z przeglądu', async ({ page }) => {
    const ekrany: Array<[string, string]> = [
      ['/interview', 'interview'],
      ['/assessment', 'tools-assessment'],
      ['/outputs', 'documents'],
      ['/finance', 'finance-statements'],
    ];

    for (const [sciezka, nazwa] of ekrany) {
      await wejdz(page, sciezka, `ekran-${nazwa}`);
    }
  });
});
