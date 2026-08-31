---
doc_id: raport-oceny-stan
status: canonical
truth_type: measurement
established: 2026-08-30
silnik: server/src/services/assessment/assessmentDrdReportSchemaService.ts (buildAssessmentDrdReportSchema)
trasa: server/src/routes/method-core.routes.ts:552 — GET /sessions/:sessionId/assessment-report.docx
uruchomienie: scripts/dev/generate-assessment-drd-report.ts (npx tsx, baza lokalna Postgres)
pomiar: scripts/dev/probe-drd-report-real-session.ts
dowody: evidence/raport-oceny/ (2 × .docx, 2 × .txt, kontrakt i schemat .json)
---

# Raport z oceny DRD — stan silnika, zmierzony

## Co zostało zrobione

Silnik **uruchomiony end-to-end**, nie oceniony z kodu. Łańcuch dokładnie taki,
jak na trasie produkcyjnej:

```
assessmentReportContractService.build(org, session)   ← czyta ŻYWĄ bazę
  → buildAssessmentDrdReportSchema(contract)
    → renderDocumentSchemaToDocxBuffer(schema)        → .docx
```

Baza: świeży Postgres lokalny (kontener `cx-day178-pg`, baza `drdrep`), pełna
migracja `server/scripts/migrate.postgres.ts`, dane z `scripts/seed-demo-drd-metalpol.ts --apply`
(23 findingi w 7 osiach, 23 decyzje pominięcia, 16 obszarów bez oceny — realistyczna dziurawość).
**Bazy demo ani staging nie dotknięto.**

> **Pułapka, w którą prawie wpadłem.** `NODE_ENV=test` przełącza aplikację na
> **mock bazy** (`server/src/database/Database.ts:82`). Pierwszy przebieg poszedł
> na mocka i zwrócił `SESSION_NOT_FOUND`, mimo że wiersz w Postgresie istniał.
> Realny przebieg wymaga `RUN_DB_TESTS=1 MOCK_DB=false`. Każdy wcześniejszy
> „raport wygenerowany lokalnie" bez tych dwóch zmiennych to raport z mocka.

**Wynik: dokument powstał.** `evidence/raport-oceny/raport-oceny-drd.docx`, 249 426 bajtów,
7 rozdziałów, 10 sekcji, poziomy per oś **7/5/5/7/6/6/5 — zgodne z metodyką właściciela**.

## Co silnik generuje dziś

Okładka (klient, profil, zatrudnienie, okres oceny, oceniający, metodyka, sygnatura),
spis treści, **Streszczenie zarządcze** + wykres radarowy + tabela 7 osi + „Luki krytyczne",
**7 rozdziałów** (wstęp osi · matryca poziomów · ocena obszarów · wnioski rozdziału ·
linia decyzyjna), **Wnioski końcowe** + linia decyzyjna programu, **Załącznik A. Rejestr luk**,
sekcja „Źródła i identyfikowalność".

Struktura jest mocna. **Problem jest z treścią.**

## Ocena wobec specyfikacji właściciela, punkt po punkcie

| Wymaganie właściciela | Stan | Uwaga |
| --- | --- | --- |
| 1. Wstęp z opisem, **jak prowadzono badanie** | ✘ **BRAK** | Jest tylko tabelka metadanych na okładce. Nigdzie nie ma prozy: kto odpowiadał, ile obszarów pokryto z 39 i dlaczego resztę pominięto, jakie dowody zebrano, jaka jest skala. Liczby te *są* w kontrakcie — nikt ich nie opisuje. |
| 2a. Siedem osi | ✔ | 7 rozdziałów, kolejność i nazwy PL zgodne. |
| 2b. **Opis samej osi** | ✘ **BRAK** | „Wstęp osi" to statystyka („Oś 1 obejmuje 9 obszarów. Oceniono 4 z 9…"), nie opis czym oś jest. `DRDAxis.description` istnieje w strukturze, jest po angielsku i **nigdy nie jest drukowany**. |
| 2c. **Opis obszaru analitycznego** | ✘ **BRAK** | Obszar dostaje wyłącznie nagłówek `1A Procesy Sprzedaży` + linijkę liczb. Czym ten obszar jest i co znaczą jego poziomy — ani słowa. Opisy poziomów (`DRDLevel.description`, 227 sztuk) **nie są drukowane nigdzie w raporcie**. |
| 3a. **Odpowiedzi** | ✘ **BRAK** | Raport nie renderuje żadnej odpowiedzi. `assessmentNarrativeComposer.ts` nie ma ani jednego odwołania do treści odpowiedzi; do raportu trafia wyłącznie liczba poziomu. Zdarzenia `ANSWER_CONFIRMED` z payloadem są w bazie i nie są czytane. |
| 3b. Wstępna paleta wniosków | ✔/~ | Są „Wnioski rozdziału" i „Linia decyzyjna" (Kierunek · Priorytet · Horyzont · Warunek sukcesu). **Horyzont jest strukturalnie pusty w 8 miejscach na 8** — kompozytor zawsze ustawia `horizon: null` (`assessmentNarrativeComposer.ts:191` i `:300`). |
| 4. Podsumowanie | ✔ | „8. Wnioski końcowe" + linia decyzyjna programu + rejestr luk. |
| Liczba poziomów per oś 7/5/5/7/6/6/5 | ✔ | Zmierzone na wygenerowanym dokumencie. |
| Treść po polsku | ✘ **NIE W CAŁOŚCI** | Etykiety poziomów osi 3, 4 i 7 drukują się **po angielsku** w dokumencie dla polskiego klienta: „Advanced Personalization", „Data from Physical Objects", „Fully AI-Ready Data Architecture", „Centralized Data & Initial AI Readiness". W wygenerowanym pliku: **43 wystąpienia** angielskich etykiet poziomów (bez „Advanced" wchodzącego w skład dłuższych fraz — policzone osobno). |
| Nadaje się dla klienta | ✘ **NIE** | Powód poniżej — najważniejszy w tym dokumencie. |

## ★ Najważniejsze ustalenie: cała dobra proza pochodzi z ręcznie napisanego seeda

Raport, który wyszedł, czyta się dobrze:

> „Oferty są rejestrowane w CRM, lecz kalkulacja wykonalności i terminu nadal wymaga
> uzgodnień z planistą poza systemem…"

**To zdanie nie zostało napisane przez produkt.** Leży dosłownie, znak w znak, w
`scripts/demo-seed/metalpolDrdDataset.ts:55` — napisał je człowiek przygotowujący
dane demo. Silnik tylko przepisuje pole `finding.businessMeaning` do zdania z
etykietą (`assessmentNarrativeComposer.ts:371`).

Producentem findingów w produkcie jest `EventDerivedOutputBridge`, wpięty w trasę
(`server/src/routes/method-core.routes.ts:108`). On wpisuje do tych samych pól
**szablony** (`EventDerivedOutputBridge.ts:138-160`).

**Pomiar, nie hipoteza.** `scripts/dev/probe-drd-report-real-session.ts` bierze ze
zmierzonych danych wyłącznie strukturę (obszar + poziomy), przepuszcza ją przez
`deriveFindingsFromEvents` — czyli przez producenta z produktu — i renderuje raport
tym samym łańcuchem. Wynik: `evidence/raport-oceny/raport-oceny-drd-sesja-produktowa.docx`.
Ten sam obszar 1A:

> „Znaczenie dla przedsiębiorstwa: Jednostka 1A potwierdzona na poziomie 3
> (1 dowód/-ody w event-store). … Najbliższy krok: Zaplanuj działania podnoszące
> jednostkę 1A z poziomu 3 do 5. Oczekiwany rezultat: Zamknięcie luki na jednostce 1A."

Tak wygląda raport dla klienta z **prawdziwej** sesji. Powtórzenie liczby trzy razy,
słowo „jednostka" zamiast nazwy obszaru i przeciek wewnętrznego żargonu **„event-store"**
do dokumentu poufnego klienta. Kod sam się do tego przyznaje — `limitations` zamrożonego
Outputu drukuje w raporcie zdanie: *„businessMeaning/recommendation to deterministyczne
szablony … NIE analiza LLM ani recenzja metodyka."* (`EventDerivedOutputBridge.ts:234`).

**Wniosek: obawa właściciela jest uzasadniona.** Ładny dokument, który dziś istnieje,
opiera się na ręcznie dopisanych danych demo. Produkt sam takiego dokumentu nie wytwarza.

## Werdykt: czy opisy z książki są podłączone do silnika

**NIE.** I leżą tuż obok.

- `knowledge/tool-kb/drd/methodology/v1/` — 8 plików metodyki. Indeksowane przez
  `server/src/services/ai/knowledgeIndexer.ts:49` i używane przez **drugi**, HTML-owy
  generator (`server/src/services/report/drdReportGrounding.ts`). Łańcuch DOCX nie
  importuje ich wcale — jego trzy pliki mają razem 6 importów i żadnego z KB.
  **Uwaga: te pliki są po angielsku (`.en.md`, `language: en`)** — samo podłączenie
  ich nie da polskiego raportu.
- `drdStructure.ts` — ma **233 tytuły poziomów i 227 opisów poziomów per obszar**.
  Silnik czyta z tego wyłącznie `id`, `name`, `namePL`, `levelCount`. Opisy: zero użyć.

To jest **najtańsza możliwa poprawa jakości raportu**: dane już są w tym samym
module, importowanym w linii 3 pliku silnika.

### Przy okazji: błąd rzeczowy w wydanym dokumencie

`resolveDrdLevelLabelPL` (`assessmentDrdReportSchemaService.ts:190-197`) przy braku
`levelLabelsPL` na osi bierze etykietę z **`axis.areas[0]`** — pierwszego obszaru osi.
`levelLabelsPL` ma tylko oś 1 i 2. Skutek w wydanym pliku: obszar **6C „Ochrona danych"**
z poziomem docelowym 5 dostaje etykietę **„HR w strategii"** — nazwę poziomu obszaru
6A, semantycznie z innej bajki. To samo na osi 5. **To nie jest brak treści, to jest
treść nieprawdziwa w dokumencie poufnym klienta.** Test `day32.drdLevels.test.ts:20`
utrwala to zachowanie jako poprawne.

## Werdykt: czy audyt i ocena dzielą kod i szablon

**Nie dzielą — i to jest inny problem, niż podejrzewa właściciel.**

| | ocena (DRD) | audyt |
| --- | --- | --- |
| budowniczy schematu | `assessment/assessmentDrdReportSchemaService.ts` | `audits/auditReportDocumentSchemaService.ts` (211 linii) |
| `documentType` | `client_final_report` | `ai_audit_report` |
| import od drugiej strony | brak | brak |

Zero wspólnego kodu poza generycznym renderem DOCX. Zlania się nie ma **w tej parze**.

Zlanie jest gdzie indziej i jest gorsze: **raport z oceny DRD ma co najmniej trzy
równoległe implementacje.**

1. **DOCX** — opisana wyżej, trasa `method-core`. Bez KB, bez LLM.
2. **HTML** — `src/services/report/drdReportGenerator.ts` + `server/src/services/report/`
   (`drdReportGrounding`, `drdLlmNarrator`, `drdIndustryBenchmark`, `drdReportSvg`…),
   z narratorem LLM i groundingiem w KB. Ma własny skrypt próbki
   (`scripts/generate-drd-report-sample.ts`).
3. **assessment-reports** — `server/src/routes/assessment-reports.routes.ts`, ~2500 linii,
   własne sekcje, edycja AI, workflow zatwierdzania, eksport PDF i PPTX.

Do tego `src/services/report/` i `server/src/services/report/` trzymają **zdublowane
pliki o tych samych nazwach** (`drdReportGenerator.ts`, `drdReportModel.ts`,
`drdReportHtml.ts`, `drdConclusionContract.ts`, `drdIndustryBenchmark.ts`,
`drdLlmNarrator.ts`, `drdReportSvg.ts`). **Do rozstrzygnięcia z właścicielem: który
z trzech jest raportem z oceny.** Dopóki to nie padnie, każda poprawa jakości trafia
w jedną trzecią produktu.

## Rekomendacja — od najtańszego

1. **Naprawić etykiety poziomów (godziny).** `resolveDrdLevelLabelPL` ma brać poziom
   **tego obszaru** (`area.levels[level-1].title`), nie `areas[0]`. Usuwa fałszywe
   etykiety na osiach 5 i 6. Wymaga poprawienia `day32.drdLevels.test.ts:20`.
2. **Dodać opis obszaru i opis poziomu z `drdStructure` (dzień).** W `chapterBlocks`
   (`assessmentDrdReportSchemaService.ts:335`), pod nagłówkiem obszaru: `description`
   poziomu obecnego i docelowego. Dane już zaimportowane, zero nowych zależności.
   To zamyka wymaganie 2c właściciela.
3. **Przetłumaczyć etykiety i opisy poziomów osi 3, 4 i 7 na polski (dzień, praca
   redakcyjna, nie kod).** Bez tego punkty 1 i 2 wydrukują poprawnie… angielszczyznę.
   Wzorem oś 5 i 6, które są już po polsku.
4. **Dodać sekcję „Jak prowadzono badanie" (dzień).** Nowa sekcja przed streszczeniem;
   wszystkie dane są w kontrakcie: `assessmentPeriod`, `assessor`, liczba obszarów
   ocenionych z 39, rozkład stanów dowodowych, kody pominięć. To wymaganie 1 właściciela.
5. **Dodać opis osi (dzień).** `DRDAxis.description` — najpierw po polsku (dziś EN),
   potem drukować we wstępie rozdziału. Wymaganie 2b.
6. **Rozstrzygnąć trzy generatory (decyzja właściciela, nie kod).** Bez tego punkty
   niżej nie mają adresata.
7. **Odpowiedzi w raporcie (tydzień+).** Wymaganie 3a. Wymaga przeniesienia treści
   odpowiedzi z `method_events` do findingu i decyzji, ile z niej pokazywać klientowi.
8. **Źródło narracji obszaru (największe, właściwe zadanie).** Dopóki
   `EventDerivedOutputBridge` wpisuje szablony, żadna poprawa formy nie da dokumentu
   dla klienta. Potrzebny autor treści findingu — LLM z groundingiem w KB (mechanizm
   już istnieje w generatorze HTML, punkt 2 listy generatorów) albo konsultant
   wypełniający pola w Workbenchu. **To jest jedyna pozycja, która przesuwa raport
   z „szkielet z liczbami" na „dokument dla klienta".** Punkty 1–5 sprawiają, że
   szkielet przestaje kłamać i wygląda profesjonalnie; treści nie tworzą.

## ★ Kto to dziś w ogóle zobaczy — nikt

Przycisk pobrania DOCX istnieje (`src/components/assessment/report/AssessmentReportContractView.tsx:351`)
i komponent jest renderowany (`DrdHttpMethodWorkspaceScreen.tsx:1147`). Ale ten ekran
wchodzi **wyłącznie za flagą `drdHttpSourceOfTruthV1`**, a jej
`defaultValue: false` (`src/hooks/useFeatureFlags.tsx:279`); OFF renderuje
`DrdMethodWorkspaceScreenLegacy`, który tej trasy nie woła
(`DrdMethodWorkspaceScreen.tsx:896-907`).

**Dziś, przy domyślnych ustawieniach, nikt w produkcie nie może pobrać tego raportu.**
To zmienia kolejność: punkty 1–5 rekomendacji są tanie i można je zrobić spokojnie,
bo nic nie jest wystawione klientowi. Ale też tłumaczy, dlaczego nikt tego dokumentu
nigdy nie zobaczył.

## Czego NIE zmierzyłem

- Wyglądu DOCX oczami — czytałem wyekstrahowany tekst (`scripts/dev/_docx2txt.py`),
  nie otwierałem pliku w Wordzie. Typografia, łamanie stron, wykres radarowy:
  **niezweryfikowane**.
- Generatorów 2 i 3 nie uruchamiałem. Ich stan jest tu opisany z kodu, nie z pomiaru.

## Jak to powtórzyć

```bash
# 1. baza tymczasowa (dowolny lokalny Postgres z pgvector; NIE demo, NIE staging)
docker exec <kontener> psql -U postgres -c "CREATE DATABASE drdrep;"
docker exec <kontener> psql -U postgres -d drdrep -c "CREATE EXTENSION IF NOT EXISTS vector;"

export DATABASE_URL="postgresql://postgres:<hasło>@127.0.0.1:<port>/drdrep"
export NODE_ENV=test DB_TYPE=postgres

# 2. schemat + dane
npx tsx server/scripts/migrate.postgres.ts
npx tsx scripts/seed-demo-drd-metalpol.ts --apply

# 3. raport z silnika — RUN_DB_TESTS/MOCK_DB obowiązkowe, inaczej idzie na mocka
RUN_DB_TESTS=1 MOCK_DB=false npx tsx scripts/dev/generate-assessment-drd-report.ts

# 4. pomiar: to samo, ale findingi od producenta z produktu (nadpisuje bazę tymczasową)
RUN_DB_TESTS=1 MOCK_DB=false npx tsx scripts/dev/probe-drd-report-real-session.ts

# 5. podgląd treści bez Worda
python3 scripts/dev/_docx2txt.py evidence/raport-oceny/raport-oceny-drd.docx
```

Kolejność 3 przed 4 jest istotna — krok 4 podmienia pola narracyjne w bazie tymczasowej.
