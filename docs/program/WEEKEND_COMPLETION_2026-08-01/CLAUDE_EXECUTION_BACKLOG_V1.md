---
doc_id: claude-execution-backlog-v1
truth_type: delivery-status
status: ready-for-packetization
owner: codex
business_owner: piotr
last_reviewed: 2026-07-31
---

# Execution backlog dla agentów Claude — wersja 1

## Reguła paczki

Jedna paczka ma jednego ownera zapisu, ograniczony zestaw plików, jeden weryfikowalny rezultat i własne testy. Agent nie commit/push/merge bez zlecenia. Codex sprawdza diff oraz wydaje `GO/FIX/NO-GO`.

## Fala 0 — kontrakty integracyjne

| Packet | Cel | Pliki startowe | Odbiór |
| --- | --- | --- | --- |
| `CORE-ART-001` | potwierdzić jeden Artifact envelope i adaptery formatów | artifact registry/types/API + Materials clients | create/save/reopen/version/approve identifiers zgodne |
| `CORE-INI-001` | jeden Candidate Initiative write path | initiative services, conversions, generators | dwa źródła tworzą Candidate z tym samym schema/lineage |
| `CORE-AI-001` | jeden action/proposal/approval envelope Teresy | action manifest/registry/handler | jedna read i jedna write-with-approval przechodzą E2E |

## Fala 1 — Materials

| Packet | Cel | Non-regression | Test |
| --- | --- | --- | --- |
| `MAT-001` | jeden owner/gate Materials i kompletne akcje Library | nie usuwać legacy deep links | list/create/open/archive/share real artifact |
| `MAT-002` | Document Library → real share panel | istniejący Document Studio | **ACCEPTED**: one-shot handoff + canonical URL |
| `MAT-003A..D` | Workbook round-trip, safe save, minimal edit i versions | nie wymieniać silnika przed ADR | blank→edit→reopen→XLSX read-back + restore |
| `MAT-004A..C` | generatory templates i fidelity matrix | osiem istniejących modeli | template→edit→reopen→export + OOXML corpus |
| `MAT-005A` | Document checkpoint i restore | autosave/editor sync | **ACCEPTED**: capture→confirm→rollback→canonical read-back |
| `MAT-005B` | domknięcie Document lifecycle | autosave/export/share/version | pełny create→edit→reopen→restore→PDF→share E2E + revoke/rotate |
| `MAT-006` | Presentation lifecycle hardening | generator i eksporty | CAS restore + pełny deck E2E |
| `MAT-007` | immutable PDF export receipt | Document/Deck source authority | historyczny PDF związany z source revision/hash |

## Fala 2 — Finance i Results

| Packet | Cel | Test |
| --- | --- | --- |
| `FIN-001` | `/finance` kanoniczne, `/economics` redirect-only | **ACCEPTED**: query/hash preservation + route identity |
| `FIN-002` | trwały Investment Case: ROI, scenario, versioned baseline/actual | NPV/IRR/ROI/payback fixture + save/reopen |
| `FIN-003` | statement import/map/validate | representative XLSX/CSV fixture + canonical read-back |
| `FIN-004` | Finance → Candidate Pack przez jeden write path | numerical anchors + pełny lineage read-back, bez direct Initiative |
| `RES-001A` | `/results` owner; Benefits/KPI aliases | **ACCEPTED**: query/hash preservation + deterministic AppView |
| `RES-001B` | przepiąć scorecards z Goals API na V8 `kpi_scorecards` | one table/many scorecards, no duplicate store, reopen |
| `RES-002` | KPI/OKR definition gate | good/bad metric fixtures z owner/source/cadence/baseline/target |
| `RES-003` | threshold → Deviation→Recovery→Task→escalation | clock-controlled workflow E2E |

## Fala 3 — Initiative → Execution → Results

| Packet | Cel | Test |
| --- | --- | --- |
| `INI-001` | jeden status model i Initiative List | filters are projections of one registry |
| `INI-002` | candidate dedupe/merge/completeness | duplicate fixtures and merge lineage |
| `INI-003` | roles, team and simple approval profile | positive/negative capability matrix |
| `EXE-001` | jeden canonical Execution entry/List | **ACCEPTED**: `/execution` owner + preserved aliases + internal handoffs |
| `EXE-002` | management spine plan/task/risk/change | update + audit + read-back |
| `FLOW-001` | Initiative → Execution → KPI → Finance actual | full identifier lineage and reopen |

## Fala 4 — Assessment, Tools, Interview

| Packet | Cel | Test |
| --- | --- | --- |
| `ASM-001` | five-surface hub i shared session schema | Library→Process routing |
| `ASM-002` | DRD question→matrix round-trip | edit from matrix and rescore |
| `ASM-003` | DRD finalize→output/report/candidates | immutable output + lineage |
| `TLS-001` | five-surface Tools i standard workspace shell | UI Gate 0/navigation |
| `TLS-002` | SWOT save/resume/back/edit/finalize | interruption and reopen E2E |
| `TLS-003` | SWOT output/report/candidates | materialization and read-back |
| `INT-001` | answer quality/return/accept | respondent and manager roles |
| `INT-002` | common Insight and Candidate generators | source citations and no duplicates |

## Fala 5 — My Work i Chat

| Packet | Cel | Test |
| --- | --- | --- |
| `MW-001` | Inbox/task/decision action updates owner object | no competing local copy |
| `MW-002` | Calendar provider + capacity markers | sync conflict and long-project UX |
| `MW-003` | Notes/Ideas/Vault owner handoffs | deep links and permissions |
| `CHAT-001` | zamknąć udokumentowane regresje Chat | composer/history/tool regression suite |
| `CHAT-002` | Teresa proposal → approved owner write | trace, approval, idempotency |
| `CHAT-003` | Chat → Canvas → Material/Note/Initiative/Table | four materialization E2E flows |

## Wymagany raport agenta

Zakres, zmienione pliki, decyzje, testy z wynikiem, UI component IDs, screenshoty jeśli UI, migracje, ryzyka, known gaps, komendy rollback/recovery oraz oświadczenie o braku zmian poza pakietem.
