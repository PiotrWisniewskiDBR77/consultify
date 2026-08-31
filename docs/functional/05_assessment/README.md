---
doc_id: assessment-functional-contract
title: Assessment — kontrakt funkcjonalny
menu_item: assessment
truth_type: product-target
scope: top-level Assessment
status: working
owner: product
last_reviewed: 2026-07-29
runtime_commit: e62623cb99249e963eee5710946f5eb0e8286d79
---

# Assessment

## Cel

Assessment prowadzi zamknięte, płatne postępowania oceny poziomu rozwoju
cyfrowego organizacji, w szczególności DRD i SIRI. Zamienia odpowiedzi w
scoring, poziomy i luki oraz umożliwia utworzenie raportu i kandydatów
inicjatyw.

## Granice

Assessment jest osobną pozycją menu, równorzędną z Tools.

- Interview zbiera jakościowy kontekst i insights.
- Tools uruchamia narzędzia konsultingowe.
- Assessment prowadzi długie, zdefiniowane postępowanie cyfrowe według
  własnego modelu i scoringu.
- Audits prowadzi odrębne audyty normatywne i branżowe generowane z norm,
  instrukcji i planów audytów; nie posiada DRD ani SIRI.
- Initiatives przejmuje zatwierdzone propozycje zmian.
- Materials przechowuje raporty i artefakty wynikowe.

## Mapa funkcji

| ID | Funkcja | Status dokumentacyjny |
| --- | --- | --- |
| ASM-F-001 | Lista i wyszukiwanie assessmentów | code-only; wymaga ponownego smoke |
| ASM-F-002 | Utworzenie assessmentu | code-only |
| ASM-F-003 | Wybór frameworka/metodyki | code-only |
| ASM-F-004 | Praca z sesją i odpowiedziami | partial/needs verification |
| ASM-F-005 | Scoring i poziomy actual/target | partial/needs verification |
| ASM-F-006 | Raport assessmentu | partial/needs verification |
| ASM-F-007 | Generowanie inicjatyw | partial/needs verification |
| ASM-F-008 | Zespół, assignmenty i widoczność | unknown |
| ASM-F-009 | Import istniejącego raportu | code-only |
| ASM-F-010 | Audytowalność źródeł i decyzji | target |

`code-only` oznacza znalezienie powierzchni w kodzie, nie pełny odbiór runtime.

## Główny przepływ

`wybór metodyki → utworzenie assessmentu → respondenci/dane → scoring →
interpretacja → raport → przegląd → kandydaci inicjatyw`

Wymagane bramki:

- użytkownik zna źródło scoringu,
- system odróżnia dane wejściowe od interpretacji AI,
- inicjatywa nie powstaje jako zatwierdzona bez przeglądu człowieka,
- raport zachowuje połączenie z assessmentem i odpowiedziami.

## Obiekty i dane

Minimalny model funkcjonalny:

- assessment definition/framework,
- assessment instance,
- session/respondent,
- question/answer,
- score/dimension/level,
- evidence/attachment,
- finding/gap,
- report,
- initiative candidate.

Prawda techniczna wymaga osobnej weryfikacji schematu i tras backendu.

## AI i automatyzacje

AI może wspierać:

- interpretację luk,
- wyjaśnienie scoringu,
- wykrywanie niespójności,
- tworzenie wersji raportu,
- proponowanie inicjatyw.

AI nie może ukrywać sposobu obliczenia wyniku ani zatwierdzać inicjatyw w
imieniu właściciela.

## Role

Do potwierdzenia w runtime:

- owner/manager assessmentu,
- respondent,
- reviewer/approver,
- administrator frameworków,
- odbiorca raportu.

## AS-IS

- pozycja menu: aktywna,
- runtime route/AppView: `AppView.ASSESSMENT_OVERVIEW`,
- główna implementacja frontendowa: `src/components/assessment/AssessmentHub.tsx`,
- część testów hubów ma nieaktualne oczekiwanie `module-hub`, dlatego bieżący
  stan wizualny wymaga osobnego odbioru.

## TO-BE — stan docelowy

> **Scalone 2026-08-29.** Do tej pory ta sekcja była listą czterech plików „do
> scalenia", czyli moduł jako jedyny z szesnastu **nie miał napisanego stanu
> docelowego**. Poniższa treść pochodzi z `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md`
> (koncepcja z decyzjami właściciela) oraz `ASSESSMENT_WORKBENCH_STANDARD_V3.md`.
> Źródła pozostają w mocy jako rozwinięcie — ta sekcja ich nie zastępuje, tylko
> przenosi rozstrzygnięcia tam, gdzie ich szukają wykonawcy.

### Architektura: jeden Workbench, pięć kanonów

Wspólna powłoka identyczna dla wszystkich frameworków — setup sesji, nawigacja
obszarów z postępem, scoring z dowodami i notatkami, żywe odbicie graficzne,
coach w trybie propozycja→akcept, eksport raportu i decka. Pod nią **wymienny
rdzeń metodyczny per framework** (struktura wymiarów, skala i poziomy, agregacja,
bank pytań, wizualizacja sygnaturowa, priorytetyzacja, mapowanie na inicjatywy).
Pod tym wspólny silnik wyniku: radar, luka as-is/to-be, benchmark, macierz
wpływ × wysiłek, fazowana mapa inicjatyw.

**Konsekwencja wiążąca:** dodanie albo domknięcie frameworka to **wypełnienie
siedmiu pól kanonu**, nie budowa od zera.

### Sześć zasad przewodnich

1. **Wierność oryginałowi.** Każdy framework odwzorowuje strukturę, skalę
   i agregację zgodnie ze źródłem autorytatywnym. Żadnych „mniej więcej".
2. **Substancja = wizualizacja.** Wynik nie jest dobry, dopóki nie jest
   jednocześnie metodycznie poprawny **i** dobrze wyglądający. Dwa odbiory, nie jeden.
3. **Świadomość praw autorskich.** SIRI i CMMI są zastrzeżone i płatne.
   Odwzorowujemy strukturę i mechanikę, treść piszemy własnymi słowami,
   z jawnym zastrzeżeniem „narzędzie inspirowane metodyką X, nie jest oficjalną
   oceną X". ADMA i Lean — swoboda. DRD — nasze.
4. **Dyscyplina dowodowa.** Żadnego wyniku z opinii: każdy poziom ma dowód albo
   jawny stan „brakuje dowodu".
5. **Propozycja → akcept.** Model nigdy nie finalizuje wyniku bez człowieka.
6. **Jedna powłoka, wymienny rdzeń.**

### Zakres fali — rozstrzygnięty

**W zakresie: SIRI · DRD · ADMA.** CMMI i LEAN — **później**, w wyborze widoczne
jako „wkrótce" (decyzja właściciela `D5`, 2026-06-28). Wyborowi frameworka nie
wolno obiecywać więcej, niż moduł ma zaimplementowane — koncepcja nazywa to
wprost: *picker kłamie użytkownikowi*, i jest to defekt do usunięcia, nie stan
przejściowy.

### Definicja ukończenia

- **Wierność:** struktura, skala i agregacja zgodne ze źródłem autorytatywnym,
  z cytowanym źródłem i zastrzeżeniem tam, gdzie metodyka jest licencjonowana.
- **Wizualnie:** wizualizacja sygnaturowa plus raport i deck w klasie premium,
  z odbiorem wzrokowym właściciela.
- **Od końca do końca na danych demo:** assessment → scoring → raport i deck →
  inicjatywy, na realnych danych, bez wydmuszek.

### Decyzje właściciela — otwarte od 2026-06-28

| # | Rzecz | Rekomendacja | Stan |
| --- | --- | --- | --- |
| `D1` | Pozycjonowanie wobec praw do SIRI i CMMI | „inspirowane metodyką", własna treść, jawne zastrzeżenie — zamiast dążenia do oficjalnego partnerstwa (długie i płatne) | **OTWARTE — wymaga właściciela, ma skutek prawny** |
| `D2` | Kanon DRD: kod ma 7 osi i 34 obszary, obietnica mówi o 8 wymiarach | zdefiniować kanoniczne 8 wymiarów i zmapować 34 obszary pod nie | **OTWARTE** |
| `D3` | Kolejność: który framework pierwszy | DRD jako flagowiec — brak wyjścia jest tam największą dziurą | rekomendacja przyjęta domyślnie |
| `D4` | Ambicja wizualna | wizualizacja sygnaturowa per framework zamiast jednego generycznego radaru | rekomendacja przyjęta domyślnie |
| `D5` | CMMI i LEAN | później | **ROZSTRZYGNIĘTE 2026-06-28** |

### Źródła rozwijające

- `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md` — kanon metodyczny per
  framework (§3), silnik wyniku (§4), język wizualny (§5), coach i dowody (§6),
  załącznik ze źródłami autorytatywnymi (§10)
- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- `docs/product/ASSESSMENTS_UNIFICATION_IMPLEMENTATION_BACKLOG_V3.md`

## GAP / NEXT

1. Zweryfikować trasy, API, schemat i testy.
2. Zinwentaryzować frameworki dostępne w runtime.
3. Potwierdzić lifecycle sesji, assignmentów i raportu.
4. Ustalić jeden model uprawnień.
5. Scalić dokumenty produktowe do tego kontraktu.
6. Zbudować dowody przepływu assessment → initiatives → materials.

## Kryterium kompletności

Kontrakt otrzyma status `canonical`, gdy funkcje ASM-F-001–010 zostaną
zweryfikowane, a równoległe dokumenty będą miały jawny zakres lub
`superseded_by`.
