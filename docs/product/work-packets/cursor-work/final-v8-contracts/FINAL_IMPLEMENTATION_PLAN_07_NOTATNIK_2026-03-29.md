# Final Implementation Contract — Notatnik (Position 7/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Jest ok, trzeba dobrze połączyć z resztą aplikacji.
- **Primary users**: każdy użytkownik (capture, wiedza operacyjna).
- **Success metric**: frictionless capture + structured note + search-first discovery + powiązania z pracą (inicjatywy/wykonanie/chat).

## 2. Scope
### 2.1 In-scope
- Notebook jako powierzchnia capture i pracy na notatce + linking do reszty systemu.
- Templates + AI propose/review w notatce (w granicach planu).

### 2.2 Out-of-scope / non-goals
- Kopiowanie pełnego Notion „databases-as-product” 1:1.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md`
- Benchmark: `docs/product/NOTATKA_V8_BENCHMARK.md`
- SSOT: `docs/product/NOTATKA_V8_SSOT.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: `Notion` (structured knowledge system + templates), `Evernote` (frictionless capture + search-first).

## 5. Evidence plan (DoD)
- Acceptance: quick capture działa z wielu kontekstów; notatka ma spójny lifecycle; search i linking pozwalają odzyskać wiedzę.
- Evidence: staging demo capture→link→AI propose→accept + testy integracyjne search/linking.

