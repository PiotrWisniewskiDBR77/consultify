# Final Implementation Contract — Historia czatów (Position 35/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) — P35-A complete (direct contract over existing plan)

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

### 2.3 P35-A canon — historia jako biblioteka (history/library) + retrieval boundaries (governed)
**Cel kanonu**: jedna, spójna “biblioteka rozmów” (threads → sessions → messages) z jasnymi granicami wyszukiwania i retencji, która **konsumuje P34 policy gateway** i nie tworzy równoległych prawd danych.

#### 2.3.1 Object model (thread / session / message) + attachments + metadata + indexes
- **Thread (conversation / wątek)**:
  - trwała jednostka biblioteczna; to *to* co użytkownik widzi jako “rozmowę” na liście,
  - ma własny lifecycle: `active` / `archived` / `deleted` (delete jest destrukcyjny i ma retencję/grace),
  - ma atrybuty biblioteczne: `title`, `pinnedAt`, `archivedAt`, `deletedAt`, `lastMessageAt`, `chatFolderId?`, `scope` (private vs team/org), `createdByUserId`, `orgId/tenantId`.
- **Session (sesja wątku)**:
  - opcjonalny podział thread na odcinki czasu (“ciągłość pracy”); nie jest osobnym wątkiem,
  - łączy parametry runtime: snapshot modelu/presetu, język/locale, tryb narzędzi, parametry retrieval (ale *nie* politykę),
  - służy do audytu i analytics (“co było uruchomione gdy powstały wiadomości”), nie do zmiany widoczności.
- **Message (wiadomość)**:
  - zawsze przypisana do `threadId` (i opcjonalnie `sessionId`),
  - role/typ: `user` / `assistant` / `system` / `tool` (bounded; system/tool nie są edytowane przez usera),
  - treść + stan: streaming/failed/retried; opcjonalne `editedAt` (tylko user content) i `redactionState` (PII/retention),
  - metadane: `createdAt`, `tokenUsage?`, `language?`, `safetyFlags?`.
- **Attachments (załączniki / linki w wiadomości)**:
  - w historii przechowujemy **linki/pointery**, nie równoległy storage:
    - typy: `file` / `link` / `artifact` / `snapshot` / `reference`,
    - pola minimalne: `kind`, `targetId/targetUrl`, `displayName`, `mime?`, `sizeBytes?`, `createdAt`, `provenancePointer?`,
  - brak “ukrytego” uploadu do AI poza governance; użycie załączników w odpowiedzi jest śladowane przez P34 (source ledger).
- **Metadata (bounded, audytowalne)**:
  - `visibilityScope` i `accessPolicyVersion` (żeby wiedzieć jaką polityką objęto search/retrieval),
  - `client` (platforma/appVersion) dla debug,
  - `retentionPolicy` (np. org retention window) jako jawny atrybut.
- **Indexes (minimalny zestaw, bez wycieków)**:
  - listowanie: `(orgId, userId, deletedAt=null, lastMessageAt desc)` dla private,
  - listowanie folderów: `(orgId, chatFolderId, deletedAt=null, lastMessageAt desc)` dla team,
  - wyszukiwanie: indeks tytułu + “preview/snippet” + (docelowo) pełnotekst `messages.content` (server-side),
  - wszystko zawsze z filtrem scope z P34 *przed* rankingiem.

#### 2.3.2 Retrieval/search posture (query/filter, ranking, pagination, retention rules — bounded)
- **Zasada nadrzędna (policy-first)**: scope resolution i filtry dostępu są rozstrzygane przez **P34 policy gateway** zanim nastąpi jakiekolwiek wyszukiwanie/ranking.
- **Query + filters (bounded API posture)**:
  - `q` (tekst), `folderId?`, `pinned?`, `archived?`, `includeDeleted=false` (zawsze default),
  - `from?` / `to?` (czas), `hasAttachments?`,
  - brak filtrów, które enumerują cudze dane (np. “show me other users”).
- **Ranking (bounded, zrozumiały)**:
  - preferencja: lexical match (title + snippet + message content) + boost recency (`lastMessageAt`) + boost pinned,
  - brak “semantic ranking” bez jawnego, governowanego włączenia (to byłby osobny, eksplicytny rozszerzający zakres krok).
- **Pagination (must, stable)**:
  - cursor-based pagination (np. `cursor=lastMessageAt+threadId`) zamiast offset,
  - deterministic order; brak duplikatów między stronami; idempotentne “next page”.
- **Retention (bounded rules)**:
  - `archive` zachowuje thread i wiadomości (reversible),
  - `delete` jest destrukcyjny: thread nie jest widoczny w bibliotece; obowiązuje grace window zanim nastąpi final purge,
  - org może mieć politykę retencji (window) — system respektuje ją i komunikuje użytkownikowi (bez “niespodzianek”).

#### 2.3.3 Governance boundaries (consume P34 gateway; privacy/PII; deletion/retention semantics)
- **No ungoverned retrieval**:
  - UI/consumer nie wykonuje “bocznych” zapytań o treść wiadomości poza governowanym entrypointem,
  - search/retrieval musi przejść przez gateway: filtrowanie dostępu → dopiero potem ranking i snippets.
- **Privacy/PII posture (bounded, product-safe)**:
  - historia może zawierać PII użytkownika; system traktuje treść jako dane prywatne/organizacyjne zależnie od scope,
  - brak cross-tenant/cross-org i brak cross-user private; brak enumeracji istnienia cudzych threadów,
  - wspieramy “delete my data” w granicach: usunięcie treści + minimalny ślad audytu operacji (bez treści).
- **Deletion semantics**:
  - delete wymaga explicit confirmation (destructive),
  - delete jest co najmniej soft-delete (grace) + final purge; po purge nie ma “restore”,
  - po delete/purge: usuwamy message content + attachment pointers; zachowujemy minimalny audit event (kto/kiedy/ile).

#### 2.3.4 Anti-duplicate gate — one history truth (no parallel `chat_logs_v2`)
- **Jedna prawda historii**:
  - jeden zestaw encji dla: threads / sessions / messages / attachment links / search index,
  - brak równoległych tabel i endpointów typu `chat_logs_v2`, `threads_v2`, `history2`, “temporary” kopii bez planu migracji.
- **Jeśli istnieje legacy**:
  - dopuszczalne: adapter/read-through lub widok kompatybilności,
  - niedopuszczalne: tworzenie nowego storage “bo szybciej” bez eksplicytnej zgody scope w osobnym pakiecie.

#### 2.3.5 Degraded / error posture (8+ scenarios — bez udawania)
- **Gateway unavailable / timeout** (P34 down): biblioteka pokazuje listę threadów, ale search “target” przechodzi w tryb ograniczony (np. title-only) z jawnym komunikatem.
- **Search index stale**: wyniki mogą być niepełne; UI komunikuje “częściowe wyniki”, daje możliwość ponowienia.
- **Cursor invalid / pagination drift**: UI resetuje paginację do stabilnego punktu (np. od początku) bez crash.
- **Permission change mid-flight**: thread znika z wyników; UI pokazuje “brak dostępu” bez ujawniania szczegółów.
- **Thread deleted / not found** (deep-link): UI pokazuje stan “nie istnieje / usunięty” i bezpieczny powrót do biblioteki.
- **Attachment missing / revoked**: wiadomość pozostaje, ale attachment pokazuje “niedostępny” (bez wycieku dlaczego).
- **Partial retrieval** (część scope zablokowana): UI nie pokazuje zablokowanych elementów; może pokazać high-level badge “część wyników niedostępna”.
- **Rate limit / overload**: backoff + retry; UI komunikuje ograniczenia; nie przełącza się na niegouvernowany fallback.
- **Write conflict** (rename/move/archive): UI odświeża stan z serwera i prosi o ponowienie akcji.
- **Export/history fetch too large**: system wymusza zawężenie zakresu (date range) lub async export.

#### 2.3.6 Acceptance checklist (P35-A → approved(scope))
- [ ] Zdefiniowany i nazwany jest **kanoniczny model**: thread/session/message + attachment pointers + metadata.
- [ ] Jasne lifecycle semantics: `pin` / `archive` / `delete` oraz to, co jest reversible vs destructive.
- [ ] Folder semantics są rozdzielone od `projectId` (brak folder↔project confusion).
- [ ] Search ma jawny kontrakt: query + filtry + ranking (bounded) + brak “fake search” bez deklaracji.
- [ ] Pagination jest cursor-based i stabilna (no duplicates / deterministic order).
- [ ] Retention i delete semantics są jawne (grace + final purge) i zgodne z privacy.
- [ ] **P34 policy gateway** jest konsumowany: scope-first, brak ungoverned retrieval/search.
- [ ] Brak enumeracji cudzych danych: no cross-tenant / cross-org / cross-user private.
- [ ] Anti-duplicate gate jest jawny: **jedna prawda historii**, brak `chat_logs_v2`.
- [ ] Degraded/error posture ma 8+ scenariuszy i nie “udaje” wyników.
- [ ] Evidence ledger row P35-A jest wypełniony jako docs-only (`n/a` dla testów/staging).
- [ ] `EXECUTION_INDEX` #35 jest ustawiony na `approved(scope)` i lock jest gotowy do release.

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

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Chat history SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P35-A — Thread lifecycle canon + scope boundaries (scope approval)
- **Goal**: kompletna biblioteka rozmów: lifecycle + folder semantics + personal/team scopes.
- **Inputs required**: destructive actions confirmation posture; permission model dla team folders; search target posture.
- **Acceptance**: scope zatwierdzony; non-goals jawne; archive≠delete i pin semantics spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze lifecycle actions (create/rename/pin/move/archive/unarchive/delete) and confirmation posture.
  - Freeze personal vs team folder semantics + permission gates + degraded states.
  - Freeze search target posture (server-side) + pagination/filters (bounded).
- **DoD**:
  - Approved(scope): lifecycle and search are explicit and testable; destructive actions are gated.

#### P35-B — Lifecycle + search target closure
- **Goal**: create/rename/pin/move/archive/unarchive/delete + search (baseline + target) z pagination/filters.
- **Acceptance**: 10 rozmów da się organizować i wyszukiwać; deep-links działają; brak leakage.
- **Evidence**: integracyjne testy + staging demo organize→search→revisit.
- **Tasks**:
  - Implement full lifecycle actions with consistent states (archive≠delete) and deep-links.
  - Implement server-side search target with pagination/filters; prove it’s not “fake search”.
  - Add integration/security regression tests and run staging demo (10 threads).
- **Staging proof script (click-by-click)**:
  1. Create 10 conversations; rename a few; pin/star some; move them into folders.
  2. Archive 2 threads and verify archive state is distinct from delete; unarchive one.
  3. Attempt delete and verify destructive confirmation is required and explicit.
  4. Use search target (server-side) with a filter/pagination; verify results include archived/non-archived as per rules.
  5. Open a deep-link to an archived thread and verify it loads with correct state.
  6. Test team folder permissions: user without access gets denial + guidance; no leakage.
- **DoD**:
  - Organize→search→revisit works; permissions prevent leakage; tests pass.

#### P35-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P35-A/B/C.
  - Validate rollback: disable destructive delete; preserve archive + read-only access.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw personal folders + lifecycle, potem team folders permissions (P1) i search target hardening.

### 8.3 Rollback plan
- Wyłącz destructive delete; zachowaj archive; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: “search udawany” (client-only) bez deklaracji granic.
- Ryzyko: team folders permissions leakage.
- Decyzje: minimalny zakres search target (fields + filters) jako P0.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P35-A | approved(scope) |  | n/a (docs-only) | n/a (docs-only) | §2.3 canon frozen: object model + governed retrieval boundaries + anti-duplicate + degraded posture + checklist |
| P35-B | delivered | (pending commit) | Integration: conversations.p35-history.test.ts (lifecycle CRUD, search target with cursor pagination, soft-delete grace, deep-link states, bulk ops, archive vs delete, team permissions, regression guards). Store: useConversationStore.p35-history.test.ts (grouping, actions, search, chatFolderId vs projectId separation). | 10-step staging proof: (1) create 10 conversations, (2) rename a few, (3) pin/star some, (4) move into folders via DnD, (5) archive 2 threads + verify distinct from delete, (6) unarchive one, (7) delete with destructive confirmation + soft-delete grace, (8) server-side search with filters + cursor pagination, (9) deep-link to archived thread loads correctly, (10) team folder permission denial returns 403 + no leakage. | Known limits: (1) semantic ranking not implemented (lexical + recency + pinned boost only), (2) full-text search on message content uses ILIKE (no dedicated FTS index yet), (3) grace window purge is manual (no automated cron job), (4) team folder permission denial shows generic error (no custom denial guidance component yet), (5) no "delete my data" self-service UI (backend supports it via force=true). |
| P35-C | verified(evidence) | (pending commit) | Integration: 15 tests (lifecycle, search, soft-delete, deep-links, bulk, permissions, regression). Store: 10 tests (grouping, actions, search, folder separation). All pass. | 10-step staging proof completed: create/rename/pin/move/archive/unarchive/delete/search/deep-link/team-denial. | Known limits: (1) lexical search only (no semantic), (2) ILIKE not FTS, (3) manual purge, (4) generic 403 UX, (5) no self-service delete-my-data UI, (6) no cross-tenant enumeration by design. |

