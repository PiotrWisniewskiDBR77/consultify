## Scope

Digest rozmów o **LLM / providerach / health / endpointach** oraz o tym, żeby “brak LLM” nie wynikał z niespójności FE↔BE i żeby opcjonalni providerzy nie psuli statusu (np. Gemini gdy nieużywany).

## Decisions (hard)

- **Canonical API**: providerzy LLM są wystawieni jako `GET /api/llm/providers` (a nie `/api/ai/providers`). FE ma być spójny z BE.
- **Optional providers**: brak klucza do opcjonalnego providera = provider jest **nie skonfigurowany/wyłączony**, nie “unhealthy” (żeby nie degradować statusu, gdy celowo nie używamy Gemini).
- **Purpose-first**: routing modeli i fallbacki muszą wynikać z **Model Registry** (purpose/kind), a nie z hard-coded wyborów w feature’ach.
- **Operating System SSOT**: “idealny system pracy LLM” (procedury + governance + routing + monitoring + UX ról) jest opisany jako kanon w `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`.

## Requirements (MUST / SHOULD)

- **MUST**: “brak LLM” w UI nie może wynikać z 404 na błędnym endpointcie (FE musi wołać właściwe `/api/llm/*`).
- **MUST**: SuperAdmin widzi katalog providerów/modeli **bez sekretów** (keys nigdy w UI).
- **MUST**: health status AI nie może być “degraded” tylko dlatego, że nie skonfigurowaliśmy opcjonalnego providera.
- **SHOULD**: audit log konfiguracji modeli/providerów (kto/kiedy/co) + telemetry błędów providerów.

## Open questions

- Jak w UI komunikujemy “configured vs disabled vs unhealthy” (copy + badge), żeby to było jednoznaczne.
- Czy chcemy “allowlist providerów” per org (R2+), czy tylko globalnie na go-live.

## SSOT impact (files to update / keep aligned)

- `docs/product/MODEL_REGISTRY_V3.md`
- `docs/product/modules/ai/AI_API_KEYS_CHECKLIST_V3.md`
- `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
- `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
- `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`
- `docs/product/modules/ai/AI_MARKET_UPDATE_STANDARD_V3.md`

## Backlog extraction (mapowanie na V3)

- **V3-A06** — SuperAdmin: Model Registry (kind/purpose/fallbacks)
- **V3-N01** — `ai_usage_logs` v3 contract (cost + error_class + kind + migration)
- **V3-N02** — AIPipeline: log error-path do `ai_usage_logs` (status=error)
- **V3-N03** — Market Inbox: enforce approve-before-apply + audit entry

## Notes (źródła rozmów)

- Cursor transcript: `1aff0c27-10dd-4229-9804-9efaea6f13d2` (LLM “brak LLM”, `/api/llm/providers`, Gemini jako optional).
- Cursor transcript: `52bbebe0-7d7e-446c-b0e4-b1b74562262b` (strategia LLM: purpose/region/residency, zestaw API na start, “Market Update Standard”).

