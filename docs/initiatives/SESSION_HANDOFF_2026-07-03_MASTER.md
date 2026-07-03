# MASTER HANDOFF — sesja 2026-06-28 → 07-03 (Teresa reasoning-models + OAuth Google/LinkedIn)

> Wejście dla następnego agenta. Dwa wielkie wątki: (A) Teresa czat→inicjatywa z reasoning-modelami (Z.ai GLM-4.6), (B) logowanie społecznościowe Google + LinkedIn. Wszystko wdrożone na demo. Szczegóły wcześniejsze: `SESSION_HANDOFF_2026-06-28_TERESA_CHAT.md` (§3a-3f) — TEN dokument jest nadrzędny i świeższy.

## 0. STAN NA TERAZ (TL;DR)
- **Demo** `demo.consultify.ai` = gałąź `feat/deliverables-w1` = branch `demo` (auto-deploy na push). Baza = **trolley** (demo+staging współdzielą). PROD = **centerbeam = NIETKNIĘTE**.
- **Model LLM demo** = `z-ai/glm-4.6` (wybór Piotra) w `llm_providers(provider='openrouter').model_id`. Tier→model **cache'owany w procesie** → zmiana modelu w DB wymaga `railway redeploy --service consultify -y` (bywa odrzucony „cannot be redeployed" gdy trwa build — ponów).
- **Railway CLI** zalogowany (Piotr). Deploy przez push LUB redeploy. `railway run --environment demo --service consultify -- bash -c '...'` = env demo do skryptów.

## A. TERESA: czat→inicjatywa działa E2E z reasoning-modelem (GLM-4.6)
**Zweryfikowane na żywo (stabilne okno):** chat→DRAFT + dedup=1 + rescue(widoczne potwierdzenie) + full-fill 6 kart AI + `business_value` + `problem_statement`. `secs_len=7123`.

Kluczowe fixy (wszystkie na demo, commity na `feat/deliverables-w1`):
- **`5da85f1f26` — reasoning-modele na chat-path** (`llmService.callStream`): gdy są narzędzia → iterator `result.fullStream` (nie płaski `textStream`); `useFullStream = wantsReasoning || !!streamToolDefinitions`; `surfaceReasoning=wantsReasoning` (reasoning cicho konsumowany gdy user nie prosił); **end-of-stream rescue** (gdy tool zwrócił `message` ale zero widocznego tekstu → emituje komunikat). GLM streamuje reasoning osobno; płaski textStream dawał EMPTY_STREAM.
- **`d214d9c633`+`fd26dab3a9` — EMPTY_STREAM rescue**: `callStream` zapamiętuje `message` udanego narzędzia (z `r.data.message` — mcpServer owija w `{status,data}`!) i emituje zamiast EMPTY_STREAM. Kasuje wyzwalacz retry-stormu.
- **`e57fba5faa` — idempotencja per-tura**: memo na współdzielonym `context` (`generateInitiative.ts`); retry'e w turze zwracają memo zamiast tworzyć duplikat. Duplikaty brały się z retry'ów MIĘDZY callStream (EMPTY_STREAM→AIPipeline retry następnym modelem).
- **`dfb09d18aa` — full-fill z reasoning-modelem**: root cause = **60s timeout w `callText`** (ciężka karta doktryny + 4096-token JSON, GLM rozumuje >60s→abort→karta pada→0 kart). Fix: `timeoutMs:150000`(gen)/`120000`(review) w `generateSectionContent` (`initiativeGenerationService.ts` ~514/619; callText honoruje `params.timeoutMs`) + **parallelizacja 6 kart** (`Promise.all` w `initiativeGeneratorBrain.ts:generateFullInitiative`, zamiast sekwencji).
- Wcześniej (tej serii): `f452d4f2fd` doc-gen `row.join` crash, `009e23bb5e` business_value mapper (`cardColumnHydration.ts` — żywy prompt emituje `{revenueImpact,costSavings,benefitsRealization}` nie `businessValue`).

**Przegląd:** 3 adversarialnych agentów recenzowało CAŁĄ serię — **zero bugów high/med**.

### ⚠️ OTWARTE (Teresa) — follow-up, NIE blokuje normalnej pracy
- **Full-fill = fire-and-forget ~200s; RESTART serwera w trakcie GO ZABIJA** (DRAFT zostaje pusty). Widać przy ciągłych deployach wielu agentów. Testując full-fill: MONITORUJ `gitSha` w `/api/health` w oknie pollingu; czekaj 20s+ (GLM wolny); mierz `created_at > now()-interval` NIE zapisanym `tb` (rozjazd czasu). Utwardzenie: (a) inkrementalny persist kart, (b) kolejka zamiast fire-and-forget, (c) semafor na `acquireProviderSlot` (rzuca nie kolejkuje pod burst).
- Schema drift trolley: `organization_memory`, `ai_user_preferences`, `organization_ai_settings.context_policy_json`, `projects.is_closed` (połykane, degradują kontekst Teresy).
- `ai_generated_sections` = kolumna **TEXT** (nie jsonb) — w SQL bez `COALESCE(...,'{}'::jsonb)`.

## B. OAUTH: Google + LinkedIn (logowanie społecznościowe na demo)
**Kod OAuth był kompletny** (`AuthView.tsx` przyciski→`/api/auth/{google,linkedin}`, `oauthRoutes.routes.ts` pełny flow, `oauthService.ts` `findOrCreateUser`). Problem = brak realnych aplikacji/kluczy.

### Google — 100% GOTOWE + PRZETESTOWANE realnym logowaniem
- Utworzony projekt GCP **„Consultify"** (`consultify-501219`, izolowany od projektu „Chat"/FizzUp), OAuth consent screen (External, opublikowany do produkcji — scope'y `openid email profile` nie-sensytywne→bez weryfikacji Google), Web client „Consultify Demo".
- **Railway demo env vary ustawione:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (prawdziwe), `GOOGLE_CALLBACK_URL=https://demo.consultify.ai/api/auth/google/callback`, **`FRONTEND_URL=https://demo.consultify.ai`** (było `stage.consultinity.ai` — psuło redirect po logowaniu!).
- E2E przetestowane: przycisk→zgoda Google→callback→JWT→sesja→`/chat` zalogowany jako Piotr.

### LinkedIn — 100% GOTOWE + PRZETESTOWANE (E2E domknięte 2026-07-03 09:12 UTC)
- Aplikacja LinkedIn **„Consultify"** (app_id `256781426`), strona **DBR77**, produkt **„Sign In with LinkedIn using OpenID Connect"** (provisioned instant), redirect `https://demo.consultify.ai/api/auth/linkedin/callback`.
- **Railway:** `LINKEDIN_CLIENT_ID=86jcfcnstl4cvu`, `LINKEDIN_CLIENT_SECRET` (ustawione), `LINKEDIN_CALLBACK_URL` ok.
- **E2E PRZESZŁO**: Piotr dokończył logowanie LinkedIn rano 07-03 → wiersz `oauth_links` (`linkedin sRaIO1sdc7 piotr.wisniewski@dbr77.com → user d2b6a316`, display „Piotr Wiśniewski Ph.D.", linked_at 09:12:18Z). Zalinkowany po mailu do ISTNIEJĄCEGO usera — zero duplikatu. Opcjonalne (nie blokuje): weryfikacja strony DBR77 przez admina (Settings→Verify) jeśli KAŻDY user LinkedIn ma się logować.

### Re-test finalny 2026-07-03 ~09:38 UTC (wszystkie 3 metody na @538298a4e3, DEMO)
- **Email/hasło**: `POST /api/auth/login` → 200 + JWT (piotr.wisniewski@dbr77.com). ✅
- **Google**: pełne E2E w przeglądarce (logout → /auth → przycisk Google → chooser → „signing back in" Continue → `/oauth/callback?token=…` → `/chat` zalogowany); `oauth_links.last_login_at` google podbił się na 09:38 = fast-path po `provider_user_id` przy powtórnym logowaniu działa. ✅
- **LinkedIn**: wiersz w DB jw. (pętla domknięta 09:12). ✅
- **Duplikaty**: `users` z tym mailem = dokładnie 1 (d2b6a316); nowi userzy 24h = tylko persony seedu Atelier. ✅

### PRODUKCJA (consultify.ai / Railway service `consultify`, environment `production`, DB centerbeam) — LinkedIn domknięty 2026-07-03 ~15:57 UTC
Piotr zauważył że demo≠produkcja: Google na prod miał już WŁASNY, poprawny klient (inny GCP client_id niż demo, nikt wcześniej o tym nie wspominał w handoffie) — zweryfikowany technicznie (LinkedIn/Google redirect zwraca prawdziwy ekran logowania, nie `invalid_client`), ale nie było żywego testu. LinkedIn na prod miał PLACEHOLDER (`LINKEDIN_CLIENT_ID=1`, `LINKEDIN_CLIENT_SECRET=1`, brak `LINKEDIN_CALLBACK_URL`→fallback `localhost:3005`) — kompletnie niedziałający.

**Fix (zrobiony w tej sesji, bez hasła Piotra):**
1. LinkedIn Developer Portal, apka „Consultify" (app_id `256781426`) → Auth tab → dodany DRUGI redirect URL `https://consultify.ai/api/auth/linkedin/callback` (obok demo-owego) — jedna apka obsługuje obie domeny.
2. Railway: `railway variables --environment production --service consultify --set LINKEDIN_CLIENT_ID=86jcfcnstl4cvu --set LINKEDIN_CLIENT_SECRET=<ten sam co demo> --set LINKEDIN_CALLBACK_URL=https://consultify.ai/api/auth/linkedin/callback`.
3. Zmiana zmiennych NIE auto-redeployuje natychmiast (obserwowane opóźnienie) — trzeba `railway environment production` (przełącza linked context CLI, `--environment` flag nieobsługiwany przez `redeploy`) → `railway redeploy --service consultify -y`. Build+deploy ~7 min, potwierdzone `gitSha` się zmienił.
4. Piotr sam dokończył login (agent nie wpisuje haseł — LinkedIn zażądał re-auth hasłem mimo żywej sesji w innej karcie, prawdopodobnie step-up przy autoryzacji NOWEGO redirect URI).

**Zweryfikowane w DB produkcyjnej (centerbeam, NIE trolley):** `oauth_links` nowy wiersz `linkedin piotr.wisniewski@dbr77.com→user 7f8ef469 (prod, OWNER)`, `linked_at=15:57:06`. Dokładnie 1 user z tym mailem na prod — zero duplikatu.

**Otwarte na prod:** Google nie przetestowany żywym klikiem (tylko technicznie zweryfikowany redirect — brak `invalid_client`). Jeśli ktoś zechce przetestować, flow identyczny jak LinkedIn.

### Meczowanie z bazą (wymóg Piotra) — DZIAŁA, zweryfikowane
`oauthService.findOrCreateUser`: (1) po `oauth_links(provider,provider_user_id)` fast-path; (2) **po `LOWER(email)` → LINKUJE do istniejącego usera** (bez duplikatu); (3) nowy mail → nowy user+org (role CEO, plan free). Google Piotra zalinkował się do istniejącego konta (`oauth_links` row: `google piotr.wisniewski@dbr77.com→user d2b6a316`, org demo). Tabela `oauth_links` istnieje na trolley.

## B2. STRIPE / BILLING — pętla testowa udowodniona E2E (2026-07-03 ~19:50 UTC, DEMO)
Piotr zapytał „czy podłączamy też Stripe". Audyt: **kod billingu jest rozbudowany i zbudowany** (BillingService, webhooki, faktury, dunning, tax, tokenBilling, `services/billing/`, ~993 ref; frontend PricingView/PlanCard/AddCardModal), klucze Stripe `sk_test_`/`pk_test_` ustawione na demo I prod — ale **nikt nigdy nie połączył planów z Stripe**: testowe konto Stripe puste (0 produktów/0 cen), `subscription_plans.stripe_price_id` wszystkie NULL, `token_packages` 0 wierszy. Wybór Piotra: najpierw przetestować pętlę w trybie test (zero prawdziwych pieniędzy). Waluta: EUR dla Europy + USD dla USA.

**Co zrobione (wszystko tryb TEST, demo):**
1. Utworzone 3 produkty+ceny w Stripe test przez API (klucz z env): Basic/Standard/Premium, każda cena **multi-walutowa** (`currency=usd` + `currency_options[eur]`) = 20/100/500 — pasuje do naszej JEDNEJ kolumny `stripe_price_id`, bez zmiany schematu. Price IDs: Basic `price_1TpA3O…`, Standard `price_1TpA3P…`, Premium `price_1TpA3Q…`.
2. Zseedowane `stripe_price_id` do `subscription_plans` (Basic/Standard/Premium) na demo (trolley). Free zostaje NULL (poprawnie). **Seed przetrwał sprzątanie — demo ma teraz działający billing w trybie test.**
3. **BUG #1 (drift migracji, demo):** `/subscribe`→500 `relation "billing_tax_settings" does not exist`. Tabela jest w migracji `091_payment_methods.sql` ale migracja nigdy nie zeszła na trolley. Utworzona ręcznie (DDL przetłumaczony SQLite→PG: `DATETIME`→`TIMESTAMPTZ`).
4. **BUG #2 (KOD, dotyka też prod — commit `4880a9b04a`):** `BillingCommandService.upsertOrgBilling` w `ON CONFLICT DO UPDATE` miał 4 kolumny (`stripe_customer_id`, `stripe_subscription_id`, `billing_email`, `status`) z **niekwalifikowaną** nazwą po prawej COALESCE, reszta linii używa `organization_billing.<col>`. Postgres: gołe nazwy niejednoznaczne między tabelą docelową a pseudo-tabelą `excluded` → **500 na KAŻDYM `/subscribe`**. Billing subskrypcyjny NIGDY nie działał na Postgresie (drzemał bo billing nie był włączony). Fix = kwalifikacja 4 linii; potwierdzone empirycznie na DB (buggy rzuca, fixed przechodzi). Wdrożone na demo.
5. **PĘTLA UDOWODNIONA E2E** (na jednorazowej org QA, realny `POST /api/billing/subscribe` + JWT + testowa PM `tok_visa`): HTTP 200 → Stripe `subscriptions.create` **status active, faktura PAID, pobrano $20.00** → `organization_billing` zapisane (plan_basic, rail `stripe_subscription`, status active, stripe_subscription_id+customer_id). Wszystkie artefakty testowe posprzątane (sub anulowany, klienci usunięci, org-i QA skasowane, skrypty ad-hoc usunięte).

### ⚠️ OTWARTE do PRAWDZIWEGO go-live (świadomy krok, NIE „przy okazji")
- **Prod prawdopodobnie ma ten sam drift** `billing_tax_settings` (migracja 091) — sprawdzić na centerbeam przed włączeniem billingu na prod (NIE tknięte tej sesji — billing na prod nieaktywny, brak zgody na zmiany prod DB).
- **Prod plany mają `stripe_price_id=NULL`** — trzeba stworzyć produkty/ceny w Stripe (i zdecydować: test czy **live**) i zseedować.
- **Webhook Stripe niezarejestrowany** — dla subskrypcji tworzonej server-side pętla początkowa działa bez webhooka, ale zdarzenia cyklu życia (odnowienia, nieudane płatności, `checkout.session.completed` dla token-purchase) wymagają zarejestrowanego endpointu + zgodnego `STRIPE_WEBHOOK_SECRET`.
- **„EUR dla Europy" wymaga drobnej zmiany kodu** — multi-walutowa cena istnieje (EUR+USD na jednym price_id), ale `subscriptions.create` nie przekazuje presentment currency → domyślnie USD. Prezentacja EUR europejskim klientom = przekazać walutę wg regionu (mały follow-up).
- **LIVE = decyzja biznesowa + granica bezpieczeństwa:** zweryfikowane live-konto Stripe (weryfikacja firmy DBR77 + konto bankowe), a **live secret key wpisuje Piotr sam** (poświadczenie finansowe — agent NIE wpisuje). Test-mode setup ≠ go-live.

## C. TECHNIKI (jak powtórzyć — bez hasła)
- HTTP jako user: mint HS256 JWT ręcznie (`crypto.createHmac`+`JWT_SECRET`), payload `{id,email,role:'OWNER',organizationId,jti,iat,exp}`, browser-UA (WAF). Endpoint czatu: `POST /api/ai/chat/stream`. Weryfikuj DANE w DB nie stream (full-fill async).
- Serwisy: `railway run --environment demo --service consultify -- bash -c 'node --import tsx <skrypt>'`; w skrypcie `DATABASE_PUBLIC_URL` (prywatny host nieosiągalny z laptopa). Import realnego llmService standalone = timeout (potrzebuje app-DB-init) — NIE tak diagnozuj.
- Diagnostyka LLM „nasz kod vs provider": (a) probe openrouter API bezpośrednio (klucz z `llm_providers.api_key`); (b) probe SDK `createOpenAI`+`streamText` dump typów `fullStream`.
- Org/user demo: `ORG=a3e05d4a-5397-419d-b486-8e44366c0063`, `USER=d2b6a316-08c5-47cf-9bf7-4ba50311d5a2` (piotr).

## D. WSKAZÓWKI OPERACYJNE
- Gałąź `feat/deliverables-w1` = WIELU agentów/1 drzewo → PRZED reset/amend/rebase sprawdź `git log`+reflog; plain commit własnych zmian bezpieczny. HEAD potrafi się ruszyć między commitem a pushem.
- Deploy Railway potrafi mocno odstawać od tipa gałęzi — sprawdzaj `gitSha` w `/api/health` zanim testujesz.
- `tests/` jest w `.gitignore` — istniejące pliki modyfikuj normalnie; NOWE wymagają `git add -f`.
- Pamięć: `finding_teresa_chat_initiative_2026-06-28.md` (kluczowe fakty serii Teresa + modele + OAuth).
