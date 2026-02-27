# AI Market Update Standard v3 — stała aktualizacja modeli i cen (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** systemowo utrzymywać aktualny katalog modeli/capabilities/cen oraz zarządzać zmianą (deprecations, price changes, nowe modele) bez ryzyka dla produkcji.  
>
> **Powiązane SSOT (MUST):**
> - Model Registry v3: `docs/product/MODEL_REGISTRY_V3.md`
> - Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
> - Pricing registry: `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
> - Provider policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
> - API keys checklist: `docs/product/modules/ai/AI_API_KEYS_CHECKLIST_V3.md`

---

## 1) Problem

Rynek modeli zmienia się szybciej niż release cycle produktu:

- pojawiają się nowe modele, stare są deprecjonowane,
- zmieniają się ceny (czasem nagle),
- capability potrafią się zmieniać (tools/vision/ctx),
- agregatory dodają/wyłączają modele dynamicznie.

Bez “systemu aktualizacji” SuperAdmin zarządza tym ręcznie i reaktywnie, co zwiększa ryzyko kosztów i awarii.

---

## 2) Cel produktu (outcome)

1) **Katalog modeli** jest aktualny i mierzalny.
2) Zmiany w rynku nie psują routingu: mamy diff + approval + rollout.
3) Ceny są wersjonowane i przypięte do usage (snapshot).
4) SuperAdmin dostaje alerty i “inbox” zmian do zatwierdzenia.

---

## 3) Architektura standardu: Connectors → Normalize → Diff → Approve → Rollout

### 3.1 Connector (per provider source)

Każdy connector implementuje:

- `fetchModels()` → lista modeli + metadane (ctx, modalities, capabilities)
- `fetchPricing()` → jeśli provider udostępnia (w przeciwnym razie `null`)
- `fetchDeprecations()` → jeśli provider udostępnia (często manual/semi‑auto)
- `sourceHealth()` → czy API do sync działa

### 3.2 Normalizacja do jednego schematu

`NormalizedModelRecord`:

- `source` (openrouter/openai/anthropic/vertex/fal/replicate/…)
- `provider_type` (direct/aggregator/hosted/local)
- `origin_vendor` (jeśli znane)
- `model_id`
- `display_name`
- `kind` (TEXT_LLM/IMAGE_MODEL/BUSINESS_MODEL)
- `capabilities` (vision/tools/streaming/json_mode)
- `context_window` (jeśli dotyczy)
- `pricing` (jeśli dotyczy) + `unit`
- `regions` (często unknown → uzupełniane manualnie/polityką)
- `fetched_at`

### 3.3 Diff engine (zmiany)

Wykrywane klasy zmian:

- `MODEL_ADDED`
- `MODEL_REMOVED` / `MODEL_DEPRECATED`
- `PRICING_CHANGED` (delta %)
- `CAPABILITY_CHANGED`
- `CTX_CHANGED`

### 3.4 Approval workflow (MUST)

Zmiany nie wchodzą “same” do routingu.

- Każda zmiana tworzy element w **Model Inbox** w SuperAdmin.
- SA może: approve / ignore / map‑to‑existing / mark deprecated / create rollout plan.

### 3.5 Rollout

Zmiany po zatwierdzeniu:

- aktualizują registry (provider/model metadata),
- aktualizują price snapshots (nowa wersja),
- mogą wygenerować propozycję zmian assignments (np. dodać model do tier fallback),
- nigdy nie usuwają modelu używanego bez “migration plan”.

---

## 4) Źródła synchronizacji (realistyczne)

> Rynek nie ma jednego standardu. Dlatego mamy mix: API sync + manual pricing + kontrakty.

### 4.1 Źródła, które mają model list API (dobry sync)

- **OpenAI**: `GET /v1/models` (lista modeli; pricing zwykle osobno)
- **Anthropic**: `GET /v1/models` (lista modeli; paging)
- **OpenRouter**: `GET /api/v1/models` (katalog + zwykle pricing per model)
- **Replicate**: `GET /v1/models`, `GET /v1/search` (katalog + discovery)
- **fal.ai**: model search + `GET /v1/models/pricing` (pricing per endpoint_id)
- **Vertex AI (Model Garden)**: list publisher models (wymaga GCP auth i regionu)

### 4.2 Źródła, które zwykle wymagają manual / semi‑auto

- enterprise contracts (ceny per klient)
- vendor pricing pages (zmiany dokumentowane, ale bez stabilnego API)
- region/data residency (często wymaga attestation / kontraktu)

---

## 5) Harmonogram sync (SLA)

Rekomendowany domyślny rytm:

- agregatory/hosted catalogs (OpenRouter, fal, Replicate): **daily**
- direct model lists (OpenAI, Anthropic): **daily / weekly** (zależnie od potrzeb)
- ceny manual/contract: **event‑driven** (po zmianie kontraktu) + minimum kwartalnie review

---

## 6) Model Inbox (SuperAdmin UX)

Widok zmian z ostatniego sync:

- **New**: nowe modele do rozważenia
- **Changed**: pricing/capability/ctx changed
- **Deprecated/Removed**: ryzyko dla assignments

Akcje SA:

- “Add to catalog”
- “Update price registry (new snapshot)”
- “Mark deprecated (with deadline)”
- “Propose assignment updates”
- “Create migration task”

---

## 7) Alerting (systemowe)

- pricing change > X% dla modeli używanych w produkcji
- model removed/deprecated, a jest w assignmentach
- sync job failing (connector down)
- nagły wzrost 429/5xx (provider throttling)

---

## 8) Security / compliance

- klucze do connectorów są techniczne (SuperAdmin scope), nigdy nie wychodzą do UI
- sync nie pobiera promptów ani danych klienta — tylko metadane rynkowe
- region/residency default = `UNKNOWN` dopóki nie ma potwierdzenia (attestation)

---

## 9) DoD

- Mamy co najmniej 1 działający connector (OpenRouter) oraz Model Inbox.
- Price snapshots są wersjonowane i przypisywane do usage.
- Deprecation modeli generuje alert i “migration plan”, a nie ciche zniknięcie.

---

## 10) Implementacja “as‑is” w kodzie (V3) — OpenRouter Connector + Inbox + Apply (DONE)

### 10.1 Tabele (DB)

- `ai_market_snapshots` — surowe snapshoty payloadów z rynku (source=`openrouter`)
- `ai_market_inbox` — elementy diff do zatwierdzenia (status: `new|approved|ignored|applied`)

### 10.2 Endpointy (backend)

- **Sync (manual + cron)**: `POST /api/llm/market/openrouter/sync`
  - zapisuje nowy snapshot do `ai_market_snapshots`
  - generuje diff i wpisy do `ai_market_inbox` (limit 200, żeby nie zalać inboxa)
  - implementacja: `server/src/services/ai/openRouterMarketService.ts` + route w `server/src/routes/llm.routes.ts`

- **Inbox list**: `GET /api/llm/market/inbox?status=new&source=openrouter`
- **Approve/ignore**: `PUT /api/llm/market/inbox/:id` (ustawia status + `reviewed_at`)

- **Apply (curated rollout)**: `POST /api/llm/market/inbox/:id/apply` (**SUPERADMIN**)
  - `PRICING_CHANGED` → tworzy `ai_price_snapshots` (`source=api_sync`) i zamyka poprzedni “open” snapshot (`effective_to`)
  - `MODEL_ADDED` → tworzy “suggestion” w `llm_providers` (domyślnie `is_active=0`) + opcjonalny snapshot ceny jeśli pricing jest w payload
  - `MODEL_REMOVED` / `CTX_CHANGED` → konserwatywnie `noop` (wymaga ręcznego rollout planu)

### 10.3 Wykrywane klasy zmian (diff engine)

W praktyce sync wykrywa i zapisuje do `ai_market_inbox.change_type`:

- `MODEL_ADDED`
- `MODEL_REMOVED`
- `PRICING_CHANGED`
- `CTX_CHANGED`

### 10.4 Harmonogram (cron)

- Scheduler: `server/src/cron/Scheduler.ts`
- Job: “AI Market sync (OpenRouter)” co 6 godzin (`15 */6 * * *`)
- Wyłączenie: `DISABLE_AI_MARKET_SYNC=true`

### 10.5 UI (SuperAdmin)

- Operacje → “Market Inbox (OpenRouter)”
  - `Sync now` (uruchamia `/market/openrouter/sync`)
  - Approve/Ignore
  - **Apply** (wymaga status=`approved`) — zapis zmian do registry/pricing zgodnie z zasadą approve→rollout

