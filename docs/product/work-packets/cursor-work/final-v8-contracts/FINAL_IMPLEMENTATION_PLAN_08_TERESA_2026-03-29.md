# Final Implementation Contract — Teresa (Position 8/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: AI głosowy+tekstowy: pełen kontekst org + narzędzia + web; steruje aplikacją; konsultant/manager/partner/pracownik.
- **Primary users**: użytkownicy wewnątrz produktu (contextual copilot).
- **Success metric**: prawdziwy cross-surface handoff + ciągłość historii/voice w granicach runtime; bez overclaim „autonomous”.

## 2. Scope
### 2.1 In-scope
- Copilot wewnętrzny: rozumie aktywną powierzchnię, zachowuje kontekst, proponuje i przekazuje do modułu docelowego.
- Voice tylko tam, gdzie runtime jest wiarygodny; jasne degraded states.

### 2.2 Out-of-scope / non-goals
- Fully autonomous workflow engine.
- Public assistant (to `Anna`).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TERESA_2026-03-29.md`
- Benchmark (chat expectations): `docs/product/CHAT_V8_BENCHMARK.md`
- AI OS context: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Primary (chat UX)**: `ChatGPT`, `Claude`, `Perplexity` (z `CHAT_V8_BENCHMARK.md`).
- **KIMI-style**: `KIMI` (w planie i module cardach) — **missing input** dla „100% KIMI style” dopóki nie mamy referencji zachowania.

## 5. Evidence plan (DoD)
- Acceptance: user przechodzi chat → handoff do modułu (np. kalendarz/inicjatywy/tabele) z zachowaniem kontekstu; voice ma jawne availability i fallback.
- Evidence: staging scenariusze cross-surface + testy integracyjne dla handoff/adapters + log/audit dla akcji.

