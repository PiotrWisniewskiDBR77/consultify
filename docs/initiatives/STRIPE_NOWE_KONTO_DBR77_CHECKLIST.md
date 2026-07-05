# Stripe — nowe konto DBR77 dla Consultify (checklista)

> Decyzja Piotra 2026-07-03: zakładamy **nowe, dedykowane konto Stripe pod DBR77**, odchodzimy od konta „Chat" (`acct_1SCdfSE450dsmFZS`, właściciel `krystian.wieczorek@dbr77.com` — były pracownik). Konto „Chat" jest testowe, niezweryfikowane, i wpięte obecnie w demo+prod Consultify.

## Dlaczego nowe (nie przejęcie)
- „Chat" splątany z FizzUp/Chat — nie chcemy płatności dwóch produktów w jednym koncie.
- Właściciel = były pracownik → ryzyko kontroli/ciągłości.
- I tak weryfikacja od zera — przejęcie nic nie skraca.

---

## CZĘŚĆ 1 — robi PIOTR (poświadczenia finansowe + weryfikacja)

### 1.1 Załóż konto
- Wejdź na https://dashboard.stripe.com/register
- **E-mail:** firmowy, nie osobisty i nie byłego pracownika. Rekomendacja: `billing@dbr77.com` (albo `piotr.wisniewski@dbr77.com` jeśli billing@ nie istnieje). To będzie właściciel konta — ma przetrwać rotację ludzi.
- **Kraj:** Polska.
- **Nazwa konta / firma:** DBR77 (pełna nazwa podmiotu, np. „DBR77 Robotics" / właściwa spółka z KRS).

### 1.2 Weryfikacja firmy (Activate payments)
Miej pod ręką:
- Dane spółki: NIP/KRS, adres rejestrowy.
- **Konto bankowe** firmy (IBAN) — na wypłaty.
- Osobę reprezentującą (dane do KYC).
- Nazwę widoczną na wyciągu karty klienta (statement descriptor), np. `CONSULTIFY` / `DBR77 CONSULTIFY`.

### 1.3 Przekaż mi klucze
- **Klucze TESTOWE** (`pk_test_…`, `sk_test_…`) — mogę je wpiąć w Railway sam, albo wpisz je w Railway → Variables (demo + production). Test = zero prawdziwych pieniędzy.
- **Klucz LIVE secret** (`sk_live_…`) — **wpisujesz TY sam** w Railway (produkcja). Poświadczenia finansowego nie wpisuję. Publishable live (`pk_live_…`) mogę ustawić.

---

## CZĘŚĆ 2 — robię JA (technika, po założeniu konta)

1. **Produkty + ceny** na nowym koncie (mam zeskryptowane): Basic/Standard/Premium, multi-waluta EUR+USD (`currency=usd` + `currency_options[eur]`). Osobno dla test i live.
2. **Seed `stripe_price_id`** do `subscription_plans` (demo→test price IDs, prod→live price IDs). Free zostaje NULL.
3. **Podmiana kluczy w Railway:** demo→`sk_test_` nowego konta; prod→`sk_live_` (secret wpisany przez Piotra) + `pk_live_`/`whsec_`.
4. **Webhook:** rejestracja endpointu w nowym koncie (`/api/billing/webhook` + token-purchase), ustawienie `STRIPE_WEBHOOK_SECRET` zgodnie.
5. **Fix drift na prod:** sprawdzić/utworzyć `billing_tax_settings` na centerbeam (migracja 091 prawdopodobnie nie zeszła) — za zgodą Piotra na dotknięcie prod DB.
6. **„EUR dla Europy" na serio:** drobna zmiana kodu (przekazać presentment currency wg regionu w `subscriptions.create`; dziś default USD).
7. **Test E2E** pętli na test-mode (jak dziś: subscribe → obciążenie karty testowej → faktura paid → plan active), potem świadome przełączenie na live.

---

## CZĘŚĆ 3 — sprzątanie po koncie „Chat" (Krystian)

- [ ] Po wpięciu nowego konta: usunąć 3 produkty/ceny Consultify, które dodałem w koncie „Chat" (`price_1TpA3O/3P/3Q…`) — żeby nie zostawiać Consultify w cudzym koncie.
- [ ] Usunąć stare klucze `sk_test_`/`pk_test_` konta „Chat" z Railway (demo+prod) — po podmianie na nowe.
- [ ] **Odciąć dostęp Krystiana** / zabezpieczyć stare konto „Chat" (to sprawa Piotra — konto należy do Krystiana; jeśli trzyma dane FizzUp, Piotr decyduje co z nim).

---

## Stan obecny (2026-07-03)
- Demo Consultify billing DZIAŁA w trybie test **na koncie „Chat" Krystiana** (pętla udowodniona E2E, $20 pobrane testowo). Zostaje tak do czasu wpięcia nowego konta — nie kasuję seedu, żeby demo nie padło.
- Prod: klucze test „Chat", plany bez price_id, billing nieaktywny.
- Bug SQL blokujący każdą subskrypcję na Postgresie: **naprawiony** (`4880a9b04a`), wdrożony.

> Powiązane: `SESSION_HANDOFF_2026-07-03_MASTER.md` §B2 (pełny audyt billingu + 2 bugi).
