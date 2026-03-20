# Notatka v8 - Implementation plan

> Status: Draft v8
> Cel: Zamienic benchmark i SSOT `Notatka v8` na program wdrozeniowy z epikami, falami, zaleznosciami i planem weryfikacji.

---

## 1. Strategic intent

`Notatka v8` ma zostac wdrozona jako rozwoj istniejacego `Notebook`, a nie nowy modul.

Cel programu:
- uporzadkowac obecny potencjal notebooka,
- dopiac jego formule pracy,
- zintegrowac AI, search i conversion w jeden model,
- zachowac zgodnosc z `My Work` shell i UI standards.

---

## 2. Program structure

Program `v8` dzielimy na 6 strumieni:
- `V8-NOTE-01 Capture`
- `V8-NOTE-02 ContentModel`
- `V8-NOTE-03 KnowledgeArchitecture`
- `V8-NOTE-04 DiscoveryAndRetrieval`
- `V8-NOTE-05 AIContractAndOperations`
- `V8-NOTE-06 ConversionGovernanceAndQuality`

Kazdy strumien ma scope frontend, backend, data/search, AI, migration/rollout i testy.

---

## 3. Fale wdrozeniowe

### Fala A - Foundation and alignment

Cel:
- zamknac SSOT,
- usunac niespojnosci nazewnicze i konceptualne,
- ustalic definicje notatki, template, lifecycle i AI contract.

Deliverables:
- `NOTATKA_V8_SSOT.md`
- `NOTATKA_V8_BENCHMARK.md`
- `NOTATKA_V8_WORKFLOW_MODEL.md`
- `NOTATKA_V8_GAP_MATRIX.md`

Definition of done:
- wszystkie zespoly operuja na tym samym modelu domenowym,
- nie ma sporu czy rozwijamy `Notebook` czy nowy byt.

### Fala B - Product operating model

Cel:
- doprecyzowac jak notatka jest tworzona, dojrzewa, wraca i konwertuje.

Deliverables:
- canonical note types,
- canonical lifecycle,
- template contract,
- readiness rules for conversion,
- retrieval contract.

Definition of done:
- istnieje jedna formula pracy z notatka, nie zbior niepowiazanych funkcji.

### Fala C - Feature hardening

Cel:
- uporzadkowac i rozszerzyc funkcje, ktore w kodzie juz istnieja, ale nie sa domkniete jako produkt.

Deliverables:
- capture hardening,
- stronger metadata model,
- richer discovery surfaces,
- AI proposal consistency,
- note review/governance layer.

Definition of done:
- kazdy obszar ma przewidziany frontend, backend, data i test scope.

### Fala D - Enterprise quality and verification

Cel:
- dowiezc zaufanie, mierzalnosc i gotowosc do dalszego reuse w kolejnych seriach `v8`.

Deliverables:
- quality gates,
- eval plan dla AI,
- search verification,
- traceability checks,
- rollout and regression checklist.

Definition of done:
- mozna wdrazac bez naruszania source of truth, frozen layouts i AI governance.

---

## 4. Epics

### V8-NOTE-01 Capture

Zakres:
- unified quick note flow,
- source-aware creation,
- capture inbox,
- spis zachowania dla `upload`, `web clip`, `email`, `import`,
- metadata normalisation przy capture.

Frontend:
- definicja punktow wejscia do capture,
- jednolite create flows i states,
- feedback dla source-specific capture.

Backend:
- doprecyzowanie kontraktow payload/response dla capture routes,
- ujednolicenie source metadata,
- walidacja limitow i fallbackow.

Data/search:
- zapis `captureSource`,
- zapis `captureMetadata`,
- gotowosc do indeksacji po ingest.

AI:
- optional AI classify/suggest title/tag/template po capture.

Migration/rollout:
- zachowac compatibility dla istniejacych create flows i capture connectors,
- nie zrywac ingest dla juz istniejacych source types.

Test scope:
- unit dla normalization rules,
- integration dla capture endpoints,
- UX verification dla quick note i source-aware create.

Priority:
- P0

### V8-NOTE-02 ContentModel

Zakres:
- kanoniczna semantyka blokow,
- note types,
- template contract,
- note outline rules,
- AI blocks jako odrebne klasy tresci.

Frontend:
- uporzadkowanie insert/toolbar/template mental model,
- czytelny model widocznosci AI blocks i inserted proposals.

Backend:
- gdy potrzeba, wsparcie payload semantics dla note type/template metadata.

Data/search:
- klasyfikacja typu notatki,
- sensowne indeksowanie tresci i metadata.

AI:
- structured draft operations i block-aware suggestion flows.

Migration/rollout:
- nie psuc zgodnosci z obecnym `NotebookContent` i zapisanym `contentJson`,
- wdrazac semantyke blokow bez utraty starych notatek.

Test scope:
- editor behavior tests,
- serialization/deserialization tests,
- template flow verification.

Priority:
- P0

### V8-NOTE-03 KnowledgeArchitecture

Zakres:
- model `status + maturity + visibility + owner + review cadence + verification status`,
- linked artifact semantics,
- boundaries miedzy note, knowledge article i output artifact.

Frontend:
- metadata surfaces,
- context panels,
- note state cues bez lamania UI canon.

Backend:
- API dla rozszerzonej semantyki metadata,
- enforcement org/user visibility rules.

Data/search:
- schema alignment,
- lifecycle and review fields,
- note-to-artifact relation integrity.

AI:
- suggestions oparte o note state i context.

Migration/rollout:
- utrzymac compatibility dla istniejacych statusow, maturity heuristics i relacji,
- nowe metadata fields wprowadzac bez destabilizacji obecnych notatek.

Test scope:
- permissions tests,
- metadata transitions tests,
- link integrity tests.

Priority:
- P0

### V8-NOTE-04 DiscoveryAndRetrieval

Zakres:
- keyword + semantic search contract,
- snippets, citations, match type semantics,
- related notes,
- backlinks and used-in surfaces,
- retrieval quality expectations.

Frontend:
- search UX dla notatek,
- discovery surfaces i explanation why-result-is-relevant.

Backend:
- spiecie FTS, embeddings i permission-safe retrieval,
- RAG context contract.

Data/search:
- quality thresholds,
- indexing freshness,
- hybrid ranking rules.

AI:
- contextual recall i note recommendation rationale.

Migration/rollout:
- utrzymac ciaglosc indeksacji i search behavior dla juz istniejacych notatek,
- wdrazac quality gates bez regresji dla obecnych search endpoints.

Test scope:
- search relevance checks,
- integration tests dla search endpoints,
- eval dataset dla retrieval.

Priority:
- P0

### V8-NOTE-05 AIContractAndOperations

Zakres:
- operacje AI na notatkach,
- propose/review/accept,
- AI proposal audit,
- no-silent-writes enforcement,
- typologia operacji AI.

Frontend:
- spojny UX dla proposal creation, review i resolution,
- rozdzielenie tresci usera od propozycji AI.

Backend:
- audyt operacji,
- proposal status model,
- resolution endpoints i invariants.

Data/search:
- przechowywanie proposal metadata,
- powiazanie z note i actor.

AI:
- summarization,
- action extraction,
- suggestions,
- note challenge,
- missing angles,
- context packs.

Migration/rollout:
- nowe audit i proposal rules nie moga lamac obecnych AI surfaces,
- rollout governance musi zachowac backward compatibility tam, gdzie user ma juz aktywne flows AI.

Test scope:
- audit consistency tests,
- acceptance/rejection flow tests,
- AI eval plan i regression gates.

Priority:
- P0

### V8-NOTE-06 ConversionGovernanceAndQuality

Zakres:
- note readiness model,
- conversion traceability,
- outline-first conversion,
- review and verification cadence,
- rollout quality gates.

Frontend:
- readiness cues,
- conversion confirmation UX,
- source links after conversion.

Backend:
- traceability enforcement,
- target artifact metadata.

Data/search:
- source_type/source_id alignment,
- backlink continuity.

AI:
- outline generation i conversion assist.

Migration/rollout:
- zachowac source traceability dla juz istniejacych notatek i target artifacts,
- rollout readiness cues wdrazac bez psucia obecnych convert flows.

Test scope:
- conversion integration tests,
- traceability verification,
- regression against linked modules.

Priority:
- P0

---

## 4A. Acceptance criteria matrix

Ponizsza macierz doprecyzowuje, po czym poznamy, ze epic jest naprawde gotowy do dalszej implementacji i rollout.

### V8-NOTE-01 Capture

- Uzytkownik moze utworzyc notatke z co najmniej jednego flow `quick note` oraz z kazdego wspieranego source connectora bez utraty tresci zrodla.
- Kazdy record capture ma jawny `captureSource` oraz `captureMetadata`, dostepne w API i zgodne z modelem domenowym.
- Ingest zapisuje tresc w postaci nadajacej sie do search i dalszego AI processing.
- Bledy capture sa klasyfikowane i komunikowane bez cichej utraty danych.
- Istnieja testy integracyjne dla `web clip`, `email`, `upload`, `import`.

### V8-NOTE-02 ContentModel

- Notatka ma jawnie okreslony `note type` lub mozliwosc jego bezpiecznej sugestii przez AI.
- Template ma zdefiniowany kontrakt: struktura, metadata, AI prompts, convert intents.
- Edytor rozroznia tresc usera od tresci proponowanej przez AI.
- Model blokow jest serializowalny i stabilny wzgledem obecnego `NotebookContent`.
- Istnieja testy dla template flow, serializacji i zachowan edytora.

### V8-NOTE-03 KnowledgeArchitecture

- `status`, `maturity`, `visibility`, `verificationStatus` i `reviewCadence` sa jednoznacznie rozdzielone w SSOT i API.
- Granica miedzy `Notebook note`, `Knowledge article`, `Task`, `Decision`, `Initiative` i output artifact jest jawna i testowalna poznawczo.
- Powiazania note-to-artifact nie zrywaja traceability i backlinks.
- Uprawnienia organizacyjne i user scope sa egzekwowane po stronie backendu.
- Istnieja testy dla przejsc statusow, widocznosci i integralnosci relacji.

### V8-NOTE-04 DiscoveryAndRetrieval

- Search keyword i search semantyczny zwracaja wyniki z czytelnym `matchType`, snippetem i zrodlem.
- Retrieval nie ujawnia tresci poza permission boundary.
- `Related notes`, `backlinks` i `used in` maja jawny kontrakt danych i powierzchni UI.
- Istnieje minimalny eval set dla sprawdzenia trafnosci retrieval.
- Istnieja testy integracyjne dla search endpoints i quality checks dla rankingu.

### V8-NOTE-05 AIContractAndOperations

- Kazda istotna operacja AI dziala w modelu `propose -> review -> accept/reject`.
- Nie ma silent writes ani silent conversion flows.
- Proposal ma audit trail zawierajacy minimum: actor, note, operation type, payload, status, timestamps.
- User odroznia tresc AI od tresci wlasnej i moze jawnie rozstrzygnac proposal.
- Istnieja testy dla acceptance/rejection flow i regresji governance.

### V8-NOTE-06 ConversionGovernanceAndQuality

- Konwersja z notatki do task/decision/initiative/output zachowuje source traceability.
- Dla artefaktow zlozonych obowiazuje `outline-first` lub rownowazny review gate.
- Notatka ma jasne sygnaly gotowosci do konwersji i nie tworzy "smieciowych" obiektow.
- Link source -> target pozostaje widoczny po konwersji.
- Istnieja testy integracyjne dla conversion flow i weryfikacja backlink continuity.

---

## 5. Execution order

### Step 1

Zamknac dokumentacje `v8` i zatwierdzic model domenowy.

### Step 2

Przejsc przez kod `Notebook` i oznaczyc:
- co juz pokrywa `v8`,
- co wymaga doprecyzowania,
- co jest luka produktowa,
- co jest luka implementacyjna.

### Step 3

Dowiezc `Capture + ContentModel + AIContract`, bo to fundament.

### Step 4

Dowiezc `KnowledgeArchitecture + DiscoveryAndRetrieval`.

### Step 5

Dowiezc `ConversionGovernanceAndQuality`.

---

## 6. Dependencies and sequencing logic

Dlaczego taka kolejnosc:
- bez capture i content model nie ma sensownej notatki,
- bez knowledge architecture i retrieval notatka staje sie archiwum,
- bez AI contract AI rozwala zaufanie,
- bez conversion governance notatka nie przechodzi dobrze do innych artefaktow.

Wniosek:
- `AI` nie jest ostatnia warstwa "na koniec".
- `AI contract` musi byc wdrazany rownolegle z glownymi przeplywami.

---

## 7. Verification plan

### 7.1 Product verification

Dla kazdego obszaru sprawdzic:
- czy rozwiazuje realny problem usera,
- czy wspiera formule pracy konsultingowej,
- czy nie duplikuje innych artefaktow systemu.

### 7.2 UX verification

Sprawdzic:
- zgodnosc z `My Work` shell,
- zgodnosc z frozen layouts,
- zgodnosc z workspace strip,
- spojnosc z shared sections/blocks,
- PL + EN,
- locked/read-only behavior.

### 7.3 Backend verification

Sprawdzic:
- poprawne enforcement permissions,
- source traceability,
- integrity relacji,
- stability capture/search/proposal APIs.

### 7.4 AI verification

Sprawdzic:
- brak silent writes,
- komplet audit trail,
- spojnosc resolution flow,
- jakosc summarization/extraction/retrieval,
- reproducibility i governance.

### 7.5 Search verification

Sprawdzic:
- trafnosc FTS,
- trafnosc retrieval hybrydowego,
- jasnosc snippetow i cytatow,
- brak wyciekow poza permission boundary.

---

## 8. Test matrix

### Unit

- note state helpers,
- AI proposal state transitions,
- capture normalization,
- retrieval ranking helpers,
- template mapping.

### Integration

- CRUD note flows,
- capture endpoints,
- semantic search endpoints,
- proposal create/resolve,
- conversion endpoints.

### UI

- editor interactions,
- proposal review flows,
- template usage flows,
- search and discovery behavior.

### AI evals

- summary quality,
- action extraction precision,
- topic suggestion usefulness,
- recall relevance,
- conversion outline usefulness.

### Regression

- My Work shell,
- linked artifacts,
- source traceability,
- existing notebook features.

---

## 9. Rollout strategy

Rekomendowana strategia:
- rollout warstwami, nie "big bang",
- zachowac kompatybilnosc z obecnym `Notebook`,
- najpierw ujednolicic zachowanie i dokumentacje,
- dopiero potem rozszerzac surfaces i AI sophistication,
- utrzymac backward compatibility dla istniejacych notatek i API, gdzie to mozliwe.

---

## 10. Success criteria for implementation program

Program `Notatka v8` jest gotowy do realizacji, gdy:
- zespol ma jedno SSOT,
- jest jawna gap matrix i execution order,
- AI contract jest opisany i mierzalny,
- search/retrieval ma quality gates,
- conversion ma traceability rules,
- calosc miesci sie w granicach `My Work > Notebook`.

---

## 11. Summary

`Notatka v8` nie wymaga przepisania `Notebook` od zera.
Wymaga programu, ktory:
- porzadkuje istniejace fundamenty,
- domyka formule pracy,
- wzmacnia capture, retrieval i AI,
- i zamienia obecny zestaw funkcji w kompletny knowledge operating system dla `consultify`.
