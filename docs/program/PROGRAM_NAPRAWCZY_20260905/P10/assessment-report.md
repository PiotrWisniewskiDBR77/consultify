# Raport oceny (`assessment-report`) — kontrakt karty N

> Partia P10-B4, pozycje **#24 (kanoniczna)** i **#25 (alias trasy)** inwentarza.
> Zastępuje wcześniejszą, trzywierszową wersję tego pliku z rundy 1 (napisaną bez
> rekordu — „hub nie załadował rekordu"). Pomiar na żywo 06.09.2026, vite 3111 →
> API 4100; zrzuty `evidence/p10b4/05-raport-kontrakt.png`, `08-raport-dokument.png`.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Raport oceny |
| moduł | 04_ASSESSMENT |
| archetyp | **B — Dokument** |
| trasa | (a) zakładka „Raport" w warsztacie sesji; (b) `/assessment/outputs/:outputId/report` (`AppRoutes.tsx:869-877`, flaga `isAssessmentOutputArtifactsEnabled`, `VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED=true`) |
| jak otworzyć | sesja DRD → zakładka „Raport"; albo Ocena → „Wnioski" → wiersz → kebab/„Otwórz" |
| komponent | **#24** `src/components/assessment/report/AssessmentReportContractView.tsx:295` (548 linii) · **#25** `AssessmentReportView.tsx:45` (146) → `AssessmentReportDocument.tsx` (1462) |
| powłoka dziś | #24: `NModeShell` + `ArtifactRightPanel` + `ArtifactBreadcrumb`; **#25: żadna** — dokument na pełną szerokość, bez Menu 4/5, bez paska modułu, bez prawego panelu |

### §0.1 ROZSTRZYGNIĘCIE DUBLETU #24 / #25 (wymagane przed pisaniem)

Inwentarz zakłada „dwa komponenty na tę samą treść, #25 to cienka powłoka trasy".
**Pomiar to obala — to dwa RÓŻNE dokumenty o rozłącznych mocnych stronach:**

| | #24 `AssessmentReportContractView` | #25 `AssessmentReportView` → `AssessmentReportDocument` |
|---|---|---|
| źródło | `GET /sessions/:id/assessment-report-contract` (`method-core.routes.ts:535`) | `GET /outputs/:id` + projekcja zastana (`reportApi.ts`) |
| struktura | 7 rozdziałów = 7 osi DRD, szyna „Oś 1…7" | 4 rozdziały (Jak prowadzono badanie · Osie · Odpowiedzi · Podsumowanie) + ~12 kart sekcji |
| **proza** | **ZERO** — każde gniazdo renderuje `EmptySlot` („Sekcja do uzupełnienia — limit 120–180 słów") | **realna** — „Ocenę przeprowadzono metodyką DRD w wersji pakietu…" (`08-raport-dokument.png`) |
| powłoka | `NModeShell` + prawy panel (2 sekcje) ✓ | brak ✗ |
| pobieranie plików | „Pobierz DOCX" (+3 wiersze „Planowane") | DOCX · PPTX · PDF (`AssessmentReportDocument.tsx:480-486`) |
| działa dla oceny zastanej | nie (potrzebuje sesji jądra) | tak (10 z 11 realnych ocen leży w magazynie zastanym — komentarz `assessmentReportContractComposer.ts:6-14`) |

**DECYZJA CTO: jedna karta `assessment-report`, powłoka z #24, treść z #25.**
Kanoniczny komponent = `AssessmentReportContractView` (ma już `NModeShell`, prawy panel
i breadcrumb); jego `<Chapter>` ma renderować to, co dziś rysuje `AssessmentReportDocument`
(realną prozę + macierz + pliki do pobrania), a nie `EmptySlot`. Trasa
`/assessment/outputs/:outputId/report` zostaje jako **alias** — ta sama karta, inne wejście.
Uzasadnienie: powłoka bez treści i treść bez powłoki to dwie połowy jednej karty; łączenie
jest tańsze niż dopisanie prawego panelu do 1462-linijkowego dokumentu.

### §0.2 Mnożnik 5 metodyk

**JEDEN kontrakt raportu oceny, parametryzowany metodyką.** Sekcje §1 są wspólne;
liczba i nazwy rozdziałów pochodzą z pakietu metody (`DRD_STRUCTURE` dla DRD → 7 osi),
a sekcja „Specyficzne dla metodyki" niesie to, czego nie ma w innych (dla DRD: macierz
obszary × poziomy). Nie tworzymy `siri-report.md` / `adma-report.md`.

## §1. Sekcje

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolej. | S/L |
|---|---|---|---|---|---|
| Metryka raportu (metoda, projekt, sesja, data zamrożenia, zatwierdził) | wiarygodność dokumentu | `output`/`session` → `method-core.routes.ts:1685` | pole bez wartości → „—" | 1 | L |
| Pliki do wysłania klientowi (DOCX/PPTX/PDF) | wydanie klientowi | `GET …/assessment-report.docx` (`:553`) + trasy PPTX/PDF (1.6) | zawsze | 2 | L |
| Streszczenie wykonawcze | jedno zdanie dla zarządu | `contract.executiveSummary` → `assessmentNarrativeComposer.ts:295` (`composeProgramAggregateNarrative`) | brak treści → „Pracuj z AI ▾ Uzupełnij" zamiast pustej ramki | 3 | L |
| Wstęp do osi (×7) | kontekst rozdziału | `chapter.introduction.content` → `assessmentReportContractComposer.ts:171` | jw. | 4 | L |
| Macierz osi + podpis (×7) | obraz dojrzałości | `chapter.matrix` + `caption.content` → `composer.ts:173` | zawsze | 5 | L |
| Komentarz per obszar (×39, mikrostruktura 5-częściowa) | analiza obszaru | `areaComments[].content` → `composer.ts:218` (`composeAreaNarrative:440`) | brak treści → sekcja z CTA AI | 6 | L |
| Pominięcia i ich uzasadnienia | ślad audytu | `assessmentSkipReasonService` → `POST …/assessment-skip-reasons:466` | brak pominięć → znika ✓ | 7 | L |
| Wnioski rozdziału + linia decyzyjna (Kierunek/Priorytet/Horyzont/Warunek sukcesu) | co z tego wynika | `chapter.conclusion` → `composer.ts:242` | jw. | 8 | L |
| Rekomendacje priorytetowe | co robić | `narrative.recommendations` (`AssessmentReportDocument.tsx:1374-1386`) | brak → CTA AI | 9 | L |
| Ograniczenia i założenia | uczciwość dokumentu | `AssessmentReportDocument.tsx:1044` | brak → znika | 10 | L |
| Specyficzne dla metodyki | to, czego nie mają inne metodyki | pakiet metody | brak → znika | 11 | L |

## §2. Prawy panel

| sekcja | status dziś | co ma nieść |
|---|---|---|
| Akcje | **✓ jest** (`AssessmentReportContractView.tsx:418-466`) | „Pobierz DOCX" działa; „Generuj", „Eksportuj PDF", „Eksportuj wszystko" mają plakietkę **„Planowane"** — do podmiany na trasy z 1.6 (PPTX/PDF już istnieją) |
| Właściwości (tabela) | **~ jest tabela, złe wiersze** (`:395-417`) | dziś: Rewizja · Zamrożony wynik · Wygenerowano · Wersja metody · Wersja kontraktu · **Sesja = pełny UUID**. Kanon K7: Status → Właściciel → Metodyka → Okres oceny → Źródło (jądro/zastany) → Utworzono → Zaktualizowano. UUID do `<details>` |
| Powiązania | ✗ brak | sesja · Output · prezentacja · inicjatywy z tego raportu |
| Źródła i założenia | ✗ brak — **obowiązkowa**, bo prozę ma pisać AI | które odpowiedzi, dowody i pominięcia stoją za rozdziałem |
| Komentarze | ✗ brak | warunkowa — do decyzji, czy raport jest komentowalny przed wysyłką |
| Historia | ✗ brak — **obowiązkowa** | rewizje raportu (`GET /outputs/:id/revisions:1706` już istnieje) |

Panel jest dokładnie jeden ✓ K11 (`--dom` na `05-raport-kontrakt.png`: 1 element widoku).

## §3. Menu 5 i nawigacja

* Dziś: Menu 4 jest (tytuł „Raport Oceny — 7 rozdziałów", strzałka wstecz, chip „Szkic",
  kebab; `NModeHeaderConfig`, `:483-503`); **Menu 5 nie istnieje** — brak „Sekcje ▾",
  brak „Edycja/Podgląd", brak „Pracuj z AI".
* Docelowo: „Sekcje ▾" (rozdziały z §1) · „Edycja/Podgląd" · „Pracuj z AI ▾".
* **Edycja/Podgląd wg prawa (K14):** raport z zamrożonego Outputu (`revision > 0`) jest
  z definicji tylko do odczytu → przełącznik się nie renderuje, powód: „Wynik zamrożony —
  raport jest niezmienny". Raport z sesji w toku (`revision === 0`, chip „Szkic") jest
  edytowalny dla roli z prawem zapisu.
* Lewy spis rozdziałów ✓ istnieje, etykiety „Oś 1…7" celowo skrócone (komentarz `:328-334`:
  pełne nazwy były ucinane do „Pr…", „Cy…"); pełna nazwa w dymku. K13 spełnione warunkowo —
  brakuje ikony stanu i licznika obszarów per oś.
* Klasa **L**. Trasa #25 nie ma ŻADNEJ drogi powrotnej poza „wstecz" przeglądarki (K19/K26 ✗).

## §4. AI — to jest największa dziura tej karty

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Streszczenie wykonawcze | ocena kompletności: ile gniazd prozy pustych, ile obszarów bez dowodu | propozycja 120–150 słów z findingów i odpowiedzi sesji | — | — |
| Wstęp do osi | jw. per oś | propozycja 120–180 słów z wyników tej osi | ✓ wszystkie 7 wstępów naraz | — |
| Komentarz per obszar | wskazuje obszary bez dowodu | propozycja wg mikrostruktury (stan faktyczny · ocena i wiarygodność · znaczenie · luka i sens targetu · najbliższy krok) | ✓ wszystkie 39 naraz | — |
| Wnioski rozdziału + linia decyzyjna | jw. | propozycja 180–260 słów + 4 pola linii decyzyjnej | ✓ | — |
| Rekomendacje priorytetowe | jw. | propozycja z luk i blokerów | ✓ | — |
| Macierz, poziomy, luki, pominięcia, metryka | czyta | ✗ | ✗ | ✓ wyliczenia i ślad audytu |

Zawsze propozycja → „Zatwierdź". Teresa wyłącznie z Menu 1. Wiersz `assessment-report`
w tabeli K24 SSOT jest dziś pusty („poza `CardAnalysisArtifactType` — silnik ich nie zna");
`registry.kompletnosc.test.ts:35` trzyma tę kartę jako **jawny wyjątek** rejestru — wejście
do `REJESTR_KART_N` jest warunkiem, żeby mogła w ogóle wołać silnik.

## §5. Czytelność

* `primary-[0-9]` = 0 w obu komponentach ✓ K17; fokus `c-focus` ✓ K18.
* K28 **łamane**: prawy panel drukuje `Sesja 2d1fc7a8-8145-48f1-aaf5-24fd86f1dfd7`
  (`:395-417`, widoczne na `05-raport-kontrakt.png`) oraz `outputId` i wersje kontraktu.
* K25: nazwy technologii w macierzy po angielsku (NLP, ML Models, ERP, MES, RPA, WMS,
  CMMS, CAPA, „Employee Kiosk", „Machine Vision", „Approval Flows", „SEO Toolkit") —
  to korpus metodyki, nie interfejs; **do decyzji, czy tłumaczyć** (patrz §7).
  Tytuły rekordów z seeda są angielskie („DRD Manufacturing — Executive Summary & Deep
  Analysis (C-suite)", `06-wnioski.png`) — dług danych demo, nie kodu.
* 1440 ✓, `bledyKonsoli = 0` ✓ (`05`/`08`). 1280 niemierzone.

## §6. Stan zastany vs kontrakt

✓: K7 (kształt tabeli), K11, K13 (warunkowo), K17, K18, K26 (dla #24), K29, K30 (**8**).
~: K1 (kontrakt jest po stronie SERWERA, nie w katalogu `KanonicznaKarta`), K3, K5, K6
(Akcje są, ale 3 z 4 to „Planowane"), K16, K19 (#24 ma Menu 4 bez paska modułu; #25 nie ma nic),
K20, K25, K28 (**9**).
✗: K2, K4, K8, K9, K10, K12, K14, K21, K22, K23, K24, K27-nd (**11 realnych**).

### ★ POMIAR, KTÓRY WSZYSTKO TŁUMACZY (przyczyna „39 zdań brak treści", 1.6)

`GET /sessions/:id/assessment-report-contract` zmierzone na żywo (sesja `2d1fc7a8…`):
**88 gniazd prozy w 7 rozdziałach** (7 wstępów + 7 podpisów macierzy + 7 wniosków +
28 pól linii decyzyjnej + **39 komentarzy obszarów** — te 39 to dokładnie „39 zdań").
Serwer wypełnił **7** (podpisy macierzy — pełne polskie zdania), pozostałe 81 to `null`,
bo sesja nie ma odpowiedzi.

**Ale ekran nie pokazuje nawet tych 7.** Typ kliencki deklaruje `content: null` — literalnie
`null`, nie `string | null` (`src/method-core/api/methodCoreApi.ts:175, 194, 200, 208`),
a widok renderuje `EmptySlot` bezwarunkowo (`AssessmentReportContractView.tsx:79`, wołane
z `:215, 247, 265, 279`) i nie czyta `.content` ANI RAZU (grep `\.content` w tym pliku = 0
trafień). Writer istnieje i działa (`assessmentReportContractComposer.ts:171, 173, 218, 242`
→ `assessmentNarrativeComposer.ts:190, 295, 440`), korzysta z niego eksport DOCX
(`assessmentDrdReportSchemaService.ts:196` `slotText`) — i tylko dlatego dokument w pliku
ma prozę, a ekran nie. To jest kształt „zbudowane, ale niepodłączone", nie brak silnika.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| L1 | **przewód treści**: `content: string \| null` w typie klienckim + render treści zamiast `EmptySlot` (natychmiast odzyskuje 7 podpisów macierzy i całą prozę, gdy sesja ma odpowiedzi) | **S** | nie |
| L2 | scalenie #24+#25 wg §0.1: `<Chapter>` renderuje treść `AssessmentReportDocument`, trasa `/outputs/:id/report` zostaje aliasem | **L** | nie |
| L3 | „Pracuj z AI" ×3 na sekcjach prozy (K21) — 5 typów sekcji z §4; magazyn zastany bez rekomendacji ma dostawać propozycję AI, nie pustkę | **L** | nie |
| L4 | prawy panel: Powiązania · Źródła i założenia · Historia (rewizje z `/outputs/:id/revisions`) | M | nie |
| L5 | wiersze tabeli Właściwości wg K7 + UUID do `<details>` (K28) | S | nie |
| L6 | Menu 5 (Sekcje ▾ · Edycja/Podgląd wg `revision` · Pracuj z AI) | M | nie |
| L7 | pasek modułu z pigułką otwartej karty; #25 bez drogi powrotnej (K19/K26) | M | nie |
| L8 | „Generuj/Eksportuj PDF/Eksportuj wszystko" — zdjąć plakietkę „Planowane" i wpiąć trasy PPTX/PDF z 1.6 | S | nie |
| L9 | wejście do `REJESTR_KART_N` + wiersz w `cardAnalysisRubric.ts` (warunek K21/K24) | S | nie |
| L10 | angielskie nazwy technologii w macierzy i angielskie tytuły rekordów seeda | S | **TAK — jedyne pytanie** |

**Pytanie do właściciela (1):** macierz raportu drukuje nazwy technologii z korpusu metodyki
po angielsku (ERP, MES, RPA, NLP, „Machine Vision", „Approval Flows"). Czy w dokumencie dla
klienta zostają w oryginale (rekomendacja CTO — to nazwy własne technologii, tłumaczenie
„Widzenie maszynowe" bywa mylące), czy tłumaczymy je na polski?

## §8. Aliasy

* **#25 `assessment-output-report`** — trasa `/assessment/outputs/:outputId/report`
  (`AppRoutes.tsx:869`) i komponenty `AssessmentReportView.tsx` + `AssessmentReportDocument.tsx`.
  Po L2 zostaje wyłącznie jako wejście (trasa), komponent scalony.
* Trasa zastana `/assessment-reports/:reportId` (`AppRoutes.tsx:2593`) → przekierowanie.
