# AI LLM Operating System v3 (SSOT)

> **Status:** SSOT (target state v3)  
> **Cel:** opisać *idealny, kompletny system pracy LLM‑ów* w Consultify: od podłączenia providerów, przez routing “best model for task” (jakość/koszt/compliance), po kontekstowość czata, monitoring, testy i operacje.  
>
> Dokument opisuje **cel idealny**. Sekcje mają adnotacje **As‑is** (co już jest) oraz **To‑build** (co trzeba dopiąć), ale kontrakt jest jeden: **tak ma działać V3**.

---

## 0) Powiązane SSOT (MUST)

- Model registry + providers/models + assignments: `docs/product/MODEL_REGISTRY_V3.md`
- Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- Provider/residency policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
- Pricing & cost controls: `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
- Market updates (OpenRouter): `docs/product/modules/ai/AI_MARKET_UPDATE_STANDARD_V3.md`
- Agent orchestration: `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- Deep Research + Evidence Ledger: `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- Platform readiness audit (as‑is vs to‑build): `docs/product/modules/ai/AI_PLATFORM_READINESS_AUDIT_V3.md`
- Propose→accept program contract: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`

---

## 1) Zasady kanoniczne (non‑negotiable)

1) **Purpose‑based routing**: system wybiera model przez `purpose` (stabilny kontrakt), nigdy przez “model id w UI”.  
2) **Agent ≠ model**: workflow (agent/step) wybiera model per krok przez `purpose`, a nie “jeden model na wszystko”.  
3) **Governance by default**: zgodność region/provider_type/origin/data_class jest egzekwowana zawsze, również w fallbackach.  
4) **Health‑gated**: `unhealthy` nie trafia do routingu; degradacja jest jawna i mierzalna.  
5) **Cost‑aware**: koszt liczony per request i per purpose, z historycznym price snapshot; system ma soft cap (degraded mode), nie hard‑cut.  
6) **Propose→accept**: AI nie zapisuje prawdy w domenie bez akceptacji użytkownika.  
7) **No chain‑of‑thought**: UI może pokazać “flow pracy” i “reasoning highlights” high‑level, ale nie ujawnia chain‑of‑thought.  
8) **Context‑aware**: AI działa kontekstowo (screen/project/org/history), ale z privacy gates (private mode + retention).

---

## 2) Warstwy platformy (SuperAdmin → Admin → User)

### 2.1 SuperAdmin (platform)

**Co musi mieć SuperAdmin (kontrakt):**

- **Provider/Model registry**:
  - dodawanie/edycja providerów i modeli (`llm_providers`)
  - metadane enterprise (kind/provider_type/origin/execution_regions/allowed_data_classes)
  - brak wycieku sekretów do UI
- **Purpose registry + assignments**:
  - katalog `ai_purposes`
  - łańcuchy assignmentów (global i org‑level)
- **Health & monitoring**:
  - testy “live” na żądanie (minimalny ping/auth check)
  - monitoring ciągły (sentinel) + timeline incydentów
- **Pricing & cost controls**:
  - price snapshots (wersjonowane)
  - markup (platform margin)
  - budżety org + alerty 80/90/100
  - soft cap degraded routing
- **Market update (OpenRouter)**:
  - snapshots + inbox diff + apply workflow (z audytem)
- **Preset “recommended v3”**:
  - jednym kliknięciem: fast/deep/image + seed purposes + assignments

**As‑is (jest / referencje):** patrz powiązane SSOT powyżej.  
**To‑build:** brakujący “coverage report per org” (czy każdy purpose ma dopuszczalny model po filtrach policy).

### 2.2 Admin (organizacja)

**Co musi mieć Admin (kontrakt):**

- **Org AI policy (routing)**:
  - allow/deny: region/provider_type/origin_vendor
  - data class rules (np. confidential→local)
  - purpose overrides (wyjątki)
  - coverage report: “czy polityka nie blokuje krytycznych purpose”
- **Dostępność modeli dla org**:
  - enable/disable poszczególnych wpisów registry dla organizacji (compliance/koszt)
  - opcjonalne custom priority per org
- **Org limits**:
  - miesięczny budżet
  - limity użycia AI (calls/tokens) wg flow
- **Proactivity bounds**:
  - maksymalny poziom autonomii AI w org (advisory→autopilot)

**As‑is:** org enable/disable providerów i org policy istnieją; trzeba je ujednolicić w jednym “Org AI Policy & Availability” panelu (UI/SSOT).

### 2.3 User (per‑user runtime)

**Co musi mieć user (kontrakt):**

- **Runtime controls**:
  - tier (BUDGET/STANDARD/PREMIUM/REASONING)
  - tryby: deepResearch, webSearch, multiAgent, coThinker, privateMode, showReasoning
  - responseStyle + custom instructions
- **Privacy**:
  - memory on/off
  - retention mode (session/extended/none)
  - private mode default

**Zasada:** user może preferować styl i “poziom”, ale **nie może omijać** org policy i health gating.

---

## 3) Kanoniczne kontrakty danych (minimum)

### 3.1 Registry (providers/models)

`llm_providers` zawiera (minimum):

- `id`, `name`, `provider`, `model_id`, `endpoint`
- `kind`: `TEXT_LLM|IMAGE_MODEL|BUSINESS_MODEL`
- enterprise metadata: `provider_type`, `origin_vendor`, `execution_regions[]`, `allowed_data_classes[]`
- `is_active`, `priority`, `tier` (dla TEXT routing)
- `health_status`, `last_health_check`
- pricing controls: `markup_multiplier` (oraz price snapshots w osobnym module)

### 3.2 Purpose registry + assignments

- `ai_purposes(purpose, kind, default_tier, requirements, description, is_active)`
- `ai_purpose_assignments(organization_id?, purpose, provider_id, model_id?, priority, is_active)`
- `organization_ai_policy(organization_id, policy_json)`

### 3.3 Metering i audyt

- `ai_usage_logs` zapisuje:
  - `purpose`, `kind`, `provider`, `model_id`, `status`, `latency_ms`
  - `price_snapshot_id`, `estimated_cost_usd`
- `model_audit_log` dla zmian konfiguracyjnych
- health events + incidents timeline

---

## 4) Routing: jak system wybiera model (idealny algorytm)

Wejście: `resolveModel({ organizationId, userId, purpose, requirements, dataClass, uiHints })`

### 4.1 Filtry kandydatów (MUST)

Kandydaci pochodzą z:

1) org override assignments (jeśli są)
2) global assignments (fallback chain)
3) tier chain (legacy/compat) jeśli purpose routing nie ma pokrycia

Następnie filtrujemy:

1) **kind + requirements** (vision/tools/structured outputs/context window)  
2) **org policy** (region/provider_type/origin/data_class)  
3) **org availability** (is_enabled_for_org)  
4) **health gating** (`healthy|degraded` OK; `unhealthy` odpada)  

### 4.2 Wybór “best” (MUST)

Scoring (ideal):

- podstawą jest **quality tier** dla purpose (np. deep research synthesis → REASONING)
- preferuj:
  - niską latencję dla interakcyjnych purpose
  - niższy koszt dla non‑critical gdy soft cap aktywny
  - direct vendor gdy org zakazuje agregatorów
  - region zgodny z polityką
- fallback zawsze w obrębie dopuszczalnych kandydatów

### 4.3 Degraded mode (soft cap)

Jeśli spend % budżetu przekracza threshold:

- non‑critical purposes → BUDGET tier
- ograniczenie iteracji (mniej follow‑ups, mniej obrazów)
- batch zamiast realtime, jeśli to możliwe

---

## 5) Model lifecycle: procedury (SuperAdmin)

### 5.1 Onboarding nowego providera/modelu

Procedura (MUST):

1) Dodaj wpis `llm_providers` (kind + endpoint + model_id + metadata)  
2) Przetestuj połączenie (auth + minimalny ping)  
3) Ustaw health monitoring (sentinel)  
4) Dodaj price snapshots (lub włącz market sync dla źródła)  
5) Przypisz do tierów/purposes (fallback chain)  
6) Uruchom smoke: provider connectivity + purpose coverage  
7) Dopiero wtedy włącz `is_active=true` i (opcjonalnie) `is_default=true`

### 5.2 Model deprecation / pricing changes

Procedura (MUST):

- market inbox wykrywa zmianę → review → apply → tworzymy nowe price snapshot window  
- jeśli model znika / jest deprecated:
  - oznacz w registry jako inactive
  - zaktualizuj assignments (nie zostawiaj “martwych” chainów)
  - odnotuj w audit log

---

## 6) Chat “mądry konsultant”: kontekst + tryby + governance

### 6.1 Kontekstowość (screen/project/org/history)

Kontrakt:

- UI wysyła `projectId` oraz `screenContext` (screen + selected object) oraz `conversationId`
- backend buduje kontekst:
  - warstwy org/project/execution/knowledge/external
  - org/user memory (jeśli allowed)
  - custom instructions

### 6.2 Tryby i intencja

Idealnie system robi:

- **intent classification** (cheap step) → wybór workflow:
  - quick answer
  - deep thinking (confirm gate)
  - deep research (evidence ledger)
  - multi-agent (panel)
  - “execution support” (drafts propose→accept)

### 6.3 Private mode

Kontrakt:

- privateMode wymusza:
  - brak memory injection
  - brak persist wrażliwych snippetów (tylko referencje/hashes)
  - ograniczenie external web (wg policy)

---

## 7) Deep Research (ideal) — jako system jakości (nie tylko web search)

SSOT: `AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`

Minimum V3:

- Evidence Ledger: Claim → EvidenceSnippet
- Coverage report + stopping criteria
- Contradictions
- Research Viewer UX (TOC + sources + claims panel)
- Export (MD baseline; PDF/DOCX jeśli generator dostępny)

---

## 8) Monitoring + testy + DoD release (ideal)

### 8.1 Monitoring

- Provider Sentinel: health status + events
- Incidents timeline
- Budget alerts
- Quality metrics:
  - citation coverage %
  - unsupported claim rate
  - contradiction rate
  - calibration curves

### 8.2 Testy (minimalny zestaw)

- smoke: `smoke:ai:providers` (connectivity + purpose coverage)
- contract: deep research ledger (synthetic inputs)
- e2e: chat + tools menu + confirm gate + tier selection + context propagation

### 8.3 DoD V3 (global)

- Każdy request AI ma `purpose` i jest liczony kosztowo per purpose.
- Org policy i org availability są egzekwowane zawsze (również w fallback).
- User runtime controls działają, ale nie omijają polityk.
- Monitoring działa bez ręcznej interwencji, a SuperAdmin widzi problemy (health/cost/coverage).
- Deep Research ma SSOT + wdrożeniowy plan (ledger/viewer/metrics).

