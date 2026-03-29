# Final Implementation Contract — Anna (Position 16/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Ma dostać pełniejszy kontekst DBR77+produkty; rozwój wiedzy sterowalny w Superadmin (Virtual Workers).
- **Primary users**: public/external entry (LP) + sales/discovery.
- **Success metric**: bezpieczny public guide z mierzalną konwersją, multilang, i jawnie ograniczonym voice; bez mieszania tożsamości z `Teresa`.

## 2. Scope
### 2.1 In-scope
- Public Q&A w granicach public knowledge.
- CTA handoff (demo/trial/contact) + funnel instrumentation.
- Multilang i voice resilience (declared lanes).

### 2.2 Out-of-scope / non-goals
- Pełny autonomous public sales agent.
- Wewnętrzny copilot (to `Teresa`).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANNA_2026-03-29.md`
- SSOT: `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- Benchmark (chat expectations): `docs/product/CHAT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: `ChatGPT` (core assistant), `Claude` (library/files), `Perplexity` (research/source transparency).
- **KIMI-style**: `KIMI` (w planie) — jeśli ma oznaczać konkretne zachowania, potrzebujemy referencji (**missing input**, bez zgadywania).

## 5. Evidence plan (DoD)
- Acceptance: CTA i event grammar są mierzalne; multilang działa bez identity drift; voice ma jasne fallback states.
- Evidence: staging flows + event validation + regression tests dla boundary/safety.

