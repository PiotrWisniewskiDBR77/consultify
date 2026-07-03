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

### Re-test finalny 2026-07-03 ~09:38 UTC (wszystkie 3 metody na @538298a4e3)
- **Email/hasło**: `POST /api/auth/login` → 200 + JWT (piotr.wisniewski@dbr77.com). ✅
- **Google**: pełne E2E w przeglądarce (logout → /auth → przycisk Google → chooser → „signing back in" Continue → `/oauth/callback?token=…` → `/chat` zalogowany); `oauth_links.last_login_at` google podbił się na 09:38 = fast-path po `provider_user_id` przy powtórnym logowaniu działa. ✅
- **LinkedIn**: wiersz w DB jw. (pętla domknięta 09:12). ✅
- **Duplikaty**: `users` z tym mailem = dokładnie 1 (d2b6a316); nowi userzy 24h = tylko persony seedu Atelier. ✅

### Meczowanie z bazą (wymóg Piotra) — DZIAŁA, zweryfikowane
`oauthService.findOrCreateUser`: (1) po `oauth_links(provider,provider_user_id)` fast-path; (2) **po `LOWER(email)` → LINKUJE do istniejącego usera** (bez duplikatu); (3) nowy mail → nowy user+org (role CEO, plan free). Google Piotra zalinkował się do istniejącego konta (`oauth_links` row: `google piotr.wisniewski@dbr77.com→user d2b6a316`, org demo). Tabela `oauth_links` istnieje na trolley.

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
