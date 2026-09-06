#!/usr/bin/env bash
# =============================================================================
# F2_ZMIENNE_DEMO.sh — zmienne środowiskowe demo, do parytetu ze stagingiem.
#
# ██ NIE URUCHAMIAĆ AUTOMATYCZNIE / NIE URUCHAMIAĆ CAŁOŚCI JEDNYM `bash`. ██
# Każda linia `railway variables --set` to OSOBNA decyzja. Wykonuj PO JEDNEJ,
# kopiuj-wklej z tego pliku do terminala, i PO KAŻDEJ zrób odczyt (komenda
# `railway variables --json ... | jq` poniżej każdego bloku) zanim przejdziesz
# do następnej.
#
# WSZYSTKIE komendy `--set` niżej mają `--skip-deploys` CELOWO: VITE_* to
# zmienne WBUDOWANE W BUILD (import.meta.env, nie runtime — patrz pamięć
# "Vite: rozdzielony import.meta.env"), więc zwykły restart kontenera i tak by
# ich nie podniósł — potrzebny jest REBUILD od właściwego, promowanego SHA.
# Zrobienie 27 osobnych auto-redeployów jest więc i bezcelowe (nie podniosłyby
# VITE_*), i ryzykowne (pamięć "zmiana zmiennej wdraża obcy kod" — auto-redeploy
# wywołany zmianą zmiennej może wziąć STARY commit powiązany w Railway, nie ten
# właśnie promowany). Dlatego: ustaw WSZYSTKIE zmienne z --skip-deploys (ten
# plik), a REBUILD zrób przez ponowne odpalenie TEGO SAMEGO `promote-demo`
# (workflow_dispatch, environment=demo, confirm_demo=yes) — patrz
# F2_F3_PRZEBIEG.md krok 7. To gwarantuje: rebuild z DOKŁADNIE tego SHA, który
# przeszedł bramkę, z nowymi zmiennymi już obecnymi w środowisku budowy.
# Wykonuj te zmienne PO promocji kodu (F3), nie przed.
#
# Zmierzone na żywo 06.09.2026 (odczyt `railway variables --json`,
# środowisko=demo/staging, usługa=consultify, projekt=a6d59e88-263d-45f3-96bc-861f66bf467b):
#   - lista i wartości = scripts/demo/porownaj-flagi.mjs /tmp/vars_staging.json /tmp/vars_demo.json
#   - wynik zgodny z evidence/demo-pilotaz/PROBA_NA_SUCHO_20260906.md krok 10 (ta sama
#     lista 27 flag — pomiar dzisiejszy POTWIERDZA, nie zmienia, wcześniejszy)
#   - UWAGA metodyczna: `comm` po WSZYSTKICH kluczach env dawał 42 różnice — to
#     błędny sposób liczenia, bo łapie zmienne operacyjne spoza zakresu flag
#     (SMTP_*, ALERT_EMAIL_RECIPIENTS, DISABLE_RATE_LIMIT, INBOX_WEBHOOK_SECRET,
#     TEST_SUPPORT_KEY, UNSPLASH_ACCESS_KEY, WHATSAPP_FROM, DB_MANAGED_SCHEMA,
#     DEV, API_RATE_LIMIT_MAX, RATE_LIMIT_ALLOW_PROD_DISABLE,
#     ALLOW_BRANDED_DEMO_ORG, PARTNER_SELF_CONNECT_ENABLED). Właściwe kryterium
#     (i to, co liczy `porownaj-flagi.mjs`) to WYŁĄCZNIE wzorzec
#     `^(VITE_|ENABLE_|FEATURE_)` — to daje 27, zgodnie z planem F2 w
#     PLAN_DEMO_KLIENCI_I_POKAZY.md. Te 13 dodatkowych zmiennych operacyjnych
#     NIE są w zakresie tego zlecenia — osobna decyzja właściciela, jeśli mają
#     trafić na demo (patrz uwaga na końcu pliku).
#
# Usługa Railway: consultify · środowisko: demo · projekt: a6d59e88-263d-45f3-96bc-861f66bf467b
# =============================================================================

USLUGA="consultify"
ENV="demo"
PROJEKT="a6d59e88-263d-45f3-96bc-861f66bf467b"

# -----------------------------------------------------------------------------
# BLOK 1 — 27 flag obecnych na stagingu, nieobecnych na demo (wartości ze stagingu,
# odczytane 06.09.2026; ŻADNA nie jest sekretem — wszystkie to boole/tryby VITE_/ENABLE_).
# -----------------------------------------------------------------------------

railway variables --set "ENABLE_SIGNAL_PRODUCER=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: railway variables --json --environment demo --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b | jq '.ENABLE_SIGNAL_PRODUCER'

railway variables --set "ENABLE_TEST_SUPPORT=false" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.ENABLE_TEST_SUPPORT'

railway variables --set "VITE_ASSESSMENT_DOCX_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_ASSESSMENT_DOCX_ENABLED'

railway variables --set "VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED'

railway variables --set "VITE_DRD_REPORT_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_DRD_REPORT_ENABLED'

railway variables --set "VITE_FINANCE_VALUE_PANELS=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_FINANCE_VALUE_PANELS'

railway variables --set "VITE_GALERIA_SZABLONOW_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_GALERIA_SZABLONOW_ENABLED'

railway variables --set "VITE_I18N_DEBUG=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_I18N_DEBUG'
# UWAGA: to jest debug-flaga i18n — rozważ, czy naprawdę ma być ON na WITRYNIE
# pokazowej (zapisano true, bo tyle ma staging; jeśli nadzorca/właściciel uzna,
# że to niepotrzebny szum na demo — pomiń tę jedną linię, to jedyne odstępstwo
# od "parytet 1:1", i zanotuj je w dzienniku LISTA_KONTROLNA_PROMOCJI.md).

railway variables --set "VITE_IDEA_DECISION_LOG=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_IDEA_DECISION_LOG'

railway variables --set "VITE_IDEA_DETAILS_IN_PANEL=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_IDEA_DETAILS_IN_PANEL'

railway variables --set "VITE_IDEA_FINANCIAL_CASE=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_IDEA_FINANCIAL_CASE'

railway variables --set "VITE_INITIATIVE_BRIDGE=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_INITIATIVE_BRIDGE'



railway variables --set "VITE_MELS_PREZENTACJE=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_MELS_PREZENTACJE'

railway variables --set "VITE_MELS_TABELE=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_MELS_TABELE'

railway variables --set "VITE_MYWORK_TWO_LEVEL_NAV=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_MYWORK_TWO_LEVEL_NAV'

railway variables --set "VITE_NAV_DECLUTTER=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_NAV_DECLUTTER'

railway variables --set "VITE_QUICK_ACCESS_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_QUICK_ACCESS_ENABLED'

railway variables --set "VITE_RECORD_PROVENANCE=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_RECORD_PROVENANCE'

railway variables --set "VITE_RESULTS_VNEXT_MANAGEMENT_REPORT_ENTRY_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_RESULTS_VNEXT_MANAGEMENT_REPORT_ENTRY_ENABLED'

railway variables --set "VITE_STUDIO_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_STUDIO_ENABLED'

railway variables --set "VITE_TEMPLATE_LIFECYCLE=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_TEMPLATE_LIFECYCLE'

railway variables --set "VITE_TOOLS_INSIGHTS_WIRING=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_TOOLS_INSIGHTS_WIRING'

railway variables --set "VITE_VF1_CANVAS_SPECA=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_VF1_CANVAS_SPECA'

railway variables --set "VITE_VF1_INIT_SPECA=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_VF1_INIT_SPECA'

railway variables --set "VITE_ZAI_TERESA_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.VITE_ZAI_TERESA_ENABLED'

# -----------------------------------------------------------------------------
# BLOK 2 — bezpieczeństwo/tryb: wartości WYMAGANE explicite przez zlecenie
# (niezależnie od tego, co jest domyślne w kodzie przy braku zmiennej — patrz
# uwagi "DOMYŚLNIE" przy każdej, zmierzone w server/src, nie zgadywane).
# -----------------------------------------------------------------------------

railway variables --set "CSRF_MODE=report" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.CSRF_MODE'
# (staging ma już "report"; demo dziś nie ma tej zmiennej wcale)

railway variables --set "AI_BUDGETS_ENABLED=true" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.AI_BUDGETS_ENABLED'
# DOMYŚLNIE (brak zmiennej) budżety i tak są WŁĄCZONE: server/src/services/ai/AIPipeline.ts:265
#   `budgetsEnabled = String(process.env.AI_BUDGETS_ENABLED || '').trim().toLowerCase() !== 'false'`
# — czyli ustawienie "true" jest jawną deklaracją, NIE zmianą zachowania (fail-open
# na "włączone"). Kwota budżetu (50 USD/org/mies. wg DEC-402) NIE jest zmienną
# środowiskową — `rg AI_BUDGET server/src` znajduje tylko AI_BUDGETS_ENABLED i
# AI_BUDGET_EXHAUSTED (komunikat), nie kwotę; kwota żyje w tabeli/serwisie
# aiBudgetService, nie w Railway variables. Konfiguracja kwoty = osobny krok
# (poza zakresem tego pliku), nie `railway variables --set`.

railway variables --set "ENABLE_TEST_GATEWAY=false" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.ENABLE_TEST_GATEWAY'
# DZIŚ na demo = "true" (furtka testowa OTWARTA na witrynie pokazowej — do zamknięcia).
# staging ma już "false".

railway variables --set "ENABLE_V8_SHADOW_MODE=false" --skip-deploys --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# odczyt: … | jq '.ENABLE_V8_SHADOW_MODE'
# DZIŚ na demo = "true" (tryb cienia V8 włączony na demo — do zamknięcia).
# staging ma już "false".

# -----------------------------------------------------------------------------
# BLOK 3 — usunięcie APP_BUILD_SHA (pamięć "Health gitSha przybity zmienną",
# DWUDZIESTY ÓSMY kształt fałszywego gotowe — zmienna ręczna maskowała
# prawdziwy SHA w /api/health).
# -----------------------------------------------------------------------------

railway variable delete APP_BUILD_SHA --environment "$ENV" --service "$USLUGA" --project "$PROJEKT"
# UWAGA SKŁADNI: `railway variables --unset` NIE ISTNIEJE (sprawdzone `railway variables --help`
# 06.09.2026 — flagi to tylko --set/--set-from-stdin/--skip-deploys/--json). Usuwanie zmiennej to
# osobny podpolecenie: `railway variable delete <KLUCZ>` (alias `variables`/`vars`/`var` też działa).
# `delete` nie ma własnego --skip-deploys — usunięcie TEJ zmiennej i tak nie zmienia zachowania
# aplikacji (patrz niżej), więc ewentualny redeploy nim wywołany nie szkodzi.
# odczyt: railway variables --json --environment demo --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b | jq 'has("APP_BUILD_SHA")'   # oczekiwane: false
#
# NIUANS zmierzony dziś: ta konkretna zmienna NIE jest dziś "ręcznie przybita"
# jak w incydencie z pamięci — .github/workflows/railway-deploy.yml, zadanie
# promote-demo, krok "Deploy promoted SHA to demo" robi
#   railway variables --set "APP_BUILD_SHA=${SOURCE_SHA}" ... --skip-deploys
# PRZED każdym `railway up`, więc wartość jest nadpisywana automatycznie przy
# każdej promocji i dziś (06.09) faktycznie zgadza się z żywym /api/health
# (f3237e94230481d2bf4ad0a9c0dc10b1391191c9 = HEAD origin/demo = gitSha z
# `sprawdz-demo.sh --tylko-zdrowie`, evidence krok 11). Usunięcie jest więc
# higieną na wypadek przyszłego ręcznego ustawienia, nie naprawą aktywnej
# awarii — workflow i tak ustawi ją ponownie przy najbliższym `promote-demo`.

# =============================================================================
# PO WYKONANIU CAŁOŚCI (wszystkie bloki, po jednej, z odczytem):
#   node scripts/demo/porownaj-flagi.mjs <świeży-staging.json> <świeży-demo.json>
#   oczekiwany wynik: "OK  flagi: demo ma wszystkie flagi obecne na stagingu"
#                     "OK  flagi: żadna wspólna flaga nie ma sprzecznej wartości"
#                     "OK  flagi: CSRF_MODE ustawione = „report""
#                     "OK  flagi: AI_BUDGETS_ENABLED ustawione = „true""
#
# NIE OBJĘTE tym plikiem (świadomie, poza zakresem zlecenia — do osobnej decyzji
# właściciela, jeśli mają trafić na demo): 13 zmiennych operacyjnych obecnych na
# stagingu a nieobecnych na demo, które NIE są flagami VITE_/ENABLE_/FEATURE_:
#   ALERT_EMAIL_RECIPIENTS, ALLOW_BRANDED_DEMO_ORG, API_RATE_LIMIT_MAX,
#   DB_MANAGED_SCHEMA, DEV, DISABLE_RATE_LIMIT, INBOX_WEBHOOK_SECRET,
#   PARTNER_SELF_CONNECT_ENABLED, RATE_LIMIT_ALLOW_PROD_DISABLE, SMTP_FROM,
#   SMTP_SECURE, TEST_SUPPORT_KEY, UNSPLASH_ACCESS_KEY, WHATSAPP_FROM
# (INBOX_WEBHOOK_SECRET i TEST_SUPPORT_KEY wyglądają jak sekrety — NIE kopiować
# ich wartości do żadnego pliku w repo; jeśli mają trafić na demo, ustawiać
# ręcznie z wartością pobraną bezpośrednio z Railway, nigdy przez ten plik).
# =============================================================================
