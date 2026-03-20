# Notatka v8 - Gap matrix

> Status: Draft v8
> Cel: Zmapowac obecny stan `Notebook` w `consultify` na target `Notatka v8`.
> Metoda: `As-is -> V8 target -> Gap -> Proposal -> Priority -> Dependencies -> Risks`

---

## 1. As-is anchors

Frontend:
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/NotebookContent.tsx`
- `src/components/MyWork/notebook/`
- `src/services/api.ts`

Backend:
- `server/src/routes/my-work.routes.ts`
- `server/src/routes/notebook.routes.ts`
- `server/src/services/notebookService.ts`
- migracje notebooka i FTS w `server/migrations/`

Produkt:
- `docs/modules/LIVING_NOTEBOOK_MODULE.md`
- `docs/product/NOTEBOOK_V3.md`
- `docs/flows/core/NOTEBOOK_UX_SPEC.md`
- `docs/product/V4_GAP_ANALYSIS.md`

---

## 2. Module snapshot

### As-is

W kodzie istnieje realny, rozbudowany `Notebook` osadzony w `My Work`.
Ma edytor blokowy, CRUD stron, statusy, pinning, visibility, upload, AI suggestions, extraction, link context, semantic search i capture connectors.

### V8 target

Pelny AI-native knowledge system:
- capture-first,
- structured and contextual,
- search-first and semantically retrievable,
- silnie powiazany z innymi artefaktami,
- kontrolowany przez propose/review/accept,
- posiadajacy kompletna formule pracy i dokumentacje wdrozeniowa.

### Top gaps

- brak jednej kanonicznej dokumentacji `v8`,
- brak jednego jawnego modelu lifecycle notatki,
- template system nie jest jeszcze opisany jako formula pracy,
- review/governance sa tylko czesciowo skodyfikowane,
- AI i search sa obecne, ale brakuje jednego programu wdrozeniowego spinajacego calosc,
- relacje i recall istnieja, ale wymagaja doprecyzowania definicji kompletności.

---

## 3. Gap matrix

| Area | As-is | V8 target | Gap | Proposal | Priority | Dependencies | Risks |
|---|---|---|---|---|---|---|---|
| Capture | Istnieja `upload`, `web_clipper`, `email_forward`, `api_import` po stronie `notebook.routes.ts` i `notebookService.ts`. | Jeden kanoniczny inbox wiedzy i jednolity model capture z lifecycle i source context. | Capture istnieje technicznie, ale nie ma jednego SSOT dla zachowania produktu i UX flow. | Udokumentowac unified capture model oraz flow `captured -> enriched -> connected`. | P0 | API, ingest, templates, lifecycle | Rozjazd miedzy realnymi konektorami a zachowaniem w UI |
| Structured content | `NotebookContent.tsx` ma TipTap, slash menu, details, callout, checklisty, tables, embeds. | Semantyczna notatka blokowa z formula template-based work i AI-ready structure. | Edytor jest mocny, ale brak jednego modelu semantyki blokow i typow notatki w SSOT `v8`. | Spisac content model, typy notatek i rola template jako formula pracy. | P0 | Editor model, templates, AI proposals | Przeinżynierowanie edytora bez zysku domenowego |
| Knowledge architecture | Istnieja statusy, tags, visibility, pinning, maturity heuristics, `projectId`, link graph. | Pelny model: type, status, maturity, ownership, review cadence, verification, linked context. | Czesc sygnalow juz istnieje, ale nie sa zebrane w jeden domain contract. | Ustalic kanoniczny model domenowy `NotebookPage` dla `v8`. | P0 | DB schema, API payloads, UI metadata | Pomieszanie statusu, maturity i review state |
| Search and retrieval | Jest FTS, embeddings, semantic search, RAG context, context panels, knowledge pulse. | Search hybrydowy i contextual recall jako standard dzialania notatki. | Funkcje istnieja, ale brakuje jednego target model i kryteriow jakosci retrieval. | Zdefiniowac retrieval contract, quality expectations i verification plan. | P0 | Search index, embeddings, UI result surfaces | "Magic AI search" bez zaufania i mierzalnej trafnosci |
| AI note operations | Sa topic suggestions, action extraction, AI inline interactions, AI proposals z resolve flow. | AI jako wspolautor procesu: structured proposals, contextual recall, note growth, audit. | AI jest w kilku miejscach, ale bez jednego, kanonicznego kontraktu `v8` dla wszystkich klas operacji. | Wydzielic i opisac AI contract, operation classes, audit minimum, resolution model. | P0 | AI routes, proposal tables, UI panels | Silent writes lub niespojny UX review |
| Templates | Wystepuja `NewPageModal` i templates, ale bez pelnej dokumentacji operating model. | Templates jako glowna formula pracy dla typow notatek. | Brak kanonicznego katalogu typow notatek i template contracts. | Zdefiniowac priorytetowe template i ich strukture. | P1 | Content model, conversion flows, AI prompts | Nadmiar szablonow bez realnej adopcji |
| Conversion | Istnieja convert flows i extract actions. `NOTEBOOK_V3` opisuje outline-first dla wybranych artefaktow. | Note-to-task/decision/initiative/report/presentation jako kontrolowane, traceable flow. | Potrzebne doprecyzowanie targetu `v8` i kryteriow gotowosci notatki do konwersji. | Spisac readiness rules i source traceability expectations. | P0 | Link graph, output modules, conversion APIs | Powstawanie "smieciowych" obiektow bez dojrzalego source |
| Collaboration | Sa komentarzowe i AI-side panels, ale brak pelnej, wspolnej warstwy review/gov jako SSOT. | Light review + comments + verification + activity trail bez wymogu realtime baseline. | Brak jednej definicji review workflow dla notatek. | Dookreslic comments/review/governance contract w `v8`. | P1 | Shared sections, activity model, permissions | Niewyrazna granica miedzy komentarzem, sugestia AI i edycja |
| Governance | W dokumentach i kodzie sa zalazki propose/accept, audit, visibility i org boundaries. | Pelna audytowalnosc AI, permission-safe retrieval, locked/read-only consistency. | Brak jednego dokumentu governance dla notatek. | Opisac governance baseline w SSOT i implementation planie. | P0 | Auth, org boundaries, audit, UI locked state | Utrata zaufania do notatek jako source of truth |
| Shell/UI compliance | Notebook siedzi wewnatrz `My Work`, ma workspace strip i nie jest top-level modulem. | Pelny rozwoj funkcji bez lamania frozen layouts. | Ryzyko przyszlych odchyleń przy dalszym rozwoju. | Wpisac shell constraints do SSOT i implementation planu jako non-negotiable. | P0 | UI standards, MyWorkHub | Rozjazd produktu z frozen navigation i standardem workspace |

---

## 4. Mapowanie na warstwy `v8`

### Capture

As-is:
- backend capture connectors istnieja,
- upload i create flows istnieja w API.

Gap:
- brak jednego workflow contractu dla usera i dla systemu.

### StructuredContent

As-is:
- edytor jest silny i wspiera wiele blokow.

Gap:
- brak kanonicznego opisu semantyki notatki i roli template.

### KnowledgeArchitecture

As-is:
- istnieja statusy, tags, visibility, pin, maturity.

Gap:
- brak jednej mapy domenowej, ktora odroznia sygnaly operacyjne i wiedze.

### Collaboration

As-is:
- istnieja AI panels, linked context i czesciowa interakcyjnosc review.

Gap:
- comments/review/verification/activity nie sa spiete w jedna polityke.

### Discovery

As-is:
- FTS, embeddings, semantic search, RAG context, link graph.

Gap:
- brak jednego kontraktu discovery quality i retrieval UX.

### AI-native

As-is:
- AI proposals i extraction istnieja,
- w `Notebook` sa operacje inline i panele AI.

Gap:
- brak jednego modelu operacji AI, klasyfikacji, audytu i acceptance flows.

---

## 5. Priorytety `v8`

### P0 - Enterprise baseline for v8

- unified capture contract,
- canonical note domain model,
- AI contract and audit,
- retrieval/search contract,
- conversion traceability,
- shell and UI canon compliance.

### P1 - Strong differentiators

- templates as operating model,
- review cadence and verification,
- richer linked discovery surfaces,
- stronger note growth loops.

### P2 - Expansion

- deeper collaboration,
- more advanced automation,
- richer enterprise knowledge governance.

---

## 6. Dependencies

Produktowe:
- `Living Notebook` vision,
- `NOTEBOOK_V3`,
- `V4_GAP_ANALYSIS`,
- UI standards.

Frontend:
- `MyWorkHub`,
- `NotebookContent`,
- notebook panels,
- API client.

Backend:
- CRUD routes,
- notebook capture/search/proposal routes,
- notebook service,
- FTS/embedding/migrations.

Cross-module:
- Link graph,
- source traceability,
- output conversion modules,
- AI governance.

---

## 7. Go-live risks for v8

- Dokumentacja `v8` nie domknie roznicy miedzy `Notebook` a `Knowledge Base`.
- Search i AI recall beda promowane bez mierzalnych kryteriow trafnosci.
- Capture connectors beda istniec technicznie, ale bez dopietego workflow dla usera.
- Templates stana sie zbiorem szablonow bez realnej roli operacyjnej.
- Rozwoj notatek zacznie lamac `My Work` shell i frozen layouts.

---

## 8. Wniosek

`Notebook` w obecnym kodzie nie jest "pusty" ani "do zbudowania od zera".
Najwieksza luka `v8` nie lezy w samym braku funkcji, tylko w braku jednej, kompletnej i kanonicznej formuly produktu, ktora:
- spina capture,
- spina semantyke notatki,
- spina AI contract,
- spina retrieval,
- spina conversion,
- i nadaje calosci jasne warunki kompletności.
