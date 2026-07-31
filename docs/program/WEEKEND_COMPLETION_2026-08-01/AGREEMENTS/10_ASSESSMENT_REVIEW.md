---
agreement_id: MOD-AGR-10
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
accepted_by:
accepted_at:
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Assessment

## 1. Definicja

**Assessment** prowadzi zamknięte, metodycznie kontrolowane i płatne
postępowania oceniające poziom rozwoju cyfrowego organizacji. W MVP obejmuje
przede wszystkim DRD i SIRI.

Assessment nie jest:

- swobodnym narzędziem konsultingowym — to Tools;
- generatorem dowolnego audytu z normy — to Audits;
- ankietą bez dowodów;
- automatycznym testem, w którym AI samodzielnie ustala wynik.

Metodyka, pytania, skale, zależności, reguły scoringu i raport muszą być
wersjonowane i możliwe do odtworzenia.

## 2. Obietnica użytkownikowi

Organizacja może:

- wybrać właściwą metodykę;
- ustalić zakres organizacji, jednostek i respondentów;
- przejść prowadzony proces przygotowania;
- przypisać pytania i obszary właściwym ekspertom;
- zbierać odpowiedzi, komentarze, dowody i oceny;
- rozwiązywać rozbieżności;
- zatwierdzić baseline dojrzałości;
- zobaczyć current, target i gap;
- otrzymać profesjonalny raport i ścieżkę rozwoju;
- utworzyć Initiative Candidates z rekomendacji;
- po czasie przeprowadzić reassessment i porównać postęp.

## 3. Granice domen

| Moduł | Odpowiedzialność |
| --- | --- |
| Assessment | methodology, session, answers, evidence links, scoring, maturity baseline, findings |
| Organization | struktura firmy, procesy, jednostki i kontekst |
| Interview | rozmowy źródłowe i zatwierdzone insights |
| Materials | dokumenty dowodowe oraz publikacja raportu |
| Initiatives | triage i decyzja o rekomendowanych zmianach |
| Results | KPI oraz późniejsze pomiary |
| Audits | branżowe i zgodnościowe postępowania audytowe |
| Tools | elastyczne metody konsultingowe |

## 4. Pierwsza zakładka — Library

Pierwszą i domyślną zakładką jest **Library**, zgodna z
[`METHOD_LIBRARY_FIRST_STANDARD.md`](METHOD_LIBRARY_FIRST_STANDARD.md). Pokazuje
DRD, SIRI i kolejne dozwolone Methodology Packs wraz z celem, zastosowaniem,
modelem dojrzałości, wymaganymi uczestnikami/evidence, czasem, licencją,
expected outputs, przykładem i faktycznym readiness.

Library pomaga wybrać metodę i uruchomić nowy Assessment. Nie pokazuje aktywnych
procesów ocennych.

## 4.1 Druga zakładka — Processes

Druga zakładka **Processes** jest tabelą wszystkich Assessmentów dostępnych
użytkownikowi. Typ obiektu używa języka Assessment, ale nazwa zakładki pozostaje
wspólna z Tools i Audits.

Minimalne kolumny:

- nazwa i metodyka;
- organizacja/scope;
- status;
- owner/lead assessor;
- postęp odpowiedzi;
- evidence completeness;
- current stage;
- respondent/reviewer readiness;
- due date;
- ostatnia aktywność;
- next required action;
- report status.

Statusy są filtrami jednego rejestru:

`Draft → Preparing → Collecting → Reviewing → Scoring → Report review →
Approved → Closed → Reassessment due → Archived`

## 5. Kanoniczne obszary

1. **Library** — dostępne Methodology Packs i wybór metody.
2. **Processes** — aktywne i historyczne Assessmenty oraz widoki Assignments.
3. **Outputs** — zatwierdzone, immutable Assessment Results.
4. **Deliverables** — raporty, prezentacje i porównania w Materials.
5. **Initiatives** — lokalne Proposal Drafts wynikające z Assessment.

Pełny Assessment Workbench otwiera się z Processes albo deep linku. Wspólny
kontrakt opisuje
[`METHOD_MODULE_FIVE_SURFACES_STANDARD.md`](METHOD_MODULE_FIVE_SURFACES_STANDARD.md).

## 6. Methodology Pack

Każda metodyka posiada wersjonowany pakiet:

- licencję, właściciela i dopuszczony sposób użycia;
- cel, zakres i ograniczenia;
- dimensions/axes/building blocks;
- pytania i guidance;
- maturity levels oraz deskryptory;
- wymagane dowody;
- scoring rules;
- aggregation i rounding;
- prerequisites i dependencies;
- target-setting guidance;
- report schema;
- recommendation/maturity pathway rules;
- języki;
- datę obowiązywania.

Sesja przypina konkretną wersję metodyki. Aktualizacja frameworku nie zmienia
historycznego wyniku.

## 7. Uruchomienie i przygotowanie

`Create → methodology/version → organization scope → assessment purpose →
participants → assignments → evidence plan → timeline → readiness review →
launch`

Przed uruchomieniem Teresa pokazuje `Assessment Brief`:

- dlaczego wykonujemy Assessment;
- jaki zakres obejmuje;
- kto odpowiada, ocenia i zatwierdza;
- jakie dane oraz dowody będą potrzebne;
- harmonogram i rytm;
- sposób rozstrzygania rozbieżności;
- plan raportu i odbiorców;
- ograniczenia metodyki.

## 8. Role

- `Assessment Owner` — odpowiada za cel, zakres i zakończenie;
- `Lead Assessor` — odpowiada za metodykę oraz jakość procesu;
- `Assessor` — ocenia przypisane obszary;
- `Respondent` — dostarcza odpowiedzi i dowody;
- `Evidence Owner` — odpowiada za wskazany dowód;
- `Reviewer` — weryfikuje odpowiedzi, dowody i scoring;
- `Approver` — zatwierdza baseline oraz raport;
- `Observer` — posiada kontrolowany odczyt.

Lead Assessor i Approver mogą być wymagani jako różne osoby.

## 9. Workbench

Workbench prowadzi użytkownika według struktury metodyki:

- navigation po dimensions/axes;
- status każdego obszaru;
- pytanie, guidance i przykłady;
- current answer i proposed maturity;
- target maturity;
- komentarze;
- dowody;
- respondent oraz assessor;
- confidence;
- validation warnings;
- review history;
- next action.

Docelowy kontrakt Workbencha, jego nawigację, sekwencyjny Interview Focus oraz
dwukierunkową macierz definiują:

- [`ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md`](ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md);
- [`ASSESSMENT_UI_NAVIGATION_AND_MATRIX_STANDARD.md`](ASSESSMENT_UI_NAVIGATION_AND_MATRIX_STANDARD.md).

Assessment przejmuje z Tools mechanikę shell/save/exit/AI proposal, ale nie
kopiuje obecnego wyglądu ani pięciu faz Tool Session. Obecne dojrzałe elementy
edytorów Assessment są bazą dla nowoczesnego, skupionego UX pytań.

Autosave nie może cicho nadpisywać zmiany innego użytkownika. Konflikt pokazuje
diff i wymaga rozwiązania.

## 10. Odpowiedź, dowód i scoring

Odpowiedź przechodzi:

`Not assigned → Assigned → Draft → Submitted → In review → Accepted /
Returned → Locked`

Każda ocena zachowuje:

- wartość i scale;
- rationale;
- respondent;
- assessor;
- evidence links;
- confidence;
- methodology version;
- czas i historię;
- reviewer decision.

Scoring jest deterministyczny. AI może proponować score wyłącznie jako draft z
uzasadnieniem i dowodami. Zatwierdzony score jest wynikiem człowieka oraz
silnika metodyki.

## 11. Rozbieżności i calibration

System wykrywa:

- różne odpowiedzi respondentów;
- score bez dowodu;
- dowód nieaktualny lub nieadekwatny;
- różnicę respondent–assessor;
- niespójność między zależnymi dimensions;
- wynik niezgodny z deskryptorem poziomu;
- anomalie względem wcześniejszego Assessment.

Rozbieżność prowadzi do calibration case:

`Detected → Clarification → Evidence review → Assessor proposal → Reviewer
decision → Resolved`

## 12. Target i maturity pathway

Target nie jest automatycznie maksymalnym poziomem. Zależy od:

- strategii i potrzeb organizacji;
- obecnego poziomu;
- prerequisites;
- kosztu, czasu i zdolności;
- ryzyka;
- znaczenia dimension;
- powiązanych celów.

Maturity pathway opisuje kolejne osiągalne kroki, warunki oraz dowody potrzebne
do przejścia na wyższy poziom.

## 13. Teresa

Teresa:

- pomaga wybrać właściwą metodykę;
- przygotowuje Assessment Brief;
- wyjaśnia pytania i terminy;
- kieruje pytanie do właściwego respondenta;
- streszcza dowody bez zmiany ich znaczenia;
- wskazuje brak, sprzeczność i niską jakość;
- proponuje score, rationale i confidence;
- przygotowuje calibration brief;
- proponuje target oraz maturity pathway;
- tworzy draft findings, rekomendacji i raportu;
- grupuje rekomendacje w Initiative Candidates.

Teresa nie:

- zmienia definicji licencjonowanej metodyki;
- tworzy dowodu;
- uznaje deklaracji za fakt;
- zatwierdza odpowiedzi, score, baseline lub raport;
- ukrywa braku evidence;
- porównuje organizacji z benchmarkiem bez źródła i prawa użycia danych.

## 14. Findings i rekomendacje

Finding zawiera:

- dimension i poziom;
- current, target i gap;
- evidence;
- znaczenie biznesowe;
- root cause hypothesis;
- risk/opportunity;
- recommendation;
- prerequisite;
- expected outcome;
- proposed KPI;
- confidence;
- priority rationale.

Zatwierdzone findings mogą zostać pogrupowane w Initiative Candidate Pack.
Assessment nie tworzy automatycznie Approved Initiative.

## 15. Raport

Raport zawiera:

- executive summary;
- scope, methodology i version;
- participants i limitations;
- overall result;
- dimension/axis results;
- current/target/gap;
- evidence quality;
- strengths;
- gaps i risks;
- maturity pathways;
- recommendations;
- Initiative Candidates;
- appendices i traceability.

Raport jest zatwierdzonym snapshotem. Materials odpowiada za finalną publikację,
viewer, download, share link i delivery.

## 16. Reassessment

Reassessment:

- wskazuje poprzedni approved baseline;
- przypina nową wersję metodyki lub jawnie zachowuje starą;
- rozróżnia zmianę organizacji od zmiany frameworku;
- porównuje current-to-current oraz target;
- pokazuje postęp, regres i brak porównywalności;
- nie przelicza historii nową metodą bez jawnej symulacji.

## 17. Stan obecny

### Mamy

- kanoniczną trasę `/assessment` i alias `/licensed-tools`;
- `AssessmentHub` oraz `AssessmentSessionEditorView`;
- DRD, SIRI, ADMA, CMMI i Lean w typach runtime;
- wersjonowane definitions i workbench API V8;
- roles, assignments i resume state;
- odpowiedzi, score restrictions i permission guidance;
- DRD/SIRI reports i wizualizacje;
- maturity pathway;
- benchmark comparison;
- transfer z Interview;
- generowanie recommendations/Initiatives;
- testy V8 i demo coherence.

### Fragmentacja i ryzyka

- brak zarejestrowanego `CURRENT_CONTRACT.md` dla osobnej pozycji Assessment;
- podwójne katalogi `Assessment` i `assessment`;
- DRD report bywa opisany i routowany jako Audit;
- `/assessment/overview`, `/summary` i kilka framework routes;
- aktywne aspiracyjne typy mogą wyglądać na ukończone;
- różne report engines i legacy redirect;
- część frameworków nie ma pełnych level descriptors;
- benchmarki mogą nie mieć jawnych źródeł/licencji;
- nie udowodniono jednego pełnego multi-user golden flow.

## 18. Najważniejsze scalenia

1. Jedna pozycja menu i trasa `/assessment`.
2. Pierwsza zakładka `Library`, druga `Processes`.
3. Jeden wersjonowany Methodology Pack contract.
4. Jeden Assessment lifecycle.
5. Jeden answer/evidence/review contract.
6. Jeden deterministic scoring engine per methodology version.
7. Jeden report snapshot i publikacja przez Materials.
8. DRD/SIRI usunięte z własności Audits.
9. Jeden Initiative Candidate handoff.
10. Jawna matryca gotowości frameworków.

## 19. Golden flow MVP

`create DRD/SIRI → Assessment Brief → scope and assignments → launch →
multi-user answers + evidence → assessor review → calibration → deterministic
score → target/pathway → report review → approved snapshot → Initiative
Candidates → Materials publication`

## 20. Kryteria ukończenia

1. Sesja jest przypięta do wersji metodyki.
2. Historyczny wynik jest odtwarzalny.
3. Role i assignments działają w pełnym flow.
4. Autosave nie gubi ani nie nadpisuje konfliktu.
5. Odpowiedź zachowuje rationale i evidence.
6. Brak dowodu jest jawny.
7. AI score jest draftem, nie zatwierdzonym wynikiem.
8. Scoring jest deterministyczny i testowany fixture'ami.
9. Calibration case rozwiązuje rozbieżność z historią.
10. Target respektuje prerequisites i strategię.
11. Report wskazuje methodology/version/limitations.
12. Initiative handoff zachowuje lineage i nie tworzy Approved Initiative.
13. Materials zachowuje link do Assessment snapshot.
14. Reassessment nie fałszuje porównania po zmianie metodyki.
15. Benchmark posiada źródło, datę i prawo użycia.
16. Teresa nie fabrykuje dowodów ani scores.
17. Cross-org odczyt i zapis są blokowane.
18. DRD i SIRI golden flow przechodzą E2E na stagingu.
19. UI spełnia kanon list/table/preview/workbench/Menu 3.
20. Demo/fallback nie maskuje błędów runtime.

## 21. Pakiet wykonawczy wspólnego edytora

Dokumenty rozwijające tę kartę:

1. [`ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md`](ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md)
   — jeden edytor, integracje oraz granica z Tools.
2. [`ASSESSMENT_UI_NAVIGATION_AND_MATRIX_STANDARD.md`](ASSESSMENT_UI_NAVIGATION_AND_MATRIX_STANDARD.md)
   — Interview/Matrix/Split oraz round-trip komórka ↔ pytanie.
3. [`ASSESSMENT_METHOD_PACK_CONTRACT.md`](ASSESSMENT_METHOD_PACK_CONTRACT.md)
   — wymagania każdej metodyki.
4. [`ASSESSMENT_INTERVIEW_QUESTION_CONTRACT.md`](ASSESSMENT_INTERVIEW_QUESTION_CONTRACT.md)
   — sekwencja, routing, pytania i odpowiedzi.
5. [`ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md`](ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md)
   — dowody, proposals, decisions i freeze.
6. [`ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md`](ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md)
   — help, brak wiedzy respondenta oraz rozmowa o pytaniu.
7. [`TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md`](TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md)
   — sposób działania AI.
8. [`ASSESSMENT_SESSION_LIFECYCLE_ROLES_AND_INTEGRATIONS.md`](ASSESSMENT_SESSION_LIFECYCLE_ROLES_AND_INTEGRATIONS.md)
   — statusy, role oraz rezygnacja z lokalnych duplikatów.
9. [`ASSESSMENT_KNOWLEDGE_BASE_AND_COMMUNICATION_CONTRACT.md`](ASSESSMENT_KNOWLEDGE_BASE_AND_COMMUNICATION_CONTRACT.md)
   — baza wiedzy i komunikacja runtime.
10. [`ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md`](ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md)
   — Output, Deliverable i Initiative Draft.

Metody:

- [`ASSESSMENT_KB_DRD.md`](ASSESSMENT_KB_DRD.md);
- [`ASSESSMENT_KB_SIRI.md`](ASSESSMENT_KB_SIRI.md);
- [`ASSESSMENT_KB_ADMA.md`](ASSESSMENT_KB_ADMA.md).

Otwarte pozostają wyłącznie decyzje komercyjne/licencyjne oraz konfiguracja
widoczności wyników przed freeze; nie blokują opisu wspólnego runtime.

## Granica przekazania do Initiatives

Końcowa zakładka `Initiatives` tworzy lokalne `Initiative Proposal Drafts` z
zatwierdzonych gapów i rekomendacji Assessment. Proposal pozostaje w kontekście
Assessment i nie jest szeroko widoczny przed Source Validation. Dopiero
`Register as Initiative` nadaje initiativeId, projekt, widoczność i governance.
Pełną ścieżkę określa
[`INITIATIVE_END_TO_END_LIFECYCLE.md`](INITIATIVE_END_TO_END_LIFECYCLE.md).
