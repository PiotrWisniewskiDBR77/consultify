---
module_id: MODULE_DOCUMENTS
doc_kind: RAW_INPUT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# RAW INPUT — Dokumenty / Document Studio

This file stores raw author input before normalization into the contract.

## Current Baseline

The canonical baseline for this module has been migrated into `00_META.md` through `07_ACCEPTANCE_AND_TESTS.md` from the sources listed in `SSOT.md`.

## 2026-05-11

### Context
Audit and enrichment pass for module integration scope `10_dokumenty/MODULE_INTEGRATION` in docs-only mode.

### Raw requirement
Close contract gaps for `DOC_WORDY_PLACEHOLDER` and `DOC_STUDIO_RUNTIME_TARGET`, including P0/P1/P2 gap audit, RAW alignment (`must/should/out`), As-Is vs Target vs Delta, and critical thesis chain (`RAW -> decision -> evidence/NOT_DONE`) with hard UX rules.

### Priority
P0

## 2026-05-11 (deep audit)

### Context
Deep gap audit scope `10_dokumenty/MODULE_DEEP_AUDIT_CODE_VS_DOCS` comparing runtime code and module 10 docs for `/wordy`.

### Raw requirement
Map exact `route -> component -> behavior -> tests`, list concrete docs-vs-code contradictions only, then update module docs and backlog cards with evidence chains and closure rows.

### Priority
P0

## 2026-05-11 (deep raw audit)

### Context
Deep RAW Gap Auditor pass for `10_dokumenty/MODULE_INTEGRATION` to enforce strict `RAW -> decision -> evidence/NOT_DONE` chains.

### Raw requirement
Use mandatory RAW/UI_UX + code route/menu sources to enrich packet, behavior/UI/tests, function contracts and execution backlog with Teresa-centric, Menu 3-only, no-fake-runtime and approval-before-export hard rules.

### Priority
P0

## 2026-05-11 (stage 1.5 ultra-deep audit)

### Context
Stage 1.5 ultra-deep gap audit for `10_dokumenty/MODULE_INTEGRATION` in docs-only mode.

### Raw requirement
Build runtime reality map and docs-vs-code contradiction table for Word lane; synthesize mandatory RAW into must/should/out, As-Is/Target/Delta, decision register and P0/P1/P2 gaps; enforce Teresa as document-work executor, Menu 3/right-side actions only, no false active-runtime claims for `/wordy`, and `RAW -> decision -> evidence/NOT_DONE` for every critical claim.

### Priority
P0

## Input Format

```md
## YYYY-MM-DD

### Context
<co zmieniamy i dlaczego>

### Raw requirement
<opis swobodny autora bez redakcji>

### Priority
<P0/P1/P2/P3>
```
