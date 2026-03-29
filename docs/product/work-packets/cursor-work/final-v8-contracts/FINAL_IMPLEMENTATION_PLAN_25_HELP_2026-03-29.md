# Final Implementation Contract — Help (Position 25/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; extracted scope for position 25)

## 1. Executive summary
- **Intent**: Kontekstowy help; spójny język; dostępny dla Anny i Teresy.
- **Primary users**: każdy użytkownik potrzebujący wsparcia w kontekście aktualnej pracy.
- **Success metric**: „contextual guidance” działa na kluczowych powierzchniach i jest konsystentny językowo + integruje się z AI (Anna/Teresa) bez chaosu.

## 2. Scope
### 2.1 In-scope
- Contextual help entry points z modułów.
- Spójny język i routing; integracja z Teresa/Anna jako przewodnikiem.

### 2.2 Out-of-scope / non-goals
- Pełna platforma „Edukacja” (osobny plan Wave2).
- Community/forum.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan (combined): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu: `WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` (contextual help + curated knowledge + content ops jako część produktu).
- Artykuły/formaty w repo (content ops seed posture):
  - `docs/product/KB_ARTICLE_TEMPLATE_FOR_TOOLS_V1.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **Intercom (Knowledge Hub + Messenger + AI agent knowledge sources)**:
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/9357912-knowledge-explained.html` (knowledge product posture).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/6612588-messenger-explained.html` (in-app messenger jako help entry surface).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/5241719-let-customers-search-for-articles-in-the-messenger.html` (contextual search entry).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/11394959-use-ai-powered-content-recommendations-to-improve-fin.html` (AI-powered content recommendations).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/9440354-knowledge-sources-to-power-ai-agents-and-self-serve-support.html` (knowledge sources powering AI agents).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/8322387-set-up-fin-ai-agent-s-multilingual-support.html` (multilingual support posture).
- **Intercom developer posture (Help Center as API surface)**:
  - `Softs/0 Baza wiedzy /Intercom 1/developers.intercom.com/docs/references/rest-api/api.intercom.io/help-center/listhelpcenters.md` (list help centers).
  - `Softs/0 Baza wiedzy /Intercom 1/developers.intercom.com/docs/references/rest-api/api.intercom.io/articles/listarticles.md` (articles listing).
- **Zendesk (Help Center search posture)**:
  - `Softs/0 Baza wiedzy /Zendesk 2/support.zendesk.com/hc/ja/search.html` (help center search surface).
  - `Softs/0 Baza wiedzy /Zendesk 2/support.zendesk.com/hc/ja/articles/4408886879258-Zendesk-Support検索リファレンス.html` (search reference posture).
- **Atlassian (support posture as product surface)**:
  - `Softs/0 Baza wiedzy /Atlassion 1/developer.atlassian.com/support.html` (support entry posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “calm contextual help product + curated knowledge + content ops”, nie “kolejny link do docs”.**

- **One clear help entry + in-context entry points (Intercom Messenger)**:
  - Help dostępny “tu i teraz” z powierzchni pracy (moduł → help), nie tylko przez globalny portal.
- **Search and discovery posture (Intercom/Zendesk)**:
  - Użytkownik może szybko szukać artykułów; wyniki są czytelne i nie wymagają “zgadywania”.
- **Knowledge curation (Intercom Knowledge)**:
  - Struktura (collections/folders/tags) i “what to read next” nie są przypadkowe.
- **AI guidance grounded in knowledge sources (Intercom knowledge sources)**:
  - Teresa/Anna kierują do treści na podstawie jawnych źródeł; brak overclaim.
- **Multilingual + consistent language (Intercom multilingual)**:
  - Pomoc jest spójna językowo i wspiera PL/EN bez driftu.
- **Content ops is part of the product (developer/API posture + KB templates)**:
  - Seedowanie, lifecycle, i ownership są jawne; istnieje format “tool KB article” jako baseline.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Contextual recommendation | help matches surface | “recommendation depth remains open” | Dopiąć kontekstowe rekomendacje na kluczowych surfaces (bounded) | P0 |
| Editorial/content ops | curated + durable | “content seeding… needs stronger packaging” | Zbudować widoczne content ops: seed, owner, lifecycle, update policy | P0 |
| Runtime vs docs cohesion | KB feels real | “docs > runtime maturity” | KB ma być używalnym produktem w runtime, nie tylko repo docs | P0

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Help jest dostępny kontekstowo na zadeklarowanych surfaces (modułowe entry points).
- Teresa/Anna potrafią kierować do właściwego help content (bez “ogólników”) i wskazują źródło.
- Content ops jest widoczny: ownership, update posture, minimalny seed (np. tool KB articles wg template).

### 5.2 Tests
- Integracyjne: entry point z modułu → open help → search → open article → “next step” routing.
- Regression: brak artykułu / brak tłumaczenia → czytelny degraded state + fallback do EN.
- Contract tests: recommendation payload zawiera context (surface/module) + article ids + rationale.

### 5.3 Staging proof checklist
- Demo: 3 surfaces (np. `Tools`, `Interview`, `Outputs`) → contextual help → artykuł → next action.
- Demo: PL/EN przełączenie + Teresa guidance bez driftu.

