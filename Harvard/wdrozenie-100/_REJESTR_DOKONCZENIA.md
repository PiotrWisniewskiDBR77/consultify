# _REJESTR_DOKONCZENIA — ŻYWY rejestr 258 pozycji fazy (SSOT)

> **To jest JEDYNE miejsce statusów domknięcia fazy.** Artefakty HTML (inwentarz v3
> `5395f8ac`, scorecard `1e796cdb`) to widoki-snapshoty; ten plik jest prawdą.
> Utworzony 2026-07-18 z inwentarza v3 (po panelu 3 sceptyków + uzgodnieniu pełnych
> list: _PROJEKT_A(62) · HP(28) · _PROJEKT_C(70) · _PROJEKT_B_VEGAS+V7(56) · przekroje(42)).

## PROTOKÓŁ (jak dojeżdżamy do końca bez utraty kontekstu)

1. **JEDEN REJESTR.** Każda sesja robocza (moja lub Piotra) ZACZYNA od tego pliku i KOŃCZY
   jego aktualizacją. Zero statusów w głowach/czatach/innych plikach.
2. **STAŁE ID.** Pozycje mają niezmienne ID (H1.4, HP-8, O4.6, F2-F5, T-5, K-3…).
   W commitach/handoffach odwołujemy się TYLKO przez ID.
3. **DoD = 3 osie + DOWÓD.** Pozycja przechodzi na ✅ wyłącznie z dowodem wpisanym w wiersz:
   SHA commita / plik testu E2E / link zrzutu-galerii / data+treść decyzji Piotra.
   „Zamknięte bez dowodu" nie istnieje (złota reguła: runtime, nie deklaracja).
4. **STANY:** ✅ zamknięte(z dowodem) · 🟡 zbudowane-bez-dowodu/odbioru · ⬜ otwarte ·
   🔵 poza-v1 (WYMAGA wpisanej decyzji Piotra — inaczej to ⬜) · ❓ do-weryfikacji.
5. **RYTM:** (a) moje fale (floty; pętla zmierz→napraw→deploy→re-test→bramki tsc/E2E/hooki)
   → po KAŻDEJ fali: update rejestru + commit razem z falą na demo (git = historia diffów);
   (b) sesje Piotra BATCHED z przygotowanym materiałem: SESJA#1 = promptbook Oxford +
   decyzje ZAKRES/OXFORD/VEGAS + galerie; SESJA#2 = ENFORCE/SPRZĄT/OPS + B-checklisty + M27;
   (c) kalendarz twardy: ELKOMTECH ≤03.08 · audyt ISO 04.08 · cert ~10.08.
6. **ANTY-DRYF:** po każdych ~50 zamkniętych pozycjach → panel sceptyków NA REJESTRZE
   (fakty/kompletność/wykonalność); status obalony wraca do ⬜ z notatką.
7. **META KOŃCA (definicja „dojechaliśmy"):** 258/258 w stanie ✅ albo 🔵-z-decyzją,
   zero 🟡/⬜/❓ → finalny panel sceptyków potwierdza → Piotr podpisuje rejestr
   (sekcja PODPIS na dole) → faza ZAMKNIĘTA. Dopiero potem pełny Vegas-finał wizualny
   jest odhaczany tym samym trybem (jest częścią rejestru: sekcja V).
8. **OCHRONA KONTEKSTU:** rejestr commitowany na `demo` przy każdej fali (git-trwały),
   wskaźnik w MEMORY.md, handoff po każdej sesji odwołuje się do ID. Nowa sesja Claude
   = przeczytaj nagłówek + LICZNIKI + sekcję nad którą pracuje.

## LICZNIKI (aktualizuj przy każdej zmianie; stan 2026-07-19 po W9)

| Sekcja | ✅ | 🟡 | ⬜ | 🔵 | ❓ | RAZEM |
|---|---|---|---|---|---|---|
| A · Harvard (H1-H6) | 55 | 3 | 2 | 1 | 1 | 62 |
| B · Harvey (HP-0…27) | 22 | 4 | 2 | 0 | 0 | 28 |
| C · Oxford (O1-O8) | 36 | 23 | 11 | 0 | 0 | 70 |
| D · Vegas (F0-F6+V7) | 12 | 18 | 22 | 3 | 1 | 56 |
| E · Przekroje (+nowe) | 50 | 5 | 24 | 7 | 2 | 88 |
| **SUMA** | **175** | **53** | **61** | **11** | **4** | **304** |

**Postęp: 186/304 rozstrzygnięte (61%).** Start sesji 2026-07-19: 120/265 (45%). ✅ Oxford = dowód kod+E2E; wizualny odbiór Piotra (Vegas/SESJA#1) = osobna oś. (RAZEM 299→304: +5 nowych RED z sweepu cichych degradacji.) **DECYZJE 07-19 (druga sesja): 14 decyzji 🔵/⬜DEC rozstrzygnięte przez Piotra — K1-K8 domknięte; +3 rozstrzygnięte (K1/K2/K6→✅), K3/K4/K5/K7 = decyzja✅+wykonanie🟡; Oxford 4 wiersze 🔵→✅. Blok ↓.**

### ★ DECYZJE 2026-07-19 (druga sesja taryfowa) — 14 decyzji 🔵/⬜DEC rozstrzygniętych przez Piotra (dowód: rozmowa robocza 07-19, materiał `_SESJA1_ODBIOR_OXFORD.md §3`)
**DoD decyzji = decyzja Piotra wpisana. Kanon §5 K1-K8 domknięte.**
- **K1 — DRD Kanon P1-P5 → ✅.** P1 radar 8 wymiarów = wariant „uczciwy pomiarowo" teraz, „Strategia"→kanon 2.0 · P2 „Digital Frontrunner DRD" jako marka = TAK (cel aspiracyjny + narracja sprzedażowa) · P3 benchmark branżowy = publikować OD RAZU z adnotacją „hipoteza ekspercka" · P4 branding = „DRD by DBR77" okładka, Consultify stopka · P5 nazwa = „Diagnostic". → wpisać do `docs/product/DRD_CANON.md §12`.
- **K2 — CONCLUSION_LAYER_STANDARD → ✅** (potwierdzone; już wdrożone 3 powierzchniami). Oxford wiersz O2.1 🔵→✅.
- **K3 — ~39 śmieci-artefaktów → ✅ decyzja: USUŃ FIZYCZNIE** (dane demo, nie prod). Wykonanie = 🟡 (partia destrukcyjna na demo: backup→dry-run lista→OK Piotra→delete; dowód=SHA). Lista ID: `_KARTY_SESJI/DOWODY_SESJA1.md`.
- **K4 — sekcje inicjatywy bez AI → ✅ decyzja: AI-UZUPEŁNIENIE UNIWERSALNIE.** Piotr: KAŻDA z 19 sekcji dostaje własny przycisk „uzupełnij AI" (też Tasks/Comments/Attachments/Activity Log). Nie wyjątki — doktryna. Wykonanie = 🟡 (wiring ~10 sekcji dziś bez promptu → robota mechaniki, delegacja Sonnet/Opus).
- **K5 — „SWOT ×3 / PPTX ×3" → ✅ doprecyzowane: 3 POZIOMY (krótka/średnia/pełna)** tego samego SWOT i tej samej prezentacji. Wykonanie = 🟡 (generacja 3 poziomów).
- **K6 — publikacja profili branżowych O6.1 → ✅** = ta sama decyzja co P3: publikować teraz z adnotacją „expert-hypothesis-v1, kalibracja od n≥10".
- **K7 — 179 osieroconych org → ✅ decyzja: ZACHOWAJ REALNE, KASUJ 179 KLONÓW** „Atelier Toys"/`demo-org-session-*` (rezydua probe'ów QA, [[finding_179_orphan_atelier_toys_orgs_2026-07-12]]). Reguła zachowania = wszystko co NIE `demo-org-session-*` (realny `atelier`, DBR77, org-i nazwane). Wykonanie = 🟡 (partia destrukcyjna z kaskadą FK: backup→dry-run+licznik→OK Piotra→delete).
- **K8 — PROD nietykalny bez zgody (D-G) → 🔵 zasada stała** (bez zmian).
- **6 martwych `build<Tool>DeepenPrompt` → ✅ decyzja: USUŃ** (0 callerów, mechanizm pokryty `deepeningLadder.ts`; czysty dług — JA robi bez pytania). Oxford wiersz O3 🔵→✅.
- **O7.1 CARD_CONTENT_FORMULA → ✅** (potwierdzone twarda-brama, już `353fca6bb2`). Oxford wiersz O7 🔵→✅.
- **Licznik:** C · Oxford 🔵 3→0 (+3 ✅). E · Przekroje ⬜ 7→ (K1/K2/K6 +3✅, K3/K4/K5/K7 +4🟡). SUMA rozstrzygnięte 183→186 (61%). RAZEM 304 bez zmian.
- **NOWA ROBOTA WYKONAWCZA ze zdecydowanych (⬜/🟡 do zjazdu falami):** K3-exec (kasacja śmieci demo) · K4-wiring (AI-fill 10 sekcji) · K5-gen (3 poziomy SWOT/PPTX) · K7-exec (kasacja 179 org) · martwe-buildDeepen-rm (JA cleanup).

### FALA-W9 (2026-07-19, deploy 38eda846ab, demo-safe-2026-07-19) — 3 gałęzie, bramki zielone (server tsc 146/204 0-nowych, kolory/artefakt PASS, eslint 0, boot 4/4) — DOMKNIĘCIE KODOWALNEGO OGONA
- **★ sweep cichych degradacji** — smoking gun: `DbPromise fallback=true` łyka 42703 (`does not exist`) BEZ logu → panel pusty bez alarmu (gorsze niż 500). **8 realnych user-facing bugów naprawionych**: `task_dependencies` predecessor/successor→from/to (graf/Gantt), `users.full_name`×4 (AI-analytics/feedback/quality), `projects.progress/end_date` (500), zespół projektu, report-builder, `initiative_kpis.latest_value`→fałszywe 404 „KPI not found". Dowód niepustych danych na parity. `38bec1bdb2`.
- **fail-soft batch6** — 42 handlery/13 plików; **gołych `500 {err.message}`: 166→1** (kampania H6.4 domknięta; ostatni = ai.routes.ts:8696, plik ~8800 linii, osobny). 18/18 unit. `032515b9a6`.
- **red-final** — ostatni sweep rewirów (work-canvas/meeting/user-settings/org-context/onboarding, ~90 endpointów): **REWIR CZYSTY, zero schema-500** = potwierdzenie utwardzenia. 1 finding: `/api/user/ai-preferences` lazy-wrapper→martwy import (rodzina 46, 🔵). `d5a5cc32a2`.

### ★ NOWE RED (⬜/🔵 — z sweepu cichych degradacji, bogata lista z dowodem parity):
- **Semantyczne (decyzja/schemat):** `raid_items.severity`+project_id→initiative_id (triggery ryzyka) · `tasks.sla_due_at`→due_date · `invoices.amount`→amount_due/paid · `initiative_status_history.changed_at`→created_at · billing seat/dunning kolumny.
- **Migracja-braku (addytywna):** `organizations` dunning/tax kolumny · `admin_sessions` (5 vs 11 kol.) · `email_templates` (~8) · connectors/partner_certifications/gdpr_requests/permission_requests/security_events/user_sessions/login_history.
- **Martwy kod (nie montowany, łudząco podobny):** top-level `ai-operations/ai-feedback/ai-analytics.routes.ts` · `AuditService.getRecordHistory/getTableActivityFeed` · `tierAutoAssignmentJob`.
- **Systemowe do DECYZJI:** `DbPromise fallback=true` maskuje KAŻDY schema-500→cichy 404/pustka (rozważ fail-loud w dev, żeby przyszłe drify były widoczne).
- rodzina 46 lazy-wrapperów / 42 self-import (`/api/user/ai-preferences` crashuje) — decyzja Piotra.

**★ META SESJI 2026-07-19 (10 deployów, 45%→60%):** silniki Harvard/Harvey/Oxford dowiedzione E2E · ~58 realnych 500/cichych-degradacji naprawionych (10 rewirów przemieciono, ostatnie CZYSTE) · długi systemowe domknięte (adaptQuery, 657 aliasów, B13 baseline_gap, axis_data guard) · Oxford proof-sweep O1/O2/O4/O7/O8 · decyzje O2.1/O7.1 · fail-soft 166→1. **Kodowalny backlog wyczerpany.** Handoff: `_HANDOFF_2026-07-19_PRZESIADKA_TARYFA.md`. Dalej = SESJA#1 (Piotr, `_SESJA1_ODBIOR_OXFORD.md`) · Vegas · decyzje 🔵 · chipy.

### FALA-W8 (2026-07-19, deploy 8d1edda57e, demo-safe-2026-07-19) — 7 gałęzi + B13-deploy-osobny, bramki zielone (server tsc 146/204 0-nowych, FE tc 0, kolory/artefakt PASS, eslint 0, boot 4/4)
**★ Decyzje Piotra 2026-07-19 zaksięgowane:**
- **O2.1 CONCLUSION_LAYER_STANDARD v1.0** 🔵→✅ — ZATWIERDZONY jako obowiązujący (już wdrożony 3 powierzchniami). Klaster O2 domknięty.
- **O7.1 CARD_CONTENT_FORMULA** 🔵→✅ — decyzja: TWARDA BRAMA. Wpięta z podwójnym zaworem: blokuje TYLKO wąską listę „pusta/placeholder" (KPI/hipoteza/lang zostają doradcze), env-flag `CARD_CONTENT_HARD_GATE` default ON + fail-open gdy walidator rzuca (zepsuty walidator NIGDY nie wywala lejka). 7/7 E2E. `353fca6bb2`.
- **B13 baseline_gap** — WDROŻONE OSOBNO (`248eeb220a`, boot 6/6 po pełnym build-window, no-op na demo=TROLLEY). Dług migracyjny fresh-env domknięty. `25c4d8655d`.
- Następny duży krok: **SESJA#1** — materiały gotowe: `_SESJA1_ODBIOR_OXFORD.md` (promptbook O1 6 dowodów + tabela ~70 pozycji Oxford + 10 decyzji z rekomendacjami + wizualne-vs-silnik + checklist 2-3h). `ba3fb44bc5`.

**★ Kodowalny ogon (RED/hardening) — sięga dna:**
- **ai-operations reszta 7/7** SQLite→PG (13/13 endpointów ai-ops domknięte; +dryf users.name/timestamp-text/feature→action). 16/16.
- **axis_data guard** ★krytyczny — clamp zapis+odczyt+render (>100% w raporcie klienta NIEMOŻLIWE, dowód actual:100→≤7) + parytet SIRI/ADMA + docs. Chroni podpis Piotra pod raportem.
- **fail-soft batch5** — 42 handlery (superadmin/notifications); gołych 500 ~81→43.
- **red-misc** (calendar/audit/health/vault) — 2 500 (system_health_alerts operator/enabled mig + notification_rules is_active literał→TRUE); rewir 75+ endpointów poza tym CZYSTY = sygnał utwardzenia.
- **aiWatchdog** — martwy job (import-as-call, coordinator wypatroszony w ESM-migracji) wyłączony czysto; jedyny taki wzorzec w server/src.

**★ NOWE/otwarte RED (⬜):** ~43 gołych 500 (fail-soft batch6+) · `interviewInsightReportPackService` reportPath-hard (opcjonalny twardy gate) · 6 martwych buildDeepen (🔵). Łowy 500-tek: ~50 realnych naprawionych łącznie przez 10 rewirów (klasa legacy-migracje-nie-odpalają domknięta na demo).

**W toku (chipy Piotra):** initiative-batches INSERT org_id · conversations.context-os 500 · TaskService.createTask · notification_outbox · risk_register · normalizeBaseUrl(/v1).

### FALA-W7 (2026-07-19, deploy d27d0fef6c, demo-safe-2026-07-19) — 11 gałęzi, bramki zielone (server tsc 146/204 0-nowych, FE tc 0, kolory/artefakt PASS, eslint 0, boot 4/4 = 2 migracje autorun OK)
**★ Oxford proof-sweep (5 clusterów, wzorzec O4-cluster) — dowód kod+E2E dla ~13 pozycji 🟡→✅:**
- **O1** (generator z assessmentu): benchmark DRD (⬜ stale→✅, `buildDrdIndustryBenchmarkSection` wołane bezwarunkowo, nie za flagą), ADMA FoF≥4 ✅, raport+narrator DRD ✅ (llmService live+fail-safe „numbers-from-engine"), ścieżka N→N+1 ×3 ✅ (168/168 unit). DRD Kanon P1-P5→✅ (K1 decyzja 07-19, patrz blok DECYZJE). Q-bank/scoring/mapa SIRI-ADMA→🟡 (ODB O6). ★finding: `axis_data` = poziomy 0-5 NIE procenty 0-100 (seed 0-100→„Cyber 600%" w raporcie klienta).
- **O2** (warstwa wniosków): O2.2 (raporty SIRI/ADMA→wnioski) / O2.3 (19/19 tooli) / O2.4 (analizy finansowe→wnioski) → ✅ (35/35 testów). O2.1 CONCLUSION_LAYER→✅ (K2 decyzja 07-19, standard już wdrożony 3 powierzchniami).
- **O3** (pogłębianie): całe wiring żywe (7 strat. kanał-A + 9 operacyjnych + ansoff/ambition + risk), +testy capabilityMapper/narrativeEngine (106/106). Dowód gotowy, formalne ✅ czeka ODB O1 promptbook (SESJA#1). 6 martwych `buildXDeepenPrompt`→✅ (decyzja 07-19: USUŃ, JA cleanup).
- **O7** (standardy treści): O7.2 INITIATIVE_FORMULA→✅; O7.1 CARD_CONTENT guardian→✅ (K decyzja 07-19: twarda brama, `353fca6bb2`) +★fix bug `\b` po polskich diakrytykach; O7.3 ton persona→🟡 ODB (subiektywny).
- **O8** (help/glossary): O8.1/O8.2/O8.3→✅ (16/16, zbudowane szerzej niż docy — złota reguła złamana w dokumentacji nie kodzie).

**★ Kodowalne nowe RED naprawione:**
- **ai-operations ×6** SQLite→PG (realna `ai_usage_logs`, `datetime()`→interval, koercja; fallback=true czynił .catch martwym). 6×200, 19/19. (7 sub-endpointów zostaje.)
- **KB FTS** — probe `sqlite_master` 42703→wyszukiwanie zawsze LIKE; teraz native `to_tsvector/plainto_tsquery`+GIN. FTS działa.
- **agents.routes** — self-import lazy-wrapper→`_AIAgents`=Promise→crash; przepisany moduł metadanych (5 agentów), coordinator→503.
- **presentations ×4** — Array.isArray guardy (+slidePlanning), ZodError→400, Deck-not-found→404. 212/212.
- **project-members/permissions/retention** — aliasy dryfu + serwis permissions przepisany na realny schemat + retention DI-bug+serwis+migracja tabeli.
- **fail-soft batch4** — 45 handlerów (settings/metrics/documents), ~120→~81 gołych 500.

**★ NOWE RED (⬜/🔵 — do domknięcia):** 7 ai-ops sub-endpointów (SQLite-izmy) · `aiWatchdog.ts` martwy wzorzec import-as-call · axis_data 0-5-nie-100 (dokumentacja seedów). [ROZSTRZYGNIĘTE 07-19: 6 martwych buildXDeepenPrompt→✅ · DRD Kanon P1-P5→✅ · O2.1/O7.1→✅ — patrz blok DECYZJE 07-19.]

**★ B13 baseline_gap (33k linii, fresh-env==TROLLEY) — GOTOWE, deploy OSOBNO** (izolacja: rozmiar + adaptQuery-DDL mangluje `*_update()/*_validate()`). Demo-safe (no-op na TROLLEY), wartość=fresh-env. Gałąź `t10-migracje` @ 25c4d8655d.

### FALA-W5+W6 (2026-07-19, deploy 581281e6f3, demo-safe-2026-07-19) — 15 gałęzi, bramki zielone (server tsc 146/204 0-nowych, kolory/artefakt PASS, eslint 0, zero FE, boot 4/4 = 8 migracji autorun OK)
**★ Oxford O4 = 7/7 ✅** — cluster domknięty dowodem: O4.1-O4.5 (business case 5-fazowy, scenariusze-dźwignie, value tree, portfel, WACC/guidance) + O4.6 trend + O4.7 post-mortem. 5 miało dowód w `j21-oxford-o4` (nieodnotowany), 2 odblokowane (notatka „infra-gap LLM" nieaktualna — parity ma `llm_providers` zaseedowane, realny call Anthropic przeszedł strażnika liczb). Testy: `j21-oxford-o4` 4/4 + `odbior--o4c--business-case-live` PASS + `businessCase` unit 23/23.

**★ SWEEP 500-tek W5+W6 (7 łowców RED × ~70-200 endpointów/rewir na parity, real-runtime):** ~30 realnych schema/kod-500 znalezionych, **~18 naprawionych** (8 migracji addytywnych + fixy kodu):
- **admin/superadmin:** `security_events`+`admin_audit_logs` kolumny, `feature_roadmap`+`gdpr_data_subject_requests` tabele (6 endpointów).
- **pmo-reszta:** `change_requests`+`governance_policies`+`roadmap_waves` tabele (4).
- **ai/*:** `ai_audit_logs.success/metadata_json` (2).
- **results:** globalny template `RESULTS_KPI_REPORT` (2, POST 500 dla każdej org).
- **sync:** `integration_api_keys` tabela + `integration_providers` kolumny/re-seed 17 providerów + syncHub /connect→400 (3).
- **assessment:** 3 tabele `assessment_versions/reviews/questions` (RED-C W4 domknięty) + workflow `organization_id` INTEGER→TEXT + 3 kolumny batch (RED-C W4).
- **deliverables/my-work:** cost-summary `datetime('now',?)` param-42883 + delegation `u.name`→first/last (2 bugi kodu, jeden hard-500 na prod).
Wspólna przyczyna: legacy migracje 3-cyfrowe (247/334/335/293/505/512/256/015/055) + `.sql.sql` NIGDY nie odpalają (regex autorun `/^(7\d{2}|\d{8})_/`).

**★ Infra/systemowe domknięte:**
- **adaptQuery quote-aware** — parser świadomy kontekstu (string/identyfikator/komentarz, escaped `''`); `?`→`$n` tylko poza literałami. 30 realnych query byte-identical (oracle-test), 46/46 unit. Domyka systemowe ryzyko z RED-A.
- **DecisionController** — 2 bugi: L293 martwa gałąź unblock (inicjatywa utknięta BLOCKED) + L1022 **korupcja danych** (DONE→lowercase `blocked`) → `UPPER(status)`+kanoniczny. 4/4.
- **ensureToolsSchema** — 7× `ADD COLUMN`→`IF NOT EXISTS`, log-spam 42701 zniknął (14→0).
- **fail-soft H6.4 batch2+3** — +28 handlerów (conversations.routes.ts do zera + ai.routes.ts POST /chat rdzeń + settings/org-policy/superadmin). 166→~120 gołych 500. 23/23 unit.

**★ NOWE RED (⬜ — do domknięcia; +17 do RAZEM, wszystkie z dowodem):**
- **ai-operations ×6** (mission-control/performance/costs/sla/analytics/summary): SQLite-izmy `datetime()` + nieistniejąca `ai_request_log` → wymaga przepisania SQL na PG (nie migracja).
- **project-members** dryf `role/joined_at` vs `project_role/created_at` → maskowany 503, lista członków stale-zepsuta (fix aliasami gotowy).
- **permissions/stats** `role_permissions.role_id` drift (serwis używa role_id/enabled, tabela ma role).
- **retention-policies** DI-bug (`DataRetentionService.getPolicies is not a function`) + brak tabeli.
- **presentations ×3** (outline/deck/regenerate): bugi kodu (not-iterable, ZodError→400, not-found→404) — nie schema.
- **agents.routes** broken lazy-export (`getAllAgentMetadata is not a function`).
- **KB FTS** probe SQLite-only degraduje cicho (search zepsuty na PG).
- Latentne (fallback=true maskuje puste): `conversion_events`/analytics/`business_metrics`.
- pre-existing: conversations.context-os 500 (chip); ai-chat leak-assertion (naprawiony w batch2).

**W toku (chipy Piotra + B13):** TaskService.createTask (RED#3) · notification_outbox (RED#5) · risk_register · normalizeBaseUrl(/v1) · T10 migracje fresh-env baseline-gap (B13).

### FALA-W4 (2026-07-19, deploy 3838cbebd7, demo-safe-2026-07-19) — 13 gałęzi (8 kod z migracjami + 5 test-only), bramki zielone (server tsc 146/204 0-nowych, kolory/artefakt PASS, eslint 0 błędów, zero zmian FE)
**Domknięte z dowodem:**
- **H1.6** ⬜RED→✅ — Start Execution naprawiony: migracja `execution_started_at` (autorun idempotentny) + case `executing`→`EXECUTING` + gate case-insensitive. 4/4 E2E.
- **H3.1** 🟡→✅ — SWOT literal E2E: create→4 kwadranty→reload→W2 realną bramką `swotTensionEngine`→conclusions (confidence=high). 1/1.
- **H6.4** 🟡→✅ — fail-soft: 3 najważniejsze handlery wg doktryny (enrichment→degraded 200, zapisy→fail-closed 500+code). 10/10 unit. (Zostaje 163/166 gołych 500 = osobny sweep.)
- **HP-8** 🟡→✅ — statusBar 5/5 typów (Decision/Insight/Initiative/Report/Deck), flaga ON. 4/4 E2E + 10/10 komponent. (Luka: brak sesji odbioru wizualnego 3 nowych — Vegas.)
- **O5** 🟡→✅ — promptRegistry wpięty end-to-end (26 assetów+endpoint+UI), dowód HTTP 16/16+3/3.
- **T5** ⬜→✅ — sanitizer double-escape: 9 plików decode-before-store (projects/assessments/programs/share/discovery/table-platform/decision-playbook/assessment-reports). 4/4.
- **T2** 🟡→✅ — SLA F3/F5 E2E: overdue→escalate→outbox, zero dubli. 3/3.
- **RED#4 mgmt-reports** ⬜→✅ — CHECK constraint 5 typów (migracja) + `AVG(CAST)` + docytowane aliasy. 2/2.
- **DOC-1** (Teresa→Word „dokument z czatu") — naprawiony: był TIMEOUT (one-shot 9 bloków >30s), fix=chunking 2/partię współbieżność 4 →9/9 ~26s + DOC-2 anti-orphan. teresa-six 2×7/7.
- **★ SWEEP 500-tek W4 (3 łowców RED, ~270 endpointów real-runtime na parity):** 15 realnych schema-500 znalezionych, **8 naprawionych migracjami addytywnymi**: `initiatives.actual_end_date` (v8, 5 ścieżek maskowanych przez fallback=true), `initiatives.blocked_reason`, 3 tabele pmo (`initiative_watchers/history/comments`), `initiative_stakeholders.influence/interest`, `assessment_reports.version/content_json`, + `business_value` TEXT cast w portfolio-rollups. Wspólna przyczyna: legacy migracje 247/334/335 (3-cyfrowe+SQLite-izmy) NIGDY nie odpalają.
- **i18n help.*** — złota reguła: NIE bug (fallbackLng:'en' pokrywa), zero fałszywych tłumaczeń. Domknięte decyzją.

**★ NOWE RED (⬜JA/DEC — do domknięcia; +9 do RAZEM):**
1. 3 całkowicie brakujące tabele assessment: `assessment_versions`, `assessment_reviews`, `assessment_questions` (potrzebny projekt schematu, nie ADD COLUMN) — 500 na versions/pending-reviews/evidence-report.
2. `assessment-workflow` (DEPRECATED router, wciąż live): `organization_id` INTEGER vs tekstowe org-id → 22P02; `initiative-batches` czyta nieistniejące kolumny (bug SQL).
3. `business_value` TEXT = modeling-debt (cast punktowy załatwił rollups, ale kolumna sumowana gdzie indziej — decyzja typowania).
4. `risk_register` nie istnieje na parity → `generatePortfolioHealthReport` 500 (chip task_47c195ea).
5. **★ Systemowe: `DbPromise fallback=true`** zamienia każdy schema-500 w cichy 404/pustkę → maskuje przyszłe RED-y w całym v8 (wybór platformowy — decyzja).
6. **★ env: `normalizeBaseUrl` obcina `.../v1/messages`→goły host → 404 dla wszystkich callów LLM** jeśli baza trzyma pełny endpoint (chip task_b731cd4d; demo działa=ma poprawną wartość, zweryfikować prod).
7. Klasa `.sql.sql` (podwójne rozszerzenie, np. `025_ai_actions_complete.sql.sql`) + 3-cyfrowe legacy migracje NIGDY nie odpalają → schema-drift (domyka B13 baseline-gap fresh-env).

**W toku (chipy Piotra + B13):** TaskService.createTask 500 (RED#3, chip) · notification_outbox drain+SLA (RED#5, chip) · T10 migracje fresh-env baseline-gap (B13).

### O6.2/O6.3 🟡→✅ (2026-07-19) — benchmark finansowy z dowodem
`oxford-o6-benchmark` (77691e2771/6d06a04739) był już zmergowany na `origin/demo` (ancestor
potwierdzony, merge-base = tip gałęzi) — nie wymagał forward-portu. Dowód dodany: nowy acceptance
test `tests/acceptance/o6-benchmark-financial.e2e.test.ts` (prefiks `odbior--o6--`, parity :5443) —
seeduje realną organizację (industry='Produkcja przemysłowa…'), realny pakiet+statement Balance
Sheet (CURRENT_ASSETS=900000/CURRENT_LIABILITIES=1000000 → 0.9x, celowo poniżej p25=1.1x), montuje
REALNY router `finance-statements.routes.ts` za REALNYM `verifyToken`, wywołuje `GET /:id/ratios` →
`computeRatios`→`buildRatioBenchmark`→`financeIndustryBenchmarks.getRatioBenchmark`/
`buildSourceMetadata`. Asercje: benchmark p25/median/p75 = dokładnie wartości z
`INDUSTRY_BENCHMARK_PROFILES['industrial-manufacturing'].CURRENT_RATIO` (nie fabrykowane w locie),
`disclaimerPl/En` + `refreshOwnerPl/En` niepuste i cytują n≥10/DBR77, plus druga asercja wołająca
`benchmarkFinancial()` bezpośrednio z tą samą wartością — zgodny werdykt `below-p25` (jedno źródło
prawdy, brak dryfu). 2/2 testy PASS + 35/35 istniejący unit `financeIndustryBenchmarks.test.ts` PASS.
Bramki: server tsc 146/204 0-nowych, esbuild/eslint czyste na nowym pliku. Gałąź `o6-finish`
(worktree, NIE push) — commit dowodu poniżej.

### FALA-W3 (2026-07-19, deploy eca4ecc5ea, demo-safe-2026-07-19) — 10 gałęzi (9 kod + smoke), bramki zielone (FE tsc 0/0, server 146/204 0-nowych, kolory/canon/artefakt PASS, eslint 0 błędów)
- **H5.2+H5.3** 🟡→✅ — TOP-10 N+1 zmapowane, 3 najgorętsze naprawione batch-queryem (teams/pmoRoles/reconciliation) + util `withRequestTimeout` (504 na raportach/eksporcie/AI). 5/5 E2E.
- **H6.3** 🟡→✅ — audyt ścieżek `notifications`; dedup dopięty w TaskService + Stripe-webhook (kanoniczna ścieżka miała). 2/2 E2E z realną współbieżnością.
- **T7b (4/4 wrappery)** 🟡→✅ — demoService.cleanupExpiredDemos realny (korzeń orphanów, dry-run OFF), backup (W2b), aiExecutiveReporting realny llmService, connectorRegistry/connectorAdapter usunięte (0 konsumentów). E2E zielone.
- **T9-1 facilitation** 🟡→✅(część) — state-machine faz (409 na nielegalnej), timer `timer_ends_at` (mig 790 autorun) + naprawiony latentny bug joinera, end+freeze, broadcast WS. 6/6 E2E. (zostaje EmptyState/KnownTool w T9.)
- **O3 focusTradeoffs** 🟡→✅ — wpięty do useToolAI; „martwe" buildery = realna luka → capabilityMapper/narrativeEngine dostały ConversationProtocol. 100/100 testów.
- **V7-8 smoke wizualny** 🟡→✅ — `tests/visual/` 49 ekranów×light/dark=98 baseline, bramka zweryfikowana (regresja→FAIL→cofnięte→PASS). Strażnik po falach Vegas.
- **Deck 3× S-fix** — strzałka wstecz (brak `onBack` w MELS), tryb prezentera wywoływalny (chip overflow+Cmd+K), panel Media honest-UI. 18/18 testów.
- **WB komentarze** — węzły Whiteboard dostały wątki komentarzy (parytet z Process Flow), 3/3 E2E + widoczność cross-user org-scoped.
- **reportPdf+v8-decode** — komentarz nieaktualny (route zamontowany); v8 content decode dopięty. 5/5 E2E.

### ★ NOWE RED wykryte w falach W2b/W3 (do rejestru jako ⬜JA — wszystkie z dowodem E2E/SQL):
1. **H1.6 Start Execution zepsuty na Postgres** — kolumna `execution_started_at` nie istnieje (mig 061 w dialekcie SQLite) → 500; + rozjazd `executing`/`EXECUTING`.
2. **status_reports kolizja schematu** — chuda tabela bootstrap vs bogata mig 066 `IF NOT EXISTS` (cichy no-op) → reportPdf/statusReport/reportCadence 500 na każdym bootstrapowanym env (prawd. demo/prod). Fix=migracja addytywna (gotowa, wymaga promocji demo+decyzji).
3. **TaskService.createTask** INSERT bez `id`/`organization_id` (NOT NULL, brak DEFAULT) → zawsze 500 na Postgres mimo żywych callerów.
4. **management_reports** CHECK constraint dopuszcza tylko 2/5 typów raportów; `getBasicTaskMetrics` `AVG(progress)` na kolumnie TEXT → 500.
5. **notification_outbox** bez workera-drenu (dedupe_key nieegzekwowany) + gałąź „brak admina" w SLA nie stempluje `escalated_at` → zapętlenie co 10 min.

**Zostaje w toku (relaunch W3b):** T10 migracje fresh-env (B13) · J25 testy klikane (A22) · DOC-1 „dokument z czatu" (generateBlockProse).

### FALA-W2b (2026-07-19, deploy fcbba5df4a, demo-safe-2026-07-19) — 15 gałęzi, 38 commitów, wszystkie bramki zielone
- **H3.2** 🟡→✅ — 19/19 Active tools: create/save/reload/conclusion E2E (`h32-19tools.e2e.test.ts`, parity :5443). Finding: `ensureToolsSchema()` szum `42701` (nieblokujący).
- **H3.7** 🟡→✅ — CMMI/RapidLEAN honest-„wkrótce" potwierdzone (frameworkRegistry SSOT); dopięto i18n badge/toast w NewAssessmentModal.
- **H4.4** 🟡→✅ — M13 create→DRAFT→dokument→timeline E2E (`h44-m13-flow`). ★Naprawione 3 realne bugi aliasów (getMilestones zwracał undefined; createMilestone order_index zawsze 1).
- **H5.1** 🟡→✅ — FinanceHub perf: code-split -58% ścieżki krytycznej (4120→1723 KB), 7 granic Suspense+skeleton; fetche już były Promise.all.
- **H1.6** — ⬜ z ★RED: endpoint istnieje ale `execution_started_at` nie istnieje na Postgres (migr. 061 w dialekcie SQLite) → 500; + case split-brain executing/EXECUTING. Test-dowód dołączony (relaunch B6-klasa naprawy).
- **O1.8** (SIRI/ADMA generator) 🟡→✅ — H1.3 framework-agnostyczny, dowód per framework (`o1-siri-adma-initiatives`).
- **O2.5** 🟡→✅ — slajd „Wnioski" K1→K4 w deck-generatorze za flagą ENABLE_DECK_CONCLUSION_SLIDE (grounded+walidowany).
- **O4.7** 🟡→✅ — resultsROIService `k.unit` (nieistniejąca kolumna→zawsze pusto) naprawione + O4.2-4.6 4 wyjścia silnika dostały UI (ReconciliationPanel post-mortem + Finance report-section).
- **T7b-2 backup** 🟡→✅ — realny backupService (JSON-eksport tabel→storage+manifest, restore=uczciwe 501), 6/6 E2E.
- **T9-2** 🟡→✅ — SCIM DDL parity na TROLLEY (updated_at/last_synced_at/indeksy/UNIQUE) + tr() dwujęzyczność potwierdzona testem PL≠EN.
- **E-systemic sweep** 🟡→✅ — 657 unquoted camelCase aliasów w 36 plikach cudzysłowionych (Postgres case-fold→undefined); spot-dowód na `initiatives`.
- **HP-2** — test E2E agenta audytowego + agent-audit alias fix (agentAuditStore).
- **J26 Kanał-2** — Notatnik AI-replace fragmentu + MindMap rename + Process-Flow edit_step (doktryna dwóch kanałów, część S).
- Bramki: FE tsc 0/0 · server tsc baseline 146/204 0-nowych · kolory PASS (nowe sekcje O4 zmapowane na c-*) · list-canon/artefakt PASS · eslint 0 błędów.

**Padło na limicie 9:00 (relaunch W3):** B6 H5.2/5.3 · B7 H6.3 · B8 T7b-democleanup · B10 T7b-PM-AI/connectors · B11 T9-facilitation · B13 T10-migracje · B15 WB-komentarze · B16 Deck-S-fixy · B17 O3-focus/dead · B19 V7-8-smoke · B20 reportPdf+decode · A22 J25-klikane · DOC-1 generateBlockProse.
(≈50×🟡→✅ w Oxfordzie) + E1 env (ożywia oś Teresy) + SESJA#1 decyzji.**

Akcje: `JA`=robię bez pytania · `ENV`=Piotr Railway · `DEC`=decyzja Piotra · `ODB`=odbiór Piotra.

---

## A · HARVARD (62) — mechanika/niezawodność (lista _PROJEKT_A; UWAGA: 145-matryca UX = osobny rejestr, domknięta ~130-140/145)

### H1 · Łańcuch danych (11): 5✅
| ID | Zadanie | S | Akcja | Dowód/notatka |
|---|---|---|---|---|
| H1.1 | Wywiad/Czat→Insights | ✅ | — | E2E 07-16 (Teresa treść LLM) |
| H1.2 | Insights→Inicjatywy | ✅ | — | handoffFinding + dedup #59 |
| H1.3 | Assessment→Inicjatywy | 🟡 | JA | promoteWorkbench ręczne |
| H1.4 | Tools→Inicjatywy (callback bez handlera) | ⬜ | JA | brak dowodu naprawy |
| H1.5 | Ideas→convert back-ref źródła | 🟡 | JA | dedup był, back-ref nie |
| H1.6 | Start Execution (dowód przejścia) | 🟡 | JA | kokpit jest, dowód nie |
| H1.7 | Execution DONE→Rezultaty | ✅ | ODB | bridge w kodzie demo |
| H1.8 | Rezultaty↔Finanse reconcile | 🟡 | DEC #82b | shadow; enforce=decyzja |
| H1.9 | Statements→Model | ✅ | ODB | refresh-from-source |
| H1.10 | Teresa→Deliverable | ✅ | — | auto |
| H1.11 | Deliverable→M17 back-ref (S6.1) | 🟡 | JA | S6.3 jest, S6.1 nie |

### H2 · Twarde bugi (17): 14✅
| ID | Zadanie | S | Akcja | Dowód |
|---|---|---|---|---|
| H2.1-2 | M05 foldery+pułapka | ✅✅ | — | clearSchemaCache |
| H2.3 | M06 routing MindMap→Flow | ⬜ | JA | BRAK dowodu naprawy |
| H2.4-14 | (11 bugów: z-index/OEE/wykresy/KPI/lineage/M16 kreator×2/M24×4) | ✅×11 | — | markery w kodzie demo |
| H2.15 | z-index command-row | ❓ | JA | marker zniknął — zweryfikować |
| H2.16 | M08 rail-undo | ✅ | — | live |
| H2.17 | M24 PATCH roli | ❓ | JA | marker zniknął — zweryfikować |

### H3 · Mechanika sesji (8): 2✅
| ID | Zadanie | S | Akcja | Notatka |
|---|---|---|---|---|
| H3.1 | Tool-sesja e2e (SWOT wzorzec) | 🟡 | JA | Harvard 10/10 blisko; SWOT dosłownie? |
| H3.2 | Checklista mechaniki 19 Active | ⬜ | JA | niewykonana |
| H3.3 | Assessment e2e DRD | ✅ | — | E2E+akcept 07-13 |
| H3.4 | Assessment e2e SIRI | 🟡 | JA | dedykowany dowód |
| H3.5 | Assessment e2e ADMA | 🟡 | JA | dedykowany dowód |
| H3.6 | Pipeline generatorów (timeout/retry) | 🟡 | JA | — |
| H3.7 | CMMI/LEAN „wkrótce" UX | 🟡 | JA | dane są |
| H3.8 | M12 orkiestrator | ✅ | ODB 10-min | 5/5 e2e + flip ON |

### H4 · Redesigny (5): 0✅ — ZAMROŻONE od 07-01
| ID | Zadanie | S | Akcja |
|---|---|---|---|
| H4.1 | Sign-off wzorca D-I | 🟡 | DEC D18 (=brama F2 Vegas) |
| H4.2 | Shell: Flow/Tabela/Whiteboard | ⬜ | JA (po D18) |
| H4.3 | Shell: 3 edytory dok. | ⬜ | JA (po D18) |
| H4.4 | M13 DRAFT→dokument→timeline | 🟡 | JA |
| H4.5 | M17 IA kroku źródeł | ⬜ | JA |

### H5 · Wydajność (6): 1✅ — ZAMROŻONE
| ID | Zadanie | S | Akcja |
|---|---|---|---|
| H5.1 | M16 perf/skeleton | 🟡 | JA |
| H5.2 | Timeouty ciężkich op. | 🟡 | JA |
| H5.3 | N+1 listy | 🟡 | JA |
| H5.4 | Kanaryjski strażnik v8-mutacji | ⬜ | JA |
| H5.5 | Audyt fire-and-forget | 🟡 | JA |
| H5.6 | Capacity allocated/backlog | ✅ | — |

### H6 · Operacje (15): 5✅
| ID | Zadanie | S | Akcja | Notatka |
|---|---|---|---|---|
| H6.1 | M10 STT | ✅ | — | 07-01 |
| H6.2 | i18n resztki | ✅ | JA (monolity=osobne sesje) | ~6500 kluczy |
| H6.3 | Spójność powiadomień | 🟡 | JA | |
| H6.4 | Standard fail-soft | 🟡 | JA | dziś gaszenie pożarów |
| H6.5 | RBAC sweep M03/M04 | 🟡 | JA | punktowy fix był |
| H6.6 | Higiena CI/testów | 🟡 | JA | +tests/acceptance `git add -f` |
| H6.7 | Panel Health | ✅ | — | |
| H6.8 | Beta-gating | 🟡 | JA | |
| H6.9 | Fasady M25 (~8) | 🟡 | JA | „coming soon" żywe |
| H6.10 | M27 pakiet+odbiór | 🟡 | ODB O7 | |
| H6.11 | Czystość danych demo | ⬜ | DEC K7 + JA | STAGE-BLOCKER |
| H6.12 | Global search zakres | 🟡 | DEC | CommandPalette jest |
| H6.13 | Eksport PDF | 🟡 | JA | serwisy są, żywy dowód |
| H6.14 | Dataset Atelier | ✅ | — | seed+README |
| H6.15 | D-K M10 w GA | ✅ | — | |
| — | CMMI/LEAN v1 | 🔵 | — | decyzja D-B (Konstytucja) |

---

## B · HARVEY (28): 17✅ 8🟡 3⬜
✅ (17, z dowodami w _PLAN_HARVEY_PARITY + E2E 07-16): HP-0·1·4·6·7·9·11·12·13·14·15·17·19·22·**23(korekta: ingest zbudowany, testy 11/11, commit 7cf9b37aa1)**·24·26.

| ID | Otwarte | S | Akcja | Notatka |
|---|---|---|---|---|
| HP-2 | agentRuntime retest audytowego | 🟡 | JA J9 | |
| HP-3 | manifesty 19/31 z krokami | 🟡 | DEC | wystarcza? |
| HP-5 | Agent Builder NL | ⬜ | DEC | budować? kolizja doktryny |
| HP-8 | pasek 2/5 typów | 🟡 | JA J2 | +Report/Initiative/Deck |
| HP-10 | spec CC formalny | 🟡 | — | de-facto wdrożone |
| HP-16 | evidence mapowanie 8/8 | 🟡 | JA | |
| HP-18 | spec benchmarku formalny | 🟡 | — | de-facto |
| HP-20 | graded-run pełny (3/100, tier przypiąć!) | 🟡 | DEC D12→JA | all-pass 0/3 |
| HP-21 | scorecard prezentowalny | ⬜ | JA J8 | po HP-20 |
| HP-25 | migracja ręczna governance | 🟡 | DEC | fallback działa |
| HP-27 | GTM landing/pricing/SLA | ⬜ | DEC | timing |
| HP-4d | 3 pytania semantyczne agenta | 🟡 | DEC | fail-fast/live/builder |

---

## C · OXFORD (70): 1✅ formalne · ~55 zbudowane — WĄSKIE GARDŁO = ODBIÓR
> ★ Sesja promptbooka (60-90 min) + sesja kanonu O1 przełączają ~50×🟡→✅ hurtem.

### O1 · Kanony ×3 (24 = 8 elem. × DRD/SIRI/ADMA)
| Element | DRD | SIRI | ADMA | Akcja |
|---|---|---|---|---|
| Kanon | 🟡(P1-P5!) | ✅? | ✅? | DEC K1 + ODB O6 |
| Q-bank | 🟡(699 zmerg.) | ✅ | ✅ | ODB O6 |
| Scoring | 🟡 | ✅ | ✅ | ODB O6 |
| Benchmark | ⬜ | ✅ | 🟡(próg FoF) | JA |
| Raport+narrator LLM | 🟡(zbud.+RAG) | 🟡 | 🟡 | ODB O6 |
| Mapa/radar | 🟡 | ✅ | ✅ | ODB |
| Ścieżka N→N+1 | 🟡 NOWE zbud. | 🟡 | 🟡 | ODB |
| Generator inicjatyw z wyniku | 🟡 | ⬜ | ⬜ | JA |

(SIRI/ADMA „✅?" = statusy z 07-01 sprzed metody dowodowej — przy odbiorze O6 potwierdzić.)

### O2 · Standard wniosków (5)
| ID | Zadanie | S | Akcja | Dowód |
|---|---|---|---|---|
| O2.1 | SSOT CONCLUSION_LAYER | 🟡 | DEC K2 | dokument gotowy |
| O2.2 | Wdrożenie: assessmenty ×3 | 🟡 | ODB | d775f13946 |
| O2.3 | Wdrożenie: 19/19 tooli + fix serwerowy | 🟡 | ODB | 6712546ad8+df5a1cf58a |
| O2.4 | Wdrożenie: finanse | 🟡 | JA weryf. UI | ef636ee09b |
| O2.5 | Narracja deck/generatorów | ⬜ | JA | brak dowodu |

### O3 · Q-banki 19 narzędzi — 19/19 ZBUDOWANE+zmergowane (74bdf2762e i in.)
| Pozycje | S | Akcja | Notatka |
|---|---|---|---|
| SWOT·Porter·ValueChain·Ansoff·Capability·Ambition·Focus·Narrative·Risk·Portfolio (10 strat.) | 🟡×10 | ODB O1(promptbook) | |
| SOP·A3·SMED·DMS·Inventory·AI-Disc·Pain·RPA·ProcAuto (9 oper.) | 🟡×9 | ODB O1 | dedykowane commity SĄ |
| deepeningLadder 4 narzędzia + napięcie „one-shot" | ❓→J6 | JA | wyjaśnić przed odbiorem |

### O4 · Finanse-doradztwo (7) — 7/7 zbudowane
| ID | Zadanie | S | Akcja | Dowód |
|---|---|---|---|---|
| O4.1 | Business case 5-fazowy | 🟡 | ODB O1 | E2E NPV 190901; flaga ON |
| O4.2 | Scenariusze-dźwignie | 🟡 | JA weryf. UI | 2db90082a7 |
| O4.3 | Value tree | 🟡 | JA weryf. UI | j.w. |
| O4.4 | Współzależności portfela | 🟡 | JA weryf. UI | j.w. |
| O4.5 | WACC/guidance | 🟡 | JA | 1e057461a2 |
| O4.6 | Trend+driver+prognoza | 🟡 | JA | 8f432229d5 |
| O4.7 | Post-mortem R-v-P | 🟡 | JA | j.w. |

### O5 · Biblioteka promptów (6): 1✅
| ID | Zadanie | S | Akcja |
|---|---|---|---|
| O5.1 | Sekcje inicjatyw (core 7/7 z promptem; 12 podniesionych) | 🟡 | JA weryf. DB |
| O5.2 | Guidance DRD/SIRI/ADMA parity | 🟡 | JA | 87d74fa0f6 |
| O5.3 | Briefy generatorów | 🟡 | JA |
| O5.4 | Persona Teresy przegląd | ⬜ | JA+ODB |
| O5.5 | Rejestr promptów | ✅ | — | flip Piotra 07-15 |
| O5.6 | Macierz pokrycia Wywiadu | ⬜ | JA |

### O6 · Benchmarki branżowe (3) — 3/3 zbudowane+wpięte, 2/3 z dowodem (07-19)
| ID | S | Akcja | Dowód |
|---|---|---|---|
| O6.1 profile 7/7 w raporcie | 🟡 | DEC K6/P3 (czeka decyzję Piotra — wpięcie w raport) | ddcfd03e4a |
| O6.2 per-industry zakresy | ✅ | JA weryf. | 917aaef042 (build) + `tests/acceptance/o6-benchmark-financial.e2e.test.ts` (dowód 07-19, real HTTP+DB, p25/median/p75 dopasowane 1:1 do `INDUSTRY_BENCHMARK_PROFILES`) |
| O6.3 źródła+refresh owner | ✅ | JA | 77691e2771 (build, już na demo) + tenże acceptance test — `disclaimerPl/En`+`refreshOwnerPl/En` realnie surowe na `GET /:id/ratios`, + `benchmarkFinancial()` direct-call zgodny werdykt |

### O7 · Standardy treści (3)
| ID | S | Akcja | Notatka |
|---|---|---|---|
| O7.1 CARD_FORMULA guardian | 🟡 | DEC | złagodzony do advisory — wystarcza? |
| O7.2 INITIATIVE_FORMULA | 🟡 | — | walidatory są |
| O7.3 Ton PL/EN konsultanta | ⬜ | JA+ODB | ≠ i18n |

### O8 · Pomoc/edukacja (3) — zbudowane wąsko (tylko DRD)
| ID | S | Akcja |
|---|---|---|
| O8.1 hinty „dlaczego pytanie" | 🟡 | JA J20 (→SIRI/ADMA/tools) |
| O8.2 help content | 🟡 | JA weryf. |
| O8.3 glossary | 🟡 | JA J20 |

🔵 Oxford poza-v1: sędzia LLM w runtime (DEC D14 — dziś offline-QA) · poprzeczka all-pass jako gate (DEC).

---

## D · VEGAS (56) — ŚWIADOMIE OSTATNI (funkcje→wygląd)

### F0 · Fundament (8): 3✅
F0-1 ESLint gate ✅ (nie łapie primary-*/c-accent → rozszerzenie po DEC D16) · F0-2 komponenty ✅ ·
F0-3 powłoka ✅ · F0-4 **D-I sign-off 🟡 = DEC D18 (BRAMA F2)** · F0-5 fixy systemowe 🟡 ·
F0-6 cleanup skrypt ✅ · F0-7 rename Menu1/2/3 ⬜ (porzucone milcząco → DEC: formalnie zamknąć) ·
F0-8 sweep ikon 🟡 (lucide-only ✓).

### F1 · Listy A1-A5 (5): 5✅ — check-list-canon PASS, 85 plików StandardTable.

### F2 · Artefakty (12 narzędzi + 6 findingów = 18): 0✅
| ID | Pozycja | S | Akcja |
|---|---|---|---|
| F2-1..4,6,7,9,11,12 | Diagnozy Stan: MindMap·Flow·Whiteboard·IdeaTable·Insight·Initiative·Decision·Excel·Deck | ⬜×9 | JA J12 → ODB per narzędzie |
| F2-5 | Notatnik (zdiagnozowany) | 🔨 | DEC D19 |
| F2-8 | Task (ArtifactRightPanel częściowo) | 🟡 | JA J12 |
| F2-10 | Word (zdiagnozowany) | ❓ | DEC D20 |
| F2-F1 | check-artefakt.sh ZBUDOWAĆ (nie istnieje!) | ⬜ | JA J7 |
| F2-F3 | Dublet CANON scalić | ⬜ | JA J7 |
| F2-F4 | Fala N za flagami | 🔵 | po Bramce 0 |
| F2-F5 | **Bramka 0: prompty kart N** | ⬜ | DEC (blokuje odsłonięcie N) |
| F2-F6 | Flagi mels odsłonięcie | 🔵 | ODB O5 per-moduł |

### F3 · Huby (6): 0✅ — ModuleHuby ⬜ · dashboardy ⬜ · M15 motyw(!) ⬜ · M24 🟡 · M16 wizual 🟡(funkcja≠wygląd) · wykresy chrome ⬜. Akcja: Vegas-fala.

### F4 · Hartowanie (5): 0✅ — z-index ⬜ · M15-UI1/UI6 dark ⬜ · empty/loading/skeleton ⬜ · mikro-detale ⬜ · bg-white bez dark (46-63 plików) ⬜.

### F5 · Light mode (2): 0✅ — całość ⬜ · **cTok fix ODTWORZYĆ** (stara gałąź nie merguje — JA J23 → ODB).

### F6 · Dokumenty generowane (4): PPTX 🟡(polish zmerg., branding nie) · XLSX ⬜(„dramat") · DOCX 🟡 · branding cross ⬜.

### V7 · Przekroje (8): 0✅ — empty-states(crimson!) ⬜ · skeletony ⬜ · e-maile ⬜ · onboarding ⬜ · PDF wygląd ⬜ · ikonografia 🟡 · ESLint gate 🟡(luka primary/c-accent) · smoke-suite wizualny ⬜.

---

## E · PRZEKROJE (42)

### B7 · Forward-port Londyn (2) — ★bez tego prod nie dostaje NIC
| ID | Zadanie | S | Akcja |
|---|---|---|---|
| B7-D | Decyzja startu + bramka D-G (per-krok zgoda) | ⬜ | DEC |
| B7-X | Wykonanie per-SHA 1581 commitów (0 wstecz — bezpieczne) | ⬜ | JA J24 (po B7-D) |

### Ogony „145" (7)
#24b-d kalendarz ⬜(po ENV E4) · I1-I3 kreatory ⬜(DEC greenlight, ADR gotowy) · #82b RECONCILE ⬜DEC ·
#28/25/30/35 role PM ⬜DEC · #71 chipy ⬜DEC · #77 silnik obłożenia ⬜JA · presence-write ⬜JA ·
(§27 backlog admin 🔵 — decyzja 07-13 „zostaw").

### Moduły (12)
M27: tabele ~73-80 ⬜JA(po koncie) · Email Templates audyt ❓ODB · konto superadmina ⬜ODB O7 ·
(i18n SuperAdmin 🔵 DP-10). M26: 5 migracji PROD ⬜**TYLKO PIOTR** (pre-condition portalu) ·
D-01 stuby ⬜DEC · (self-connect 🔵 rozstrz.). M25/M22: OAuth klucze ⬜ENV E4 · wave7 label ⬜DEC.
M16: ~50 endpointów przeznaczenie ⬜DEC · (token-billing 🔵). M24: AdminSidebar rm ⬜JA J22 · (Stripe 🔵 DP-11).
M14: inwentarz uzgodnić („27/35" vs ~18 ekranów — dwa dokumenty) ❓JA · D-03 manager lanes ⬜DEC.

### Konstytucja §5 (8) — ROZSTRZYGNIĘTE 07-19 (patrz blok DECYZJE 07-19 na górze)
K1 P1-P5 DRD ✅(decyzja) · K2 CONCLUSION_LAYER ✅ · K3 39 śmieci ✅decyzja(usuń fizycznie)/🟡wykonanie · K4 sekcje AI ✅decyzja(AI uniwersalnie na KAŻDEJ sekcji)/🟡wiring ·
K5 SWOT×3/PPTX×3 ✅decyzja(3 poziomy krótka/średnia/pełna)/🟡gen · K6 profile publikacja ✅(=P3, adnotacja) · K7 179 orgs ✅decyzja(kasuj klony/zachowaj realne)/🟡wykonanie · K8 D-G 🔵zasada.

### Długi techniczne (10)
T1 256 testów ⬜JA-flota · T2 SLA F3/F5 E2E ❓JA · T3 (=ogony enforce, patrz wyżej) · T4 #77 (j.w.) ·
T5 sanitizer tytuły+tool_sessions ⬜JA · T6 permissionService domknąć-jako-OK ⬜JA ·
T7 wrappery 42+46 ⬜DEC→JA · T8 (=presence-write) · T9 taski-w-tle (facilitation/EmptyState/SCIM DDL/reportContentGenerator/KnownTool) ⬜JA×5 · T10 migracje renumeracja+presentation_cards+baseline 🟡JA J4.

### Kalendarz (3)
📅 03.08 ELKOMTECH (ODB O2; PROD per-zgoda) ⬜ · 📅 04.08 audyt ISO (Piotr) ⬜ · 📅 ~10.08 flip „Certified" (JA) ⬜.

---

## SESJE PIOTRA — plan materiałów (przygotowuję PRZED)
- **SESJA #1 (~2-3h):** promptbook O1 (6 testów) + kanon O1/O6 + decyzje ZAKRES(6)+OXFORD(7)+VEGAS(7) + galerie (po moich renderach). Efekt: ~60-70 pozycji → ✅.
- **SESJA #2 (~1,5h):** ENFORCE(4)+SPRZĄT(4)+OPS(8) + B-checklisty narzędzi + M27 (konto) + Teresa live (po E1). Efekt: ~30-40 pozycji.
- **ELKOMTECH ≤03.08** (osobno, prod, per-zgoda).

## PODPIS KOŃCOWY FAZY
- [ ] 258/258 = ✅ lub 🔵-z-decyzją (liczniki powyżej)
- [ ] Finalny panel sceptyków: POTWIERDZONY (data, link)
- [ ] Piotr: ____________________ (data)
