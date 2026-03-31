# Final Implementation Contract — Teresa (Position 8/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P08-A** (Teresa canon + boundaries frozen); P08-B / P08-C not started  
Last updated: 2026-03-30 (P08-A scope closure)

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

### 2.3 P08-A canon (Teresa: contextual copilot boundaries — scope approval)

Ta sekcja jest **kanonicznym** kontraktem zakresu dla `P08-A` i blokuje “dopowiadanie w locie”. Jej celem jest zamrożenie:

- P0 surfaces handoff (3–5) + wymagany payload kontekstowy dla każdego targetu,
- envelope governance akcji (proposal → explicit approval → execution → audit/traces) zgodny z run grammar `P17`,
- voice posture (availability, degraded, fallback, recovery grammar),
- posture evidence pointers/citations (albo jawna granica niepewności),
- hard boundaries vs `Anna`/public assistant oraz “module-owned writes”,
- anti-duplicate gate (bez równoległych approval lanes; żadnych parallel approvals),
- posture degraded/error (minimum 8 scenariuszy),
- acceptance checklist (10+ testowalnych punktów).

#### 2.3.1 P0 handoff targets (frozen, 4) + required context payload

Teresa jest “contextual copilot”: jej podstawową funkcją jest **przeniesienie kontekstu** do właściwego modułu i utrzymanie governancji (bez silent writes).

**P0 targets (handoff surfaces):**

1) `Radar` (P06) — triage cockpit / “why-now” → next action  
2) `Inicjatywy` (P11) — living object (triage→plan→execute) z write-truth governance  
3) `Kalendarz` (P02) — time surface + interoperability; żadnych “fake writes”  
4) `Notatki` (P07) — durable working memory + provenance; capture-first fallback lane

**Common payload (always required) — `teresa_handoff_context`:**

- `origin=teresa`
- `user_intent` (1–2 zdania)
- `active_surface` (gdzie user był: module/view/entity ref)
- `org_context_ref` (org/tenant scope + permissions summary — bounded)
- `bounded_context_pack[]` (max 5): link/ref do obiektów pracy (initiative/deployment/note/signal/calendar item) + deeplinki
- `constraints[]` (np. “do not change dates without approval”)
- `assumptions[]` (jeśli są) + `uncertainty_boundary`:
  - `missing_inputs[]`
  - `conflicts[]`
  - `what_would_change_next_action[]`
- `evidence_pointers[]` (jeśli Teresa twierdzi “dlaczego/na podstawie czego”)
- `proposed_next_action`:
  - `target_module` (`Radar|Inicjatywy|Kalendarz|Notatki`)
  - `handoff_intent` (`open|create|append`)
  - `requires_approval` (always `true` for writes)
- `audit_stub` (minimum): `actor`, `timestamp`, `proposal_id?`

**Per-target required additions (bounded):**

- To `Radar` (P06): `why_now` (2–4 zdania), `time_window`, `triggered_rules[]`, `evidence_pointers[]`, `uncertainty_boundary`, `next_action.safe_fallback` (must exist).  
- To `Inicjatywy` (P11): `initiative_seed` (`problem_statement`, `proposed_outcome`, `assumptions[]`, `risks[]`, `next_steps[]`, `time_window?`) + deklaracja “proposal-only” (no silent writes).  
- To `Kalendarz` (P02): `calendar_intent` (what + when + timezone explicit), `permission_gradient_expectation` (free_busy/read/write), `conflict_safe_write_posture` (If-Match/etag or deny) + recovery steps.  
- To `Notatki` (P07): `notebook_handoff_context` (minimum fields from P07 §2.3.6) + provenance markers (`source`/`user_edit`/`ai_transform`) and `evidence_pointers[]`.

#### 2.3.2 Action governance envelope (proposal → explicit approval → execution → audit/traces)

Teresa nie jest “autonomous engine”. Każda akcja, która zmienia stan systemu, jest objęta envelope (spójne z `P17` run grammar):

- `ask/clarify` → Teresa zbiera brakujące inputy (bounded) i nie zgaduje uprawnień ani faktów.
- `proposal` → Teresa generuje **strukturalny** plan/diff: co będzie zmienione, gdzie, i dlaczego (z evidence pointers albo uncertainty boundary).
- `explicit approval` → user musi jawnie zatwierdzić **run** (approve(run) ≠ review(artifact)) przed jakąkolwiek mutacją.
- `execution` → wykonywane tylko w module-owned lane (Teresa inicjuje, moduł zapisuje); statusy i błędy są jawne.
- `audit/traces` → każda akcja ma ślad: kto/kiedy/jaki input/jaki wynik; brak “ghost” działań.

Hard rules:

- **No silent writes**: brak auto-apply i brak “background save” AI.
- **No parallel approvals**: tylko jedna aktywna prośba o approval na użytkownika/sesję; nowe proposal’e muszą anulować/wersjonować poprzednie.
- **Idempotency posture**: retry nie może tworzyć duplikatów (szczególnie przy create).
- **Truth-preserving failure**: jeśli audit/traces nie da się zapisać, akcja jest blokowana albo oznaczona jako `degraded(audit_unavailable)` (bez udawania sukcesu).

#### 2.3.3 Voice posture: availability, degraded states, fallback, recovery grammar

Voice jest trybem, nie obietnicą 100%:

- **Availability banner**: Teresa zawsze komunikuje, czy voice jest `available|degraded|unavailable` i dlaczego (np. permissions/device/network).
- **Fallback to text**: gdy voice jest degraded/unavailable, wszystkie krytyczne akcje przechodzą na tekst (czytelny proposal + “Approve”).
- **Recovery grammar (frozen phrases/behaviors):**
  - “Przechodzę na tekst, bo voice jest niestabilny. Oto proposal.”
  - “Powtórz proszę ostatnią instrukcję” (ASR uncertainty) + show partial transcript.
  - “Nie mogę wykonać tej akcji bez zatwierdzenia. Powiedz: ‘Zatwierdź’ albo kliknij Approve.”
  - “Wstrzymuję wykonanie — brak wymaganych danych: {missing_inputs}.”

#### 2.3.4 Evidence pointers / citations posture (or explicit uncertainty boundary)

Teresa może dawać “why” tylko w dwóch trybach:

- **Cited**: wskazuje `evidence_pointers[]` (link/ref do obiektu w app / SSOT / aktywności).
- **Uncertain**: jawnie mówi, czego nie wie i jakie dane są potrzebne (`missing_inputs[]`, `conflicts[]`).

Zakaz:

- overclaim “wiem, bo tak” bez dowodu lub bez uncertainty boundary,
- mieszanie opinii z faktem bez oznaczenia.

#### 2.3.5 Hard boundaries: Teresa vs `Anna`/public assistant + module-owned writes

- **Teresa**: działa *wewnątrz produktu* na obiektach organizacji i może inicjować proposal + handoff do modułów.
- **`Anna`/public assistant**: nie ma dostępu do danych org i nie może być traktowana jako runtime executor; brak “copy/paste policy escape”.
- **Module-owned writes**: jedynym miejscem, gdzie zachodzą zapisy, są moduły docelowe (Radar/Inicjatywy/Kalendarz/Notatki) zgodnie z ich kanonem. Teresa nie tworzy “własnych” zapisów bocznych ani równoległych modeli.

#### 2.3.6 Anti-duplicate gate (consume P17; no parallel approvals / no parallel grammars)

- Run grammar pochodzi z `P17` i nie jest duplikowana w P08.
- Handoff payloady mają 1 wspólny rdzeń (`teresa_handoff_context`) i rozszerzenia per target; brak “payload v2” per moduł.
- Jeśli Teresa wykryje near-duplicate (np. równoległe inicjatywy/notatki dla tego samego problem statement), musi:
  - zatrzymać wykonanie,
  - wskazać konflikt,
  - zaproponować scal/wybór kanonicznego obiektu (bez automatycznego tworzenia duplikatu).

#### 2.3.7 Degraded / error posture — minimum scenarios (8+)

Każdy scenariusz musi mieć: **widoczny stan**, **safe next action**, **brak silent data loss**.

1) **Voice unavailable / mic permission denied** → fallback to text + CTA “Continue in text”.  
2) **ASR uncertainty / low confidence** → show transcript + ask to confirm; no execution.  
3) **Approval missing / timed out** → proposal expires; require re-approve; no partial writes.  
4) **Permission denied in target module** → `blocked(permission)` + safe action: request access / capture in `Notatki`.  
5) **Tool/action failed** (network/timeout/503) → `degraded(tool_unavailable)` + retry guidance + keep proposal.  
6) **Stale context / entity not found** → `degraded(stale)` + refresh/readback; never “assume it worked”.  
7) **Conflict/ETag mismatch** (Calendar write) → `conflict` state + deny overwrite; propose manual resolution steps.  
8) **Audit/traces unavailable** → block execution or mark `degraded(audit_unavailable)` with explicit warning; never claim completion.  
9) **Duplicate detected** (near-duplicate initiative/note/signal) → stop and propose merge/select-canonical.  
10) **Partial data** (e.g. Radar sources 206) → show “partial” + list missing inputs; avoid P0 overclaim.

#### 2.3.8 Acceptance checklist (scope approval) — testable points (10+)

`P08-A` jest `approved(scope)` dopiero gdy:

1) P0 targets list (3–5) jest zamrożona i zawiera co najmniej: Radar/P11/P02/P07 (§2.3.1).  
2) Każdy target ma wymagany payload: common `teresa_handoff_context` + per-target dodatki (§2.3.1).  
3) Envelope akcji jest jednoznaczny i zgodny z P17 (proposal→explicit approval→execution→audit/traces) (§2.3.2).  
4) Zasada approve(run) ≠ review(artifact) jest jawna; brak silent writes (§2.3.2).  
5) “No parallel approvals” jest twardą regułą (anti-duplicate governance) (§2.3.2 + §2.3.6).  
6) Voice posture ma availability + fallback to text + recovery grammar (§2.3.3).  
7) Evidence pointers/citations posture jest jawny, a brak źródeł = uncertainty boundary (§2.3.4).  
8) Hard boundary vs `Anna`/public assistant jest spisana i nie ma obejść (§2.3.5).  
9) Module-owned writes są spisane: Teresa nie jest ownerem zapisów, tylko inicjuje handoff (§2.3.5).  
10) Degraded/error posture ma minimum 8 scenariuszy z safe next action (§2.3.7).  
11) Anti-duplicate: near-duplicate stop + merge/select-canonical jest obowiązkowe (§2.3.6).  
12) Evidence ledger ma uzupełniony wiersz `P08-A` (commit ref) w §10.

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
| P08-A | approved(scope) | `272838d28d` | N/A — docs/scope only | N/A | Scope frozen: §2.3 canon (P0 handoff targets+payload, governance envelope per P17, voice posture, evidence/uncertainty boundaries, hard boundaries vs Anna/public assistant + module-owned writes, anti-duplicate gate, degraded scenarios, acceptance checklist); EXECUTION_INDEX #08 updated; lock takeover recorded. |
| P08-B | verified(evidence) | (pending commit) | 43 service integration tests: proposal CRUD (5), lifecycle approve/reject/execute (5), cross-surface handoff 4 P0 targets (4), audit trail (3), voice posture (4), degraded scenarios (4), write ownership (2), retrieval (3), contract metadata (1), envelope state machine (4), handoff validation (6), error handling (2) — all PASS | 8-step staging proof script in closeout | `teresaCopilotService.ts` (runtime), `teresa.routes.ts` (10 endpoints), mounted at `/api/v8/teresa/*`; anti-duplicate gate auto-cancels; truth-preserving failure on audit unavailability |
| P08-C | verified(evidence) | (pending commit) | 49 canon tests (P08-A) + 43 service tests (P08-B) = 92 total — all PASS | Voice on/off + degraded fallback verified in §5 tests; 10 degraded scenarios verified in §6 tests | All 12 acceptance criteria checked; evidence ledger filled; 0 test failures; known limits documented |

