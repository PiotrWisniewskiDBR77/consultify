# LLM Testing & Resilience Drills

Use this checklist to validate LLM readiness across providers (OpenAI, Gemini, DeepSeek, Zhipu, Ollama, Cohere, NVIDIA when enabled).

## Synthetic Health Probes (smoke)

- Endpoint: `GET /api/llm/health/status` (expect active providers, avg latency, uptime).
- Provider probe: `POST /api/llm/health/test-provider` with `{ providerId }` for each configured provider.
- Capability probe: `POST /api/llm/health/test/:capability` (`connection`, `eyes`, `memory`, `hands`, `reasoning`).

## Functional Smoke (per provider)

- Prompt: “Say pong” (text), expect 200 + short completion.
- Structured: request small JSON schema (2 fields) to verify `generateObject`.
- Tools: run `callWithTools` with a trivial tool (echo) to verify tool-calling path.

## Load / Soak (non-prod keys)

- Target: `/api/llm/health/test-provider` or a dedicated non-prod prompt endpoint.
- Profile: 1–5 RPS for 10–15 minutes per provider; capture p50/p95/p99 latency, error rate, and tokens.
- Watch circuit breaker trips and rate-limit responses.

## Failover / Chaos

- Disable one provider key (set bogus key) and confirm router falls back per tier chain.
- Simulate high latency: inject delay (e.g., via network shaping) and observe circuit breaker open/close.
- Validate budget tier routing selects lowest cost model and falls back when unhealthy.

## Concurrency / Rate Guards

- Fire parallel requests (e.g., 50 concurrent) and confirm “Concurrency limit exceeded”/“Rate limit exceeded” is graceful.
- Ensure no process crash; circuit breaker state recovers after cooldown.

## Observability to verify

- Logs: `LLMServiceMetrics` entries with duration and tokens.
- Metrics: ai_usage_logs populated; costs derived in `/api/llm/costs`.
- Health dashboards: SuperAdmin → AI Operations → Mission Control / Performance / Costs / Analytics show non-zero data.

## Pass/Fail Criteria

- <1% error rate under smoke load; circuit breaker not stuck open.
- p95 latency within provider SLA targets.
- Fallback succeeds when primary provider fails (returns 200 from alternate).
- No secrets in logs; no 500 due to missing keys.
