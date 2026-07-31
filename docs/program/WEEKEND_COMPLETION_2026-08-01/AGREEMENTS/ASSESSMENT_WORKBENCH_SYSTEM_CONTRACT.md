---
document_id: ASSESSMENT-WORKBENCH-SYSTEM-CONTRACT
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment Workbench — kontrakt wspólnego edytora

## 1. Cel

Jeden Assessment Workbench obsługuje DRD, SIRI, ADMA i kolejne kontrolowane
metodyki. Wspólny jest sposób pracy, stan sesji, evidence, AI, review i
publikacja. Zmienna pozostaje treść metodyki, skala, macierz, scoring,
priorytetyzacja i outputy.

Assessment nie jest odmianą Tool Session. Współdzieli jego kontrakty systemowe,
ale nie kopiuje obecnego wizualnego wykonania Tools. Obszar merytoryczny
Assessmentu pozostaje sekwencyjnym, pogłębiającym wywiadem oraz graficzną
macierzą. Obecne edytory Assessment są punktem jakościowym, który należy
rozwinąć, a nie zastąpić mniej czytelnym ekranem Tool Session.

## 2. Wspólny model ekranu

```text
Assessment Header
Context Strip + one Command Row
┌──────────────────┬──────────────────────────────┬────────────────────┐
│ Method Navigator │ Interview / Evidence Canvas  │ Teresa             │
│ + progress       │                              │ Collaboration      │
├──────────────────┴──────────────────────────────┴────────────────────┤
│ Graphic Mirror: matrix / map / radar / prioritisation               │
└──────────────────────────────────────────────────────────────────────┘
Bottom status: save · methodology version · evidence · review · blockers
```

### Header

- metoda, nazwa i scope Assessmentu;
- status procesu i metodologia/version;
- `Guided Manual` / `Teresa-led`;
- `Wyjdź`, `Zapisz teraz`, `Wróć do sesji`;
- review/freeze i Menu 3.

### Method Navigator

Pokazuje strukturę dostarczoną przez Method Pack: axis, building block,
pillar, dimension albo area. Każda pozycja pokazuje current, target, stan
evidence, confidence, rozbieżność, owner i next action.

### Interview / Evidence Canvas

Jest jedynym miejscem pracy merytorycznej. Zawiera znaczenie obszaru, poziomy,
pytania, odpowiedzi, dowody, notatki, propozycję scoringu i decyzję człowieka.
Nie jest wielokolumnowym formularzem pokazującym wszystko naraz. Domyślnie
prowadzi przez kolejne pytania, zachowując kontekst poprzednich odpowiedzi i
pokazując, dlaczego następne pytanie zostało zadane.

### Graphic Mirror

Jest stałym, żywym odbiciem tego samego stanu, nie osobnym raportem. W DRD
macierz area × level jest głównym widokiem. Kliknięcie komórki otwiera jej
wywiad i dowody; zmiana zatwierdzonego poziomu natychmiast zmienia macierz.

Macierz jest także pełnoprawnym edytorem powrotu. Po zakończeniu osi użytkownik
może wybrać dowolny prostokąt/komórkę, otworzyć dokładnie powiązane pytania,
odpowiedzi, rationale i evidence, dokonać zmiany oraz wrócić do macierzy z
zachowaniem zoomu, scrolla i zaznaczenia.

## 3. Kanoniczny przebieg pracy

`Brief → Prepare → Interview → Evidence validation → Consolidation → Scoring
review → Score freeze → Results → Prioritisation → Output → Initiative drafts`

Workbench musi pozwalać opuścić sesję, wrócić, cofać się oraz poprawiać
wcześniejsze odpowiedzi. Zmiana upstream oznacza downstream jako `stale/needs
review`; nic nie jest cicho kasowane ani automatycznie zatwierdzane.

## 4. Dwa tryby pracy

### Guided Manual

Użytkownik sam wybiera obszar, prowadzi rozmowę, zapisuje odpowiedź i dowody.
Lokalne akcje AI wyjaśniają poziom, proponują pytanie, analizują dowód,
challenge'ują score albo przygotowują podsumowanie.

### Teresa-led

Teresa prowadzi wywiad, materializuje odpowiedzi i propozycje w tych samych
obiektach Workbencha oraz zatrzymuje się na wymaganych decyzjach człowieka.
Przełączenie trybu nie tworzy kopii ani migracji danych.

## 5. Relacja ze standardem Tools

Z [`TOOL_SESSION_WORKSPACE_STANDARD.md`](TOOL_SESSION_WORKSPACE_STANDARD.md)
przejmujemy:

- header, context strip, command row i prawy panel Teresy;
- jawny save state, recovery, bezpieczne wyjście i stabilny deep link;
- Guided Manual / Teresa-led;
- proposal → accept/edit/reject/rethink;
- comments, activity, history i relations jako utilities;
- rozdzielenie Edit, AI proposal, review i finalizacji;
- standard Canvas, accessibility, Menu 3 i responsive layout.

Nie przejmujemy:

- obecnego wyglądu ekranów Tools ani ich gęstości informacyjnej;
- pięciu faz Tools jako nawigacji Assessmentu;
- swobodnej pracy canvasowej jako głównego modelu pytań;
- układu, w którym użytkownik nie widzi sekwencji i pogłębiania wywiadu.

Nawigacją główną jest struktura metodyki, a lifecycle jest procesem oceny.

## 5.1 Dwa równorzędne obszary pracy

Workbench posiada dwa przełączalne, ale zawsze zsynchronizowane widoki:

1. **Interview Focus** — jedno aktualne pytanie lub mała logiczna grupa,
   odpowiedź, supporting context, evidence i następny krok;
2. **Matrix Focus** — pełny obraz osi/metody oraz bezpośrednia edycja przez
   komórki.

Zmiana widoku nie zapisuje innego modelu. `Interview Focus` jest najlepszy do
prowadzenia nowej rozmowy, a `Matrix Focus` do orientacji, calibration, powrotu
i korekty.

## 6. Usunięcie lokalnych duplikatów

Z docelowego edytora usuwamy lub przenosimy stare funkcje, które powstały przed
obecną architekturą:

- lokalny kreator „zespołu Assessmentu” zastępują Project Team i role procesu;
- osobny ekran historii zastępuje wspólne Activity/Version History;
- lokalne taski i przypomnienia są projekcjami My Work;
- lokalne dokumenty są relacjami do Materials;
- lokalna biblioteka osób nie duplikuje Organization;
- lokalny generator inicjatyw tworzy wyłącznie Proposal Drafts do zakładki
  Initiatives;
- framework-specific header, save, comments i AI shell nie mogą istnieć obok
  wspólnego shellu.

Nie usuwamy danych historycznych. Legacy UI otrzymuje adapter/read-only albo
migrację do wspólnych obiektów.

## 7. Minimalny model stanu

- `AssessmentSession`;
- `MethodPackRef`;
- `Scope`;
- `AssessmentUnitState`;
- `InterviewResponse`;
- `EvidenceItem` i `EvidenceLink`;
- `ScoreProposal`, `ScoreDecision`, `TargetDecision`;
- `DiscrepancyCase`;
- `FreezeSnapshot`;
- `AssessmentOutput`;
- downstream relations.

## 8. Golden flow

`Create DRD → brief → scope → interview 39 areas → evidence checks →
consolidation → human scoring review → freeze → live matrix result → findings →
prioritisation → report/deck candidates → Initiative Proposal Drafts`

SIRI i ADMA muszą przejść ten sam shell bez tworzenia osobnych edytorów.

## 9. Definition of Done

1. Jedna sesja otwiera się pod stabilnym URL i zawsze daje się bezpiecznie
   opuścić.
2. Method Pack konfiguruje edytor bez framework-specific forka shellu.
3. Macierz i Canvas czytają oraz zapisują ten sam model.
4. Każdy score ma rationale, evidence state i decyzję człowieka.
5. Teresa i akcje lokalne używają jednej warstwy capabilities.
6. Legacy teams/history/tasks nie dublują funkcji aplikacji.
7. Freeze tworzy odtwarzalny snapshot.
8. DRD, SIRI i ADMA przechodzą contract tests oraz własne golden flows.
