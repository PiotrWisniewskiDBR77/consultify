---
uiux_doc_id: UIUX_DECISION_LOG
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Decision log — UI/UX (author canon)

## Purpose

Rejestrować decyzje UI/UX autora w sposób krótki, audytowalny i linkowalny do plików normatywnych.

## Decision format

```md
## YYYY-MM-DD — <short title>

### Decision
<1-5 zdań, co zamykamy>

### Applies to
<shell / module(s) / screen(s)>

### Severity
<P0/P1/P2/P3>

### Files updated
- <list>

### Rationale
<dlaczego>
```

## 2026-05-09 — Bootstrap UI/UX author canon catalog

### Decision
Uruchamiamy autorski katalog SSOT UI/UX w `DRD/consultify/docs/UI_UX/` jako warstwę nadrzędną dla decyzji UI/UX (AUTHOR_CANON), bazując na globalnym standardzie `DRD/UI_UX_SOURCE_OF_TRUTH.md`.

### Applies to
Global (all modules)

### Severity
P0

### Files updated
- `README.md`
- `INSTRUKCJA_KONTRAKTU.md`
- `04_DECISION_LOG.md`
- `99_RAW_INPUT.md`

### Rationale
Potrzebujemy jednego, wiążącego i audytowalnego punktu odniesienia dla UI/UX, który jest czytelny dla ludzi i agentów.

## 2026-05-09 — Document Studio as living artifact (not a text generator)

### Decision
`Consultify Document Studio` jest modułem do produkcji profesjonalnych dokumentów enterprise jako **żywych artifactów** (schema + sources + versions + diff + review/approval + audit). Word i PDF są formatami wyjściowymi — produkt nie konkuruje z MS Word jako edytorem tekstu.

AI działa jako edytor/operujący na artifactcie: każda istotna zmiana jest `proposal → diff → approve/reject → version`.

### Applies to
Document Studio / Documents module + Template Registry + Export UX + AI edit loop

### Severity
P0

### Files updated
- `26_DOCUMENT_STUDIO_UX.md`
- `99_RAW_INPUT.md`
- `92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`

### Rationale
Bez schema-first + source pack + governance Document Studio degraduje się do “generatora tekstu” i traci enterprise credibility (szczególnie przez słaby DOCX i brak audytu).

## 2026-05-09 — Presentation Studio as Gamma-class governed artifact (not “PowerPoint with AI”)

### Decision
`Consultify Presentation Studio` jest `Presentation Artifact Engine`: deck to **żywy artifact** z wersjami, diffem, źródłami per claim, approval i audytem. Gamma jest benchmarkiem płynności i jakości wizualnej, ale nie jest blueprintem — przewaga Consultify to enterprise governance + consulting execution + integracja z danymi (Docs/Tables/Tasks/CRM/KPI/Risk).

PPTX export jest funkcją krytyczną (enterprise standard), a system rozróżnia deck “do prezentowania” vs “do czytania”.

### Applies to
Presentation Studio / deck builder + template registry + export UX + AI edit loop

### Severity
P0

### Files updated
- `27_PRESENTATION_STUDIO_UX.md`
- `99_RAW_INPUT.md`
- `96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

### Rationale
Bez źródeł/diff/approval i PPTX-quality Presentation Studio degraduje się do “ładnego generatora slajdów”, co jest commodity i nie przechodzi enterprise trust gate.

## 2026-05-09 — Idea Notebook as context engine (not a basic notepad)

### Decision
`Consultify Idea Notebook` jest `AI Context Notebook Engine`: notatka to obiekt operacyjny i źródło kontekstu, który prowadzi myśl przez `capture → enrichment → context linking → review queue → conversions` do idei, inicjatyw, tasków i artefaktów — z kontrolą scope/prywatności i `memory candidate approval`.

Najpierw zapisujemy, potem porządkujemy. AI proponuje (z confidence), ale user kontroluje krytyczne linki i konwersje; nie tworzymy inicjatyw autonomicznie bez approve.

### Applies to
Notebook/Notes surface + Idee/Inicjatywy conversion + memory candidates + semantic search

### Severity
P0

### Files updated
- `28_IDEA_NOTEBOOK_UX.md`
- `99_RAW_INPUT.md`
- `97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`

### Rationale
Bez quick capture + review queue + governance notatnik staje się śmietnikiem albo “Notion clone”, a bez memory approval ryzykuje wycieki i utratę zaufania w enterprise.

## 2026-05-09 — Process Flow as governed process intelligence artifact (not a diagram tool)

### Decision
`Consultify Process Flow Studio` jest `AI Process Intelligence Engine`: proces jest **żywym artifactem** (model danych + wersje + diff + governance), który AI potrafi tworzyć z prompt/notes/docs, analizować (QA/diagnosis/Lean layer) i przekształcać w inicjatywy, taski, SOP oraz materiały zarządcze (docs/slides/tables).

Nie kopiujemy Miro/Visio/BPMN toola/Celonis 1:1. Domyślny UX jest business-first (business flow), a BPMN-like jest trybem advanced; process mining i mining connectors to etap późniejszy.

### Applies to
Process Flow Studio / process canvas + analysis + versioning/diff + conversions + export + governance

### Severity
P0

### Files updated
- `29_PROCESS_FLOW_UX.md`
- `99_RAW_INPUT.md`
- `98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`

### Rationale
Bez model-first + provenance + QA + diff + initiative conversion moduł degraduje się do “ładnego obrazka” i nie prowadzi transformacji (consulting execution), a bez governance nie przejdzie enterprise trust gate.

## 2026-05-09 — Whiteboard as governed workshop-to-execution artifact (not an infinite canvas clone)

### Decision
`Consultify Whiteboard` jest `AI-native Visual Collaboration & Workshop Intelligence Engine`: board jest **wersjonowanym artifactem** z provenance/confidence, trybem warsztatowym live oraz natywnym przejściem od chaosu ideacji do execution (decyzje → inicjatywy → taski → docs/slides/tables/mindmap/process flow).

AI może generować, klastrować i syntetyzować, ale wszystkie krytyczne zmiany są kontrolowane: `proposal → approve → version` (non-destructive; bez “znikających karteczek”).

### Applies to
Whiteboard / workshops + AI clustering/synthesis + conversions + governance + export

### Severity
P0

### Files updated
- `38_WHITEBOARD_UX.md`
- `99_RAW_INPUT.md`
- `95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`

### Rationale
Bez versioning/diff, provenance i execution conversions whiteboard kończy jako “ładna tablica”, a bez governance i approval AI-synthesis będzie ryzykowna (utrata niuansów, chaos, brak zaufania w enterprise).

