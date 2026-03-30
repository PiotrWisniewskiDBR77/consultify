# Final Implementation Contract — Teresa (Position 8/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: AI głosowy+tekstowy: pełen kontekst org + narzędzia + web; steruje aplikacją; konsultant/manager/partner/pracownik.
- **Primary users**: użytkownicy wewnątrz produktu (contextual copilot).
- **Success metric**: prawdziwy cross-surface handoff + ciągłość historii/voice w granicach runtime; bez overclaim „autonomous”.

## 2. Scope
### 2.1 In-scope
- Copilot wewnętrzny: rozumie aktywną powierzchnię, zachowuje kontekst, proponuje i przekazuje do modułu docelowego.
- Voice tylko tam, gdzie runtime jest wiarygodny; jasne degraded states.

### 2.2 Out-of-scope / non-goals
- Fully autonomous workflow engine.
- Public assistant (to `Anna`).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TERESA_2026-03-29.md`
- Benchmark (chat expectations): `docs/product/CHAT_V8_BENCHMARK.md`
- AI OS context: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Czat`, `Softs/0 Agenci`, oraz `Softs/KIMI` jako benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_TERESA_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **OpenAI / ChatGPT (memory + voice + tools/function calling)**:
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/8983136-what-is-memory.html` (Memory: pamięć między rozmowami; personalizacja; “saved memories” vs history).
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/8400625-voice-mode-faq.html` (Voice Mode FAQ: głos jako produkt z capability/limitations).
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/8555517-function-calling-in-the-openai-api.html` (Function calling + odniesienie do Tools: Web Search / File Search / Computer Use, Agents SDK + Tracing).
  - `Softs/0 Czat/Open Ai doc 2.zip :: Open Ai doc/developers.openai.com/resources/tools.html` (Tools resources).
  - `Softs/0 Czat/Open Ai doc 2.zip :: Open Ai doc/developers.openai.com/resources/audio.html` (Audio & Voice resources).
  - `Softs/0 Czat/Open Ai doc 2.zip :: Open Ai doc/developers.openai.com/resources/agents.html` (Agents resources).
- **Claude / Anthropic (citations + tool-use patterns + context compaction)**:
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/misc-using-citations.html` (citations jako affordance do weryfikacji źródeł).
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/tool-use-automatic-context-compaction.html` (automatic context compaction dla long-running agentic workflows).
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/extended-thinking-extended-thinking-with-tool-use.html` (transparent multi-step workflows + narzędzia).
- **Agent frameworks (observability + tool hooks + streaming)**:
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/log-traces-to-project.html` (traces/logging jako first-class observability).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/export-traces.html` (query/export traces).
  - `Softs/0 Agenci/crewai.zip :: crewai/docs.crewai.com/en/learn/tool-hooks.html` (tool call hooks: intercept/modify/control tool execution).
  - `Softs/0 Agenci/crewai.zip :: crewai/docs.crewai.com/en/learn/streaming-flow-execution.html` (streaming execution output).
- **KIMI (agent deliverables + deep research)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/agent.html` (meta: “turns ideas into deliverables… breaks down tasks… performs deep research… generates websites/slides/docs/sheets/reports”).
  - `Softs/KIMI/Docs/www.kimi.com/en/deep-research.html` (meta: “breaks down complex questions, searches extensively, delivers professional long-form reports”).
  - `Softs/KIMI/Docs/www.kimi.com/en/docs.html` (meta: “Docs agent” dla Word/PDF, track changes/comments).
  - `Softs/KIMI/Screens/` (zrzuty UI KIMI jako referencja zachowania/UX).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “contextual copilot z narzędziami + ciągłością + uczciwą kontrolą użytkownika”, nie “fully autonomous agent”.**

- **Memory & continuity posture (ChatGPT Memory + plan Wave1)**:
  - Ciągłość kontekstu między sesjami jest jawna (co pamiętamy / skąd / jak wyłączyć) i nie miesza się z “prawdą systemu”.
- **Voice as a governed mode (Voice Mode FAQ)**:
  - Voice ma jasny status availability, ograniczenia, fallback do tekstu oraz “degraded states” (bez obietnic 100%).
- **Tool calling / actions as bounded proposals (function calling + tool hooks)**:
  - Teresa proponuje akcje (plan → tool call) i utrzymuje kontrolę użytkownika; nie “auto-apply” bez jawnej zgody.
  - Tool execution ma hook/guardrail posture (intercept/validate/log) jako kontrakt runtime.
- **Citations / evidence pointers (Claude citations + Consultify provenance)**:
  - Jeśli Teresa mówi coś “faktycznego”: musi istnieć ścieżka weryfikacji (źródła, provenance, evidence pointers) lub jawna niepewność.
- **Context management (Claude context compaction)**:
  - Długie rozmowy nie degenerują: istnieje jawna strategia kompakcji/pamięci (co jest zachowane i dlaczego).
- **Observability & traceability (LangSmith traces + OpenAI Tracing posture)**:
  - Każda akcja i narzędzie mają audyt/traces (kto/ kiedy/ jakie wejście/ jaki wynik) dla debug i governance.
- **KIMI-style deliverable framing (KIMI agent/deep research)**:
  - Output jest “deliverable-driven”: zadanie rozbite na kroki → research/wykonanie → wynik w formie, którą downstream moduły mogą przyjąć (docs/sheets/report), ale w Consultify tylko w zadeklarowanych lanes.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_TERESA_2026-03-29.md` + evidence packets (sekcja 2 planu).

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Cross-surface handoff depth | copilot bridges into real work | “handoffs still shallow” | Domknąć adaptery i zachowanie kontekstu w handoff do modułów | P0 |
| History + voice continuity | continuous mode, not shells | “history/voice continuity partial” | Ustalić stan voice/history i recovery grammar na deklarowanym zakresie | P0 |
| Action continuity | proposal→tool→work surface | “broader action continuity incomplete” | Zbudować spójny “proposal-to-application flow” z audytem | P0 |
| Evidence / citations posture | verify sources | “trustworthy but not deep” | Wprowadzić evidence pointers / citations tam gdzie dotyczy (zwłaszcza przy pracy na obiektach/źródłach) | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User przechodzi chat → handoff do modułu (np. kalendarz/inicjatywy/tabele/notatki) z zachowaniem kontekstu.
- Voice ma jawne availability i fallback; “degraded” jest widoczny i prowadzi do bezpiecznej akcji.
- Tool/actions są proposal-oriented: użytkownik rozumie co zostanie wykonane i widzi wynik + audit.
- Tam gdzie Teresa używa “wiedzy/źródeł”: istnieją evidence pointers (albo jawna niepewność).

### 5.2 Tests
- Integracyjne: handoff payload (context + target surface) → poprawne lądowanie i ciągłość historii.
- Contract tests: tool call envelope → log/audit/traces → outcome render.
- Regression: długie rozmowy → kompakcja/pamięć nie psuje intent i nie gubi governance.

### 5.3 Staging proof checklist
- Demo: 3 scenariusze cross-surface (różne moduły) z “why/next action” i zachowanym kontekstem.
- Demo: voice on/off + degraded state + fallback do tekstu.
- Demo: tool/action proposal → user approval → wykonanie → audit/traces visible.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P08-A — Teresa canon + boundaries (scope approval)
- **Goal**: contextual copilot (propose→accept), nie autonomous engine.
- **Inputs required**: handoff contract do kluczowych surfaces; voice degraded rules; audit/traces baseline.
- **Acceptance**: scope zatwierdzony; non-goals jawne; governance (proposal/approval) jest spisana.
- **Evidence**: scope approval + linkowane benchmark/SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze P0 target surfaces for handoff + required context payload.
  - Freeze action governance envelope (proposal→approval→execution→audit).
  - Freeze voice degraded rules + boundaries vs `Anna` and internal lanes.
- **DoD**:
  - Approved(scope): proposal governance and handoff targets are explicit and testable.

#### P08-B — Cross-surface handoff + action governance closure
- **Goal**: realny handoff do modułów + tool/action envelope z audytem.
- **Acceptance**: 3 scenariusze cross-surface działają; proposal→approval→execution nie gubi kontekstu.
- **Evidence**: integracyjne testy + staging demo “tool/action proposal”.
- **Tasks**:
  - Implement 3 cross-surface scenarios with preserved context (bounded).
  - Implement tool/action envelope with audit/traces visible.
  - Add integration tests for handoff payload + contract tests for tool envelope (5.2).
- **Staging proof script (click-by-click)**:
  1. In chat, trigger a governed proposal that targets a specific module surface (P0 list).
  2. Review the proposal (what will change) and explicitly approve execution.
  3. Verify landing in the target module preserves context and shows expected state/result.
  4. Repeat for 3 distinct target surfaces.
  5. Open audit/traces and confirm the action is recorded (who/what/when/outcome) (bounded).
  6. Trigger a denied/tool-error case and verify degraded state + safe next step.
- **DoD**:
  - Cross-surface flows pass; users see what will happen before it happens; audit is visible.

#### P08-C — Voice + continuity verification + rollout
- **Goal**: dopiąć voice continuity (bounded) + telemetry + regresje.
- **Acceptance**: voice ma jawne degraded/fallback; historia zachowana; bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Verify voice on/off + degraded fallback in staging and capture proof (5.3).
  - Fill ledger rows P08-A/B/C; validate rollback to text-only + audit preserved.
- **DoD**:
  - Status `verified(evidence)` with complete evidence ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw tekst + handoff, potem voice; feature flags per capability.

### 8.3 Rollback plan
- Wyłącz voice/actions; zachowaj chat continuity i audit; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: overclaim “autonomous” (niszczy zaufanie).
- Ryzyko: brak jednego envelope action governance → chaos i brak audytu.
- Decyzje: które surfaces są P0 dla handoff (pierwsza lista).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P08-A |  |  |  |  |  |
| P08-B |  |  |  |  |  |
| P08-C |  |  |  |  |  |

