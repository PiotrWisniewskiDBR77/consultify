# AI Agent Orchestration & Parallelism v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** standard dla agentów specjalizowanych, pracujących równolegle, z routingiem przez `purpose`, kontrolą kosztów i spójnością “propose → accept”.  
>
> **Powiązane SSOT (MUST):**
> - Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
> - Pricing & cost controls: `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
> - Provider & residency policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
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

---

## 2) Typy agentów (v3 baseline)

> Typy są logiczne; implementacja może je mapować na “skill profiles”.

- **RouterAgent**: dobiera workflow i rozbija zadanie na kroki (niskie koszty, wysokie bezpieczeństwo).
- **ResearcherAgent**: zbiera kontekst (linki, dokumenty, notatki) i produkuje “evidence list”.
- **ExtractorAgent**: ekstrakcja struktur (JSON) z tekstu / dokumentów / obrazów (vision).
- **WriterAgent**: draft sekcji raportu/decku.
- **ReviewerAgent**: quality gate, sprawdza spójność, ryzyka, traceability.
- **VisualAgent**: obrazowe assety (cover/diagram), jeśli włączone.

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

