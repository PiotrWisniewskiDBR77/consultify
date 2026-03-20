# Notatka v8 - As-is map

> Status: Draft v8
> Cel: Opisac obecny stan `Notebook` w kodzie i dokumentach oraz zmapowac go na warstwy `Capture / StructuredContent / KnowledgeArchitecture / Collaboration / Discovery / AI-native`.

---

## 1. Najwazniejsze anchor points

### Frontend

- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/NotebookContent.tsx`
- `src/components/MyWork/notebook/`
- `src/services/api.ts`

### Backend

- `server/src/routes/my-work.routes.ts`
- `server/src/routes/notebook.routes.ts`
- `server/src/services/notebookService.ts`

### Dokumenty

- `docs/modules/LIVING_NOTEBOOK_MODULE.md`
- `docs/product/NOTEBOOK_V3.md`
- `docs/flows/core/NOTEBOOK_UX_SPEC.md`
- `docs/product/V4_GAP_ANALYSIS.md`

---

## 2. Osadzenie w produkcie

Notebook:
- jest zakladka `notebook` wewnatrz `My Work`,
- nie jest top-level modułem w sidebarze,
- korzysta z istniejacego shell `My Work`,
- musi pozostac zgodny z frozen tab order i workspace strip.

To oznacza:
- obecny kierunek architektoniczny jest poprawny dla `v8`,
- rozwoj ma sie odbywac wewnatrz istniejacego miejsca, nie obok niego.

---

## 3. Obecny stan po warstwach

### 3.1 Capture

#### Co juz jest

Po stronie backendu istnieja capture routes dla:
- `web_clipper`
- `email_forward`
- `upload`
- `api_import`

Po stronie serwisu `notebookService` istnieje:
- normalizacja tresci z roznych source types,
- ekstrakcja tekstu z uploadow,
- ingest do `notebook_pages`,
- zapis `captureSource` i `captureMetadata`.

Po stronie frontend/API istnieja:
- `uploadNotebookFile`
- `notebookCaptureWebClip`
- `notebookCaptureEmail`
- `notebookCaptureImport`
- `notebookCaptureUpload`

#### Wniosek

Capture nie jest hipotetyczny.
Istnieje juz realny tor technologiczny dla wielu zrodel wejscia.

#### Luka

Brak jednego, kanonicznego opisu workflow capture jako produktu.

### 3.2 StructuredContent

#### Co juz jest

`NotebookContent.tsx` i podkomponenty notebooka zawieraja:
- TipTap editor,
- slash menu,
- headings,
- checklisty,
- tabele,
- callouty,
- details/toggle,
- embedded refs,
- AI inline response,
- toolbar,
- templates/new page modal.

#### Wniosek

Notebook ma juz mocny, semantyczny edytor i nie jest prostym textarea.

#### Luka

Brak jednego kontraktu `v8`, ktory opisuje:
- typy notatek,
- znaczenie blokow,
- role template jako formuly pracy.

### 3.3 KnowledgeArchitecture

#### Co juz jest

W kodzie i typach notebooka istnieja:
- `status`
- `visibility`
- `pinned`
- `tags`
- `projectId`
- `maturity`
- heurystyki dojrzalosci
- linked context i link graph integration

W dokumentach `Living Notebook` oraz `NOTEBOOK_V3` widac tez ambicje:
- notatka jako aktywna warstwa wiedzy,
- silne osadzenie w systemie pracy.

#### Wniosek

Architektura wiedzy juz zaczela powstawac, ale jest rozproszona miedzy kodem, typami i dokumentami.

#### Luka

Brak jednej, jawnej definicji modelu domenowego `NotebookPage v8`.

### 3.4 Collaboration

#### Co juz jest

W `Notebook` sa elementy wspolpracy i wspierania review:
- context panels,
- linked ideas/context,
- AI topics,
- action items,
- AI panels i proposal flows,
- dokumentacyjnie: review/growth mindset w `Living Notebook`.

#### Wniosek

Modul juz nie jest czysto jednoosobowym edytorem.
Jest zalazek review i shared context.

#### Luka

Brak jednej warstwy comments/review/verification/activity opisanej jako kontrakt produktu.

### 3.5 Discovery

#### Co juz jest

Po stronie backendu istnieja:
- FTS,
- embedding storage,
- semantic search,
- RAG context,
- snippets,
- hybrid search logic.

Po stronie frontendowej i produktowej istnieja:
- search po notebook pages,
- context panel,
- knowledge pulse,
- link graph/backlinks mindset.

#### Wniosek

Notebook juz ma bardzo mocne fundamenty discovery.

#### Luka

Brak jednego modelu retrieval quality i jasnej definicji, kiedy note jest "retrieval-ready".

### 3.6 AI-native

#### Co juz jest

Istnieja:
- suggest topics,
- extract actions,
- AI inline interactions,
- AI proposals z resolve flow,
- AI chat/context interactions,
- create-from-note i AI-assisted conversion logic.

W backendzie:
- proposal create,
- proposal resolve,
- RAG context,
- embeddings,
- audit-style proposal model.

#### Wniosek

Notebook juz jest modullem AI-enabled, nie dopiero kandydatem do AI.

#### Luka

Brak jednego, jawnego kontraktu AI:
- klasy operacji,
- governance,
- evaluation,
- audit minimum,
- no-silent-writes policy jako SSOT.

---

## 4. Co jest juz mocne

Najmocniejsze obszary `as-is`:
- capture connectors foundation,
- silny edytor blokowy,
- search i retrieval foundation,
- AI proposal direction,
- osadzenie notatki w pracy, a nie obok pracy.

---

## 5. Co jest jeszcze niejednoznaczne

- granica miedzy note, knowledge article i innymi artefaktami,
- pelna formula template-based work,
- review/verification/governance layer,
- readiness do conversion,
- jeden, wspolny model lifecycle i completeness.

---

## 6. Mapa `as-is -> v8`

| Warstwa | As-is strength | Główna luka v8 |
|---|---|---|
| Capture | Istnieja realne konektory i ingest | Brak jednego workflow produktu |
| StructuredContent | Silny edytor blokowy | Brak jednego semantycznego contractu |
| KnowledgeArchitecture | Istnieja statusy, tags, maturity, context | Brak pelnego domain model SSOT |
| Collaboration | Sa panele i review-like interactions | Brak comments/review/governance contract |
| Discovery | Jest FTS, semantic search, RAG | Brak quality model retrieval |
| AI-native | Sa proposals, extraction, AI panels | Brak jednego AI governance contract |

---

## 7. Głowny wniosek

Stan `as-is` pokazuje, ze `Notebook` nie wymaga wymyslania od nowa.
Wymaga przede wszystkim:
- uporzadkowania modelu,
- domkniecia kontraktow,
- dopisania pelnej dokumentacji,
- i przeprowadzenia programu `v8`, ktory zamieni istniejace fundamenty w kompletny system pracy z wiedza.
