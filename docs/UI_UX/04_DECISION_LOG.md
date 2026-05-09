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

