# Dziennik werdyktów — backlog feedbacku (od 2026-06-10)

Format: data | id | werdykt | dowód/przyczyna źródłowa | akcja.

## Wave 1 — Elkomtech chat core (audyt: forensyka prod DB + audyt kodu Londyn, 2026-06-10)

### f2c9f146 — "język odpowiedzi w Chacie" (EN mimo PL) → STILL-BROKEN → FIXED-ON-LONDYN
- Dowód: run `dcf83490` purpose=`deep_research_synthesis` odpowiedział po angielsku mimo
  `request_json.language='pl'`; wszystkie runy `chat_simple` odpowiadały poprawnie po polsku
  (ścieżka chatu naprawiona już przed 05-18, commit 01db3a879e).
- Przyczyna źródłowa: addon Deep Thinking (`buildDeepThinkingFormatAddon`) z w pełni angielskim
  szablonem sekcji ("Executive Summary"…) doklejany NA KOŃCU system promptu (ai.routes.ts ~3996),
  ZA instrukcją `[LANGUAGE INSTRUCTION]` — model podążał za ostatnim, angielskim wzorcem.
- Fix (Londyn): reguła językowa wewnątrz addonu (deepThinkingOrchestrator.ts, oba warianty) +
  ponowna asercja `languageInstruction` PO addonie (ai.routes.ts).

### 79802ad8 — "Nowa konwersacja wraca do poprzedniej" → STILL-BROKEN (gorzej: cross-org) → FIXED-ON-LONDYN
- Dowód: po przełączeniu org VTS→Elkomtech (07:22) pierwsza wiadomość użytkownika trafiła do
  konwersacji `07578202…` utworzonej 2026-04-27 w org **dbr77**. `switchOrg` robi reload
  zachowując ścieżkę `/chat/<id>`, a `findAccessibleConversation` sprawdzało tylko `user_id`.
- Fix (Londyn, 3 punkty): (1) org-guard w `findAccessibleConversation` (personal path wymaga
  `organization_id = ctx OR IS NULL`), (2) org-scoping listy konwersacji personal, (3) `switchOrg`
  zrzuca deep-link `/chat/<id>` → `/chat`.
- Weryfikacja SQL na danych prod: kontekst elkomtech→0 wierszy, dbr77→1, NULL-org legacy: 0 szt. w całej bazie.

### 5d27c9be — "Chat nie odpowiada w kolejnych konwersacjach" → STILL-BROKEN → FIXED-ON-LONDYN
- Dowód: runy `531ae80a`/`f93d0ba7` COMPLETED z pełnymi polskimi odpowiedziami w
  `ai_chat_runs.output_text`, ale zero wiadomości AI w konwersacjach; ponadto 3 odpowiedzi
  (09:35) zapisane do NAJNOWSZEJ konwersacji `5ee77b06…` — ich `metadata.streamSessionId`
  wskazuje 3 różne konwersacje-źródła.
- Przyczyna źródłowa: `onStreamDone` (UnifiedChatPanel) zapisywał odpowiedź do AKTUALNIE
  aktywnej konwersacji (fix #53cc607e wprowadził odczyt live ze store'a); przy `null` w oknie
  przejścia new-chat odpowiedź była po cichu gubiona.
- Fix (Londyn): cel zapisu = `meta.sessionId` (serwer ustawia `streamSessionId = conversationId`
  źródła, ai.routes.ts:1560), fallback na live-active. Dodatkowo porównanie origin-to-origin
  w gałęzi agent-audit.

### f9fba1e0 — "Tytuły konwersacji / puste konwersacje" → STILL-BROKEN → FIXED-ON-LONDYN
- Dowód: 4 konwersacje "Notification: Skrzynka" utworzone w 3 s (09:35:37–40), jedna z
  0 wiadomości i 0 runów; konwersacje `ab0a650c`/`26aa01d1` na zawsze "New conversation".
- Przyczyny źródłowe: (1) `useOpenChatWithContext.alreadyHasContext` nie może dopasować encji
  bez pól pmoContext (np. 'notification') → każde kliknięcie = nowa konwersacja; (2) auto-tytuł
  odpalał tylko gdy `activeConversationId === conversationId` w momencie zapisu odpowiedzi AI —
  czyli nigdy w scenariuszach z przełączeniem.
- Fix (Londyn): okno reuse 30 s per `entityType:entityId` (+ aktywacja reused konwersacji),
  zdjęcie bramki active z auto-tytułu (dedupe window zostaje).

## Weryfikacja Wave 1
- tsc client + server: 0 błędów w dotkniętych plikach; eslint: 0 błędów (warningi zastane).
- vitest: tests/backend/routes/conversations.routes.test.ts + 3 pliki store — 81/81 pass.
- SQL guard zweryfikowany na prodzie (read-only) na dokładnym przypadku z buga.
- NIE wykonano: żywe repro w przeglądarce multi-org (wymaga deployu na staging) — do smoke-testu
  przy promocji Londyn→prod.

## Wave 2 — context bleed (audyt 2026-06-11: forensyka prod DB + audyt kodu lokalnie)

### 45f9e56c — "Opis złej firmy" (APLIX zamiast DBR77) → NOT-A-BUG (by design) → RESOLVED
- Dowód: konwersacja `0aa72d6b` org=aplix-na, run `56dbd7ba` org=aplix-na, odpowiedź = profil APLIX
  (957 pracowników, fastening systems) — pełna zgodność. Zgłaszający (jan.kowalski@dbr77.com,
  home org=vts) pracował w kontekście APLIX; "moja firma" = aktywny workspace. System działał poprawnie.
- Rekomendacja UX (backlog produktowy): Teresa powinna jawnie nazywać organizację, którą opisuje
  ("Opisuję organizację, w której kontekście pracujesz: APLIX…").
- Odkrycia uboczne: (a) `ai_chat_runs` nie zapisuje snapshotu org-kontekstu (forensyka tylko po
  kolumnie organization_id); (b) `organization_switch_log` gubi przełączenia (luka 04-17→06-09
  zaprzeczona przez wpis from=dbr77 z 06-09) — do osobnego zbadania.

### 4408f355 — "Quick savings miesza wątki" (CRITICAL) → FIXED-PRE-PROD → RESOLVED
- Naprawione 2026-04-18, commit `5d3dc43439`: globalny per-user `recentTopics` (rollup ze
  wszystkich konwersacji i organizacji) usunięty z runtime kontekstu i z renderu promptu
  (AIPipeline.ts ~902 i ~1280). Fix jest NA PRODZIE od deployu 2026-05-18. Zweryfikowane w kodzie.

### 5d9b15f7 — "Dzienny brief pokazuje zadania VTS" → FIXED-PRE-PROD + rezydualna luka → REVIEWED
- Zadania org-scoped w tym samym commicie `5d3dc43439` (na prodzie). Rezydualna luka tej samej
  klasy: zapytanie o powiadomienia w briefie filtrowało tylko po user_id, a `notifications` MA
  organization_id → brief liczył/pokazywał nieprzeczytane powiadomienia z innych org.
  Domknięte na Londynie 2026-06-11 (daily-brief.routes.ts, filtr org z NULL-fallback).
  `calendar_events` nie ma kolumny org (kalendarz osobisty) — bez zmian.

## Statusy
- 4×Elkomtech → REVIEWED (fix na Londynie, czeka na deploy); wpisy w feedback_items_status_history.
- cc7308b0 ([TEST]) → ARCHIVED.
- Wave 2: 45f9e56c → RESOLVED (not-a-bug), 4408f355 → RESOLVED (fix na prodzie), 5d9b15f7 → REVIEWED
  (główny objaw naprawiony na prodzie; rezydualne powiadomienia czekają na deploy).

## Wave 4 — re-weryfikacja kohort kwietniowych (2026-06-11, 4 równoległe audyty kodu + git history)

Metoda: dla każdego zgłoszenia z 04-14→05-26 (zgłoszone na STAREJ wersji prod) audyt bieżącego
kodu na Londynie + `git log -S`/`--since` od daty zgłoszenia. Granica deploy prod = 2026-05-18:
fix z commita PRZED tą datą = już działa na prodzie (RESOLVED); fix PO niej lub mój dzisiejszy =
czeka na deploy (REVIEWED).

### 4A Chat (~25 zgłoszeń) — 22 RESOLVED, 4 REVIEWED, 1 PENDING
- 14 zgłoszeń ma fix z cytowanym ID w kodzie, commity 04-18 (przed prod): historia/foldery/kosz
  (76264853ef, 38d939efc1), załączniki/URL (b8bc523fac, d85b1d70f0), cytaty (d0a8ebbb48), circuit
  breaker (8da124ad8c), język ×5 duplikatów (01db3a879e). Wszystko na prodzie od 05-18.
- BY-DESIGN: 1b81d375 (Aplix nie widzi VTS = izolacja tenantów OK), 1cbe2baa (linki zewn. = web search).
- REVIEWED (po prodzie / smoke): 25dae9b4 TTS neural (30aaa86387, 06-02), 3b6c0287/5dda2701/3f297cfe.
- PENDING: 0eb90842 (usuwanie załącznika) — brak śladu fixa, wymaga repro (inna powierzchnia).

### 4B Superadmin/User Mgmt (9) — 8 RESOLVED, 1 REVIEWED + DWIE REGRESJE NAPRAWIONE
- RESOLVED (fixy 04-18 na prodzie): 406b042a delete (7516a7a256), 76ef6831 move, b8bf4422 impersonate,
  682d4134 block (abf1c6de58), 5e16d214 edit provider, 5e5a86c4 backlog-nav (e08da376a0).
- **KRYTYCZNE ODKRYCIE: merge d675885189 (02-06, PO prodzie) cichcem cofnął 2 kwietniowe fixy na Londynie:**
  - 1e3d749a: walidator `role` zawężony z powrotem do 4-enum → edycja OWNER/MEMBER/... = 400.
  - d11ec6b0: UNION `organization_members` usunięty z getOrganizations/getUsers → APLIX zaniża userów.
  - Na prodzie te bugi NIE występują (fix 04-18 < 05-18). Regresja tylko na Londynie.
  - **Naprawione dziś:** roleTokenSchema (admin.validators.ts) + UNION przywrócony (SuperAdminController.ts,
    zweryfikowane na prod-danych: APLIX 8→10, VTS 150→154, DBR77 27→30) + test regresyjny
    tests/unit/backend/admin.validators.test.ts (23 testy, chroni przed 3. regresją przy mergu).
- REVIEWED: 9e8c29b2 (pasek overflow — flex-wrap jest, wymaga smoke).

### 4C Interview + demo (16) — w toku (osobny wpis)

### 4D i18n/misc (12) — 4 RESOLVED, 2 REVIEWED, 6 do realnej naprawy
- RESOLVED: 08a1263a + 98341e51 (BY-DESIGN: treść szablonów z DB, nie i18n), 81a7751c (Report Bug pill,
  fb899e2702 04-18), 0e1e7dec (HIGH/CRITICAL feedback fire-and-forget, e08da376a0 04-18).
- REVIEWED: ec74ce52 (My Work labelki), 0ab2e845 (Interview Details, canon 9bf0b88369 06-07).
- DO NAPRAWY (kolejka): 160c40be rola globalna vs per-org [NAPRAWIONE dziś, UserProfileMenu.tsx → REVIEWED],
  bb28f382 RTL arabski (brak realnego wsparcia, duży nakład), 5b28d67e zmiana hasła (repro),
  4424011a Improve-with-AI (prawdop. config LLM w env), 8b013c76 scrollbar (repro), 3ccebb2f szablony (dane/seed).

### Odkrycia systemowe Wave 4
- **Merge d675885189 to wzorzec ryzyka:** "evil merge" cofa fixy bez śladu w `git log -S`. Rekomendacja:
  przy promocji Londyn→prod zrobić diff krytycznych walidatorów/kontrolerów vs znane fixy.
- Większość kwietniowych zgłoszeń (zgodnie z [[finding-gap-reports-overstate]]) była już naprawiona —
  realne pozostałości to ~6 z 50 (RTL, hasło, improve-AI, scrollbar, szablony-widoczność, usuwanie załącznika).

## K1 — kohorta marcowa (trial/demo AtelierToys, 19 zgłoszeń, 2026-06-11)

Decydujący commit: **d7c3172bd3** "fix(demo): pasek-limitations cluster" (04-18, na prodzie) zamknął 6 pozycji po ID.
- RESOLVED (na prodzie): 4180b14f/f574311b/b85f5a91/da76799b/34d68475/a26d96f3 (d7c3172bd3),
  00835312 zrzut ekranu (57beb0571a 04-18), a1df8598 (subtitle TERESA istnieje od 03-28 = przed zgłoszeniem; enhancement).
  Uwaga a26d96f3: "chat nie działa mimo 25/25" — limit był faktycznie WYCZERPANY (25/25 użyte), nie bug; dodano suffix+tooltip.
- REVIEWED (po prodzie / smoke per-locale): 49c28040 TTS (30aaa86387 06-02), i18n demo/help/opinie
  (05390fb4, d976d670, 5c51bf6f, 35872745, 6a1354b0, c278caae, 90f0ed29), 8751d7f4 SAC help (06-08).
- IN_PROGRESS: 3d222dcf (panel planu — repro), 2f5803b0 (DATA-ISSUE: demo org AtelierToys bez seedu — akcja operacyjna).

Caveat i18n (z audytu): de/es/ar/jp mają mniej kluczy access.* niż en/pl — wtórne komunikaty mogą wciąż
spadać na EN. Pełny dowód i18n = przejście per-locale (część programu P6). Katalog `public/locales/ja/` to
martwy alias (i18n mapuje ja→jp) — do usunięcia.
