# Deliverables — lekki runtime (Kimi-grounded build spec)

> **Data:** 2026-06-10 · **Status:** projektowy (przed implementacją)
> **Doktryna nadrzędna:** [`V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`](../product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md)
> **Wzorce:** [`benchmarks/chat-and-ai.md`](../benchmarks/chat-and-ai.md) (Kimi), [`benchmarks/presentations.md`](../benchmarks/presentations.md) (Gamma), [`benchmarks/tables.md`](../benchmarks/tables.md)
> **Koryguje:** [`EE_DELIVERABLES_TARGET_DESIGN.md`](EE_DELIVERABLES_TARGET_DESIGN.md) — ten dokument **świadomie rezygnuje z parytetu** Notion/Airtable/Gamma na rzecz lekkiego runtime'u artefaktów.

---

## 0. Problem w jednym zdaniu

Mamy właściwą doktrynę (V8.1 = chat-first, jeden runtime, plan→generate→validate, Kimi-style),
ale **kod ją złamał**: 5 powierzchni, 3 ciężkie edytory goniące parytet, 159 sprzężonych serwisów,
ciężkie biblioteki ładowane na boot. Ten dokument przywraca lekkość: **generuj-najpierw, edytuj-lekko**.

## 1. Naczelna zasada (różna od TARGET_DESIGN)

> **Deliverable jest GENEROWANY przez Teresę do żywego artefaktu i edytowany lekko —
> nie autorowany od zera w ciężkim edytorze.**

Kimi nie wygrywa edytorem. Wygrywa: **czat (lewo) ↔ żywy artefakt (prawo)** + widoczny plan + ślad
narzędzi + „deliverable jako wynik, nie tekst jako wynik". Nasz edytor ma służyć **poprawie tego, co AI
zrobiło**, a nie konkurować z Notion o autorowanie 50 stron od pustej kartki.

## 2. Trzy zwinięcia, które kasują ciężar

Cały ciężar bierze się z **trzykrotności**. Lekkość = zwinąć trójki w jedynki.

### 2.1 Jeden model treści (blok) dla 3 formatów
Jeden rejestr bloków, nie trzy schematy (`DocumentSchema` + `UnifiedReportJSON` + table model → **jeden**):
- **Document** = lista bloków (`heading | paragraph | list | callout | quote | table | chart | image`).
- **Sheet** = jeden blok `table` na całą powierzchnię (te same typy pól co w tabeli inline dokumentu).
- **Deck** = lista **kart**, karta = kilka bloków + typ Smart-Layout (`Headline | Text | Chart | Table | Timeline`).

→ „Tabela w dokumencie" == „Sheet" == „tabela na karcie decku" = **ten sam blok**. Jedna biblioteka bloków.
To jest też spójne z [`chat-and-ai.md §3`](../benchmarks/chat-and-ai.md): wiadomość/artefakt = lista typowanych bloków.

### 2.2 Jeden kontrakt generacji (wzorzec Gamma)
Zamiast 3 silników narracji (`documentBlockProseGenerator` + `narrativeEngine/` + `ChatToSchemaService`):
```
POST /studio/generations
  { format: doc|sheet|deck, sourceRefs[], intent, mode: generate|condense|preserve, options }
  → 202 { generationId }                         # async (wzorzec Gamma)
GET  /studio/generations/:id
  → { state, plan?, artifactId?, usage }          # planning→generating→validating→draft
```
Pipeline = **mały graf kroków z checkpointem** (nie monolit-prompt), sparametryzowany formatem:
`plan (edytowalny outline) → generate (stream bloków) → validate → draft`.
Outline jest **edytowalny przed generacją** (Gamma/Beautiful.ai, V8.1 §8.2) — bramka kontroli, anty-halucynacja.

### 2.3 Jeden eksport, leniwie ładowany
`UnifiedExportService` **już istnieje** — przepuścić przez niego WSZYSTKIE formaty.
Ciężkie biblioteki (`pptxgenjs`, `exceljs`, `docx`, `pdfkit`) → **dynamic import tylko przy eksporcie**, nie na boot.
Skasować duplikaty: `documentPdfRenderer` + `presentationOperationsHealthPdf` + 2. ścieżka PPTX → jeden renderer/format pod UnifiedExport.

### 2.4 (bonus) Jedna bramka QA
Jeden walidator sparametryzowany formatem (stan `validating` z V8.1 §7.4), jedna taksonomia werdyktu —
zamiast `documentQaService` (2218 LOC) + presentation quality gates + table QA jako 3 osobne wszechświaty.

## 3. UI — jedna powierzchnia zamiast pięciu

Dziś: Document Studio + Table Studio + read-only Presentation Studio + DeckBuilder + MyWork IdeaTable = **5 powierzchni**.
Cel: **2** (zgodnie z V8.1 Surface B + E):

1. **Outputs Library** (kanoniczny dom artefaktów — legacy shortcut z upgrade'em semantyki). Filtry-chipy, status, reuse, AI-addressable.
2. **Artifact Workspace = split-view Kimi:**
   - **Lewo:** Teresa — czat + **checklista zadań (Task Progress)** + **zwijalny ślad narzędzi** (chat-and-ai.md §2).
   - **Prawo:** żywy artefakt z **lekką edycją inline** + przełącznik formatu.
   - Tworzenie **z kontekstu/czatu**, nie z pustego formularza („zrób deck z tej tabeli").

Stałe chrome, zmienny artefakt (jedna dobra zasada z TARGET_DESIGN §0 — zostaje).

## 4. Edytuj-lekko — sedno „nie-ciężkości"

Renderer per format jest **cienki, read-mostly + lekka edycja inline**. Edytujesz to, co AI zrobiło:

| Format | Lekki renderer (v1) | Świadomie NIE w v1 |
|---|---|---|
| **Doc** | minimalny edytor blokowy: `/`-slash + inline format + drag-reorder; AI-edit zaznaczenia z accept/reject | pełne Notion (toggle/kolumny/bazy-w-dokumencie), track-changes |
| **Sheet** | lekki grid jako renderer artefaktu (~10 typów pól, proste formuły per-rekord) | silnik relacyjny rollup/lookup, 30+ typów pól, 8 widoków |
| **Deck** | lista kart + typy Smart-Layout + per-karta „Regeneruj / Inny układ / Zmień obraz" (Gamma slide-AI) | wolne płótno PowerPoint, system animacji/przejść |

To jest dokładnie miejsce, gdzie **kasujemy ciężar**: dzisiejsze ciężkie edytory stają się lekkimi rendererami artefaktu.

## 5. Anti-scope (zostać lekkim — ratyfikuje V8.1 §16)

❌ Brak parytetu Airtable/Notion/Gamma. ❌ Brak realtime-multiplayer w v1 (mnożnik ciężaru — odłożone do `realtime-collab.md`).
❌ Brak 3 silników szablonów/approval — **jedna** warstwa governance spięta z execution-spine v8 (V8.1 §7.10).
❌ Brak ładowania 159 serwisów na boot — lazy per format. ❌ Szablon ≠ koncept pierwszorzędny (V8.1 §12) — to akcelerator.

## 6. Migracja: ciężkie → lekkie (reuse tego, co dobre)

- **ZOSTAWIAMY:** serwerowe renderery `docx`/`pptx`/`exceljs` — to najtrudniejsza, wartościowa część. Tylko: lazy + za UnifiedExport.
- **ZWIJAMY:** 3 silniki narracji → 1 graf generacji (plan→generate→validate), param. formatem (spójne z `project_system_unification`).
- **WYGASZAMY:** read-only `/presentation-studio`, martwy `PresentationsHub.tsx`, 2 z 3 ścieżek PDF, osobne QA/approval/template, eager-boot.
- **Największy pojedynczy kill ciężaru:** 5 powierzchni → 1 Workspace + 1 Library.

## 7. Wytyczne: co mamy, czego brakuje (most do zbudowania)

**Mamy (dużo):** doktryna V8.1 (lekka, Kimi), per-format SSOT-y (Document/Presentation/Table), UX-y modułów,
standardy shell/visual, baseline eksportu. **Mamy też** benchmark (Kimi/Gamma/Airtable) z dowodami.

**Brakuje (to jest ten most — do dopisania jako kolejne specy):**
1. **Unified Artifact/Block Schema** — jeden schemat bloków dla doc/sheet/deck (§2.1). *(brak)*
2. **Unified Generation Contract** — `POST /studio/generations` async, graf kroków (§2.2). *(brak)*
3. **Unified QA** — jeden walidator + taksonomia werdyktu (§2.4). *(rozbite na 3)*
4. **Decyzja „lekkość > parytet"** — ten dokument; formalnie nadpisuje przechył `EE_DELIVERABLES_TARGET_DESIGN`.
5. **Retire-list** — §6 jako wykonalny backlog wygaszania.

## 8. Fazowanie (lekkie, wartość najpierw)

- **L0 — Fundament runtime:** jeden artifact registry (jest) + Outputs Library (upgrade shortcutu) + split-view shell.
- **L1 — Kontrakt generacji:** `POST /studio/generations` async + graf plan→generate→validate; podłączyć **jeden** format na żywo (rekomendacja: **Deck** — najdojrzalszy backend ~70%) end-to-end w split-view.
- **L2 — Doc lekki:** minimalny edytor blokowy + AI-edit zaznaczenia + UnifiedExport (DOCX/PDF lazy).
- **L3 — Sheet lekki:** grid-jako-artefakt (strip do ~10 pól) + UnifiedExport (XLSX lazy).
- **L4 — Sprzątanie ciężaru:** wykonać retire-list §6; lazy-load wszystkich rendererów; jedna QA.

## 9. Decyzje dla Piotra

1. **Ratyfikacja pivotu:** lekki runtime (V8.1) **zamiast** parytetu (`EE_DELIVERABLES_TARGET_DESIGN`) — potwierdzić, że to jest oficjalny kierunek.
2. **Edytor Doc:** minimalny TipTap (już w repo przez DeckBuilder, lazy) vs jeszcze lżejszy blok-markdown. Rekomendacja: minimalny TipTap.
3. **Pierwszy format na żywo w split-view:** Deck (backend najdojrzalszy) vs Doc (najwięcej braków, najwyższa widoczna wartość). Rekomendacja: Deck jako pierwszy E2E, potem Doc.
4. **Sheet:** strip istniejącego gridu do „lekkiego renderera artefaktu" vs osobny minimalny grid. Rekomendacja: strip istniejącego.
