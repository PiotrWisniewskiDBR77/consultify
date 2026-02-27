# AI Pricing, Metering & Cost Controls v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** spójny system kosztów: rejestr cen (wersjonowany), metering per purpose, limity/budżety, alerty oraz odporność na zmiany pricingu.  
>
> **Powiązane SSOT (MUST):**
> - AI usage & limits flow: `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`
> - Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
> - Provider & residency policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
> - Model registry v3: `docs/product/MODEL_REGISTRY_V3.md`

---

## 1) Zasady kanoniczne (non‑negotiable)

1) **Koszt liczymy per `purpose`** (nie per “screen” i nie per “model id”).
2) **Historyczny koszt nie może się zmieniać** po aktualizacji cen → używamy `price_snapshot_id`.
3) **Soft cap + degraded mode** zamiast natychmiastowego odcięcia (GAP‑AI‑002 w flow).
4) **Alerty 80/90/100%** w backendzie (GAP‑AI‑001 w flow) + alerty anomalii.

---

## 2) Price Registry (wersjonowany)

### 2.1 Pojęcia

- **Price source**:
  - `api_sync` (np. agregator/host zwraca ceny programowo)
  - `manual` (wprowadzane przez SuperAdmin)
  - `contract` (enterprise; ceny per klient)
- **Effective window**: `effective_from`, `effective_to` (opcjonalnie)

### 2.2 Minimalny model danych (logical)

`PriceSnapshot`:

- `id`
- `provider_id` / `provider_type`
- `model_id`
- `currency`
- `source` (`api_sync|manual|contract`)
- `effective_from`, `effective_to?`
- `units` (multi-modality):
  - text: `input_per_1m_tokens`, `output_per_1m_tokens` (albo per 1k)
  - image: `image_input_per_1m_tokens`, `image_output_per_1m_tokens` **lub** `per_image` **lub** `per_mp`
  - request: `per_request`
- `notes` (np. “Vertex pricing depends on region/plan”)

> **MUST:** system potrafi przechować różne jednostki, bo rynek jest heterogeniczny.

---

## 3) Metering & usage logs (per request)

### 3.1 Co logujemy (kanon)

`AiUsageLog` minimalnie zawiera:

- `organization_id`, `user_id`
- `purpose`, `kind`
- `provider`, `model_id`
- `status`, `error_class` (np. 429/5xx/timeout)
- `latency_ms`
- `usage breakdown`:
  - `prompt_tokens`, `completion_tokens`, `total_tokens`
  - `image_input_tokens`, `image_output_tokens` (jeśli dotyczy)
  - `num_images`, `mp_total` (jeśli dotyczy)
- `price_snapshot_id`
- `cost_estimated` (wyliczony w momencie requestu)

### 3.2 Agregacje (do dashboardów)

- per org/per miesiąc: total cost, total tokens, top purposes
- per purpose: median cost per call, p95 latency, error rate
- per provider/model: koszt jednostkowy i trendy

---

## 4) Cost controls (mechanizmy egzekwowania)

### 4.1 Limity (twarde) i budżety (miękkie)

- **Hard limit**: blokuje wykonanie (chyba że `grace`).
- **Soft cap**: po przekroczeniu wchodzimy w **degraded mode**:
  - tańszy tier/model dla purpose,
  - ograniczenie iteracji (np. maxIterations),
  - wymuszenie JSON-only krótszych odpowiedzi,
  - przerzucenie ciężkich jobów do kolejki.

### 4.2 Budżety per purpose

Typowe reguły:

- `chat_simple`: mały budżet/call
- `full_report` / `deck_outline`: większy budżet + batch queue
- `image_*`: osobny budżet (często 10× droższy niż chat)

---

## 5) Alerting (SuperAdmin + Admin org)

### 5.1 Progi zużycia

- 80% / 90% / 100% miesięcznego limitu (z flow)

### 5.2 Anomalie

- skok kosztu per `purpose` > X% dzień do dnia
- skok error rate (429/5xx)
- nagły spadek skuteczności (dużo retry/fallback)

### 5.3 Zmiany cennika

- wykrycie zmiany w `PriceSnapshot` (api_sync) → “approval required”
- jeśli model jest używany w assignmentach → “impact report”

---

## 6) SuperAdmin surfaces (IA)

- **Pricing registry**: lista modeli z cenami + wersje + źródło + effective date
- **Usage**: per org + per purpose (top spenders, trendy)
- **Alerts**: thresholds + anomalies + pricing changes
- **Controls**: soft cap policies, grace, degraded routing rules

---

## 7) DoD

- Każdy request AI ma `purpose` i `price_snapshot_id`.
- Historyczne raporty kosztów nie zmieniają się po update cen.
- Soft cap działa jako degradation (nie “off switch”).
- Alerty threshold i anomalii są widoczne w SuperAdmin.

---

## 8) Implementacja “as‑is” w kodzie (V3) — Pricing Registry + Metering + Alerts + Soft‑cap (DONE/IN USE)

### 8.1 Price registry (DB + API)

- Tabela: `ai_price_snapshots` (tworzona w `server/src/routes/llm.routes.ts`)
- API:
  - `GET /api/llm/pricing/snapshots` (list)
  - `POST /api/llm/pricing/snapshots` (create manual/contract/api_sync)
- Market apply workflow (OpenRouter):
  - `POST /api/llm/market/inbox/:id/apply` tworzy snapshoty z `source=api_sync` oraz zamyka poprzedni snapshot (ustawia `effective_to`)

### 8.2 Metering per request (price_snapshot_id + estimated cost)

Źródłem prawdy dla kosztu per request jest log requestu w AI pipeline:

- `server/src/services/ai/AIPipeline.ts`
  - binduje `ai_usage_logs.price_snapshot_id` (match po `(provider, model_id)` + `effective_to`)
  - liczy koszt z `ai_price_snapshots.units` (per 1M / per 1K / legacy)
  - zapisuje:
    - `ai_usage_logs.price_snapshot_id`
    - `ai_usage_logs.estimated_cost_usd` (**kolumna dodana “best-effort” w schema ensure**)
    - oraz `metadata.estimated_cost` (dla debug/trace)

### 8.3 Analytics (dashboard i endpointy)

- `GET /api/llm/costs` (controller: `server/src/controllers/ai/LLMController.ts`)
  - **preferuje v3**: sumuje `ai_usage_logs.estimated_cost_usd` (MTD)
  - fallback do legacy: `tokens_used * llm_providers.cost_per_1k`
- UI: `src/components/Admin/AICostDashboard.tsx` korzysta z `/api/llm/costs`

### 8.4 Markup (“drożej na 100%”)

Markup jest stosowany w momencie wyliczania kosztu (czyli wpływa na limity/alerty/soft-cap):

- Default w `llm_providers`: `markup_multiplier` (dla nowych wpisów domyślnie **2.0**)
  - definicja tabeli: `server/src/services/ai/llmConfigService.ts`
- Wyliczenie kosztu:
  - `server/src/services/ai/AIPipeline.ts` mnoży koszt snapshota przez markup (priorytet: DB → env → default)
- Env override:
  - `AI_MARKUP_MULTIPLIER` lub `AI_PRICE_MARKUP_MULTIPLIER`

### 8.5 Alerty progowe 80/90/100% (kosztowe)

- Serwis: `server/src/services/ai/aiCostAlertsService.ts`
  - liczy MTD koszt per org z `ai_usage_logs.estimated_cost_usd`
  - budżet: `organizations.monthly_budget_usd`
  - deduplikacja wysyłek: `ai_cost_alerts_sent` (per org / threshold / period)
- Cron: `server/src/cron/Scheduler.ts` (co godzinę)
- Wyłączenie: `DISABLE_AI_COST_ALERTS=true`

### 8.6 Soft cap / degraded mode (routing)

- Router: `server/src/services/ai/modelRouter.ts`
  - jeśli org ma ustawiony `organizations.monthly_budget_usd` i MTD koszt zbliża się do limitu:
    - degraduje nie‑krytyczne purpose do tańszego tieru (np. do `BUDGET`) zamiast twardego odcięcia
  - sterowanie:
    - `AI_COST_SOFT_CAP_ENABLED=false` (wyłącza)
    - `AI_COST_SOFT_CAP_THRESHOLD_PCT` (domyślnie 90)
    - `AI_COST_SOFT_CAP_SEVERE_PCT` (domyślnie 110)

### 8.7 Źródło cen (OpenRouter) — normalizacja units

W apply workflow (OpenRouter) pricing jest normalizowany do:

- `units.input_per_1m_tokens`
- `units.output_per_1m_tokens`

co pozwala spójnie liczyć koszt w `AIPipeline` oraz zachować historyczność przez `price_snapshot_id`.

