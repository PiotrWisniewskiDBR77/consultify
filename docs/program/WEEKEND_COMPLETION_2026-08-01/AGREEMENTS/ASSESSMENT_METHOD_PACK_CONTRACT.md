---
document_id: ASSESSMENT-METHOD-PACK-CONTRACT
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment Method Pack — kontrakt metodyki

## 1. Cel

Method Pack jest wersjonowanym, walidowanym wejściem do wspólnego Workbencha.
PDF, książka i Markdown pozostają źródłami dla człowieka; runtime otrzymuje
ustrukturyzowany pack wygenerowany z zatwierdzonych treści.

## 2. Wymagane części

1. `manifest` — id, nazwa, owner, version, languages, status i licencja;
2. `purpose-and-scope` — kiedy używać, kiedy nie używać, jednostka oceny;
3. `structure` — axes/blocks/pillars/dimensions/areas i kolejność;
4. `levels` — skale, definicje, atrybuty, prerequisites;
5. `questions` — pytania i routing;
6. `answers` — typy odpowiedzi i ich znaczenie;
7. `evidence` — wymagania, przykłady i reguły jakości;
8. `scoring` — deterministic rules, aggregation, rounding, N/A, unknown;
9. `targeting` — zasady targetu i pathway;
10. `visuals` — macierz, mapy, legendy i agregacje;
11. `prioritisation` — metoda po freeze, jeżeli występuje;
12. `findings-and-initiatives` — wzorce rekomendacji i lineage;
13. `teresa` — dozwolone capabilities i facilitation policy;
14. `outputs` — result, report, deck i appendices;
15. `sources` — provenance, strony/sekcje, data i prawa użycia;
16. `fixtures` — przykłady poprawnego, granicznego i błędnego scoringu.
17. `question-help` — plain-language explanations, examples, glossary,
    respondent roles i conversational routes.

## 3. Kontrakt jednostki oceny

Każda jednostka ma stabilne `unit_id`, nazwę, opis, parent, kolejność, respondent
profile, level scale, dependency ids, scoring policy, visual position oraz
knowledge references. Id nie zmienia się wraz z tłumaczeniem nazwy.

## 4. Kontrakt poziomu

Każdy poziom zawiera:

- number/code, title i canonical definition;
- required attributes;
- distinction from previous/next;
- validation questions;
- expected evidence i negative evidence;
- common mis-scoring traps;
- examples i technology examples, jawnie rozdzielone;
- prerequisites/dependencies;
- allowed target/pathway rules.

Każde pytanie dodatkowo spełnia
[`ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md`](ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md).

## 5. Walidacja packa

Publikacja wymaga:

- poprawności identyfikatorów i referencji;
- kompletności wszystkich jednostek i poziomów;
- braku osieroconych pytań/evidence;
- deterministic scoring fixtures;
- sprawdzenia licencji i źródeł;
- testu języków oraz fallbacku;
- render testu macierzy;
- golden case zatwierdzonego przez właściciela metodyki.

Sesja przypina dokładną wersję packa. Aktualizacja tworzy nową wersję; nie
przelicza historii.

## 6. Readiness

`draft → methodology review → content approved → runtime validated → pilot →
released → deprecated`

Library pokazuje prawdziwy readiness. Pack bez pytań, scoring fixtures lub
licencji nie może wyglądać jak gotowa metoda.
