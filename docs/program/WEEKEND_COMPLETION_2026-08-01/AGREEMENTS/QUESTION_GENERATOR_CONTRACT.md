---
document_id: QUESTION-GENERATOR-CONTRACT
scope: cross-application
primary_module: Interview
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Question Generator — kontrakt produktu

## 1. Zadanie

Question Generator projektuje albo ulepsza spójny zestaw `Question Proposals`
na podstawie briefu, metodologii i materiałów źródłowych. Jego zadaniem nie jest
produkcja zadanej liczby zdań, lecz zbudowanie instrumentu, który zapewnia
coverage, logiczną rozmowę i dane przydatne do określonego wyniku.

Generator korzysta ze wspólnego
[`AI_GENERATOR_ARTIFACT_STANDARD.md`](AI_GENERATOR_ARTIFACT_STANDARD.md), lecz
ma własne operacje domenowe: add, update, remove, reorder i branching.

## 2. Tryby pracy

### Create

Buduje nowy question set z briefu i zatwierdzonych źródeł.

### Improve

Analizuje istniejący zestaw i proponuje selektywne `Add`, `Update`, `Remove`,
`Reorder`, `Merge`, `Split` oraz `Change branching`.

### Adapt

Tworzy pochodną wersję dla innego audience, języka, czasu lub kanału, bez
niszczenia oryginału.

### Method import

Wydobywa kandydatów z dokumentu/metody. Import nie potwierdza poprawności,
licencji ani zgodności z metodologią; wymaga mappingu i review eksperta.

## 3. Generation Brief

Przed startem użytkownik zatwierdza:

- purpose i decyzje/insighty/score, które zestaw ma wspierać;
- profile: Interview, Assessment, Audit, Meeting lub Tools;
- audience, role respondentów i ich poziom wiedzy;
- topics, hypotheses, dimensions/requirements oraz desired coverage;
- źródła, metodologia, licence i ograniczenia;
- język, ton i kanał;
- target time i orientacyjny limit pytań;
- dozwolone answer types oraz evidence policy;
- privacy/anonymity i sensitive topics;
- runtime modes, branching policy i wymagany review.

Teresa podsumowuje brief i wskazuje konflikty, np. szeroki zakres przy czasie
10 minut. Użytkownik rozstrzyga trade-off przed generacją.

## 4. Proces analizy

Generator:

1. buduje coverage map: cel → temat/hipoteza/wymaganie → pytanie;
2. identyfikuje informacje już dostępne, aby ich nie pytać ponownie;
3. dobiera respondent roles i rozdziela pytania między właściwe osoby;
4. projektuje kolejność od łatwego kontekstu do pogłębienia;
5. dobiera answer type, evidence i help do intentu;
6. tworzy branching i follow-ups;
7. wykrywa double-barrelled, leading, vague i duplicate questions;
8. szacuje czas i cognitive load;
9. sprawdza coverage gaps, dead ends i nadmierne required;
10. przygotowuje question proposals oraz raport jakości zestawu.

## 5. Question Proposal

Każda propozycja zawiera pełny model z
[`QUESTION_ARTIFACT_CONTRACT.md`](QUESTION_ARTIFACT_CONTRACT.md) oraz:

- operation: add/update/remove/reorder/merge/split/branch;
- rationale i expected information gain;
- mapped objective/hypothesis/requirement;
- source reference;
- impact na estimated time i coverage;
- duplicate/bias/sensitivity flags;
- before/after dla aktualizacji;
- confidence, unknowns i required reviewer;
- generator provenance.

## 6. Workspace review

Widok zawiera równolegle:

- outline całego zestawu;
- coverage map i brakujące obszary;
- listę propozycji z before/after;
- branching preview;
- respondent/time load;
- quality findings;
- preview pytania w realnym Question Card.

Użytkownik może akceptować każdą zmianę osobno, grupami albo całościowo po
walidacji. Regeneracja jednego pytania nie zastępuje ręcznych zmian w innych.
Usunięcie istniejącego pytania wymaga jawnego wyboru i pokazania utraconego
coverage.

## 7. Quality Gate zestawu

Publish wymaga:

- pełnego albo jawnie zaakceptowanego coverage;
- logicznej kolejności i działającego branching;
- braku blockerów jakości pytań;
- realistycznego czasu dla audience;
- uzasadnionego required/optional;
- help i evidence tam, gdzie potrzebne;
- privacy i sensitive-topic review;
- zgodności metodologicznej/licencyjnej;
- przeglądu tłumaczenia, jeśli używane;
- testowego przejścia wszystkich ścieżek;
- decyzji uprawnionego autora/reviewera.

Generator przygotowuje draft. Nie publikuje Template ani Method Pack.

## 8. Specjalizacja profili

### Interview

Optymalizuje insight coverage, neutralność, rozmowę i różne perspektywy. Nie
zakłada jednej prawidłowej odpowiedzi.

### Assessment

Trzyma się Method Pack, prerequisites, level/attribute/evidence mapping i reguł
score. Nie wymyśla własnych poziomów ani progów.

### Audit

Mapuje pytania do wymagań/controls i evidence. Nie interpretuje samodzielnie
normy jako obowiązującej reguły bez zatwierdzonego Method Pack.

### Meeting i Tools

Projektuje pytania facylitacyjne dla kroku/obiektu. Nie zamienia rozmowy w
długi formularz i zachowuje mapping do outputu.

## 9. Rola Teresy i człowieka

Teresa może przygotować brief, challenge'ować zakres, wygenerować propozycje,
wyjaśnić rationale i przeprowadzić próbne przejście. Autor odpowiada za cel i
treść. Method Owner odpowiada za zgodność metody. Privacy/Domain Reviewer jest
wymagany zależnie od profilu.

AI nie jest autorem metodologii, nie zatwierdza licencji, nie publikuje i nie
usuwa pytań bez preview.

## 10. Mierniki

- coverage completeness;
- median completion time i abandonment;
- unanswered/`I don't know` rate per pytanie;
- follow-up yield i evidence yield;
- duplicate/low-information rate;
- respondent comprehension/help usage;
- review edit/reject rate;
- branching dead-end rate;
- insight/decision utility po zakończeniu;
- różnice wyników między wersjami zestawu.

Mierniki pomagają ulepszać kolejną wersję. Nie zmieniają aktywnych sesji.

## 11. Antywzorce

- generowanie dokładnie N pytań kosztem coverage;
- ten sam zestaw dla każdej roli;
- automatyczne zastąpienie wszystkich istniejących pytań;
- losowy answer type albo skale bez anchorów;
- źródło wgrane do promptu bez provenance i licence;
- help i example sugerujące właściwą odpowiedź;
- branching, którego nie można zobaczyć i przetestować;
- wysoka ocena jakości bez próbnego przejścia;
- publikacja bez człowieka.

## 12. Golden flow

`define brief → select sources/method → generate coverage plan → review plan →
generate proposals → inspect outline/coverage/branching/runtime preview → accept
selected changes → validate all paths → human review → publish new version`
