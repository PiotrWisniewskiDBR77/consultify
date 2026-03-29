# Final Implementation Contract — Tabele (Position 15/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Pełna logika Airtable: tabele zwykłe/relacyjne + AI współbuduje jak konkurencja.
- **Primary users**: operatorzy danych i procesu.
- **Success metric**: table operating system: base/multi-table, field governance, views/forms/interfaces, relations/dependencies, AI propose→approval→apply.

## 2. Scope
### 2.1 In-scope
- Base + multi-table model (kanoniczny UX).
- Schema/fields, relations, views, forms, interfaces.
- AI-native table building: describe → plan → approve → build (proposal-driven).

### 2.2 Out-of-scope / non-goals
- Budowa klona Airtable/Coda; kopiowanie UI.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TABELE_2026-03-29.md`
- Benchmark: `docs/strategy/TABELE_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: `Airtable`, `Coda` (wprost w `TABELE_V8_BENCHMARK.md`).

## 5. Evidence plan (DoD)
- Acceptance: base/multi-table + manage fields + relations + saved views + forms/interfaces + AI schema proposal są spójne i reviewable.
- Evidence: staging demo „NL→schema proposal→approval→materialization” + testy dla field types/relations/views.

