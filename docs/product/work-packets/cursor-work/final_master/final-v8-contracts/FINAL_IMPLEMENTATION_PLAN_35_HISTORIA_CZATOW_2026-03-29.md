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
### 4.1 Primary benchmark family (SSOT)
- Detailed plan: `docs/product/CHAT_V8_IMPLEMENTATION_PLAN.md` (stream `V8-CHAT-02 HistoryAndLibrary`).
- Model: `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md` (folder/entity/lifecycle rules).

### 4.2 Local Softs evidence (concrete artifacts)
- **LangSmith (threads/history as an explicit entity + query + export posture)**:
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/threads.html` (threads model posture).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/query-threads.html` (query/search posture).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/export-traces.html` (export/audit adjacency).
- **OpenAI (conversation state as a first-class runtime contract)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/api/docs/guides/conversation-state.html` (conversation state posture).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/api/docs/guides/realtime-conversations.html` (conversation lifecycle posture in realtime).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “history = biblioteka wątków z lifecycle + search + revisit”, nie “lista ostatnich rozmów”.**

- **Conversation is a durable entity (SSOT + conversation state posture)**:
  - Wątek ma tożsamość, można wrócić/otworzyć/ciągnąć dalej; deep-link działa.
- **Lifecycle actions are explicit (SSOT)**:
  - Rename/pin/archive/delete/move mają przewidywalne skutki i nie mieszają się semantycznie.
- **Folders have scope (SSOT)**:
  - Foldery personal vs team są jawne; prawa dostępu nie są zgadywane.
- **Search is real (SSOT baseline→target)**:
  - Rozróżnienie baseline (title/preview) vs target (server-side + pagination/filters) jest jawne i testowalne.
- **Audit adjacency (LangSmith export posture)**:
  - Operacje na historii (zwłaszcza delete) mają ślad audytu i dają się zweryfikować (bounded).
- **No folder↔project confusion (SSOT)**:
  - `chatFolderId` nie jest substytutem `projectId`.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Chat v8 plan/model)
Źródło prawdy: `CHAT_V8_IMPLEMENTATION_PLAN.md` + `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Complete lifecycle closure | durable threads | “required” | Dopiąć create/rename/pin/archive/delete/move bez luk i sprzeczności | P0 |
| Search target posture | queryable library | “baseline + target declared” | Zbudować target search (server-side) + pagination/filters i udowodnić | P0 |
| Team folder permissions | explicit scope | “team folders exist” | Dopiąć permissions model dla team folders + degraded states | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Wszystkie akcje lifecycle działają; search działa (baseline + target); folder vs project nie miesza semantyki.
- Archive ≠ delete (stany są czytelne); pin/star semantics są spójne produktowo.
- Personal vs team folder jest jawne w UI i w permission gates.

### 5.2 Tests
- Integracyjne: create → rename → pin → move folder → archive → unarchive → delete (destructive) z potwierdzeniem.
- Search tests: baseline search (client) + target search (server) + pagination; brak “udawania pełnego search”.
- Regression: deep-link do archived thread działa; folder move nie gubi project relation.

### 5.3 Staging proof checklist
- Demo: organize (folders + pin + archive) → search → revisit (open→continue) na min. 10 rozmowach.
- Demo: team folder permissions (user bez dostępu) → denial + guidance; brak leakage.

