# Final Implementation Contract — Historia czatów (Position 35/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (direct contract over existing plan)

## 1. Executive summary
- **Intent**: Dobre zarządzanie historią rozmów realizowanych także w aplikacji.
- **Primary users**: każdy użytkownik chatu.
- **Success metric**: history to biblioteka: folders (personal/team), search, pin/archive/delete, revisit — bez mieszania folderów z projectami.

## 2. Scope
### 2.1 In-scope
- Conversation lifecycle (create/rename/pin/archive/delete/move).
- Library views: all/pinned/folder/search/archived.
- Folder contract: personal vs team.
- Rozdzielenie `chatFolder` vs `projectId`.

### 2.2 Out-of-scope / non-goals
- Budowa osobnego „PM project system” w historii (to inne moduły).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan: `docs/product/CHAT_V8_IMPLEMENTATION_PLAN.md`
- Model: `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- Benchmark: `docs/product/CHAT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: `Claude` (history/library/folders jako leader benchmark).
- **Secondary**: `ChatGPT` (simplicity), `Perplexity` (search/research semantics) — jako kontekst benchmarku całego chatu.

## 5. Evidence plan (DoD)
- Acceptance: wszystkie akcje lifecycle działają; search działa (baseline + target); folder vs project nie miesza semantyki.
- Evidence: e2e testy history flows + staging demo „organize → search → revisit”.

