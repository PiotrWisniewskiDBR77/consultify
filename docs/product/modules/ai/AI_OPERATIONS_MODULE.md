# AI Operations Module

Mission Control, performance, costs, SLA, and analytics for all AI providers and models.

## Tabs

- **Mission Control** – uptime, latency, active providers, capability diagnostics.
- **Performance** – response percentiles, cache hit rate, requests, success rate, by capability/model.
- **Costs** – token spend and cost per provider, monthly totals, average cost per request.
- **SLA** – uptime, latency P95/P99, error rate, breach history, targets.
- **Analytics** – usage by capability/model, peak hours, requests/tokens/cost trends, unique users.

## Data Sources

- `llm_providers` – configured providers (OpenAI, Gemini, Anthropic, Deepseek, Zhipu, Ollama, etc.).
- `ai_usage_logs` – per-request logs: provider, model, tokens, latency, status, metadata.
- Derived metrics are aggregated directly from `ai_usage_logs` (costs use `cost_per_1k` from `llm_providers`).

## Demo / Seed Data

Use the seed to populate dashboards when running in demo mode or during dry-runs:

```bash
pnpm tsx server/scripts/seed-ai-usage-demo.ts
# or
npm run db:migrate && pnpm tsx server/scripts/seed-ai-usage-demo.ts
```

What it does:

- Removes previous demo inserts (`metadata.demoSeed = true`) from `ai_usage_logs`.
- Adds realistic usage across providers (OpenAI, Google, Deepseek, Zhipu, Ollama) over the last 30 days with latency, tokens, success/error mix.
- Immediately unlocks non-zero values in **Mission Control**, **Costs**, and **Analytics**.

## Backend Endpoints (key)

- `GET /api/llm/health/status` – providers + uptime/latency totals (last 24h).
- `POST /api/llm/health/test/:capability` – run capability checks (connection/eyes/memory/hands/reasoning).
- `GET /api/llm/costs` – monthly costs & token totals per provider.
- `GET /api/llm/analytics` – usage analytics (requests/tokens/latency/errors).
- `GET /api/llm/logs` – recent logs.

## Frontend Components

- `src/views/superadmin/AIOperationsModule.tsx`
  - `Mission Control` → `AIMissionControl`
  - `Performance` → `AIPerformanceDashboard`
  - `Costs` → `AICostDashboard`
  - `SLA` → `SLADashboard`
  - `Analytics` → `UsageAnalyticsDashboard`

## Runbook (common issues)

- **Active Providers empty**: ensure valid auth token and providers marked `is_active = 1`; check `/api/llm/health/status`.
- **Costs show $0.00**: seed demo data or ensure `ai_usage_logs` has rows for current month; costs depend on `tokens_used` and `cost_per_1k`.
- **Health tests failing**: verify provider keys and network; check `/api/llm/health/test/:capability` responses and logs.

## Production checklist

- Env-only keys (no secrets in DB): set in `.env.local` / secret manager; seed via `scripts/seed-llm.sh`.
- Health/fallback: `/api/llm/health/status` and capability tests; router uses cost+tier chains.
- Guards: circuit breaker + rate/concurrency limits in `llmService`.
- Observability: `LLMServiceMetrics` logs; `ai_usage_logs` for tokens/cost; AI Operations dashboards.
- Drills/tests: see `docs/testing/plans/LLM_TEST_PLAN.md` (smoke, load/soak, failover).
