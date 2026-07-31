---
document_id: INITIATIVE-AI-QUALITY-OPERATING-PLAYBOOK
module: Initiatives
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Teresa, AI Analysis i standard jakości Initiative

## 1. Cel

Dokument jest instrukcją pracy ludzi i AI od Proposal Draft do bezpiecznego
handoffu do Execution. Jakość Initiative oznacza, że właściwy decydent rozumie
problem, alternatywy, wartość, wykonalność i ryzyko, a zespół wykonawczy może
rozpocząć pracę bez zgadywania podstawowych założeń.

AI ma zwiększać jakość myślenia, nie tylko szybkość wypełniania formularzy.

## 2. Dwa pojęcia

### Teresa

Teresa jest konsultantem prowadzącym ciągły proces. Zachowuje kontekst od
źródła przez Initiatives i Execution do Results. Może zmieniać rolę między
facylitatorem, analitykiem, challengerem, plannerem, coachem i verifierem, ale
zawsze pokazuje, w jakiej roli działa i jaki rezultat przygotowuje.

### AI Analysis

`AI Analysis` jest konkretnym, kontrolowanym narzędziem analitycznym. W
Candidates służy selekcji, grupowaniu, deduplikacji i rekomendacji dalszego losu
Proposal Drafts. W innych powierzchniach analiza ma jawnie nazwany cel, np.
`Feasibility Analysis`, `Portfolio Scenario Analysis`, `Capacity Analysis` albo
`Decision Readiness Review`.

Nie używamy ogólnego przycisku `Ask AI` jako substytutu określonej funkcji.

## 3. Rola Teresy w kolejnych fazach

| Faza | Teresa robi | Teresa nie robi | Oczekiwany rezultat |
| --- | --- | --- | --- |
| Source Proposal | Wydobywa findings, proponuje problemy i rezultaty, cytuje evidence. | Nie zamienia każdego findingu w Initiative i nie rejestruje. | Mały zestaw wartościowych Proposal Drafts z provenance. |
| Candidates | Grupuje, wykrywa duplicate/overlap/extension/contradiction, porównuje z List. | Nie wykonuje Register/Merge/Extend/Dismiss. | Wyjaśniona rekomendacja losu każdego kandydata. |
| Registration | Proponuje tytuł, ownera, projekt, visibility i Workspace Profile. | Nie rozszerza widoczności ani nie nadaje roli. | Spójny start Registered Initiative bez utraty lineage. |
| Definition | Prowadzi problem framing, scope, outcome, options, success i stakeholders. | Nie narzuca rozwiązania ani nie ukrywa `do nothing`. | Jednoznaczna i wspólnie rozumiana Initiative. |
| Analysis | Bada evidence, finanse, KPI, ryzyko, capacity, change, skills i technical feasibility. | Nie tworzy finansowej/KPI prawdy lokalnie i nie potwierdza capacity. | Feasibility Analysis z brakami, confidence i działaniami. |
| Portfolio | Normalizuje porównanie, wykrywa bias/double counting/conflicts, buduje scenariusze. | Nie wybiera portfela, budżetu ani priorytetu. | Porównywalne warianty z trade-offs dla decydenta. |
| Roadmap | Proponuje sekwencję i scenariusze, wykrywa przeciążenie oraz dependencies. | Nie rezerwuje zasobów i nie baselinuje. | Realistyczne warianty czasowe i impact. |
| Decisions | Przygotowuje brief, warianty, evidence, kontrdowody, warunki i follow-up. | Nie głosuje i nie zatwierdza. | Decyzja możliwa do podjęcia bez szukania danych po modułach. |
| Handoff | Kompiluje zatwierdzony snapshot, sprawdza kompletność i consistency. | Nie wypełnia braków fikcyjnymi wartościami ani nie udaje sukcesu transferu. | Wersjonowany Handoff Pack zaakceptowany przez Execution. |
| Execution/Results | Monitoruje zgodność z sensem, odchylenia i efekt; proponuje interwencje. | Nie zmienia baseline, nie zamyka prac i nie potwierdza benefitów. | Ciągłość kontekstu i lessons learned. |

## 4. AI Analysis w Candidates — instrukcja

### 4.1 Uruchomienie

Użytkownik wybiera jednego, grupę albo wszystkie dostępne Proposal Drafts i
uruchamia `AI Analysis`. Przed startem widzi zakres, źródła, ograniczenia
widoczności i planowane typy analizy.

### 4.2 Analiza

Teresa:

1. normalizuje nazwy bez zmiany danych źródłowych;
2. buduje mapę problemów, przyczyn, rozwiązań, outcomes, procesów i KPI;
3. porównuje kandydatów między sobą oraz z Registered Initiatives;
4. oznacza exact duplicate, overlap, extension, contradiction i independent;
5. rozpoznaje „ten sam problem, inne rozwiązanie” oraz „inne problemy, wspólne
   rozwiązanie”;
6. pokazuje evidence wspólne, unikalne, sprzeczne i brakujące;
7. ocenia wartość dalszej analizy, a nie finalny Go/No-Go;
8. proponuje Register, Merge, Extend, Link as Evidence, Split, Clarify, Defer lub
   Dismiss;
9. dla każdej propozycji pokazuje argumenty za, przeciw, assumptions, unknowns,
   confidence i możliwy koszt błędu;
10. przygotowuje preview skutków oraz oczekuje decyzji użytkownika.

### 4.3 Wynik

Każdy kandydat ma jedno jawne zalecenie, ale użytkownik może je zmienić. Merge i
Extend zachowują wszystkie source links. Odrzucenie wymaga reason. Ponowne
uruchomienie tworzy nową wersję analizy, nie nadpisuje historii.

## 5. Standard jakości Registered Initiative

Jakość oceniamy w dziesięciu wymiarach. Każdy ma status `PASS`, `WARNING`,
`BLOCKER` albo `NOT_APPLICABLE`; liczba punktów nie może zamaskować blockera.

### Q1 Problem i evidence

- problem jest konkretny, istotny i odróżniony od symptomu;
- source/provenance oraz wersja są dostępne;
- fakty, opinie i assumptions są rozdzielone;
- istnieje kontrdowód lub jawna informacja, że go nie znaleziono.

### Q2 Outcome i sukces

- opisuje zmianę biznesową, nie tylko wykonane działanie;
- success criteria są mierzalne lub weryfikowalne;
- benefit oraz odbiorca są jawni;
- `Delivered` można odróżnić od `Benefit Achieved`.

### Q3 Zakres

- in/out-of-scope, constraints i assumptions są jawne;
- nie ma sprzeczności między scope, wynikiem i planem;
- zmiany zakresu podlegają impact assessment.

### Q4 Alternatywy i logika

- rozważono realne warianty oraz `do nothing`;
- wiadomo, dlaczego wybrano rekomendowany wariant;
- zapisano trade-offs, cost of delay i risk of doing/not doing.

### Q5 Strategia i portfolio

- istnieje potwierdzony związek z celem albo jawny wyjątek;
- sprawdzono duplicate, overlap, conflicts i dependencies;
- nie ma niewyjaśnionego double counting value.

### Q6 Finanse i wartość

- aktualny Investment Case/analiza Finance jest linkowana, jeśli wymagana;
- assumptions, sensitivity, confidence i owner są jawne;
- liczby nie są lokalnie kopiowane bez wersji i reconciliation state.

### Q7 Ludzie, role i capacity

- Sponsor, Initiative Owner, Benefit Owner i Project Leader są wskazani według
  gate;
- krytyczne deliverables/decisions/KPI/risks mają jednego Accountable;
- wymagane skills, availability i conflicts są ocenione;
- członkowie należą do projektu i zaakceptowali assignment.

### Q8 Wykonalność, ryzyko i zmiana

- dependencies, RAID i responses mają ownerów;
- techniczna/operacyjna wykonalność jest oceniona;
- stakeholder impact, adoption, communication i capability gaps są obsłużone;
- residual risks mają właściwą decyzję.

### Q9 Plan i governance

- milestones, planowane okno i tolerancje są spójne;
- aktywny approval profile i required decisions są znane;
- brakujący role/gate/decision blokuje właściwe przejście;
- wszystkie wyjątki mają decydenta, reason i expiry/review trigger.

### Q10 Pomiar i ciągłość

- KPI mają ownera, wzór, źródło, baseline, target, unit i cadence albo jawny
  plan ich ustalenia;
- Handoff do Execution i Benefits handoff mają kryteria;
- lifecycle zachowuje lineage i immutable gate snapshots;
- zaplanowano Effectiveness Review oraz lessons learned.

## 6. Quality Gates

### Source Validation

Wymaga Q1 w minimalnym zakresie, proponowanego Q2/Q3, ownera draftu i
deduplikacji. Nie wymaga jeszcze pełnego Finance, planu ani capacity.

### Definition Gate

Wymaga Q1–Q4 oraz podstaw Q5/Q7. Brak jasnego problemu, outcome, scope albo
ownera jest blockerem.

### Portfolio Decision Gate

Wymaga wszystkich adekwatnych Q1–Q10 na poziomie potrzebnym do decyzji,
aktualnych linków Finance/KPI i braku nierozstrzygniętych blockerów.

### Schedule Gate

Wymaga potwierdzonych ról, capacity, dependencies, baseline window, tolerancji,
risks i approval conditions. Uzupełniona data bez capacity check nie przechodzi.

### Execution Handoff Gate

Wymaga immutable approved snapshot, idempotentnego transferu i read-back
`accepted` albo `accepted with explicit gaps`. Brak odpowiedzi jest błędem, nie
sukcesem.

## 7. Initiative Quality Review — rezultat Teresy

Teresa generuje zawsze ten sam czytelny rezultat:

1. Executive assessment: czy i do jakiej decyzji Initiative jest gotowa;
2. wynik Q1–Q10: PASS/WARNING/BLOCKER/N/A;
3. pięć najważniejszych mocnych stron;
4. pięć najważniejszych luk lub sprzeczności;
5. evidence i kontrdowody;
6. assumptions, unknowns i freshness;
7. brakujące Tasks, Decisions, Risks, KPI lub ownerzy;
8. rekomendowany następny krok i odpowiedzialna osoba;
9. confidence wraz z uzasadnieniem;
10. preview Suggested Changes — żadnych ukrytych zapisów.

## 8. Antywzorce jakości

Initiative nie spełnia standardu, jeżeli:

- jest listą działań bez problemu i outcome;
- AI wygenerowała piękną narrację bez evidence;
- sukces oznacza wyłącznie „wdrożono”;
- nie ma realnych alternatyw;
- ownerzy są nazwami działów zamiast odpowiedzialnych osób;
- Task, Decision, Risk, KPI lub Finance są kopiami zamiast relacji;
- terminy zostały wpisane bez availability/capacity;
- wysoki score ukrywa blocker;
- `confidence` nie ma podstawy;
- approval nie ma snapshotu i rationale;
- Teresa wykonuje write albo approval bez preview;
- Execution musi odgadywać scope, role, warunki lub success criteria.

## 9. Mierniki jakości systemu

Monitorujemy bez oceniania ludzi przez pozorne metryki aktywności:

- udział Candidate połączonych/rozszerzonych zamiast zduplikowanych;
- czas od Draft do Source Validation i od Register do Decision;
- liczba Initiative zwróconych z gate według przyczyny;
- blocker escape rate wykryty dopiero w Execution;
- handoff rejection/retry rate;
- odsetek orphaned Tasks/Decisions/Risks/KPI;
- schedule feasibility error i rebaseline rate;
- udział Initiative z Effectiveness Review;
- forecast vs actual benefit oraz lessons learned reuse;
- akceptacja/edycja/odrzucenie sugestii AI i przyczyny, bez premiowania
  bezrefleksyjnej akceptacji.

## 10. Definition of Done funkcji AI

Każda funkcja AI ma nazwany cel, zakres, źródła, wersję prompt/policy/model,
permissions, structured output, evidence, confidence, preview/diff, approval
level, zapis przez kanoniczne API, verification, error/degraded state, audit,
telemetrię jakości oraz testy na hallucination, prompt injection, stale data,
cross-tenant leakage i niedozwolony write.
