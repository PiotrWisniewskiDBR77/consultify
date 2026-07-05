# WEJŚCIE DO DEMO / „PRZESKOK NA ATELIER" — BRIEF REMONTU (dla agenta budującego)

> **Autor:** partner-CTO, 2026-07-03 · **Na zlecenie Piotra:** wejście musi być **bezpieczne + zachęcające**; dziś robi bałagan (stare ekrany, szum). Cel: Ty przeskakujesz na Atelier jednym ruchem (demo+prod); klient wybiera „wersję demo" i realnie się bawi.
> **Wejście = audyt Fable** (pełna diagnoza w historii sesji). Ten brief = plan wykonawczy.
> **Miara:** bezpieczne (zero wycieku zapisu na realny org), płynne (<1s przeskok Piotra), zachęcające (jeden landing, zero szumu). Synergia z `ATELIER_DEMO_SYSTEM_ELEVATION_PLAN.md`.

## 0. ARCHITEKTURA DOCELOWA — dwa jawne tryby, jeden landing
- **Tryb A „Switch to Atelier" (prezenter / Piotr; demo+prod):** przełączenie kontekstu na **kanoniczny org** (`atelier` / `ateliertoys-demo`) w trybie **read-only prezentera** — bez seedu, bez sesyjnego tenanta, bez TTL, bez tour/upsell. Natychmiastowe (dane już są — elewowane WP-1..7). Landing zawsze na **dashboardzie transformacji Atelier**. Powrót = 1 klik do zapamiętanego URL.
- **Tryb B „Demo version" (klient):** sesyjny tenant (izolacja+interaktywność), ale seed **asynchroniczny**, jeden ekran onboardingu, minimalny szum, MEMBER nie ADMIN.
- **Wspólny kontrakt izolacji:** kontekst demo z nagłówka FE → **claim w krótkoterminowym tokenie sesyjnym (demo JWT)** — WS/SSE/preflight dziedziczą kontekst automatycznie.

## GRUPA 0 — BEZPIECZEŃSTWO (przed wszystkim, blokujące dla Trybu B)
1. **P0** Montaż `demoContextMiddleware`+`demoWriteProtection` PRZED wszystkimi routami API (`index.ts:1066-1077` — `/api/workspaces`, `/api/management-reports`, `/api/public/kb-v8` omijają bramkę). Globalnie, żeby przyszłe pre-gateway routy dziedziczyły ochronę.
2. **P0** Demo-awareness w WS/SSE: `ideaCollabWs.gateway.ts:226` (+ pozostałe gatewaye) biorą `organizationId` z JWT → w demo realtime pisze na REALNYM orgu. Respektować aktywną `demo_sessions`/demo-claim; do czasu fixu — blokada join przy aktywnej sesji demo.
3. **P1** `register-demo` (`auth.routes.ts:1052-1067`): rola **MEMBER** (nie ADMIN), docelowo konto w orgu sesyjnym; nie w kanonie.
4. **P1** `DEMO_WRITES_ENABLED` globalny → **per-sesja** (kolumna w `demo_sessions`).
5. **P1** Preferencja `demo:enabled` **nie-sticky** między logowaniami (koniec cichego re-seedu; usuwa potrzebę hacka FORCE_DEMO_OFF).
6. **P2** Bezpiecznik w `deleteDemoDatasetForOrganization`: `assert(orgId.includes('-session-'))` — nigdy nie skasuje kanonicznego tenanta.
7. **P2** Prod env: ustawić `DEMO_ORG_ID=ateliertoys-demo` (+`DEMO_ORG_NAME`) na Railway prod; usunąć hardkody maili z `AppRoutes.tsx:695-728`, `useDemoSession.ts`.

## GRUPA 1 — TRYB A „Przeskok na Atelier" (use case Piotra; priorytet po Grupie 0)
8. Nowy lekki endpoint `POST /api/demo/presenter` (enter/exit; read-only; kanoniczny org; BEZ seedu) + `presenterMode` w demoSlice.
9. UI: pozycja „Switch to Atelier Toys" w profile menu **i** command palette — dla **wszystkich ról, w tym SUPERADMIN**. Usunąć hardkod `FORCE_DEMO_OFF_EMAIL` i odblokować toggle dla SUPERADMIN.
10. SPA-navigate na dashboard Atelier (NIE `window.location.href` reload, NIE zostawanie na bieżącej ścieżce); powrót do zapamiętanego URL sprzed przeskoku.
11. Dyskretny **chip prezentera** w topbarze („Atelier Toys · Exit"); wyłączyć `DemoSessionManager`/overlaye w trybie prezentera.

## GRUPA 2 — TRYB B wejście klienta
12. **Async provisioning** sesji: `POST /toggle` zwraca `status:'provisioning'` natychmiast; FE `DemoLoadingOverlay` sterowany progresem (lub pre-provisioned pool → <2s). `GET /status` NIGDY nie seeduje.
13. **Ekran powitalny „wybierz scenariusz"** (3 karty z `getAtelierToysDemoScenarios` + „eksploruj") jako JEDYNY onboarding; landing na dashboard Atelier (fix `getDefaultAuthenticatedRoute` dla demo + rozjazd `MarketingLayout.handleModalSuccess`).
14. **Redukcja szumu:** jeden top-chip „Demo · Atelier Toys · Xh · Exit"; kontekstowe CTA konwersji tylko w `demo:value_moment`; usunąć time-based upsell / exit-intent / trial-button z pierwszej fazy.

## GRUPA 3 — HIGIENA
15. Skasować martwe: `DemoBanner.tsx`, `SmartDemoBanner.tsx`, `DemoTopbarStatus.tsx`, `demo-login`, mapowanie `/demo→FREE_ASSESSMENT_CHAT` (`RouterSync.tsx:193,365`, `routeConfig.ts:502`).
16. Ujednolicić zegar sesji: backend `expires_at` = jedyne źródło; wyciąć lokalny 24h zegar + `extendSession` z `useDemoSession`.
17. `cleanupExpiredDemoSessions` → cron/background (koniec kasowania w request-path); zdjąć `authRateLimiter` z `GET /status`.

## PARYTET Z DATASETEM (twarde)
Sesyjny tenant (Tryb B) seeduje się z **`atelierToysDemoTemplate.ts`**, a prezenter (Tryb A) używa **kanonicznego orga**. Oba muszą być bogate → elewacja WP-1..7 MUSI lądować w template, a kanoniczny org seedować z template. Dołożyć test koherencji „template ↔ kanon = parytet".

## DEFINITION OF DONE
- ✅ Tryb A: Piotr (SUPERADMIN) jednym klikiem → dashboard Atelier <1s na demo I prodzie; powrót do poprzedniego URL; zero overlayów.
- ✅ Tryb B: klient → async wejście → ekran scenariuszy → izolowana sesja; zero zapisu na realny org (test: WS join + patch w demo NIE dotyka realnego tenanta).
- ✅ Grupa 0: wszystkie P0/P1 zamknięte, testy izolacji zielone.
- ✅ Zero martwych komponentów demo; jeden zegar sesji.

## DISPATCH (propozycja)
Modele §2b: Grupa 0 (bezpieczeństwo/auth/token) = Opus z bramką Fable na projekcie tokenu izolacji · Grupy 1-2 (UX wejścia) = Opus · Grupa 3 = Haiku/Opus. Worktree per zakres; Grupa 0 przed 1-2 (izolacja tokenu jest fundamentem). NIE na prod bez zgody Piotra (env `DEMO_ORG_ID` na prodzie = jego akcept).
