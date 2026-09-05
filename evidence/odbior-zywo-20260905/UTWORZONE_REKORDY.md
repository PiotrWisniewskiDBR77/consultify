# Rekordy utworzone podczas odbioru na żywo — RUNDA 2 (05.09.2026)

Zgodnie ze zmianą zasad właściciela (05.09): wolno tworzyć REALISTYCZNE rekordy na stagingu tam,
gdzie ekran jest pusty z braku danych. Treść biznesowo sensowna dla organizacji DBR77, po polsku.
Zakaz usuwania i edycji istniejących rekordów właściciela pozostaje w mocy.

| Moduł | Nazwa rekordu | id | Trasa | Po co |
|---|---|---|---|---|
| Ocena | Sesja DRD „Digital Readiness Diagnosis" dla DBR77 (3 odpowiedzi w obszarze Procesy Sprzedaży: rejestracja zamówień w ERP, procedura sprzedaży robotyzacji linii spawalniczej, tygodniowy raport lejka) | 203d5476-657b-4033-9ff3-d2c177dc047c | /assessment/drd/203d5476-657b-4033-9ff3-d2c177dc047c | Próba dojścia do zamrożonego Outputu (assessment-output-report, assessment-presentation-view) — sesja doprowadzona do stanu „Do przeglądu"; zamrożenie zablokowane brakiem roli approver |
| Finanse | Budżet wdrożenia robotyzacji 2027 — linia spawalnicza (artefakt kanoniczny BASELINE_MODEL) | artifactId 0073fc01-9072-4cae-8a2b-38caa06a0b75 / businessVersionId e63de345-6f7b-45da-b9f1-d927ac452c06 | /finance?canonicalArtifactType=BASELINE_MODEL&canonicalArtifactId=0073fc01-9072-4cae-8a2b-38caa06a0b75&canonicalBusinessVersionId=e63de345-6f7b-45da-b9f1-d927ac452c06 | Sprawdzenie tezy rundy 1: czy istnieje JAKIKOLWIEK rekord, na którym montuje sie FinanceWorkspaceUtilities (baza stagingu miala 0 artefaktow kanonicznych) |
| Finanse | Wycena linii spawalniczej po robotyzacji — DBR77 2027 (artefakt kanoniczny VALUATION_CASE) | artifactId b223da23-c9d0-4f27-a555-f0c9e8b37376 / businessVersionId 271227eb-1ab5-4812-9cfe-678f06da2702 | /finance?canonicalArtifactType=VALUATION_CASE&canonicalArtifactId=b223da23-c9d0-4f27-a555-f0c9e8b37376&canonicalBusinessVersionId=271227eb-1ab5-4812-9cfe-678f06da2702 | Nosnik odbioru 6 ekranow: FinanceWorkspaceBar + 5 paneli narzedziowych (Powiazania/Porownaj/Komentarze/Widoki/Excel) |
| Finanse | Robotyzacja linii spawalniczej DBR77 — case 2027 (valuation case) | 3433f38a-e8f4-4be8-a87c-f7d98be8c66e | /finance (API /finance-v2/valuation/cases) | Kontener wariantu wyceny — bez niego pasek tozsamosci pokazywal 'v—' i blad 404 |
| Finanse | Wariant bazowy — gniazdo spawalnicze 2 zmiany (valuation variant) | businessVersionId 271227eb-1ab5-4812-9cfe-678f06da2702 | jw. | Realna nazwa i wersja w pasku tozsamosci (finance-workspace-bar) |
| Finanse | 2 komentarze (1 blokujacy) + 2 pozycje listy kontrolnej na artefakcie BASELINE_MODEL 0073fc01… | — | jw. | Wypelnienie panelu Komentarze trescia (proba pierwsza, przed przeniesieniem na artefakt wyceny) |
| Finanse | 2 komentarze (1 blokujacy) + 1 pozycja listy kontrolnej na artefakcie VALUATION_CASE b223da23… | — | jw. | Wypelnienie panelu Komentarze trescia do porownania z obrazem zatwierdzonym |
| Finanse → Wycena przedsiębiorstw | DBR77 Sp. z o.o. — wycena Q3 2026 | f20ef19f8efe4f12900f3db05acd8499 (wariant 3a988936-3003-48c3-8369-1bfc9e515d22) | /finance?tab=valuation | proba dojscia do kroku „Wyniki" z panelem EV koszyk metod (ev-football-field); rekord utknal na kroku Zrodlo — brak endpointu tworzacego powiazanie lineage (NO_VALUATION_SOURCE_EDGE), udokumentowana luka pakietu B3 |
| Narzędzia (Dynamic SWOT) | Dynamic SWOT — Session (853a73cf) | 853a73cf-6ea9-473e-bea9-05e33384b54a | /discovery-tools?tab=sessions&docId=853a73cf-6ea9-473e-bea9-05e33384b54a | próba dojścia do ekranu `tools-swot-report` — w bazie nie było ANI JEDNEJ zatwierdzonej sesji SWOT ani żadnego rezultatu (`/api/tool-outputs` = pusto), a raport powstaje dopiero z zatwierdzonej sesji |
| Audyty | Źródło wymagań „PW-ROB-01 — Procedura wewnętrzna DBR77: gotowość stanowiska do robotyzacji" (rew. 2.1) | ans_78f54cd2-3789-408a-a53c-ea00b39f8e80 | /audit-programs?tab=library (źródło pakietu) | Pakiet audytowy nie może być opublikowany bez przypisanego źródła |
| Audyty | Pakiet audytowy „Audyt gotowości do robotyzacji — linia spawalnicza" (3 domeny, 6 kryteriów po polsku: powtarzalność detalu, oprzyrządowanie, media i odciąg, ocena ryzyka gniazda, przepływ zleceń, kompetencje zespołu) — opublikowany | apk_56c9594a-3d8f-48c2-8e95-b62e26fb218e | /audit-programs?tab=library | Biblioteka audytów była pusta; bez opublikowanego pakietu nie da się rozpocząć audytu |
| Audyty | Sesja audytowa „Audyt gotowości do robotyzacji — linia spawalnicza — 05/09/2026" (etap Planowanie, 9 kryteriów) | aprog_9e1d5652-c277-4178-8697-c1a7e105f7cf | /audit-programs?tab=processes | Dojście do warsztatu kryterium (audyty-warsztat-kryterium) i sprawdzenie ścieżki wystawienia raportu (audyty-raport-dokument) |
| Materiały (Document Studio) | Nowy dokument — pusty, z wstawionymi blokami Tabela/KPI/Wykres (sekcja robocza „Sekcja robocza — puste bloki do odbioru”) | artifact-2dfa9b26-9cb3-4da4-92de-b58804252e53 | /document-studio/artifact-2dfa9b26-9cb3-4da4-92de-b58804252e53 | dowód z żywej aplikacji dla ekranu document-studio-blocks-i18n — realne bloki dokumentu zamiast dev-render harnessu; nie dało się użyć cudzego dokumentu (zakaz edycji rekordów właściciela) |
| Audyty | Output programu audytowego v1 („Output — Audyt gotowości do robotyzacji — linia spawalnicza — 05/09/2026", hash 8bd2bc0c33da) | aout_261354fb-3808-4185-bda9-d75f47211785 | /audit-programs?tab=outputs&ff_auditsReportChain=1 | Raport z audytu powstaje wyłącznie z Outputu — bez niego zakładka Raporty jest pusta |
| Audyty | Raport poaudytowy v1 (szkic) „Raport poaudytowy — Output — Audyt gotowości do robotyzacji — linia spawalnicza — 05/09/2026" | arep_a2ac215a-bcd8-48f2-bc46-0629453624d0 | /audit-programs/reports/arep_a2ac215a-bcd8-48f2-bc46-0629453624d0 | Odbiór ekranu audyty-raport-dokument (powłoka artefaktu dokumentowego) |
| Audyty | Członkostwo w programie: Piotr Wiśniewski jako audytor wiodący (lead_auditor) programu aprog_9e1d5652 | apmem_80dbbc4b-d0d9-46dd-bbbe-8395684e9e6e | /audit-programs?tab=processes | Rola program_owner nie ma uprawnienia output.finalize — bez roli audytora wiodącego łańcuch Output→Raport jest zablokowany |
| Moja praca / Pomysły | Cyfrowy bliźniak linii montażowej — analiza wykonalności (narzędzie: Tabela) | 400d107a-1cdb-4b25-bf49-7d323942f91b | /my-work/ideas/400d107a-1cdb-4b25-bf49-7d323942f91b/workspace/table | Odbiór ekranów `idea-table-tool-kebab` i `idea-table-tool-paste` — test menu wiersza (prawy-klik) i wklejania ze schowka bez dotykania tabel właściciela |

# Rekordy utworzone podczas odbioru na żywo — RUNDA 4 (05.09.2026)

| Moduł | Nazwa rekordu | id | Trasa | Po co |
|---|---|---|---|---|
| Ocena | Zamrożenie sesji DRD 203d5476 (z rundy 2) — POST /api/method/sessions/:id/freeze wykonany jako SUPERADMIN, powstał AssessmentOutput v1 | output 92f3bd7f-7048-44c8-a023-392b982c52ee (frozenSnapshotId 40e92571-cddc-4a65-9b25-8e4b45669014, sesja 203d5476-657b-4033-9ff3-d2c177dc047c → wersja v5, stan frozen) | /assessment/outputs/92f3bd7f-7048-44c8-a023-392b982c52ee/report i .../presentation (za ?ff_assessmentOutputArtifacts=1) | Weryfikacja czy serwerowa naprawa freeze (403→200) faktycznie działa i czy AssessmentReportView/AssessmentPresentationView renderują się zgodnie z obrazem zatwierdzonym dla CZEKA_NA_SERWER: assessment-output-report/assessment-artifacts-restart/assessment-presentation-view |
| Ocena | Report Snapshot "Raport DRD — Sesja DRD — wynik cząstkowy" wygenerowany przyciskiem "Generuj raport z Outputu" na powyższym Outpucie | (snapshot inline w AssessmentOutput, brak osobnego id widocznego w UI) | /assessment/drd/203d5476-657b-4033-9ff3-d2c177dc047c | Sprawdzenie czy przycisk generowania raportu na surowym method-core widoku działa; okazało się że to inny, uboższy widok niż docelowy raport (patrz DANE dla assessment-output-report) |

- 05.09 ~12:50 — `uzupelnij-jednostki-20260905.mjs --wykonaj`: business_unit dla 10 ocen DBR77 (Zarząd Grupy / Logistyka / IT / Produkcja spawalnicza), decyzja właściciela A (jednostka-formularz).

# Działania podczas odbioru na żywo — RUNDA 6 (05.09.2026) — decyzja właścicielska: włączenie ROI dla DBR77

Decyzja: właściciel (rola OWNER, sesja Piotr Wiśniewski) zapisał na stronie decyzji (05.09) polecenie
włączenia ROI dla organizacji DBR77 na stagingu. To NIE jest utworzenie rekordu demo — to jednorazowa,
nieodwracalna publikacja polityki widoczności (governance), wykonana narzędziem UI wprost przewidzianym
do tego celu.

| Co | Szczegóły |
|---|---|
| Akcja | Kliknięcie przycisku „Włącz ROI dla organizacji" na `/results/roi` (Wyniki → ROI, POZIOM 1, pusty stan `roiDisabledForOrg`) |
| Endpoint | `POST /api/vnext/results/roi/visibility-policy` (idempotencyKey losowy z klienta) → **201**, `outcome: "applied"` |
| Organizacja | `a3e05d4a-5397-419d-b486-8e44366c0063` (DBR77) |
| Polityka | `policyKey: "AMD-FLOW-ROI-VISIBILITY-002/v1"` |
| Kto opublikował | `publishedBy: d2b6a316-08c5-47cf-9bf7-4ba50311d5a2` (sesja zalogowana jako Piotr Wiśniewski, OWNER) |
| Kiedy | 2026-09-05T10:33:48.029Z |
| Weryfikacja po fakcie | Przeładowanie `/results/roi` (bez ponownego klikania) pokazuje: przycisk zmienił się z „Włącz ROI dla organizacji" na „Nowa sprawa ROI"; `GET /api/vnext/results/roi/visibility-policy` → `published:true` (potwierdzone pośrednio zniknięciem CTA aktywacji i pojawieniem się rejestru z realną sprawą) |
| Efekt uboczny odkryty, nie utworzony przeze mnie | W organizacji już istniała JEDNA realna sprawa ROI — „Program poprawy realizacji korzyści" (`dbedad0d-bc57-4f71-a212-dad7b1ba7a47`, status Szkic, właściciel Piotr Wiśniewski, PLN, ostatnia aktualizacja 13 sie 2026) — była niewidoczna wyłącznie z powodu braku wiersza governance. **Nie utworzyłem żadnej nowej sprawy ROI** — ta jedna wystarczyła do zweryfikowania wizualnego formuły jednej karty N, więc warunek „stwórz JEDNĄ realistyczną sprawę, jeśli ekran jest pusty" z instrukcji rundy 6 nie miał zastosowania. |
| Skrypt użyty | `/private/tmp/odbior-zywo-skrypty/08-wyniki/runda6-enable-roi.mjs` (Playwright, ta sama sesja ODBIOR_AUTH_STATE, przechwytuje odpowiedzi sieciowe GET/POST na `visibility-policy` do `evidence/odbior-zywo-20260905/08-wyniki/runda6/klik-siec.json`) |

# Działania podczas odbioru na żywo — RUNDA 6, druga sesja (05.09.2026) — Baseline v3 dla DBR77

Żaden rekord NIE został utworzony ani usunięty w tej sesji. Jedyna zmiana stanu:

| Co | Szczegóły |
|---|---|
| Akcja | Nawigacja z parametrem URL `?ff_wave3FinanceOwnerReview=1` (src/utils/financeOwnerReviewMode.ts) — istniejący, przewidziany w kodzie mechanizm "owner review mode" dla ekranów Finance v3 (baseline/prediction/analysis/valuation) |
| Efekt | Zapisuje `ff.wave3_finance_owner_review=1` w localStorage TEJ przeglądarki/pliku sesji (`/private/tmp/odbior-auth/auth.json`) — NIE zmienia niczego w bazie ani dla innych użytkowników/przeglądarek |
| Powód | Właściciel (05.09, decyzja przekazana nadzorcy) chce Baseline v3 (pełna tabela) zamiast klasycznego widoku; serwerowa flaga `financeBaselineWorkspaceV1` jest dla DBR77 ustawiona na `enabled=false` w tabeli `feature_flags`, a zmiana tego wiersza wymaga roli superadmin (token OWNER dostał 403 na /api/feature-flags) |
| Próba DB write | NIE wykonana. Dokładny SQL do wykonania przez kogoś z sesją superadmin: `UPDATE feature_flags SET enabled = true, updated_at = now() WHERE flag_key = 'financeBaselineWorkspaceV1';` |
| Odkryty efekt uboczny | Nawet z flagą włączoną lokalnie, jedyny kanoniczny artefakt BASELINE_MODEL dla DBR77 (0073fc01-9072-4cae-8a2b-38caa06a0b75 / businessVersionId e63de345-6f7b-45da-b9f1-d927ac452c06, utworzony w Rundzie 2) daje 409 `BASELINE_CONTEXT_NOT_CONFIGURED` — kontekst modelu nigdy nie został skonfigurowany. Nie próbowałem tego naprawić przez PUT (wymaga danych domenowych — okresy prognozy/okres otwarcia — których nie mam pewności, że dobrałbym poprawnie; ryzyko utworzenia strukturalnie złych danych). Zgłoszone jako spec dla robotnika w `09-finanse/wyniki.json` (finance-baseline-workspace, runda 6). |

- 05.09 ~13:00 — feature_flags.financeBaselineWorkspaceV1 → enabled=true (decyzja właściciela POPRAWKA: Baseline v3 pełna tabela).

## 2026-09-05 — KPI, trzypoziomowa formuła (odbiór na żywo, agent `agent/kpi-tabela-lista-karta`)

| Co | Gdzie | Jak utworzone | Po co |
|---|---|---|---|
| Pozycja zestawienia: `Acceptance KPI — benefits realization` w zestawieniu `Karta wyników transformacji` | staging (baza `trolley`), `rvn_kpi_scorecard_items`; zestawienie `4fdc1bb9-dd71-4dda-a4a4-9e03fa87faf4`, KPI `e635d6a0-eee1-448b-a932-a8a435eb9f14` | PRZEZ UI — ekran pełnej karty wyników → dialog „Dodaj KPI do karty wyników" (`kpi-scorecard-add-item-cta`), notatka: „Odbiór trzypoziomowej formuły KPI 05.09…"; skrypt klików: `scripts/dev/kpi-3poziomy-20260905/dodaj-kpi-do-zestawienia.mjs` | Staging miał JEDNO zestawienie z ZEREM pozycji — poziomu 2 (lista zestawienia z pozycjami) nie było na czym pokazać ani odebrać |

Nic poza tym nie zostało utworzone ani zmienione. Rekord jest odwracalny z UI
(kebab pozycji → „Usuń pozycję"), gdyby właściciel chciał wrócić do pustego
zestawienia.

Zrzuty odbioru: `evidence/odbior-zywo-20260905/kpi-3poziomy/`
(`L1-tabela-zestawien.png` — stan przed dodaniem, z wierszem systemowym
„Bez zestawienia"; `L1-tabela-zestawien-podglad.png` — poziom 1 z otwartym
podglądem; `L2-lista-zestawienia.png`; `L3-karta-N-wskaznika.png`).
