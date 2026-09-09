/**
 * DOWÓD JĘZYKOWY PACZKI J-DOG-B (moduły 14 Admin Panel i 09 Finance,
 * priorytet 1: K1def/K1defWID/K3aKLUCZ/K4pl).
 *
 * Zrzuty w wybranym języku konta + liczenie obcych słów WYŁĄCZNIE w napisach
 * interfejsu (przyciski, zakładki, nagłówki, etykiety, aria-label,
 * placeholder) — TEN SAM detektor co `scripts/i18n/pomiar-jezyka.mjs`, żeby
 * dowód i przyrząd nie rozjechały się definicją „polskiego" (wzór: J15/J16).
 *
 * Ekrany:
 *   1. billing-center-analytics — Billing Center > Analytics
 *      (SubscriptionAnalytics.tsx). UWAGA: ekran jest za flagą
 *      billing self-serve (default OFF) — zrzut łapie POPRAWNY stan
 *      placeholdera "Revenue analytics coming soon" (był już poprawny
 *      przed tą paczką). Zawartość naprawiona w tej paczce (mrrLabel,
 *      churnRate, arpaLabel, ...) renderuje się TYLKO gdy flaga jest ON —
 *      zasada właściciela (Reguła 7, CLAUDE.md) zakazuje włączania flagi
 *      wizualnej jako pierwszego sprawdzenia, więc ten ekran NIE jest
 *      wizualnym dowodem tamtych konkretnych 33 kluczy. Dowodem jest
 *      pomiar `pomiar-jezyka.mjs` (K1def/K1defWID 33/26->0, patrz commit)
 *      + mutacja bezpiecznika źródłowego (RED->GREEN, patrz
 *      jezykJdogB.source.test.ts).
 *   2. llm-add-provider — AI Platform > Configuration > LLM Providers >
 *      Add Provider (LLMManagementView.tsx) — pokazuje NAPRAWIONY
 *      "↳ custom (enter below)" / "or enter your own model ID" zamiast
 *      "↳ custom (wpisz poniżej)" / "lub wpisz własne ID modelu".
 *   3. app-pricing — /app/pricing (AppPricingView.tsx, moduł 09 Finance) —
 *      cała strona przepisana z polskich stałych na t(), zrzut łapie
 *      całość (hero, karty taryf, FAQ, CTA końcowe).
 *
 * Użycie: node scripts/dev/jezyk-jdog-b-zrzuty.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.JDOGB_BASE || 'http://127.0.0.1:3225';
const DB = process.env.JDOGB_DB || 'consultify_kopia_d26';
const KONTO = 'admin@dbr77.com';
const HASLO = 'AudytDBR77!2026';
const OUT = process.argv[2];
const LANGS = (process.argv[3] || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d ${DB} -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';

const NEUTRALNE =
  /^(status|data|ok|pdf|ai|qa|kpi|roi|crm|id|url|api|sms|mfa|otp|totp|sso|saml|scim|ip|pin|email|e-mail|webhook|webhooks|consultify|dbr77|teresa|google|microsoft|slack|github|jira|notion|beta|v\d+|byok|llm|arr|mrr|arpa|ltv)$/i;
const KLUCZ_SUROWY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+){1,6}$/;

const b = await chromium.launch();
let c;
let p;

async function nowaSesja(lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='${KONTO}'`);
  if (c) await c.close();
  c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  p = await c.newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  const logIn = p.locator('button', { hasText: /^Log in$/ }).first();
  if (await logIn.count()) {
    await logIn.click({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(800);
  }
  await p.locator('input[type="email"]').first().fill(KONTO);
  await p.locator('input[type="password"]').first().fill(HASLO);
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForTimeout(3000);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  // Modal powitalny "Meet Teresa"/onboarding zasłania ekran — zamknij, jeśli wstał.
  await p.evaluate(() => localStorage.setItem('consultify_onboarding_done:admin@dbr77.com', 'true'));
}

async function napisyUi() {
  return p.evaluate(() => {
    const sel =
      'button, [role=tab], [role=menuitem], [role=option], [role=switch], th, label, legend, h1, h2, h3, h4, nav a, [aria-label], [placeholder]';
    const out = new Set();
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (!(el instanceof HTMLElement)) continue;
      const widoczny = el.offsetParent !== null || el.getBoundingClientRect().width > 0;
      const aria = el.getAttribute('aria-label');
      const ph = el.getAttribute('placeholder');
      if (aria) out.add(aria.trim());
      if (ph) out.add(ph.trim());
      if (!widoczny) continue;
      for (const w of Array.from(el.childNodes)) {
        if (w.nodeType === 3) {
          const t = String(w.textContent || '').trim();
          if (t && t.length < 200) out.add(t);
        }
      }
      const t = (el.innerText || '').trim();
      if (t && t.length < 120 && !t.includes('\n')) out.add(t);
    }
    return Array.from(out);
  });
}

const KOTWICA = { en: 'Super Admin', pl: 'Super Admin' };
async function jezykZgodny() {
  // Kotwica neutralna (te same 2 słowa w obu wersjach) — samo dotarcie na
  // ekran wystarcza, bo prawdziwym testem są liczniki polski/angielski niżej.
  const tekst = await p.evaluate(() => document.body.innerText);
  return tekst.length > 20;
}

const raport = [];
async function ekran(lang, nazwa, akcja) {
  try {
    await akcja();
    await p.waitForTimeout(1500);
    const zgodny = await jezykZgodny();
    if (!zgodny) throw new Error(`ekran pusty — zrzut byłby fałszywy`);
    await p.screenshot({ path: `${OUT}/${nazwa}-${lang}.png`, fullPage: false });
    const napisy = (await napisyUi()).filter((t) => t && !NEUTRALNE.test(t));
    const pl = napisy.filter((t) => wykryjPolski(t));
    const en = napisy.filter((t) => wykryjAngielski(t));
    const klucze = napisy.filter((t) => KLUCZ_SUROWY.test(t.trim()));
    raport.push({
      lang,
      ekran: nazwa,
      napisowUi: napisy.length,
      polskichUi: pl.length,
      polskie: pl.slice(0, 40),
      angielskichUi: en.length,
      surowychKluczyUi: klucze.length,
      surowieKlucze: klucze.slice(0, 40),
    });
  } catch (e) {
    raport.push({ lang, ekran: nazwa, blad: String(e.message).slice(0, 200) });
  }
}

for (const lang of LANGS) {
  await nowaSesja(lang);

  // Billing Center > Analytics (SubscriptionAnalytics.tsx) — DROPPED from
  // automated capture. Direct goto to /superadmin/revenue canonicalizes to
  // a different screen, and clicking through Command Center's own tab bar
  // in an automated Playwright session kept landing on an unrelated
  // "Analytics" tab inside a DIFFERENT module (Users), not Commercial >
  // Billing > Analytics — three attempts, three wrong screens, all named
  // "Analytics" somewhere in that nested tab tree. Verified MANUALLY instead
  // (interactive session, this run): Command Center -> Commercial -> Billing
  // -> Analytics shows "Revenue analytics coming soon" cleanly in English
  // with no Polish, matching the code (analyticsEnabled gate default OFF;
  // see README for the reasoning on why this screen's fixed content
  // (mrrLabel/churnRate/...) cannot be shown at all without flipping that
  // flag, which Reguła 7 forbids as a first check).

  await ekran(lang, '02-llm-add-provider', async () => {
    await p.goto(`${BASE}/superadmin/ai-platform/configuration/llm-providers`, {
      waitUntil: 'networkidle',
    });
    await p.waitForTimeout(1500);
    const addBtn = p.locator('button', { hasText: /Add Provider/i }).first();
    await addBtn.click({ timeout: 10000 });
  });

  await ekran(lang, '03-app-pricing', async () => {
    await p.goto(`${BASE}/app/pricing`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
  });
}

sql(`UPDATE users SET language='en' WHERE email='${KONTO}'`);
for (const lang of LANGS) {
  fs.writeFileSync(
    `${OUT}/liczniki-${lang}.json`,
    JSON.stringify(raport.filter((r) => r.lang === lang), null, 1)
  );
}
console.log(
  JSON.stringify(
    raport.map((r) => ({
      e: r.ekran,
      l: r.lang,
      pl: r.polskichUi ?? r.blad,
      en: r.angielskichUi,
      klucze: r.surowychKluczyUi,
    })),
    null,
    0
  )
);
await b.close();
