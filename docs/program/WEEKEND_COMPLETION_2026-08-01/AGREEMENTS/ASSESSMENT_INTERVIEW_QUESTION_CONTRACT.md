---
document_id: ASSESSMENT-INTERVIEW-QUESTION-CONTRACT
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment — kontrakt wywiadu, pytań i odpowiedzi

## 1. Cel

Wywiad ma ustalić stan możliwy do obrony dowodami, a nie zebrać deklaratywną
samoocenę. Pytanie jest narzędziem diagnostycznym powiązanym z jednostką,
poziomem, atrybutem, dowodem i regułą scoringu.

Assessment korzysta ze wspólnego
[`Question Artifact`](QUESTION_ARTIFACT_CONTRACT.md) w profilu Assessment oraz
ze wspólnego
[`Question Generatora`](QUESTION_GENERATOR_CONTRACT.md). Niniejszy dokument
jest rozszerzeniem diagnostycznym i ma pierwszeństwo tam, gdzie Method Pack
wymaga twardszej reguły evidence albo scoringu.

## 2. Typy pytań

- `opening` — rozpoznaje proces, kontekst i język respondenta;
- `diagnostic` — szacuje prawdopodobny poziom;
- `attribute` — sprawdza konkretny warunek poziomu;
- `evidence_request` — prosi o artefakt, przykład lub obserwację;
- `differentiating` — rozróżnia L-1/L/L+1;
- `contradiction` — rozwiązuje niespójność odpowiedzi/dowodów;
- `coverage` — sprawdza skalę zastosowania, nie pojedynczy pilot;
- `target` — dopiero po AS-IS bada potrzebę i ambicję;
- `reflection` — pozwala respondentowi skorygować podsumowanie.

## 3. Szybki, ale rzetelny routing

Domyślnie Teresa:

1. zadaje pytania otwierające;
2. wyznacza hipotezę prawdopodobnego poziomu;
3. sprawdza wymagania poziomów wcześniejszych;
4. testuje granicę L/L+1;
5. prosi o dowody krytycznych atrybutów;
6. podsumowuje fakty, braki i rozbieżności;
7. tworzy Score Proposal.

Metodyka może wymagać sekwencji od poziomu najniższego. Routing nigdy nie
omija jej twardych prerequisites.

## 4. Status odpowiedzi

- `confirmed_with_evidence`;
- `partially_confirmed`;
- `claimed_without_evidence`;
- `not_present`;
- `not_applicable`;
- `unresolved`.

Odpowiedź zachowuje respondent, timestamp, wording/quote, normalized summary,
question id, attribute id, evidence links, confidence i review state.

## 5. Proponowane odpowiedzi

Method Pack może pokazać przykładowe odpowiedzi typowe dla poziomów. Są one
pomocą interpretacyjną, nie checkboxem tworzącym score. UI wyraźnie odróżnia
`example answer` od faktycznej wypowiedzi użytkownika.

## 6. Wielu respondentów

System nie nadpisuje wypowiedzi wspólnym tekstem. Zachowuje osobne odpowiedzi,
pokazuje consensus i disagreement oraz tworzy Discrepancy Case. Konsolidacja
jest decyzją Assessor/Reviewer, nie średnią opinii.

## 7. Jakość wywiadu

Pytania mają być konkretne, neutralne, jednoznaczne i nie sugerować „lepszej”
odpowiedzi. Teresa pyta o ostatni rzeczywisty przypadek, skalę, ownera, rytm,
metrykę i artefakt. Unika wielokrotnych pytań w jednym zdaniu oraz ściany tekstu.

## 8. Help i brak wiedzy respondenta

Każde pytanie musi mieć plain-language explanation, why-it-matters, przykłady,
expected evidence, glossary i likely respondent roles. Użytkownik może wybrać
`Nie wiem / potrzebuję pomocy`, poprosić Teresę o rozmowę, przypisać pytanie lub
utworzyć evidence request. Szczegółowy kontrakt:
[`ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md`](ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md).
