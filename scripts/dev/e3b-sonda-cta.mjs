#!/usr/bin/env node
/** E3b — sonda: co robi CTA „Zatwierdź inicjatywę" na inicjatywie BEZ właściciela. */
import { chromium } from 'playwright';

const BAZA = 'http://localhost:3245';
const ID = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const siec = [];
page.on('request', (r) => {
  if (/gate-readiness|\/status|preflight/.test(r.url())) siec.push(`> ${r.method()} ${r.url()}`);
});
page.on('response', (r) => {
  if (/gate-readiness|\/status|preflight/.test(r.url())) siec.push(`< ${r.status()} ${r.url()}`);
});
const toasty = [];
await page.exposeFunction('zapiszToast', (t) => toasty.push(t));

await page.goto(`${BAZA}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', 'audyt@dbr77.local');
await page.fill('input[type="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const raw = window.localStorage.getItem('consultify-storage');
  const p = raw ? JSON.parse(raw) : { state: {}, version: 2 };
  p.state = p.state || {};
  p.state.theme = 'light';
  window.localStorage.setItem('consultify-storage', JSON.stringify(p));
  window.localStorage.setItem('i18nextLng', 'pl');
  const uid = p.state?.currentUser?.id || '';
  if (uid) window.localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
});

await page.goto(`${BAZA}/initiatives?open=${ID}&mode=doc`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

// Obserwator toastów — łapie także te, które znikną przed zrzutem.
await page.evaluate(() => {
  const obs = new MutationObserver((mut) => {
    mut.forEach((m) =>
      Array.from(m.addedNodes).forEach((n) => {
        const t = (n.textContent || '').trim();
        if (t && t.length > 5) window.zapiszToast(t.slice(0, 200));
      })
    );
  });
  obs.observe(document.body, { childList: true, subtree: true });
});

await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) =>
    /^Edycja$/i.test((x.innerText || '').trim())
  );
  b?.click();
});
await page.waitForTimeout(3000);
siec.length = 0;

// Status w panelu WŁAŚCIWOŚCI to natywny <select>; React ignoruje ręczne `.value`,
// więc wybieramy opcję przez sterownik przeglądarki (`selectOption`).
const selekty = await page.$$('select');
let opis = null;
for (const sel of selekty) {
  const ma = await sel.evaluate((s) =>
    Array.from(s.options).some((o) => /Zatwierdź inicjatywę/i.test(o.textContent || ''))
  );
  if (!ma) continue;
  await sel.scrollIntoViewIfNeeded();
  await sel.selectOption({ label: 'Zatwierdź inicjatywę' });
  opis = await sel.evaluate((s) => ({ wartosc: s.value }));
  break;
}
console.log('SELECT STATUSU:', JSON.stringify(opis));
await page.waitForTimeout(3500);
console.log('SIEC po kliknieciu:', JSON.stringify(siec, null, 1));
console.log(
  'TOASTY:',
  JSON.stringify(
    toasty.filter((t) => !/LOCAL @|Przejdź do głównej/.test(t)).slice(0, 8),
    null,
    1
  )
);
await page.screenshot({ path: '/tmp/e3b-sonda-cta.png' });
await browser.close();
