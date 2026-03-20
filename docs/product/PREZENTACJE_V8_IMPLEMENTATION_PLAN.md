# Prezentacje v8 - Implementation plan

> Status: Draft v8
> Cel: Zamienic benchmark i SSOT `Prezentacje v8` na program wdrozeniowy z epikami, falami, zaleznosciami i planem weryfikacji.

---

## 1. Strategic intent

`Prezentacje v8` maja zostac wdrozone jako rozwoj istniejacego modulu prezentacji, a nie jako nowy produkt obok `consultify`.

Cel programu:
- ustawic `Gamma-primary workflow` jako kanoniczna sciezke produktu,
- uporzadkowac obecny potencjal hub/wizard/builder,
- dopiac traceability i delivery lifecycle,
- zintegrowac AI, visuals i quality gates w jeden model,
- zachowac zgodnosc z aktualnym shell, routes i artifact ecosystem.

Program nie jest greenfieldem.
Ma maksymalnie reuse'owac to, co juz istnieje:
- `ReportsAndPresentationsHub`,
- `PresentationWizard`,
- `DeckBuilder`,
- generator runtime,
- traceability metadata,
- share/embed/export,
- brand/media foundations.

---

## 2. Program structure

Program `v8` dzielimy na 6 strumieni:
- `V8-PRES-01 NavigationAndLibrary`
- `V8-PRES-02 GenerationAndTemplates`
- `V8-PRES-03 DeckModelAndBuilder`
- `V8-PRES-04 TraceabilityDeliveryAndQuality`
- `V8-PRES-05 AIContractAndOperations`
- `V8-PRES-06 RolloutRealityAndGovernance`

Kazdy strumien ma scope frontend, backend, data/traceability, AI, migration/rollout i testy.

---

## 3. Fale wdrozeniowe

### Fala A - Foundation and truth alignment

Cel:
- zamknac SSOT,
- doprecyzowac realny model produktu,
- przestawic narracje na Gamma-primary,
- opisac benchmark i as-is.

Deliverables:
- `PREZENTACJE_V8_SSOT.md`
- `PREZENTACJE_V8_BENCHMARK.md`
- `PREZENTACJE_V8_WORKFLOW_MODEL.md`
- `PREZENTACJE_V8_AS_IS.md`
- `PREZENTACJE_V8_RUNTIME_TRUTH_MAP.md`
- `PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `PREZENTACJE_V8_BUILDER_P0_CONTRACT.md`
- `PREZENTACJE_V8_AI_OPERATIONS_SPEC.md`

Definition of done:
- nie ma sporu, czym sa prezentacje jako produkt i jak odnosza sie do starego `v3`,
- glowna sciezka `hub -> wizard -> builder -> deliver` jest kanoniczna.

### Fala B - Core operating model

Cel:
- doprecyzowac canonical path `hub -> wizard -> builder -> deliver`.

Deliverables:
- navigation contract,
- generation contract,
- deck model,
- template contract,
- traceability contract,
- runtime truth map.

Definition of done:
- istnieje jedna formula pracy zamiast zbioru osobnych surfaces,
- baseline runtime i extension runtime nie sa mylone.

### Fala C - Quality and AI hardening

Cel:
- domknac AI, visuals i quality gates jako reviewable system.

Deliverables:
- AI contract,
- visual QA expectations,
- delivery lifecycle,
- deck operation rules.

Definition of done:
- kazdy obszar ma frontend, backend, data/traceability i test scope.

### Fala D - Rollout and enterprise safety

Cel:
- dowiezc zaufanie, mierzalnosc i rollout-safe interpretacje API/runtime reality.

Deliverables:
- rollout map,
- migration/runtime checklist,
- evaluation plan,
- support-ready reality map.

Definition of done:
- mozna wdrazac bez mylenia baseline z enterprise aspirations.

---

## 4. Epics

### V8-PRES-01 NavigationAndLibrary

Zakres:
- canonical entry points,
- rola `ReportsAndPresentationsHub`,
- relacja do starszych/deck-only surfaces,
- status and filter semantics.

Frontend:
- jasny hub contract,
- spojne CTA flows do wizarda i buildera,
- czytelne cards/table semantics,
- create flow z library jako punktem startowym.

Backend:
- list endpoints i metadata potrzebne dla huba.

Data/traceability:
- status decku/template,
- source type semantics widoczne w library.

AI:
- optional library recommendations i template suggestions.

Migration/rollout:
- nie lamac obecnych routes i deep links,
- zachowac compatibility z obecnym hubem i query params.

Test scope:
- route behavior,
- hub filtering,
- open-from-library flows.

Priority:
- P0

### V8-PRES-02 GenerationAndTemplates

Zakres:
- source selection,
- setup semantics,
- prompt semantics,
- outline contract,
- template contract,
- generation inputs and outputs.

Frontend:
- wizard steps,
- outline review,
- template-first i blank-first entry,
- artifact-first i library-first entry.

Backend:
- outline generation,
- generator endpoints,
- template and intents APIs.

Data/traceability:
- generation settings,
- selected sources,
- template defaults,
- context pack snapshot.

AI:
- outline suggestions,
- narrative generation,
- source-aware slide planning,
- AI as primary builder of the first draft.

Migration/rollout:
- zachowac compatibility z istniejacymi templates i seeded defaults,
- nie zrywac obecnego wizard runtime.

Test scope:
- wizard integration,
- outline generation,
- template selection,
- generation endpoint stability,
- setup -> outline -> generate continuity.

Priority:
- P0

### V8-PRES-03 DeckModelAndBuilder

Zakres:
- deck card model,
- builder role,
- deck operations,
- version/history expectations,
- builder continuity after generation.

Frontend:
- `DeckBuilder` contract,
- slide/block edit semantics,
- refinement flows.

Backend:
- deck CRUD/update,
- deck_json/unified_json handling,
- builder save/load invariants,
- canonical deck normalization bridge.

Data/traceability:
- card/block/source refs,
- locked state,
- refreshable block semantics,
- canonical deck document vs runtime projections.

AI:
- agent-like deck edit operations,
- reviewable deck modifications.

Migration/rollout:
- nie psuc obecnych saved decks,
- zachowac compatibility dla aktualnego deck payload modelu,
- otwierac stare decki przez compatibility layer bez wymuszania jednorazowej migracji.

Test scope:
- deck persistence,
- edit flows,
- builder open-after-generate continuity.

Priority:
- P0

### V8-PRES-04 TraceabilityDeliveryAndQuality

Zakres:
- source-backed deck model,
- refresh,
- share/embed/export,
- analytics,
- quality gates i visual QA.

Frontend:
- source visibility,
- share/export states,
- delivery cues,
- quality gates surfaces.

Backend:
- share endpoints,
- analytics,
- export/download,
- quality and legal checks.

Data/traceability:
- source refs integrity,
- export history,
- analytics records,
- deck lifecycle metadata,
- `context_pack_snapshot` and refresh rationale.

AI:
- quality suggestions,
- speaker notes,
- refresh support,
- visual planning rationale.

Migration/rollout:
- zachowac compatibility z obecnymi shared decks i export paths,
- rollout quality rules bez psucia istniejacych downloads/shares.

Test scope:
- export/share/embed flows,
- traceability verification,
- analytics integrity,
- quality gate behavior.

Priority:
- P0

### V8-PRES-05 AIContractAndOperations

Zakres:
- AI generation/edit/rewrite/refresh classes,
- review and acceptance model,
- audit baseline,
- explainability and source-backed AI,
- AI as primary deck builder.

Frontend:
- proposal review surfaces,
- AI edit distinctions,
- visible rationale and diff,
- clear distinction between `AI suggest`, `AI draft`, `AI apply after acceptance`.

Backend:
- proposal audit,
- AI operation persistence,
- protected deck mutations.

Data/traceability:
- operation metadata,
- source-backed AI references,
- diffable AI actions,
- preserved wizard -> builder review context.

AI:
- outline, narrative, edits, notes, visuals, quality suggestions.

Migration/rollout:
- nowe AI rules nie moga lamac obecnych AI surfaces bez fallbacku,
- rollout governance musi zachowac backward compatibility tam, gdzie user ma juz aktywne AI deck flows.

Test scope:
- AI evals,
- review/accept/reject flows,
- audit consistency,
- no-silent-edits regression.

Priority:
- P0

### V8-PRES-06 RolloutRealityAndGovernance

Zakres:
- baseline vs enterprise reality,
- `/api/presentations` vs `/api/presentations-v4`,
- migration/runtime truth map,
- governance and support-ready rollout.

Frontend:
- brak mylacego obiecywania funkcji ponad runtime reality,
- jasna komunikacja baseline vs advanced.

Backend:
- reality map of routes, migrations and schema expectations,
- legal hold and org policy constraints,
- explicit primary-vs-extension capability map.

Data/traceability:
- schema readiness,
- migration state assumptions,
- support diagnostics.

AI:
- AI cannot bypass rollout, policy or governance boundaries.

Migration/rollout:
- jasna mapa baseline runtime,
- readiness checklist,
- environment-safe rollout guidance.

Test scope:
- smoke tests,
- schema readiness,
- backward compatibility,
- support checklist validation.

Priority:
- P0

---

## 4A. Acceptance criteria matrix

### V8-PRES-01 NavigationAndLibrary

- User rozumie, gdzie jest library, gdzie wizard, a gdzie builder.
- Hub nie miesza deckow, template i reports semantics.
- Deep links i query-driven entry points dzialaja przewidywalnie.

### V8-PRES-02 GenerationAndTemplates

- User moze przejsc od source/brief do reviewable outline i generated decku bez chaosu.
- Template ma jawny kontrakt i wspiera generation rules.
- Outline jest czytelny i reviewable przed finalna generacja.
- Setup/prompt flow daje Gamma-like szybki start bez utraty source context.

### V8-PRES-03 DeckModelAndBuilder

- Builder otwiera generated deck bez utraty continuity.
- Deck, cards i blocks maja stabilny model danych.
- Edit flows nie zrywaja source refs i deck integrity.
- Stare decki otwieraja sie przez compatibility bridge.

### V8-PRES-04 TraceabilityDeliveryAndQuality

- Deck ma czytelne source refs i export/share lifecycle.
- Quality gates sa zrozumiale i nie marketingowe.
- Share/export/embed/analytics dzialaja jako jeden delivery model.

### V8-PRES-05 AIContractAndOperations

- Kazda istotna operacja AI dziala w modelu `propose -> review -> accept/reject`.
- User odroznia AI-generated content od wlasnej tresci.
- Audit trail jest kompletny dla istotnych AI deck operations.
- AI realnie buduje wiekszosc pierwszej wersji decku.

### V8-PRES-06 RolloutRealityAndGovernance

- Zespol rozumie, co jest baseline runtime, a co enterprise extension.
- Dokumentacja nie obiecuje funkcji spoza realnego stanu systemu.
- Rollout ma jasna mape schema/runtime/policy constraints.

---

## 5. Execution order

### Step 1

Zamknac dokumentacje `v8` i zatwierdzic model produktu.

### Step 2

Oznaczyc:
- co jest live baseline,
- co jest enterprise extension,
- co jest dokumentacyjnym targetem z `v3`,
- co jest juz realnie wdrozone.

### Step 3

Dowiezc `NavigationAndLibrary + GenerationAndTemplates`, bo to glowna sciezka wejscia.

### Step 4

Dowiezc `DeckModelAndBuilder + TraceabilityDeliveryAndQuality`.

### Step 5

Dowiezc `AIContractAndOperations + RolloutRealityAndGovernance`.

---

## 6. Dependencies and sequencing logic

Dlaczego taka kolejnosc:
- bez jasnej sciezki library/wizard nie ma czytelnego startu,
- bez deck model i traceability prezentacja traci przewage `consultify`,
- bez AI contract AI rozwala zaufanie,
- bez rollout reality zespol zacznie mylic target z runtime.

Wniosek:
- `AI` nie jest osobnym dodatkiem "na koniec",
- ale governance i rollout truth musza isc rownolegle z glownymi flow.

---

## 7. Verification plan

### 7.1 Product verification

Sprawdzic:
- czy prezentacja rozwiazuje realny problem komunikacji,
- czy jest osadzona w artifacts ecosystem,
- czy nie duplikuje report buildera bez sensu.

### 7.2 UX verification

Sprawdzic:
- zgodnosc z shell i routingiem aplikacji,
- spojnosc library/wizard/builder,
- clarity review gates,
- PL + EN,
- share/export readiness.

### 7.3 Backend verification

Sprawdzic:
- stability routes i services,
- source traceability,
- analytics integrity,
- schema/runtime readiness.

### 7.4 AI verification

Sprawdzic:
- brak silent edits,
- komplet audit trail,
- jakosc outline/deck edits/notes/visuals,
- explainability source-backed AI.

### 7.5 Delivery verification

Sprawdzic:
- export reliability,
- share and embed behavior,
- quality gates usefulness,
- legal/policy safe delivery.

---

## 8. Test matrix

### Unit

- deck helpers,
- AI operation state transitions,
- source-ref integrity helpers,
- quality gate logic,
- template mapping.

### Integration

- wizard endpoints,
- deck CRUD,
- share/export/embed endpoints,
- analytics writes,
- AI proposal flows.

### UI

- hub navigation,
- wizard outline review,
- builder edits,
- share/export actions,
- quality gates interaction.

### AI evals

- outline quality,
- narrative quality,
- deck edit usefulness,
- visual relevance,
- source-backed explanation quality.

### Regression

- existing routes,
- existing decks,
- existing shared links,
- current export behavior,
- artifact export entry points from other modules.

---

## 9. Rollout strategy

Rekomendowana strategia:
- rollout warstwami, nie big bang,
- najpierw truth alignment i baseline map,
- potem canonical flow and quality,
- potem AI hardening,
- na koncu bardziej zaawansowane enterprise or collaboration extensions.

---

## 10. Success criteria for implementation program

Program `Prezentacje v8` jest gotowy do realizacji, gdy:
- zespol ma jedno SSOT,
- jest jawna gap matrix i execution order,
- wizard/builder/hub sa zdefiniowane bez konfliktu,
- AI contract jest opisany i mierzalny,
- traceability ma quality rules,
- rollout nie myli baseline runtime z targetem aspiracyjnym.

---

## 11. Summary

`Prezentacje v8` nie wymagaja wymyslania nowego produktu od zera.
Wymagaja programu, ktory:
- porzadkuje istniejace fundamenty,
- domyka generate -> refine -> deliver formula,
- wzmacnia traceability i AI governance,
- i zamienia obecny zestaw funkcji w kompletny presentation operating system dla `consultify`.
