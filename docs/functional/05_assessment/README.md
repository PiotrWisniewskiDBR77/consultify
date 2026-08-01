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

## TO-BE

Źródła do scalenia:

- `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md`
- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- `docs/product/ASSESSMENTS_UNIFICATION_IMPLEMENTATION_BACKLOG_V3.md`
- materiały `docs/modules/` i `Harvard/modules/` dotyczące assessmentów.

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
