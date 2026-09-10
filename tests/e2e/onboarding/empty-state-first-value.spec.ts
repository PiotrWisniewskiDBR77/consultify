/**
 * P2A — Pusty stan -> pierwsza wartość (koszyk 2 MVP, kryterium 1, S2.2)
 *
 * Świeża organizacja musi umieć dojść od zera do pierwszej wartości bez
 * pytania "gdzie to jest". Ten test rejestruje NOWE konto (nowa organizacja,
 * zero danych) i sprawdza, że sześć modułów robotnika P2A pokazuje:
 *   - tekst pomocy po polsku (co tu będzie / co zrobić),
 *   - co najmniej jedną widoczną akcję prowadzącą do pierwszej wartości.
 *
 * Moduły: Czat/Teresa, Moja Praca, Wywiad, Ocena, Organizacja, Ustawienia.
 * Nie sprawdzamy tu modułów robotnika P2B (Audyty, Inicjatywy, Realizacja,
 * Wyniki, Materiały, Narzędzia, Admin, Partnerzy) — to inny zakres pracy.
 *
 * @module tests/e2e/onboarding/empty-state-first-value.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

function uniqueSuffix() {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e6).toString(36);
  return `${stamp}${rand}`;
}

async function registerFreshOrg(page: Page, tag: string) {
  // Ważne: sufiks musi być unikalny nie tylko w mailu, ale i w nazwie firmy —
  // zmierzone 2026-09-10, backend zwraca 409 przy powtórnej nazwie organizacji
  // nawet gdy e-mail jest nowy (np. dwa uruchomienia testu z tym samym tagiem).
  const suffix = uniqueSuffix();
  const email = `p2a-e2e-${tag}-${suffix}@dbr77.com`;
  await page.goto('/register');
  await page.waitForLoadState('networkidle');

  // Formularz rejestracji nie ma stabilnych data-testid ani powiązanych
  // <label for>, więc identyfikujemy pola po typie/kolejności — tak samo
  // jak zmierzono ręcznie na staging.consultify.ai 2026-09-10.
  const textInputs = page.locator(
    'input[type="text"], input:not([type]), input[type="email"], input[type="tel"], input[type="password"]'
  );

  const firstName = page.locator('input:not([type])').nth(0);
  const lastName = page.locator('input:not([type])').nth(1);
  const emailInput = page.locator('input[type="email"]').first();
  const companyInput = page.locator('input:not([type])').nth(2);
  const passwordInput = page.locator('input[type="password"]').first();

  await expect(textInputs.first()).toBeVisible({ timeout: 15000 });
  await firstName.fill('Piotr');
  await lastName.fill(`E2E${tag}`);
  await emailInput.fill(email);
  await companyInput.fill(`P2A E2E ${tag} ${suffix} Sp. z o.o.`);
  await passwordInput.fill('P2aPuste!2026Wt');

  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.count()) {
    // Zmierzone 2026-09-10: check({force:true}) tuż przed submitem bywa
    // niestabilne (checkbox nie łapie się w stanie React przed kliknięciem
    // przycisku) i rejestracja cicho zostaje na /register. Zwykły klik +
    // krótkie odczekanie jest powtarzalne.
    await termsCheckbox.click();
    await page.waitForTimeout(300);
  }

  // Czekamy na realną odpowiedź /api/auth/register zamiast zgadywać po
  // networkidle — zmierzone 2026-09-10: samo "poczekaj i sprawdź URL" bywa
  // niestabilne pod rząd wykonywanymi rejestracjami i cicho zostawia test
  // na /register bez zgłoszenia błędu w tym miejscu.
  const [response] = await Promise.all([
    page
      .waitForResponse(
        (r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST',
        { timeout: 20000 }
      )
      .catch(() => null),
    page.getByRole('button', { name: 'Create account & start' }).click(),
  ]);
  expect(response?.status(), 'rejestracja (/api/auth/register) musi zwrócić sukces').toBeLessThan(400);

  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await expect(page, 'po rejestracji użytkownik nie może zostać na /register').not.toHaveURL(/\/register/);
  return email;
}

async function dismissOnboardingTour(page: Page) {
  // Świeże konto dostaje modal "Welcome to Consultify" (Step 1 of 3) —
  // zmierzone 2026-09-10, blokuje kliknięcia na spodzie strony (backdrop),
  // dopóki nie zostanie odrzucony.
  const skip = page.getByRole('button', { name: 'Skip for now' });
  if (await skip.count().then((n) => n > 0).catch(() => false)) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(300);
    }
  }
}

async function clickModuleTab(page: Page, name: string) {
  // Zakładki modułu bywają rolą "tab" (np. Wywiad, tablist "Sekcje modułu")
  // albo zwykłym "button" (np. Moja Praca) — zmierzone 2026-09-10. Test klika
  // po widocznym tekście, żeby nie zależeć od tej niespójności.
  await page
    .getByRole('tab', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }))
    .first()
    .click();
}

async function setPolishLanguage(page: Page) {
  await page.goto('/settings/language');
  await page.waitForLoadState('networkidle');
  await dismissOnboardingTour(page);
  const polish = page.getByText('Polski', { exact: true }).first();
  if (await polish.count()) {
    await polish.click();
    await page.waitForTimeout(500);
  }
}

test.describe('P2A — pusty stan -> pierwsza wartość (świeża organizacja)', () => {
  test.describe.configure({ mode: 'serial' });

  // Zmierzone 2026-09-10: globalny storageState (global test-support setup,
  // playwright.config.ts) loguje KAŻDY test domyślnie, więc page.goto('/register')
  // ląduje już zalogowany w aplikacji zamiast na formularzu rejestracji — dokładnie
  // ten sam bug co w tests/e2e/runtime/app-startup-smoke.spec.ts. Resetujemy stan.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('rejestracja świeżej organizacji i przełączenie na polski', async ({ page }) => {
    const email = await registerFreshOrg(page, 'setup');
    expect(email).toContain('@dbr77.com');
    await setPolishLanguage(page);
    await expect(page.getByText('Polski', { exact: true })).toBeVisible();
  });

  test('Czat / Teresa: pierwsze uruchomienie ma tekst i akcję startową', async ({ page }) => {
    await registerFreshOrg(page, 'chat');
    await setPolishLanguage(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    await expect(page.getByPlaceholder('Zapytaj Teresę o swoją pracę...')).toBeVisible();
    // Co najmniej jedna widoczna akcja startowa (chip albo karta możliwości).
    const starter = page.getByRole('button', { name: /Dzienny brief|Analiza rynku/i }).first();
    await expect(starter).toBeVisible();
  });

  test('Moja Praca: zakładka Pomysły ma tekst pomocy i jedną akcję', async ({ page }) => {
    await registerFreshOrg(page, 'mywork');
    await setPolishLanguage(page);
    await page.goto('/my-work');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);
    await clickModuleTab(page, 'Pomysły');

    await expect(page.getByText('Twój ogród pomysłów czeka')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zasiej pomysł' }).first()).toBeVisible();
  });

  // Zmierzone 2026-09-10: src/components/MyWork/DecisionsPanelContent.tsx ma
  // hardkodowany angielski tekst pustego stanu ("No decisions awaiting your
  // action" / "All caught up!") mimo ustawionego jezyka polskiego. Naprawa
  // jest gotowa (t('decisions.noMyDecisions'/...) + klucze pl/en), ale plik
  // jest oznaczony jako ZAMROZONY MVP final (07_MY_WORK_AGENT) i hook
  // commit-msg blokuje zmiane bez numeru decyzji wlasciciela (DEC-<numer>).
  // Test zostaje jako fixme, zeby nie fałszować bramki CI, i jako żywy dowód
  // regresji do odmrożenia po decyzji właściciela.
  test.fixme(
    'Moja Praca: Decyzje pokazują polski tekst, nie angielski fallback',
    async ({ page }) => {
    await registerFreshOrg(page, 'decisions');
    await setPolishLanguage(page);
    await page.goto('/my-work');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);
    await clickModuleTab(page, 'Decyzje');

    // Poczekaj aż panel faktycznie wyrenderuje pusty stan (fetch jest
    // asynchroniczny) — dopiero wtedy sprawdzanie "count 0" ma sens; sprawdzone
    // 2026-09-10, bez tego czekania asercja "brak angielskiego tekstu" mija się
    // z prawdą, bo sprawdza pustą jeszcze stronę.
    const emptyStateHeading = page.getByRole('heading', {
      name: /decisions|decyzj/i,
      level: 3,
    });
    await expect(emptyStateHeading).toBeVisible();

    // Regresja P2A 2026-09-10: ekran pokazywał hardkodowany angielski tekst
    // "No decisions awaiting your action" / "All caught up!" mimo interfejsu
    // po polsku (src/components/MyWork/DecisionsPanelContent.tsx).
    await expect(emptyStateHeading).not.toHaveText('No decisions awaiting your action');
    await expect(page.getByText('All caught up!')).toHaveCount(0);
    await expect(page.getByText(/Brak decyzji|Wszystko na bieżąco/)).toBeVisible();
  });

  test('Wywiad: zakładka Sesje ma tekst pomocy i jedną akcję', async ({ page }) => {
    await registerFreshOrg(page, 'interview');
    await setPolishLanguage(page);
    await page.goto('/interview');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);
    await clickModuleTab(page, 'Sesje');

    await expect(page.getByText('Przeprowadź pierwszy wywiad')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Użyj szablonu' }).first()).toBeVisible();
  });

  test('Ocena: biblioteka metodyk ma akcję Uruchom dla pierwszej wartości', async ({ page }) => {
    await registerFreshOrg(page, 'assessment');
    await setPolishLanguage(page);
    await page.goto('/assessment');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    await expect(page.getByRole('button', { name: 'Uruchom' }).first()).toBeVisible();
  });

  test('Organizacja: profil ma tekst pomocy i akcję dodania źródła', async ({ page }) => {
    await registerFreshOrg(page, 'organization');
    await setPolishLanguage(page);
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    await expect(page.getByText('Uzupełnij profil organizacji, aby Teresa odpowiadała trafniej')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj źródło' })).toBeVisible();
  });

  test('Ustawienia: język ma tekst pomocy i jasny wybór, a przełącznik działa', async ({ page }) => {
    await registerFreshOrg(page, 'settings');
    await page.goto('/settings/language');
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    // Domyślny język świeżego konta to angielski (system nie zna jeszcze
    // preferencji użytkownika) — tekst pomocy i lista wyboru muszą być widoczne
    // niezależnie od tego, zanim ktokolwiek wybierze Polski.
    await expect(
      page.getByText('Select your preferred language for the interface.')
    ).toBeVisible();
    const polish = page.getByText('Polski', { exact: true }).first();
    await expect(polish).toBeVisible();

    // Sama zmiana języka musi zadziałać i utrwalić wybór na tym ekranie.
    await polish.click();
    await expect(page.getByText('Wybierz preferowany język interfejsu.')).toBeVisible();
  });
});
