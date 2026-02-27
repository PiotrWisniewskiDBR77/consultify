# AI Deep Research + Evidence Ledger System v3 (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** zbudować w Consultify “deep research” na poziomie best‑in‑class (2026) **i lepiej**: wiarygodny, audytowalny, osadzony w kontekście organizacji/projektu, zamykający pętlę od researchu do decyzji i egzekucji.  
>
> **Najważniejsza różnica vs rynek:** zamiast „raport + lista linków”, system tworzy **Evidence Ledger**: jawne mapowanie **Claim → Evidence (snippet)** + coverage + sprzeczności.
>
> **Powiązane SSOT (MUST):**
> - Agent orchestration: `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
> - Purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
> - Model registry: `docs/product/MODEL_REGISTRY_V3.md`
> - Pricing & cost controls: `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
> - Provider/residency policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
> - Program contract propose→accept: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
>
> **As‑is code references (anchor points):**
> - Deep Research engine (web, iterative deepening): `server/src/services/ai/deepResearchService.ts`
> - Tavily adapter (raw_content + answer): `server/src/services/ai/tavilyWebSearchService.ts`
> - Deep Thinking orchestration + research visibility: `server/src/services/ai/deepThinkingOrchestrator.ts`
> - Deep Thinking confirm gate: `POST /api/ai/chat/confirm` w `server/src/routes/ai.routes.ts`
> - Conversation-scoped doc approvals: `POST /api/ai/documents/:id/approve` w `server/src/routes/ai.routes.ts`
> - Attachments ingest → RAG chunks: `POST /api/ai/attachments/ingest` w `server/src/routes/ai.routes.ts`
> - Confidence calibration service (as‑is; do dopięcia w pipeline): `server/src/services/ai/confidenceCalibrationService.ts`
> - CoThinker mode prompts (as‑is): `server/src/services/ai/coThinkerService.ts`

---

## 1) Kontekst rynkowy (2026) — baseline, który musimy spełnić

Rynek (ChatGPT Deep Research / Claude Research / Gemini Deep Research / Perplexity‑style) zbiega się do standardu:

1) **Wieloetapowy research run** (minuty, nie sekundy), z planem i postępem.  
2) **Raport jako dokument**: TOC, sekcje, cytowania, eksport (MD/PDF/DOCX).  
3) **Źródła są klikalne** i mają wspierać weryfikację.  
4) **Retrieval‑centric**: do kontekstu trafiają tylko relewantne fragmenty.  

Największa znana słabość rynku: **citation accuracy** (źródła są, ale nie zawsze wspierają zdania).  
W Consultify V3 rozwiązujemy to przez **Evidence Ledger** (Claim → Evidence Snippet).

---

## 2) Zasady kanoniczne (MUST)

1) **Evidence‑first**: każdy istotny claim w raporcie jest jawnie powiązany z dowodem (snippet), albo oznaczony jako assumption.  
2) **Separation**: system zawsze rozdziela:
   - **Facts (supported)**,
   - **Estimates (method + inputs)**,
   - **Assumptions (explicit)**,
   - **Open questions / missing data**.
3) **No chain-of-thought**: UI pokazuje **proces** (plan, kroki, coverage, reasoning highlights high‑level), ale nie ujawnia chain‑of‑thought.  
4) **Governance by default**: internal źródła wymagają uprawnień + (opcjonalnie) conversation-scoped approval; dataClass policy jest egzekwowana w routingu.  
5) **Propose → accept**: research output jest propozycją. Zapis “prawdy” (decyzja, inicjatywy, zadania) wymaga akceptacji.  
6) **Measurable quality**: metryki (coverage, unsupported claims, contradiction rate, calibration) są liczone i widoczne w Admin/SuperAdmin.

---

## 3) System: definicje i obiekty danych (SSOT kontrakt)

### 3.1 `ResearchRun` (jedno uruchomienie deep research)

Minimalne pola:

- `id`, `organization_id`, `user_id`, `project_id?`, `conversation_id?`
- `topic` (oryginalny prompt / zadanie)
- `status`: `running | succeeded | failed | canceled`
- `mode`: `deep_research | deep_thinking_research_addon | market_research`
- `created_at`, `completed_at`
- `budget`: `{ max_cost_usd?, max_minutes?, max_queries?, max_sources? }`
- `policy`: `{ dataClass, allowedSources, allowWeb, allowInternalDocs, privateMode }`
- `plan` (wygenerowany plan researchu — list items)
- `coverage_report` (patrz 3.6)
- `evidence_ledger_id` (patrz 3.4)
- `report_artifact_id` (final doc/markdown/pdf)

### 3.2 `Source` (kanoniczne źródło)

Źródło może być:

- `web` (URL + domain + fetched_at),
- `internal_doc` (knowledge doc / attachment / PMO doc),
- `project_data` (np. KPI snapshots, milestones),
- `user_input` (wypowiedź użytkownika / constraints).

Pola:

- `source_id` (stabilne w ramach runu)
- `type`: `web | internal_doc | project_data | user_input`
- `title?`, `url?`, `domain?`
- `provenance`: `{ provider: 'tavily' | 'rag' | 'manual' | ... }`
- `access`: `{ requiresApproval: boolean, approved: boolean }`
- `content_ref`: `{ snippet_refs[] }` (nie trzymamy “pełnych stron” w UI bez limitów)

### 3.3 `EvidenceSnippet`

Kluczowy obiekt przeciw “fałszywym cytowaniom”. Snippet to **konkretny fragment**, na który można wskazać.

- `snippet_id`
- `source_id`
- `text` (fragment, np. 200–1200 znaków)
- `location`: `{ paragraph?, heading?, page?, offset? }` (best effort)
- `hash` (dedup)
- `retrieved_at`

### 3.4 `EvidenceLedger` (Claim → Evidence)

Ledger jest produktem, nie “meta”.

- `ledger_id`
- `claims[]` (patrz 3.5)
- `sources[]` (reference list)
- `stats`: `{ total_claims, supported_claims, unsupported_claims, assumptions, contradictions }`

### 3.5 `Claim`

- `claim_id`
- `category`: `fact | estimate | assumption | recommendation | risk`
- `text`
- `confidence`: `0..100` (jawne, z regułami)
- `support_level`: `supported | partially_supported | unsupported | assumption_only`
- `evidence_links[]`: lista `{ snippet_id, rationale?, support_strength: 1..5 }`
- `tags[]`: np. `finance`, `market`, `security`, `governance`

### 3.6 `CoverageReport`

Coverage to odpowiedź na pytanie: **czy przeszukaliśmy to, co trzeba, i dlaczego kończymy?**

- `questions[]`: `{ q_id, question, status: open|covered|blocked, notes?, supporting_claim_ids[] }`
- `gaps[]`: `{ gap_id, description, why_it_matters, how_to_close }`
- `stopping_criteria`: `{ reason, marginal_value_estimate?, next_best_queries? }`
- `domain_distribution`: `{ domain, count_sources }[]`
- `conflict_summary`: `{ contradiction_id, short }[]`

### 3.7 `Contradiction`

- `contradiction_id`
- `topic_area`
- `statements[]`: `{ claim_text, snippet_id }[]`
- `resolution_status`: `unresolved | resolved | needs_more_data`
- `resolution_note`

### 3.8 Output packs

Deep research **MUST** kończyć się “packami” (propose→accept):

1) **Decision Pack**:
   - problem framing
   - options
   - recommendation + boundary conditions
   - risks
   - early signals
   - references: claim ids
2) **Execution Pack**:
   - initiatives/tasks (proposed)
   - owners (role hints)
   - timeline slices
   - metrics to track

---

## 4) Workflow (end‑to‑end) — kanoniczny przebieg

### 4.1 Stage 0: Confirm Understanding (blocking gate)

MUST:

- parafraza celu
- constraints
- expected output type
- minimalne pytania brakujące
- research plan items (conceptual frameworks / prior patterns / user inputs / external refs / org context)

As‑is: `POST /api/ai/chat/confirm` (structured output).

### 4.2 Stage 1: Research Plan + Policy binding

System ustala:

- dataClass (`no_pii|pii|confidential`)
- allowed sources (web/internal/project/user)
- privateMode (zakaz pamięci/org injection, brak zapisu fragmentów)
- domain allow/deny list (opcjonalnie; enterprise)

### 4.3 Stage 2: Acquisition (sources)

Źródła dzielą się na:

- **External web** (Tavily): iterative deepening, pełna treść w granicach limitów.
- **Internal docs** (RAG): attachments ingest, knowledge_docs, chunk retrieval.  
- **Project data**: tylko “facts”, bez generowania nowych liczb.

Governance MUST:

- `requires_approval` docs: tylko po explicit approve dla konwersacji (as‑is endpoint).
- log: jakie docs zostały użyte (trace).

### 4.4 Stage 3: Retrieval → Evidence Snippets

MUST:

- tylko fragmenty (snippets) trafiają do kontekstu syntezy (retrieval‑centric)
- dedup (hash + URL)
- entity resolution (best effort): ta sama firma/produkt = jeden byt

### 4.5 Stage 4: Claims extraction + ledger build

MUST:

- najpierw claims, potem narracja
- każdy claim ma support_level i evidence links (snippet ids)
- brak evidence → claim oznaczony jako assumption/unsupported

### 4.6 Stage 5: Contradiction analysis

MUST:

- wykryj sprzeczne stwierdzenia (np. różne liczby daty)
- zaproponuj rozwiązanie: “które źródło jest bardziej wiarygodne” albo “jakie dane domkną”

### 4.7 Stage 6: Synthesis (report doc)

Raport ma:

- TOC
- sekcje (Executive summary, Findings, Numbers, Risks, Recommendations, Next actions)
- inline cytowania: `[n]` (mapowane do sources)
- “Facts vs Assumptions” jako osobna sekcja
- “What sources disagree on”

### 4.8 Stage 7: Export + Persist (artifacts)

MUST:

- export MD (baseline)
- export PDF/DOCX (po stronie generatora dokumentów)
- zapis: ResearchRun + EvidenceLedger + CoverageReport + Decision/Execution packs (proposals)

---

## 5) UX surfaces (App / Admin / SuperAdmin)

### 5.1 Research Viewer (app)

Wymagania UX:

- lewy panel: TOC
- główny panel: report (narracja)
- prawy panel: **Sources** + **Claims/Evidence** (toggle)
- klik w cytowanie `[n]` → źródło + snippet highlight
- klik w claim → lista evidence snippets + support_level + confidence

### 5.2 Coverage & gaps

Panel pokazuje:

- “covered questions”
- “open questions”
- “blocked by missing data”
- stopping criteria + next best queries

### 5.3 Contradictions

Oddzielna karta:

- lista sprzeczności
- status resolution
- przycisk “request missing data” (wygeneruj pytania do usera)

### 5.4 Actions (propose→accept)

Po raporcie user ma akcje:

- “Save as decision” (DT decision memory)
- “Create initiatives” (proposed)
- “Create tasks” (proposed)
- “Add to watchlist / refresh monthly”

### 5.5 Admin/SuperAdmin (quality/ops)

Widzimy:

- unsupported claim rate (per purpose/model/provider)
- citation coverage %
- contradiction rate
- average time to complete
- calibration curves (confidence vs correctness)

---

## 6) Model routing (purposes) — wymagania kontraktowe

Deep research to nie “jeden model call”. To chain kroków:

1) `deep_research_plan` (structured output preferowane)
2) `deep_research_claims_extract` (structured output: claims + snippet refs)
3) `deep_research_synthesis` (long context, citations)
4) `deep_research_contradictions` (structured output)
5) `deep_research_export_polish` (krótkie, tanie iteracje)
6) `deep_research_quality_gate` (review)

**MUST:** każdy krok ma `purpose` i telemetrykę kosztu/latency.

Szczegóły enumów i requirements: `AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md` (do aktualizacji).

---

## 7) Governance & compliance (must-have)

1) **Source allowlist / denylist** per org (dla regulated).  
2) **Conversation-scoped approvals** dla dokumentów “requires approval” (as‑is endpoint).  
3) **Data class enforcement**: `confidential` nie może iść do providerów bez attestation (residency policy).  
4) **Private mode**:
   - brak memory injection,
   - brak persist snippet text (można persist hash+ref),
   - brak web search jeśli polityka.

---

## 8) Quality metrics (SSOT) + DoD wdrożenia

### 8.1 Metryki

- **Citation coverage %** = supported claims / total claims  
- **Unsupported claim rate** = unsupported claims / total claims  
- **Assumption explicitness** = assumptions with explicit label / assumptions total (target 100%)  
- **Contradiction resolution rate** = resolved contradictions / all contradictions  
- **Calibration error** (MAE) per bucket (confidence calibration)
- **Refresh drift delta rate**: liczba istotnych zmian / okres (watchlist) + czas do wykrycia

### 8.2 DoD (V3)

MUST:

- ResearchRun tworzy EvidenceLedger + CoverageReport (dla deep research mode).
- UI pozwala sprawdzić dowody (snippets) dla claimów.
- Raport rozdziela facts vs assumptions.
- System wykrywa i raportuje sprzeczności (min. heurystycznie).
- Export MD działa; PDF/DOCX w backlog jeśli brak generatora dokumentów.
- Propose→accept: żadna zmiana danych domenowych bez akceptacji.
- Admin ma dashboard metryk jakości researchu.
- Confidence calibration jest operacyjne:
  - model raportuje confidence jawnie (0–100) dla kluczowych sekcji/claimów,
  - user/admin może oznaczyć “was correct” dla kalibracji,
  - routing/flow może reagować na niską pewność (np. prosić o dane / dodać follow‑up research).

---

## 9) Minimalne zadania wdrożeniowe (zależności)

1) **Nowe tabele/kontrakty** (ResearchRun, EvidenceLedger, Snippets, Coverage, Contradictions).  
2) **Retriever layer**: unify web/internal/project sources → EvidenceSnippets.  
3) **Ledger builder**: claims extraction + evidence linking.  
4) **Viewer UI**: report+TOC+sources+claims panel.  
5) **Ops**: metryki + alerty jakości (np. zbyt dużo unsupported).  
6) **Routing/purposes**: seed nowych purposes i przypisań.  
7) **Tests**: contract smoke dla ledger (synthetic), oraz E2E “report viewer + citations”.

