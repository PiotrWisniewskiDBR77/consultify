# Final Implementation Contract — Prezentacje (Position 20/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Gamma‑like: generacja+edycja; export PPT/PDF; zarządzanie generatorem; edycja z poziomu czata.
- **Primary users**: konsultanci/PMO tworzący decki.
- **Success metric**: prezentacja jako trwały artefakt: create → reopen/continue → review → deliver/export, z traceability i bez overclaim „full deck suite”.

## 2. Scope
### 2.1 In-scope
- Governed deck runtime (durable identity + continuation + review/export truth).
- Integration: Outputs Library + ArtifactRun + Provenance.

### 2.2 Out-of-scope / non-goals
- Pełna parity z narzędziami prezentacyjnymi.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md`
- Benchmark: `docs/product/PREZENTACJE_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu definiuje benchmark jako: **governed deck generation and continuation products** z durable identity i review trust (`WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md`).
- Benchmark doc: `docs/product/PREZENTACJE_V8_BENCHMARK.md`.

### 4.2 Local Softs evidence (concrete artifacts)
- **Gamma (AI-first generation + templates + folders as surfaces)**:
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/generate-a-gamma.html` (Generate a gamma: generacja jako API; artifact-first posture).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/create-from-template.html` (Create from template: template-driven deck creation).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/list-folders.html` (folders: organizacja artefaktów).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/docs/generate-api-parameters-explained.html` (parametry generacji jako jawny kontrakt).
- **Pitch (team workflow: comments/review + export + pitch rooms)**:
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4318672-collaborate-with-comments.html` (comments: feedback/review surface).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4919360-recover-an-earlier-version-of-your-slide.html` (version history: recovery posture).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/3551638-export-a-presentation-to-pdf.html` (export PDF).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/6713988-export-a-presentation-to-power-point.html` (export PPTX).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/10134438-share-pitch-rooms-with-prospects-or-clients.html` (pitch rooms: “decks, links, files” + analytics).
- **Beautiful.ai (quality-by-structure + slide-level AI editing + export resilience + analytics)**:
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/12885226948109-Creating-a-presentation-with-AI.html` (AI presentation generation: workflow-first, nie tylko prompt).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/43350069148557-Create-and-Edit-your-Slides-with-Slide-AI.html` (Slide AI: iteracja per-slide; refine bez przebudowy całości).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/115002537392-How-do-I-export-as-a-PDF.html` (export PDF + ograniczenia statyczności).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/115002626972-What-do-I-do-if-I-receive-an-export-failure.html` (export failure: recovery/troubleshooting posture).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360004996892-Version-History.html` (version history + revert + deleted slide recovery).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360000747892-How-can-I-share-a-link-to-my-presentation.html` (share link + access control + analytics).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360028082532-Analytics-Pro-Tier.html` (analytics dashboard: views/time).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “durable deck runtime z jawym lifecycle + export truth”, nie “pełny PowerPoint parity”.**

- **Generate → continue as normal workflow (Gamma + Beautiful.ai Slide AI)**:
  - Generacja tworzy deck z durable identity.
  - Kontynuacja to nie “wygeneruj od nowa”: istnieje iteracja per-slide / per-sekcja z zachowaniem struktury.
- **Templates/themes/folders as governed surfaces (Gamma + Pitch)**:
  - Template-driven creation + organizacja (folders) są częścią produktu (nie “ukryty system”).
- **Review/feedback as a first-class layer (Pitch comments)**:
  - Deck ma review surface (comments) i jawne statusy draft/reviewed (bez mieszania z approval(run)).
- **Export as governed delivery (Pitch + Beautiful.ai export posture)**:
  - Export PDF/PPTX ma jawne ograniczenia i recovery path (export failure).
  - Export events są traceable (powiązane z pozycją 18).
- **Share + analytics posture (Pitch rooms + Beautiful.ai analytics)**:
  - Udostępnienia mają kontrolę i “proof of delivery/consumption” (bounded analytics), bez overclaim.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md` + `WAVE2_GAP_BACKLOG_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Continuation depth | continue without losing structure | “continuation semantics not strong enough” | Domknąć reopen/continue + structural continuity jako kontrakt produktu | P0 |
| Review + export grammar | ready vs draft visible | “review/export grammar needs one package” | Ujednolicić review/delivery/export state + badges + next action | P0 |
| Export resilience | recovery path for failures | (nieudowodnione jako domknięte) | Dodać recovery posture dla export (failures) i audyt exportów | P1 |
| Library convergence | canonical home | depends on Outputs Library | Zapewnić spójność z `Outputs Library` (one home) + reopen from library | P0

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Deck ma durable identity; reopen/continue działa; review/delivery/export są jawne; traceability jest widoczne.
- Export (PPT/PDF w zadeklarowanym zakresie) ma jawne ograniczenia + recovery path; export event jest zapisany.
- Z poziomu czata: plan → approve(run) → deck w `Outputs Library` → reopen/continue bez utraty lineage.

### 5.2 Tests
- Integracyjne: generate → reopen → continue (edit) → review state change → export PDF/PPTX → audit in provenance.
- Regression: export failure → czytelny stan + retry bez tworzenia “ghost artifacts”.
- Contract tests: lifecycle payload (draft/reviewed/exported) spójny w library/preview/open.

### 5.3 Staging proof checklist
- Demo: “generate→continue→review→export” z widocznym lineage i zapisanym export eventem.
- Demo: reopen z `Outputs Library` + kontynuacja z czata (approve(run) vs review separation).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P20-A — Deck lifecycle canon + review/export grammar (scope approval)
- **Goal**: durable deck identity + reopen/continue; jawny review/export state.
- **Inputs required**: Outputs Library convergence (pozycja 19) + trust-state (pozycja 18).
- **Acceptance**: scope zatwierdzony; non-goals jawne; export limits + recovery posture spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze deck lifecycle states (draft/reviewed/exported) + reopen/continue semantics.
  - Freeze review/export grammar + limits + recovery posture (no ghost artifacts).
  - Freeze convergence rules with Outputs Library (19) and trust-state (18).
- **DoD**:
  - Approved(scope): continuation and review/export semantics are explicit and testable.

#### P20-B — Generate→continue→review→export closure
- **Goal**: domknąć E2E lifecycle + export audit.
- **Acceptance**: continue nie gubi struktury; export ma recovery path; lineage widoczne.
- **Evidence**: integracyjne testy + staging demo (reopen z library).
- **Tasks**:
  - Implement generate→reopen→continue→review→export end-to-end (bounded).
  - Implement export retry/recovery and audit events; add integration/regression tests (5.2).
  - Run staging demos (5.3) including reopen from library.
- **DoD**:
  - Continuation preserves structure; export is audytowalny with recovery; lineage visible.

#### P20-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P20-A/B/C.
  - Validate rollback: disable export; preserve reopen/continue.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw reopen/continue + review grammar, potem eksport resilience (P1) i rozszerzenia.

### 8.3 Rollback plan
- Wyłącz export; zachowaj reopen/continue; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak continuation depth (deck “zdycha” po wygenerowaniu).
- Ryzyko: export failure tworzy ghost artifacts.
- Decyzje: minimalny zakres exportów (PDF/PPTX) i ich ograniczenia.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P20-A |  |  |  |  |  |
| P20-B |  |  |  |  |  |
| P20-C |  |  |  |  |  |

