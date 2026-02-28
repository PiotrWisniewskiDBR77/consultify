# CONSULTIFY_V3_DIGEST — LLM | SYNCHRONIZACJA | ASSESSMENT+KPI | TOOLS (SSOT/backlog)

## Scope

Master digest dla wątku obejmującego 4 obszary:

- **LLM** (provider APIs, health, Model Registry, metering/audit)
- **Synchronizacja/Integracje** (org-level providers, logi, konektory, MCP)
- **Assessment (DRD/SIRI/ADMA)** (licensed tools, workbench parity, evidence discipline, report/deck, initiatives)
- **KPI/Results** (KPI/ROI tracking + deviation action loop)
- **Tools** (mental model Tools hub, wizard standard, Knowledge Bank/RAG jako mechanizm “consultant expert”)

Ten digest scala istniejące digests:

- `docs/product/conversations/V3_DIGEST_LLM.md`
- `docs/product/conversations/V3_DIGEST_SYNC.md`
- `docs/product/conversations/V3_DIGEST_TOOLS.md`
- `docs/product/conversations/V3_DIGEST_ASSESSMENT_KPI.md`

oraz dopina SSOT/gapy z:

- `docs/product/TOOLS_SSOT_SOURCES_V3.md`
- `docs/product/TOOLS_GAP_ANALYSIS_V3.md`
- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- `docs/product/DRD_ASSESSMENT_PACK_V3.md`, `docs/product/SIRI_ASSESSMENT_PACK_V3.md`, `docs/product/ADMA_ASSESSMENT_PACK_V3.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/RESULTS_V3.md`
- `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`

---

## Decisions (hard)

### Tools / Licensed assessments / Workbench

- **Jeden mental model Tools**: Library → Sessions → Outputs → Initiatives (Assessments jako “Licensed methodologies”).
- **DRD-like mechanics jako standard**: center questions/scoring + navigation + graphic mirror.
- **Evidence-first + propose→accept**: AI zawsze proponuje; człowiek akceptuje; brak dowodu = “needs evidence”.

### SIRI / ADMA canon vs runtime

- **SIRI**: kanon metodologii = **16 dimensions**; UI może mieć 8D, ale data layer/export ma zachować 16D i jawne mapowanie.
- **ADMA**: runtime UX = 5 pillars/12 dims, ale kanon outputów = **T1–T7** + **FoF benchmark overlay** (z wagami agregacji).

### KPI / Results

- KPI w Consultify ma być **operacyjne** (nie tylko wykres): progi → deviation case → RCA → action plan → tracking → closure.

### Knowledge Bank / RAG

- Repo `knowledge/tool-kb/**` jest **SSOT** dla wiedzy narzędziowej (curated packs).
- Runtime RAG ma wspierać tool-scoped retrieval (toolSlug/packType/language).
- Docelowo RAG ma działać przez **external provider API** (staging→prod) + pipeline “case learnings” (capture→review→publish).

### LLM / Sync

- Canonical LLM endpoints: `/api/llm/*` (spójność FE↔BE).
- Integracje jako jedna warstwa SSOT: org-level providers + real statusy + logi (bez mocków).

---

## Requirements (MUST)

- **MUST (Assessments)**: DRD/SIRI/ADMA są spójne w pracy (nawigacja, scoring, evidence, mapy, export).
- **MUST (SIRI)**: kanoniczny model 16D musi być zachowany (choćby jako appendix/export + mapping).
- **MUST (ADMA)**: raport/deck pokazuje T1–T7 + FoF overlay + gap to FoF.
- **MUST (KPI)**: progi (Green/Amber/Red) + deterministyczna ewaluacja + auto Deviation Case + wezwanie ownera.
- **MUST (RAG)**: indexing packs (ops endpoint) + tool-scoped retrieval działa deterministycznie.
- **MUST (Sync)**: real statusy, logi i SSOT “gdzie się konfiguruje” (org vs user vs sync hub).
- **MUST (LLM)**: optional provider bez key ≠ unhealthy; Model Registry rządzi routingiem/fallbackami.

---

## Requirements (SHOULD)

- **SHOULD (Assessments)**: UI korzysta bezpośrednio z Tool KB packs (zamiast hard-coded `assessmentKnowledge.ts`).
- **SHOULD (RAG)**: daily/cron auto-index (bez ręcznych ops) + observability indeksu.
- **SHOULD (KPI)**: KPI detail jest “actionable” (CTA na RCA/plan) i wspiera raporty KPI (review cadence).
- **SHOULD (Sync)**: komunikacja ograniczeń (read-only vs bidirectional) w UI jest jednoznaczna.

---

## Open questions (do decyzji / doprecyzowania)

- **SIRI 16D capture**: czy w v3 robimy pełny 16D UI, czy 16D jest importowane/appendix-only (przy 8D runtime)?
- **ADMA FoF**: benchmark jako stała 4.0 czy profil per T (T1..T7 różne)? Czy per branża?
- **KPI periods**: czy okresy w Results są `period_key` (miesiąc/tydzień/kwartał) czy start/end daty (kontrakt i API)?
- **External RAG provider**: jakie minimum technologiczne (pgvector vs zewnętrzny vendor) i jak wygląda tenancy (global packs vs private case docs)?

---

## SSOT impact (co musi być trzymane w spójności)

- `docs/product/V3_IMPLEMENTATION_PROGRAM.md` (task ledger + gating)
- `docs/product/TOOLS_SSOT_SOURCES_V3.md` (kanon źródeł + readiness + gap link)
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` (external RAG contract + case knowledge loop)
- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md` + `*_ASSESSMENT_PACK_V3.md`
- `docs/product/RESULTS_V3.md` + `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`
- `docs/product/TOOLS_GAP_ANALYSIS_V3.md` (single source “code vs SSOT”)

---

## Backlog extraction — propozycje tasków do `V3_IMPLEMENTATION_PROGRAM`

> Źródło gapów: `docs/product/TOOLS_GAP_ANALYSIS_V3.md` + backlogi:  
> `docs/product/ASSESSMENTS_UNIFICATION_IMPLEMENTATION_BACKLOG_V3.md`, `docs/product/RESULTS_KPI_DEVIATION_IMPLEMENTATION_BACKLOG_V3.md`, `docs/product/TOOLS_KNOWLEDGE_BANK_IMPLEMENTATION_BACKLOG_V3.md`

### Tools / Assessments

- **V3-E08 (R1, P0)**: SIRI kanon 16D (data contract + mapping 16→8 + export appendix)
- **V3-E09 (R1, P0)**: ADMA output T1–T7 + FoF overlay + binding initiatives patterns
- **V3-E10 (R1, P1)**: Workbench unification hardening (evidence UI + coach mode bindings + pack-driven prompts)

### Results / KPI

- **V3-H04 (R1, P0)**: KPI Deviation Management (threshold bands + deviation cases + notifications + actionable detail)
- **V3-H05 (R1, P0)**: KPI time-series API contract alignment (FE/BE; period model)

### AI Platform / Knowledge

- **V3-N04 (R2, P1)**: External Knowledge Provider API adapter (staging→prod) + case knowledge capture pipeline
- **V3-N05 (R1, P1)**: Pass tool context automatically to tool-scoped RAG retrieval (no “manual filters” in prompts)

# V3 Digest — LLM | Synchronizacja | Assessment+KPI | Tools (SSOT/backlog)

> **Cel:** digest dla wątku `<LLM | SYNCHRONIZACJA | ASSESSMENT+KPI | TOOLS>`: decyzje, MUST/SHOULD, open questions, SSOT impact, oraz backlog tasków do `docs/product/V3_IMPLEMENTATION_PROGRAM.md`.
>
> **Uwaga:** w repo istnieją osobne digesty per obszar. Ten plik je **scala** i dodaje “cross‑cutting” (spójność platformy).

Powiązane digesty źródłowe:
- `docs/product/conversations/V3_DIGEST_LLM.md`
- `docs/product/conversations/V3_DIGEST_SYNC.md`
- `docs/product/conversations/V3_DIGEST_ASSESSMENT_KPI.md`
- `docs/product/conversations/V3_DIGEST_TOOLS.md`

---

## 1) Decyzje (hard)

### 1.1 LLM / AI Platform

- **Canonical API i spójność FE↔BE**: LLM registry idzie przez `/api/llm/*` (nie `/api/ai/providers`).
- **Optional providers ≠ unhealthy**: brak klucza dla opcjonalnego providera oznacza “nie skonfigurowany/wyłączony”, nie “awaria”.
- **Purpose‑first routing**: wybór modelu przez `purpose` (+ requirements + org policy), nie przez “model id w UI”.
- **Health gating + monitoring**: continuous monitoring + cached health + live test na żądanie.
- **Cost system v3**: price snapshots + metering per purpose + markup + soft cap degraded routing + budget alerts.
- **Nie ujawniamy sekretów**: API keys nigdy nie wracają do UI (sanitize na API).

### 1.2 Synchronizacja / Integracje

- **Jedna warstwa integracji jako SSOT**: integracje są org‑level (system‑of‑record) i mają realne statusy + logi (bez mocków).
- **Sync ma audyt i health**: `last_sync`, `last_error`, `error_count` + log entries.
- **MVP nie udaje pełnego bidirectional**: write‑back/konflikty/kolejki to osobne rozszerzenie (R2/V4), jeśli nie jest wymagane dla go‑live.

### 1.3 Licensed Assessments + KPI/ROI (Results)

- **Assessments = Licensed Tools**: komunikacja modułu jako “licencjonowane metodologie”.
- **Parity**: SIRI i ADMA mają parytet z DRD (questions/scoring/visuals/outputs).
- **Traceability**: outputy z assessmentów mają `source_type=assessment` + `source_id`.
- **KPI/ROI jako dowód dowiezienia**: Results to kontrakt “plan vs realized”, nie tylko dashboard.

### 1.4 Tools

- **Known Tools uczą standardów**: to nie autorskie narzędzia — buduje wiarygodność.
- **Jeden mental model Tools**: Library → Sessions → Outputs → Initiatives (Assessments jako Licensed).
- **Universal Tool Wizard**: wspólny shell + konfigurowalne kroki per toolType.

---

## 2) Wymagania (MUST / SHOULD)

### 2.1 MUST (cross‑cutting)

- **MUST**: każdy AI request wybiera model przez `purpose` i jest mierzony kosztowo per purpose.
- **MUST**: org policy (region/provider_type/origin/data_class) jest egzekwowana również w fallbackach.
- **MUST**: org może wyłączyć modele/provider rows (availability) i routing musi to respektować.
- **MUST**: monitoring działa w aplikacji (health + sentinel + incydenty + alerty budżetu), bez ręcznego “odpalania”.
- **MUST**: kontekst czata obejmuje screen/project/org/history (z privacy gates).

### 2.2 MUST (LLM)

- **MUST**: UI nie może pokazywać “brak LLM” przez błąd endpointów/kontraktu.
- **MUST**: SuperAdmin ma katalog providerów/modeli + preset recommended + test connection.
- **MUST**: coverage: aktywne purposes mają przypisania (co najmniej 1 łańcuch) i system wykrywa luki.

### 2.3 MUST (Sync)

- **MUST**: Integrations Settings pokazuje realne statusy i logi.
- **MUST**: manual trigger “Sync now” min. dla 1 providera (dowód działania).

### 2.4 MUST (Assessment+KPI)

- **MUST**: assessments generują report + deck przez kanoniczne generatory (traceable).
- **MUST**: KPI core: agregacja + add + mapping KPI↔initiative + time series.
- **MUST**: ROI plan vs realized (minimalnie manual realized).

### 2.5 MUST (Tools)

- **MUST**: Tools hub: kategorie + filtrowanie + preview pane.
- **MUST**: Tool session kończy się Outputs (report/deck/draft initiatives) z traceability.

### 2.6 SHOULD (wartościowe, ale negocjowalne)

- **SHOULD**: intent classification (cheap step) → wybór workflow (chat vs deep research vs execution support).
- **SHOULD**: Deep Research Evidence Ledger (Claim→EvidenceSnippet) + viewer + metryki jakości (citation coverage).
- **SHOULD**: Jira bi‑directional z pełnym mappingiem statusów (min. 1 projekt) jeśli klient tego wymaga.
- **SHOULD**: Tool-linked KB assety: thumbnail MUST, micro‑video SHOULD (zależnie od czasu).

---

## 3) Open questions (do zamknięcia przed finalnym backlogiem)

### 3.1 LLM

- Jakie są “P0 purposes” dla coverage report per org (co blokuje go‑live)?
- Jak UI komunikuje: configured vs disabled vs unhealthy vs policy‑blocked (copy + badge)?
- Czy user może robić explicit `selectedModelId` poza local inference (jeśli tak — jak weryfikujemy policy/health)?

### 3.2 Sync

- R1 priorytety: Slack/Teams vs Jira vs Calendar vs Drive — co jest must dla pierwszych klientów?
- Jak komunikujemy w UI zakres sync: read‑only vs bidirectional (żeby nie obiecać za dużo)?

### 3.3 KPI/ROI

- Jak daleko idziemy w KPI attribution (heurystyki vs manual)?  
- Czy mapowanie KPI→finanse (BS/P&L/CF) to R2 czy v4?

### 3.4 Tools

- Minimalny zestaw assetów per tool na go‑live (thumbnail vs video).
- Standard split view vs jedna powierzchnia dla “content-heavy” narzędzi.

---

## 4) SSOT impact (co musi być spójne)

LLM OS / AI Platform:
- `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`
- `docs/product/MODEL_REGISTRY_V3.md`
- `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
- `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
- `docs/product/modules/ai/AI_MARKET_UPDATE_STANDARD_V3.md`
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- `docs/product/modules/ai/AI_PLATFORM_READINESS_AUDIT_V3.md`

Synchronizacja:
- `docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `docs/flows/integration/EXTERNAL_INTEGRATIONS_FLOW.md`

Assessment+KPI:
- `docs/product/RESULTS_V3.md`
- `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- `docs/product/TOOLS_SSOT_SOURCES_V3.md`

Tools:
- `docs/product/TOOLS_CATALOG_V3.md`
- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/VIDEO_ENABLEMENT_V3.md`
- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`

---

## 5) Backlog extraction → `V3_IMPLEMENTATION_PROGRAM.md` (taski)

### 5.1 Taski już istniejące (referencje)

LLM:
- V3-A06 (Model Registry)
- V3-N01..N03 (metering + error-path + market inbox governance)

Sync:
- V3-M01..M13 (Integrations & MCP)

Assessment+KPI:
- V3-E06 (parity methodologies)
- V3-H01..H03 (Results KPI/ROI)

Tools:
- V3-E01..E07 (Tools mental model + wizard + quality)

### 5.2 Nowe taski do dopisania (ideal V3, R2+ jeśli nie blokuje R0)

LLM / AI Platform:
- **V3-N04** — Deep Research Evidence Ledger: Claim→EvidenceSnippet + Coverage + Contradictions + Research Viewer UX + quality metrics
- **V3-N05** — Chat intent classifier (cheap) + workflow router (chat vs deep research vs execution) + purpose mapping
- **V3-N06** — Coverage report per org: “policy‑allowed + enabled_for_org + healthy” coverage dla wszystkich aktywnych purposes
- **V3-N07** — Smoke contract: `smoke:ai:research-ledger` (citation coverage + unsupported claim rate)

Assessment+KPI:
- **V3-H04** — KPI attribution policy (manual vs heuristic) + minimal finance mapping decision (R2)

Tools:
- **V3-E08** — Tool-linked KB assets baseline: thumbnails MUST + micro‑video SHOULD (z gatingiem jakości)

Sync:
- **V3-M14** — Sync scope labels + UX: czytelne “read-only vs bidirectional” + user expectation management (copy + badges)

