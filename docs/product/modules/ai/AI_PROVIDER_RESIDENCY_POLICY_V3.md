# AI Provider & Residency Policy v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** zarządzanie modelami pod kątem przeznaczenia, pochodzenia, regionu przetwarzania i wymogów klientów (zakaz regionów / zakaz agregatorów / local‑only).  
>
> **Powiązane SSOT (MUST):**
> - Model Registry v3: `docs/product/MODEL_REGISTRY_V3.md`
> - Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
> - AI usage & limits: `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`
>
> **As‑is code references:**
> - provider config + DB sync: `server/src/services/ai/llmConfigService.ts`
> - router selection + org provider settings: `server/src/services/ai/modelRouter.ts`
> - health snapshot: `server/src/routes/llm.routes.ts`

---

## 1) Dlaczego to jest osobny SSOT

W praktyce “jaki model?” to **nie tylko jakość i koszt**, ale też:

- czy klient dopuszcza **agregator** (np. OpenRouter) czy wymaga **direct vendor**,
- czy klient ma zakazy regionalne (np. “no US”, “EU only”),
- czy dane (PII / confidential) mogą wyjść poza środowisko klienta,
- jakie są warunki retention / subprocessors.

To nie może być “ręcznie” w kodzie — musi być polityką per org, egzekwowaną przez router.

---

## 2) Definicje (kanon)

### 2.1 Origin vs Provider vs Execution region

- **Origin vendor**: kto “jest właścicielem” modelu (np. OpenAI, Anthropic, Google).  
- **Provider**: kto wystawia API (direct / aggregator / local).  
- **Execution region**: gdzie realnie przetwarzane są dane.  

> **MUST:** system przechowuje wszystkie trzy, bo łańcuch dostaw może mieć pośredników.

### 2.2 Provider types

- `direct`: bezpośrednio u vendora
- `aggregator`: gateway do vendorów (np. OpenRouter)
- `local`: inference lokalnie (Ollama / vLLM / itp.)
- `customer_managed`: klucze i hosting klienta (preferowane enterprise)

### 2.3 Data classes (dla polityk)

- `no_pii`: dane nieosobowe
- `pii`: dane osobowe (w tym wrażliwe)
- `confidential`: dane poufne klienta (strategiczne/finansowe itp.)

---

## 3) Kanoniczny rekord providera/modelu (logical)

> Implementacyjnie część tych pól jest dziś w `llm_providers`, część do dodania w rozszerzeniu registry.

### 3.1 Provider/model attributes

- `provider_id`, `provider_name`
- `provider_type`
- `origin_vendor`
- `model_id` (vendor model id lub namespaced id dla agregatora)
- `kind`: `TEXT_LLM | IMAGE_MODEL | BUSINESS_MODEL`
- `capabilities`: vision/tools/streaming/json_mode
- `execution_regions[]`: `EU | US | GLOBAL | UNKNOWN`
- `data_residency_attestation`: `none | vendor_statement | contract | dpia`
- `allowed_data_classes[]`: `no_pii | pii | confidential`
- `retention_policy`: opis/typ
- `subprocessors_ref`: URL/ID
- `health_status`, `last_health_check`, `avg_latency_ms`

---

## 4) Polityka per organizacja (org AI policy)

### 4.1 Minimalny kontrakt

- `allow_regions[]` i/lub `deny_regions[]`
- `allow_provider_types[]` i/lub `deny_provider_types[]`
- `allow_origin_vendors[]` i/lub `deny_origin_vendors[]`
- `default_data_class`: domyślna klasa danych dla org (jeśli UI nie poda)
- `require_local_for_data_classes[]`: np. `confidential`
- `purpose_overrides[]`: wyjątki per purpose (np. `chat_simple` może być chmura, `full_report` tylko local)

### 4.2 Polityka “no aggregator” (częsty enterprise)

Jeśli org ustawi `deny_provider_types = ['aggregator']`, router:

- nie bierze pod uwagę OpenRouter (nawet jeśli jest skonfigurowany globalnie),
- wymaga direct vendor albo local,
- jeśli brak pokrycia dla purpose → jawny błąd + SA alert (nie degradujemy cicho).

---

## 5) Egzekwowanie polityk w routingu (kontrakt)

### 5.1 Filtr kandydatów

Każdy kandydat z assignments/tier chain jest filtrowany przez:

1) `kind` / `requirements` (z purposes SSOT)  
2) org AI policy (region/provider_type/origin/data_class)  
3) health gating (`unhealthy` odpada)  

### 5.2 Failure modes (MUST)

- Brak kandydata po filtrach → zwracamy błąd “policy prevents routing” + telemetry + alert.
- Jeśli model jest dopuszczalny, ale throttling (429) → fallback w obrębie dopuszczalnych kandydatów, nie “przeskok” do zakazanego providera.

---

## 6) SuperAdmin surfaces (IA)

### 6.1 Providers & Models (catalog)

- pola: provider_type, origin_vendor, execution_regions, allowed_data_classes, health, pricing reference
- test connection (as‑is endpoints)

### 6.2 Org AI Policy

- edycja allow/deny list
- “coverage report”: czy każdy purpose ma co najmniej 1 dopuszczalny model

### 6.3 Policy incidents

- timeline: “routing blocked by policy”
- rekomendacje: “dodaj direct provider X” / “włącz local provider” / “przypisz model do purpose”

---

## 7) DoD

- System potrafi wymusić: EU‑only / no‑aggregator / confidential→local.
- Router nie wybiera modelu spoza policy nawet w fallbackach.
- SuperAdmin widzi “coverage gaps” per org i per purpose.

