# TEMPLATE-1 — KROK 0: plan mapowania 96 szablonów i zmian w bazie

**Status:** `GO Z POPRAWKAMI W118 / IMPLEMENTACJA TRZECH BAZ`

**Data:** 2026-09-16

**Baza kodu:** `9981c41c2d5a14d87418066d340d77b39e2c5df4`

**Decyzje:** Wpis 108, DEC-558..561

**Zakres wykonany:** dokumentacja i preflight. Zero kodu produkcyjnego, migracji, zapisu do DB i stagingu.

## 1. Wynik KROKU 0

Wszystkie 96 pozycji otrzymują jedną z trzech rodzin layoutu oraz decyzję `ZOSTAJE`, `PRZEBUDOWA` albo `LECI`:

| Rodzina docelowa | Reguła | Wszystkie pozycje | Aktywne po czystce |
|---|---|---:|---:|
| `DOC-BASE` | Jeden system layoutu dokumentu; moduł dostarcza treść i dane | 78 | 29 |
| `DECK-BASE` | Jeden system layoutu prezentacji; moduł dostarcza treść i dane | 16 | 5 |
| `SHEET-BASE` | Jeden system layoutu arkusza; moduł dostarcza kolumny, dane i formuły | 2 | 2 |
| **Razem** |  | **96** | **36** |

Bilans decyzji zgadza się z inwentarzem: `ZOSTAJE=20`, `PRZEBUDOWA=16`, `LECI=60`. `DRD Presentation Deck` (#53) przechodzi z błędnego rejestru raportów do `DECK-BASE`, stąd docelowy rozkład rodzin to 78/16/2, a nie obecny rozkład formatów 79/15/2.

`ZOSTAJE` zachowuje identyfikator i działającego wołacza. `PRZEBUDOWA` zachowuje intencję biznesową, ale dziedziczy layout, fonty, branding i reguły eksportu z jednej rodziny. `LECI` oznacza wygaszenie, nigdy `DELETE`: rekord źródłowy staje się nieaktywny/deprecated, a jego karta w migawce dostaje `is_draft=1`.

## 2. Dwie warstwy, które muszą zostać zmienione razem

Warstwa źródłowa jest SSOT dla generacji:

- dokument systemowy: `document_studio_templates` (`section_blueprint`, `formatting_schema`, `export_rules`);
- raporty z żywymi wołaczami: `report_builder_templates` (`sections_json`, `default_options_json`, `is_active`, `is_default`);
- prezentacje: `presentation_templates` (`outline_json`, `theme`, `layout_policy_json`, lifecycle);
- arkusze: `tp_base_templates` (`schema_snapshot`, `governance_rules`, lifecycle).

Warstwa biblioteki jest migawką: `v8_output_artifacts` plus `v8_artifact_origin_links`. Ekran czyta m.in. `title_snapshot`, `origin_summary_json`, `template_family_ref` i `is_draft`; samo poprawienie tabel źródłowych nie poprawi karty. Generacja ma nadal czytać świeżą strukturę ze źródła, a nie z migawki.

Kolejność przyszłego zapisu w jednej transakcji danych:

1. Zbudować tymczasową tabelę mapowania dokładnie z Załącznika A i sprawdzić denominator `96`.
2. Zablokować `FOR UPDATE` 96 wierszy migawki i odpowiadające im rekordy źródłowe przez `v8_artifact_origin_links`.
3. Przerwać transakcję, jeśli brakuje źródła, jest więcej niż jeden link, runtime nie pasuje albo liczby 20/16/60 nie zgadzają się z planem.
4. Zmienić źródła.
5. Odświeżyć istniejące wiersze `v8_output_artifacts`; nie tworzyć drugiej karty dla tego samego źródła.
6. Sprawdzić readback obu warstw i dopiero zatwierdzić transakcję.

## 3. Dokładna lista proponowanych zmian w bazie

### 3.1 Czystka 60 pozycji `LECI`

Zmiana jest idempotentna i nie kasuje danych:

| Rejestr źródłowy | Liczba | Numery z Załącznika A | Proponowana mutacja źródła |
|---|---:|---|---|
| `document_studio_templates` | 39 | 3–6, 8, 10–14, 16, 18–24, 26–46 | `status='deprecated'`, `deprecated_at`, `deprecated_by`, bez zmiany payloadu |
| `report_builder_templates` | 10 | 50, 54, 55, 59, 65, 67, 68, 70, 72, 79 | `is_active=false`, `is_default=false` |
| `presentation_templates` | 11 | 82–92 | `is_active=false`, `lifecycle_state='deprecated'`, `deprecated_at/by`, powód z mapy |
| `tp_base_templates` | 0 | — | brak |

Dla dokładnie tych 60 źródeł ich istniejące wpisy `v8_output_artifacts` dostają `is_draft=1`, `template_family_ref` zgodny z Załącznikiem A oraz status `deprecated` w `origin_summary_json.template.status`. Dwadzieścia dwa wiersze `(PL)` mają w źródle `status='approved'`, a wygaszona jest wyłącznie migawka (`is_draft=1`). Migracja czystki musi więc jawnie zmienić **obie** warstwy: źródło na deprecated/nieaktywne i istniejącą migawkę na draft/deprecated. Nie wolno uznać `is_draft=1` za dowód wygaszenia źródła ani wykonać no-opu.

### 3.2 Dwadzieścia pozycji `ZOSTAJE`

Pozycje 47, 48, 51, 52, 57, 58, 60–64, 66, 69, 71, 73–78 zachowują identyfikatory, payloady i wołacze w `report_builder_templates`. Nie wolno ich scalać fizycznie ani zmieniać `source_type`/`report_type`, ponieważ część jest wybierana po ID, a część po parze typów.

Jedyna zmiana katalogowa: ich istniejące migawki otrzymują `template_family_ref='DOC-BASE'`, `is_draft=0` i odświeżone `origin_summary_json` bez zmiany `artifact_id` lub linku źródłowego.

### 3.3 Szesnaście pozycji `PRZEBUDOWA`

| Rejestr | Liczba | Numery | Proponowana zmiana |
|---|---:|---|---|
| `document_studio_templates` | 7 | 1, 2, 7, 9, 15, 17, 25 | zachować ID; zastąpić strukturę profilem treści dziedziczącym `DOC-BASE`; EN; draft do testu |
| `report_builder_templates` | 3 | 49, 53, 56 | 49 i 56: zachować ID i wołacz, przebudować profil `DOC-BASE`; 53: patrz migracja formatu poniżej |
| `presentation_templates` | 4 | 80, 81, 93, 94 | zachować/rozwiązać ID źródła; profile treści dziedziczą `DECK-BASE`; draft do testu |
| `tp_base_templates` | 2 | 95, 96 | zachować/rozwiązać ID źródła; `schema_snapshot` z formułami i regułami `SHEET-BASE`; draft do testu |

Pozycja #53 wymaga addytywnego przejścia formatu w tej kolejności: utworzyć `presentation_templates.id='pt-drd-presentation-v2'` jako profil `DECK-BASE`, utworzyć/odświeżyć jego migawkę jako draft, przepiąć wołacz Assessment na nowy ID, wykonać test równoważności i dopiero po PASS ustawić `report_builder_templates.id='tpl-drd-presentation-v2'` jako nieaktywny oraz starą migawkę jako draft/deprecated. W żadnym momencie readback biblioteki nie może pokazać dwóch aktywnych kart jednego wołacza.

Wszystkie przebudowy pozostają `draft`/`is_draft=1` do przejścia bramki na żywej organizacji i obiekcie: każda sekcja/slajd/arkusz niepusty, brak tokenów `{{...}}`, jeden język, wiersze tabel obecne, eksport właściwego formatu przechodzi i render nie ma błędu. Dopiero po PASS status źródła i migawki staje się approved/published, a `is_draft=0`.

### 3.4 Konflikt dwóch defaultów KPI

- Pozostawić `tpl-results-kpi-report-default` (#63) jako jedyny `is_default=true` dla `RESULTS_KPI_REPORT / RESULTS_KPI_REPORT`.
- Ustawić `tpl-results-kpi-review` (#67) na `is_default=false` oraz `is_active=false`.
- Po preflightcie wykazującym brak innych konfliktów dodać addytywny, częściowy indeks unikalny dla aktywnych defaultów po `(source_type, report_type)` z predykatem `is_default=true AND is_active=true`.
- Migracja ma najpierw naprawić dane, potem utworzyć indeks; odwrotna kolejność zablokuje wdrożenie na istniejącym konflikcie.

## 4. Trzy systemowe szablony bazowe

### 4.1 `DOC-BASE`

- Kandydat źródłowy: `document_studio_templates.template_id='doc-template-system-en-client_final_report'` (#15).
- Docelowo: `organization_id='__system__'`, `is_system=true`, `language='en'`, `status='approved'`, `provenance_status='approved'`, wersja 1.0 po PASS i receipcie zatwierdzenia.
- Struktura: okładka, żywy TOC, osiem sekcji z makiety, tabele z powtarzanym nagłówkiem i `cantSplit`, slot wykresu, nagłówek i stopka.
- Payload: `section_blueprint`, `formatting_schema`, `export_rules`; generator podmienia dane i tekst, nie geometrię ani branding.

### 4.2 `DECK-BASE`

- Kandydat źródłowy: `presentation_templates.id='dbr77-deck-board'` (#81).
- Docelowo: system/global, `is_system=true`, `language_default='en'`, `is_active=true`, `lifecycle_state='approved'`, `provenance_status='approved'` po PASS i receipcie.
- Osiem layoutów: cover, agenda, section break, one-column content, two-column content, table, chart, decision.
- Payload: `outline_json`, motyw/brand oraz `layout_policy_json`; profile modułów wybierają intencje layoutu, ale nie tworzą własnego chrome.

### 4.3 `SHEET-BASE`

- Pozycja #95 (`artifact_id='0a757a44-2ef4-466a-9231-dff14b89e515'`) pozostaje rekordem Northwind bez zmiany scope. Nie wolno promować jej ani wskazanego wcześniej rekordu organizacji na systemowy.
- Powstaje **nowy** rekord `tp_base_templates` dla `SHEET-BASE`, zawierający wyłącznie schemat, reguły i tokeny. Ma `organization_id='__system__'`, `language='en'`, `status='approved'`, `visibility='system'` i `provenance_status='approved'` po PASS i receipcie.
- Nowy rekord systemowy dostaje własne migawki i origin links. Istniejących rekordów #95/#96 migracja trzech baz nie dotyka.
- Payload: tytuł i metryka, zamrożenie 2×6, nagłówki, formuły E/H/I/J, ważona suma, formaty liczb, formatowanie warunkowe, autofilter, print titles i arkusz mapy pól.

Pozostałe 33 aktywne pozycje są profilami treści tych trzech baz. Nie kopiują palety, fontów, marginesów ani layoutów do osobnego kanonu.

## 5. Reguły fontu, co-brandingu i defaultów

### Font

Decyzja Wpisu 108 ma pierwszeństwo przed makietami: **Aptos jako font główny, Arial jako fallback zapisany w pliku**. Wymaga to przebudowy artefaktów referencyjnych, bo obecny DOCX ma Arial w `w:docDefaults`, obecny XLSX ma komórki Arial przy motywie Cambria/Calibri, a PPTX ma jawne Arial w treści, lecz motyw nadal Calibri Light/Calibri. Żaden z trzech plików nie dowodzi obecnie wymaganego kontraktu Aptos→Arial.

Minimalny kontrakt odbioru:

- PPTX: major/minor Latin w theme = Aptos/Aptos Display, zero literalnych nazw fontów w runach; substytucja renderera udokumentowana na środowisku bez Aptos, bez embedowania subsetu;
- DOCX: theme Aptos, `docDefaults minorHAnsi`, `altName=Arial` w `fontTable.xml`, style odwołują się do theme;
- XLSX: theme major/minor Aptos, zero literalnych nazw fontów w runach/komórkach; substytucja renderera udokumentowana na środowisku bez Aptos, bez embedowania subsetu.

### Co-branding

- Okładka: marka Consultify/DBR77, bez klientowskiego logo jako głównego znaku.
- Stopka: logo klienta oraz nazwa organizacji; token szablonu nazywa się `client_logo`.
- Źródło runtime tokenu: `organizations.logo_url`. Repo nie ma kolumny `organizations.client_logo`; istnieje też `brand_kits.logo_url` i UI-owe `clientLogoUrl`. Nie dodawać nowej kolumny tylko dla nazwy tokenu. Generator mapuje `client_logo <- organizations.logo_url`; brak wartości daje pusty slot bez placeholdera `[LOGO]`.
- Każdy odczyt logo jest org-scoped; nie wolno brać logo z innej organizacji ani z przykładu Northwind.

### Defaulty

- Deck Builder: `dbr77-deck-board` / `DECK-BASE`.
- Document Studio i eksport DOCX: `doc-template-system-en-client_final_report` / `DOC-BASE`.
- Sheets: nowy rekord systemowy `SHEET-BASE`, `language='en'`; #95 pozostaje w scope Northwind.
- Istniejące, wyspecjalizowane defaulty `report_builder_templates` pozostają defaultami swoich par; family default wybiera layout, a source/report type wybiera profil treści.
- Dla każdej pary może istnieć dokładnie jeden aktywny `is_default`.

## 6. Dowody wejściowe i pomiary

- Inwentarz: 96 rekordów = 79 report + 15 presentation + 2 sheet; 20/16/60; 90 Application + 6 Organization.
- Aktywna biblioteka po planowanej czystce: 36 = 20 `ZOSTAJE` + 16 `PRZEBUDOWA`.
- Makiety zmierzone bezpośrednio w OOXML: PPTX ma 8 slajdów, 1 master, 1 layout, 1 wykres i 1 tabelę; DOCX ma osiem sekcji w strukturze dokumentu; XLSX ma 2 arkusze, formuły, 3 zakresy formatowania warunkowego, freeze panes i autofilter. PDF służy wyłącznie do kontroli obrazu, nie jako dowód struktury szablonu.
- Generatory `dane-northwind.mjs`, `deck.mjs`, `doc.mjs`, `sheet.mjs` przechodzą `node --check`.
- SHA-256 źródeł tekstowych: `PROPOZYCJA.md` `ec08228cf65532dc63018fe1be95656594b2eb3bc6eb542adad7b451ec9964fe`; `INWENTARZ.csv` `8a4d9b78879b2a6f3817c937fa14c3ba0a0bdd31f722ffc32697370300a8def1`.
- SHA-256 generatorów: dane `b4ecbd9549633a244783d50097a62eefa52896eddf8de7c8cb89848e17d7edbd`; deck `50e0c666ce73ac876de5b71c378d5291bbd401a1c12219c1e6c978e0ee2f0191`; doc `9605887638336e9eb1c057a9d6f4277395114985712f8d15a426457fb83cc2ea`; sheet `eba0082fd367e0683486a64d3dc8231165867a81fdd2fb055c49d4f33f89b04b`.
- SHA-256 artefaktów: PPTX `c726db5b012542afee467d9c7f0f438b4f95abb0eda8e045be5172052bed1419`; DOCX `182533c2d24dea4eb7a095b0b07ab129603f12a7e2f582a7741dc4e7135eadb6`; XLSX `506d1ade58e98a31ba2d1e04c495dcddf7398ff51edffb015d11e4730e592b63`.

## 7. Ryzyka i warunki STOP

1. **GO W118:** można zbudować trzy nowe/odświeżone bazy systemowe. Czystka 96 oraz przebudowa #93–96 pozostają osobnym etapem z fail-closed preflightem origin links.
2. **Linki #93–96:** każda pozycja musi mieć dokładnie jeden `v8_artifact_origin_links`, zgodny runtime i rekord źródłowy. Brak albo duplikat = STOP dla przebudowy tej pozycji; migracja nie tworzy brakującego źródła ani linku. Dump z 11.09 nie zawiera tych czterech artefaktów, więc ich przebudowa pozostaje poza paczką trzech baz do readbacku na aktualnych danych.
3. **SHEET-BASE jest nowym systemowym rekordem:** nie zmienia scope #95 ani #96. Payload systemowy zawiera wyłącznie schemat, reguły i tokeny, bez danych Northwind.
4. **Font nie jest jeszcze zgodny:** obrazy wyglądają spójnie, ale paczki Office nie zawierają wymaganego kontraktu Aptos→Arial. Nie wolno uznać makiet za gotowe pliki produkcyjne.
5. **Migawka może nadpisać ręczną zmianę:** każdy update `v8_output_artifacts` musi być zgodny z backfillem i linkiem źródłowym; po wdrożeniu wymagany jest ponowny backfill/readback.
6. **#53 ma zmianę runtime:** starego rekordu nie wygaszać przed przełączeniem i testem wołacza.
7. **Provenance:** `approved` bez rzeczywistego testu na żywej organizacji, niezależnego approvera i receipt byłoby fałszywą zielenią.
8. **Brak danych logo:** pusty `organizations.logo_url` ma dać uczciwy brak logo klienta, nie logo demo ani zepsuty obraz.

## 8. Bramka do KROKU 1 po akceptacji

Właściciel zatwierdza jednocześnie: listę 96, trzy ID bazowe, promocję sheet base do system scope, wygaszenie 60 bez kasowania, migrację #53 do rejestru prezentacji oraz kontrakt Aptos→Arial i `client_logo <- organizations.logo_url`. Dopiero wtedy można przygotować addytywną migrację i kod konsumentów. Każda zmiana ma mieć dry-run, liczby przed/po, transakcję, idempotency i readback obu warstw.

## Załącznik A — mapowanie wszystkich 96 pozycji

Kolumna `klucz` oznacza klucz źródłowy, gdy `runtime` jest znany. Dla #93–96 jest to klucz migawki; źródło musi zostać rozwiązane przez istniejący origin link. `REBUILD` pozostaje draft do PASS; `DEPRECATE` ustawia źródło nieaktywne i migawkę `is_draft=1`.

| # | Nazwa | Klucz z inwentarza | Rejestr / sposób rozwiązania | Rodzina | Decyzja / operacja |
|---:|---|---|---|---|---|
| 1 | Line audit report — Northwind standard | `doc-template-1789439070343-ovxij8xn` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 2 | Steering group pre-read — one page per workstream | `doc-template-1789439070624-rj84kztq` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 3 | [System] ai audit report (EN) | `doc-template-system-en-ai_audit_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 4 | [System] ai audit report (PL) | `doc-template-system-pl-ai_audit_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 5 | [System] benefits tracking report (EN) | `doc-template-system-en-benefits_tracking_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 6 | [System] benefits tracking report (PL) | `doc-template-system-pl-benefits_tracking_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 7 | [System] board report (EN) | `doc-template-system-en-board_report` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 8 | [System] board report (PL) | `doc-template-system-pl-board_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 9 | [System] business case (EN) | `doc-template-system-en-business_case` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 10 | [System] business case (PL) | `doc-template-system-pl-business_case` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 11 | [System] change management plan (EN) | `doc-template-system-en-change_management_plan` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 12 | [System] change management plan (PL) | `doc-template-system-pl-change_management_plan` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 13 | [System] client discovery report (EN) | `doc-template-system-en-client_discovery_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 14 | [System] client discovery report (PL) | `doc-template-system-pl-client_discovery_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 15 | [System] client final report (EN) | `doc-template-system-en-client_final_report` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD; BASE |
| 16 | [System] client final report (PL) | `doc-template-system-pl-client_final_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 17 | [System] decision memo (EN) | `doc-template-system-en-decision_memo` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 18 | [System] decision memo (PL) | `doc-template-system-pl-decision_memo` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 19 | [System] digital transformation roadmap (EN) | `doc-template-system-en-digital_transformation_roadmap` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 20 | [System] digital transformation roadmap (PL) | `doc-template-system-pl-digital_transformation_roadmap` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 21 | [System] due diligence note (EN) | `doc-template-system-en-due_diligence_note` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 22 | [System] due diligence note (PL) | `doc-template-system-pl-due_diligence_note` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 23 | [System] executive memo (EN) | `doc-template-system-en-executive_memo` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 24 | [System] executive memo (PL) | `doc-template-system-pl-executive_memo` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 25 | [System] implementation plan (EN) | `doc-template-system-en-implementation_plan` | document_studio_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 26 | [System] implementation plan (PL) | `doc-template-system-pl-implementation_plan` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 27 | [System] internal policy document (EN) | `doc-template-system-en-internal_policy_document` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 28 | [System] internal policy document (PL) | `doc-template-system-pl-internal_policy_document` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 29 | [System] interview summary report (EN) | `doc-template-system-en-interview_summary_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 30 | [System] interview summary report (PL) | `doc-template-system-pl-interview_summary_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 31 | [System] portfolio overview (EN) | `doc-template-system-en-portfolio_overview` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 32 | [System] portfolio overview (PL) | `doc-template-system-pl-portfolio_overview` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 33 | [System] project status report (EN) | `doc-template-system-en-project_status_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 34 | [System] project status report (PL) | `doc-template-system-pl-project_status_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 35 | [System] research report (EN) | `doc-template-system-en-research_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 36 | [System] research report (PL) | `doc-template-system-pl-research_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 37 | [System] risk register report (EN) | `doc-template-system-en-risk_register_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 38 | [System] risk register report (PL) | `doc-template-system-pl-risk_register_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 39 | [System] sales proposal (EN) | `doc-template-system-en-sales_proposal` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 40 | [System] sales proposal (PL) | `doc-template-system-pl-sales_proposal` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 41 | [System] sop document (EN) | `doc-template-system-en-sop_document` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 42 | [System] sop document (PL) | `doc-template-system-pl-sop_document` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 43 | [System] steering committee report (EN) | `doc-template-system-en-steering_committee_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 44 | [System] steering committee report (PL) | `doc-template-system-pl-steering_committee_report` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 45 | [System] workshop summary (EN) | `doc-template-system-en-workshop_summary` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 46 | [System] workshop summary (PL) | `doc-template-system-pl-workshop_summary` | document_studio_templates | DOC-BASE | LECI / DEPRECATE |
| 47 | Assessment Report (Default) | `tpl-assessment-default` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 48 | Assessment Summary Report | `tpl-assessment-summary-v2` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 49 | Audit Report | `dbr77-doc-audit-report` | report_builder_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 50 | Business Case | `mck-doc-business-case` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 51 | DRD Board Report | `tpl-drd-board-report-v2` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 52 | DRD Full Diagnostic Report | `tpl-drd-full-diagnostic-v2` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 53 | DRD Presentation Deck | `tpl-drd-presentation-v2` | report_builder_templates → presentation_templates | DECK-BASE | PRZEBUDOWA / MOVE+REBUILD |
| 54 | Diagnostic Report (DRD) | `mck-doc-diagnostic` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 55 | Executive Summary | `mck-doc-exec-summary` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 56 | Executive memo | `dbr77-doc-exec-memo` | report_builder_templates | DOC-BASE | PRZEBUDOWA / REBUILD |
| 57 | Final Transformation Report | `tpl-final-transformation-report` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 58 | Finance — report financial section | `tpl-finance-section` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 59 | Financial Analysis & Business Case | `tpl-financial-analysis` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 60 | Financial Analysis Report | `tpl-financial-analysis-export` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 61 | Interview Detailed Analysis | `tpl-interview-detailed` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 62 | Interview Summary Report | `tpl-interview-summary` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 63 | KPI Review Report | `tpl-results-kpi-report-default` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP; DEFAULT |
| 64 | PMO Weekly | `tpl-pm-weekly` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 65 | PMO Weekly Status | `mck-doc-pmo-weekly` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 66 | Program — three-axis report (time, tasks, value) | `tpl-program-3axis` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 67 | Results - KPI Performance Review | `tpl-results-kpi-review` | report_builder_templates | DOC-BASE | LECI / DEPRECATE; DROP DEFAULT |
| 68 | Sponsor One-Page Status | `mck-doc-sponsor-onepager` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 69 | Sponsor One-Pager | `tpl-pm-sponsor-onepager` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 70 | Status Report | `dbr77-doc-status-report` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 71 | Steering Committee / Program Update | `tpl-steering-committee` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 72 | Steering Committee Update | `mck-doc-steering-update` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 73 | Steering Report | `tpl-pm-steering` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 74 | Strategic Review & Executive Brief | `tpl-strategic-review-exec` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 75 | Tool Comparison Report | `tpl-tool-comparison` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 76 | Tool Evaluation Report | `tpl-tool-evaluation` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 77 | Tool Workshop Summary | `tpl-tool-workshop-summary` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 78 | Transformation Roadmap & Portfolio Review | `tpl-transformation-roadmap` | report_builder_templates | DOC-BASE | ZOSTAJE / KEEP |
| 79 | Valuation Pack & Investment Summary | `tpl-valuation-pack` | report_builder_templates | DOC-BASE | LECI / DEPRECATE |
| 80 | Assessment Summary | `pt-assessment` | presentation_templates | DECK-BASE | PRZEBUDOWA / REBUILD |
| 81 | Board deck | `dbr77-deck-board` | presentation_templates | DECK-BASE | PRZEBUDOWA / REBUILD; BASE |
| 82 | Diagnostic deck | `dbr77-deck-diagnostic` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 83 | Final Report Deck | `mck-deck-final-report` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 84 | Findings Readout | `mck-deck-findings-readout` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 85 | Investor pitch | `dbr77-deck-investor-pitch` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 86 | Kickoff Deck | `mck-deck-kickoff` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 87 | Program / Execution Update | `pt-program` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 88 | Recommendation Deck | `mck-deck-recommendation` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 89 | Steering Committee Update | `pt-steering` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 90 | Steering Review Deck | `mck-deck-steering-review` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 91 | Tool Workshop Summary | `pt-tool-workshop` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 92 | Valuation Pack | `pt-valuation` | presentation_templates | DECK-BASE | LECI / DEPRECATE |
| 93 | Board decision pack — Northwind standard | `fe1bff79-af1c-475b-b977-7437964e744a` | presentation_templates via origin link | DECK-BASE | PRZEBUDOWA / REBUILD |
| 94 | Site walkthrough read-out | `26499c9e-4915-4ec4-9ebf-4d6f5873e3c3` | presentation_templates via origin link | DECK-BASE | PRZEBUDOWA / REBUILD |
| 95 | Supplier quality scorecard | `0a757a44-2ef4-466a-9231-dff14b89e515` | tp_base_templates via origin link | SHEET-BASE | PRZEBUDOWA / REBUILD; BASE |
| 96 | Weekly OEE and short-stop log | `b245853a-b52f-4e73-9a3d-43b9e72ed98d` | tp_base_templates via origin link | SHEET-BASE | PRZEBUDOWA / REBUILD |
