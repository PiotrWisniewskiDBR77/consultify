# AI Provider APIs — Checklist kluczy, endpointów i pozyskania dostępu (V3)

> **Status:** Draft (v3)  
> **Cel:** jedna lista „jakie API mamy pozyskać” + do czego służy + gdzie jest używane w systemie.  
> **SSOT zależności:** `docs/product/MODEL_REGISTRY_V3.md`, `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`

---

## 1) Minimalny zestaw (P0 / R0) — żeby system działał stabilnie

### 1.1 OpenRouter (TEXT_LLM aggregator — as‑is default)

- **Co pozyskać**: `OPENROUTER_API_KEY`
- **Endpoint (base URL)**: `https://openrouter.ai/api/v1`
- **Po co**: jedno stabilne API do wielu vendorów; as‑is router filtruje na `openrouter` w `ModelRouter.select()`.
- **Gdzie używane**:
  - routing: `server/src/services/ai/modelRouter.ts`
  - provider defs / env sync: `server/src/services/ai/llmConfigService.ts` (allowlist: OpenRouter‑only)
  - calls + guardy: `server/src/services/ai/llmService.ts`
- **Market update**: OpenRouter ma endpoint listowania modeli `GET /api/v1/models` (model katalog + pricing w odpowiedzi) — użyte w dokumencie market update.

### 1.2 Baza i telemetryka kosztów (wewnętrzne — bez zewnętrznych kluczy)

- **Co**: tabele `ai_usage_logs`, `token_usage`, alerting, limity per org
- **Po co**: koszt/limity i kontrola nadużyć; wymagane w v3 (zob. flow).
- **SSOT**: `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`

---

## 2) Zestaw “Direct vendor” (P1 / enterprise readiness)

> Uwaga: te klucze są potrzebne, jeśli klient wymaga **direct** (bez agregatorów) albo rezydencji/kontraktu per vendor.

### 2.1 OpenAI (TEXT + IMAGE)

- **Co pozyskać**: `OPENAI_API_KEY`
- **Endpointy**:
  - **Modele**: `GET https://api.openai.com/v1/models`
  - **Tekst/Responses**: wg SDK/konfiguracji (u Was używacie Vercel AI SDK)
  - **Obrazy**: Images API / Responses tool `image_generation`
- **Po co**:
  - direct compliance (zakaz aggregatorów)
  - image generation `gpt-image-1` (jeśli zdecydujecie się na direct)
- **Market update**: listę modeli można pobierać przez `/v1/models` (ale pricing zwykle wymaga osobnego registry).

### 2.2 Anthropic (TEXT)

- **Co pozyskać**: `ANTHROPIC_API_KEY`
- **Endpoint**:
  - **Modele**: `GET https://api.anthropic.com/v1/models` (wymaga `anthropic-version` header)
- **Po co**: direct vendor dla klientów “no aggregator”, wysokiej jakości generacja, duże okna kontekstu (zależnie od modelu).
- **Market update**: `/v1/models` pozwala synchronizować dostępne modele.

### 2.3 Google (Gemini API / Vertex AI)

- **Co pozyskać**:
  - do Gemini API: `GOOGLE_API_KEY` (w kodzie obsługiwane aliasy: `GEMINI_API_KEY`, itd.)
  - do Vertex AI: konto GCP + uprawnienia + mechanizm auth (zwykle SA / workload identity)
- **Po co**:
  - direct vendor dla multimodal (vision) i enterprise (Vertex)
  - Imagen (jeśli wchodzicie w generację obrazów przez Vertex)
- **Market update**:
  - Vertex ma mechanizmy listowania publisher models (Model Garden) — synchronizacja wymaga GCP auth i regionu.

### 2.4 DeepSeek (TEXT)

- **Co pozyskać**: `DEEPSEEK_API_KEY`
- **Endpoint (base URL)**: `https://api.deepseek.com`
- **Po co**:
  - szybkie i tanie modele do zadań “budget/standard”
  - fallback chain, gdy vendor premium ma awarie
- **Uwagi**:
  - w naszym kodzie DeepSeek jest traktowany jako **OpenAI-compatible** provider (chat/completions)
  - klucze: env lub SuperAdmin (DB) — env ma priorytet dla `deepseek`

### 2.5 z.ai (Zhipu) (TEXT)

- **Co pozyskać**: `ZAI_API_KEY`
- **Endpoint (base URL)**: `https://api.z.ai/api/paas/v4`
- **Po co**:
  - alternatywny vendor do tekstu/vision (w zależności od modeli i regionów)
  - enterprise routing po `origin_vendor`/`execution_regions`
- **Uwagi**:
  - w kodzie traktowany jako **OpenAI-compatible** provider (chat/completions)

---

## 3) Zestaw “Image specialists” (opcjonalne, zależnie od roadmapy obrazów)

### 3.1 Ideogram (IMAGE_MODEL)

- **Co pozyskać**: Ideogram API Key (nagłówek `Api-Key`)
- **Endpoint**: `https://api.ideogram.ai/v1/ideogram-v3/*` (generate/edit/remix/reframe)
- **Po co**: grafiki z czytelną typografią / layout (okładki, slajdy, infografiki).
- **Uwaga**: koszt i region zależą od oferty Ideogram; wprowadzamy do registry jako `provider_type=direct`.

### 3.2 Luma (IMAGE_MODEL)

- **Co pozyskać**: klucz Luma API
- **Po co**: Photon / Photon Flash (szybkie generacje; często korzystne do assetów marketingowych)

### 3.3 Leonardo (IMAGE_MODEL)

- **Co pozyskać**: Leonardo API key
- **Po co**: stylizowane obrazki / concept / warianty kreatywne

---

## 4) Zestaw “Hosted open models / pipelines” (opcjonalne)

### 4.1 fal.ai (IMAGE_MODEL + inne media)

- **Co pozyskać**: fal API key
- **Po co**:
  - dostęp do wielu obrazowych modeli (Flux/Recraft/itd.)
  - **API pricing**: fal udostępnia `GET /v1/models/pricing` (przydaje się do automatycznych aktualizacji kosztów)

### 4.2 Replicate (IMAGE_MODEL / video / niche models)

- **Co pozyskać**: `REPLICATE_API_TOKEN`
- **Po co**:
  - szeroki katalog publicznych modeli
  - API do listowania modeli i wyszukiwania
  - koszty często zależne od modelu/uruchomienia (registry musi to wspierać)

---

## 5) Local / on‑prem (dla klientów z ostrą rezydencją danych)

### 5.1 Ollama (local text/vision — as‑is supported)

- **Co pozyskać**: brak (lokalny endpoint)
- **Endpoint**: zwykle `http://localhost:11434`
- **Po co**: opcja local‑only (dev i niektóre wdrożenia enterprise).
- **Uwaga**: do produkcji rozważamy też vLLM/TGI/NIM (osobny SSOT).

---

## 6) Kontrakty wdrożeniowe (jak pozyskujemy klucze)

- **MUST**: klucze nie wracają do UI (sanity: `sanitizeProviderForStatus` w `server/src/routes/llm.routes.ts`).
- **MUST**: każdy provider ma:
  - health check + latency
  - test capability endpoint (connection/chat/vision/tools/reasoning)
  - powiązanie z kosztami (manual lub API sync)
- **MUST**: dla enterprise przygotować wariant “customer-managed keys” (klucze klienta, nie nasze).

