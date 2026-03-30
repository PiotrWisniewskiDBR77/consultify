# Final Implementation Contract — Tools (Position 27/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

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
- Każde narzędzie z rynku; „everything tool”.

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
- **Inputs required**: session state model + governance visibility + output traceability.
- **Acceptance**: scope zatwierdzony; non-goals jawne; finalize gating (DoD) opisane.
- **Evidence**: scope approval + linkowane SSOT/bench.

#### P27-B — Session→result→promotion closure
- **Goal**: sesja nie gubi kontekstu; wyniki mają traceability; promotion do inicjatyw/outputs działa.
- **Acceptance**: 2 tool archetypy działają end-to-end; failure state ma retry bez duplikacji.
- **Evidence**: integracyjne testy + staging demo.

#### P27-C — Verification + rollout
- **Goal**: telemetry, regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

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
| P27-A |  |  |  |  |  |
| P27-B |  |  |  |  |  |
| P27-C |  |  |  |  |  |

