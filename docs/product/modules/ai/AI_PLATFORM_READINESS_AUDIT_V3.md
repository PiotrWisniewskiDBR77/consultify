# AI Platform Readiness Audit v3 (SSOT)

> **Status:** Living SSOT checklist (v3)  
> **Cel:** jedno miejsce, które odpowiada na pytanie: *“czy cała logika LLM (SuperAdmin→Admin→User) jest wdrożona, zabezpieczona i opisana tak, żeby domknąć V3 bez luk?”*  
>
> Ten dokument jest “kompasem” przed finalnym programem wdrożeniowym V3: pokazuje **as‑is** vs **to‑build**.

---

## 1) Warstwy kontroli: SuperAdmin → Admin → User (kanon)

### 1.1 SuperAdmin (platform)

**MUST (doc + implementacja):**
- registry providerów i modeli (TEXT/IMAGE/BUSINESS) bez wycieku sekretów,
- routing przez `purpose` + assignments,
- health monitoring (cache + live),
- pricing registry + price snapshots + markup,
- market sync (OpenRouter) + inbox apply,
- preset “recommended v3” (fast/deep/image).

**As‑is (wdrożone):**
- `GET/POST/PUT/DELETE /api/llm/providers` (**SUPERADMIN** na mutacje)
- sanitize secrets w odpowiedziach
- Provider Sentinel + health events
- `POST /api/llm/presets/v3/recommended`
- market sync + inbox apply
- cost logging `estimated_cost_usd` + soft cap degraded routing + alerty budżetu

**SSOT:**
- `docs/product/MODEL_REGISTRY_V3.md`
- `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
- `docs/product/modules/ai/AI_MARKET_UPDATE_STANDARD_V3.md`
- `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`

### 1.2 Admin (organizacja)

**MUST:**
- org‑level policy: allow/deny (region/provider_type/origin/data_class),
- org‑level dostępność modeli (enable/disable wpisów registry dla org),
- budżety/limity i proactivity bounds,
- coverage report: czy każdy `purpose` ma dopuszczalne pokrycie.

**As‑is (wdrożone / dostępne):**
- org provider enablement:
  - `organization_provider_settings`
  - `POST /api/llm/providers/organization/toggle`
  - `GET /api/llm/providers` wzbogacone o `is_enabled_for_org`
- org AI policy (enterprise): `organization_ai_policy` (routing layer)
- admin AI settings (legacy/behavior): `/api/ai-settings/org/:orgId` (proactivity + feature toggles)

**Ryzyko / uwaga (MUST doprecyzować w V3 final):**
- mamy **dwie** warstwy polityk “org”:  
  - **enterprise routing policy**: `organization_ai_policy` (modelRouter)  
  - **behavior/proactivity settings**: `ai-settings` (AISettingsService)  
  W V3 musimy jawnie opisać precedencję i zakres (routing vs UX/behavior).

### 1.3 User (per-user)

**MUST:**
- użytkownik ma kontrolę runtime (tier, tryby, styl), bez omijania polityk org,
- prywatność: private mode + retention + memory on/off,
- custom instructions (persistowane) i response style.

**As‑is (wdrożone):**
- Chat runtime:
  - `selectedTier` / `selectedModelId` wysyłane do backendu (routing)
  - `aiModes` (deepResearch/webSearch/multiAgent/coThinker/privateMode/…)
  - `responseStyle`
- Custom instructions:
  - `PUT /api/ai-memory/custom_instructions`
  - wstrzykiwanie instrukcji w `AIPipeline.buildContext` (gdy memory read allowed)
- Contextualization:
  - UI wysyła `projectId` + `screenContext` (current screen + selected object)
  - backend buduje kontekst przez `AIContextBuilder` + memory

---

## 2) Routing: “best model for task” vs koszt (czy system decyduje?)

**As‑is (wdrożone):**
- routing per `purpose` (enterprise) + purpose assignments + tier fallback chains
- health gating (omija `unhealthy`)
- degraded routing (soft cap) → tańsze tiery dla non‑critical purposes
- metering per request i koszt (price snapshot + markup)

**MUST (DoD przed V3 final):**
- org policy enforcement (region/provider_type/origin/data_class) jest twarde (no bypass)
- coverage validation: każdy aktywny purpose ma ≥1 dopuszczalny model

---

## 3) “Czy AI odpowiada mądrze?” — chat & kontekst

**As‑is (wdrożone):**
- Confirm gate dla Deep Thinking (redukcja błędnych interpretacji i kosztów)
- AIContextBuilder 6‑layer (org/project/execution/knowledge/external + PMO snapshot)
- memory + custom instructions injection (z privacy gates)
- tryby konsultingowe (CoThinker) + multi‑agent (Decision Room)

**Brakujące (to‑build / doc tasks):**
- jawny “intent classification” (automatyczne rozpoznanie potrzeby: diagnoza vs research vs wykonanie) jako osobny purpose/step
- Evidence Ledger jako produkt jakości (Claim→Evidence snippets) dla deep research (SSOT poniżej)

---

## 4) Deep Research (best-in-class) — status

**As‑is (wdrożone):**
- deep research engine (web + iterative deepening) i DT orchestration

**To‑build (wyspecyfikowane, niezaimplementowane w całości):**
- Evidence Ledger (Claim→EvidenceSnippet) + Coverage + Contradictions + Research Viewer UX

**SSOT:** `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`

---

## 5) Automated verification (czy wiemy, że integracje działają?)

**As‑is (wdrożone):**
- smoke: `npm run smoke:ai:providers` (provider connectivity + purpose coverage)
- Provider Sentinel (ciągły monitoring + events)

**To‑build (plan):**
- smoke: `smoke:ai:research-ledger` (contract Claim→Evidence + citation coverage)

---

## 6) Final DoD (przed “ostateczną budową V3”)

- SuperAdmin→Admin→User surfaces są spójne (UI ↔ API ↔ routing).
- User runtime controls nie omijają org policy i health gating.
- Monitoring: health + incidents + budget alerts działają bez ręcznego odpalania.
- Dokumentacja SSOT ma **jawny status**: as‑is vs to‑build i linki do artefaktów.

