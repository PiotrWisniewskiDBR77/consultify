// Jednorazowy skrypt dowodowy: dwa brakujace zrzuty jasnego motywu (Czat,
// Organizacja) dla świeżej organizacji — S2.2 kryterium 1.
//
// DLACZEGO LOKALNIE, NIE NA STAGINGU: logowanie na staging.consultify.ai
// wymagaloby wpisania przechowywanego hasla konta ze
// ~/Developer/consultify-secrets/northwind-konta-STAGING.txt do formularza
// logowania — polityka bezpieczenstwa tej sesji tego zakazuje bez wzgledu na
// upowaznienie w zleceniu. Zamiast tego: LOKALNY realny build tej samej
// galezi (mvp/p17-e2e-20260910), realna swieza organizacja z bootstrapu
// test-support (ZERO hasla — token wydany przez backend, dokladnie ten sam
// mechanizm co w tests/e2e/p2b-empty-state-first-value.spec.ts), wstrzykniecie
// motywu do localStorage PRZED bootem (ten sam wzor co naprawiony
// scripts/dev/p2a-empty-states-capture.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';

const FRONTEND = 'http://127.0.0.1:3138';
const BACKEND = 'http://127.0.0.1:3128';
const TEST_SUPPORT_KEY = 'local-test-support-key-change-me';
const OUT = new URL('../../evidence/p2a-puste-stany-20260910/jasny/', import.meta.url);

async function bootstrapSession(label) {
  const runId = `p2a-jasny-${label}-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`;
  const res = await fetch(`${BACKEND}/api/test-support/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-support-key': TEST_SUPPORT_KEY },
    body: JSON.stringify({ runId, role: 'ADMIN' }),
  });
  if (!res.ok) throw new Error(`bootstrap ${label} -> HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j;
}

async function capture(key, label, path, session) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ token, user }) => {
    try {
      localStorage.setItem('consultify-storage', JSON.stringify({ state: { theme: 'light' }, version: 2 }));
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch {
      // localStorage niedostepny — zostanie motyw domyslny.
    }
  }, {
    token: session.token,
    user: {
      id: session.userId,
      organizationId: session.organizationId,
      role: session.role,
      email: `p2a-jasny-${key}@dbr77.com`,
      name: 'E2E P2A Jasny',
    },
  });
  const page = await context.newPage();
  await page.goto(`${FRONTEND}${path}`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Odrzuc modal onboardingu jesli sie pojawil (blokuje tlo, ale nie samo
  // sprawdzenie motywu — sprzataczka dla czystego zrzutu dowodowego).
  const skip = page.getByRole('button', { name: 'Skip for now' });
  if (await skip.count().then((n) => n > 0).catch(() => false)) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  }

  const applied = await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  if (applied !== 'light') {
    console.log('OSTRZEZENIE', key, `zadany motyw light, zastosowany faktycznie ${applied}`);
  }

  const outPath = new URL(`${key}-light.png`, OUT).pathname;
  await page.screenshot({ path: outPath, fullPage: false });
  const text = await page.locator('main').first().innerText().catch(() => '(brak main)');
  fs.writeFileSync(
    new URL(`${key}-light.txt`, OUT).pathname,
    `URL: ${FRONTEND}${path}\nMotyw zadany: light / zastosowany faktycznie: ${applied}\nSesja: test-support bootstrap (bez hasla), org=${session.organizationId}\n---\n${text}\n`
  );
  console.log('OK', key, 'applied=', applied, '->', outPath);
  await browser.close();
}

const run = async () => {
  const sessionChat = await bootstrapSession('chat');
  await capture('01-czat', 'Czat / Teresa', '/', sessionChat);

  const sessionOrg = await bootstrapSession('org');
  await capture('05-organizacja', 'Organizacja', '/organization', sessionOrg);
};

run().catch((e) => { console.error('BLAD', e); process.exit(1); });
