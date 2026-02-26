# AI Model Purposes & Requirements v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** zdefiniować *do czego* system używa modeli (purposes) i *jakie wymagania* musi spełnić model, żeby mógł obsłużyć dany purpose.  
> **Dlaczego:** eliminujemy „wybór modelu w UI” i zastępujemy to stabilnym kontraktem `purpose → routing`.  
>
> **Powiązane SSOT (MUST):**
> - Model Registry v3 (kategorie i assignments): `docs/product/MODEL_REGISTRY_V3.md`
> - Operating model v3 (moduły i flow): `docs/product/OPERATING_MODEL_V3.md`
> - AI usage & limits (quota/billing): `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`
>
> **As‑is code references (MUST keep compatible):**
> - capability→tier routing: `server/src/services/ai/modelRouter.ts`
> - provider config SSOT: `server/src/services/ai/llmConfigService.ts`
> - provider calls + guards: `server/src/services/ai/llmService.ts`
> - SuperAdmin tiers UI: `src/components/SuperAdmin/ModelTierAssignments.tsx`

---

## 1) Definicje (kanon)

### 1.1 `kind` (z `MODEL_REGISTRY_V3.md`)

- `TEXT_LLM`
- `IMAGE_MODEL`
- `BUSINESS_MODEL` (domenowe engine’y / LM-y, np. LeanLM)

### 1.2 `purpose` (kanoniczny wybór modelu)

System **zawsze** wybiera model przez `purpose`, nigdy przez “model id” w kodzie UI.

`purpose` to stabilny enum używany w API/telemetryce/routingu.

### 1.3 `requirements` (kontrakt minimalny)

Każdy purpose ma wymagania (`ModelRequirements`):

- **modalities**: text / vision / image output
- **tools**: czy wolno/konieczne jest tool use (MCP / function calling)
- **context window**: minimalne okno
- **latency**: maksymalna latencja (dla interakcji)
- **output contract**: np. JSON schema (generateObject) vs tekst
- **data class**: `no_pii | pii | confidential` (polityki w osobnym SSOT)

---

## 2) Purpose catalog (v3) — kanoniczna lista

> Ta lista jest “default set” dla v3. Może rosnąć, ale usuwanie/zmiana semantyki jest breaking.

### 2.1 Chat (interakcyjny)

- `chat_simple`  
  - **kind:** `TEXT_LLM`  
  - **default tier:** `BUDGET`  
  - **requirements:** low latency, bez narzędzi, brak dużego kontekstu  
  - **typowe użycia:** szybkie Q&A, krótkie rekomendacje

- `chat_complex`  
  - **kind:** `TEXT_LLM`  
  - **default tier:** `STANDARD`  
  - **requirements:** lepsze rozumowanie, większy kontekst

- `chat_confirm`  
  - **kind:** `TEXT_LLM`  
  - **default tier:** `BUDGET`  
  - **requirements:** deterministyczny styl, krótkie odpowiedzi, preferowane JSON (opcjonalnie)

### 2.2 Consulting Tools / Assessments (workflow)

- `tool_recommendation`  
  - rekomendacja narzędzia w module Tools (propose→accept)

- `session_missing_items`  
  - “braki” jako checklista (deterministyczny format; najlepiej JSON)

- `session_summary`  
  - streszczenie sesji (wymaga spójności i traceability)

- `assessment_explain`  
  - wyjaśnienia wyników/licencji/metodyki (zwiększone wymagania jakości)

### 2.3 Initiatives / Governance

- `validate_initiative`  
  - walidacja inicjatywy (spójność, kompletność, ryzyka)

- `governance_risk_scan`  
  - skan ryzyk i propozycje mitigacji (nie zmienia danych, tylko proponuje)

- `build_roadmap`  
  - synteza planu wdrożenia / roadmap (często większy kontekst)

### 2.4 Results (KPI/ROI) — AI tylko jako “insights”

- `results_anomaly_insights`  
  - AI sugeruje anomalie i pytania, nie edytuje danych (zgodnie z `RESULTS_SURFACES_UX_V3.md`)

- `results_report_draft`  
  - draft tekstu do raportu KPI/ROI (propose→accept)

### 2.5 Reports & Presentations (generatory)

- `report_section`  
  - generowanie sekcji raportu (JSON/structured output mile widziane)

- `full_report`  
  - generowanie pełnego raportu (większy budżet, większe okno)

- `deck_outline`  
  - outline slajdów + narracja

- `deck_copy_polish`  
  - polish językowy, krótkie iteracje

### 2.6 Vision (image input → text)

- `vision_extract`  
  - ekstrakcja danych z obrazu (OCR-ish / opis / interpretacja)
  - **requirements:** `needsVision=true`

- `vision_compare`  
  - porównanie 2+ obrazów (np. before/after)

### 2.7 Image generation/edit (text/image → image)

- `image_cover`  
  - okładki (karty, raporty, decki)

- `image_diagram`  
  - diagramy/ilustracje narzędzi (preview assets)

- `image_slide_asset`  
  - assety slajdów (ikony/ilustracje)

### 2.8 Business models (domenowe engine’y)

- `lean_suggestions`
- `waste_detection`
- `process_optimization`

> **Uwaga:** BUSINESS_MODEL może być LLM-em albo deterministycznym engine’em. Routing i telemetryka nadal idą przez `purpose`.

---

## 3) Backwards compatibility: `capability` (as‑is) → `purpose` (v3)

W kodzie istnieją `CAPABILITY_TIERS` i wywołania oparte o `capability`. W v3:

- **MUST:** `capability` staje się aliasem do `purpose` (mapa 1:1 lub 1:N).
- **MUST:** telemetryka kosztów i limity liczą się per `purpose` (capability tylko pomocniczo).

Przykładowe mapowanie (do doprecyzowania w implementacji):

- `chat_simple` → `chat_simple`
- `chat_complex` → `chat_complex`
- `report_section` → `report_section`
- `full_report` → `full_report`
- `assessment` → `assessment_explain`
- `vision` → `vision_extract`
- `validateInitiative` → `validate_initiative`
- `generateInsights` → `results_anomaly_insights`
- `buildRoadmap` → `build_roadmap`

---

## 4) Routing rules (kontrakt)

### 4.1 Wejście routingu

`resolveModel({ organizationId, purpose, requirements, options })`

### 4.2 Kroki selekcji (kanon)

1) **Org override** (jeśli istnieje i spełnia requirements)  
2) **Purpose assignments** (priorytety + health gating)  
3) **Tier routing** (dla TEXT_LLM: tier z purpose) + round‑robin + fallback chain  
4) **Ultimate fallback** (tylko jeśli polityka org pozwala)  
5) Brak kandydata → **jawny błąd + alert SuperAdmin**

---

## 5) DoD (Definition of Done) — dla doc/spec

- Każdy nowy feature AI w v3 wybiera model przez `purpose`.
- Każdy `purpose` ma: kind, default tier (jeśli dotyczy), requirements, oraz telemetrykę.
- SuperAdmin ma widok katalogu purpose i przypisań.
- `capability` pozostaje wspierane jako alias, ale nie jest SSOT.

