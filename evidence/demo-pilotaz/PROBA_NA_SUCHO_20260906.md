# Proba na sucho — skrypty scripts/demo/ (2026-09-06)

Log przebiegu na LOKALNEJ bazie 54400 (kontener `consultify-noc-pg`). Zadna komenda
nie dotknela demo, stagingu ani produkcji; jedyne wyjscia na zewnatrz to odczyt
`railway variables` i `curl /api/health`. Baza probna `consultify_demo_proba`
zostala utworzona i usunieta w tym samym przebiegu (krok 12).

Dowody, po ktore sie tu siega:
- krok 1: kopia 1802-tabelowej bazy = 10,3 MB, sha256 policzone, manifest zapisany
- krok 3b/3c: bramki odmawiaja przy zlym hoscie i przy uszkodzonym pliku
- krok 4-5: przywrocenie w 26 s; dane komplet, ale **11 kluczy obcych nie powstalo**
- krok 7-8: seed pilotazu 11 zmian, drugi `--apply` = `utworzono=0 zmieniono=0`
- krok 10: realny rozjazd flag demo vs staging (27 brakuje)

```
=== PROBA NA SUCHO — 2026-09-06T05:40:09Z ===
host: Darwin 25.6.0 | pg_dump lokalnie: BRAK | Docker version 29.3.0, build 5927d80c76
galaz: mvp/demo-rozdzial-przygotowanie @ cb392da24e
POMIAR: docker -v /private/tmp -> katalog PUSTY, dlatego archiwum idzie stdin (opis w _wspolne.sh)

### KROK 1 — kopia zapasowa bazy zrodlowej (consultify_noc, 1802 tabele)
[demo] cel: 127.0.0.1:54400/consultify_noc
[demo] klient Postgresa: docker (obraz: pgvector/pgvector:pg16)
[demo] zrzut → /private/tmp/dumps-proba/proba-lokalna-20260906T054009Z.dump
[demo] gotowe: 10297016 B, sha256 86d6a76633d44358149b7c9b274f1168ba413cb40797b1de9cbd090674006646, tabel w zrzucie: 3861
/private/tmp/dumps-proba/proba-lokalna-20260906T054009Z.manifest.json

### KROK 2 — utworzenie OSOBNEJ bazy probnej consultify_demo_proba w tym samym kontenerze
NOTICE:  database "consultify_demo_proba" does not exist, skipping
DROP DATABASE
CREATE DATABASE
-- tabel w nowej bazie PRZED przywroceniem:
0

### KROK 3a — przywrocenie: TRYB SPRAWDZENIA (nic nie pisze)
[demo] manifest OK: /private/tmp/dumps-proba/proba-lokalna-20260906T054009Z.dump (10297016 B, sha256 86d6a76633d44358149b7c9b274f1168ba413cb40797b1de9cbd090674006646)
[demo] zrzut pochodzi z: 127.0.0.1:54400/consultify_noc
[demo] cel przywrócenia:  127.0.0.1:54400/consultify_demo_proba
[demo] TRYB SPRAWDZENIA — nic nie zapisano. Aby przywrócić, powtórz z --tak-nadpisz.
-- kod wyjscia: 0

### KROK 3b — bramka: proba przywrocenia z ZLYM oczekiwanym hostem (ma ODMOWIC)
[demo] BŁĄD: cel NIE pasuje do deklaracji: host nie zawiera fragmentu [trolley] (host nie jest pokazywany). STOP.
-- kod wyjscia: 1 (oczekiwane 1)

### KROK 3c — bramka: uszkodzony plik kopii (sha256 sie nie zgadza) — ma ODMOWIC
[demo] BŁĄD: sha256 pliku NIE ZGADZA SIĘ z manifestem (jest 4e3984fad84e3f64248acff8bff71b38c8bb9fe3e8cab5ea611b5ecdeb72a77f, ma być 86d6a76633d44358149b7c9b274f1168ba413cb40797b1de9cbd090674006646). STOP.
-- kod wyjscia: 1 (oczekiwane 1)
-- plik przywrocony do stanu z manifestu

### KROK 4 — przywrocenie NA SERIO do consultify_demo_proba
[demo] manifest OK: /private/tmp/dumps-proba/proba-lokalna-20260906T054009Z.dump (10297016 B, sha256 86d6a76633d44358149b7c9b274f1168ba413cb40797b1de9cbd090674006646)
[demo] zrzut pochodzi z: 127.0.0.1:54400/consultify_noc
[demo] cel przywrócenia:  127.0.0.1:54400/consultify_demo_proba
[demo] PRZYWRACAM (pg_restore --clean --if-exists) — to NADPISUJE obiekty w celu.
[demo] pg_restore zakończony kodem 1, linii błędów: 11 (log: /private/tmp/dumps-proba/proba-lokalna-20260906T054009Z.dump.restore.log)
[demo] SPRAWDŹ TERAZ: bash scripts/demo/sprawdz-demo.sh --tylko-baza
(czas przywrocenia)  0.15s user 0.06s system 0% cpu  25.891 total  <- 26 s na 1802 tabele
-- tabel PO przywroceniu:
1802
-- organizacji / uzytkownikow PO przywroceniu:
104 org / 65 users
-- 11 linii bledow pg_restore (jawnie, zeby nie udawac ze ich nie bylo):
   pg_restore: error: could not execute query: ERROR:  insert or update on table "artifact_lifecycle_events" violates foreign key constraint "artifact_lifecycle_events_organization_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_ingest_runs" violates foreign key constraint "financial_statement_ingest_runs_organization_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_ingest_runs" violates foreign key constraint "financial_statement_ingest_runs_statement_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_quality_runs" violates foreign key constraint "financial_statement_quality_runs_statement_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_source_artifacts" violates foreign key constraint "financial_statement_source_artifacts_statement_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_validations" violates foreign key constraint "financial_statement_validations_statement_pack_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_values" violates foreign key constraint "financial_statement_values_source_candidate_row_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_values" violates foreign key constraint "financial_statement_values_statement_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "financial_statement_versions" violates foreign key constraint "financial_statement_versions_statement_id_fkey"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "artifact_lifecycle_events" violates foreign key constraint "fk_artifact_lifecycle_events_artifact_org"
   pg_restore: error: could not execute query: ERROR:  insert or update on table "artifact_lifecycle_events" violates foreign key constraint "fk_artifact_lifecycle_events_bv_org"

### KROK 5 — ZNALEZISKO: przywrocenie gubi 11 KLUCZY OBCYCH (dane komplet, wiezy nie)
kluczy obcych zrodlo=1681 przywrocone=1670 (roznica 11)
wiersze NIE zginely (artifact_lifecycle_events 1547=1547, financial_statement_values 295=295)
przyczyna: ALTER TABLE ADD CONSTRAINT nie przechodzi walidacji, bo w ZRODLE sa juz wiersze-sieroty
brakujace wiezy:
   artifact_lifecycle_events_organization_id_fkey
   financial_statement_ingest_runs_organization_id_fkey
   financial_statement_ingest_runs_statement_id_fkey
   financial_statement_quality_runs_statement_id_fkey
   financial_statement_source_artifacts_statement_id_fkey
   financial_statement_validations_statement_pack_id_fkey
   financial_statement_values_source_candidate_row_id_fkey
   financial_statement_values_statement_id_fkey
   financial_statement_versions_statement_id_fkey
   fk_artifact_lifecycle_events_artifact_org
   fk_artifact_lifecycle_events_bv_org

### KROK 6 — seed organizacji pilotazowej: --dry-run (nic nie pisze)
[pilotaz] cel:          127.0.0.1:54400/consultify_demo_proba
[pilotaz] organizacja:  DBR77 Pilotaż (id 92058fa0-f84a-5e18-9c8d-55c2cca4f7d9)
[pilotaz] tryb:         dry-run (aliasy +pilotaz)

--- PLAN ---
organizacja: utworzy
konto        pilotaz.admin+pilotaz@dbr77.com        utworzy
konto        tomasz.jankowski+pilotaz@dbr77.com     utworzy
konto        katarzyna.marszalkiewicz+pilotaz@dbr77.com utworzy
konto        irina+pilotaz@dbr77.com                utworzy
konto        justyna.laskowska+pilotaz@dbr77.com    utworzy
członkostwo  pilotaz.admin+pilotaz@dbr77.com        utworzy
członkostwo  tomasz.jankowski+pilotaz@dbr77.com     utworzy
członkostwo  katarzyna.marszalkiewicz+pilotaz@dbr77.com utworzy
członkostwo  irina+pilotaz@dbr77.com                utworzy
członkostwo  justyna.laskowska+pilotaz@dbr77.com    utworzy

[pilotaz] dry-run: 11 rzeczy do zmiany. Nic nie zapisano.
-- kod wyjscia: 0

### KROK 7 — seed --apply (pierwszy raz)
członkostwo  irina+pilotaz@dbr77.com                utworzy
członkostwo  justyna.laskowska+pilotaz@dbr77.com    utworzy

[pilotaz] hasła (5) zapisane do /private/tmp/proba-hasla-pilotaz.txt (chmod 600). NIE są drukowane.

[pilotaz] utworzono=11 zmieniono=0
-- POMIAR ZAPYTANIEM (nie deklaracja):
organizacji: 1 | kont: 5 | czlonkostw: 5 | superadminow wsrod nich: 0 | typ org: PAID
awk: syntax error at source line 1
 context is
	{print $1, >>>  $5\ <<< " B\"}
awk: illegal statement at source line 1
-- plik hasel:  (tresc NIE jest drukowana)
-- plik hasel: uprawnienia -rw-------, rozmiar 430 B, wierszy 5 (tresc NIE jest drukowana)

### KROK 8 — seed --apply DRUGI RAZ (dowod idempotencji)
członkostwo  justyna.laskowska+pilotaz@dbr77.com    bez zmian

[pilotaz] utworzono=0 zmieniono=0
[pilotaz] idempotentnie: nic nie było do zrobienia.
-- POMIAR ZAPYTANIEM po drugim --apply:
kont: 5
-- czy powstal drugi plik hasel (nie powinien, bo nic sie nie zmienilo): NIE

### KROK 9 — sprawdz-demo.sh --tylko-baza na bazie probnej (OCZ_KLUCZE=1681 ze zrodla)
POMINIĘTE zdrowie
OK        baza: cel 127.0.0.1:54400/consultify_demo_proba
OK        baza: tabel=1802 organizacji=105
OK        baza: schemat załadowany (1802 tabel > 500)
OK        baza: organizacja DBR77 Pilotaz istnieje
OK        baza: kont pilotażu aktywnych = 5 (≥5)
OK        baza: członkostw ACTIVE = 5 (≥5)
INFO      baza: kont z rolą SUPERADMIN w całej bazie = 1 (seed pilotażu żadnego nie nadaje)
ŹLE       baza: kluczy obcych = 1670, oczekiwano 1681 — przywrócenie zgubiło więzy
POMINIĘTE flagi
-----
WERDYKT: NIEZGODNOŚĆ (patrz linie ŹLE / POMINIĘTE)
-- kod wyjscia: 1 (1 = wykryl brak 11 kluczy obcych, i o to chodzi)

### KROK 10 — sprawdz-demo.sh --tylko-flagi (realne zmienne staging vs demo, odczyt railway)
POMINIĘTE zdrowie
POMINIĘTE baza
ŹLE       flagi: demo NIE MA zmiennej CSRF_MODE (ma być „report")
ŹLE       flagi: demo NIE MA zmiennej AI_BUDGETS_ENABLED (ma być „true")
OK        flagi: DATABASE_URL ustawione
OK        flagi: APP_ENV ustawione = „demo"
OK        flagi: FRONTEND_URL ustawione = „https://demo.consultify.ai"
ŹLE       flagi: na demo BRAKUJE 27 flag ze stagingu: ENABLE_SIGNAL_PRODUCER ENABLE_TEST_SUPPORT VITE_ASSESSMENT_DOCX_ENABLED VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED VITE_DRD_REPORT_ENABLED VITE_FINANCE_VALUE_PANELS VITE_GALERIA_SZABLONOW_ENABLED VITE_I18N_DEBUG VITE_IDEA_DECISION_LOG VITE_IDEA_DETAILS_IN_PANEL VITE_IDEA_FINANCIAL_CASE VITE_INITIATIVE_BRIDGE VITE_INTERVIEW_PENDING_REVIEW_TAB VITE_INTERVIEW_PIPELINE_STEPPER VITE_MELS_PREZENTACJE VITE_MELS_TABELE VITE_MYWORK_TWO_LEVEL_NAV VITE_NAV_DECLUTTER VITE_QUICK_ACCESS_ENABLED VITE_RECORD_PROVENANCE VITE_RESULTS_VNEXT_MANAGEMENT_REPORT_ENTRY_ENABLED VITE_STUDIO_ENABLED VITE_TEMPLATE_LIFECYCLE VITE_TOOLS_INSIGHTS_WIRING VITE_VF1_CANVAS_SPECA VITE_VF1_INIT_SPECA VITE_ZAI_TERESA_ENABLED
ŹLE       flagi: 2 flag o SPRZECZNEJ wartości: ENABLE_TEST_GATEWAY ENABLE_V8_SHADOW_MODE
INFO      flagi: 4 flag zapisanych inną formą tej samej prawdy (1 vs true): VITE_TABELE_CONVERSIONS VITE_TABELE_FORM_INTAKE VITE_TABELE_QA VITE_TABELE_SOURCE_PACK
INFO      flagi: 22 flag jest TYLKO na demo (staging ich nie ma): ENABLE_DELIVERABLES_LIGHT ENABLE_DELIVERABLES_PREMIUM ENABLE_SHARED_IDEA_MAPS ENABLE_TABLE_AI_EDITOR ENABLE_TABLE_ARTIFACT_CONVERSION ENABLE_TABLE_FORM_INTAKE_JWT ENABLE_TABLE_PLATFORM_RECORDS_API ENABLE_TABLE_QA_ENGINE ENABLE_TABLE_SOURCE_PACK ENABLE_TERESA_IDEA_ACTIONS VITE_DEMO_ACCEPTANCE VITE_ENABLE_DECK_COLLABORATE VITE_ENABLE_TERESA_IDEA_ACTIONS VITE_FIN007_POST_INVESTMENT_REVIEW_ENABLED VITE_INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS VITE_INTERNAL_TOOLS_ALLOWED_ORG_NAMES VITE_INTERNAL_TOOLS_ALLOWED_ROLES VITE_RESULTS_RECOVERY_CARD_ENABLED VITE_RESULTS_VNEXT_KPI_ENABLED VITE_RESULTS_VNEXT_OKR_ENABLED VITE_RESULTS_VNEXT_ROI_ENABLED VITE_TABELE_AI_EDITOR
-----
WERDYKT: NIEZGODNOŚĆ (patrz linie ŹLE / POMINIĘTE)
-- kod wyjscia: 1

### KROK 11 — sprawdz-demo.sh --tylko-zdrowie na ZYWYM demo (odczyt HTTP)
OK        zdrowie: status=ok
OK        zdrowie: database=connected
OK        zdrowie: gitSha = wdrożony commit (f3237e94230481d2bf4ad0a9c0dc10b1391191c9)
POMINIĘTE baza
POMINIĘTE flagi
-----
WERDYKT: zgodność
-- kod wyjscia: 0

### KROK 12 — SPRZATANIE po probie
DROP DATABASE
-- bazy w kontenerze po sprzataniu:
consultify_noc
postgres
-- pliki hasel probnych usuniete: TAK
-- zrzut probny zostawiony do wgladu: /private/tmp/dumps-proba/proba-lokalna-20260906T054009Z.dump

=== KONIEC PROBY 2026-09-06T05:42:52Z ===

```
