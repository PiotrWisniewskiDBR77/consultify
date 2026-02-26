# Model Registry v3 — Text / Image / Business Models, Assignments, SuperAdmin (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** uporządkować “podłączenie modeli” w Consultinity tak, żeby było:
> - bezpieczne (brak sekretów w UI, audyt),
> - elastyczne (różne orgi mogą mieć różne ustawienia),
> - szczelne kosztowo (limity, fallbacki, health),
> - zrozumiałe w SuperAdmin (co jest do czego).

## 0) Powiązane źródła prawdy (MUST)

- LLM routing + tiers + capability mapping (as‑is): `server/src/services/ai/modelRouter.ts`
- LLM provider config & admin routes (as‑is): `server/src/routes/llm.routes.ts`
- SuperAdmin model tier assignments (as‑is UI): `src/components/SuperAdmin/ModelTierAssignments.tsx`
- AI usage limits & billing: `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`
- Image generation service (as‑is): `server/src/services/ai/imageService.ts`
- AI purposes & requirements (v3 SSOT): `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- AI provider/residency policy (v3 SSOT): `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
- AI pricing & cost controls (v3 SSOT): `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
- AI agent orchestration (v3 SSOT): `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- AI market update standard (v3 SSOT): `docs/product/modules/ai/AI_MARKET_UPDATE_STANDARD_V3.md`
- AI API keys checklist (v3 SSOT): `docs/product/modules/ai/AI_API_KEYS_CHECKLIST_V3.md`

---

## 1) Problem

Dzisiaj “modele” są rozproszone:

- LLM (text) są routingowane przez tiers/capabilities,
- generacja obrazów ma osobny serwis,
- brakuje jednej kanonicznej warstwy: **jakie modele mamy, do czego służą, jakie są fallbacki, i gdzie to widać w SuperAdmin**.

W v3 dokładamy też trzecią kategorię: **Business Models** (np. “LeanLM” / domenowy LM), czyli modele/engine’y o logice biznesowej, nie tylko “tekst/obraz”.

---

## 2) Kanoniczne kategorie modeli (MUST)

Każdy “model” w systemie ma `kind`:

1) **TEXT_LLM** — generacja/analiza tekstu, chat, raporty, wnioski (tiered routing).
2) **IMAGE_MODEL** — generacja/edycja grafik (raporty/prezentacje, cover cards).
3) **BUSINESS_MODEL** — domenowe engine’y/LM (np. LeanLM) wspierające konkretne metodologie.

**MUST:** w UI i w API używamy stabilnych enumów, nie “opisów w tekście”.

---

## 3) Assignments: “model → purpose” (MUST)

Modele nie są wybierane “ręcznie” per ekran, tylko przez **assignments**:

- `purpose` (do czego): np. `chat_simple`, `report_section`, `assessment`, `vision`, `image_cover`, `lean_optimization`
- `requirements` (opcjonalnie): context window, tool use, vision, reasoning level (as‑is już jest `ModelRequirements`).
- `tier` (dla TEXT_LLM): BUDGET/STANDARD/PREMIUM/REASONING (+ VISION)
- fallback chain + health gating

As‑is (TEXT_LLM):

- capabilities → tier: `CAPABILITY_TIERS` w `modelRouter.ts`
- tier assignments i priorytety konfigurowane w SuperAdmin.

To SSOT rozszerza to o:

- IMAGE_MODEL assignments (do jakich funkcji grafiki),
- BUSINESS_MODEL assignments (LeanLM i podobne).

---

## 4) SuperAdmin surfaces (MUST)

### 4.1 Model Providers (catalog)

SuperAdmin ma katalog “Providers/Models” z polami:

- `name`, `provider`, `model_id`
- `kind` (TEXT_LLM / IMAGE_MODEL / BUSINESS_MODEL)
- `is_active`, `health_status`, `cost_per_1k` (jeśli dotyczy)
- “secrets” (API keys) **nigdy nie wracają do UI** (as‑is sanitize już istnieje).

### 4.2 Assignments & routing

SuperAdmin ma 3 konfiguracje:

1) **TEXT_LLM tiers** (as‑is): wiele modeli per tier + priorytety + health
2) **IMAGE_MODEL purposes**: przypisania do “cover/report/presentation assets” + fallbacki
3) **BUSINESS_MODEL purposes**: np. LeanLM → “Lean suggestions”, “waste detection”, “process optimization”

**MUST:** org‑level overrides (opcjonalnie) są jawne i audytowalne.

---

## 5) Governance: audit + safety (MUST)

- każda zmiana konfiguracji modeli jest logowana (kto/kiedy/co),
- health status wpływa na routing (unhealthy nie jest używany),
- brak konfiguracji = jawny błąd + bezpieczny fallback (nie “cicha” degradacja jakości).

---

## 6) Task extraction (do programu)

1) Ujednolicić model katalogu: `kind` + `purpose` assignments (TEXT/IMAGE/BUSINESS)
2) Rozszerzyć SuperAdmin: widok i edycja assignments dla IMAGE i BUSINESS (LeanLM)
3) Dopiąć routing: feature calls wybierają model przez purpose (nie “na sztywno”)
4) Audyt + telemetryka kosztów per purpose (do limitów/billing)

