# AI Agent Orchestration & Parallelism v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** standard dla agentów specjalizowanych, pracujących równolegle, z routingiem przez `purpose`, kontrolą kosztów i spójnością “propose → accept”.  
>
> **Powiązane SSOT (MUST):**
> - Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
> - Pricing & cost controls: `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
> - Provider & residency policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
> - Deep Research + Evidence Ledger system: `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
> - AI LLM operating system (ideal v3): `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`
> - Platform readiness audit (as‑is vs to‑build): `docs/product/modules/ai/AI_PLATFORM_READINESS_AUDIT_V3.md`
> - V3 program contract (AI propose→accept): `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
>
> **As‑is code references:**
> - provider guards: `server/src/services/ai/llmService.ts` (concurrency/rate + breaker)
> - quota/rate (business): `server/src/services/ai/quotaService.ts`, `server/src/services/ai/rateLimiter.ts` (opisane w flow)

---

## 1) Zasady kanoniczne

1) **Agent ≠ model.** Agent to workflow + zestaw kroków, a każdy krok wybiera model przez `purpose`.
2) **Równoległość jest kontrolowana**: quota (org/user) + provider guards (process) + kolejka dla batch.
3) **Propose → accept**: agent nigdy nie “zapisuje prawdy” bez akceptacji użytkownika.
4) **Wszystko jest mierzone**: koszt i latency per agent step.

### 1.1 Kontrola runtime w czacie (User) — co użytkownik może wybrać (as‑is + MUST)

W czacie użytkownik ma kontrolę “runtime”, która nie łamie v3 purpose routing:

- **Tryby (aiModes)** — `ToolsMenu`:
  - `deepResearch` (Deep Thinking / deep research flow; gated przez confirm)
  - `webSearch`
  - `showReasoning` (tylko “reasoning highlights” high‑level; bez chain-of-thought)
  - `multiAgent`
  - `privateMode`
  - `coThinkerMode`
- **Styl odpowiedzi**:
  - `responseStyle` (np. executive/analyst/coach/concise)
  - `customInstructions` (persistowane w AI memory; wstrzykiwane do promptu, jeśli memory read allowed)
- **Poziom modelu (tier)** — `LLMSelector`:
  - `selectedTier`: `BUDGET|STANDARD|PREMIUM|REASONING`
  - (opcjonalnie) `selectedModelId` (explicit override; używane m.in. dla local Ollama)

**MUST:** wybrany tier/model nie może omijać polityk org (`organization_ai_policy`) ani gatingu health.

### 1.2 Kontekstowość (screen/org/history) — kontrakt “wise consultant” (as‑is)

Backend buduje kontekst i personalizację w 2 warstwach:

1) **AIContextBuilder (6-layer)**: `server/src/services/aiContextBuilder.ts`
   - platform/org/project/execution/knowledge/external + PMO health + pending approvals + aiSettings
   - polityka kontekstu org (context_policy_json) i trimming przy dużym kontekście
2) **AIPipeline context assembly**: `server/src/services/ai/AIPipeline.ts`
   - dołącza user/org memory (jeśli memory read allowed)
   - dołącza `custom_instructions`
   - respektuje `privateMode` + retention mode

Kontrakt wejścia z UI:
- klient wysyła `projectId` oraz `screenContext` (current screen + selected object id/type) w payload chat/confirm/stream,
- klient wysyła `conversationId` i historię rozmowy (rolling window) jako podstawę “session memory”.

**MUST:** jeśli UI nie przekaże `screenContext`/`projectId`, system traci część “mądrości kontekstowej” — to jest P0 w chat UX.

---

## 2) Typy agentów (v3 baseline)

> Typy są logiczne; implementacja może je mapować na “skill profiles”.

- **RouterAgent**: dobiera workflow i rozbija zadanie na kroki (niskie koszty, wysokie bezpieczeństwo).
- **ResearcherAgent**: zbiera kontekst (linki, dokumenty, notatki) i produkuje **Evidence Ledger** (Claim→Evidence) + Coverage Report (SSOT: `AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`).
- **ExtractorAgent**: ekstrakcja struktur (JSON) z tekstu / dokumentów / obrazów (vision).
- **WriterAgent**: draft sekcji raportu/decku.
- **ReviewerAgent**: quality gate, sprawdza spójność, ryzyka, traceability.
- **VisualAgent**: obrazowe assety (cover/diagram), jeśli włączone.

### 2.1 Deep Research (v3) — wyspecjalizowane role (MUST)

W deep research (research run w minutach) rozbijamy pracę na wyspecjalizowane kroki/agentów:

- **EvidenceAgent**: buduje Evidence Ledger (claims + snippet refs), liczy coverage i unsupported claim rate.
- **ContradictionResolverAgent**: wykrywa sprzeczności (liczby/daty/definicje) i tworzy “conflicts” + plan domknięcia.
- **LibrarianAgent**: polityki źródeł (allow/deny domains), doc approvals, dataClass compliance; odpowiada za “source governance”.
- **RefreshAgent**: “drift monitoring” — tworzy delta memo i sygnały zmian (watchlist).

---

## 3) Kontrakt danych agenta (logical)

### 3.1 `AgentRun`

- `id`, `organization_id`, `user_id`
- `agent_type`
- `input_ref` (co jest “źródłem pracy”: initiative/session/report/deck)
- `steps[]`
- `status`: running/succeeded/failed/canceled
- `budget`: max_cost / max_tokens / deadline_ms
- `created_at`, `completed_at`

### 3.2 `AgentStep`

- `step_id`, `name`
- `purpose`
- `requirements`
- `budget` (opcjonalnie override)
- `outputs[]` (drafty/propozycje)
- `evidence` (opcjonalnie, ale **MUST** dla deep research):
  - `evidence_ledger_ref?`
  - `coverage_report_ref?`
  - `contradictions_ref?`
- `usage` (tokens/cost/latency)
- `fallbacks_used[]` (model/provider)

---

## 4) Równoległość i kolejki

### 4.1 Interakcyjne vs batch

- **Interactive**: chat, krótkie sugestie → fail‑fast, małe retry, mała latencja.
- **Batch**: full_report, deck generation, image assets → kolejka + retry + progress.

### 4.2 Guardrails

- quota/rate limiting per org/user (flow)
- provider concurrency/rate per proces (as‑is w `llmService.ts`)
- circuit breaker: automatyczne odcinanie providerów przy awarii

---

## 5) Budżety i degraded mode

- każdy AgentRun ma globalny budżet
- kroki mają budżety cząstkowe
- po soft cap:
  - mniej iteracji,
  - tańsze purpose→tier mapping,
  - batch zamiast realtime,
  - ograniczenie obrazów (np. 1 zamiast 4)

---

## 6) Observability (SuperAdmin + Admin)

- widok “top agent types by cost”
- widok “top purposes by cost”
- widok “error hotspots” (429/5xx)
- audyt: kto uruchomił agent run, jakie artefakty powstały, co zaakceptowano

---

## 7) DoD

- Każdy agent step ma `purpose`.
- Agent outputs są propozycjami, nie zapisują prawdy bez accept.
- Możemy uruchamiać równolegle min. 2–3 agentów bez łamania limitów i bez “lawiny kosztów”.

