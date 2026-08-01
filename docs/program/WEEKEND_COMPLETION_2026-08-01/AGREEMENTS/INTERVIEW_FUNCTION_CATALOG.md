---
document_id: INTERVIEW-FUNCTION-CATALOG
module: Interview
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Interview — katalog funkcji

## 1. Cel katalogu

Każda funkcja ma określony cel, stan danych, rolę Teresy, granicę integracji i
warunek ukończenia. Katalog służy później do rozpisania tasków bez ponownego
projektowania produktu.

## 2. Funkcje

| ID | Funkcja | Cel | Główny rezultat |
| --- | --- | --- | --- |
| INT-01 | Templates Library | znaleźć właściwy wzorzec | wybrany Template/version |
| INT-02 | Template & Question Generator | zaprojektować profesjonalny question set | publishable Template version |
| INT-03 | Discovery Brief | określić cel, hipotezy i coverage | approved brief |
| INT-04 | Session/Program Setup | utworzyć sesję lub falę | active process |
| INT-05 | Participants & Distribution | bezpiecznie dotrzeć do respondentów | assignments/invitations |
| INT-06 | Inbox | pokazać osobie, co ma zrobić | actionable queue |
| INT-07 | Single Question Runtime | pogłębiona odpowiedź | saved answers/evidence |
| INT-08 | Task List Runtime | szybkie uzupełnienie zestawu | completed answer set |
| INT-09 | Conversational Runtime | rozmowa prowadzona przez Teresę | accepted response proposals |
| INT-10 | Evidence & Context | udokumentować wypowiedź | source-linked answer |
| INT-11 | Save/Exit/Resume | bezpiecznie przerwać i wrócić | recoverable draft |
| INT-12 | Submit & Confirmation | zamknąć pracę respondenta | submitted version |
| INT-13 | Managed Assignments | kontrolować dystrybucję i coverage | operational oversight |
| INT-14 | Review & Send Back | zapewnić jakość odpowiedzi | confirmed/rework decision |
| INT-15 | Hypothesis & Coverage | mierzyć jakość badania | coverage/gap state |
| INT-16 | Insight Generator | przeprowadzić syntezę i triangulację wielu źródeł | insight candidates |
| INT-17 | Contradictions | zachować różnice i dissent | resolved/open contradiction |
| INT-18 | Client Readback | potwierdzić znaczenie | readback decision |
| INT-19 | Insight Review | dopuścić wniosek do użycia | approved insight |
| INT-20 | Reporting | opakować zatwierdzone wyniki | report/deck candidate |
| INT-21 | Knowledge Promotion | zasilić pamięć organizacji | eligible knowledge object |
| INT-22 | Tools/Assessment Handoff | przekazać źródłową wiedzę | source input relation |
| INT-23 | Initiative Proposal Generator | zaproponować zmianę z approved insightów | Proposal Draft |
| INT-24 | Privacy/Consent/Anonymity | chronić respondenta i organizację | auditable policy state |
| INT-25 | Notifications & Escalation | domknąć zaległą pracę | actionable reminders |
| INT-26 | Archive/Retention | zarządzać cyklem życia | retained/deleted record |

Funkcje `INT-07`–`INT-14` tworzą jeden system jakości odpowiedzi opisany w
[`INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md`](INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md):
pomoc Teresy → readiness check → submit → review → send-back/approve.

## 3. Rola Teresy per etap

Funkcje `INT-16` oraz `INT-23` korzystają ze wspólnego
[`AI_GENERATOR_ARTIFACT_STANDARD.md`](AI_GENERATOR_ARTIFACT_STANDARD.md), a ich
pełne kontrakty znajdują się odpowiednio w
[`INSIGHT_GENERATOR_CONTRACT.md`](INSIGHT_GENERATOR_CONTRACT.md) i
[`INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md`](INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md).

Funkcja `INT-02` korzysta ze wspólnego
[`Question Artifact`](QUESTION_ARTIFACT_CONTRACT.md) oraz
[`Question Generatora`](QUESTION_GENERATOR_CONTRACT.md). Template organizuje
zestaw i jego runtime, lecz nie zastępuje kontraktu pojedynczego pytania.

### Przygotowanie

Teresa może challenge'ować brief, proponować coverage i pytania, sprawdzać
neutralność, duplikaty, bias oraz estimated time. Nie publikuje Template.

### Odpowiadanie

Wyjaśnia, dopytuje, transkrybuje, porządkuje i sprawdza kompletność. Nie
odpowiada za respondenta ani nie zmienia sensu wypowiedzi.

### Review

Wskazuje missing items, sprzeczności, słabe evidence i nieuprawnione wnioski.
Nie potwierdza odpowiedzi ani nie znosi anonymity.

### Synthesis

Tworzy insight proposals z cytowaniami, alternatywnymi interpretacjami i
confidence. Nie promuje ich do wiedzy ani Initiatives bez decyzji człowieka.

## 4. Minimalne stany funkcji

Każda funkcja implementacyjna musi obsłużyć:

- loading, empty, ready, degraded i error;
- no permission i revoked;
- draft/unsaved/saving/saved/save failed;
- pending AI proposal i rejected proposal;
- stale/superseded;
- audit event oraz deep link;
- brak demo fallbacku maskującego błąd.
