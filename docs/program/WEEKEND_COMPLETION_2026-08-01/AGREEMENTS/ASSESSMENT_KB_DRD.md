---
document_id: ASSESSMENT-KB-DRD
module: Assessment
method: DRD
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# DRD — baza wiedzy i komunikacja Workbencha

## 1. Cel i prawda metodologiczna

DRD/Digital Pathfinder diagnozuje gotowość i rozwój cyfrowy całej organizacji.
Runtime obejmuje 7 osi oraz 39 obszarów. Stary komentarz mówiący o 34 obszarach
jest niezgodny z faktyczną strukturą i nie może być źródłem prawdy.

| Oś | Obszary | Skala |
| --- | ---: | ---: |
| 1 Procesy Cyfrowe | 9 | 1–7 |
| 2 Produkty Cyfrowe | 5 | 1–5 |
| 3 Cyfrowe Modele Biznesowe | 5 | 1–5 |
| 4 Zarządzanie Danymi | 5 | 1–7 |
| 5 Kultura Transformacji | 5 | 1–6 |
| 6 Cyberbezpieczeństwo | 5 | 1–6 |
| 7 Dojrzałość AI | 5 | 1–5 |

## 2. Źródła

- `knowledge/DRD/extracted_content.txt` oraz PDF-y osi — ludzki kanon książki;
- `src/services/drdStructure.ts` — obecna runtime structure/level descriptions;
- `knowledge/tool-kb/drd/qbank/v2/*.pl.md` — pełne pytania dowodowe;
- `knowledge/tool-kb/drd/methodology/v1/*` — metodologia per axis;
- `src/services/assessmentKnowledge/drdKnowledge*` — obecny bridge do UI;
- report/maturity pathway/industry profile services — wiedza outputowa.

## 3. Jednostka i wywiad

Jednostką jest area, ale ocena odbywa się na poziomie area × level. Teresa
diagnozuje prawdopodobny poziom, weryfikuje rampę w dół i granicę w górę,
korzystając z QBank v2. Dla każdego poziomu pobiera pytania dowodowe, expected
evidence, sygnał interpretacyjny, technologie jako przykłady i pitfalls.

Pierwszy edytor DRD jest referencją funkcjonalną dla karty poziomu: description,
helper questions, example/technologies, Actual/Target/N/A, comment, attachments
i AI help. Docelowy UX zachowuje tę kompletność, ale dodaje `Nie wiem`, routing
do respondenta/evidence oraz proposal semantics.

Technologia nie potwierdza poziomu sama z siebie. Liczy się działanie w procesie,
skala, owner, rytm, mierzalny wynik i artefakt.

## 4. Macierz

Macierz 39 areas × właściwe poziomy jest primary Graphic Mirror i może być
jednocześnie punktem wejścia do wywiadu. Achieved level jest kumulatywny, ale
kolorowanie 1..L nie zastępuje walidacji wcześniejszych warunków.

Macierz pokazuje osobno current, target, proposal, approved, evidence gaps i
unresolved. Axis summary agreguje wynik dopiero według wersjonowanych reguł.

## 5. Komunikacja z KB

Przykładowe zapytanie:

```text
method=drd version=<pinned> unit=4B level=3
capability=ask_next_best_question language=pl
```

KB zwraca definicję poziomu, pytania, expected evidence, distinction L2/L3/L4,
pitfalls i source refs. Teresa zapisuje odpowiedź jako proposal-linked response,
nie jako score.

## 6. Braki do uporządkowania

- skompilować QBank v2 do formalnego Runtime Method Pack;
- usunąć rozdźwięk 34/39;
- połączyć `assessmentKnowledge` z packiem zamiast utrzymywać kopię;
- określić jawne aggregation/rounding fixtures per axis;
- uzupełnić PL canonical level descriptions tam, gdzie runtime używa EN;
- sprawdzić spójność osi 7 z wydaniem/version książki;
- zbudować golden cases i coverage test wszystkich 39 obszarów.
- zachować test regresyjny mechaniki najstarszego edytora zgodnie z
  [`ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md`](ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md).

## 7. Expected outputs

39-area matrix, axis summaries, current/target/gap, evidence quality, maturity
pathways, findings, priorities, report/deck oraz traceable Initiative Proposal
Drafts.
