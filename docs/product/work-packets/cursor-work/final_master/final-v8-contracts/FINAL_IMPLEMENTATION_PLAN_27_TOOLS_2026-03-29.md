# Final Implementation Contract — Tools (Position 27/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P27-A** (Tools canon frozen); P27-B / P27-C not started  
Last updated: 2026-03-30 (P27-A scope closure)

## 1. Executive summary
- **Intent**: Narzędzia AI‑driven, wykonywalne przez czat.
- **Primary users**: konsultanci/PMO wykonujący „narzędziowe” sesje pracy.
- **Success metric**: jeden Tools canon: discovery → session → outputs/work promotion, z AI governance w środku sesji.

## 2. Scope
### 2.1 In-scope
- Tool library + selection grammar.
- Canonical session model.
- Promotion wyników do artefaktów i obiektów pracy.

### 2.2 Out-of-scope / non-goals

- **Marketplace of arbitrary third-party tools** — no unbounded plug-in model without governance and session contract.
- **Second Tools “home” or parallel session registry** — one discovery surface under Discovery Tools + one persistence contract (`ToolSession` / API); no duplicate session stores.
- **Silent AI writes** — no auto-apply of AI changes without propose → review → accept (aligned with P18: **approve(run) ≠ review(artifact)** where artifact review is downstream).
- **Promotion without traceability** — no bulk “send to initiatives” without lineage to session + sources (consumes artifact registry / Outputs Library; see §2.4).
- **Replacing Assessment module** — Assessment stays its own contract (**position 28**); Tools canon governs **Discovery Tools** lane unless an explicit convergence packet merges surfaces.
- **Frozen layout violations** — Workspace strip and module hub rules remain per `docs/ui-standards/FROZEN_LAYOUTS.md`.

### 2.3 Anti-duplicate gate (extend canon — no parallel truth)

P27-B/C MUST **extend** the following — not fork parallel session types, tool lists, or promotion APIs.

| Area | Canon (path) | Rule |
| --- | --- | --- |
| Tool catalog + UX intent | `docs/product/TOOLS_CATALOG_V3.md`; `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md` | Library/discovery copy and tab model align with v3 SSOT; new tools extend catalog tables, don’t invent a second catalog.doc. |
| Standard outputs from tools | `docs/product/UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md` | Default promotable output types remain initiative / report / presentation / idea unless `P27-A` explicitly extends the standard. |
| Client session state (discovery runtime) | `src/store/useToolStore.ts` — `ToolSession`, `createSession`, `hydrateSessionFromApi`, step builders | Extend session shape and steps here or via typed adjuncts; no shadow `ToolSessionV2` store. |
| Wizard / governed session payloads | `src/components/shared/ToolWizard/types.ts` — `WizardSessionData` (`missingItems`, `review`, `outputs`, `locked`) | Finalize gating and “missingItems” semantics extend this model; align naming with playbook §8.1 P27-A. |
| API surface | `src/services/api.ts` — `createToolSession`, `listToolSessions`, `getToolSession`, `updateToolSession` | Sessions hydrate/persist through these calls; new endpoints extend server router, don’t duplicate under alternate paths. |
| Outputs & provenance downstream | Position **19** (`Outputs Library`); Position **18** (trust-state / review) | Promoted artifacts land in governed surfaces; trust badges and review flows consume P18, not a Tools-local trust enum. |

### 2.4 Dependencies (mandatory consumers)

- **P18** — artifact review, visibility, export/trace posture for promoted outputs.
- **P19** — canonical Outputs Library home for discoverability of promoted report/deck/sheet-class artifacts.
- **P17** (ArtifactRun) — optional chat-driven plan/execute; Tools sessions remain valid when chat spine is absent (degraded mode explicitly allowed in P27-B tests).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_TOOLS_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_TOOLS_2026-03-29.md`
- V3 runtime SSOT / canon (discovery→session→outputs):
  - `docs/product/TOOLS_CATALOG_V3.md`
  - `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **OpenAI (tools + agents + approvals posture)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/tools.html` (tools jako first-class capability).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/agents.html` (agent runtime posture).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/agent-approvals-security.html` (approvals/security: separation, guardrails).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/cookbook/examples/mcp/mcp_tool_guide.html` (tool integration posture).
- **LangSmith / LangChain (traceability + evaluation as an operator surface)**:
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/observability.html` (observability/traces).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/share-trace.html` (share trace: audytowalność runu).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/evaluation.html` (evaluation posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “tool library + governed session + promotable outputs”, nie “set luźnych przycisków”.**

- **Clear discovery and selection grammar (Tools plan + v3 canon)**:
  - Library jest czytelna; user rozumie “po co to narzędzie” i co dostanie jako rezultat.
- **One coherent session model (v3 ToolSession skeleton)**:
  - Sesja ma stany i kroki (Define → Inputs → Work → Review → Finalize → Outputs) i jest stabilna.
- **AI governance inside sessions (OpenAI approvals posture)**:
  - AI działa w trybie propose→review→accept; brak silent writes i brak mieszania approval z review.
- **Traceability and run truth (LangSmith traces posture + position 18 doctrine)**:
  - Każdy wynik sesji ma lineage do źródeł i runu; debug/replay jest możliwy (bounded).
- **Promotion to downstream work (Tools plan)**:
  - Wyniki sesji promują się do inicjatyw/raportów/prezentacji/artefaktów bez “drugi system prawdy”.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_TOOLS_2026-03-29.md` + v3 canon docs.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Tools v8 canon packaging | one product family | “canon still missing” | Spakietować Tools jako jeden produkt (library→session→output) | P0 |
| Session grammar consistency | stable states | “fragments exist” | Ujednolicić state model i “next step” w całej rodzinie | P0 |
| Governance visibility | approvals explicit | “partial” | Ujawnić governance w UI (propose/review/accept) + audit | P0 |
| Output promotion continuity | no ambiguity | “needs stronger downstream promotion” | Dopiąć promotable outputs do Outputs/Initiatives z traceability | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User przechodzi discovery→session→result→promotion; AI jest governed (propose/review/accept).
- Sesja ma jawne stany i nie gubi kontekstu; finalize blokuje promotion jeśli DoD niespełnione.
- Outputy mają traceability do sesji i źródeł.

### 5.2 Tests
- Integracyjne: Library → start tool → session work → review/finalize → promote to initiative/report → reopen session.
- Regression: tool run failure → czytelny failure state + retry bez duplikacji rezultatów.
- Contract tests: session payload (state, missingItems, outputs) stabilny; audit/run id obecny tam gdzie dotyczy.

### 5.3 Staging proof checklist
- Demo: 2 różne tool types end-to-end (różne archetypy workspace) + promotion do inicjatyw.
- Demo: AI propose → review → accept + trace view (bounded) dla 1 sesji.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Tools SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P27-A — Tools family canon + session grammar (scope approval)
- **Goal**: Tools jako jedna rodzina: discovery→session→result→promotion.
- **Inputs required**: session state model + governance visibility + output traceability (§2.3–2.4).
- **Evidence**: scope approval + linkowane SSOT; lock P27-A released; `EXECUTION_INDEX.md` #27 = `approved(scope)`.

##### P27-A — Acceptance checklist (testable)

1. **One Tools family**: Contract names a single grammar (library → session → result → promotion); §2.3 lists concrete repo SSOT to extend.
2. **Session state**: **Wizard** path uses `WizardSessionData` (`DRAFT` | `IN_PROGRESS` | `REVIEW` | `FINALIZED`) + `review.missingItems`; **Discovery** path uses `ToolSession` in `useToolStore`; P27-B may bridge gaps but must not introduce a second canonical session ID scheme without a reconciliation packet.
3. **Finalize gating**: “Finalize” / promotion is **blocked** when `missingItems` (or equivalent tool-native incomplete signals) are non-empty — falsifiable in tests in P27-B.
4. **AI governance**: Changes follow **propose → review → accept**; no silent persistence of AI edits to governed fields; aligns with **P18** separation (run vs artifact review).
5. **Promotion traceability**: Promoting to initiative / report / presentation / idea records **source session + tool trace** per existing output standard and registry hooks (**P19** lists).
6. **Anti-duplicate**: §2.3 filled with **concrete** file paths; implementers extend those canons.
7. **Non-goals**: §2.2 explicitly excludes second registry, ungoverned marketplace, silent writes, frozen-layout breaks.
8. **Failure / retry**: Contract requires explicit failure state + retry **without duplicating** promoted outputs (P27-B acceptance); scope here only mandates the rule appears in §5 and tasks.
9. **Assessment boundary**: Tools canon does not subsume **Assessment (28)** unless a future packet says so.
10. **Authority chain**: Section 3 remains the Wave2 Tools detailed plan entry; this file does not replace it as gap ledger owner.

- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze session state model + finalize gating (missingItems).
  - Freeze governance visibility (propose/review/accept) and audit requirements.
  - Freeze promotion contract to initiatives/outputs + traceability rules.
- **DoD**:
  - `approved(scope)`: checklist above satisfied; index #27 updated; lock released; evidence row §10.

#### P27-B — Session→result→promotion closure
- **Goal**: sesja nie gubi kontekstu; wyniki mają traceability; promotion do inicjatyw/outputs działa.
- **Acceptance**: 2 tool archetypy działają end-to-end; failure state ma retry bez duplikacji.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement E2E for 2 tool archetypes: discovery→session→result→promotion (bounded).
  - Implement failure packaging + retry without duplicating outputs.
  - Add integration/regression tests and run staging demos (2 archetypes + promotion).
- **Staging proof script (click-by-click)**:
  1. Open Tools Library, pick tool archetype #1, start a session, and complete a bounded workflow to produce a result.
  2. Review/finalize and promote the result to an initiative/output; verify traceability links back to the session.
  3. Reopen the session and verify state is consistent (no lost context).
  4. Repeat for tool archetype #2.
  5. Trigger a tool failure and verify explicit failure state + retry without duplicate results.
- **DoD**:
  - Sessions preserve context; results are traceable; promotions are governed and reliable.

#### P27-C — Verification + rollout
- **Goal**: telemetry, regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P27-A/B/C.
  - Validate rollback: disable promotion; preserve sessions + results.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw P0 archetypy + governance, potem downstream promotion hardening (P1).

### 8.3 Rollback plan
- Wyłącz promotion; zachowaj sesje + wyniki; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: Tools jako “kolekcja mini-app” bez wspólnej gramatyki.
- Ryzyko: finalize bez gatingu → promotion “śmieci” do downstream.
- Decyzje: minimalny session state model i “missingItems”.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P27-A | approved(scope) | `d3d10e6e1a` | N/A — docs/scope only | N/A | Canon: §2.2–2.4, P27-A checklist; lock P27-A released; EXECUTION_INDEX #27 updated. |
| P27-B |  |  |  |  |  |
| P27-C |  |  |  |  |  |

