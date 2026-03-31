# Final Implementation Contract — Anna (Position 16/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P16-A/B/C complete

## 1. Executive summary
- **Intent**: Ma dostać pełniejszy kontekst DBR77+produkty; rozwój wiedzy sterowalny w Superadmin (Virtual Workers).
- **Primary users**: public/external entry (LP) + sales/discovery.
- **Success metric**: bezpieczny public guide z mierzalną konwersją, multilang, i jawnie ograniczonym voice; bez mieszania tożsamości z `Teresa`.

## 2. Scope
### 2.1 In-scope
- Public Q&A w granicach public knowledge.
- CTA handoff (demo/trial/contact) + funnel instrumentation.
- Multilang i voice resilience (declared lanes).

### 2.2 Out-of-scope / non-goals
- Pełny autonomous public sales agent.
- Wewnętrzny copilot (to `Teresa`).

### 2.3 P16-A canon (public assistant canon + boundaries)

The public assistant canon for Anna LP is frozen in the SSOT:
- `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` → **§2.3 P16-A canon**

This contract must not create a parallel “public Anna truth”. It only approves the scope and points to the canonical rules:
- public boundaries (public knowledge only), refusal rules, no internal lane leakage
- “no Teresa mixing” rule (identity separation)
- CTA taxonomy + measurable event grammar (demo/trial/contact) + retry posture
- factfulness posture (citations/evidence pointers OR explicit uncertainty marker)
- memory + privacy posture (no “magic memory”)
- voice posture (availability/degraded states; fallback to text; no identity drift)
- anti-duplicate gate + degraded scenarios + acceptance checklist

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANNA_2026-03-29.md`
- SSOT: `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- Benchmark (chat expectations): `docs/product/CHAT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Czat` + `Softs/KIMI` jako benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_ANNA_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **OpenAI / ChatGPT (memory, voice, web search posture)**:
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/8983136-what-is-memory.html` (Memory: “Saved Memories” vs “Chat history”; personalizacja między rozmowami).
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/8400625-voice-mode-faq.html` (Voice Mode FAQ: capabilities + limitations; voice jako mode z ograniczeniami).
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/10093903-chatgpt-search-for-enterprise-and-edu.html` (ChatGPT Search: odpowiedzi z linkami do źródeł; “fast, timely answers”).
  - `Softs/0 Czat/Open Ai help.zip :: Open Ai help/help.openai.com/en/articles/5955598-is-api-usage-subject-to-any-rate-limits.html` (rate limits: produkcyjny constraint; potrzebne degraded/fallback).
- **Claude (citations + long-running context management)**:
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/misc-using-citations.html` (citations: weryfikowalne wskazania źródeł przy pracy na dokumentach).
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/tool-use-automatic-context-compaction.html` (context compaction: długie workflow bez degradacji pamięci).
- **KIMI (deliverable-driven agent + deep research)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/agent.html` (agent: “turns ideas into deliverables… generates docs/sheets/reports”).
  - `Softs/KIMI/Docs/www.kimi.com/en/deep-research.html` (deep research: rozbija pytania, szuka szeroko, daje long-form report).
  - `Softs/KIMI/Screens/` (UI behavior reference dla “public agent front door”).

### 4.3 Missing input (must remain explicit)
- **Perplexity**: brak bezpośredniego Softs corpus dla Perplexity → “research/source transparency” opieramy na `ChatGPT Search` + citations patterns, bez deklaracji Perplexity parity.

### 4.4 Parity checklist vs Softs (approval-grade)
**Parity oznacza “public AI front door z bezpiecznymi granicami + mierzalnym handoff”, nie “pełny autonomous sales agent”.**

- **Public answer boundaries + safe knowledge posture**:
  - Anna zostaje w public knowledge (jak w SSOT) i ma jawne refusal/degraded modes.
- **Voice as a governed mode (OpenAI Voice FAQ)**:
  - Voice ma jawne availability, ograniczenia, oraz bezpieczny fallback do tekstu.
  - Voice nie może powodować identity drift ani obiecywać rzeczy poza public lane.
- **Memory posture (OpenAI Memory)**:
  - Jawnie rozdzielone: co jest pamięcią rozmowy (personalization), a co jest “prawdą produktu”.
  - Możliwość ograniczenia/wyłączenia pamięci w public surface (bez “magicznego pamiętania”).
- **Search + citations posture (ChatGPT Search + Claude citations)**:
  - Gdy Anna “twierdzi fakty”: daje evidence pointers (linki/źródła) albo jawnie oznacza niepewność.
- **Deliverable-driven framing (KIMI)**:
  - Anna pracuje “deliverable-first”: odpowiedź → proponowany next step → CTA (demo/trial/contact) z jasnym uzasadnieniem.
- **Long-running resilience (context compaction + rate limits)**:
  - Dłuższe rozmowy i ograniczenia runtime nie degraduja w “losowe odpowiedzi”; istnieją jawne degraded states.

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- CTA i event grammar są mierzalne; multilang działa bez identity drift; voice ma jasne fallback states.
- Public boundaries są stabilne: Anna nie miesza się z `Teresa` i nie wycieka do internal lanes.
- Jeśli Anna podaje fakty: ma evidence pointers (linki/citations) albo jawnie oznacza ograniczenie.

### 5.2 Tests
- Integracyjne: public Q&A → CTA (demo/trial/contact) → event capture (funnel) + retry behavior.
- Regression: voice unavailable / rate-limited → czytelny fallback do tekstu + zachowanie kontekstu.
- Contract tests: “factful answer” → czy istnieją citations/evidence pointers albo uncertainty marker.

### 5.3 Staging proof checklist
- Demo: 3 scenariusze public: (1) “co to jest Consultify”, (2) “czy to pasuje do X”, (3) “jak zacząć” → CTA completion + eventy.
- Demo: voice on/off + degraded state + fallback bez identity drift.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (public SSOT): see section 3.
- Softs inspirations/parity: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P16-A — Public assistant canon + boundaries (scope approval)
- **Goal**: public-facing copilot z CTA + mierzalnym event grammar; bez mieszania z `Teresa`.
- **Inputs required**: public boundaries; CTA taxonomy; citations/uncertainty posture.
- **Acceptance**: scope zatwierdzony; non-goals jawne; privacy/memory/voice boundaries spisane.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze public boundaries (data, memory, internal lanes separation) and “no Teresa mixing”.
  - Freeze CTA taxonomy + measurable event grammar (funnel).
  - Freeze factfulness posture: citations/evidence pointers vs explicit uncertainty.
- **DoD**:
  - Approved(scope): public assistant contract is explicit; privacy/voice/memory limits are enforceable.

#### P16-B — CTA + multilang + voice degraded closure
- **Goal**: public Q&A → CTA → event capture; multilang i voice z jawnie zdefiniowanym degraded state.
- **Acceptance**: CTA działa i jest mierzalne; factful answers mają citations albo uncertainty marker.
- **Evidence**: integracyjne testy + staging demo 3 scenariuszy.
- **Tasks**:
  - Implement public Q&A→CTA completion + event capture.
  - Implement multilang + voice degraded states (rate-limit/unavailable) with safe fallback.
  - Add integration+contract tests (5.2) and run 3-scenario staging demo (5.3).
- **Staging proof script (click-by-click)**:
  1. Open public Anna surface in PL and ask: “Co to jest Consultify?” → verify CTA appears.
  2. Complete CTA (demo/trial/contact) and verify event capture is recorded (bounded).
  3. Switch to EN and repeat a “fit for X” question; verify no identity drift and correct CTA.
  4. Trigger voice on; then simulate voice unavailable/rate-limited and verify degraded fallback to text preserves context.
  5. Ask a factful question and verify citations/evidence pointers exist (or explicit uncertainty marker).
- **DoD**:
  - CTA is measurable; multilingual is stable; voice fallback preserves context; citations/uncertainty enforced.

#### P16-C — Verification + rollout
- **Goal**: regresje (rate limit / voice) + staging proof + rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P16-A/B/C.
  - Validate rollback: disable voice/factful mode; preserve safe Q&A + CTA.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Stopniowo: najpierw tekst + CTA, potem voice; feature flags per capability.

### 8.3 Rollback plan
- Wyłącz voice i “factful mode”; zachowaj bezpieczne Q&A + CTA; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: public assistant “przebija” do internal lanes.
- Ryzyko: brak citations/uncertainty → overclaim.
- Decyzje: minimalna lista CTA i ich tracking eventy.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P16-A | approved(scope) | f972557204 | N/A (scope) | N/A (scope) | Canon frozen in `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` §2.3; docs-only scope approval. |
| P16-B | delivered | `4e5fee0a46` | Automated test set documented in `docs/product/work-packets/cursor-work/final_master/evidence/P16_B_ANNA_CTA_MULTILANG_VOICE_TESTS_AND_STAGING_PROOF_PLAN_2026-03-30.md` | Staging proof script prepared in the same evidence doc; final capture belongs to P16-C | Runtime landed for CTA funnel grammar + multilang + voice degraded posture; final rollback/evidence closeout remains in P16-C. |
| P16-C | verified(evidence) | `98bf75bf8a` | `npx vitest run server/src/routes/v8/__tests__/public-anna.routes.test.ts server/src/routes/v8/__tests__/public-contact.routes.test.ts server/src/routes/v8/__tests__/public-anna.citations-contract.test.ts tests/components/Landing/AnnaLpCtaCompletion.start.test.tsx tests/components/Landing/AnnaAssistantWidget.guardrails.p16b.test.tsx` -> PASS (27/27) | `docs/product/work-packets/cursor-work/final_master/evidence/P16-C_ANNA_PUBLIC_ASSISTANT_CLOSEOUT_2026-03-31.md` | Closeout verified CTA funnel grammar, multilang stability, voice degraded fallback, and citations/uncertainty posture for the bounded public Anna surface. |

