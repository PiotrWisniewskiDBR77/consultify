# Final Implementation Contract — ArtifactRun z czatu (Position 17/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Chat/Teresa pracuje z aplikacją (głos+tekst): rozumie ekran, robi pracę w UI i bazach.
- **Primary users**: użytkownicy pracujący w chat; operatorzy governance.
- **Success metric**: jedno jawne ask → plan → approve → materialize → rerun/refresh, z rozdzieleniem approval (run) vs review (artifact).

## 2. Scope
### 2.1 In-scope
- Visible planning przed tworzeniem.
- Governed approval uruchomienia.
- Materializacja w trwały artefakt + traceability + rerun/failure truth.

### 2.2 Out-of-scope / non-goals
- „Wszystkie feature’y chatu”.
- Zastąpienie artifact review (to osobny trust layer).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md`
- Module card: `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_CHAT_ARTIFACTRUN.md`
- Cluster brief: `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu definiuje benchmark jako: **chat-native artifact planning systems** z widocznym planem, governed approval, durable materialization, i rerun continuity (`WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md`).
- Rodzina AI OS (KIMI/PALANTIR doctrine): `WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`.

### 4.2 Local Softs evidence (concrete artifacts)
- **KIMI (artifact/deliverable-first agent framing)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/agent.html` (agent: “turns ideas into deliverables”; generuje docs/sheets/reports).
  - `Softs/KIMI/Docs/www.kimi.com/en/deep-research.html` (deep research: rozbicie problemu → research → long-form deliverable).
  - `Softs/KIMI/Docs/www.kimi.com/en/docs.html` (Docs agent: doc editing posture).
  - `Softs/KIMI/Screens/` (UI reference: artifact-native chat + deliverable surfaces).
- **OpenAI (agent approvals + tools posture)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/agent-approvals-security.html` (approvals & security: sandboxing, approvals, network controls).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/tools.html` (Tools resources: tool-use jako first-class).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/agents.html` (Agents resources: agent posture jako produkt/stack).
- **Claude (computer-use posture)**:
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool.html` (computer use tool: kontrolowane działania na UI jako narzędzie).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “explicit run lifecycle dla artefaktów”, nie “autonomous agent doing everything”.**

- **Deliverable-first framing (KIMI)**:
  - Output jest artefaktem/domykalnym deliverable, a nie tylko tekstem w czacie.
- **Ask → Plan → Approve → Materialize (ArtifactRun spine)**:
  - Plan jest widoczny przed wykonaniem; approve dotyczy runu (execution), nie “oceny artefaktu”.
- **Approval boundaries + safety (OpenAI approvals posture)**:
  - Zasady: co wymaga aprobaty, co jest automatem, jak ograniczamy ryzyko (sandbox/permissions).
- **Tool execution as explicit capability (Tools resources)**:
  - Run składa się z jawnych tool calls/actions; user widzi outcome i status.
- **Computer-use / UI actions as bounded tools (Claude)**:
  - Jeśli run dotyka UI: działa przez “bounded tools”, z audit i przewidywalnymi ograniczeniami.
- **Rerun/failure truth**:
  - Rerun i failure mają jawne stany i nie znikają z historii; lineage jest zachowane.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md` + `WAVE2_SOURCE_MATRIX_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Explicit validation stage | preflight before materialize | “validation not equally explicit” | Ujednolicić preflight/validation jako jawny etap wszędzie gdzie wymagane | P0 |
| Rerun & failure packaging | diagnose + retry w prawdzie | “rerun/failure visibility needs stronger packaging” | Domknąć statusy rerun/failure/retry + czytelne komunikaty | P0 |
| Approval vs review boundary | distinct trust layers | “boundary needs to stay cleaner” | Utrzymać rozdział: approve(run) ≠ review(artifact) w UI + data model | P0 |
| Family convergence | one spine across formats | “family convergence incomplete” | Dociągnąć wszystkie deklarowane formaty do jednej run grammar | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User widzi plan, approve’uje run, dostaje artefakt z lineage; rerun i failure są widoczne; approval ≠ review.
- Każdy run ma jawny status model (planned → approved → running → materialized | failed | cancelled) oraz audit.
- Validation/preflight jest widoczny i rozróżnialny od właściwego wykonania.

### 5.2 Tests
- Integracyjne: ask → plan → approve → materialize → rerun → refresh; lineage spójne.
- Regression: failure (tool error / permission) → czytelny stan + retry bez duplikacji artefaktów.
- Contract tests: approval boundary (run) vs review boundary (artifact) w payloadach i UI.

### 5.3 Staging proof checklist
- Demo: 1 format artefaktu end-to-end + rerun + refresh.
- Demo: failure scenario (np. brak uprawnień) → recovery + lineage zachowane.

