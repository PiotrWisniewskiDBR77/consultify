# HANDOFF DLA NASTĘPCY — logowania · Stripe · WhatsApp (2026-07-04)

> Zmiana agenta kodującego (kończą się tokeny). Ten dokument = pełny stan trzech wątków enablement + prompt startowy. Wcześniejszy kontekst: `SESSION_HANDOFF_2026-07-03_MASTER.md` (Teresa reasoning-models + OAuth setup) — TEN jest świeższy i nadrzędny dla wątków poniżej.

---

## PROMPT STARTOWY DLA NASTĘPCY (skopiuj jako pierwszą wiadomość)

> Jesteś agentem-CTO Consultify (partner Piotra: product/strategy, nie-koder, komunikacja PO POLSKU, krótko, konkretnie). Przeczytaj `CLAUDE.md`, `MEMORY.md` (auto-pamięć) oraz `docs/initiatives/HANDOFF_NASTEPCA_2026-07-04_LOGOWANIA_STRIPE_WHATSAPP.md` (ten plik) i `docs/initiatives/SESSION_HANDOFF_2026-07-03_MASTER.md`. Trzy wątki enablement: (1) **logowania** — DONE na demo+prod poza żywym klikiem Google na prod; (2) **Stripe** — pętla udowodniona w test-mode, czekamy aż Piotr założy nowe konto DBR77 (checklista `docs/initiatives/STRIPE_NOWE_KONTO_DBR77_CHECKLIST.md`), potem Ty wpinasz; (3) **WhatsApp** — ODŁOŻONE świadomie (uzasadnienie niżej). ZASADY: prod=centerbeam ruszasz TYLKO za jawną zgodą Piotra; demo=trolley (push na gałąź `demo` → auto-deploy ~7 min); `feat/deliverables-w1` = wielu agentów/1 drzewo → przed każdym push `git fetch`+rebase, cudze niezacommitowane zmiany stashuj i przywróć; poświadczeń finansowych (live Stripe secret) i haseł NIE wpisujesz — robi to Piotr. Zacznij od potwierdzenia co Piotr chce pchnąć dalej.

---

## 1. LOGOWANIA — status: ✅ DONE (poza jednym żywym testem)

| Metoda | Demo (demo.consultify.ai / trolley) | Produkcja (consultify.ai / centerbeam) |
|---|---|---|
| E-mail+hasło | ✅ | ✅ (zawsze działał) |
| Google OAuth | ✅ E2E (przeklikane) | ✅ config poprawny (dedyk. projekt GCP „Consultify"); **NIE przeklikany żywo** |
| LinkedIn OAuth | ✅ E2E | ✅ **E2E** (Piotr sam wpisał hasło; wiersz `oauth_links` w centerbeam, user `7f8ef469`) |

**Co zrobione dla prod LinkedIn (ta sesja):** w LinkedIn Developer Portal (apka „Consultify" app_id `256781426`, pod OSOBISTYM kontem Piotra, strona firmowa DBR77 „Not verified") dodany drugi redirect URL `https://consultify.ai/api/auth/linkedin/callback`; Railway prod dostał realne `LINKEDIN_CLIENT_ID=86jcfcnstl4cvu`/`SECRET`/`CALLBACK_URL`; redeploy przez `railway environment production` → `railway redeploy --service consultify -y` (flaga `--environment` NIE działa na redeploy).
**JEDYNE OTWARTE:** żywy klik Google na `consultify.ai` (redirect zweryfikowany, brak `invalid_client`, ale nikt nie zalogował się realnie). Flow identyczny jak LinkedIn — otwórz kartę, Piotr wybiera konto/klika. Meczowanie po `LOWER(email)` do istniejącego usera działa (zero duplikatów), zweryfikowane na obu bazach.

## 2. STRIPE / BILLING — status: 🟡 pętla udowodniona (test), czeka na nowe konto DBR77

**Pełny audyt + 2 bugi + dowód E2E:** patrz `SESSION_HANDOFF_2026-07-03_MASTER.md` §B2 i pamięć `finding_stripe_billing_loop_2026-07-03.md`. Skrót:
- Billing zbudowany (BillingService/webhooki/faktury/dunning/tax/tokenBilling, ~993 ref, frontend) ale **nigdy niepodłączony**: Stripe konto puste, `subscription_plans.stripe_price_id`=NULL, `token_packages`=0.
- **Udowodniono pętlę E2E w test-mode:** `POST /api/billing/subscribe` → Stripe subskrypcja **active, faktura PAID $20** → `organization_billing` zapisane. Setup: 3 produkty+ceny multi-waluta EUR+USD, zseedowane do planów demo.
- **BUG #1 (drift, demo):** brak tabeli `billing_tax_settings` (migracja `091_payment_methods.sql` nie zeszła na trolley) → utworzona ręcznie na demo. **Prod prawdopodobnie ma ten sam gap — sprawdzić przed go-live.**
- **BUG #2 (KOD, dotyka prod, NAPRAWIONY `4880a9b04a`):** `BillingCommandService.upsertOrgBilling` ON CONFLICT miał gołe nazwy kolumn (`stripe_customer_id` itd.) → Postgres „ambiguous" → 500 na KAŻDYM /subscribe. Zakwalifikowane `organization_billing.<col>`. Wdrożone.

### ⚠️ DECYZJA KONTA (Piotr, 2026-07-03): NOWE konto Stripe DBR77
Obecne testowe klucze należą do konta „Chat" (`acct_1SCdfSE450dsmFZS`, właściciel **krystian.wieczorek@dbr77.com — BYŁY pracownik**, Trial, niezweryfikowane). Decyzja: **nowe dedykowane konto pod DBR77**, nie przejmować „Chat" (splątane z FizzUp, kontrola byłego pracownika). **Konto Krystiana / jego dostęp = zajmuje się inna ekipa DBR77, NIE ruszaj.**
**Twoje zadania po założeniu konta przez Piotra** (pełna checklista: `docs/initiatives/STRIPE_NOWE_KONTO_DBR77_CHECKLIST.md`): produkty/ceny na nowym koncie → seed `stripe_price_id` (demo=test, prod=live) → podmiana kluczy Railway → rejestracja webhooka + `STRIPE_WEBHOOK_SECRET` → sprawdzić/utworzyć `billing_tax_settings` na prod (za zgodą) → „EUR dla Europy" wymaga przekazania presentment currency w `subscriptions.create` (dziś default USD) → test E2E test-mode → dopiero potem live. **Live secret key wpisuje PIOTR sam.**

## 3. WHATSAPP — status: ⛔ ODŁOŻONE (rekomendacja CTO, zaakceptowana kierunkowo)

**Co jest:** `WhatsAppService.ts` = **wyłącznie wychodzące alerty dla adminów przez Twilio** (nowy feedback + alerty systemowe → WhatsApp). Zero inbound, zero dwukierunkowości, nie dla klientów.
**Stan (sprawdzony):** konto Twilio „Consultify Alerts", **Trial**, FROM i TO = ten sam numer **+48 668 009 544** (numer Piotra); na **demo brak `WHATSAPP_FROM`** (nieaktywne), na prod komplet. Na Trial WhatsApp działa tylko przez sandbox → obecny FROM (prywatny numer, niezarejestrowany nadawca) **prawdopodobnie nie wysyła**. Env: `WHATSAPP_SID/TOKEN/FROM/TO`, per-env suffix `WHATSAPP_FROM_${APP_ENV}`.
**Dlaczego odłożone:**
- Alerty adminowe **dublują Slacka** (aktywny Slack Command Center już to robi) → marginalna wartość.
- Kanał dla klientów = **duży feature** (Meta WhatsApp Business API + szablony zatwierdzane przez Meta + webhooki inbound do zbudowania + opt-in + okno 24h) i **zablokowany na weryfikacji podmiotu DBR77 w Meta — TEN SAM warunek co Stripe**. Rdzeń Consultify jest ekranowy, nie czatowy → ROI niejasne vs e-mail.
**Kiedy wrócić:** gdy DBR77 będzie zweryfikowane jako podmiot (przy okazji Stripe/Meta) I pojawi się konkretny use-case bijący e-mail/in-app. Wtedy jednym ruchem (weryfikacja DBR77) odblokowuje się Stripe live + WhatsApp Business.

## 4. OPERACYJNE (must-know)
- **Prod = centerbeam** — ruszasz TYLKO za jawną zgodą Piotra [[feedback_prod_caution]]. Demo/staging = trolley (współdzielone). `.env.local` nadpisuje shell URL.
- **Deploy demo:** `git push origin HEAD:demo` → auto-build ~7 min; weryfikuj `gitSha` w `/api/health` zanim testujesz.
- **`feat/deliverables-w1` = wielu agentów/1 drzewo:** przed push `git fetch` + rebase; cudze niezacommitowane zmiany `git stash push -u` przed rebase, `git stash pop` po; sprawdzaj konflikty. HEAD potrafi się ruszyć między commitem a pushem.
- **Skrypty diagnostyczne w env Railway:** `railway run --environment demo --service consultify -- node --import tsx <skrypt.ts>`; w skrypcie `DATABASE_PUBLIC_URL` (BEZ ssl — pg z ssl rzuca „server does not support SSL"). HTTP jako user: mint HS256 JWT (`crypto.createHmac`+`JWT_SECRET`, payload `{id,email,role:'OWNER',organizationId,jti,iat,exp}`, browser-UA).
- **Sprzątaj po testach** (dane demo = twarz produktu): probe'y kasują swoje org-i/klientów Stripe/subskrypcje.
- **W tle leci** konsolidacja `MEMORY.md` (osobna sesja) — indeks urósł ~20KB.

## 5. Commity tej sesji (na feat/deliverables-w1 + demo)
- `4880a9b04a` fix(billing) ambiguous ON CONFLICT (kod, dotyka prod)
- `5ea15e57c1` docs handoff Stripe §B2
- `0e0208b9b1` docs checklista nowego konta Stripe DBR77
- + docs LinkedIn prod domknięty (wcześniej w sesji)
